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
  supabaseAuthResetPasswordForEmail,
  supabaseAuthSignInWithPassword,
  supabaseAuthSignUp,
  supabasePatch,
  supabaseInsert,
  supabaseSelect,
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
  email
}) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    return rows.filter(item => normalizeEmail(item?.email) === normalizedEmail);
  }

  return [];
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

  if (!['register', 'login', 'forgot-password'].includes(action)) {
    return json({ message: 'Unsupported broker auth action.' }, 400);
  }

  if (action === 'register') {
    const fullName = normalizeText(body?.fullName);
    const mobileNumber = normalizePhoneNumber(body?.mobileNumber);
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '');
    const confirmPassword = String(body?.confirmPassword || '');
    const companyName = normalizeText(body?.companyName);
    const redirectTo = normalizeText(body?.redirectTo) || new URL('/auth-callback.html', request.url).toString();

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
        redirectTo,
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

  if (action === 'forgot-password') {
    const email = normalizeEmail(body?.email);
    if (!email) {
      return json({ message: 'Enter email.' }, 400);
    }
    if (!email.includes('@')) {
      return json({ message: 'Enter a valid email address.' }, 400);
    }

    const redirectUrl = normalizeText(body?.redirectTo) || new URL('/reset-password.html', request.url).toString();

    try {
      await supabaseAuthResetPasswordForEmail({
        supabaseUrl,
        publishableKey,
        email,
        redirectTo: redirectUrl
      });
      return json({
        message: 'If an account exists for this email, a reset link has been sent.'
      });
    } catch (error) {
      debugAuth('forgot-password failure', error?.message || error);
      return json({ message: 'Password reset could not be sent. Please try again.' }, error?.status || 500);
    }
  }

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!email) {
    return json({ message: 'Enter email.' }, 400);
  }
  if (!email.includes('@')) {
    return json({ message: 'Enter a valid email address.' }, 400);
  }
  if (!password) {
    return json({ message: 'Enter password.' }, 400);
  }

  const candidates = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    order: { column: 'created_at', ascending: false }
  });

  const matchingBrokers = findMatchingBrokers(candidates, {
    email
  });

  debugAuth('login lookup', {
    emailProvided: Boolean(email),
    matchCount: matchingBrokers.length
  });

  if (!matchingBrokers.length) {
    return json({ message: 'Account not found.' }, 404);
  }

  const candidate = matchingBrokers.find(item => !item.is_blocked) || matchingBrokers[0];
  if (!candidate) {
    return json({ message: 'Account not found.' }, 404);
  }

  if (candidate.is_blocked) {
    return json({ message: 'This broker account is blocked. Please contact admin support.' }, 403);
  }

  try {
    const authResult = await supabaseAuthSignInWithPassword({
      supabaseUrl,
      publishableKey,
      email,
      password
    });

    const token = buildSessionToken(candidate);
    if (!token) {
      debugAuth('session token generation failed', { brokerIdNumber: candidate?.broker_id_number });
      return json({ message: 'Login failed, please try again.' }, 500);
    }

    debugAuth('login success', {
      brokerIdNumber: candidate?.broker_id_number,
      email: candidate?.email
    });
    return json({
      token,
      broker: sanitizeBroker(candidate),
      session: authResult?.access_token ? {
        access_token: authResult.access_token,
        refresh_token: authResult.refresh_token,
        expires_in: authResult.expires_in,
        expires_at: authResult.expires_at,
        token_type: authResult.token_type,
        user: authResult.user || null
      } : null
    });
  } catch (error) {
    const message = normalizeText(error?.message).toLowerCase();
    if (message.includes('email not confirmed') || message.includes('email not confirmed yet') || message.includes('confirm')) {
      return json({ message: 'Please verify your email first.' }, 403);
    }
    if (message.includes('invalid login credentials') || message.includes('invalid_grant') || message.includes('invalid')) {
      return json({ message: 'Invalid email or password.' }, 401);
    }
    debugAuth('login failure', error?.message || error);
    return json({ message: 'Login failed, please try again.' }, error?.status || 500);
  }
}
