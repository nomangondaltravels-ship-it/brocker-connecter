import crypto from 'node:crypto';

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
  supabaseAuthAdminCreateUser,
  supabaseAuthGetUser,
  supabaseAuthResetPasswordForEmail,
  supabaseAuthSignInWithPassword,
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

async function ensureBrokerProfileFromAuthUser({
  supabaseUrl,
  serviceRoleKey,
  authUser,
  fallbackEmail = '',
  fallbackPassword = '',
  fallbackCompanyName = '',
  fallbackMobileNumber = ''
}) {
  if (!authUser?.id) return null;

  const userMeta = authUser.user_metadata || authUser.raw_user_meta_data || {};
  const fullName = normalizeText(userMeta.full_name || authUser.email?.split('@')[0] || 'Broker');
  const companyName = normalizeText(userMeta.company_name || fallbackCompanyName);
  const mobileNumber = normalizePhoneNumber(userMeta.mobile_number || fallbackMobileNumber);
  const email = normalizeEmail(authUser.email || fallbackEmail);
  const verificationState = Boolean(authUser.email_confirmed_at || authUser.confirmed_at);

  const existingRows = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    filters: { id: authUser.id },
    order: { column: 'created_at', ascending: false }
  });
  const existingBroker = Array.isArray(existingRows) ? existingRows[0] : null;
  if (existingBroker) {
    const updatePayload = {
      full_name: fullName || existingBroker.full_name,
      email: email || existingBroker.email,
      company_name: companyName || existingBroker.company_name || '',
      is_verified: verificationState || Boolean(existingBroker.is_verified),
      updated_at: new Date().toISOString()
    };
    if (mobileNumber) {
      updatePayload.mobile_number = mobileNumber;
    }
    await supabasePatch({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { id: existingBroker.id },
      payload: updatePayload
    }).catch(() => []);
    return {
      ...existingBroker,
      ...updatePayload,
      mobile_number: updatePayload.mobile_number || existingBroker.mobile_number
    };
  }

  if (email) {
    const existingByEmailRows = await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { email },
      order: { column: 'created_at', ascending: false }
    });
    const existingByEmail = Array.isArray(existingByEmailRows) ? existingByEmailRows[0] : null;
    if (existingByEmail) {
      const updatePayload = {
        full_name: fullName || existingByEmail.full_name,
        company_name: companyName || existingByEmail.company_name || '',
        is_verified: verificationState || Boolean(existingByEmail.is_verified),
        updated_at: new Date().toISOString()
      };
      if (mobileNumber && normalizePhoneNumber(existingByEmail.mobile_number) !== mobileNumber) {
        updatePayload.mobile_number = mobileNumber;
      }
      await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: existingByEmail.id },
        payload: updatePayload
      }).catch(() => []);
      return {
        ...existingByEmail,
        ...updatePayload,
        mobile_number: updatePayload.mobile_number || existingByEmail.mobile_number
      };
    }
  }

  const safeMobileNumber = mobileNumber || createPendingMobileValue(authUser.id);
  const createdRows = await supabaseInsert({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    payload: [{
      id: authUser.id,
      full_name: fullName,
      broker_id_number: buildInternalBrokerId(authUser.id),
      mobile_number: safeMobileNumber,
      email,
      password_hash: createPasswordHash(fallbackPassword || crypto.randomUUID()),
      company_name: companyName,
      is_verified: verificationState,
      is_blocked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]
  });

  return Array.isArray(createdRows) ? createdRows[0] : null;
}

async function findBrokerByEmail({
  supabaseUrl,
  serviceRoleKey,
  email
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const rows = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    filters: { email: normalizedEmail },
    order: { column: 'created_at', ascending: false }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function repairAuthUserFromBroker({
  supabaseUrl,
  serviceRoleKey,
  broker,
  password
}) {
  if (!broker?.email) return;

  try {
    await supabaseAuthAdminCreateUser({
      supabaseUrl,
      serviceRoleKey,
      email: normalizeEmail(broker.email),
      password: password || crypto.randomUUID(),
      emailConfirm: true,
      userMetadata: {
        full_name: broker.full_name,
        company_name: broker.company_name || '',
        mobile_number: normalizePhoneNumber(broker.mobile_number)
      }
    });
    debugAuth('auth user repaired from broker', {
      email: broker.email,
      brokerId: broker.id
    });
  } catch (error) {
    const message = normalizeText(error?.message).toLowerCase();
    if (message.includes('already') || message.includes('registered') || message.includes('exists') || message.includes('duplicate')) {
      debugAuth('auth user already exists during repair', { email: broker.email });
      return;
    }
    throw error;
  }
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

  if (!['register', 'login', 'forgot-password', 'exchange-session'].includes(action)) {
    return json({ message: 'Unsupported broker auth action.' }, 400);
  }

  if (action === 'exchange-session') {
    const accessToken = normalizeText(body?.accessToken);
    const refreshToken = normalizeText(body?.refreshToken);

    if (!accessToken) {
      return json({ message: 'Missing auth session.' }, 400);
    }

    try {
      const authUser = await supabaseAuthGetUser({
        supabaseUrl,
        publishableKey: serviceRoleKey,
        accessToken
      });

      const candidate = await findBrokerByEmail({
        supabaseUrl,
        serviceRoleKey,
        email: authUser?.email || ''
      });

      const broker = await ensureBrokerProfileFromAuthUser({
        supabaseUrl,
        serviceRoleKey,
        authUser,
        fallbackEmail: authUser?.email || '',
        fallbackCompanyName: candidate?.company_name || '',
        fallbackMobileNumber: candidate?.mobile_number || ''
      }) || candidate;

      if (!broker) {
        return json({ message: 'Account not found.' }, 404);
      }
      if (broker.is_blocked) {
        return json({ message: 'This broker account is blocked. Please contact admin support.' }, 403);
      }

      return json({
        token: buildSessionToken(broker),
        broker: sanitizeBroker(broker),
        session: {
          access_token: accessToken,
          refresh_token: refreshToken || null,
          user: authUser
        }
      });
    } catch (error) {
      debugAuth('exchange-session failure', error?.message || error);
      return json({ message: 'Unable to complete secure sign in.' }, error?.status || 500);
    }
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
    let emailConfirmationRequired = false;
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
      emailConfirmationRequired = !authResult?.session?.access_token;

      const broker = await ensureBrokerProfileFromAuthUser({
        supabaseUrl,
        serviceRoleKey,
        authUser,
        fallbackEmail: email,
        fallbackPassword: password,
        fallbackCompanyName: companyName,
        fallbackMobileNumber: mobileNumber
      });
      if (!broker) {
        throw new Error('Broker profile creation failed.');
      }

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
      if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate')) {
        return json({ message: 'This email address is already registered. Please sign in instead.' }, 409);
      }

      if (authUser?.id) {
        debugAuth('register partial success', {
          email,
          authUserId: authUser.id,
          message: error?.message || 'Unknown register error'
        });
        return json({
          requiresEmailConfirmation: emailConfirmationRequired,
          message: emailConfirmationRequired
            ? 'Check your email to confirm your account.'
            : 'Broker account created successfully. Please sign in.'
        });
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
    const broker = await findBrokerByEmail({
      supabaseUrl,
      serviceRoleKey,
      email
    });

    if (broker) {
      try {
        await repairAuthUserFromBroker({
          supabaseUrl,
          serviceRoleKey,
          broker
        });
      } catch (repairError) {
        debugAuth('forgot-password repair warning', {
          email,
          message: repairError?.message || 'Unknown repair warning'
        });
      }
    }

    try {
      await supabaseAuthResetPasswordForEmail({
        supabaseUrl,
        publishableKey,
        email,
        redirectTo: redirectUrl
      });
      debugAuth('forgot-password recover accepted (direct)', { email, redirectUrl });
      return json({
        message: 'If an account exists for this email, a reset link has been sent.'
      });
    } catch (error) {
      const initialError = error;
      const initialMessage = normalizeText(initialError?.message).toLowerCase();
      if (initialError?.status === 429 || initialMessage.includes('rate limit') || initialMessage.includes('security purposes')) {
        return json({ message: 'Please wait a minute before requesting another reset email.' }, 429);
      }
      try {
        debugAuth('forgot-password request', {
          email,
          redirectUrl,
          brokerExists: Boolean(broker),
          initialRecoverError: initialError?.message || 'Unknown recover error'
        });

        if (broker) {
          try {
            await repairAuthUserFromBroker({
              supabaseUrl,
              serviceRoleKey,
              broker
            });
          } catch (repairError) {
            debugAuth('forgot-password repair retry warning', {
              email,
              message: repairError?.message || 'Unknown repair warning'
            });
          }
        }

        await supabaseAuthResetPasswordForEmail({
          supabaseUrl,
          publishableKey,
          email,
          redirectTo: redirectUrl
        });
        debugAuth('forgot-password recover accepted (after repair)', { email, redirectUrl });
        return json({
          message: 'If an account exists for this email, a reset link has been sent.'
        });
      } catch (finalError) {
        debugAuth('forgot-password failure', {
          email,
          redirectUrl,
          initialMessage: initialError?.message || 'Unknown forgot-password error',
          message: finalError?.message || 'Unknown forgot-password error',
          status: finalError?.status || 500,
          payload: finalError?.payload || null
        });
        return json({ message: 'Unable to send reset email. Please try again.' }, finalError?.status || 500);
      }
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

  try {
    const authResult = await supabaseAuthSignInWithPassword({
      supabaseUrl,
      publishableKey,
      email,
      password
    });

    const candidate = await findBrokerByEmail({
      supabaseUrl,
      serviceRoleKey,
      email
    });

    const broker = await ensureBrokerProfileFromAuthUser({
      supabaseUrl,
      serviceRoleKey,
      authUser: authResult?.user,
      fallbackEmail: email,
      fallbackPassword: password,
      fallbackCompanyName: candidate?.company_name || '',
      fallbackMobileNumber: candidate?.mobile_number || ''
    }) || candidate;

    debugAuth('login lookup', {
      emailProvided: Boolean(email),
      brokerFound: Boolean(broker)
    });

    if (!broker) {
      return json({ message: 'Account not found.' }, 404);
    }

    if (broker.is_blocked) {
      return json({ message: 'This broker account is blocked. Please contact admin support.' }, 403);
    }

    const token = buildSessionToken(broker);
    if (!token) {
      debugAuth('session token generation failed', { brokerIdNumber: broker?.broker_id_number });
      return json({ message: 'Login failed, please try again.' }, 500);
    }

    debugAuth('login success', {
      brokerIdNumber: broker?.broker_id_number,
      email: broker?.email
    });
    return json({
      token,
      broker: sanitizeBroker(broker),
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
    const candidate = await findBrokerByEmail({
      supabaseUrl,
      serviceRoleKey,
      email
    });

    if ((message.includes('invalid login credentials') || message.includes('invalid_grant') || message.includes('invalid')) && candidate && verifyPassword(password, candidate.password_hash)) {
      try {
        await repairAuthUserFromBroker({
          supabaseUrl,
          serviceRoleKey,
          broker: candidate,
          password
        });

        const repairedAuthResult = await supabaseAuthSignInWithPassword({
          supabaseUrl,
          publishableKey,
          email,
          password
        });

        const broker = await ensureBrokerProfileFromAuthUser({
          supabaseUrl,
          serviceRoleKey,
          authUser: repairedAuthResult?.user,
          fallbackEmail: email,
          fallbackPassword: password,
          fallbackCompanyName: candidate?.company_name || '',
          fallbackMobileNumber: candidate?.mobile_number || ''
        }) || candidate;

        if (!broker) {
          return json({ message: 'Account not found.' }, 404);
        }
        if (broker.is_blocked) {
          return json({ message: 'This broker account is blocked. Please contact admin support.' }, 403);
        }

        return json({
          token: buildSessionToken(broker),
          broker: sanitizeBroker(broker),
          session: repairedAuthResult?.access_token ? {
            access_token: repairedAuthResult.access_token,
            refresh_token: repairedAuthResult.refresh_token,
            expires_in: repairedAuthResult.expires_in,
            expires_at: repairedAuthResult.expires_at,
            token_type: repairedAuthResult.token_type,
            user: repairedAuthResult.user || null
          } : null
        });
      } catch (repairLoginError) {
        debugAuth('login repair failure', repairLoginError?.message || repairLoginError);
      }
    }

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
