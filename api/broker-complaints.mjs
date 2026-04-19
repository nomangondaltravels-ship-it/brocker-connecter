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

function parseComplaintRecord(item) {
  const rawMessage = String(item?.message || '');
  const match = rawMessage.match(/\[\[BC_META:([\s\S]+?)\]\]\s*$/);
  let meta = {};
  let displayMessage = rawMessage;

  if (match) {
    try {
      meta = JSON.parse(decodeURIComponent(match[1]));
    } catch (error) {
      meta = {};
    }
    displayMessage = rawMessage.replace(match[0], '').trim();
  }

  const rawStatus = String(item?.status || '').trim().toLowerCase();
  return {
    ...item,
    reporterBrokerId: meta.reporterBrokerId || '',
    reporterEmail: meta.reporterEmail || '',
    reporterName: meta.reporterName || '',
    displayMessage,
    normalizedStatus: rawStatus === 'pending' ? 'new' : (rawStatus || 'new')
  };
}

export async function POST(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ message: 'Missing required environment variables for broker complaints.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const brokerId = String(body?.brokerId || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();

  if (!brokerId && !email) {
    return json({ complaints: [] });
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
    return json({ message: `Supabase broker complaint fetch failed: ${errorBody || response.statusText}` }, response.status);
  }

  const data = await response.json().catch(() => []);
  const filtered = (Array.isArray(data) ? data : [])
    .map(parseComplaintRecord)
    .filter(item =>
      (brokerId && item.reporterBrokerId === brokerId) ||
      (email && item.reporterEmail === email)
    );

  return json({ complaints: filtered });
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
