import {
  buildBrokerPublicSlug,
  buildPostgrestInFilter,
  formatSizeLabel,
  getSupabaseConfig,
  json,
  normalizeListingPurposeValue,
  normalizeText,
  parseLeadMeta,
  parsePropertyMeta,
  sanitizePublicListing,
  supabaseSelect
} from '../server/_broker-platform.mjs';

function getFreshnessMs(row) {
  const timestamp = row?.marketplace_sort_at || row?.marketplace_refreshed_at || row?.updated_at || row?.created_at || '';
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpiredMonthlyRow(row) {
  if (row?.source_type !== 'property' || normalizeListingPurposeValue(row?.purpose) !== 'monthly_rent') return false;
  const expiryDate = normalizeText(row?.expiry_date);
  if (!expiryDate) return false;
  const parsed = Date.parse(`${expiryDate}T23:59:59+04:00`);
  return Number.isFinite(parsed) && parsed < Date.now();
}

function isLeadSourceValid(row) {
  if (!row || !row.is_listed_public) return false;
  if (normalizeText(row.public_listing_status).toLowerCase() !== 'listed') return false;
  const meta = parseLeadMeta(row.follow_up_notes);
  return !Boolean(meta.isArchived);
}

function isPropertySourceValid(row) {
  if (!row || !row.is_listed_public) return false;
  if (normalizeText(row.public_listing_status).toLowerCase() !== 'listed') return false;
  const meta = parsePropertyMeta(row.description);
  return !Boolean(meta.isArchived);
}

function getBrokerAvatar(broker = {}) {
  return normalizeText(
    broker.avatar_data_url
    || broker.avatar_url
    || broker.profile_image_url
    || broker.profile_photo_url
  );
}

function sanitizeBrokerProfile(broker = {}, listings = []) {
  const name = normalizeText(broker.full_name || broker.broker_display_name || broker.company_name || 'NexBridge Broker');
  const companyName = normalizeText(broker.company_name);
  const saleCount = listings.filter(item => item.sourceType === 'property' && item.purpose === 'sale' && !item.isDistress).length;
  const yearlyRentCount = listings.filter(item => item.sourceType === 'property' && item.purpose === 'rent').length;
  const monthlyRentCount = listings.filter(item => item.sourceType === 'property' && item.purpose === 'monthly_rent').length;
  const distressCount = listings.filter(item => item.sourceType === 'property' && item.isDistress).length;

  return {
    slug: buildBrokerPublicSlug(broker),
    name,
    companyName,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NB',
    avatarUrl: getBrokerAvatar(broker),
    isVerified: Boolean(broker.is_verified),
    listingCount: listings.length,
    counts: {
      sale: saleCount,
      yearlyRent: yearlyRentCount,
      monthlyRent: monthlyRentCount,
      distress: distressCount
    }
  };
}

function withListingCover(row, sourceRow) {
  if (row.source_type !== 'property') return row;
  const meta = parsePropertyMeta(sourceRow?.description);
  const images = Array.isArray(meta.listingImages) ? meta.listingImages : [];
  return {
    ...row,
    building_label: normalizeText(meta.buildingName || row.building_label),
    size_label: formatSizeLabel(sourceRow?.size, meta.sizeUnit),
    listing_image_count: images.length,
    broker_avatar_url: '',
    listing_cover_image_url: normalizeText(images[0]?.url || images[0]?.dataUrl || images[0]?.src || images[0] || '')
  };
}

async function loadBrokerPublicRows({ supabaseUrl, serviceRoleKey, broker }) {
  const brokerUuid = normalizeText(broker.id);
  const brokerIdNumber = normalizeText(broker.broker_id_number);
  const [rowsByUuid, rowsByIdNumber] = await Promise.all([
    brokerUuid
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'public_listings',
          select: '*',
          filters: {
            broker_uuid: brokerUuid,
            source_type: 'property',
            public_listing_status: 'listed'
          },
          order: { column: 'updated_at', ascending: false }
        }).catch(() => [])
      : [],
    brokerIdNumber
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'public_listings',
          select: '*',
          filters: {
            broker_id_number: brokerIdNumber,
            source_type: 'property',
            public_listing_status: 'listed'
          },
          order: { column: 'updated_at', ascending: false }
        }).catch(() => [])
      : []
  ]);

  const rowMap = new Map();
  [...(Array.isArray(rowsByUuid) ? rowsByUuid : []), ...(Array.isArray(rowsByIdNumber) ? rowsByIdNumber : [])]
    .forEach(row => {
      if (row?.id) rowMap.set(String(row.id), row);
    });
  return Array.from(rowMap.values());
}

async function hydrateAndFilterRows({ supabaseUrl, serviceRoleKey, rows }) {
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) return [];

  const leadIds = Array.from(new Set(items.filter(item => item.source_type === 'lead').map(item => item.source_id).filter(value => value !== undefined && value !== null)));
  const propertyIds = Array.from(new Set(items.filter(item => item.source_type === 'property').map(item => item.source_id).filter(value => value !== undefined && value !== null)));

  const [leadRows, propertyRows] = await Promise.all([
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

  const leadMap = new Map((Array.isArray(leadRows) ? leadRows : []).map(row => [String(row.id), row]));
  const propertyMap = new Map((Array.isArray(propertyRows) ? propertyRows : []).map(row => [String(row.id), row]));

  return items
    .flatMap(row => {
      if (row.source_type === 'lead') {
        const source = leadMap.get(String(row.source_id));
        if (!isLeadSourceValid(source)) return [];
        const meta = parseLeadMeta(source?.follow_up_notes);
        return [{
          ...row,
          building_label: normalizeText(meta.preferredBuildingProject || row.size_label),
          size_label: ''
        }];
      }
      if (row.source_type === 'property') {
        const source = propertyMap.get(String(row.source_id));
        if (!isPropertySourceValid(source)) return [];
        return [withListingCover(row, source)];
      }
      return [];
    })
    .filter(row => !isExpiredMonthlyRow(row))
    .sort((left, right) => getFreshnessMs(right) - getFreshnessMs(left));
}

function findBrokerBySlug(brokers = [], slug = '') {
  const target = normalizeText(slug).toLowerCase();
  if (!target) return null;
  return (Array.isArray(brokers) ? brokers : []).find(broker => {
    const candidates = [
      buildBrokerPublicSlug(broker),
      normalizeText(broker.public_slug),
      normalizeText(broker.id),
      normalizeText(broker.broker_id_number)
    ].map(item => normalizeText(item).toLowerCase()).filter(Boolean);
    return candidates.includes(target);
  }) || null;
}

export async function GET(request) {
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing required environment variables for broker profile.' }, 500);
    }

    const url = new URL(request.url);
    const slug = normalizeText(url.searchParams.get('broker') || url.searchParams.get('b') || url.searchParams.get('slug'));
    if (!slug) {
      return json({ message: 'Broker profile link is missing.' }, 400);
    }

    const brokers = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      select: 'id,broker_id_number,full_name,company_name,is_verified,is_blocked,avatar_data_url,avatar_url,profile_image_url,profile_photo_url',
      order: { column: 'updated_at', ascending: false }
    }).catch(() => []);
    const broker = findBrokerBySlug((Array.isArray(brokers) ? brokers : []).filter(item => !item?.is_blocked), slug);
    if (!broker) {
      return json({ message: 'Broker profile was not found.' }, 404);
    }

    const publicRows = await loadBrokerPublicRows({ supabaseUrl, serviceRoleKey, broker });
    const hydratedRows = await hydrateAndFilterRows({ supabaseUrl, serviceRoleKey, rows: publicRows });
    const listings = hydratedRows.map(row => {
      const safeListing = sanitizePublicListing(row, { exposeBrokerContact: false });
      return {
        ...safeListing,
        coverImageUrl: normalizeText(row.listing_cover_image_url),
        brokerName: '',
        brokerMobile: '',
        brokerUuid: '',
        brokerIdNumber: ''
      };
    }).filter(Boolean);

    return json(
      {
        broker: sanitizeBrokerProfile(broker, listings),
        listings
      },
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
  } catch (error) {
    return json({ message: error.message || 'Broker profile could not load.' }, error.status || 500);
  }
}
