import {
  createPasswordHash,
  createToken,
  getBearerToken,
  getSupabaseConfig,
  json,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeText,
  requiredEnv,
  supabasePatch,
  supabaseInsert,
  supabaseSelect,
  verifyPassword,
  verifyToken
} from './_broker-platform.mjs';

function sanitizeBroker(broker) {
  return {
    id: broker.id,
    fullName: broker.full_name,
    brokerIdNumber: broker.broker_id_number,
    mobileNumber: broker.mobile_number,
    email: broker.email,
    companyName: broker.company_name || '',
    isVerified: Boolean(broker.is_verified),
    isBlocked: Boolean(broker.is_blocked),
    createdAt: broker.created_at
  };
}

function getBrokerSessionSecret() {
  return requiredEnv('BROKER_SESSION_SECRET');
}

function debugAuth(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[broker-auth]', ...args);
  }
}

function buildSessionToken(broker) {
  return createToken({
    brokerUuid: broker.id,
    brokerIdNumber: broker.broker_id_number,
    email: broker.email
  }, getBrokerSessionSecret());
}

async function verifyAndUpgradeBrokerPassword({ supabaseUrl, serviceRoleKey, broker, password }) {
  if (verifyPassword(password, broker.password_hash)) {
    return true;
  }

  if (String(broker.password_hash || '') === String(password || '')) {
    const nextHash = createPasswordHash(password);
    await supabasePatch({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { id: broker.id },
      payload: {
        password_hash: nextHash,
        updated_at: new Date().toISOString()
      }
    });
    broker.password_hash = nextHash;
    return true;
  }

  return false;
}

export async function GET(request) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const brokerSecret = getBrokerSessionSecret();

  if (!supabaseUrl || !serviceRoleKey || !brokerSecret) {
    return json({ message: 'Missing required broker auth environment variables.' }, 500);
  }

  const token = getBearerToken(request);
  const session = verifyToken(token, brokerSecret);
  if (!session?.brokerUuid) {
    return json({ authenticated: false }, 401);
  }

  const brokers = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    filters: { id: session.brokerUuid }
  }).catch(error => {
    throw error;
  });

  const broker = Array.isArray(brokers) ? brokers[0] : null;
  if (!broker || broker.is_blocked) {
    return json({ authenticated: false }, 401);
  }

  return json({
    authenticated: true,
    token,
    broker: sanitizeBroker(broker)
  });
}

export async function POST(request) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const brokerSecret = getBrokerSessionSecret();

  if (!supabaseUrl || !serviceRoleKey || !brokerSecret) {
    return json({ message: 'Missing required broker auth environment variables.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const action = normalizeText(body?.action).toLowerCase();

  if (!['register', 'login'].includes(action)) {
    return json({ message: 'Unsupported broker auth action.' }, 400);
  }

  if (action === 'register') {
    const fullName = normalizeText(body?.fullName);
    const brokerIdNumber = normalizeText(body?.brokerIdNumber);
    const mobileNumber = normalizePhoneNumber(body?.mobileNumber);
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '');
    const companyName = normalizeText(body?.companyName);

    if (fullName.length < 2) {
      return json({ message: 'Please enter the broker name.' }, 400);
    }
    if (!brokerIdNumber) {
      return json({ message: 'Please enter the broker ID number.' }, 400);
    }
    if (!mobileNumber) {
      return json({ message: 'Please enter a valid UAE mobile number.' }, 400);
    }
    if (!email) {
      return json({ message: 'Please enter a valid email address.' }, 400);
    }
    if (password.length < 6) {
      return json({ message: 'Password must be at least 6 characters long.' }, 400);
    }

    const existing = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      select: 'id,broker_id_number,mobile_number,email',
      order: { column: 'created_at', ascending: false }
    });

    const duplicate = (Array.isArray(existing) ? existing : []).find(item =>
      item.broker_id_number === brokerIdNumber ||
      item.mobile_number === mobileNumber ||
      item.email === email
    );

    if (duplicate) {
      return json({ message: 'This broker account already exists. Please sign in instead.' }, 409);
    }

    const createdRows = await supabaseInsert({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      payload: [{
        full_name: fullName,
        broker_id_number: brokerIdNumber,
        mobile_number: mobileNumber,
        email,
        password_hash: createPasswordHash(password),
        company_name: companyName,
        is_verified: false,
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]
    });

    const broker = Array.isArray(createdRows) ? createdRows[0] : null;
    if (!broker) {
      return json({ message: 'Broker registration failed.' }, 500);
    }

    return json({
      token: buildSessionToken(broker),
      broker: sanitizeBroker(broker)
    });
  }

  const identifier = normalizeText(body?.identifier);
  const brokerIdNumber = normalizeText(body?.brokerIdNumber);
  const mobileNumber = normalizePhoneNumber(body?.mobileNumber);
  const email = normalizeEmail(body?.email);
  const normalizedIdentifierText = identifier.toLowerCase();
  const normalizedIdentifierPhone = normalizePhoneNumber(identifier);
  const normalizedIdentifierEmail = normalizeEmail(identifier);
  const password = String(body?.password || '');

  if (!(identifier || brokerIdNumber || mobileNumber || email) || !password) {
    return json({ message: 'Please enter broker ID or mobile number, and password.' }, 400);
  }

  const candidates = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    order: { column: 'created_at', ascending: false }
  });

  const normalizedBrokerIdText = brokerIdNumber.toLowerCase();
  const hasExplicitBrokerId = Boolean(normalizedBrokerIdText);
  const hasExplicitMobile = Boolean(mobileNumber);
  const hasExplicitEmail = Boolean(email);
  const matchingBrokers = (Array.isArray(candidates) ? candidates : []).filter(item => {
    const candidateBrokerId = normalizeText(item?.broker_id_number);
    const candidateBrokerIdText = candidateBrokerId.toLowerCase();
    const candidateMobile = normalizePhoneNumber(item?.mobile_number);
    const candidateEmail = normalizeEmail(item?.email);

    if (hasExplicitBrokerId || hasExplicitMobile || hasExplicitEmail) {
      const brokerIdMatch = !hasExplicitBrokerId || candidateBrokerIdText === normalizedBrokerIdText;
      const mobileMatch = !hasExplicitMobile || candidateMobile === mobileNumber;
      const emailMatch = !hasExplicitEmail || candidateEmail === email;
      return brokerIdMatch && mobileMatch && emailMatch;
    }

    return (
      candidateBrokerIdText === normalizedIdentifierText ||
      candidateMobile === normalizedIdentifierPhone ||
      candidateEmail === normalizedIdentifierEmail
    );
  });

  debugAuth('login lookup', {
    identifierProvided: Boolean(identifier),
    brokerIdProvided: hasExplicitBrokerId,
    mobileProvided: hasExplicitMobile,
    emailProvided: hasExplicitEmail,
    matchCount: matchingBrokers.length
  });

  if (!matchingBrokers.length) {
    return json({ message: 'Broker account not found.' }, 404);
  }

  let blockedMatchFound = false;
  for (const candidate of matchingBrokers) {
    if (candidate.is_blocked) {
      blockedMatchFound = true;
      continue;
    }

    let passwordOk = false;
    try {
      passwordOk = await verifyAndUpgradeBrokerPassword({
        supabaseUrl,
        serviceRoleKey,
        broker: candidate,
        password
      });
    } catch (error) {
      debugAuth('password verification failed for candidate', {
        brokerIdNumber: candidate?.broker_id_number,
        mobileNumber: candidate?.mobile_number,
        error: error?.message || 'Unknown password verification error'
      });
      continue;
    }

    if (passwordOk) {
      const token = buildSessionToken(candidate);
      if (!token) {
        debugAuth('session token generation failed', { brokerIdNumber: candidate?.broker_id_number });
        return json({ message: 'Session creation failed. Please try again.' }, 500);
      }

      debugAuth('login success', {
        brokerIdNumber: candidate?.broker_id_number,
        mobileNumber: candidate?.mobile_number
      });
      return json({
        token,
        broker: sanitizeBroker(candidate)
      });
    }
  }

  if (blockedMatchFound && matchingBrokers.every(item => item.is_blocked)) {
    return json({ message: 'This broker account is blocked. Please contact admin support.' }, 403);
  }

  return json({ message: 'Invalid credentials.' }, 401);
}
