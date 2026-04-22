import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  supabaseDelete,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from './_broker-platform.mjs';
import {
  getComplaintRepeatOffenseLevel,
  getComplaintReportedBrokerKey,
  normalizeComplaintAction,
  normalizeComplaintStatus,
  parseComplaintRecord,
  isComplaintValidForOffense
} from './_complaints.mjs';

function verifyAdminToken(token, secret) {
  return verifyToken(token, secret);
}

function getReviewerLabel(tokenPayload) {
  return normalizeText(tokenPayload?.u) || 'admin';
}

async function requireAdmin(request) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const sessionSecret = requiredEnv('ADMIN_SESSION_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !sessionSecret) {
    const error = new Error('Missing required environment variables for secure admin complaints.');
    error.status = 500;
    throw error;
  }

  const token = getBearerToken(request);
  const tokenPayload = verifyAdminToken(token, sessionSecret);
  if (!tokenPayload?.u) {
    const error = new Error('Admin login token is missing or invalid.');
    error.status = 401;
    throw error;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    tokenPayload,
    reviewerLabel: getReviewerLabel(tokenPayload)
  };
}

function normalizeComplaintId(value) {
  return String(value ?? '').trim();
}

function normalizeComplaintMatch(bodyMatch) {
  if (!bodyMatch || typeof bodyMatch !== 'object') return {};
  return Object.fromEntries(
    Object.entries(bodyMatch)
      .map(([key, value]) => [key, normalizeText(value)])
      .filter(([, value]) => value)
  );
}

function buildComplaintFilters(complaintId, match = {}) {
  if (complaintId) return { id: complaintId };
  return match;
}

function normalizeComplaintRows(rows = []) {
  const parsed = (Array.isArray(rows) ? rows : []).map(parseComplaintRecord);
  const validCountByBroker = new Map();

  parsed.forEach(item => {
    const brokerKey = getComplaintReportedBrokerKey(item);
    if (!brokerKey || !isComplaintValidForOffense(item.normalizedStatus)) return;
    validCountByBroker.set(brokerKey, (validCountByBroker.get(brokerKey) || 0) + 1);
  });

  return parsed.map(item => {
    const brokerKey = getComplaintReportedBrokerKey(item);
    const repeatOffenseCount = brokerKey ? (validCountByBroker.get(brokerKey) || 0) : 0;
    return {
      ...item,
      repeat_offense_count: repeatOffenseCount,
      repeatOffenseCount,
      suggested_action: getComplaintRepeatOffenseLevel(repeatOffenseCount),
      suggestedAction: getComplaintRepeatOffenseLevel(repeatOffenseCount)
    };
  });
}

async function fetchComplaintRows(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    select: '*',
    order: { column: 'created_at', ascending: false }
  });
  return normalizeComplaintRows(rows);
}

async function fetchComplaintByFilters(context, filters) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    select: '*',
    filters
  });
  return normalizeComplaintRows(rows)[0] || null;
}

async function patchComplaint(context, filters, payload) {
  const updated = await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    filters,
    payload: {
      ...payload,
      updated_at: new Date().toISOString()
    }
  });
  return normalizeComplaintRows(updated);
}

async function deleteComplaintRows(context, filters) {
  const deleted = await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    filters
  });
  return Array.isArray(deleted) ? deleted.length : 0;
}

async function setComplaintBrokerRestriction(context, complaint) {
  const brokerId = normalizeText(complaint.reportedBrokerId || complaint.reportedUserId);
  if (!brokerId) return { applied: false };

  const updatedAt = new Date().toISOString();
  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_leads',
    filters: { broker_uuid: brokerId },
    payload: {
      is_listed_public: false,
      public_listing_status: 'private',
      updated_at: updatedAt
    }
  }).catch(() => []);

  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_properties',
    filters: { broker_uuid: brokerId },
    payload: {
      is_listed_public: false,
      public_listing_status: 'private',
      updated_at: updatedAt
    }
  }).catch(() => []);

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'public_listings',
    filters: { broker_uuid: brokerId }
  }).catch(() => []);

  return { applied: true, scope: 'broker_visibility' };
}

async function setComplaintBrokerBlock(context, complaint) {
  const brokerId = normalizeText(complaint.reportedBrokerId || complaint.reportedUserId);
  if (!brokerId) return { applied: false };

  await setComplaintBrokerRestriction(context, complaint);
  await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'brokers',
    filters: { id: brokerId },
    payload: {
      is_blocked: true,
      is_verified: false,
      updated_at: new Date().toISOString()
    }
  }).catch(() => []);

  return { applied: true, scope: 'broker_block' };
}

async function deleteComplaintListing(context, complaint) {
  const listingId = Number(complaint.listingId || 0);
  if (!listingId) return { applied: false };

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'public_listings',
    filters: {
      source_type: 'property',
      source_id: listingId
    }
  }).catch(() => []);

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_properties',
    filters: { id: listingId }
  }).catch(() => []);

  return { applied: true, scope: 'listing_delete' };
}

async function deleteComplaintRequirement(context, complaint) {
  const requirementId = Number(complaint.requirementId || 0);
  if (!requirementId) return { applied: false };

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'public_listings',
    filters: {
      source_type: 'lead',
      source_id: requirementId
    }
  }).catch(() => []);

  await supabaseDelete({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_leads',
    filters: { id: requirementId }
  }).catch(() => []);

  return { applied: true, scope: 'requirement_delete' };
}

async function applyComplaintAction(context, complaint, actionTaken) {
  switch (actionTaken) {
    case 'warning':
      return { applied: true, scope: 'warning_only' };
    case 'restrict':
      return setComplaintBrokerRestriction(context, complaint);
    case 'block':
      return setComplaintBrokerBlock(context, complaint);
    case 'delete_listing':
      return deleteComplaintListing(context, complaint);
    case 'delete_requirement':
      return deleteComplaintRequirement(context, complaint);
    case 'none':
    default:
      return { applied: true, scope: 'record_only' };
  }
}

export async function GET(request) {
  try {
    const context = await requireAdmin(request);
    const complaints = await fetchComplaintRows(context);
    return json({ complaints });
  } catch (error) {
    return json({ message: error?.message || 'Admin complaints could not be loaded.' }, error?.status || 500);
  }
}

export async function POST(request) {
  try {
    const context = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    const complaintId = normalizeComplaintId(body?.complaintId);
    const match = normalizeComplaintMatch(body?.match);
    const filters = buildComplaintFilters(complaintId, match);

    if (!action || !Object.keys(filters).length) {
      return json({ message: 'Complaint target is missing.' }, 400);
    }

    if (action === 'update-status') {
      const status = normalizeComplaintStatus(body?.status, '');
      if (!status) {
        return json({ message: 'Complaint status is required.' }, 400);
      }
      const complaints = await patchComplaint(context, filters, {
        status,
        reviewed_by: context.reviewerLabel,
        reviewed_at: new Date().toISOString()
      });
      return json({ complaints });
    }

    if (action === 'take-action') {
      const actionTaken = normalizeComplaintAction(body?.actionTaken, '');
      if (!actionTaken) {
        return json({ message: 'Complaint action is required.' }, 400);
      }

      const complaint = await fetchComplaintByFilters(context, filters);
      if (!complaint) {
        return json({ message: 'Complaint not found.' }, 404);
      }

      const actionResult = await applyComplaintAction(context, complaint, actionTaken);
      const nextStatus = normalizeComplaintStatus(
        body?.status,
        actionTaken === 'none' ? complaint.normalizedStatus || 'under-review' : 'resolved'
      );

      const complaints = await patchComplaint(context, { id: complaint.id }, {
        status: nextStatus,
        admin_note: normalizeText(body?.adminNote),
        action_taken: actionTaken,
        reviewed_by: context.reviewerLabel,
        reviewed_at: new Date().toISOString()
      });

      return json({
        complaints,
        actionTaken,
        actionResult
      });
    }

    if (action === 'delete') {
      const deleted = await deleteComplaintRows(context, filters);
      return json({ deleted });
    }

    return json({ message: 'Unsupported complaint action.' }, 400);
  } catch (error) {
    return json({ message: error?.message || 'Admin complaint request failed.' }, error?.status || 500);
  }
}
