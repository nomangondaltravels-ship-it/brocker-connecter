import {
  getSupabaseConfig,
  json,
  normalizeEmail,
  normalizeText,
  supabaseAuthDeleteUser,
  supabaseDelete,
  supabaseSelect
} from './_broker-platform.mjs';

const CLEANUP_TOKEN = 'cleanup-single-20260422-R4m8Q2k1Lp';
const TARGET_BROKER = {
  id: '9c507e24-9425-4a60-8bee-b45b19a848fc',
  email: 'noman@gmail.com',
  brokerIdNumber: '1212'
};

const OPTIONAL_BROKER_TABLES = [
  'broker_followups',
  'broker_notifications',
  'broker_ai_matches'
];

function requireCleanupToken(request) {
  const token = normalizeText(request.headers.get('x-cleanup-token'));
  if (token !== CLEANUP_TOKEN) {
    const error = new Error('Cleanup token is missing or invalid.');
    error.status = 401;
    throw error;
  }
}

function targetMatchesBroker(broker) {
  if (!broker) return false;
  return normalizeText(broker.id) === TARGET_BROKER.id
    && normalizeEmail(broker.email) === TARGET_BROKER.email
    && normalizeText(broker.broker_id_number) === TARGET_BROKER.brokerIdNumber;
}

async function selectOptionalRows({ supabaseUrl, serviceRoleKey, table, filters = {} }) {
  try {
    return await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table,
      filters,
      order: { column: 'created_at', ascending: false }
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('does not exist') || message.includes('relation') || message.includes('could not find')) {
      return [];
    }
    throw error;
  }
}

async function buildDeletePlan({ supabaseUrl, serviceRoleKey, broker }) {
  const leads = await selectOptionalRows({
    supabaseUrl,
    serviceRoleKey,
    table: 'broker_leads',
    filters: { broker_uuid: broker.id }
  });
  const properties = await selectOptionalRows({
    supabaseUrl,
    serviceRoleKey,
    table: 'broker_properties',
    filters: { broker_uuid: broker.id }
  });

  const optionalRows = {};
  for (const table of OPTIONAL_BROKER_TABLES) {
    optionalRows[table] = await selectOptionalRows({
      supabaseUrl,
      serviceRoleKey,
      table,
      filters: { broker_uuid: broker.id }
    });
  }

  const publicListingMap = new Map();
  const byBrokerId = await selectOptionalRows({
    supabaseUrl,
    serviceRoleKey,
    table: 'public_listings',
    filters: { broker_id_number: broker.broker_id_number }
  });
  for (const row of byBrokerId) {
    publicListingMap.set(String(row.id), row);
  }

  for (const lead of leads) {
    const related = await selectOptionalRows({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: {
        source_type: 'lead',
        source_id: lead.id
      }
    });
    for (const row of related) {
      publicListingMap.set(String(row.id), row);
    }
  }

  for (const property of properties) {
    const related = await selectOptionalRows({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: {
        source_type: 'property',
        source_id: property.id
      }
    });
    for (const row of related) {
      publicListingMap.set(String(row.id), row);
    }
  }

  return {
    broker,
    leads,
    properties,
    optionalRows,
    publicListings: Array.from(publicListingMap.values())
  };
}

async function deleteRowsById({ supabaseUrl, serviceRoleKey, table, rows, brokerUuid = '' }) {
  const deleted = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const filters = { id: row.id };
    if (brokerUuid) {
      filters.broker_uuid = brokerUuid;
    }
    const result = await supabaseDelete({
      supabaseUrl,
      serviceRoleKey,
      table,
      filters
    });
    deleted.push(...(Array.isArray(result) ? result : []));
  }
  return deleted;
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

    const brokerRows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { id: TARGET_BROKER.id },
      order: { column: 'created_at', ascending: false }
    });
    const broker = Array.isArray(brokerRows) ? brokerRows[0] : null;

    if (!broker) {
      return json({
        mode: execute ? 'execute' : 'dry-run',
        target: TARGET_BROKER,
        found: false,
        message: 'Broker row not found.'
      });
    }

    if (!targetMatchesBroker(broker)) {
      return json({
        mode: execute ? 'execute' : 'dry-run',
        found: false,
        message: 'Broker row did not match the confirmed cleanup signature.',
        broker: {
          id: broker.id,
          email: broker.email || '',
          brokerIdNumber: broker.broker_id_number || ''
        }
      }, 409);
    }

    const plan = await buildDeletePlan({ supabaseUrl, serviceRoleKey, broker });
    const summary = {
      target: {
        id: broker.id,
        email: broker.email || '',
        brokerIdNumber: broker.broker_id_number || '',
        fullName: broker.full_name || ''
      },
      counts: {
        brokerLeads: plan.leads.length,
        brokerProperties: plan.properties.length,
        publicListings: plan.publicListings.length,
        brokerFollowups: (plan.optionalRows.broker_followups || []).length,
        brokerNotifications: (plan.optionalRows.broker_notifications || []).length,
        brokerAiMatches: (plan.optionalRows.broker_ai_matches || []).length
      },
      detail: {
        leadIds: plan.leads.map(item => item.id),
        propertyIds: plan.properties.map(item => item.id),
        publicListingIds: plan.publicListings.map(item => item.id),
        followupIds: (plan.optionalRows.broker_followups || []).map(item => item.id),
        notificationIds: (plan.optionalRows.broker_notifications || []).map(item => item.id),
        aiMatchIds: (plan.optionalRows.broker_ai_matches || []).map(item => item.id)
      }
    };

    if (!execute) {
      return json({
        mode: 'dry-run',
        found: true,
        ...summary
      });
    }

    const deleted = {
      brokerFollowups: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_followups',
        rows: plan.optionalRows.broker_followups || [],
        brokerUuid: broker.id
      }),
      brokerNotifications: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_notifications',
        rows: plan.optionalRows.broker_notifications || [],
        brokerUuid: broker.id
      }),
      brokerAiMatches: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_ai_matches',
        rows: plan.optionalRows.broker_ai_matches || [],
        brokerUuid: broker.id
      }),
      publicListings: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'public_listings',
        rows: plan.publicListings
      }),
      brokerLeads: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        rows: plan.leads,
        brokerUuid: broker.id
      }),
      brokerProperties: await deleteRowsById({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        rows: plan.properties,
        brokerUuid: broker.id
      })
    };

    const brokerDeleteResult = await supabaseDelete({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { id: broker.id }
    });

    let authDelete = { status: 'deleted', userId: broker.id };
    try {
      await supabaseAuthDeleteUser({
        supabaseUrl,
        serviceRoleKey,
        userId: broker.id
      });
    } catch (error) {
      authDelete = {
        status: 'auth-user-missing-or-delete-failed',
        userId: broker.id
      };
    }

    return json({
      mode: 'execute',
      found: true,
      ...summary,
      deletedCounts: {
        brokerFollowups: deleted.brokerFollowups.length,
        brokerNotifications: deleted.brokerNotifications.length,
        brokerAiMatches: deleted.brokerAiMatches.length,
        publicListings: deleted.publicListings.length,
        brokerLeads: deleted.brokerLeads.length,
        brokerProperties: deleted.brokerProperties.length,
        brokers: Array.isArray(brokerDeleteResult) ? brokerDeleteResult.length : 0,
        authUsers: authDelete.status === 'deleted' ? 1 : 0
      },
      authDelete
    });
  } catch (error) {
    return json({ message: error?.message || 'Cleanup failed.' }, error?.status || 500);
  }
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
