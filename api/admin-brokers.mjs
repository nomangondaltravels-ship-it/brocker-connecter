import crypto from 'node:crypto';
import {
  createPasswordHash,
  getSupabaseConfig,
  json,
  normalizeText,
  requiredEnv,
  supabaseDelete,
  supabasePatch,
  supabaseSelect
} from './_broker-platform.mjs';

function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
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

function sanitizeBroker(row) {
  const fallbackId = row.broker_id_number || `BROKER-${String(row.id || '').slice(0, 8).toUpperCase()}`;
  const fallbackName = row.full_name || row.email || fallbackId;
  return {
    id: row.id,
    brokerId: fallbackId,
    name: fallbackName,
    phone: row.mobile_number || '',
    email: row.email,
    company: row.company_name || '',
    approved: Boolean(row.is_verified),
    blocked: Boolean(row.is_blocked),
    createdAt: row.created_at
  };
}

async function requireAdmin(request) {
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');
  const token = getBearerToken(request);
  const session = verifyAdminToken(token, sessionSecret);
  if (!session?.u) {
    const error = new Error('Admin login required.');
    error.status = 401;
    throw error;
  }
  return session;
}

async function fetchBrokerByBrokerId({ supabaseUrl, serviceRoleKey, brokerId }) {
  const rows = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    filters: { broker_id_number: brokerId },
    order: { column: 'created_at', ascending: false }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing Supabase environment variables.' }, 500);
    }

    const rows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      select: 'id,full_name,broker_id_number,mobile_number,email,company_name,is_verified,is_blocked,created_at',
      order: { column: 'created_at', ascending: false }
    });

    return json({
      brokers: (Array.isArray(rows) ? rows : []).map(sanitizeBroker)
    });
  } catch (error) {
    return json({ message: error?.message || 'Failed to load brokers.' }, error?.status || 500);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ message: 'Missing Supabase environment variables.' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();
    const brokerId = normalizeText(body?.brokerId);

    if (!action || !brokerId) {
      return json({ message: 'Broker action and broker ID are required.' }, 400);
    }

    const broker = await fetchBrokerByBrokerId({ supabaseUrl, serviceRoleKey, brokerId });
    if (!broker) {
      return json({ message: 'Broker account not found.' }, 404);
    }

    if (action === 'verify') {
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          is_verified: true,
          is_blocked: false,
          updated_at: new Date().toISOString()
        }
      });
      return json({ broker: sanitizeBroker((Array.isArray(rows) ? rows[0] : broker) || broker) });
    }

    if (action === 'unverify') {
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          is_verified: false,
          updated_at: new Date().toISOString()
        }
      });
      return json({ broker: sanitizeBroker((Array.isArray(rows) ? rows[0] : broker) || broker) });
    }

    if (action === 'block') {
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          is_blocked: true,
          is_verified: false,
          updated_at: new Date().toISOString()
        }
      });
      return json({ broker: sanitizeBroker((Array.isArray(rows) ? rows[0] : broker) || broker) });
    }

    if (action === 'unblock') {
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          is_blocked: false,
          updated_at: new Date().toISOString()
        }
      });
      return json({ broker: sanitizeBroker((Array.isArray(rows) ? rows[0] : broker) || broker) });
    }

    if (action === 'set-password') {
      const nextPassword = String(body?.newPassword || '').trim();
      if (nextPassword.length < 6) {
        return json({ message: 'Password must be at least 6 characters long.' }, 400);
      }
      await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          password_hash: createPasswordHash(nextPassword),
          updated_at: new Date().toISOString()
        }
      });
      return json({ success: true });
    }

    if (action === 'delete') {
      await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id }
      });
      return json({ success: true });
    }

    return json({ message: 'Unsupported broker admin action.' }, 400);
  } catch (error) {
    return json({ message: error?.message || 'Broker admin action failed.' }, error?.status || 500);
  }
}
