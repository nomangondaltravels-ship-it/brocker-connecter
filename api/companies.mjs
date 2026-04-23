import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from '../server/_broker-platform.mjs';
import {
  findApprovedCompanyName,
  getCuratedApprovedCompanyRows,
  mergeCompanyRows,
  normalizeCompanyName,
  parseCompanyRow
} from '../server/_real_estate_companies.mjs';

function verifyAdminToken(token, secret) {
  return verifyToken(token, secret);
}

async function getDbContext() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Missing required environment variables for company suggestions.');
    error.status = 500;
    throw error;
  }
  return { supabaseUrl, serviceRoleKey };
}

async function requireAdmin(request) {
  const context = await getDbContext();
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');
  if (!sessionSecret) {
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
    ...context,
    reviewerLabel: normalizeText(tokenPayload?.u) || 'admin'
  };
}

async function listApprovedCompanies(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'real_estate_companies',
    select: '*',
    filters: { status: 'approved' },
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

async function createPendingCompany(context, body) {
  const companyName = normalizeText(body?.name);
  if (!companyName) {
    return json({ message: 'Company name is required.' }, 400);
  }

  const approvedCompanies = await listApprovedCompanies(context);
  if (findApprovedCompanyName(companyName, approvedCompanies)) {
    return json({ message: 'Company is already approved.' });
  }

  const normalizedName = normalizeCompanyName(companyName);
  const pendingCompanies = await listPendingCompanies(context);
  const duplicatePending = pendingCompanies.some(item =>
    normalizeCompanyName(item?.name) === normalizedName
    && String(item?.status || 'pending').toLowerCase() === 'pending'
  );

  if (!duplicatePending) {
    await supabaseInsert({
      supabaseUrl: context.supabaseUrl,
      serviceRoleKey: context.serviceRoleKey,
      table: 'pending_real_estate_companies',
      payload: {
        name: companyName,
        submitted_by_user_id: normalizeText(body?.submittedByUserId) || null,
        source: normalizeText(body?.source) || 'registration_form',
        status: 'pending',
        created_at: new Date().toISOString()
      }
    }).catch(() => []);
  }

  return json({ success: true });
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
    if (request.method === 'GET') {
      const scope = new URL(request.url).searchParams.get('scope');
      if (scope === 'admin') {
        const context = await requireAdmin(request);
        return json({
          approvedCompanies: await listApprovedCompanies(context),
          pendingCompanies: await listPendingCompanies(context)
        });
      }

      const context = await getDbContext().catch(() => null);
      const companies = context
        ? await listApprovedCompanies(context).catch(() => getCuratedApprovedCompanyRows())
        : getCuratedApprovedCompanyRows();
      return json(
        { companies },
        200,
        { 'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800' }
      );
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const action = normalizeText(body?.action).toLowerCase();

      if (action === 'approve' || action === 'reject') {
        const context = await requireAdmin(request);
        if (action === 'approve') return await approvePendingCompany(context, body);
        return await rejectPendingCompany(context, body);
      }

      const context = await getDbContext();
      return await createPendingCompany(context, body);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error?.message || 'Company request failed.' }, error?.status || 500);
  }
}
