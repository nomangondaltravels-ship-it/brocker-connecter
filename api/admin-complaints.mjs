import {
  getBearerToken,
  json,
  normalizeText,
  requiredEnv,
  supabaseDelete,
  supabasePatch,
  supabaseSelect,
  verifyToken
} from '../server/_broker-platform.mjs';
import {
  buildComplaintReporterSignal,
  getComplaintModerationDecision,
  getComplaintRepeatOffenseLevel,
  getComplaintReportedBrokerKey,
  getComplaintReporterKey,
  normalizeComplaintAction,
  normalizeComplaintStatus,
  parseComplaintRecord,
  isComplaintValidForOffense
} from '../server/_complaints.mjs';
import {
  buildComplaintStatusNotification,
  buildModerationNotification,
  insertComplaintNotifications
} from '../server/_complaint-notifications.mjs';

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

function requireAdminNote(value) {
  const adminNote = normalizeText(value);
  if (!adminNote) {
    const error = new Error('Admin note is required for complaint review actions.');
    error.status = 400;
    throw error;
  }
  return adminNote;
}

function normalizeComplaintRows(rows = []) {
  const parsed = (Array.isArray(rows) ? rows : []).map(parseComplaintRecord);

  return parsed.map(item => {
    const brokerKey = getComplaintReportedBrokerKey(item);
    const reporterKey = getComplaintReporterKey(item);
    const repeatOffenseCount = brokerKey
      ? parsed.filter(candidate =>
        getComplaintReportedBrokerKey(candidate) === brokerKey
        && isComplaintValidForOffense(candidate.normalizedStatus)
      ).length
      : 0;
    const moderation = getComplaintModerationDecision({
      complaint: item,
      records: parsed,
      currentComplaintId: item.id
    });
    const reporterSignal = buildComplaintReporterSignal(parsed, reporterKey, item.id);
    return {
      ...item,
      repeat_offense_count: repeatOffenseCount,
      repeatOffenseCount,
      suggested_action: moderation.recommendedAction || getComplaintRepeatOffenseLevel(repeatOffenseCount),
      suggestedAction: moderation.recommendedAction || getComplaintRepeatOffenseLevel(repeatOffenseCount),
      resolved_valid_complaint_count: moderation.resolvedValidCount,
      resolvedValidComplaintCount: moderation.resolvedValidCount,
      next_valid_complaint_count: moderation.nextValidCount,
      nextValidComplaintCount: moderation.nextValidCount,
      serious_reason: moderation.seriousReason,
      seriousReason: moderation.seriousReason,
      serious_reason_label: moderation.seriousReasonLabel,
      seriousReasonLabel: moderation.seriousReasonLabel,
      moderation_override_applied: moderation.overrideApplied,
      moderationOverrideApplied: moderation.overrideApplied,
      reporter_recent_complaint_count: reporterSignal.recentComplaintCount,
      reporterRecentComplaintCount: reporterSignal.recentComplaintCount,
      reporter_rejected_complaint_count: reporterSignal.rejectedComplaintCount,
      reporterRejectedComplaintCount: reporterSignal.rejectedComplaintCount,
      reporter_distinct_target_count: reporterSignal.distinctTargetCount,
      reporterDistinctTargetCount: reporterSignal.distinctTargetCount,
      reporter_soft_flag: reporterSignal.softFlag || Boolean(item.reporterSoftFlag),
      reporterSoftFlag: reporterSignal.softFlag || Boolean(item.reporterSoftFlag),
      reporter_flag_reason: reporterSignal.summary || item.reporterSignalSummary || '',
      reporterFlagReason: reporterSignal.summary || item.reporterSignalSummary || ''
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

async function dispatchComplaintNotifications(context, complaint, { status = '', actionTaken = '' } = {}) {
  const notifications = [];
  const reporterId = normalizeText(complaint.reporterId || complaint.reporterBrokerId || complaint.reporterUserId || complaint.reporter_id);
  const affectedBrokerId = normalizeText(
    complaint.reportedBrokerId
    || complaint.reportedUserId
    || complaint.reported_broker_id
    || complaint.reported_user_id
  );
  const complaintId = complaint.id;
  const normalizedStatus = normalizeComplaintStatus(status, '');
  const normalizedAction = normalizeComplaintAction(actionTaken, '');

  if (reporterId && normalizedStatus) {
    notifications.push(buildComplaintStatusNotification({
      reporterId,
      complaintId,
      status: normalizedStatus
    }));
  }

  if (affectedBrokerId && normalizedAction && normalizedAction !== 'none') {
    const relatedSourceType = normalizedAction === 'delete_listing'
      ? 'listing'
      : normalizedAction === 'delete_requirement'
        ? 'requirement'
        : 'complaint';
    const relatedSourceId = normalizedAction === 'delete_listing'
      ? (complaint.listingId || complaint.listing_id || complaintId)
      : normalizedAction === 'delete_requirement'
        ? (complaint.requirementId || complaint.requirement_id || complaintId)
        : complaintId;
    notifications.push(buildModerationNotification({
      brokerId: affectedBrokerId,
      complaintId,
      actionTaken: normalizedAction,
      relatedSourceType,
      relatedSourceId
    }));
  }

  if (!notifications.length) return;

  await insertComplaintNotifications({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    notifications
  });
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
      const adminNote = requireAdminNote(body?.adminNote);
      const complaints = await patchComplaint(context, filters, {
        status,
        admin_note: adminNote,
        reviewed_by: context.reviewerLabel,
        reviewed_at: new Date().toISOString()
      });
      await dispatchComplaintNotifications(context, complaints[0] || await fetchComplaintByFilters(context, filters), {
        status
      });
      return json({ complaints });
    }

    if (action === 'take-action') {
      const actionTaken = normalizeComplaintAction(body?.actionTaken, '');
      if (!actionTaken) {
        return json({ message: 'Complaint action is required.' }, 400);
      }
      const adminNote = requireAdminNote(body?.adminNote);

      const complaint = await fetchComplaintByFilters(context, filters);
      if (!complaint) {
        return json({ message: 'Complaint not found.' }, 404);
      }

      const moderation = getComplaintModerationDecision({
        complaint,
        records: await fetchComplaintRows(context),
        currentComplaintId: complaint.id,
        overrideAction: actionTaken
      });
      const finalActionTaken = moderation.finalAction || actionTaken;
      const actionResult = await applyComplaintAction(context, complaint, finalActionTaken);
      const nextStatus = normalizeComplaintStatus(
        body?.status,
        finalActionTaken === 'none' ? complaint.normalizedStatus || 'under-review' : 'resolved'
      );

      const complaints = await patchComplaint(context, { id: complaint.id }, {
        status: nextStatus,
        admin_note: adminNote,
        action_taken: finalActionTaken,
        reviewed_by: context.reviewerLabel,
        reviewed_at: new Date().toISOString()
      });
      await dispatchComplaintNotifications(context, complaints[0] || complaint, {
        status: nextStatus,
        actionTaken: finalActionTaken
      });

      return json({
        complaints,
        actionTaken: finalActionTaken,
        recommendedAction: moderation.recommendedAction,
        overrideApplied: moderation.overrideApplied,
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
