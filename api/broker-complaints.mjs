import {
  json,
  normalizeEmail,
  normalizeText,
  requireBrokerSession,
  supabaseInsert,
  supabaseSelect
} from './_broker-platform.mjs';
import {
  buildComplaintMessage,
  COMPLAINT_REASONS,
  normalizeComplaintReason,
  normalizeComplaintTargetType,
  parseComplaintRecord,
  sanitizeComplaintProofAttachment
} from './_complaints.mjs';

const MAX_COMPLAINT_DESCRIPTION_LENGTH = 4000;
const MAX_PROOF_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]);

function getReporterIdentity(broker) {
  return {
    reporterBrokerId: normalizeText(broker?.id),
    reporterUserId: normalizeText(broker?.id),
    reporterEmail: normalizeEmail(broker?.email),
    reporterName: normalizeText(
      broker?.full_name
      || broker?.name
      || broker?.company_name
      || broker?.email
    )
  };
}

async function listBrokerComplaints(context) {
  const rows = await supabaseSelect({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    select: '*',
    order: { column: 'created_at', ascending: false }
  }).catch(() => []);

  const reporterIdentity = getReporterIdentity(context.broker);
  return (Array.isArray(rows) ? rows : [])
    .map(parseComplaintRecord)
    .filter(item =>
      item.reporterBrokerId === reporterIdentity.reporterBrokerId
      || item.reporterUserId === reporterIdentity.reporterUserId
      || (reporterIdentity.reporterEmail && item.reporterEmail === reporterIdentity.reporterEmail)
    );
}

function validateProofAttachment(value) {
  const proofAttachment = sanitizeComplaintProofAttachment(value);
  if (!proofAttachment) return null;

  if (!proofAttachment.name) {
    throw new Error('Proof file name is required.');
  }
  if (!proofAttachment.type || !ALLOWED_PROOF_TYPES.has(proofAttachment.type)) {
    throw new Error('Proof upload must be an image or PDF.');
  }
  if (!proofAttachment.dataUrl.startsWith(`data:${proofAttachment.type}`)) {
    throw new Error('Proof upload format is invalid.');
  }
  if (!proofAttachment.size || proofAttachment.size > MAX_PROOF_ATTACHMENT_BYTES) {
    throw new Error('Proof upload must be 2 MB or smaller.');
  }

  return proofAttachment;
}

function normalizeComplaintTargetLinks(targetType, targetId) {
  const rawTargetId = String(targetId ?? '').trim();
  const numericTargetId = /^\d+$/.test(rawTargetId) ? Number(rawTargetId) : null;
  return {
    listingId: targetType === 'listing' && Number.isSafeInteger(numericTargetId) ? numericTargetId : null,
    requirementId: targetType === 'requirement' && Number.isSafeInteger(numericTargetId) ? numericTargetId : null
  };
}

async function createComplaint(context, body) {
  const reporterIdentity = getReporterIdentity(context.broker);
  const reason = normalizeComplaintReason(body?.reason);
  const description = normalizeText(body?.description);
  const targetType = normalizeComplaintTargetType(body?.targetType);
  const targetId = normalizeText(body?.targetId);
  const reportedUserId = normalizeText(body?.reportedUserId);
  const reportedBrokerIdNumber = normalizeText(body?.reportedBrokerIdNumber);
  const reportedBrokerName = normalizeText(body?.reportedBrokerName);
  const targetLabel = normalizeText(body?.targetLabel);
  const sourceSection = normalizeText(body?.sourceSection);
  const proofAttachment = validateProofAttachment(body?.proofAttachment);
  const proofUrl = normalizeText(proofAttachment?.dataUrl);
  const { listingId, requirementId } = normalizeComplaintTargetLinks(targetType, targetId);
  const reportedBrokerId = reportedUserId;

  if (!reason || !COMPLAINT_REASONS.includes(reason)) {
    const error = new Error('Select a valid complaint reason.');
    error.status = 400;
    throw error;
  }
  if (!targetType) {
    const error = new Error('Complaint target type is required.');
    error.status = 400;
    throw error;
  }
  if (!targetId) {
    const error = new Error('Complaint target is missing.');
    error.status = 400;
    throw error;
  }
  if (description.length < 10) {
    const error = new Error('Add a brief complaint description.');
    error.status = 400;
    throw error;
  }
  if (description.length > MAX_COMPLAINT_DESCRIPTION_LENGTH) {
    const error = new Error('Complaint description is too long.');
    error.status = 400;
    throw error;
  }

  const insertPayload = {
    reporter_id: reporterIdentity.reporterBrokerId || null,
    reporter_email: reporterIdentity.reporterEmail || null,
    reporter_name: reporterIdentity.reporterName || null,
    reported_user_id: reportedUserId || null,
    reported_broker_id: reportedBrokerId || null,
    reported_broker_id_number: reportedBrokerIdNumber || null,
    reported_broker_name: reportedBrokerName || null,
    listing_id: listingId,
    requirement_id: requirementId,
    target_type: targetType,
    target_id: targetId,
    target_label: targetLabel || null,
    reason,
    description,
    proof_url: proofUrl || null,
    source_section: sourceSection || null,
    admin_note: null,
    action_taken: 'none',
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
    name: reporterIdentity.reporterName || 'Broker',
    broker: reportedBrokerIdNumber || reportedBrokerName || reportedUserId || targetType,
    message: buildComplaintMessage(description, {
      reason,
      ...reporterIdentity,
      reportedUserId,
      reportedBrokerIdNumber,
      reportedBrokerName,
      targetType,
      targetId,
      targetLabel,
      sourceSection,
      proofAttachment
    }),
    status: 'new'
  };

  const inserted = await supabaseInsert({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'complaints',
    payload: insertPayload
  });

  return (Array.isArray(inserted) ? inserted : [])
    .map(parseComplaintRecord);
}

export async function GET(request) {
  try {
    const context = await requireBrokerSession(request);
    const complaints = await listBrokerComplaints(context);
    return json({ complaints });
  } catch (error) {
    return json({ message: error?.message || 'Broker complaints could not be loaded.' }, error?.status || 500);
  }
}

export async function POST(request) {
  try {
    const context = await requireBrokerSession(request);
    const body = await request.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();

    if (!action || action === 'list') {
      const complaints = await listBrokerComplaints(context);
      return json({ complaints });
    }

    if (action === 'create') {
      const complaints = await createComplaint(context, body);
      return json({
        message: 'Complaint submitted successfully. Our admin team will review it.',
        complaints
      });
    }

    return json({ message: 'Unsupported complaint action.' }, 400);
  } catch (error) {
    return json({ message: error?.message || 'Complaint request failed.' }, error?.status || 500);
  }
}
