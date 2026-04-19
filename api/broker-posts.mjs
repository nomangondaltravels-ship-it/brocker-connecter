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

function normalizePhoneNumber(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00971')) return digits.slice(2);
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return `971${digits.slice(1)}`;
  return digits;
}

function getAllowedPayload(table, payload) {
  if (!payload || typeof payload !== 'object') return {};

  if (table === 'requirements') {
    return {
      broker_name: String(payload.broker_name || '').trim(),
      phone: normalizePhoneNumber(payload.phone),
      purpose: String(payload.purpose || '').trim(),
      category: String(payload.category || '').trim(),
      location: String(payload.location || '').trim(),
      budget: String(payload.budget || '').trim(),
      notes: String(payload.notes || '').trim(),
      verified: Boolean(payload.verified),
      premium: Boolean(payload.premium),
      status: String(payload.status || 'open').trim().toLowerCase()
    };
  }

  if (table === 'deals') {
    return {
      broker_name: String(payload.broker_name || '').trim(),
      phone: normalizePhoneNumber(payload.phone),
      type: String(payload.type || '').trim(),
      category: String(payload.category || '').trim(),
      location: String(payload.location || '').trim(),
      price: String(payload.price || '').trim(),
      notes: String(payload.notes || '').trim(),
      urgent: payload.urgent !== false,
      distress: Boolean(payload.distress),
      status: String(payload.status || 'open').trim().toLowerCase()
    };
  }

  return {};
}

export async function POST(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ message: 'Missing required environment variables for broker post actions.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim().toLowerCase();
  const table = String(body?.table || '').trim().toLowerCase();
  const id = Number(body?.id || 0);
  const ownerPhone = normalizePhoneNumber(body?.ownerPhone || '');

  if (!['requirements', 'deals'].includes(table)) {
    return json({ message: 'Unsupported broker post table.' }, 400);
  }

  if (!id || !ownerPhone) {
    return json({ message: 'Missing post id or owner phone.' }, 400);
  }

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('phone', `eq.${ownerPhone}`);
  url.searchParams.set('select', '*');

  if (action === 'delete') {
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
      return json({ message: `Supabase broker delete failed: ${errorBody || response.statusText}` }, response.status);
    }

    const deletedRows = await response.json().catch(() => []);
    return json({ deletedCount: Array.isArray(deletedRows) ? deletedRows.length : 0 });
  }

  if (action === 'update') {
    const payload = getAllowedPayload(table, body?.payload);
    if (!Object.keys(payload).length) {
      return json({ message: 'Missing update payload.' }, 400);
    }

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return json({ message: `Supabase broker update failed: ${errorBody || response.statusText}` }, response.status);
    }

    const updatedRows = await response.json().catch(() => []);
    return json({ updatedCount: Array.isArray(updatedRows) ? updatedRows.length : 0 });
  }

  return json({ message: 'Unsupported broker post action.' }, 400);
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
