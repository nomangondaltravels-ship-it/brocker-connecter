import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from './_broker-platform.mjs';
import {
  normalizeSupportStatus,
  parseSupportRequestRecord
} from './_support.mjs';

function verifyAdminToken(token, secret) {
  return verifyToken(token, secret);
}

async function requireAdmin(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    const error = new Error('Missing required environment variables for secure admin support.');
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

async function listSupportRequests(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'support_requests',
    select: '*',
    order: { column: 'created_at', ascending: false }
  }).catch(() => []);
  return (Array.isArray(rows) ? rows : []).map(parseSupportRequestRecord);
}

async function updateSupportStatus(context, body) {
  const requestId = normalizeText(body?.requestId);
  const status = normalizeSupportStatus(body?.status, '');
  if (!requestId) {
    return json({ message: 'Support request is missing.' }, 400);
  }
  if (!status) {
    return json({ message: 'Support status is required.' }, 400);
  }

  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'support_requests',
    filters: { id: requestId },
    payload: {
      status,
      reviewed_by: context.reviewerLabel,
      updated_at: new Date().toISOString()
    }
  }).catch(error => {
    throw error;
  });

  const supportRequests = await listSupportRequests(context);
  return json({ supportRequests });
}

export default async function handler(request) {
  try {
    const context = await requireAdmin(request);

    if (request.method === 'GET') {
      const supportRequests = await listSupportRequests(context);
      return json({ supportRequests });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const action = normalizeText(body?.action);
      if (action === 'update-status') {
        return await updateSupportStatus(context, body);
      }
      return json({ message: 'Unsupported support action.' }, 400);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error?.message || 'Admin support request failed.' }, error?.status || 500);
  }
}
