import crypto from 'node:crypto';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function verifyAdminToken(token, secret) {
  if (!token || !secret || !token.includes('.')) return null;

  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function buildDeleteUrl(baseUrl, table, scope, match = {}) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`);

  if (scope === 'all') {
    url.searchParams.set('phone', 'not.is.null');
    return url;
  }

  Object.entries(match).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, `eq.${value}`);
  });

  return url;
}

export async function POST(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    return json({ message: 'Missing required environment variables for secure admin delete.' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenPayload = verifyAdminToken(token, sessionSecret);

  if (!tokenPayload) {
    return json({ message: 'Admin login token is missing or invalid.' }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    return json({ message: 'Invalid request body.' }, 400);
  }

  const table = String(body?.table || '').trim();
  const scope = String(body?.scope || '').trim();
  const match = body?.match && typeof body.match === 'object' ? body.match : {};

  if (!['requirements', 'deals'].includes(table)) {
    return json({ message: 'Unsupported delete table.' }, 400);
  }

  if (!['single', 'all'].includes(scope)) {
    return json({ message: 'Unsupported delete scope.' }, 400);
  }

  if (scope === 'single' && (!match.broker_name || !match.phone)) {
    return json({ message: 'Missing match fields for single delete.' }, 400);
  }

  const url = buildDeleteUrl(supabaseUrl, table, scope, match);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return json({ message: `Supabase delete failed: ${errorBody || response.statusText}` }, response.status);
  }

  return json({ success: true });
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
