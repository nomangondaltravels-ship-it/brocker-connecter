import {
  buildPostgrestInFilter,
  formatSizeLabel,
  getBearerToken,
  getSupabaseConfig,
  json,
  normalizeText,
  parseLeadMeta,
  parsePropertyMeta,
  requiredEnv,
  sanitizePublicListing,
  supabaseSelect,
  verifyToken
} from '../server/_broker-platform.mjs';

function applySectionFilter(rows, section) {
  const items = Array.isArray(rows) ? rows : [];
  switch (section) {
    case 'requirements':
    case 'broker-requirements':
    case 'shared-leads':
      return items.filter(item => item.source_type === 'lead');
    case 'marketplace':
    case 'broker-connector-listings':
    case 'shared-properties':
      return items
        .filter(item => item.source_type === 'property')
        .sort((left, right) => Number(Boolean(right.is_distress)) - Number(Boolean(left.is_distress)));
    case 'distress-deals':
      return items.filter(item => item.source_type === 'property' && item.is_distress);
    default:
      return items;
  }
}

function isLeadPublicSourceValid(row) {
  if (!row || !row.is_listed_public) return false;
  if (normalizeText(row.public_listing_status).toLowerCase() !== 'listed') return false;
  const meta = parseLeadMeta(row.follow_up_notes);
  return !Boolean(meta.isArchived);
}

function isPropertyPublicSourceValid(row) {
  if (!row || !row.is_listed_public) return false;
  if (normalizeText(row.public_listing_status).toLowerCase() !== 'listed') return false;
  const meta = parsePropertyMeta(row.description);
  return !Boolean(meta.isArchived);
}

async function filterValidPublicRows({ supabaseUrl, serviceRoleKey, rows }) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return [];

  const brokerIds = Array.from(new Set(items.map(item => normalizeText(item.broker_uuid)).filter(Boolean)));
  const brokerIdNumbers = Array.from(new Set(items.map(item => normalizeText(item.broker_id_number)).filter(Boolean)));
  const leadIds = Array.from(new Set(items.filter(item => item.source_type === 'lead').map(item => item.source_id).filter(value => value !== undefined && value !== null)));
  const propertyIds = Array.from(new Set(items.filter(item => item.source_type === 'property').map(item => item.source_id).filter(value => value !== undefined && value !== null)));

  const [brokersById, brokersByBrokerId, leadRows, propertyRows] = await Promise.all([
    brokerIds.length
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'brokers',
          select: '*',
          filters: { id: buildPostgrestInFilter(brokerIds) }
        }).catch(() => [])
      : [],
    brokerIdNumbers.length
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'brokers',
          select: '*',
          filters: { broker_id_number: buildPostgrestInFilter(brokerIdNumbers) }
        }).catch(() => [])
      : [],
    leadIds.length
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_leads',
          select: 'id,broker_uuid,is_listed_public,public_listing_status,follow_up_notes',
          filters: { id: buildPostgrestInFilter(leadIds) }
        }).catch(() => [])
      : [],
    propertyIds.length
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_properties',
          select: 'id,broker_uuid,is_listed_public,public_listing_status,size,description',
          filters: { id: buildPostgrestInFilter(propertyIds) }
        }).catch(() => [])
      : []
  ]);

  const brokerRows = [
    ...(Array.isArray(brokersById) ? brokersById : []),
    ...(Array.isArray(brokersByBrokerId) ? brokersByBrokerId : [])
  ];

  const validBrokerIds = new Set();
  const validBrokerIdNumbers = new Set();
  const brokerActivityById = new Map();
  const brokerActivityByBrokerId = new Map();
  const brokerAvatarById = new Map();
  const brokerAvatarByBrokerId = new Map();
  for (const broker of Array.isArray(brokerRows) ? brokerRows : []) {
    if (broker?.is_blocked) continue;
    const brokerId = normalizeText(broker.id);
    const brokerIdNumber = normalizeText(broker.broker_id_number);
    const brokerAvatar = normalizeText(
      broker.avatar_data_url
      || broker.avatar_url
      || broker.profile_image_url
      || broker.profile_photo_url
    );
    if (brokerId) {
      validBrokerIds.add(brokerId);
      brokerActivityById.set(brokerId, normalizeText(broker.last_activity));
      brokerAvatarById.set(brokerId, brokerAvatar);
    }
    if (brokerIdNumber) {
      validBrokerIdNumbers.add(brokerIdNumber);
      brokerActivityByBrokerId.set(brokerIdNumber, normalizeText(broker.last_activity));
      brokerAvatarByBrokerId.set(brokerIdNumber, brokerAvatar);
    }
  }

  const validLeadIds = new Set(
    (Array.isArray(leadRows) ? leadRows : [])
      .filter(row => isLeadPublicSourceValid(row))
      .map(row => String(row.id))
  );
  const validPropertyIds = new Set(
    (Array.isArray(propertyRows) ? propertyRows : [])
      .filter(row => isPropertyPublicSourceValid(row))
      .map(row => String(row.id))
  );
  const leadRowMap = new Map((Array.isArray(leadRows) ? leadRows : []).map(row => [String(row.id), row]));
  const propertyRowMap = new Map((Array.isArray(propertyRows) ? propertyRows : []).map(row => [String(row.id), row]));

  return items.flatMap(item => {
    const brokerUuid = normalizeText(item.broker_uuid);
    const brokerIdNumber = normalizeText(item.broker_id_number);
    const brokerIsValid = (brokerUuid && validBrokerIds.has(brokerUuid))
      || (brokerIdNumber && validBrokerIdNumbers.has(brokerIdNumber));
    if (!brokerIsValid) return [];
    const brokerLastActivity = brokerActivityById.get(brokerUuid) || brokerActivityByBrokerId.get(brokerIdNumber) || '';
    const brokerAvatarUrl = brokerAvatarById.get(brokerUuid) || brokerAvatarByBrokerId.get(brokerIdNumber) || '';

    if (item.source_type === 'lead') {
      if (!validLeadIds.has(String(item.source_id))) return [];
      const sourceRow = leadRowMap.get(String(item.source_id));
      const meta = parseLeadMeta(sourceRow?.follow_up_notes);
      return [{
        ...item,
        broker_last_activity: brokerLastActivity,
        broker_avatar_url: brokerAvatarUrl,
        building_label: normalizeText(meta.preferredBuildingProject || item.size_label),
        size_label: ''
      }];
    }
    if (item.source_type === 'property') {
      if (!validPropertyIds.has(String(item.source_id))) return [];
      const sourceRow = propertyRowMap.get(String(item.source_id));
      const meta = parsePropertyMeta(sourceRow?.description);
      return [{
        ...item,
        broker_last_activity: brokerLastActivity,
        broker_avatar_url: brokerAvatarUrl,
        building_label: normalizeText(meta.buildingName),
        size_label: formatSizeLabel(sourceRow?.size, meta.sizeUnit)
      }];
    }
    return [];
  });
}

export async function GET(request) {
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing required environment variables for Broker Connector Page.' }, 500);
    }

    let exposeBrokerContact = false;
    const brokerSecret = requiredEnv('BROKER_SESSION_SECRET');
    const sessionToken = getBearerToken(request);
    const session = verifyToken(sessionToken, brokerSecret);
    if (session?.brokerUuid) {
      const brokers = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        select: 'id,is_blocked',
        filters: { id: session.brokerUuid }
      }).catch(() => []);
      const broker = Array.isArray(brokers) ? brokers[0] : null;
      exposeBrokerContact = Boolean(broker?.id && !broker?.is_blocked);
    }

    const section = new URL(request.url).searchParams.get('section') || 'all';
    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      select: [
        'id',
        'broker_uuid',
        'broker_display_name',
        'broker_id_number',
        'broker_mobile',
        'source_type',
        'source_id',
        'listing_kind',
        'purpose',
        'property_type',
        'category',
        'location',
        'price_label',
        'size_label',
        'bedrooms',
        'bathrooms',
        'public_notes',
        'status',
        'is_urgent',
        'is_distress',
        'created_at',
        'updated_at'
      ].join(','),
      filters: {
        public_listing_status: 'listed'
      },
      order: { column: 'updated_at', ascending: false }
    });

    const validRows = await filterValidPublicRows({ supabaseUrl, serviceRoleKey, rows });
    const filtered = applySectionFilter(validRows, section).map(row => sanitizePublicListing(row, { exposeBrokerContact }));
    return json(
      { listings: filtered, authenticated: exposeBrokerContact },
      200,
      { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' }
    );
  } catch (error) {
    return json({ message: error.message || 'Broker Connector Page load failed.' }, 500);
  }
}
