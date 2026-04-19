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

export async function GET(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    return json({ message: 'Missing required environment variables for secure admin complaints.' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenPayload = verifyAdminToken(token, sessionSecret);

  if (!tokenPayload) {
    return json({ message: 'Admin login token is missing or invalid.' }, 401);
  }

  const url = new URL(`${supabaseUrl}/rest/v1/complaints`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'created_at.desc');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return json({ message: `Supabase complaint fetch failed: ${errorBody || response.statusText}` }, response.status);
  }

  const data = await response.json().catch(() => []);
  return json({ complaints: Array.isArray(data) ? data : [] });
}

export function POST() {
  return json({ message: 'Method not allowed.' }, 405);
}
