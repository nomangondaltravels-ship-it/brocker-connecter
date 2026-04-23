import { normalizeText, supabaseInsert } from './_broker-platform.mjs';

function nowIso() {
  return new Date().toISOString();
}

function createComplaintNotificationRow({
  brokerId,
  complaintId,
  type,
  title,
  message,
  relatedSourceType = 'complaint',
  relatedSourceId = null,
  suffix = ''
}) {
  const normalizedBrokerId = normalizeText(brokerId);
  if (!normalizedBrokerId) return null;

  return {
    broker_uuid: normalizedBrokerId,
    notification_type: normalizeText(type) || 'complaint',
    title: normalizeText(title) || 'Complaint update',
    message: normalizeText(message) || 'Complaint status updated.',
    related_source_type: normalizeText(relatedSourceType) || 'complaint',
    related_source_id: relatedSourceId ?? complaintId ?? null,
    status: 'unread',
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

export async function insertComplaintNotifications({
  supabaseUrl,
  serviceRoleKey,
  notifications = []
}) {
  const payload = (Array.isArray(notifications) ? notifications : []).filter(Boolean);
  if (!payload.length) return [];

  try {
    return await supabaseInsert({
      supabaseUrl,
      serviceRoleKey,
      table: 'broker_notifications',
      payload
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('relation') || message.includes('does not exist') || message.includes('broker_notifications')) {
      return [];
    }
    throw error;
  }
}

export function buildComplaintSubmittedNotification({ reporterId, complaintId, targetType }) {
  return createComplaintNotificationRow({
    brokerId: reporterId,
    complaintId,
    type: 'complaint',
    title: 'Complaint submitted',
    message: `Your ${normalizeText(targetType) || 'complaint'} complaint was submitted successfully and is now waiting for admin review.`,
    relatedSourceType: 'complaint',
    relatedSourceId: complaintId,
    suffix: 'submitted'
  });
}

export function buildComplaintStatusNotification({ reporterId, complaintId, status }) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const titleMap = {
    'under-review': 'Complaint under review',
    resolved: 'Complaint resolved',
    rejected: 'Complaint rejected',
    new: 'Complaint submitted'
  };
  const messageMap = {
    'under-review': 'Your complaint is now under review by the admin team.',
    resolved: 'Your complaint was resolved after admin review.',
    rejected: 'Your complaint was reviewed and marked as rejected.',
    new: 'Your complaint is now logged in the admin review queue.'
  };

  return createComplaintNotificationRow({
    brokerId: reporterId,
    complaintId,
    type: 'complaint',
    title: titleMap[normalizedStatus] || 'Complaint updated',
    message: messageMap[normalizedStatus] || 'Your complaint received a new admin update.',
    relatedSourceType: 'complaint',
    relatedSourceId: complaintId,
    suffix: normalizedStatus || 'status'
  });
}

export function buildModerationNotification({ brokerId, complaintId, actionTaken, relatedSourceType = '', relatedSourceId = null }) {
  const normalizedAction = normalizeText(actionTaken).toLowerCase();
  const titleMap = {
    warning: 'Warning issued',
    restrict: 'Restriction applied',
    block: 'Account blocked',
    delete_listing: 'Listing removed',
    delete_requirement: 'Requirement removed'
  };
  const messageMap = {
    warning: 'An admin warning was issued on your account after complaint review.',
    restrict: 'Your public Broker Connector visibility was restricted after complaint review.',
    block: 'Your broker account was blocked after complaint review.',
    delete_listing: 'One of your listings was removed after complaint review.',
    delete_requirement: 'One of your requirements was removed after complaint review.'
  };

  return createComplaintNotificationRow({
    brokerId,
    complaintId,
    type: 'moderation',
    title: titleMap[normalizedAction] || 'Moderation action applied',
    message: messageMap[normalizedAction] || 'An admin moderation action was applied to your account.',
    relatedSourceType: normalizeText(relatedSourceType) || (
      normalizedAction.includes('requirement')
        ? 'requirement'
        : normalizedAction.includes('listing')
          ? 'listing'
          : 'complaint'
    ),
    relatedSourceId: relatedSourceId ?? complaintId,
    suffix: normalizedAction || 'moderation'
  });
}
