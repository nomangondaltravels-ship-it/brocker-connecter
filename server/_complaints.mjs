import { normalizeEmail, normalizeText } from './_broker-platform.mjs';

export const COMPLAINT_STATUSES = Object.freeze([
  'new',
  'under-review',
  'resolved',
  'rejected'
]);

export const COMPLAINT_REASONS = Object.freeze([
  'Spam',
  'Fake Listing',
  'Wrong Information',
  'Duplicate Content',
  'Misleading Price',
  'Abuse / Misconduct',
  'Harassment',
  'Fraud / Scam',
  'Other'
]);

export const COMPLAINT_TARGET_TYPES = Object.freeze([
  'listing',
  'requirement',
  'broker'
]);

export const COMPLAINT_ACTIONS = Object.freeze([
  'none',
  'warning',
  'restrict',
  'block',
  'delete_listing',
  'delete_requirement'
]);

const VALID_REPEAT_OFFENSE_STATUSES = new Set(['new', 'under-review', 'resolved']);
const RESOLVED_VALID_COMPLAINT_STATUSES = new Set(['resolved']);
const COMPLAINT_META_SUFFIX_PATTERN = /\[\[BC_META:([\s\S]+?)\]\]\s*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const COMPLAINT_MODERATION_RULES = Object.freeze({
  firstValidMinorAction: 'warning',
  repeatValidAction: 'restrict',
  repeatedAbuseAction: 'block',
  repeatValidThresholdStart: 2,
  repeatValidThresholdEnd: 3,
  repeatedAbuseThreshold: 4,
  seriousReasons: Object.freeze([
    'Fraud / Scam',
    'Harassment'
  ])
});

export const COMPLAINT_SAFETY_RULES = Object.freeze({
  duplicateWindowMs: 15 * 60 * 1000,
  rateLimitWindowMs: 60 * 60 * 1000,
  maxComplaintsPerRateWindow: 6,
  suspiciousWindowMs: 24 * 60 * 60 * 1000,
  suspiciousRecentComplaintThreshold: 5,
  suspiciousDistinctTargetThreshold: 4,
  suspiciousRejectedComplaintThreshold: 3
});

function normalizeComplaintToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeComplaintNumericId(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue || !/^\d+$/.test(rawValue)) return null;
  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeComplaintStatus(value, fallback = 'new') {
  const normalized = normalizeComplaintToken(value).replace(/\s+/g, '-');
  if (normalized === 'pending') return 'new';
  return COMPLAINT_STATUSES.includes(normalized) ? normalized : fallback;
}

export function normalizeComplaintReason(value, fallback = '') {
  const normalized = normalizeComplaintToken(value);
  const matched = COMPLAINT_REASONS.find(option => normalizeComplaintToken(option) === normalized);
  return matched || fallback;
}

export function normalizeComplaintTargetType(value, fallback = '') {
  const normalized = normalizeComplaintToken(value);
  return COMPLAINT_TARGET_TYPES.includes(normalized) ? normalized : fallback;
}

export function normalizeComplaintAction(value, fallback = 'none') {
  const normalized = normalizeComplaintToken(value).replace(/\s+/g, '_');
  return COMPLAINT_ACTIONS.includes(normalized) ? normalized : fallback;
}

export function sanitizeComplaintText(value, maxLength = 0) {
  const sanitized = normalizeText(value)
    .replace(CONTROL_CHARACTER_PATTERN, '')
    .replace(/\r\n/g, '\n');
  if (maxLength && sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength);
  }
  return sanitized;
}

export function sanitizeComplaintProofAttachment(value) {
  if (!value || typeof value !== 'object') return null;

  const name = sanitizeComplaintText(value.name)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 160);
  const type = normalizeText(value.type).toLowerCase();
  const dataUrl = sanitizeComplaintText(value.dataUrl || value.data_url || value.proofUrl || value.proof_url);
  const size = Number(value.size || 0);

  if (!name && !dataUrl) return null;

  return {
    name,
    type,
    size: Number.isFinite(size) && size > 0 ? size : 0,
    dataUrl
  };
}

function normalizeComplaintProofUrl(value, metaProofAttachment) {
  const rawUrl = normalizeText(value);
  if (rawUrl) return rawUrl;
  return normalizeText(metaProofAttachment?.dataUrl);
}

export function serializeComplaintMeta(meta = {}) {
  // Keep complaint metadata in a structured suffix so the existing complaints
  // table and admin review flow can be extended without breaking old rows.
  const payload = {
    reason: normalizeComplaintReason(meta.reason),
    reporterBrokerId: normalizeText(meta.reporterBrokerId),
    reporterUserId: normalizeText(meta.reporterUserId),
    reporterEmail: normalizeEmail(meta.reporterEmail),
    reporterName: normalizeText(meta.reporterName),
    reporterSoftFlag: Boolean(meta.reporterSoftFlag),
    reporterSignalSummary: sanitizeComplaintText(meta.reporterSignalSummary, 280),
    reportedUserId: normalizeText(meta.reportedUserId),
    reportedBrokerIdNumber: normalizeText(meta.reportedBrokerIdNumber),
    reportedBrokerName: normalizeText(meta.reportedBrokerName),
    targetType: normalizeComplaintTargetType(meta.targetType),
    targetId: normalizeText(meta.targetId),
    targetLabel: normalizeText(meta.targetLabel),
    sourceSection: normalizeText(meta.sourceSection),
    proofAttachment: sanitizeComplaintProofAttachment(meta.proofAttachment)
  };

  return encodeURIComponent(JSON.stringify(payload));
}

export function buildComplaintMessage(description, meta = {}) {
  const body = sanitizeComplaintText(description);
  const encodedMeta = serializeComplaintMeta(meta);
  return body ? `${body}\n\n[[BC_META:${encodedMeta}]]` : `[[BC_META:${encodedMeta}]]`;
}

export function isComplaintValidForOffense(status) {
  return VALID_REPEAT_OFFENSE_STATUSES.has(normalizeComplaintStatus(status));
}

export function isResolvedValidComplaint(status) {
  return RESOLVED_VALID_COMPLAINT_STATUSES.has(normalizeComplaintStatus(status));
}

export function isComplaintSeriousReason(reason) {
  const normalizedReason = normalizeComplaintReason(reason, '');
  return COMPLAINT_MODERATION_RULES.seriousReasons.includes(normalizedReason);
}

export function countResolvedValidComplaints(records = [], brokerKey = '', currentComplaintId = '') {
  const normalizedBrokerKey = normalizeText(brokerKey);
  const excludedComplaintId = normalizeText(currentComplaintId);
  if (!normalizedBrokerKey) return 0;

  return (Array.isArray(records) ? records : []).reduce((count, item) => {
    if (!item) return count;
    const itemComplaintId = normalizeText(item?.id);
    if (excludedComplaintId && itemComplaintId === excludedComplaintId) return count;
    if (getComplaintReportedBrokerKey(item) !== normalizedBrokerKey) return count;
    return isResolvedValidComplaint(item?.normalizedStatus || item?.status) ? count + 1 : count;
  }, 0);
}

export function getComplaintModerationDecision({
  complaint = {},
  records = [],
  overrideAction = '',
  currentComplaintId = ''
} = {}) {
  const normalizedOverride = normalizeComplaintAction(overrideAction, '');
  const brokerKey = getComplaintReportedBrokerKey(complaint);
  const resolvedValidCount = countResolvedValidComplaints(records, brokerKey, currentComplaintId || complaint?.id);
  const nextValidCount = brokerKey ? resolvedValidCount + 1 : resolvedValidCount;
  const seriousReason = isComplaintSeriousReason(complaint?.reason);

  let recommendedAction = 'none';
  if (seriousReason) {
    recommendedAction = COMPLAINT_MODERATION_RULES.repeatedAbuseAction;
  } else if (nextValidCount >= COMPLAINT_MODERATION_RULES.repeatedAbuseThreshold) {
    recommendedAction = COMPLAINT_MODERATION_RULES.repeatedAbuseAction;
  } else if (
    nextValidCount >= COMPLAINT_MODERATION_RULES.repeatValidThresholdStart
    && nextValidCount <= COMPLAINT_MODERATION_RULES.repeatValidThresholdEnd
  ) {
    recommendedAction = COMPLAINT_MODERATION_RULES.repeatValidAction;
  } else if (nextValidCount >= 1) {
    recommendedAction = COMPLAINT_MODERATION_RULES.firstValidMinorAction;
  }

  const finalAction = normalizedOverride || recommendedAction;

  return {
    brokerKey,
    seriousReason,
    seriousReasonLabel: seriousReason ? normalizeComplaintReason(complaint?.reason, '') : '',
    resolvedValidCount,
    nextValidCount,
    recommendedAction,
    finalAction,
    overrideApplied: Boolean(normalizedOverride && normalizedOverride !== recommendedAction)
  };
}

export function getComplaintRepeatOffenseLevel(count) {
  const numericCount = Number(count || 0);
  if (numericCount >= COMPLAINT_MODERATION_RULES.repeatedAbuseThreshold) return 'block';
  if (numericCount >= COMPLAINT_MODERATION_RULES.repeatValidThresholdStart) return 'restrict';
  if (numericCount >= 1) return 'warning';
  return 'none';
}

export function getComplaintReportedBrokerKey(item) {
  return (
    normalizeText(item?.reported_broker_id)
    || normalizeText(item?.reportedBrokerId)
    || normalizeText(item?.reported_user_id)
    || normalizeText(item?.reportedUserId)
    || normalizeText(item?.reported_broker_id_number)
    || normalizeText(item?.reportedBrokerIdNumber)
  );
}

export function getComplaintReporterKey(item) {
  return (
    normalizeText(item?.reporter_id)
    || normalizeText(item?.reporterId)
    || normalizeText(item?.reporter_broker_id)
    || normalizeText(item?.reporterBrokerId)
    || normalizeText(item?.reporter_user_id)
    || normalizeText(item?.reporterUserId)
    || normalizeEmail(item?.reporter_email)
    || normalizeEmail(item?.reporterEmail)
  );
}

export function getComplaintTargetKey(item) {
  return [
    normalizeComplaintTargetType(item?.target_type || item?.targetType),
    normalizeText(item?.target_id || item?.targetId || item?.listing_id || item?.listingId || item?.requirement_id || item?.requirementId)
  ].filter(Boolean).join(':');
}

export function buildComplaintReporterSignal(records = [], reporterKey = '', currentComplaintId = '') {
  const normalizedReporterKey = normalizeText(reporterKey);
  const excludedComplaintId = normalizeText(currentComplaintId);
  if (!normalizedReporterKey) {
    return {
      reporterKey: '',
      recentComplaintCount: 0,
      rejectedComplaintCount: 0,
      distinctTargetCount: 0,
      softFlag: false,
      reasons: [],
      summary: ''
    };
  }

  const now = Date.now();
  const recentRecords = [];
  let rejectedComplaintCount = 0;
  const distinctTargets = new Set();

  (Array.isArray(records) ? records : []).forEach(item => {
    if (!item) return;
    if (getComplaintReporterKey(item) !== normalizedReporterKey) return;
    const itemComplaintId = normalizeText(item?.id);
    if (excludedComplaintId && itemComplaintId === excludedComplaintId) return;

    const createdAt = Date.parse(String(item?.created_at || item?.createdAt || ''));
    const targetKey = getComplaintTargetKey(item);
    if (targetKey) distinctTargets.add(targetKey);
    if ((item?.normalizedStatus || item?.status) && normalizeComplaintStatus(item?.normalizedStatus || item?.status) === 'rejected') {
      rejectedComplaintCount += 1;
    }
    if (Number.isFinite(createdAt) && (now - createdAt) <= COMPLAINT_SAFETY_RULES.suspiciousWindowMs) {
      recentRecords.push(item);
    }
  });

  const reasons = [];
  if (recentRecords.length >= COMPLAINT_SAFETY_RULES.suspiciousRecentComplaintThreshold) {
    reasons.push(`${recentRecords.length} complaints in the last 24 hours`);
  }
  if (distinctTargets.size >= COMPLAINT_SAFETY_RULES.suspiciousDistinctTargetThreshold) {
    reasons.push(`${distinctTargets.size} unique targets reported`);
  }
  if (rejectedComplaintCount >= COMPLAINT_SAFETY_RULES.suspiciousRejectedComplaintThreshold) {
    reasons.push(`${rejectedComplaintCount} rejected complaints on record`);
  }

  return {
    reporterKey: normalizedReporterKey,
    recentComplaintCount: recentRecords.length,
    rejectedComplaintCount,
    distinctTargetCount: distinctTargets.size,
    softFlag: reasons.length > 0,
    reasons,
    summary: reasons.join(' - ')
  };
}

export function parseComplaintRecord(item) {
  const rawMessage = String(item?.message || '');
  const match = rawMessage.match(COMPLAINT_META_SUFFIX_PATTERN);
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

  const metaProofAttachment = sanitizeComplaintProofAttachment(meta.proofAttachment);
  const proofUrl = normalizeComplaintProofUrl(item?.proof_url, metaProofAttachment);
  const proofAttachment = proofUrl
    ? {
        name: normalizeText(item?.proof_name) || metaProofAttachment?.name,
        type: normalizeText(item?.proof_type).toLowerCase() || metaProofAttachment?.type || '',
        size: Number(item?.proof_size || metaProofAttachment?.size || 0) || 0,
        dataUrl: proofUrl
      }
    : metaProofAttachment;

  const normalizedStatus = normalizeComplaintStatus(item?.status);
  const normalizedAction = normalizeComplaintAction(item?.action_taken);
  const targetType = normalizeComplaintTargetType(item?.target_type || meta.targetType);
  const listingId = normalizeComplaintNumericId(item?.listing_id);
  const requirementId = normalizeComplaintNumericId(item?.requirement_id);
  const targetId = normalizeText(
    item?.target_id
    || meta.targetId
    || (targetType === 'listing' ? listingId : targetType === 'requirement' ? requirementId : '')
  );

  return {
    ...item,
    rawMessage,
    displayMessage: normalizeText(item?.description) || displayMessage,
    description: normalizeText(item?.description) || displayMessage,
    normalizedStatus,
    normalizedAction,
    reason: normalizeComplaintReason(item?.reason || meta.reason, 'Other'),
    reporterId: normalizeText(item?.reporter_id || meta.reporterBrokerId || meta.reporterUserId),
    reporterBrokerId: normalizeText(item?.reporter_id || meta.reporterBrokerId || meta.reporterUserId),
    reporterUserId: normalizeText(item?.reporter_id || meta.reporterUserId || meta.reporterBrokerId),
    reporterEmail: normalizeEmail(item?.reporter_email || meta.reporterEmail),
    reporterName: normalizeText(item?.reporter_name || meta.reporterName || item?.name),
    reporterSoftFlag: Boolean(item?.reporter_soft_flag || meta.reporterSoftFlag),
    reporterSignalSummary: sanitizeComplaintText(item?.reporter_signal_summary || meta.reporterSignalSummary, 280),
    reportedBrokerId: normalizeText(item?.reported_broker_id || item?.reported_user_id || meta.reportedUserId),
    reportedUserId: normalizeText(item?.reported_user_id || meta.reportedUserId),
    reportedBrokerIdNumber: normalizeText(item?.reported_broker_id_number || meta.reportedBrokerIdNumber),
    reportedBrokerName: normalizeText(item?.reported_broker_name || meta.reportedBrokerName || item?.broker),
    targetType,
    targetId,
    targetLabel: normalizeText(item?.target_label || meta.targetLabel),
    listingId,
    requirementId,
    sourceSection: normalizeText(item?.source_section || meta.sourceSection),
    proofUrl,
    proofAttachment,
    adminNote: normalizeText(item?.admin_note),
    actionTaken: normalizedAction,
    reviewedBy: normalizeText(item?.reviewed_by),
    reviewedAt: normalizeText(item?.reviewed_at),
    repeatOffenseCount: Number(item?.repeat_offense_count || 0) || 0,
    repeatOffenseLevel: normalizeComplaintAction(item?.repeat_offense_level, getComplaintRepeatOffenseLevel(item?.repeat_offense_count)),
    suggestedAction: normalizeComplaintAction(item?.suggested_action, getComplaintRepeatOffenseLevel(item?.repeat_offense_count))
  };
}
