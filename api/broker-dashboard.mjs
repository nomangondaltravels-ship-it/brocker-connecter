import {
  buildLeadPublicSummary,
  buildPublicListingPayload,
  deriveBrokerActivity,
  getPropertyDimensionDbFields,
  getSupabasePublishableKey,
  isPropertyDimensionColumnError,
  json,
  normalizeBool,
  normalizeDecimalValue,
  normalizeEmail,
  normalizeLeadStatusValue,
  normalizeListingPurposeValue,
  normalizeListingStatusValue,
  normalizeLocationValue,
  normalizePhoneNumber,
  normalizePropertyTypeValue,
  normalizeSalePropertyStatusValue,
  normalizeSizeUnit,
  normalizeText,
  normalizeHandoverQuarterValue,
  normalizeHandoverYearValue,
  parseLeadMeta,
  parsePropertyMeta,
  requireBrokerSession,
  sanitizeAiMatch,
  sanitizeFollowUp,
  sanitizeLead,
  sanitizeNotification,
  sanitizeProperty,
  sanitizePublicListing,
  serializeLeadMeta,
  serializePropertyMeta,
  stripPropertyDimensionFields,
  supabaseAuthAdminGetUser,
  supabaseAuthGetUser,
  supabaseAuthAdminUpdateUser,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect
} from '../server/_broker-platform.mjs';
import {
  buildCreateSavedFilterPayload,
  buildUpdateSavedFilterPayload,
  sanitizeSavedFilterRecord
} from '../server/_saved-filters.mjs';

const LEAD_STATUS_OPTIONS = ['new', 'contacted', 'follow-up', 'meeting scheduled', 'negotiation', 'closed won', 'closed lost', 'inactive'];
const LISTING_STATUS_OPTIONS = ['available', 'reserved', 'rented', 'sold', 'off market', 'draft'];
const CLOSED_LEAD_STATUSES = new Set(['closed won', 'closed lost']);
const INACTIVE_LISTING_STATUSES = new Set(['rented', 'sold', 'off market']);
const ACTIVE_MATCH_LISTING_STATUSES = new Set(['available', 'reserved']);
const DUBAI_TIME_ZONE = 'Asia/Dubai';

function nowIso() {
  return new Date().toISOString();
}

function formatDateInDubai(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: DUBAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

function normalizeLeadStatus(value) {
  return normalizeLeadStatusValue(value, 'new');
}

function normalizeListingStatus(value) {
  return normalizeListingStatusValue(value, 'available');
}

function formatStatusLabel(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Status';
}

function normalizeDateValue(value, fallback = '') {
  return value === undefined ? normalizeText(fallback) : normalizeText(value);
}

function normalizeTimeValue(value, fallback = '') {
  return value === undefined ? normalizeText(fallback) : normalizeText(value);
}

function parseMoney(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function calculateDistressDiscountPercent(marketPrice, askingPrice) {
  const market = parseMoney(marketPrice);
  const asking = parseMoney(askingPrice);
  if (!market || !asking || asking >= market) return '';
  const discount = Math.round(((market - asking) / market) * 100);
  return discount > 0 ? String(discount) : '';
}

function normalizeMatchKey(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function createActivityEntry(text, type = 'system') {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    type,
    text: normalizeText(text),
    createdAt: nowIso()
  };
}

function prependActivityLog(existingLog, text, type = 'system') {
  const message = normalizeText(text);
  if (!message) return Array.isArray(existingLog) ? existingLog : [];
  return [createActivityEntry(message, type), ...(Array.isArray(existingLog) ? existingLog : [])].slice(0, 80);
}

async function safeSupabaseInsertWithPropertyDimensions(options) {
  try {
    return await supabaseInsert(options);
  } catch (error) {
    if (!isPropertyDimensionColumnError(error)) {
      throw error;
    }
    return supabaseInsert({
      ...options,
      payload: stripPropertyDimensionFields(options.payload)
    });
  }
}

async function safeSupabasePatchWithPropertyDimensions(options) {
  try {
    return await supabasePatch(options);
  } catch (error) {
    if (!isPropertyDimensionColumnError(error)) {
      throw error;
    }
    return supabasePatch({
      ...options,
      payload: stripPropertyDimensionFields(options.payload)
    });
  }
}

function buildFollowUpText(dateValue, timeValue, urgent) {
  if (!dateValue && !timeValue) return 'Follow-up details updated.';
  const suffix = urgent ? ' (Urgent)' : '';
  return `Follow-up set for ${[dateValue, timeValue].filter(Boolean).join(' ')}${suffix}.`;
}

function formatContactLog(method, owner = false) {
  const label = normalizeText(method) || 'Manual';
  return `${owner ? 'Owner' : 'Client'} contact logged via ${label}.`;
}

function getLeadMeta(body, existingLead = null, overrides = {}) {
  const existingMeta = parseLeadMeta(existingLead?.follow_up_notes);
  const clientPurpose = normalizeText(body?.clientPurpose || body?.purpose || existingLead?.purpose).toLowerCase() === 'rent' ? 'rent' : 'buy';
  return {
    preferredBuildingProject: body?.preferredBuildingProject !== undefined
      ? normalizeText(body?.preferredBuildingProject)
      : existingMeta.preferredBuildingProject,
    paymentMethod: clientPurpose === 'buy'
      ? (body?.paymentMethod !== undefined ? normalizeText(body?.paymentMethod) : existingMeta.paymentMethod)
      : '',
    legacyFollowUpNotes: body?.legacyFollowUpNotes !== undefined
      ? normalizeText(body?.legacyFollowUpNotes)
      : existingMeta.legacyFollowUpNotes,
    nextFollowUpDate: normalizeDateValue(body?.nextFollowUpDate, existingMeta.nextFollowUpDate),
    nextFollowUpTime: normalizeTimeValue(body?.nextFollowUpTime, existingMeta.nextFollowUpTime),
    followUpNote: body?.followUpNote !== undefined ? normalizeText(body?.followUpNote) : existingMeta.followUpNote,
    isUrgentFollowUp: body?.isUrgentFollowUp !== undefined ? normalizeBool(body?.isUrgentFollowUp) : Boolean(existingMeta.isUrgentFollowUp),
    callCount: overrides.callCount ?? existingMeta.callCount,
    whatsappCount: overrides.whatsappCount ?? existingMeta.whatsappCount,
    lastContactedAt: overrides.lastContactedAt ?? existingMeta.lastContactedAt,
    lastContactMethod: overrides.lastContactMethod ?? existingMeta.lastContactMethod,
    isArchived: overrides.isArchived ?? existingMeta.isArchived,
    archivedAt: overrides.archivedAt ?? existingMeta.archivedAt,
    activityLog: Array.isArray(overrides.activityLog) ? overrides.activityLog : existingMeta.activityLog
  };
}

function getPropertyMeta(body, existingProperty = null, overrides = {}) {
  const existingMeta = parsePropertyMeta(existingProperty?.description);
  const purpose = normalizeText(body?.purpose || existingProperty?.purpose).toLowerCase() === 'rent' ? 'rent' : 'sale';
  const salePropertyStatus = purpose === 'sale'
    ? normalizeSalePropertyStatusValue(
      body?.salePropertyStatus !== undefined
        ? body?.salePropertyStatus
        : existingProperty?.sale_property_status || existingMeta.salePropertyStatus || 'Ready Property'
    ) || 'Ready Property'
    : '';
  const handoverQuarter = purpose === 'sale' && salePropertyStatus === 'Off Plan Property'
    ? normalizeHandoverQuarterValue(
      body?.handoverQuarter !== undefined
        ? body?.handoverQuarter
        : existingProperty?.handover_quarter || existingMeta.handoverQuarter
    )
    : '';
  const handoverYear = purpose === 'sale' && salePropertyStatus === 'Off Plan Property'
    ? normalizeHandoverYearValue(
      body?.handoverYear !== undefined
        ? body?.handoverYear
        : existingProperty?.handover_year || existingMeta.handoverYear
    )
    : '';
  const distressDeal = body?.isDistress !== undefined ? normalizeBool(body?.isDistress) : Boolean(existingProperty?.is_distress);
  const distressAskingPrice = distressDeal
    ? (body?.distressAskingPrice !== undefined
        ? normalizeText(body?.distressAskingPrice)
        : existingMeta.distressAskingPrice)
    : '';
  const marketPrice = distressDeal
    ? (
        body?.marketPrice !== undefined
          ? normalizeText(body?.marketPrice)
          : normalizeText(existingProperty?.market_price || existingMeta.marketPrice)
      )
    : '';
  const distressDiscountPercent = distressDeal
    ? calculateDistressDiscountPercent(marketPrice, distressAskingPrice || body?.rentPrice || body?.ownerAskingPrice)
    : '';
  return {
    buildingName: body?.buildingName !== undefined ? normalizeText(body?.buildingName) : existingMeta.buildingName,
    floorLevel: body?.floorLevel !== undefined ? normalizeText(body?.floorLevel) : existingMeta.floorLevel,
    sizeUnit: body?.sizeUnit !== undefined ? normalizeSizeUnit(body?.sizeUnit) : existingMeta.sizeUnit,
    furnishing: purpose === 'rent'
      ? (body?.furnishing !== undefined ? normalizeText(body?.furnishing) : existingMeta.furnishing)
      : '',
    cheques: purpose === 'rent'
      ? (body?.cheques !== undefined ? normalizeText(body?.cheques) : existingMeta.cheques)
      : '',
    chiller: purpose === 'rent'
      ? (body?.chiller !== undefined ? normalizeText(body?.chiller) : existingMeta.chiller)
      : '',
    mortgageStatus: purpose === 'sale'
      ? (body?.mortgageStatus !== undefined ? normalizeText(body?.mortgageStatus) : existingMeta.mortgageStatus)
      : '',
    leasehold: purpose === 'sale'
      ? (body?.leasehold !== undefined ? normalizeBool(body?.leasehold) : Boolean(existingMeta.leasehold))
      : false,
    salePropertyStatus,
    handoverQuarter,
    handoverYear,
    marketPrice,
    distressAskingPrice,
    distressDiscountPercent,
    listingImages: body?.listingImages !== undefined ? parsePropertyMeta(serializePropertyMeta({ listingImages: body?.listingImages })).listingImages : existingMeta.listingImages,
    legacyDescription: body?.legacyDescription !== undefined ? normalizeText(body?.legacyDescription) : existingMeta.legacyDescription,
    nextFollowUpDate: normalizeDateValue(body?.nextFollowUpDate, existingMeta.nextFollowUpDate),
    nextFollowUpTime: normalizeTimeValue(body?.nextFollowUpTime, existingMeta.nextFollowUpTime),
    followUpNote: body?.followUpNote !== undefined ? normalizeText(body?.followUpNote) : existingMeta.followUpNote,
    isUrgentFollowUp: body?.isUrgentFollowUp !== undefined ? normalizeBool(body?.isUrgentFollowUp) : Boolean(existingMeta.isUrgentFollowUp),
    ownerCallCount: overrides.ownerCallCount ?? existingMeta.ownerCallCount,
    ownerWhatsappCount: overrides.ownerWhatsappCount ?? existingMeta.ownerWhatsappCount,
    lastOwnerContactedAt: overrides.lastOwnerContactedAt ?? existingMeta.lastOwnerContactedAt,
    lastOwnerContactMethod: overrides.lastOwnerContactMethod ?? existingMeta.lastOwnerContactMethod,
    isArchived: overrides.isArchived ?? existingMeta.isArchived,
    archivedAt: overrides.archivedAt ?? existingMeta.archivedAt,
    activityLog: Array.isArray(overrides.activityLog) ? overrides.activityLog : existingMeta.activityLog
  };
}

function buildLeadActivityLog(existingLead, body, extraEntries = []) {
  const existingMeta = parseLeadMeta(existingLead?.follow_up_notes);
  let activityLog = Array.isArray(existingMeta.activityLog) ? existingMeta.activityLog : [];
  const nextStatus = body?.status !== undefined ? normalizeLeadStatus(body?.status) : normalizeLeadStatus(existingLead?.status);
  if (nextStatus !== normalizeLeadStatus(existingLead?.status)) {
    activityLog = prependActivityLog(activityLog, `Status changed from ${formatStatusLabel(existingLead?.status)} to ${formatStatusLabel(nextStatus)}.`, 'status');
  }

  const nextFollowUpDate = normalizeDateValue(body?.nextFollowUpDate, existingMeta.nextFollowUpDate);
  const nextFollowUpTime = normalizeTimeValue(body?.nextFollowUpTime, existingMeta.nextFollowUpTime);
  const nextFollowUpNote = body?.followUpNote !== undefined ? normalizeText(body?.followUpNote) : existingMeta.followUpNote;
  const nextUrgent = body?.isUrgentFollowUp !== undefined ? normalizeBool(body?.isUrgentFollowUp) : Boolean(existingMeta.isUrgentFollowUp);
  if (
    nextFollowUpDate !== existingMeta.nextFollowUpDate ||
    nextFollowUpTime !== existingMeta.nextFollowUpTime ||
    nextFollowUpNote !== existingMeta.followUpNote ||
    nextUrgent !== Boolean(existingMeta.isUrgentFollowUp)
  ) {
    activityLog = prependActivityLog(activityLog, buildFollowUpText(nextFollowUpDate, nextFollowUpTime, nextUrgent), 'followup');
  }

  if (body?.privateNotes !== undefined && normalizeText(body?.privateNotes) !== normalizeText(existingLead?.notes)) {
    activityLog = prependActivityLog(activityLog, 'Private notes updated.', 'note');
  }

  extraEntries.forEach(entry => {
    activityLog = prependActivityLog(activityLog, entry.text, entry.type);
  });
  return activityLog;
}

function buildPropertyActivityLog(existingProperty, body, extraEntries = []) {
  const existingMeta = parsePropertyMeta(existingProperty?.description);
  let activityLog = Array.isArray(existingMeta.activityLog) ? existingMeta.activityLog : [];
  const nextStatus = body?.status !== undefined ? normalizeListingStatus(body?.status) : normalizeListingStatus(existingProperty?.status);
  if (nextStatus !== normalizeListingStatus(existingProperty?.status)) {
    activityLog = prependActivityLog(activityLog, `Status changed from ${formatStatusLabel(existingProperty?.status)} to ${formatStatusLabel(nextStatus)}.`, 'status');
  }

  const nextFollowUpDate = normalizeDateValue(body?.nextFollowUpDate, existingMeta.nextFollowUpDate);
  const nextFollowUpTime = normalizeTimeValue(body?.nextFollowUpTime, existingMeta.nextFollowUpTime);
  const nextFollowUpNote = body?.followUpNote !== undefined ? normalizeText(body?.followUpNote) : existingMeta.followUpNote;
  const nextUrgent = body?.isUrgentFollowUp !== undefined ? normalizeBool(body?.isUrgentFollowUp) : Boolean(existingMeta.isUrgentFollowUp);
  if (
    nextFollowUpDate !== existingMeta.nextFollowUpDate ||
    nextFollowUpTime !== existingMeta.nextFollowUpTime ||
    nextFollowUpNote !== existingMeta.followUpNote ||
    nextUrgent !== Boolean(existingMeta.isUrgentFollowUp)
  ) {
    activityLog = prependActivityLog(activityLog, buildFollowUpText(nextFollowUpDate, nextFollowUpTime, nextUrgent), 'followup');
  }

  if (body?.internalNotes !== undefined && normalizeText(body?.internalNotes) !== normalizeText(existingProperty?.internal_notes)) {
    activityLog = prependActivityLog(activityLog, 'Internal notes updated.', 'note');
  }

  extraEntries.forEach(entry => {
    activityLog = prependActivityLog(activityLog, entry.text, entry.type);
  });
  return activityLog;
}

function getLeadPayload(body, brokerId, existingLead = null, overrides = {}) {
  const clientPurpose = normalizeText(body?.clientPurpose || body?.purpose || existingLead?.purpose).toLowerCase() === 'rent' ? 'rent' : 'buy';
  const purpose = clientPurpose === 'rent' ? 'rent' : 'sale';
  const propertyType = normalizePropertyTypeValue(body?.propertyType || body?.category || existingLead?.category);
  const meta = getLeadMeta(body, existingLead, overrides);
  const publicGeneralNotes = body?.publicGeneralNotes !== undefined
    ? normalizeText(body?.publicGeneralNotes)
    : buildLeadPublicSummary({
        clientPurpose,
        category: propertyType,
        location: normalizeLocationValue(body?.location || existingLead?.location),
        budget: normalizeText(body?.budget || existingLead?.budget),
        preferredBuildingProject: meta.preferredBuildingProject,
        paymentMethod: meta.paymentMethod
      });
  const isListedPublic = body?.isListedPublic !== undefined
    ? normalizeBool(body?.isListedPublic)
    : Boolean(existingLead?.is_listed_public);

  return {
    broker_uuid: brokerId,
    lead_type: clientPurpose === 'rent' ? 'tenant' : 'buyer',
    purpose,
    category: propertyType,
    ...getPropertyDimensionDbFields({
      propertyCategory: body?.propertyCategory ?? existingLead?.property_category,
      unitLayout: body?.unitLayout ?? existingLead?.unit_layout,
      propertyType
    }),
    location: normalizeLocationValue(body?.location || existingLead?.location),
    budget: normalizeText(body?.budget || existingLead?.budget),
    notes: normalizeText(body?.privateNotes ?? body?.notes ?? existingLead?.notes),
    public_general_notes: publicGeneralNotes,
    source: normalizeText(body?.source || existingLead?.source || 'Manual'),
    priority: normalizeText(body?.priority || existingLead?.priority || 'normal').toLowerCase(),
    status: normalizeLeadStatus(body?.status ?? existingLead?.status),
    meeting_date: body?.meetingDate !== undefined ? body?.meetingDate || null : existingLead?.meeting_date || null,
    meeting_time: body?.meetingTime !== undefined ? body?.meetingTime || null : existingLead?.meeting_time || null,
    follow_up_notes: serializeLeadMeta(meta),
    next_action: normalizeText(body?.nextAction || existingLead?.next_action),
    rent_booking: body?.rentChecklist ? normalizeBool(body?.rentChecklist?.booking) : Boolean(existingLead?.rent_booking),
    rent_agreement_signed: body?.rentChecklist ? normalizeBool(body?.rentChecklist?.agreementSigned) : Boolean(existingLead?.rent_agreement_signed),
    rent_handover_done: body?.rentChecklist ? normalizeBool(body?.rentChecklist?.handoverDone) : Boolean(existingLead?.rent_handover_done),
    sale_contract_a: body?.saleChecklist ? normalizeBool(body?.saleChecklist?.contractA) : Boolean(existingLead?.sale_contract_a),
    sale_contract_b: body?.saleChecklist ? normalizeBool(body?.saleChecklist?.contractB) : Boolean(existingLead?.sale_contract_b),
    sale_contract_f: body?.saleChecklist ? normalizeBool(body?.saleChecklist?.contractF) : Boolean(existingLead?.sale_contract_f),
    owner_name: normalizeText(body?.ownerName ?? existingLead?.owner_name),
    owner_phone: normalizePhoneNumber(body?.ownerPhone ?? existingLead?.owner_phone),
    client_name: normalizeText(body?.clientName ?? existingLead?.client_name),
    client_phone: normalizePhoneNumber(body?.clientPhone ?? existingLead?.client_phone),
    is_listed_public: isListedPublic,
    public_listing_status: isListedPublic ? 'listed' : 'private',
    updated_at: nowIso()
  };
}

function getPropertyPayload(body, brokerId, existingProperty = null, overrides = {}) {
  const purpose = normalizeListingPurposeValue(body?.purpose || existingProperty?.purpose) || 'sale';
  const propertyType = normalizePropertyTypeValue(body?.propertyType || existingProperty?.property_type || existingProperty?.category);
  const meta = getPropertyMeta(body, existingProperty, overrides);
  const distressDeal = body?.isDistress !== undefined ? normalizeBool(body?.isDistress) : Boolean(existingProperty?.is_distress);
  const effectivePrice = normalizeText(
    body?.price ||
    (distressDeal ? meta.distressAskingPrice : '') ||
    body?.rentPrice ||
    body?.ownerAskingPrice ||
    existingProperty?.price
  );
  const isListedPublic = body?.isListedPublic !== undefined
    ? normalizeBool(body?.isListedPublic)
    : Boolean(existingProperty?.is_listed_public);

  return {
    broker_uuid: brokerId,
    purpose,
    property_type: propertyType,
    category: propertyType,
    ...getPropertyDimensionDbFields({
      propertyCategory: body?.propertyCategory ?? existingProperty?.property_category,
      unitLayout: body?.unitLayout ?? existingProperty?.unit_layout,
      propertyType
    }),
    sale_property_status: purpose === 'sale' ? meta.salePropertyStatus || 'Ready Property' : null,
    handover_quarter: purpose === 'sale' ? meta.handoverQuarter || null : null,
    handover_year: purpose === 'sale' ? meta.handoverYear || null : null,
    market_price: meta.marketPrice || null,
    distress_gap_percent: meta.distressDiscountPercent || null,
    location: normalizeLocationValue(body?.location || existingProperty?.location),
    price: effectivePrice,
    size: normalizeDecimalValue(body?.size || body?.sizeSqft || existingProperty?.size),
    bedrooms: body?.bedrooms ?? existingProperty?.bedrooms ?? null,
    bathrooms: body?.bathrooms ?? existingProperty?.bathrooms ?? null,
    description: serializePropertyMeta(meta),
    public_notes: normalizeText(body?.publicNotes ?? existingProperty?.public_notes),
    internal_notes: normalizeText(body?.internalNotes ?? existingProperty?.internal_notes),
    owner_name: normalizeText(body?.ownerName ?? existingProperty?.owner_name),
    owner_phone: normalizePhoneNumber(body?.ownerPhone ?? existingProperty?.owner_phone),
    status: normalizeListingStatus(body?.status ?? existingProperty?.status),
    is_urgent: false,
    is_distress: distressDeal,
    is_listed_public: isListedPublic,
    public_listing_status: isListedPublic ? 'listed' : 'private',
    updated_at: nowIso()
  };
}

function getFollowUpPayload(body, brokerId) {
  return {
    broker_uuid: brokerId,
    entity_type: normalizeText(body?.entityType).toLowerCase(),
    entity_id: Number(body?.entityId || 0),
    follow_up_type: normalizeText(body?.followUpType || 'follow-up').toLowerCase(),
    meeting_date: body?.meetingDate || null,
    meeting_time: body?.meetingTime || null,
    note: normalizeText(body?.note),
    next_action: normalizeText(body?.nextAction),
    created_at: nowIso()
  };
}

async function selectOptionalBrokerRows(context, table) {
  const { supabaseUrl, serviceRoleKey, broker } = context;
  try {
    return await supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table,
      filters: { broker_uuid: broker.id },
      order: { column: 'created_at', ascending: false }
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('could not find') || message.includes('relation') || message.includes('does not exist')) {
      return [];
    }
    throw error;
  }
}

async function fetchBrokerRow(context, table, id) {
  const { supabaseUrl, serviceRoleKey, broker } = context;
  const rows = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table,
    filters: {
      id,
      broker_uuid: broker.id
    }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function syncPublicListing(context, sourceType, item, broker) {
  const { supabaseUrl, serviceRoleKey } = context;
  const existing = await supabaseSelect({
    supabaseUrl,
    serviceRoleKey,
    table: 'public_listings',
    filters: {
      source_type: sourceType,
      source_id: item.id
    }
  });
  const payload = buildPublicListingPayload(sourceType, broker, item);

  if (Array.isArray(existing) && existing[0]) {
    await safeSupabasePatchWithPropertyDimensions({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: { id: existing[0].id },
      payload
    });
    return;
  }

  await safeSupabaseInsertWithPropertyDimensions({
    supabaseUrl,
    serviceRoleKey,
    table: 'public_listings',
    payload: [{
      ...payload,
      created_at: nowIso()
    }]
  });
}

async function removePublicListing(context, sourceType, sourceId) {
  const { supabaseUrl, serviceRoleKey } = context;
  await supabaseDelete({
    supabaseUrl,
    serviceRoleKey,
    table: 'public_listings',
    filters: {
      source_type: sourceType,
      source_id: sourceId
    }
  });
}

function getFollowUpState(record) {
  const rawDate = normalizeText(record?.nextFollowUpDate);
  if (!rawDate) {
    return { key: 'none', label: 'No follow-up set', overdueDays: 0 };
  }

  const today = formatDateInDubai();
  if (rawDate === today) {
    return { key: 'today', label: 'Follow-up today', overdueDays: 0 };
  }

  const start = new Date(`${rawDate}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((start - todayDate) / 86400000);
  if (diffDays < 0) {
    return { key: 'overdue', label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, overdueDays: Math.abs(diffDays) };
  }
  if (diffDays === 1) {
    return { key: 'upcoming', label: 'Due tomorrow', overdueDays: 0 };
  }
  return { key: 'upcoming', label: `Upcoming on ${rawDate}`, overdueDays: 0 };
}

function isLeadOperational(lead) {
  return !lead.isArchived && !CLOSED_LEAD_STATUSES.has(normalizeLeadStatus(lead.status));
}

function isListingOperational(property) {
  return !property.isArchived && ACTIVE_MATCH_LISTING_STATUSES.has(normalizeListingStatus(property.status));
}

function evaluateMatch(lead, property) {
  if (!isLeadOperational(lead) || !isListingOperational(property)) return null;
  const leadPurpose = normalizeText(lead.clientPurpose || lead.purpose).toLowerCase() === 'rent' ? 'rent' : 'sale';
  const propertyPurpose = normalizeText(property.purpose).toLowerCase() === 'rent' ? 'rent' : 'sale';
  if (leadPurpose !== propertyPurpose) return null;

  const leadLocation = normalizeMatchKey(lead.location);
  const propertyLocation = normalizeMatchKey(property.location);
  if (!leadLocation || !propertyLocation || leadLocation !== propertyLocation) return null;

  const leadType = normalizeMatchKey(lead.propertyType);
  const propertyType = normalizeMatchKey(property.propertyType);
  if (!leadType || !propertyType || leadType !== propertyType) return null;

  const leadBudget = parseMoney(lead.budget);
  const propertyPrice = parseMoney(property.price || property.rentPrice || property.ownerAskingPrice);
  if (!leadBudget || !propertyPrice) return null;

  const buildingMatch = normalizeMatchKey(lead.preferredBuildingProject) && normalizeMatchKey(lead.preferredBuildingProject) === normalizeMatchKey(property.buildingName);
  const strictBudgetMatch = propertyPrice <= leadBudget;
  const nearBudgetMatch = !strictBudgetMatch && propertyPrice <= Math.round(leadBudget * 1.1);
  if (!strictBudgetMatch && !nearBudgetMatch) return null;

  const confidence = strictBudgetMatch ? 'strong' : 'partial';
  const score = strictBudgetMatch ? (buildingMatch ? 97 : 90) : (buildingMatch ? 79 : 72);
  const reasons = [
    `${formatStatusLabel(leadPurpose)} match`,
    'Location aligned',
    'Property type aligned',
    strictBudgetMatch ? 'Budget aligned' : 'Near-budget fit',
    buildingMatch ? 'Building matched' : ''
  ].filter(Boolean);

  return {
    leadId: lead.id,
    propertyId: property.id,
    confidence,
    matchScore: score,
    matchReason: reasons.join(' · ')
  };
}

function buildPublicLeadCandidate(item) {
  return {
    id: item.sourceId || item.id,
    clientPurpose: item.purpose,
    purpose: item.purpose,
    propertyType: item.propertyType,
    location: item.location,
    preferredBuildingProject: item.buildingLabel || '',
    budget: item.priceLabel || '',
    status: 'new',
    isArchived: false
  };
}

function buildPublicPropertyCandidate(item) {
  const purpose = normalizeText(item.purpose).toLowerCase() === 'rent' ? 'rent' : 'sale';
  return {
    id: item.sourceId || item.id,
    purpose,
    propertyType: item.propertyType,
    location: item.location,
    buildingName: item.buildingLabel || '',
    price: item.priceLabel || '',
    rentPrice: purpose === 'rent' ? item.priceLabel || '' : '',
    ownerAskingPrice: purpose === 'sale' ? item.priceLabel || '' : '',
    status: 'available',
    isArchived: false
  };
}

function computeMatchData(leads, properties, publicListings = [], currentBrokerId = '') {
  const leadMap = new Map(leads.map(lead => [lead.id, { ...lead, matchingListings: [], matchCount: 0, strongMatchCount: 0 }]));
  const propertyMap = new Map(properties.map(property => [property.id, { ...property, matchingLeads: [], matchCount: 0, strongMatchCount: 0 }]));
  const aiMatches = [];
  const brokerUuid = normalizeText(currentBrokerId);
  const publicItems = (Array.isArray(publicListings) ? publicListings : []).filter(item => normalizeText(item?.brokerUuid) && normalizeText(item?.brokerUuid) !== brokerUuid);
  const publicLeads = publicItems.filter(item => item.sourceType === 'lead');
  const publicProperties = publicItems.filter(item => item.sourceType === 'property');

  leadMap.forEach(lead => {
    propertyMap.forEach(property => {
      const match = evaluateMatch(lead, property);
      if (!match) return;

      aiMatches.push({
        id: `internal-${match.leadId}-${match.propertyId}`,
        requirement_id: match.leadId,
        property_id: match.propertyId,
        match_score: match.matchScore,
        match_reason: match.matchReason,
        status: match.confidence,
        created_at: nowIso(),
        updated_at: nowIso(),
        internal_type: 'internal',
        internal_id: null,
        counterpart_type: 'internal',
        counterpart_source: 'private',
        visibility_scope: 'internal'
      });

      lead.matchingListings.push({
        id: property.id,
        propertyType: property.propertyType,
        location: property.location,
        price: property.price || property.rentPrice || property.ownerAskingPrice,
        buildingName: property.buildingName || '',
        status: property.status,
        confidence: match.confidence,
        matchReason: match.matchReason,
        isExternalPublic: false,
        sourceSection: property.isDistress ? 'distress-deals' : 'properties',
        visibilityScope: 'internal'
      });

      property.matchingLeads.push({
        id: lead.id,
        clientPurpose: lead.clientPurpose,
        propertyType: lead.propertyType,
        location: lead.location,
        budget: lead.budget,
        preferredBuildingProject: lead.preferredBuildingProject || '',
        status: lead.status,
        confidence: match.confidence,
        matchReason: match.matchReason,
        isExternalPublic: false,
        sourceSection: 'leads',
        visibilityScope: 'internal'
      });

      lead.matchCount += 1;
      property.matchCount += 1;
      if (match.confidence === 'strong') {
        lead.strongMatchCount += 1;
        property.strongMatchCount += 1;
      }
    });
  });

  leadMap.forEach(lead => {
    publicProperties.forEach(publicProperty => {
      const match = evaluateMatch(lead, buildPublicPropertyCandidate(publicProperty));
      if (!match) return;
      const visibilityScope = lead.isListedPublic ? 'shared-both' : 'private-pocket';

      aiMatches.push({
        id: `lead-${match.leadId}-public-property-${publicProperty.id}`,
        requirement_id: match.leadId,
        property_id: null,
        match_score: match.matchScore,
        match_reason: match.matchReason,
        status: match.confidence,
        created_at: nowIso(),
        updated_at: nowIso(),
        internal_type: 'lead',
        internal_id: match.leadId,
        counterpart_type: 'property',
        counterpart_source: 'public',
        counterpart_record_id: publicProperty.id,
        counterpart_source_id: publicProperty.sourceId,
        counterpart_broker_uuid: publicProperty.brokerUuid,
        counterpart_broker_name: publicProperty.brokerName,
        counterpart_broker_mobile: publicProperty.brokerMobile,
        counterpart_purpose: publicProperty.purpose,
        counterpart_property_type: publicProperty.propertyType,
        counterpart_location: publicProperty.location,
        counterpart_building: publicProperty.buildingLabel,
        counterpart_price_label: publicProperty.priceLabel,
        counterpart_public_notes: publicProperty.publicNotes,
        counterpart_section: publicProperty.isDistress ? 'distress-deals' : 'broker-connector-listings',
        visibility_scope: visibilityScope
      });

      lead.matchingListings.push({
        id: publicProperty.id,
        sourceId: publicProperty.sourceId,
        propertyType: publicProperty.propertyType,
        location: publicProperty.location,
        price: publicProperty.priceLabel,
        buildingName: publicProperty.buildingLabel || '',
        status: publicProperty.status,
        confidence: match.confidence,
        matchReason: match.matchReason,
        isExternalPublic: true,
        brokerName: publicProperty.brokerName,
        brokerMobile: publicProperty.brokerMobile,
        sourceSection: publicProperty.isDistress ? 'distress-deals' : 'broker-connector-listings',
        publicNotes: publicProperty.publicNotes,
        visibilityScope
      });
      lead.matchCount += 1;
      if (match.confidence === 'strong') {
        lead.strongMatchCount += 1;
      }
    });
  });

  propertyMap.forEach(property => {
    publicLeads.forEach(publicLead => {
      const match = evaluateMatch(buildPublicLeadCandidate(publicLead), property);
      if (!match) return;
      const visibilityScope = property.isListedPublic ? 'shared-both' : 'private-pocket';

      aiMatches.push({
        id: `property-${match.propertyId}-public-lead-${publicLead.id}`,
        requirement_id: null,
        property_id: match.propertyId,
        match_score: match.matchScore,
        match_reason: match.matchReason,
        status: match.confidence,
        created_at: nowIso(),
        updated_at: nowIso(),
        internal_type: 'property',
        internal_id: match.propertyId,
        counterpart_type: 'lead',
        counterpart_source: 'public',
        counterpart_record_id: publicLead.id,
        counterpart_source_id: publicLead.sourceId,
        counterpart_broker_uuid: publicLead.brokerUuid,
        counterpart_broker_name: publicLead.brokerName,
        counterpart_broker_mobile: publicLead.brokerMobile,
        counterpart_purpose: publicLead.purpose,
        counterpart_property_type: publicLead.propertyType,
        counterpart_location: publicLead.location,
        counterpart_building: publicLead.buildingLabel,
        counterpart_price_label: publicLead.priceLabel,
        counterpart_public_notes: publicLead.publicNotes,
        counterpart_section: 'broker-requirements',
        visibility_scope: visibilityScope
      });

      property.matchingLeads.push({
        id: publicLead.id,
        sourceId: publicLead.sourceId,
        clientPurpose: publicLead.purpose,
        propertyType: publicLead.propertyType,
        location: publicLead.location,
        budget: publicLead.priceLabel,
        preferredBuildingProject: publicLead.buildingLabel || '',
        status: publicLead.status,
        confidence: match.confidence,
        matchReason: match.matchReason,
        isExternalPublic: true,
        brokerName: publicLead.brokerName,
        brokerMobile: publicLead.brokerMobile,
        sourceSection: 'broker-requirements',
        publicNotes: publicLead.publicNotes,
        visibilityScope
      });
      property.matchCount += 1;
      if (match.confidence === 'strong') {
        property.strongMatchCount += 1;
      }
    });
  });

  return {
    leads: [...leadMap.values()],
    properties: [...propertyMap.values()],
    aiMatches: aiMatches.map(sanitizeAiMatch)
  };
}

function buildDynamicNotifications(leads, properties, aiMatches = [], existingNotifications = []) {
  const notifications = [];
  const makeNotification = (id, type, title, message, relatedSourceType, relatedSourceId) => ({
    id,
    notification_type: type,
    title,
    message,
    related_source_type: relatedSourceType,
    related_source_id: relatedSourceId,
    status: 'unread',
    created_at: nowIso(),
    updated_at: nowIso()
  });

  leads.forEach(lead => {
    if (lead.isArchived) return;
    const followUpState = getFollowUpState(lead);
    if (followUpState.key === 'overdue') {
      notifications.push(makeNotification(`lead-overdue-${lead.id}`, 'follow-up', `Lead #${lead.id} follow-up overdue`, followUpState.label, 'lead', lead.id));
    } else if (followUpState.key === 'today') {
      notifications.push(makeNotification(`lead-today-${lead.id}`, 'follow-up', `Lead #${lead.id} follow-up due today`, followUpState.label, 'lead', lead.id));
    }
  });

  properties.forEach(property => {
    if (property.isArchived) return;
    const followUpState = getFollowUpState(property);
    if (followUpState.key === 'overdue') {
      notifications.push(makeNotification(`property-overdue-${property.id}`, 'follow-up', `Listing #${property.id} follow-up overdue`, followUpState.label, 'property', property.id));
    } else if (followUpState.key === 'today') {
      notifications.push(makeNotification(`property-today-${property.id}`, 'follow-up', `Listing #${property.id} follow-up due today`, followUpState.label, 'property', property.id));
    }
  });

  leads.forEach(lead => {
    const externalMatchCount = (Array.isArray(lead.matchingListings) ? lead.matchingListings : []).filter(item => item?.isExternalPublic).length;
    if (!externalMatchCount) return;
    const sharedMessage = externalMatchCount === 1
      ? 'Your shared requirement matches 1 shared listing on Broker Connector Page. Both brokers were notified.'
      : `Your shared requirement matches ${externalMatchCount} shared listings on Broker Connector Page. Both brokers were notified.`;
    const privateMessage = externalMatchCount === 1
      ? 'A matching shared listing is available for your private requirement. Only you were notified. Contact that broker if you want to proceed.'
      : `${externalMatchCount} matching shared listings are available for your private requirement. Only you were notified. Contact the relevant broker if you want to proceed.`;
    notifications.push(
      makeNotification(
        `lead-match-${lead.id}`,
        'match',
        `${externalMatchCount} matching listing${externalMatchCount === 1 ? '' : 's'} found`,
        lead.isListedPublic ? sharedMessage : privateMessage,
        'lead',
        lead.id
      )
    );
  });

  properties.forEach(property => {
    const externalMatchCount = (Array.isArray(property.matchingLeads) ? property.matchingLeads : []).filter(item => item?.isExternalPublic).length;
    if (!externalMatchCount) return;
    const sharedMessage = externalMatchCount === 1
      ? 'Your shared listing matches 1 shared requirement on Broker Connector Page. Both brokers were notified.'
      : `Your shared listing matches ${externalMatchCount} shared requirements on Broker Connector Page. Both brokers were notified.`;
    const privateMessage = externalMatchCount === 1
      ? 'A matching requirement is available for your private / pocket listing. Only you were notified. Contact that broker if you want to proceed.'
      : `${externalMatchCount} matching requirements are available for your private / pocket listing. Only you were notified. Contact the relevant broker if you want to proceed.`;
    notifications.push(
      makeNotification(
        `property-match-${property.id}`,
        'match',
        `${externalMatchCount} matching requirement${externalMatchCount === 1 ? '' : 's'} found`,
        property.isListedPublic ? sharedMessage : privateMessage,
        'property',
        property.id
      )
    );
  });

  const merged = [
    ...(Array.isArray(existingNotifications) ? existingNotifications : []).filter(item => String(item?.notification_type || item?.notificationType || '').toLowerCase() !== 'match'),
    ...notifications
  ];

  return merged
    .sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime())
    .slice(0, 20)
    .map(sanitizeNotification);
}

function buildOverview(leads, properties, sharedListings, broker, aiMatches) {
  const activeLeads = leads.filter(lead => !lead.isArchived && !CLOSED_LEAD_STATUSES.has(normalizeLeadStatus(lead.status)));
  const activeListings = properties.filter(property => !property.isArchived && !INACTIVE_LISTING_STATUSES.has(normalizeListingStatus(property.status)));
  const followUpToday = [...leads, ...properties].filter(item => getFollowUpState(item).key === 'today').length;
  const overdueFollowUps = [...leads, ...properties].filter(item => getFollowUpState(item).key === 'overdue').length;

  return {
    broker: sanitizeOverviewBroker(broker),
    totals: {
      leads: activeLeads.length,
      properties: activeListings.length,
      sharedListings: sharedListings.length,
      activeLeads: activeLeads.length,
      activeProperties: activeListings.length,
      followUpsDueToday: followUpToday,
      overdueFollowUps,
      possibleMatches: Array.isArray(aiMatches) ? aiMatches.length : 0,
      archivedLeads: leads.filter(lead => lead.isArchived).length,
      archivedListings: properties.filter(property => property.isArchived).length
    }
  };
}

function sanitizeOverviewBroker(broker) {
  return {
    id: broker.id,
    fullName: broker.full_name,
    brokerIdNumber: broker.broker_id_number,
    mobileNumber: broker.mobile_number,
    email: broker.email,
    companyName: broker.company_name || '',
    isVerified: Boolean(broker.is_verified),
    lastActivity: normalizeText(broker.last_activity)
  };
}

function formatBrokerActivityLabel(activity) {
  switch (activity?.key) {
    case 'online':
      return 'Online';
    case 'active':
      return 'Active';
    case 'recent':
      return 'Recently Active';
    default:
      return 'Offline';
  }
}

function buildBrokerActivityRow(broker) {
  const lastActivity = normalizeText(broker?.last_activity);
  const activity = deriveBrokerActivity(lastActivity);
  return {
    id: broker?.id,
    fullName: normalizeText(broker?.full_name) || 'Broker',
    companyName: normalizeText(broker?.company_name),
    lastActivity,
    activityStatus: activity.key,
    activityLabel: formatBrokerActivityLabel(activity),
    isOnline: activity.isOnline,
    isActive: activity.isActive,
    isRecent: activity.isRecent
  };
}

function buildBrokerActivitySnapshot(rows = []) {
  const brokers = (Array.isArray(rows) ? rows : [])
    .filter(item => !item?.is_blocked)
    .map(buildBrokerActivityRow)
    .sort((left, right) => {
      const leftRank = left.isOnline ? 3 : left.isActive ? 2 : left.isRecent ? 1 : 0;
      const rightRank = right.isOnline ? 3 : right.isActive ? 2 : right.isRecent ? 1 : 0;
      if (rightRank !== leftRank) return rightRank - leftRank;
      return new Date(right.lastActivity || 0).getTime() - new Date(left.lastActivity || 0).getTime();
    });

  return {
    activeCount: brokers.filter(item => item.isOnline || item.isActive).length,
    brokers: brokers.filter(item => item.isOnline || item.isActive || item.isRecent).slice(0, 12)
  };
}

function getBrokerProfilePayload(body, broker) {
  const fullName = normalizeText(body?.fullName || broker.full_name);
  const mobileNumber = normalizePhoneNumber(body?.mobileNumber || broker.mobile_number);
  const email = normalizeEmail(body?.email || broker.email);
  const companyName = normalizeText(body?.companyName ?? broker.company_name);

  return {
    full_name: fullName,
    mobile_number: mobileNumber,
    email,
    company_name: companyName,
    updated_at: nowIso()
  };
}

function debugProfileSave(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[broker-dashboard profile]', ...args);
  }
}

async function resolveProfileAuthUser(context, authAccessToken = '') {
  const { supabaseUrl, serviceRoleKey, broker } = context;
  const publishableKey = getSupabasePublishableKey();
  const normalizedAccessToken = normalizeText(authAccessToken);

  if (normalizedAccessToken) {
    try {
      const authUser = await supabaseAuthGetUser({
        supabaseUrl,
        publishableKey,
        accessToken: normalizedAccessToken
      });
      if (authUser?.id) return authUser;
    } catch (error) {
      debugProfileSave('auth access-token lookup failed', error?.message || error);
    }
  }

  try {
    return await supabaseAuthAdminGetUser({
      supabaseUrl,
      serviceRoleKey,
      userId: broker.id
    });
  } catch (error) {
    debugProfileSave('broker.id auth lookup failed', {
      brokerId: broker.id,
      email: broker.email,
      message: error?.message || error
    });
    return null;
  }
}

async function fetchBrokerDataset(context) {
  const { supabaseUrl, serviceRoleKey, broker } = context;
  const brokerFilter = { broker_uuid: broker.id };

  const [leadRows, propertyRows, followUpRows, listingRows, allPublicRows, notificationRows, aiMatchRows, brokerRows] = await Promise.all([
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'broker_leads',
      filters: brokerFilter,
      order: { column: 'created_at', ascending: false }
    }),
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'broker_properties',
      filters: brokerFilter,
      order: { column: 'created_at', ascending: false }
    }),
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'broker_followups',
      filters: brokerFilter,
      order: { column: 'created_at', ascending: false }
    }),
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: { broker_uuid: broker.id },
      order: { column: 'created_at', ascending: false }
    }),
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: { public_listing_status: 'listed' },
      order: { column: 'updated_at', ascending: false }
    }).catch(() => []),
    selectOptionalBrokerRows(context, 'broker_notifications'),
    selectOptionalBrokerRows(context, 'broker_ai_matches'),
    supabaseSelect({
      supabaseUrl,
      serviceRoleKey,
      table: 'brokers',
      filters: { is_blocked: false },
      order: { column: 'updated_at', ascending: false }
    }).catch(() => [])
  ]);

  const leadRecords = (Array.isArray(leadRows) ? leadRows : []).map(sanitizeLead);
  const propertyRecords = (Array.isArray(propertyRows) ? propertyRows : []).map(sanitizeProperty);
  const followUps = (Array.isArray(followUpRows) ? followUpRows : []).map(sanitizeFollowUp);
  const sharedListings = (Array.isArray(listingRows) ? listingRows : []).map(sanitizePublicListing);
  const allSharedListings = (Array.isArray(allPublicRows) ? allPublicRows : []).map(row => sanitizePublicListing(row, { exposeBrokerContact: true }));
  const storedNotifications = Array.isArray(notificationRows) ? notificationRows : [];
  const computedMatches = computeMatchData(leadRecords, propertyRecords, allSharedListings, broker.id);
  const notifications = buildDynamicNotifications(computedMatches.leads, computedMatches.properties, computedMatches.aiMatches, storedNotifications);
  const aiMatches = computedMatches.aiMatches;

  return {
    overview: buildOverview(computedMatches.leads, computedMatches.properties, sharedListings, broker, aiMatches),
    brokerActivity: buildBrokerActivitySnapshot(brokerRows),
    leads: computedMatches.leads,
    properties: computedMatches.properties,
    followUps,
    sharedListings,
    notifications,
    aiMatches
  };
}

async function patchLeadWorkflow(context, lead, updates = {}, activityText = '', activityType = 'system') {
  const meta = getLeadMeta({}, lead, {
    ...updates,
    activityLog: activityText
      ? prependActivityLog(parseLeadMeta(lead.follow_up_notes).activityLog, activityText, activityType)
      : parseLeadMeta(lead.follow_up_notes).activityLog
  });

  const rows = await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_leads',
    filters: { id: lead.id, broker_uuid: context.broker.id },
    payload: {
      follow_up_notes: serializeLeadMeta(meta),
      updated_at: nowIso()
    }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function patchPropertyWorkflow(context, property, updates = {}, activityText = '', activityType = 'system') {
  const meta = getPropertyMeta({}, property, {
    ...updates,
    activityLog: activityText
      ? prependActivityLog(parsePropertyMeta(property.description).activityLog, activityText, activityType)
      : parsePropertyMeta(property.description).activityLog
  });

  const rows = await supabasePatch({
    supabaseUrl: context.supabaseUrl,
    serviceRoleKey: context.serviceRoleKey,
    table: 'broker_properties',
    filters: { id: property.id, broker_uuid: context.broker.id },
    payload: {
      description: serializePropertyMeta(meta),
      updated_at: nowIso()
    }
  });
  return Array.isArray(rows) ? rows[0] : null;
}

export async function GET(request) {
  try {
    const context = await requireBrokerSession(request);
    const data = await fetchBrokerDataset(context);
    return json(data);
  } catch (error) {
    return json({ message: error.message || 'Broker dashboard load failed.' }, error.status || 500);
  }
}

export async function POST(request) {
  try {
    const context = await requireBrokerSession(request);
    const body = await request.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();
    const { supabaseUrl, serviceRoleKey, broker } = context;

    if (!action) {
      return json({ message: 'Dashboard action is required.' }, 400);
    }

    if (action === 'heartbeat') {
      const brokerRows = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { is_blocked: false },
        order: { column: 'updated_at', ascending: false }
      }).catch(() => []);

      return json({
        broker: sanitizeOverviewBroker(broker),
        brokerActivity: buildBrokerActivitySnapshot(brokerRows)
      });
    }

    if (action === 'update-profile') {
      const payload = getBrokerProfilePayload(body, broker);
      const authAccessToken = normalizeText(body?.authAccessToken);
      if (payload.full_name.length < 2) {
        return json({ message: 'Please enter the broker name.' }, 400);
      }
      if (!payload.mobile_number) {
        return json({ message: 'Please enter a valid mobile number.' }, 400);
      }
      if (!payload.email || !payload.email.includes('@')) {
        return json({ message: 'Please enter a valid email address.' }, 400);
      }

      const existingRows = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        select: 'id,mobile_number,email',
        order: { column: 'created_at', ascending: false }
      });

      const duplicate = (Array.isArray(existingRows) ? existingRows : []).find(item =>
        item.id !== broker.id && (
          item.mobile_number === payload.mobile_number ||
          item.email === payload.email
        )
      );

      if (duplicate) {
        if (duplicate.mobile_number === payload.mobile_number) {
          return json({ message: 'This mobile number is already in use by another broker.' }, 409);
        }
        return json({ message: 'This email address is already in use by another broker.' }, 409);
      }

      const authUser = await resolveProfileAuthUser(context, authAccessToken);
      if (authUser?.id) {
        try {
          await supabaseAuthAdminUpdateUser({
            supabaseUrl,
            serviceRoleKey,
            userId: authUser.id,
            email: payload.email,
            userMetadata: {
              full_name: payload.full_name,
              company_name: payload.company_name || '',
              mobile_number: payload.mobile_number || ''
            }
          });
        } catch (authSyncError) {
          const message = normalizeText(authSyncError?.message).toLowerCase();
          if (authSyncError?.status !== 404 && !message.includes('user not found')) {
            return json({ message: authSyncError?.message || 'Broker profile auth sync failed.' }, authSyncError?.status || 500);
          }
          debugProfileSave('auth sync skipped because linked auth user was not found', {
            brokerId: broker.id,
            brokerEmail: broker.email,
            message: authSyncError?.message || 'User not found'
          });
        }
      } else {
        debugProfileSave('no auth user resolved for profile save', {
          brokerId: broker.id,
          brokerEmail: broker.email
        });
      }

      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload
      });
      const nextBroker = Array.isArray(rows) ? rows[0] : null;
      if (!nextBroker) {
        return json({ message: 'Broker profile could not be updated.' }, 500);
      }

      return json({ broker: sanitizeOverviewBroker(nextBroker) });
    }

    if (action === 'create-lead') {
      const baseLog = prependActivityLog([], 'Lead created in the CRM workspace.', 'created');
      const payload = {
        ...getLeadPayload(body, broker.id, null, { activityLog: baseLog }),
        created_at: nowIso()
      };
      const rows = await safeSupabaseInsertWithPropertyDimensions({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        payload: [payload]
      });
      const lead = Array.isArray(rows) ? rows[0] : null;
      if (lead?.is_listed_public) {
        await syncPublicListing(context, 'lead', lead, broker);
      }
      return json({ lead: sanitizeLead(lead) });
    }

    if (action === 'update-lead') {
      const id = Number(body?.id || 0);
      if (!id) return json({ message: 'Lead id is required.' }, 400);
      const existingLead = await fetchBrokerRow(context, 'broker_leads', id);
      if (!existingLead) return json({ message: 'Lead not found.' }, 404);

      const activityLog = buildLeadActivityLog(existingLead, body, [{ text: 'Lead details updated.', type: 'updated' }]);
      const rows = await safeSupabasePatchWithPropertyDimensions({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: getLeadPayload(body, broker.id, existingLead, { activityLog })
      });
      const lead = Array.isArray(rows) ? rows[0] : null;
      if (!lead) return json({ message: 'Lead not found.' }, 404);
      if (lead.is_listed_public) {
        await syncPublicListing(context, 'lead', lead, broker);
      } else {
        await removePublicListing(context, 'lead', lead.id);
      }
      return json({ lead: sanitizeLead(lead) });
    }

    if (action === 'delete-lead') {
      const id = Number(body?.id || 0);
      if (!id) return json({ message: 'Lead id is required.' }, 400);
      await removePublicListing(context, 'lead', id);
      await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id }
      });
      return json({ success: true });
    }

    if (action === 'create-property') {
      const baseLog = prependActivityLog([], 'Listing created in the CRM workspace.', 'created');
      const payload = {
        ...getPropertyPayload(body, broker.id, null, { activityLog: baseLog }),
        created_at: nowIso()
      };
      const rows = await safeSupabaseInsertWithPropertyDimensions({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        payload: [payload]
      });
      const property = Array.isArray(rows) ? rows[0] : null;
      if (property?.is_listed_public) {
        await syncPublicListing(context, 'property', property, broker);
      }
      return json({ property: sanitizeProperty(property) });
    }

    if (action === 'update-property') {
      const id = Number(body?.id || 0);
      if (!id) return json({ message: 'Property id is required.' }, 400);
      const existingProperty = await fetchBrokerRow(context, 'broker_properties', id);
      if (!existingProperty) return json({ message: 'Property not found.' }, 404);

      const activityLog = buildPropertyActivityLog(existingProperty, body, [{ text: 'Listing details updated.', type: 'updated' }]);
      const rows = await safeSupabasePatchWithPropertyDimensions({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: getPropertyPayload(body, broker.id, existingProperty, { activityLog })
      });
      const property = Array.isArray(rows) ? rows[0] : null;
      if (!property) return json({ message: 'Property not found.' }, 404);
      if (property.is_listed_public) {
        await syncPublicListing(context, 'property', property, broker);
      } else {
        await removePublicListing(context, 'property', property.id);
      }
      return json({ property: sanitizeProperty(property) });
    }

    if (action === 'delete-property') {
      const id = Number(body?.id || 0);
      if (!id) return json({ message: 'Property id is required.' }, 400);
      await removePublicListing(context, 'property', id);
      await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id }
      });
      return json({ success: true });
    }

    if (action === 'list-item' || action === 'unlist-item') {
      const entityType = normalizeText(body?.entityType).toLowerCase();
      const entityId = Number(body?.id || 0);
      if (!['lead', 'property'].includes(entityType) || !entityId) {
        return json({ message: 'Entity type and id are required.' }, 400);
      }

      const table = entityType === 'lead' ? 'broker_leads' : 'broker_properties';
      const row = await fetchBrokerRow(context, table, entityId);
      if (!row) {
        return json({ message: 'Item not found.' }, 404);
      }

      if (entityType === 'lead') {
        const meta = getLeadMeta({}, row, {
          activityLog: prependActivityLog(parseLeadMeta(row.follow_up_notes).activityLog, action === 'list-item' ? 'Listed on Broker Connector Page.' : 'Removed from Broker Connector Page.', action === 'list-item' ? 'share' : 'unshare')
        });
        const rows = await supabasePatch({
          supabaseUrl,
          serviceRoleKey,
          table,
          filters: { id: entityId, broker_uuid: broker.id },
          payload: {
            is_listed_public: action === 'list-item',
            public_listing_status: action === 'list-item' ? 'listed' : 'private',
            follow_up_notes: serializeLeadMeta(meta),
            updated_at: nowIso()
          }
        });
        const item = Array.isArray(rows) ? rows[0] : null;
        if (!item) return json({ message: 'Item not found.' }, 404);
        if (action === 'list-item') await syncPublicListing(context, entityType, item, broker);
        else await removePublicListing(context, entityType, entityId);
        return json({ success: true });
      }

      const meta = getPropertyMeta({}, row, {
        activityLog: prependActivityLog(parsePropertyMeta(row.description).activityLog, action === 'list-item' ? 'Listed on Broker Connector Page.' : 'Removed from Broker Connector Page.', action === 'list-item' ? 'share' : 'unshare')
      });
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table,
        filters: { id: entityId, broker_uuid: broker.id },
        payload: {
          is_listed_public: action === 'list-item',
          public_listing_status: action === 'list-item' ? 'listed' : 'private',
          description: serializePropertyMeta(meta),
          updated_at: nowIso()
        }
      });
      const item = Array.isArray(rows) ? rows[0] : null;
      if (!item) return json({ message: 'Item not found.' }, 404);
      if (action === 'list-item') await syncPublicListing(context, entityType, item, broker);
      else await removePublicListing(context, entityType, entityId);
      return json({ success: true });
    }

    if (action === 'update-lead-status') {
      const id = Number(body?.id || 0);
      const lead = await fetchBrokerRow(context, 'broker_leads', id);
      if (!lead) return json({ message: 'Lead not found.' }, 404);
      const nextStatus = normalizeLeadStatus(body?.status);
      const activityLog = prependActivityLog(parseLeadMeta(lead.follow_up_notes).activityLog, `Status changed from ${formatStatusLabel(lead.status)} to ${formatStatusLabel(nextStatus)}.`, 'status');
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: {
          status: nextStatus,
          follow_up_notes: serializeLeadMeta(getLeadMeta({}, lead, { activityLog })),
          updated_at: nowIso()
        }
      });
      return json({ lead: sanitizeLead(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'update-property-status') {
      const id = Number(body?.id || 0);
      const property = await fetchBrokerRow(context, 'broker_properties', id);
      if (!property) return json({ message: 'Listing not found.' }, 404);
      const nextStatus = normalizeListingStatus(body?.status);
      const activityLog = prependActivityLog(parsePropertyMeta(property.description).activityLog, `Status changed from ${formatStatusLabel(property.status)} to ${formatStatusLabel(nextStatus)}.`, 'status');
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: {
          status: nextStatus,
          description: serializePropertyMeta(getPropertyMeta({}, property, { activityLog })),
          updated_at: nowIso()
        }
      });
      return json({ property: sanitizeProperty(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'get-property-media') {
      const propertyId = Number(body?.id || body?.propertyId || body?.sourceId || body?.listingId || 0);
      if (!propertyId) {
        return json({ message: 'Property id is required.' }, 400);
      }
      const property = await fetchBrokerRow(context, 'broker_properties', propertyId);
      if (!property) {
        return json({ message: 'Listing not found.' }, 404);
      }
      const meta = parsePropertyMeta(property.description);
      return json({
        images: Array.isArray(meta.listingImages) ? meta.listingImages : [],
        count: Array.isArray(meta.listingImages) ? meta.listingImages.length : 0
      });
    }

    if (action === 'set-property-media') {
      const propertyId = Number(body?.id || body?.propertyId || body?.sourceId || body?.listingId || 0);
      if (!propertyId) {
        return json({ message: 'Property id is required.' }, 400);
      }
      const property = await fetchBrokerRow(context, 'broker_properties', propertyId);
      if (!property) {
        return json({ message: 'Listing not found.' }, 404);
      }
      const meta = getPropertyMeta({ listingImages: body?.listingImages }, property);
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id: propertyId, broker_uuid: broker.id },
        payload: {
          description: serializePropertyMeta(meta),
          updated_at: nowIso()
        }
      });
      const item = Array.isArray(rows) ? rows[0] : null;
      if (!item) {
        return json({ message: 'Listing not found.' }, 404);
      }
      if (item.is_listed_public) {
        await syncPublicListing(context, 'property', item, broker);
      }
      const nextMeta = parsePropertyMeta(item.description);
      return json({
        images: Array.isArray(nextMeta.listingImages) ? nextMeta.listingImages : [],
        count: Array.isArray(nextMeta.listingImages) ? nextMeta.listingImages.length : 0,
        property: sanitizeProperty(item)
      });
    }

    if (action === 'set-lead-followup') {
      const id = Number(body?.id || 0);
      const lead = await fetchBrokerRow(context, 'broker_leads', id);
      if (!lead) return json({ message: 'Lead not found.' }, 404);
      const activityLog = prependActivityLog(
        parseLeadMeta(lead.follow_up_notes).activityLog,
        buildFollowUpText(body?.nextFollowUpDate, body?.nextFollowUpTime, normalizeBool(body?.isUrgentFollowUp)),
        'followup'
      );
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: {
          follow_up_notes: serializeLeadMeta(getLeadMeta(body, lead, { activityLog })),
          updated_at: nowIso()
        }
      });
      return json({ lead: sanitizeLead(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'set-property-followup') {
      const id = Number(body?.id || 0);
      const property = await fetchBrokerRow(context, 'broker_properties', id);
      if (!property) return json({ message: 'Listing not found.' }, 404);
      const activityLog = prependActivityLog(
        parsePropertyMeta(property.description).activityLog,
        buildFollowUpText(body?.nextFollowUpDate, body?.nextFollowUpTime, normalizeBool(body?.isUrgentFollowUp)),
        'followup'
      );
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: {
          description: serializePropertyMeta(getPropertyMeta(body, property, { activityLog })),
          updated_at: nowIso()
        }
      });
      return json({ property: sanitizeProperty(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'track-lead-contact') {
      const id = Number(body?.id || 0);
      const lead = await fetchBrokerRow(context, 'broker_leads', id);
      if (!lead) return json({ message: 'Lead not found.' }, 404);
      const meta = parseLeadMeta(lead.follow_up_notes);
      const method = normalizeText(body?.method || 'manual');
      const updates = {
        callCount: method.toLowerCase() === 'call' ? meta.callCount + 1 : meta.callCount,
        whatsappCount: method.toLowerCase() === 'whatsapp' ? meta.whatsappCount + 1 : meta.whatsappCount,
        lastContactedAt: nowIso(),
        lastContactMethod: method,
        activityLog: prependActivityLog(meta.activityLog, formatContactLog(method), 'contact')
      };
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: {
          follow_up_notes: serializeLeadMeta(getLeadMeta({}, lead, updates)),
          updated_at: nowIso()
        }
      });
      return json({ lead: sanitizeLead(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'track-property-contact') {
      const id = Number(body?.id || 0);
      const property = await fetchBrokerRow(context, 'broker_properties', id);
      if (!property) return json({ message: 'Listing not found.' }, 404);
      const meta = parsePropertyMeta(property.description);
      const method = normalizeText(body?.method || 'manual');
      const updates = {
        ownerCallCount: method.toLowerCase() === 'call' ? meta.ownerCallCount + 1 : meta.ownerCallCount,
        ownerWhatsappCount: method.toLowerCase() === 'whatsapp' ? meta.ownerWhatsappCount + 1 : meta.ownerWhatsappCount,
        lastOwnerContactedAt: nowIso(),
        lastOwnerContactMethod: method,
        activityLog: prependActivityLog(meta.activityLog, formatContactLog(method, true), 'contact')
      };
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: {
          description: serializePropertyMeta(getPropertyMeta({}, property, updates)),
          updated_at: nowIso()
        }
      });
      return json({ property: sanitizeProperty(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'archive-lead' || action === 'restore-lead') {
      const id = Number(body?.id || 0);
      const lead = await fetchBrokerRow(context, 'broker_leads', id);
      if (!lead) return json({ message: 'Lead not found.' }, 404);
      const isArchiving = action === 'archive-lead';
      const meta = getLeadMeta({}, lead, {
        isArchived: isArchiving,
        archivedAt: isArchiving ? nowIso() : '',
        activityLog: prependActivityLog(parseLeadMeta(lead.follow_up_notes).activityLog, isArchiving ? 'Lead archived.' : 'Lead restored from archive.', isArchiving ? 'archive' : 'restore')
      });
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: {
          follow_up_notes: serializeLeadMeta(meta),
          is_listed_public: isArchiving ? false : Boolean(lead.is_listed_public),
          public_listing_status: isArchiving ? 'private' : (lead.public_listing_status || 'private'),
          updated_at: nowIso()
        }
      });
      if (isArchiving) {
        await removePublicListing(context, 'lead', id);
      }
      return json({ lead: sanitizeLead(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'archive-property' || action === 'restore-property') {
      const id = Number(body?.id || 0);
      const property = await fetchBrokerRow(context, 'broker_properties', id);
      if (!property) return json({ message: 'Listing not found.' }, 404);
      const isArchiving = action === 'archive-property';
      const meta = getPropertyMeta({}, property, {
        isArchived: isArchiving,
        archivedAt: isArchiving ? nowIso() : '',
        activityLog: prependActivityLog(parsePropertyMeta(property.description).activityLog, isArchiving ? 'Listing archived.' : 'Listing restored from archive.', isArchiving ? 'archive' : 'restore')
      });
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: {
          description: serializePropertyMeta(meta),
          is_listed_public: isArchiving ? false : Boolean(property.is_listed_public),
          public_listing_status: isArchiving ? 'private' : (property.public_listing_status || 'private'),
          updated_at: nowIso()
        }
      });
      if (isArchiving) {
        await removePublicListing(context, 'property', id);
      }
      return json({ property: sanitizeProperty(Array.isArray(rows) ? rows[0] : null) });
    }

    if (action === 'list-saved-filters') {
      const rows = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'saved_filters',
        filters: { user_id: broker.id },
        order: { column: 'updated_at', ascending: false }
      });
      return json({
        savedFilters: (Array.isArray(rows) ? rows : [])
          .map(sanitizeSavedFilterRecord)
          .filter(Boolean)
      });
    }

    if (action === 'create-saved-filter') {
      const payload = buildCreateSavedFilterPayload(body, broker.id);
      const rows = await supabaseInsert({
        supabaseUrl,
        serviceRoleKey,
        table: 'saved_filters',
        payload: [payload]
      });
      return json({
        savedFilter: sanitizeSavedFilterRecord(Array.isArray(rows) ? rows[0] : null)
      });
    }

    if (action === 'update-saved-filter') {
      const id = normalizeText(body?.id);
      if (!id) {
        return json({ message: 'Saved filter id is required.' }, 400);
      }
      const existingRows = await supabaseSelect({
        supabaseUrl,
        serviceRoleKey,
        table: 'saved_filters',
        filters: { id, user_id: broker.id }
      });
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      if (!existing) {
        return json({ message: 'Saved filter not found.' }, 404);
      }
      const payload = buildUpdateSavedFilterPayload(body, existing);
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'saved_filters',
        filters: { id, user_id: broker.id },
        payload
      });
      return json({
        savedFilter: sanitizeSavedFilterRecord(Array.isArray(rows) ? rows[0] : null)
      });
    }

    if (action === 'delete-saved-filter') {
      const id = normalizeText(body?.id);
      if (!id) {
        return json({ message: 'Saved filter id is required.' }, 400);
      }
      const rows = await supabaseDelete({
        supabaseUrl,
        serviceRoleKey,
        table: 'saved_filters',
        filters: { id, user_id: broker.id }
      });
      const deleted = Array.isArray(rows) ? rows[0] : null;
      if (!deleted) {
        return json({ message: 'Saved filter not found.' }, 404);
      }
      return json({ success: true });
    }

    if (action === 'save-followup') {
      const payload = getFollowUpPayload(body, broker.id);
      if (!payload.entity_type || !payload.entity_id) {
        return json({ message: 'Follow-up entity information is required.' }, 400);
      }
      const rows = await supabaseInsert({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_followups',
        payload: [payload]
      });
      return json({ followUp: sanitizeFollowUp(Array.isArray(rows) ? rows[0] : null) });
    }

    return json({ message: 'Unsupported dashboard action.' }, 400);
  } catch (error) {
    return json({ message: error.message || 'Broker dashboard action failed.' }, error.status || 500);
  }
}
