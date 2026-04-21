import crypto from 'node:crypto';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function requiredEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePhoneNumber(phone) {
  const rawValue = String(phone || '').trim();
  if (!rawValue || rawValue.startsWith('__pending_mobile__:')) return '';
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00971')) return `971${digits.slice(5)}`;
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return `971${digits.slice(1)}`;
  return digits;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeBool(value) {
  return Boolean(value);
}

const LEAD_META_PREFIX = '__BC_LEAD_META__:';
const PROPERTY_META_PREFIX = '__BC_PROPERTY_META__:';

function normalizeActivityLog(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map(entry => ({
      id: normalizeText(entry?.id) || crypto.randomUUID(),
      type: normalizeText(entry?.type || 'system').toLowerCase(),
      text: normalizeText(entry?.text),
      createdAt: normalizeText(entry?.createdAt || entry?.created_at) || new Date().toISOString()
    }))
    .filter(entry => entry.text)
    .slice(0, 80);
}

function normalizeLeadWorkflow(rawWorkflow) {
  return {
    nextFollowUpDate: normalizeText(rawWorkflow?.nextFollowUpDate || rawWorkflow?.next_follow_up_date),
    nextFollowUpTime: normalizeText(rawWorkflow?.nextFollowUpTime || rawWorkflow?.next_follow_up_time),
    followUpNote: normalizeText(rawWorkflow?.followUpNote || rawWorkflow?.follow_up_note),
    isUrgentFollowUp: Boolean(rawWorkflow?.isUrgentFollowUp || rawWorkflow?.is_urgent_follow_up),
    callCount: Number(rawWorkflow?.callCount || rawWorkflow?.call_count || 0) || 0,
    whatsappCount: Number(rawWorkflow?.whatsappCount || rawWorkflow?.whatsapp_count || 0) || 0,
    lastContactedAt: normalizeText(rawWorkflow?.lastContactedAt || rawWorkflow?.last_contacted_at),
    lastContactMethod: normalizeText(rawWorkflow?.lastContactMethod || rawWorkflow?.last_contact_method),
    isArchived: Boolean(rawWorkflow?.isArchived || rawWorkflow?.is_archived),
    archivedAt: normalizeText(rawWorkflow?.archivedAt || rawWorkflow?.archived_at),
    activityLog: normalizeActivityLog(rawWorkflow?.activityLog || rawWorkflow?.activity_log)
  };
}

function normalizePropertyWorkflow(rawWorkflow) {
  return {
    nextFollowUpDate: normalizeText(rawWorkflow?.nextFollowUpDate || rawWorkflow?.next_follow_up_date),
    nextFollowUpTime: normalizeText(rawWorkflow?.nextFollowUpTime || rawWorkflow?.next_follow_up_time),
    followUpNote: normalizeText(rawWorkflow?.followUpNote || rawWorkflow?.follow_up_note),
    isUrgentFollowUp: Boolean(rawWorkflow?.isUrgentFollowUp || rawWorkflow?.is_urgent_follow_up),
    ownerCallCount: Number(rawWorkflow?.ownerCallCount || rawWorkflow?.owner_call_count || 0) || 0,
    ownerWhatsappCount: Number(rawWorkflow?.ownerWhatsappCount || rawWorkflow?.owner_whatsapp_count || 0) || 0,
    lastOwnerContactedAt: normalizeText(rawWorkflow?.lastOwnerContactedAt || rawWorkflow?.last_owner_contacted_at),
    lastOwnerContactMethod: normalizeText(rawWorkflow?.lastOwnerContactMethod || rawWorkflow?.last_owner_contact_method),
    isArchived: Boolean(rawWorkflow?.isArchived || rawWorkflow?.is_archived),
    archivedAt: normalizeText(rawWorkflow?.archivedAt || rawWorkflow?.archived_at),
    activityLog: normalizeActivityLog(rawWorkflow?.activityLog || rawWorkflow?.activity_log)
  };
}

export function parseLeadMeta(rawValue) {
  const rawText = normalizeText(rawValue);
  if (!rawText) {
    return {
      preferredBuildingProject: '',
      paymentMethod: '',
      legacyFollowUpNotes: '',
      ...normalizeLeadWorkflow({})
    };
  }

  if (!rawText.startsWith(LEAD_META_PREFIX)) {
    return {
      preferredBuildingProject: '',
      paymentMethod: '',
      legacyFollowUpNotes: rawText,
      ...normalizeLeadWorkflow({})
    };
  }

  try {
    const parsed = JSON.parse(rawText.slice(LEAD_META_PREFIX.length));
    return {
      preferredBuildingProject: normalizeText(parsed?.preferredBuildingProject),
      paymentMethod: normalizeText(parsed?.paymentMethod),
      legacyFollowUpNotes: normalizeText(parsed?.legacyFollowUpNotes),
      ...normalizeLeadWorkflow(parsed?.workflow || parsed)
    };
  } catch (error) {
    return {
      preferredBuildingProject: '',
      paymentMethod: '',
      legacyFollowUpNotes: '',
      ...normalizeLeadWorkflow({})
    };
  }
}

export function serializeLeadMeta(meta) {
  const workflow = normalizeLeadWorkflow(meta);
  const payload = {
    preferredBuildingProject: normalizeText(meta?.preferredBuildingProject),
    paymentMethod: normalizeText(meta?.paymentMethod),
    legacyFollowUpNotes: normalizeText(meta?.legacyFollowUpNotes),
    workflow
  };

  if (!payload.preferredBuildingProject && !payload.paymentMethod && !payload.legacyFollowUpNotes) {
    const hasWorkflowValues =
      workflow.nextFollowUpDate ||
      workflow.nextFollowUpTime ||
      workflow.followUpNote ||
      workflow.isUrgentFollowUp ||
      workflow.callCount ||
      workflow.whatsappCount ||
      workflow.lastContactedAt ||
      workflow.lastContactMethod ||
      workflow.isArchived ||
      workflow.archivedAt ||
      workflow.activityLog.length;
    if (!hasWorkflowValues) {
      return '';
    }
  }

  return `${LEAD_META_PREFIX}${JSON.stringify(payload)}`;
}

export function parsePropertyMeta(rawValue) {
  const rawText = normalizeText(rawValue);
  if (!rawText) {
    return {
      buildingName: '',
      floorLevel: '',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      marketPrice: '',
      distressAskingPrice: '',
      distressDiscountPercent: '',
      legacyDescription: '',
      ...normalizePropertyWorkflow({})
    };
  }

  if (!rawText.startsWith(PROPERTY_META_PREFIX)) {
    return {
      buildingName: '',
      floorLevel: '',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      marketPrice: '',
      distressAskingPrice: '',
      distressDiscountPercent: '',
      legacyDescription: rawText,
      ...normalizePropertyWorkflow({})
    };
  }

  try {
    const parsed = JSON.parse(rawText.slice(PROPERTY_META_PREFIX.length));
    return {
      buildingName: normalizeText(parsed?.buildingName),
      floorLevel: normalizeText(parsed?.floorLevel),
      furnishing: normalizeText(parsed?.furnishing),
      cheques: normalizeText(parsed?.cheques),
      chiller: normalizeText(parsed?.chiller),
      mortgageStatus: normalizeText(parsed?.mortgageStatus),
      leasehold: Boolean(parsed?.leasehold),
      marketPrice: normalizeText(parsed?.marketPrice),
      distressAskingPrice: normalizeText(parsed?.distressAskingPrice),
      distressDiscountPercent: normalizeText(parsed?.distressDiscountPercent),
      legacyDescription: normalizeText(parsed?.legacyDescription),
      ...normalizePropertyWorkflow(parsed?.workflow || parsed)
    };
  } catch (error) {
    return {
      buildingName: '',
      floorLevel: '',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      marketPrice: '',
      distressAskingPrice: '',
      distressDiscountPercent: '',
      legacyDescription: '',
      ...normalizePropertyWorkflow({})
    };
  }
}

export function serializePropertyMeta(meta) {
  const workflow = normalizePropertyWorkflow(meta);
  const payload = {
    buildingName: normalizeText(meta?.buildingName),
    floorLevel: normalizeText(meta?.floorLevel),
    furnishing: normalizeText(meta?.furnishing),
    cheques: normalizeText(meta?.cheques),
    chiller: normalizeText(meta?.chiller),
    mortgageStatus: normalizeText(meta?.mortgageStatus),
    leasehold: Boolean(meta?.leasehold),
    marketPrice: normalizeText(meta?.marketPrice),
    distressAskingPrice: normalizeText(meta?.distressAskingPrice),
    distressDiscountPercent: normalizeText(meta?.distressDiscountPercent),
    legacyDescription: normalizeText(meta?.legacyDescription),
    workflow
  };

  if (
    !payload.buildingName &&
    !payload.floorLevel &&
    !payload.furnishing &&
    !payload.cheques &&
    !payload.chiller &&
    !payload.mortgageStatus &&
    !payload.leasehold &&
    !payload.marketPrice &&
    !payload.distressAskingPrice &&
    !payload.distressDiscountPercent &&
    !payload.legacyDescription
  ) {
    const hasWorkflowValues =
      workflow.nextFollowUpDate ||
      workflow.nextFollowUpTime ||
      workflow.followUpNote ||
      workflow.isUrgentFollowUp ||
      workflow.ownerCallCount ||
      workflow.ownerWhatsappCount ||
      workflow.lastOwnerContactedAt ||
      workflow.lastOwnerContactMethod ||
      workflow.isArchived ||
      workflow.archivedAt ||
      workflow.activityLog.length;
    if (!hasWorkflowValues) {
      return '';
    }
  }

  return `${PROPERTY_META_PREFIX}${JSON.stringify(payload)}`;
}

function normalizeLeadClientPurpose(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'rent' ? 'rent' : 'buy';
}

export function buildLeadPublicSummary(item) {
  const meta = parseLeadMeta(item?.follow_up_notes || item?.followUpNotes);
  const clientPurpose = normalizeLeadClientPurpose(item?.clientPurpose || item?.purpose);
  const propertyType = normalizeText(item?.propertyType || item?.property_type || item?.category);
  const location = normalizeText(item?.location);
  const buildingProject = normalizeText(item?.preferredBuildingProject || meta.preferredBuildingProject);
  const budget = normalizeText(item?.budget || item?.price_label || item?.priceLabel);
  const paymentMethod = normalizeText(item?.paymentMethod || meta.paymentMethod);

  const summaryParts = [
    clientPurpose === 'rent' ? 'Rent requirement' : 'Buy requirement',
    propertyType,
    location,
    buildingProject ? `Building/Project: ${buildingProject}` : '',
    budget ? `Budget: AED ${budget}` : '',
    clientPurpose === 'buy' && paymentMethod ? `Payment: ${paymentMethod}` : ''
  ].filter(Boolean);

  return summaryParts.join(' · ');
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  try {
    const [salt, expected] = String(storedHash || '').split(':');
    if (!salt || !expected || !/^[a-f0-9]{128}$/i.test(expected)) {
      return false;
    }
    const actual = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
    const actualBuffer = Buffer.from(actual, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (!actualBuffer.length || actualBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch (error) {
    return false;
  }
}

export function createToken(payload, secret, expiresInMs = 8 * 60 * 60 * 1000) {
  const data = {
    ...payload,
    exp: Date.now() + expiresInMs
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token, secret) {
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

export function getBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export function getSupabaseConfig() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceRoleKey };
}

export function getSupabasePublishableKey() {
  return requiredEnv('SUPABASE_PUBLISHABLE_KEY')
    || requiredEnv('SUPABASE_ANON_KEY')
    || 'sb_publishable_32o5MAuNPn1e0Uy6ZC09Wg_2skR1xQW';
}

export function createPendingMobileValue(userId) {
  return `__pending_mobile__:${normalizeText(userId) || crypto.randomUUID()}`;
}

export async function supabaseAuthSignUp({
  supabaseUrl,
  publishableKey,
  email,
  password,
  data = {},
  redirectTo = ''
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      data,
      redirect_to: redirectTo || undefined
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase Auth signup failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  if (result?.user || result?.session) {
    return result;
  }

  if (result?.id || result?.email) {
    return {
      user: result,
      session: null
    };
  }

  return result;
}

export async function supabaseAuthSignInWithPassword({
  supabaseUrl,
  publishableKey,
  email,
  password
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase Auth sign-in failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

export async function supabaseAuthGetUser({
  supabaseUrl,
  publishableKey,
  accessToken
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase Auth user lookup failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

export async function supabaseAuthResetPasswordForEmail({
  supabaseUrl,
  publishableKey,
  email,
  redirectTo
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      redirect_to: redirectTo
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase password reset request failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

export async function supabaseAuthDeleteUser({
  supabaseUrl,
  serviceRoleKey,
  userId
}) {
  if (!normalizeText(userId)) return;

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase auth delete failed: ${errorBody || response.statusText}`);
  }
}

export async function supabaseAuthAdminCreateUser({
  supabaseUrl,
  serviceRoleKey,
  email,
  password,
  emailConfirm = false,
  userMetadata = {}
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: emailConfirm,
      user_metadata: userMetadata
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase admin user create failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

export async function supabaseAuthAdminUpdateUser({
  supabaseUrl,
  serviceRoleKey,
  userId,
  email,
  password,
  emailConfirm,
  userMetadata = {}
}) {
  if (!normalizeText(userId)) {
    throw new Error('Supabase admin user update requires a user ID.');
  }

  const payload = {};
  if (normalizeEmail(email)) {
    payload.email = normalizeEmail(email);
  }
  if (normalizeText(password)) {
    payload.password = String(password);
  }
  if (typeof emailConfirm === 'boolean') {
    payload.email_confirm = emailConfirm;
  }
  if (userMetadata && typeof userMetadata === 'object' && Object.keys(userMetadata).length) {
    payload.user_metadata = userMetadata;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeText(result?.msg)
      || normalizeText(result?.error_description)
      || normalizeText(result?.message)
      || normalizeText(result?.error)
      || 'Supabase admin user update failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

export function createRestUrl(baseUrl, table) {
  return new URL(`${baseUrl}/rest/v1/${table}`);
}

export async function supabaseSelect({
  supabaseUrl,
  serviceRoleKey,
  table,
  select = '*',
  filters = {},
  order
}) {
  const url = createRestUrl(supabaseUrl, table);
  url.searchParams.set('select', select);
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (String(value).includes('.')) {
      url.searchParams.set(key, value);
      return;
    }
    url.searchParams.set(key, `eq.${value}`);
  });
  if (order?.column) {
    url.searchParams.set('order', `${order.column}.${order.ascending ? 'asc' : 'desc'}`);
  }

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
    throw new Error(`Supabase select failed for ${table}: ${errorBody || response.statusText}`);
  }

  return response.json().catch(() => []);
}

export async function supabaseInsert({
  supabaseUrl,
  serviceRoleKey,
  table,
  payload
}) {
  const url = createRestUrl(supabaseUrl, table);
  url.searchParams.set('select', '*');
  const response = await fetch(url, {
    method: 'POST',
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
    throw new Error(`Supabase insert failed for ${table}: ${errorBody || response.statusText}`);
  }

  return response.json().catch(() => []);
}

export async function supabasePatch({
  supabaseUrl,
  serviceRoleKey,
  table,
  filters = {},
  payload
}) {
  const url = createRestUrl(supabaseUrl, table);
  url.searchParams.set('select', '*');
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (String(value).includes('.')) {
      url.searchParams.set(key, value);
      return;
    }
    url.searchParams.set(key, `eq.${value}`);
  });

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
    throw new Error(`Supabase update failed for ${table}: ${errorBody || response.statusText}`);
  }

  return response.json().catch(() => []);
}

export async function supabaseDelete({
  supabaseUrl,
  serviceRoleKey,
  table,
  filters = {}
}) {
  const url = createRestUrl(supabaseUrl, table);
  url.searchParams.set('select', '*');
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (String(value).includes('.')) {
      url.searchParams.set(key, value);
      return;
    }
    url.searchParams.set(key, `eq.${value}`);
  });

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
    throw new Error(`Supabase delete failed for ${table}: ${errorBody || response.statusText}`);
  }

  return response.json().catch(() => []);
}

export async function requireBrokerSession(request) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const brokerSecret = requiredEnv('BROKER_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !brokerSecret) {
    throw new Error('Missing broker session environment variables.');
  }

  const token = getBearerToken(request);
  const session = verifyToken(token, brokerSecret);
  if (!session?.brokerUuid) {
    const error = new Error('Broker session is missing or invalid.');
    error.status = 401;
    throw error;
  }

  const rows = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'brokers',
    filters: { id: session.brokerUuid },
    order: { column: 'created_at', ascending: false }
  });
  const broker = Array.isArray(rows) ? rows[0] : null;

  if (!broker) {
    const error = new Error('Broker account was not found.');
    error.status = 404;
    throw error;
  }

  if (broker.is_blocked) {
    const error = new Error('This broker account is blocked.');
    error.status = 403;
    throw error;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    brokerSecret,
    session,
    broker
  };
}

export function buildPublicListingPayload(sourceType, broker, item) {
  const isLead = sourceType === 'lead';
  const purpose = normalizeText(item.purpose);
  const category = normalizeText(item.category);
  const location = normalizeText(item.location);
  const priceLabel = isLead ? normalizeText(item.budget) : normalizeText(item.price);
  const projectOrBuilding = isLead
    ? normalizeText(item.preferredBuildingProject)
    : normalizeText(item.buildingName || item.size);
  const generalNotes = isLead
    ? normalizeText(item.public_general_notes || buildLeadPublicSummary(item))
    : normalizeText(item.public_notes);
  const propertyType = isLead
    ? normalizeText(item.property_type || item.category || item.lead_type || '')
    : normalizeText(item.property_type || '');
  const status = normalizeText(item.status || 'active').toLowerCase();
  const isDistress = normalizeBool(item.is_distress);

  return {
    broker_uuid: broker.id,
    broker_id_number: broker.broker_id_number,
    broker_display_name: broker.full_name,
    broker_mobile: normalizePhoneNumber(broker.mobile_number),
    source_type: sourceType,
    source_id: item.id,
    listing_kind: isLead ? 'broker_requirement' : 'broker_connector_listing',
    purpose,
    property_type: propertyType,
    category,
    location,
    price_label: priceLabel,
    size_label: projectOrBuilding,
    bedrooms: item.bedrooms ?? null,
    bathrooms: item.bathrooms ?? null,
    public_notes: generalNotes,
    status,
    is_urgent: false,
    is_distress: isDistress,
    updated_at: new Date().toISOString()
  };
}

export function sanitizeLead(row) {
  if (!row) return null;
  const meta = parseLeadMeta(row.follow_up_notes);
  const clientPurpose = normalizeLeadClientPurpose(row.purpose);
  return {
    id: row.id,
    purpose: row.purpose,
    clientPurpose,
    category: row.category,
    propertyType: row.category || '',
    location: row.location,
    preferredLocation: row.location || '',
    budget: row.budget,
    notes: row.notes || '',
    privateNotes: row.notes || '',
    publicGeneralNotes: row.public_general_notes || '',
    leadType: row.lead_type,
    status: row.status,
    priority: row.priority,
    source: row.source,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    followUpNotes: meta.legacyFollowUpNotes || '',
    legacyFollowUpNotes: meta.legacyFollowUpNotes || '',
    nextAction: row.next_action,
    preferredBuildingProject: meta.preferredBuildingProject || '',
    paymentMethod: meta.paymentMethod || '',
    nextFollowUpDate: meta.nextFollowUpDate || '',
    nextFollowUpTime: meta.nextFollowUpTime || '',
    followUpNote: meta.followUpNote || '',
    isUrgentFollowUp: Boolean(meta.isUrgentFollowUp),
    callCount: meta.callCount || 0,
    whatsappCount: meta.whatsappCount || 0,
    lastContactedAt: meta.lastContactedAt || '',
    lastContactMethod: meta.lastContactMethod || '',
    isArchived: Boolean(meta.isArchived),
    archivedAt: meta.archivedAt || '',
    activityLog: Array.isArray(meta.activityLog) ? meta.activityLog : [],
    rentChecklist: {
      booking: Boolean(row.rent_booking),
      agreementSigned: Boolean(row.rent_agreement_signed),
      handoverDone: Boolean(row.rent_handover_done)
    },
    saleChecklist: {
      contractA: Boolean(row.sale_contract_a),
      contractB: Boolean(row.sale_contract_b),
      contractF: Boolean(row.sale_contract_f)
    },
    ownerName: row.owner_name || '',
    ownerPhone: row.owner_phone || '',
    clientName: row.client_name || '',
    clientPhone: row.client_phone || '',
    isListedPublic: Boolean(row.is_listed_public),
    publicListingStatus: row.public_listing_status || 'private',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sanitizeProperty(row) {
  if (!row) return null;
  const meta = parsePropertyMeta(row.description);
  return {
    id: row.id,
    purpose: row.purpose,
    propertyType: row.property_type,
    category: row.category,
    location: row.location,
    price: row.price,
    rentPrice: normalizeText(row.purpose).toLowerCase() === 'rent' ? row.price || '' : '',
    ownerAskingPrice: normalizeText(row.purpose).toLowerCase() === 'sale' ? row.price || '' : '',
    size: row.size,
    sizeSqft: row.size || '',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    description: meta.legacyDescription || '',
    legacyDescription: meta.legacyDescription || '',
    publicNotes: row.public_notes || '',
    internalNotes: row.internal_notes || '',
    buildingName: meta.buildingName || '',
    floorLevel: meta.floorLevel || '',
    furnishing: meta.furnishing || '',
    cheques: meta.cheques || '',
    chiller: meta.chiller || '',
    mortgageStatus: meta.mortgageStatus || '',
    leasehold: Boolean(meta.leasehold),
    marketPrice: meta.marketPrice || '',
    distressAskingPrice: meta.distressAskingPrice || '',
    distressDiscountPercent: meta.distressDiscountPercent || '',
    ownerName: row.owner_name || '',
    ownerPhone: row.owner_phone || '',
    nextFollowUpDate: meta.nextFollowUpDate || '',
    nextFollowUpTime: meta.nextFollowUpTime || '',
    followUpNote: meta.followUpNote || '',
    isUrgentFollowUp: Boolean(meta.isUrgentFollowUp),
    ownerCallCount: meta.ownerCallCount || 0,
    ownerWhatsappCount: meta.ownerWhatsappCount || 0,
    lastOwnerContactedAt: meta.lastOwnerContactedAt || '',
    lastOwnerContactMethod: meta.lastOwnerContactMethod || '',
    isArchived: Boolean(meta.isArchived),
    archivedAt: meta.archivedAt || '',
    activityLog: Array.isArray(meta.activityLog) ? meta.activityLog : [],
    status: row.status,
    isUrgent: Boolean(row.is_urgent),
    isDistress: Boolean(row.is_distress),
    isListedPublic: Boolean(row.is_listed_public),
    publicListingStatus: row.public_listing_status || 'private',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sanitizeFollowUp(row) {
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    followUpType: row.follow_up_type,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    note: row.note,
    nextAction: row.next_action,
    createdAt: row.created_at
  };
}

export function sanitizeNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    relatedSourceType: row.related_source_type || '',
    relatedSourceId: row.related_source_id ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sanitizeAiMatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    requirementId: row.requirement_id ?? null,
    propertyId: row.property_id ?? null,
    matchScore: row.match_score ?? 0,
    matchReason: row.match_reason || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sanitizePublicListing(row) {
  if (!row) return null;
  return {
    id: row.id,
    brokerName: row.broker_display_name,
    brokerIdNumber: row.broker_id_number,
    brokerMobile: row.broker_mobile,
    sourceType: row.source_type,
    sourceId: row.source_id,
    listingKind: row.listing_kind,
    purpose: row.purpose,
    propertyType: row.property_type,
    category: row.category,
    location: row.location,
    priceLabel: row.price_label,
    sizeLabel: row.size_label,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    publicNotes: row.public_notes,
    status: row.status,
    isUrgent: Boolean(row.is_urgent),
    isDistress: Boolean(row.is_distress),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
