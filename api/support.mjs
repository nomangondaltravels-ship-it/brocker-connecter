import {
  getBearerToken,
  json,
  normalizeEmail,
  normalizeText,
  requiredEnv,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from '../server/_broker-platform.mjs';
import {
  normalizeSupportStatus,
  normalizeSupportSubject,
  parseSupportRequestRecord,
  sanitizeSupportText
} from '../server/_support.mjs';

const MAX_SUPPORT_MESSAGE_LENGTH = 4000;
const SUPPORT_ROUTE_TIMEOUT_MS = 1800;

async function withTimeout(task, timeoutMs, fallbackValue) {
  const controller = new AbortController();
  let timer = null;
  try {
    timer = setTimeout(() => controller.abort(), timeoutMs);
    return await Promise.resolve().then(() => task(controller.signal));
  } catch (error) {
    if (error?.name === 'AbortError') {
      return fallbackValue;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getSupportContext(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Missing required environment variables for support requests.');
    error.status = 500;
    throw error;
  }

  const brokerSecret = requiredEnv('BROKER_SESSION_SECRET');
  const token = getBearerToken(request);
  let session = null;
  if (token && brokerSecret) {
    session = verifyToken(token, brokerSecret);
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    session
  };
}

function resolveRequesterDetails(context, body) {
  const broker = context.session?.broker || {};
  return {
    requesterBrokerId: normalizeText(context.session?.brokerUuid || broker.id || body?.requesterBrokerId),
    name: sanitizeSupportText(
      broker.full_name
      || broker.fullName
      || broker.name
      || body?.name,
      180
    ),
    email: normalizeEmail(broker.email || body?.email)
  };
}

async function createSupportRequest(request) {
  const context = await getSupportContext(request);
  const body = await request.json().catch(() => ({}));
  return createSupportRequestFromBody(context, body);
}

async function createSupportRequestFromBody(context, body) {
  const requester = resolveRequesterDetails(context, body);
  const subject = normalizeSupportSubject(body?.subject);
  const message = sanitizeSupportText(body?.message, MAX_SUPPORT_MESSAGE_LENGTH);

  if (!requester.name) {
    return json({ message: 'Name is required.' }, 400);
  }
  if (!requester.email) {
    return json({ message: 'Email is required.' }, 400);
  }
  if (!subject) {
    return json({ message: 'Select a valid subject.' }, 400);
  }
  if (message.length < 10) {
    return json({ message: 'Message is required.' }, 400);
  }

  const inserted = await supabaseInsert({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'support_requests',
    payload: {
      requester_broker_id: requester.requesterBrokerId || null,
      name: requester.name,
      email: requester.email,
      subject,
      message,
      status: normalizeSupportStatus('new'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });

  const supportRequest = Array.isArray(inserted) ? parseSupportRequestRecord(inserted[0] || {}) : null;
  return json({
    message: 'We have received your request. Our help desk will contact you soon.',
    supportRequest
  });
}

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

async function listSupportRequests(context, signal) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'support_requests',
    select: '*',
    order: { column: 'created_at', ascending: false },
    signal
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
  });

  return json({
    supportRequests: await withTimeout(
      signal => listSupportRequests(context, signal),
      SUPPORT_ROUTE_TIMEOUT_MS,
      []
    )
  });
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const context = await requireAdmin(request);
      return json({
        supportRequests: await withTimeout(
          signal => listSupportRequests(context, signal),
          SUPPORT_ROUTE_TIMEOUT_MS,
          []
        )
      }, 200, { 'Cache-Control': 'no-store' });
    }

    if (request.method === 'PATCH') {
      const context = await requireAdmin(request);
      const body = await request.json().catch(() => ({}));
      return await updateSupportStatus(context, body);
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (normalizeText(body?.action).toLowerCase() === 'update-status') {
        const context = await requireAdmin(request);
        return await updateSupportStatus(context, body);
      }
      const context = await getSupportContext(request);
      return await createSupportRequestFromBody(context, body);
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error?.message || 'Support request failed.' }, error?.status || 500);
  }
}
