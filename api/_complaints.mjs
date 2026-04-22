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

const COMPLAINT_META_SUFFIX_PATTERN = /\[\[BC_META:([\s\S]+?)\]\]\s*$/;

function normalizeComplaintToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

export function sanitizeComplaintProofAttachment(value) {
  if (!value || typeof value !== 'object') return null;

  const name = normalizeText(value.name);
  const type = normalizeText(value.type).toLowerCase();
  const dataUrl = normalizeText(value.dataUrl || value.data_url);
  const size = Number(value.size || 0);

  if (!name && !dataUrl) return null;

  return {
    name,
    type,
    size: Number.isFinite(size) && size > 0 ? size : 0,
    dataUrl
  };
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

  const proofAttachment = sanitizeComplaintProofAttachment(meta.proofAttachment);

  return {
    ...item,
    rawMessage,
    displayMessage,
    normalizedStatus: normalizeComplaintStatus(item?.status),
    reason: normalizeComplaintReason(meta.reason, 'Other'),
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
    proofAttachment
  };
}
