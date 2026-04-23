import {
  normalizeEmail,
  normalizeText
} from './_broker-platform.mjs';

export const SUPPORT_SUBJECT_OPTIONS = Object.freeze([
  'General Help',
  'Report Issue',
  'Complaint',
  'Account Problem'
]);

export const SUPPORT_STATUS_OPTIONS = Object.freeze([
  'new',
  'in_progress',
  'resolved'
]);

export function sanitizeSupportText(value, maxLength = 1000) {
  return normalizeText(value).slice(0, maxLength);
}

export function normalizeSupportSubject(value) {
  const rawValue = sanitizeSupportText(value, 120);
  return SUPPORT_SUBJECT_OPTIONS.includes(rawValue) ? rawValue : '';
}

export function normalizeSupportStatus(value, fallback = 'new') {
  const normalized = sanitizeSupportText(value, 40).toLowerCase();
  if (normalized === 'in progress') return 'in_progress';
  return SUPPORT_STATUS_OPTIONS.includes(normalized) ? normalized : fallback;
}

export function getSupportStatusLabel(value) {
  const normalized = normalizeSupportStatus(value, 'new');
  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'resolved') return 'Resolved';
  return 'New';
}

export function parseSupportRequestRecord(row = {}) {
  return {
    ...row,
    id: sanitizeSupportText(row.id, 120),
    requesterBrokerId: sanitizeSupportText(row.requester_broker_id || row.requesterBrokerId, 120),
    name: sanitizeSupportText(row.name, 180),
    email: normalizeEmail(row.email),
    subject: normalizeSupportSubject(row.subject),
    message: sanitizeSupportText(row.message, 5000),
    status: normalizeSupportStatus(row.status, 'new'),
    statusLabel: getSupportStatusLabel(row.status),
    created_at: sanitizeSupportText(row.created_at || row.createdAt, 120),
    updated_at: sanitizeSupportText(row.updated_at || row.updatedAt, 120)
  };
}
