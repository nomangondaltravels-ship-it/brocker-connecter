import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from './_broker-platform.mjs';
import {
  findApprovedCompanyName,
  getCuratedApprovedCompanyRows,
  mergeCompanyRows,
  parseCompanyRow
} from './_real_estate_companies.mjs';

function verifyAdminToken(token, secret) {
  return verifyToken(token, secret);
}

async function requireAdmin(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    const error = new Error('Missing required environment variables for company review.');
    error.status = 500;
    throw error;
  }

  const token = getBearerToken(request);
  const tokenPayload = verifyAdminToken(token, sessionSecret);
  if (!tokenPayload?.u) {
    const error = new Error('Admin login token is missing or invalid.');
    error.status = 401;
    throw error;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    reviewerLabel: normalizeText(tokenPayload?.u) || 'admin'
  };
}

async function listApprovedCompanies(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'real_estate_companies',
    select: '*',
    order: { column: 'name', ascending: true }
  }).catch(() => []);

  return mergeCompanyRows(
    (Array.isArray(rows) ? rows : []).map(parseCompanyRow),
    getCuratedApprovedCompanyRows()
  );
}

async function listPendingCompanies(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'pending_real_estate_companies',
    select: '*',
    order: { column: 'created_at', ascending: false }
  }).catch(() => []);

  return (Array.isArray(rows) ? rows : []).map(parseCompanyRow);
}

async function approvePendingCompany(context, body) {
  const pendingId = normalizeText(body?.pendingId);
  if (!pendingId) {
    return json({ message: 'Pending company entry is missing.' }, 400);
  }

  const pendingRows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'pending_real_estate_companies',
    select: '*',
    filters: { id: pendingId }
  }).catch(() => []);
  const pendingEntry = parseCompanyRow((Array.isArray(pendingRows) ? pendingRows[0] : null) || {});

  if (!pendingEntry?.id || !pendingEntry?.name) {
    return json({ message: 'Pending company not found.' }, 404);
  }

  const approvedCompanies = await listApprovedCompanies(context);
  const existingApprovedName = findApprovedCompanyName(pendingEntry.name, approvedCompanies);
  const approvedName = existingApprovedName || pendingEntry.name;

  if (!existingApprovedName) {
    await supabaseInsert({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'real_estate_companies',
      payload: {
        name: approvedName,
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }).catch(error => {
      if (!String(error?.message || '').toLowerCase().includes('duplicate')) {
        throw error;
      }
    });
  }

  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'pending_real_estate_companies',
    filters: { id: pendingId },
    payload: {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.reviewerLabel
    }
  });

  return json({
    approvedCompanies: await listApprovedCompanies(context),
    pendingCompanies: await listPendingCompanies(context)
  });
}

async function rejectPendingCompany(context, body) {
  const pendingId = normalizeText(body?.pendingId);
  if (!pendingId) {
    return json({ message: 'Pending company entry is missing.' }, 400);
  }

  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'pending_real_estate_companies',
    filters: { id: pendingId },
    payload: {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.reviewerLabel
    }
  });

  return json({
    approvedCompanies: await listApprovedCompanies(context),
    pendingCompanies: await listPendingCompanies(context)
  });
}

export default async function handler(request) {
  try {
    const context = await requireAdmin(request);

    if (request.method === 'GET') {
      return json({
        approvedCompanies: await listApprovedCompanies(context),
        pendingCompanies: await listPendingCompanies(context)
      });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const action = normalizeText(body?.action).toLowerCase();
      if (action === 'approve') return await approvePendingCompany(context, body);
      if (action === 'reject') return await rejectPendingCompany(context, body);
      return json({ message: 'Unsupported company admin action.' }, 400);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error?.message || 'Admin company review failed.' }, error?.status || 500);
  }
}
