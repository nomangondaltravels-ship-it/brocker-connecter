import {
  supabaseAuthAdminListUsers,
  getSupabaseConfig,
  json,
  normalizeEmail,
  normalizeText,
  supabaseAuthDeleteUser,
  supabaseDelete,
  supabaseSelect
} from './_broker-platform.mjs';

const CLEANUP_TOKEN = 'cleanup-20260422-3q5Y0d9N7aB2';

const TARGET_BROKERS = [
  { id: '5a222dba-1fc0-4c7c-b993-c33ae619217c', email: 'ahmed@example.com', brokerIdNumber: '' },
  { id: 'dfc797a0-1de2-4601-9d73-e64883910379', email: 'ali@example.com', brokerIdNumber: '' },
  { id: '181228c4-4835-4e98-a447-84da96b8200d', email: 'bilal@example.com', brokerIdNumber: '' },
  { id: 'a0019a33-8821-4889-baf6-12739182dcfc', email: 'hassan@example.com', brokerIdNumber: '' },
  { id: 'ff5a425a-1b9e-4342-a1ce-cf167e2f9bbe', email: 'usman@example.com', brokerIdNumber: '' },
  { id: 'e74c0cc4-23ed-44b4-90c2-6b6d27a8f7fb', email: 'codex-smoke-0421@example.com', brokerIdNumber: 'CODX-SMOKE-0421' },
  { id: '75e34547-97ec-4556-af62-e9eb6a805a3b', email: 'probe-0421@example.com', brokerIdNumber: 'PROBE-0421' },
  { id: 'ca09a8f8-3270-467d-b6a5-21bcbc159f72', email: 'codex-test-20260420@example.com', brokerIdNumber: 'CODX-TEST-20260420' },
  { id: '2995949a-46a8-46c6-8ed0-2cdb9607446f', email: 'codex.signin.20260420@example.com', brokerIdNumber: 'CODX-SIGN-20260420' },
  { id: 'db455a92-b5a4-4e41-bc15-c0abcf41f93e', email: 'codex.signin.20260420.1@example.com', brokerIdNumber: 'CODX-SIGN-20260420-1' }
];

const OPTIONAL_BROKER_TABLES = [
  'broker_followups',
  'broker_notifications',
  'broker_ai_matches'
];

function isConfirmedFakeAuthEmail(email) {
  return /@example\.com$/i.test(normalizeEmail(email));
}

function requireCleanupToken(request) {
  const token = normalizeText(request.headers.get('x-cleanup-token'));
  if (token !== CLEANUP_TOKEN) {
    const error = new Error('Cleanup token is missing or invalid.');
    error.status = 401;
    throw error;
  }
}

function matchesTarget(broker, target) {
  if (!broker || !target) return false;
  if (normalizeText(broker.id) !== target.id) return false;
  if (normalizeEmail(broker.email) !== target.email) return false;
  if (target.brokerIdNumber && normalizeText(broker.broker_id_number) !== target.brokerIdNumber) return false;
  return true;
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

async function fetchBrokerDeletePlan({ supabaseUrl, serviceRoleKey, broker }) {
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

  const publicListingsByBrokerId = broker.broker_id_number
    ? await selectOptionalRows({
        supabaseUrl,
        serviceRoleKey,
        table: 'public_listings',
        filters: { broker_id_number: broker.broker_id_number }
      })
    : [];

  const publicListingMap = new Map();
  for (const row of publicListingsByBrokerId) {
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
    publicListings: Array.from(publicListingMap.values()),
    optionalRows
  };
}

async function deleteRowsById({ supabaseUrl, serviceRoleKey, table, rows, brokerUuid = '', extraFilters = {} }) {
  const deleted = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const filters = { id: row.id, ...extraFilters };
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

    const presentTargets = [];
    const skippedTargets = [];
    for (const target of TARGET_BROKERS) {
      const rows = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: target.id },
        order: { column: 'created_at', ascending: false }
      });
      const broker = Array.isArray(rows) ? rows[0] : null;
      if (!broker) {
        skippedTargets.push({ ...target, reason: 'Broker row not found' });
        continue;
      }
      if (!matchesTarget(broker, target)) {
        skippedTargets.push({
          ...target,
          reason: 'Broker row did not match the confirmed fake/test signature',
          foundEmail: broker.email || '',
          foundBrokerIdNumber: broker.broker_id_number || ''
        });
        continue;
      }
      presentTargets.push(broker);
    }

    const plans = [];
    for (const broker of presentTargets) {
      plans.push(await fetchBrokerDeletePlan({ supabaseUrl, serviceRoleKey, broker }));
    }

    const authUsers = await supabaseAuthAdminListUsers({
      supabaseUrl,
      serviceRoleKey,
      page: 1,
      perPage: 200
    });
    const authUsersToDelete = (Array.isArray(authUsers) ? authUsers : [])
      .filter(user => isConfirmedFakeAuthEmail(user?.email))
      .map(user => ({
        id: user.id,
        email: user.email || ''
      }));

    const dryRun = {
      targetedBrokers: presentTargets.map(broker => ({
        id: broker.id,
        email: broker.email,
        brokerIdNumber: broker.broker_id_number || '',
        fullName: broker.full_name || ''
      })),
      skippedTargets,
      counts: {
        brokers: presentTargets.length,
        brokerLeads: plans.reduce((sum, plan) => sum + plan.leads.length, 0),
        brokerProperties: plans.reduce((sum, plan) => sum + plan.properties.length, 0),
        publicListings: plans.reduce((sum, plan) => sum + plan.publicListings.length, 0),
        brokerFollowups: plans.reduce((sum, plan) => sum + (plan.optionalRows.broker_followups || []).length, 0),
        brokerNotifications: plans.reduce((sum, plan) => sum + (plan.optionalRows.broker_notifications || []).length, 0),
        brokerAiMatches: plans.reduce((sum, plan) => sum + (plan.optionalRows.broker_ai_matches || []).length, 0),
        authUsers: authUsersToDelete.length
      },
      authUsersToDelete,
      details: plans.map(plan => ({
        broker: {
          id: plan.broker.id,
          email: plan.broker.email,
          brokerIdNumber: plan.broker.broker_id_number || '',
          fullName: plan.broker.full_name || ''
        },
        leadIds: plan.leads.map(item => item.id),
        propertyIds: plan.properties.map(item => item.id),
        publicListingIds: plan.publicListings.map(item => item.id),
        followupIds: (plan.optionalRows.broker_followups || []).map(item => item.id),
        notificationIds: (plan.optionalRows.broker_notifications || []).map(item => item.id),
        aiMatchIds: (plan.optionalRows.broker_ai_matches || []).map(item => item.id)
      }))
    };

    if (!execute) {
      return json({
        mode: 'dry-run',
        ...dryRun
      });
    }

    const deleted = {
      brokerFollowups: [],
      brokerNotifications: [],
      brokerAiMatches: [],
      publicListings: [],
      brokerLeads: [],
      brokerProperties: [],
      brokers: [],
      authUsers: []
    };

    for (const plan of plans) {
      deleted.brokerFollowups.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_followups',
          rows: plan.optionalRows.broker_followups || [],
          brokerUuid: plan.broker.id
        })
      );
      deleted.brokerNotifications.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_notifications',
          rows: plan.optionalRows.broker_notifications || [],
          brokerUuid: plan.broker.id
        })
      );
      deleted.brokerAiMatches.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_ai_matches',
          rows: plan.optionalRows.broker_ai_matches || [],
          brokerUuid: plan.broker.id
        })
      );
      deleted.publicListings.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'public_listings',
          rows: plan.publicListings
        })
      );
      deleted.brokerLeads.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_leads',
          rows: plan.leads,
          brokerUuid: plan.broker.id
        })
      );
      deleted.brokerProperties.push(
        ...await deleteRowsById({
          supabaseUrl,
          serviceRoleKey,
          table: 'broker_properties',
          rows: plan.properties,
          brokerUuid: plan.broker.id
        })
      );

      const brokerDeleteResult = await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: plan.broker.id }
      });
      deleted.brokers.push(...(Array.isArray(brokerDeleteResult) ? brokerDeleteResult : []));
    }

    for (const authUser of authUsersToDelete) {
      try {
        await supabaseAuthDeleteUser({
          supabaseUrl,
          serviceRoleKey,
          userId: authUser.id
        });
        deleted.authUsers.push(authUser);
      } catch (error) {
        deleted.authUsers.push({
          id: authUser.id,
          email: authUser.email,
          status: 'auth-user-delete-failed'
        });
      }
    }

    return json({
      mode: 'execute',
      ...dryRun,
      deletedCounts: {
        brokerFollowups: deleted.brokerFollowups.length,
        brokerNotifications: deleted.brokerNotifications.length,
        brokerAiMatches: deleted.brokerAiMatches.length,
        publicListings: deleted.publicListings.length,
        brokerLeads: deleted.brokerLeads.length,
        brokerProperties: deleted.brokerProperties.length,
        brokers: deleted.brokers.length,
        authUsers: deleted.authUsers.length
      },
      deletedAuthUsers: deleted.authUsers
    });
  } catch (error) {
    return json({ message: error?.message || 'Cleanup failed.' }, error?.status || 500);
  }
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
