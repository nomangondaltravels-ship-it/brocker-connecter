import {
  buildPostgrestInFilter,
  getSupabaseConfig,
  json,
  normalizeText,
  parseLeadMeta,
  parsePropertyMeta,
  supabaseDelete,
  supabaseSelect
} from './_broker-platform.mjs';

const CLEANUP_TOKEN = 'reconcile-public-20260422-X7p9L2m4Qa';

function requireCleanupToken(request) {
  const token = normalizeText(request.headers.get('x-cleanup-token'));
  if (token !== CLEANUP_TOKEN) {
    const error = new Error('Cleanup token is missing or invalid.');
    error.status = 401;
    throw error;
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

async function collectPublicListingValidity({ supabaseUrl, serviceRoleKey, rows }) {
  const items = Array.isArray(rows) ? rows : [];
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
          select: 'id,broker_id_number,is_blocked',
          filters: { id: buildPostgrestInFilter(brokerIds) }
        }).catch(() => [])
      : [],
    brokerIdNumbers.length
      ? supabaseSelect({
          supabaseUrl,
          serviceRoleKey,
          table: 'brokers',
          select: 'id,broker_id_number,is_blocked',
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
          select: 'id,broker_uuid,is_listed_public,public_listing_status,description',
          filters: { id: buildPostgrestInFilter(propertyIds) }
        }).catch(() => [])
      : []
  ]);

  const validBrokerIds = new Set();
  const validBrokerIdNumbers = new Set();
  for (const broker of [...(Array.isArray(brokersById) ? brokersById : []), ...(Array.isArray(brokersByBrokerId) ? brokersByBrokerId : [])]) {
    if (broker?.is_blocked) continue;
    if (normalizeText(broker.id)) validBrokerIds.add(normalizeText(broker.id));
    if (normalizeText(broker.broker_id_number)) validBrokerIdNumbers.add(normalizeText(broker.broker_id_number));
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

  const validRows = [];
  const invalidRows = [];
  for (const item of items) {
    const brokerUuid = normalizeText(item.broker_uuid);
    const brokerIdNumber = normalizeText(item.broker_id_number);
    const brokerIsValid = (brokerUuid && validBrokerIds.has(brokerUuid))
      || (brokerIdNumber && validBrokerIdNumbers.has(brokerIdNumber));

    const sourceIsValid = item.source_type === 'lead'
      ? validLeadIds.has(String(item.source_id))
      : item.source_type === 'property'
        ? validPropertyIds.has(String(item.source_id))
        : false;

    if (brokerIsValid && sourceIsValid) {
      validRows.push(item);
    } else {
      invalidRows.push(item);
    }
  }

  return { validRows, invalidRows };
}

export async function POST(request) {
  try {
    requireCleanupToken(request);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing Supabase environment variables.' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const execute = Boolean(body?.execute);

    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      select: 'id,broker_uuid,broker_id_number,source_type,source_id,listing_kind,location,status,is_distress,public_listing_status,updated_at',
      order: { column: 'updated_at', ascending: false }
    });

    const { validRows, invalidRows } = await collectPublicListingValidity({
      supabaseUrl,
      serviceRoleKey,
      rows
    });

    const details = invalidRows.map(item => ({
      id: item.id,
      brokerUuid: item.broker_uuid || '',
      brokerIdNumber: item.broker_id_number || '',
      sourceType: item.source_type || '',
      sourceId: item.source_id,
      listingKind: item.listing_kind || '',
      location: item.location || '',
      status: item.status || '',
      isDistress: Boolean(item.is_distress)
    }));

    if (!execute) {
      return json({
        mode: 'dry-run',
        counts: {
          total: Array.isArray(rows) ? rows.length : 0,
          valid: validRows.length,
          stale: invalidRows.length
        },
        staleRows: details
      });
    }

    const deleted = [];
    for (const row of invalidRows) {
      const result = await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'public_listings',
        filters: { id: row.id }
      });
      deleted.push(...(Array.isArray(result) ? result : []));
    }

    return json({
      mode: 'execute',
      counts: {
        total: Array.isArray(rows) ? rows.length : 0,
        valid: validRows.length,
        stale: invalidRows.length,
        deleted: deleted.length
      },
      staleRows: details
    });
  } catch (error) {
    return json({ message: error?.message || 'Public listing reconciliation failed.' }, error?.status || 500);
  }
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
