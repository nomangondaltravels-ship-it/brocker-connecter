import {
  getBearerToken,
  json,
  normalizeEmail,
  normalizeText,
  requiredEnv,
  supabaseInsert,
  verifyToken
} from './_broker-platform.mjs';
import {
  normalizeSupportStatus,
  normalizeSupportSubject,
  parseSupportRequestRecord,
  sanitizeSupportText
} from './_support.mjs';

const MAX_SUPPORT_MESSAGE_LENGTH = 4000;

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

export default async function handler(request) {
  try {
    if (request.method !== 'POST') {
      return json({ message: 'Method not allowed.' }, 405);
    }
    return await createSupportRequest(request);
  } catch (error) {
    return json({ message: error?.message || 'Support request failed.' }, error?.status || 500);
  }
}
