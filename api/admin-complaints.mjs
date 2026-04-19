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

export async function POST(request) {
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

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();
  const complaintId = body?.complaintId;
  const match = body?.match && typeof body.match === 'object' ? body.match : {};

  if (!action || (!complaintId && !Object.keys(match).length)) {
    return json({ message: 'Complaint target is missing.' }, 400);
  }

  if (action === 'update-status') {
    const status = String(body?.status || '').trim().toLowerCase();
    if (!status) {
      return json({ message: 'Complaint status is required.' }, 400);
    }

    const url = new URL(`${supabaseUrl}/rest/v1/complaints`);
    url.searchParams.set('select', '*');
    if (complaintId) {
      url.searchParams.set('id', `eq.${complaintId}`);
    } else {
      for (const [key, value] of Object.entries(match)) {
        url.searchParams.set(key, `eq.${value}`);
      }
    }

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return json({ message: `Supabase complaint update failed: ${errorBody || response.statusText}` }, response.status);
    }

    const data = await response.json().catch(() => []);
    return json({ complaints: Array.isArray(data) ? data : [] });
  }

  if (action === 'delete') {
    const url = new URL(`${supabaseUrl}/rest/v1/complaints`);
    url.searchParams.set('select', '*');
    if (complaintId) {
      url.searchParams.set('id', `eq.${complaintId}`);
    } else {
      for (const [key, value] of Object.entries(match)) {
        url.searchParams.set(key, `eq.${value}`);
      }
    }

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
      return json({ message: `Supabase complaint delete failed: ${errorBody || response.statusText}` }, response.status);
    }

    const data = await response.json().catch(() => []);
    return json({ deleted: Array.isArray(data) ? data.length : 0 });
  }

  return json({ message: 'Unsupported complaint action.' }, 400);
}
