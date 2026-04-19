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

function createAdminToken(username, secret) {
  const payload = {
    u: username,
    exp: Date.now() + (8 * 60 * 60 * 1000)
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export async function POST(request) {
  const adminUsername = requiredEnv('ADMIN_USERNAME');
  const adminPassword = requiredEnv('ADMIN_PASSWORD');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!adminUsername || !adminPassword || !sessionSecret) {
    return json({ message: 'Missing required environment variables for admin login.' }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    return json({ message: 'Invalid request body.' }, 400);
  }

  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');

  if (!username || !password) {
    return json({ message: 'Please enter admin username and password.' }, 400);
  }

  if (username !== adminUsername || password !== adminPassword) {
    return json({ message: 'Invalid admin username or password.' }, 401);
  }

  return json({
    token: createAdminToken(username, sessionSecret)
  });
}

export function GET() {
  return json({ message: 'Method not allowed.' }, 405);
}
