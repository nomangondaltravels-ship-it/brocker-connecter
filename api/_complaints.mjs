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
const COMPLAINT_META_SUFFIX_PATTERN = /\[\[BC_META:([\s\S]+?)\]\]\s*$/;

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

export function sanitizeComplaintProofAttachment(value) {
  if (!value || typeof value !== 'object') return null;

  const name = normalizeText(value.name);
  const type = normalizeText(value.type).toLowerCase();
  const dataUrl = normalizeText(value.dataUrl || value.data_url || value.proofUrl || value.proof_url);
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
  const body = normalizeText(description);
  const encodedMeta = serializeComplaintMeta(meta);
  return body ? `${body}\n\n[[BC_META:${encodedMeta}]]` : `[[BC_META:${encodedMeta}]]`;
}

export function isComplaintValidForOffense(status) {
  return VALID_REPEAT_OFFENSE_STATUSES.has(normalizeComplaintStatus(status));
}

export function getComplaintRepeatOffenseLevel(count) {
  const numericCount = Number(count || 0);
  if (numericCount >= 5) return 'block';
  if (numericCount >= 3) return 'restrict';
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
