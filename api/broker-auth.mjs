import {
  createPendingMobileValue,
  createPasswordHash,
  createToken,
  getBearerToken,
  getSupabaseConfig,
  getSupabasePublishableKey,
  json,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeText,
  requiredEnv,
  supabaseAuthDeleteUser,
  supabaseAuthSignUp,
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
    mobileNumber: normalizePhoneNumber(broker.mobile_number),
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

function buildInternalBrokerId(authUserId) {
  const compact = normalizeText(authUserId).replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `BC-${(compact || 'BROKER').slice(0, 10)}`;
}

function findMatchingBrokers(candidates, {
  identifier,
  brokerIdNumber,
  mobileNumber,
  email
}) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const normalizedBrokerIdText = normalizeText(brokerIdNumber).toLowerCase();
  const normalizedMobile = normalizePhoneNumber(mobileNumber);
  const normalizedEmail = normalizeEmail(email);
  const normalizedIdentifierText = normalizeText(identifier).toLowerCase();
  const normalizedIdentifierPhone = normalizePhoneNumber(identifier);
  const normalizedIdentifierEmail = normalizeEmail(identifier);

  if (normalizedBrokerIdText) {
    return rows.filter(item => normalizeText(item?.broker_id_number).toLowerCase() === normalizedBrokerIdText);
  }

  if (normalizedMobile) {
    return rows.filter(item => normalizePhoneNumber(item?.mobile_number) === normalizedMobile);
  }

  if (normalizedEmail) {
    return rows.filter(item => normalizeEmail(item?.email) === normalizedEmail);
  }

  if (normalizedIdentifierPhone) {
    const phoneMatches = rows.filter(item => normalizePhoneNumber(item?.mobile_number) === normalizedIdentifierPhone);
    if (phoneMatches.length) return phoneMatches;
  }

  if (normalizedIdentifierEmail) {
    const emailMatches = rows.filter(item => normalizeEmail(item?.email) === normalizedIdentifierEmail);
    if (emailMatches.length) return emailMatches;
  }

  if (normalizedIdentifierText) {
    return rows.filter(item => normalizeText(item?.broker_id_number).toLowerCase() === normalizedIdentifierText);
  }

  return [];
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
  const publishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !serviceRoleKey || !brokerSecret || !publishableKey) {
    return json({ message: 'Missing required broker auth environment variables.' }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const action = normalizeText(body?.action).toLowerCase();

  if (!['register', 'login'].includes(action)) {
    return json({ message: 'Unsupported broker auth action.' }, 400);
  }

  if (action === 'register') {
    const fullName = normalizeText(body?.fullName);
    const mobileNumber = normalizePhoneNumber(body?.mobileNumber);
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '');
    const confirmPassword = String(body?.confirmPassword || '');
    const companyName = normalizeText(body?.companyName);

    if (fullName.length < 2) {
      return json({ message: 'Please enter full name.' }, 400);
    }
    if (!email || !email.includes('@')) {
      return json({ message: 'Please enter a valid email address.' }, 400);
    }
    if (password.length < 6) {
      return json({ message: 'Password must be at least 6 characters long.' }, 400);
    }
    if (password !== confirmPassword) {
      return json({ message: 'Passwords do not match.' }, 400);
    }

    const existing = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      select: 'id,broker_id_number,mobile_number,email',
      order: { column: 'created_at', ascending: false }
    });

    const duplicate = (Array.isArray(existing) ? existing : []).find(item =>
      (mobileNumber && normalizePhoneNumber(item.mobile_number) === mobileNumber) ||
      item.email === email
    );

    if (duplicate) {
      return json({ message: 'This broker account already exists. Please sign in instead.' }, 409);
    }

    let authUser = null;
    try {
      const authResult = await supabaseAuthSignUp({
        supabaseUrl,
        publishableKey,
        email,
        password,
        data: {
          full_name: fullName,
          mobile_number: mobileNumber,
          company_name: companyName
        }
      });

      authUser = authResult?.user || null;
      if (!authUser?.id) {
        return json({ message: 'Broker registration failed.' }, 500);
      }

      const createdRows = await supabaseInsert({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        payload: [{
          id: authUser.id,
          full_name: fullName,
          broker_id_number: buildInternalBrokerId(authUser.id),
          mobile_number: mobileNumber || createPendingMobileValue(authUser.id),
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
        throw new Error('Broker profile creation failed.');
      }

      const emailConfirmationRequired = !authResult?.session?.access_token;
      if (emailConfirmationRequired) {
        return json({
          broker: sanitizeBroker(broker),
          requiresEmailConfirmation: true,
          message: 'Check your email to confirm your account.'
        });
      }

      return json({
        token: buildSessionToken(broker),
        broker: sanitizeBroker(broker),
        message: 'Broker account created successfully.'
      });
    } catch (error) {
      const message = normalizeText(error?.message).toLowerCase();
      if (authUser?.id) {
        try {
          await supabaseAuthDeleteUser({
            supabaseUrl,
            serviceRoleKey,
            userId: authUser.id
          });
        } catch (rollbackError) {
          debugAuth('auth rollback failed', rollbackError?.message || rollbackError);
        }
      }

      if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate')) {
        return json({ message: 'This email address is already registered. Please sign in instead.' }, 409);
      }

      return json({ message: error?.message || 'Broker registration failed.' }, error?.status || 500);
    }
  }

  const identifier = normalizeText(body?.identifier);
  const brokerIdNumber = normalizeText(body?.brokerIdNumber);
  const mobileNumber = normalizePhoneNumber(body?.mobileNumber);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!(identifier || brokerIdNumber || mobileNumber || email) || !password) {
    return json({ message: 'Enter Broker ID or Mobile Number, and password.' }, 400);
  }

  const candidates = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    order: { column: 'created_at', ascending: false }
  });

  const matchingBrokers = findMatchingBrokers(candidates, {
    identifier,
    brokerIdNumber,
    mobileNumber,
    email
  });

  debugAuth('login lookup', {
    identifierProvided: Boolean(identifier),
    brokerIdProvided: Boolean(brokerIdNumber),
    mobileProvided: Boolean(mobileNumber),
    emailProvided: Boolean(email),
    matchCount: matchingBrokers.length
  });

  if (!matchingBrokers.length) {
    return json({ message: 'Broker not found.' }, 404);
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

  return json({ message: 'Invalid password.' }, 401);
}
