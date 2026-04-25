import crypto from 'node:crypto';

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders
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

const PROPERTY_TYPE_ALIASES = Object.freeze({
  apartment: 'Apartment',
  studio: 'Studio',
  '1bhk': '1 BHK',
  '1 bhk': '1 BHK',
  '1br': '1 BHK',
  '1 br': '1 BHK',
  '1 bedroom': '1 BHK',
  '2bhk': '2 BHK',
  '2 bhk': '2 BHK',
  '2br': '2 BHK',
  '2 br': '2 BHK',
  '2 bedroom': '2 BHK',
  '3bhk': '3 BHK',
  '3 bhk': '3 BHK',
  '3br': '3 BHK',
  '3 br': '3 BHK',
  '3 bedroom': '3 BHK',
  '4bhk': '4 BHK',
  '4 bhk': '4 BHK',
  '4br': '4 BHK',
  '4 br': '4 BHK',
  '4 bedroom': '4 BHK',
  '5bhk': '5 BHK',
  '5 bhk': '5 BHK',
  '5br': '5 BHK',
  '5 br': '5 BHK',
  '5 bedroom': '5 BHK',
  '5+bhk': '5+ BHK',
  '5+ bhk': '5+ BHK',
  '6bhk': '6+ BHK',
  '6 bhk': '6+ BHK',
  '6br': '6+ BHK',
  '6 br': '6+ BHK',
  '6 bedroom': '6+ BHK',
  '6+': '6+ BHK',
  '6+ bhk': '6+ BHK',
  villa: 'Villa',
  townhouse: 'Townhouse',
  penthouse: 'Penthouse',
  duplex: 'Duplex',
  office: 'Office',
  shop: 'Shop / Retail',
  retail: 'Shop / Retail',
  'shop / retail': 'Shop / Retail',
  warehouse: 'Warehouse',
  'labour camp': 'Labour Camp',
  labourcamp: 'Labour Camp',
  land: 'Land / Plot',
  plot: 'Land / Plot',
  'land / plot': 'Land / Plot',
  building: 'Building',
  'full floor': 'Full Floor',
  'hotel apartment': 'Hotel Apartment',
  'room / bedspace / partition': 'Room / Bedspace / Partition',
  room: 'Room / Bedspace / Partition',
  bedspace: 'Room / Bedspace / Partition',
  partition: 'Room / Bedspace / Partition',
  other: 'Other'
});

const PROPERTY_CATEGORY_VALUES = Object.freeze([
  'Apartment',
  'Villa',
  'Townhouse',
  'Office',
  'Shop / Retail',
  'Warehouse',
  'Land / Plot',
  'Other'
]);

const UNIT_LAYOUT_VALUES = Object.freeze([
  'Studio',
  '1 BHK',
  '2 BHK',
  '3 BHK',
  '4 BHK',
  '5 BHK',
  '6+ BHK',
  'N/A'
]);

const PROPERTY_CATEGORY_ALIASES = Object.freeze({
  apartment: 'Apartment',
  flat: 'Apartment',
  villa: 'Villa',
  townhouse: 'Townhouse',
  office: 'Office',
  shop: 'Shop / Retail',
  retail: 'Shop / Retail',
  'shop / retail': 'Shop / Retail',
  warehouse: 'Warehouse',
  land: 'Land / Plot',
  plot: 'Land / Plot',
  'land / plot': 'Land / Plot',
  other: 'Other'
});

const UNIT_LAYOUT_ALIASES = Object.freeze({
  studio: 'Studio',
  '1bhk': '1 BHK',
  '1 bhk': '1 BHK',
  '1br': '1 BHK',
  '1 br': '1 BHK',
  '1 bedroom': '1 BHK',
  '2bhk': '2 BHK',
  '2 bhk': '2 BHK',
  '2br': '2 BHK',
  '2 br': '2 BHK',
  '2 bedroom': '2 BHK',
  '3bhk': '3 BHK',
  '3 bhk': '3 BHK',
  '3br': '3 BHK',
  '3 br': '3 BHK',
  '3 bedroom': '3 BHK',
  '4bhk': '4 BHK',
  '4 bhk': '4 BHK',
  '4br': '4 BHK',
  '4 br': '4 BHK',
  '4 bedroom': '4 BHK',
  '5bhk': '5 BHK',
  '5 bhk': '5 BHK',
  '5br': '5 BHK',
  '5 br': '5 BHK',
  '5 bedroom': '5 BHK',
  '5+bhk': '6+ BHK',
  '5+ bhk': '6+ BHK',
  '6bhk': '6+ BHK',
  '6 bhk': '6+ BHK',
  '6br': '6+ BHK',
  '6 br': '6+ BHK',
  '6 bedroom': '6+ BHK',
  '6+': '6+ BHK',
  '6+ bhk': '6+ BHK',
  'n/a': 'N/A',
  na: 'N/A',
  'not applicable': 'N/A'
});

const SALE_PROPERTY_STATUS_VALUES = Object.freeze([
  'Ready Property',
  'Off Plan Property'
]);

const SALE_PROPERTY_STATUS_ALIASES = Object.freeze({
  ready: 'Ready Property',
  'ready property': 'Ready Property',
  offplan: 'Off Plan Property',
  'off plan': 'Off Plan Property',
  'off plan property': 'Off Plan Property'
});

const HANDOVER_QUARTER_VALUES = Object.freeze(['Q1', 'Q2', 'Q3', 'Q4']);

const HANDOVER_QUARTER_ALIASES = Object.freeze({
  q1: 'Q1',
  q2: 'Q2',
  q3: 'Q3',
  q4: 'Q4'
});

const LOCATION_ALIASES = Object.freeze({
  'jumeirah village circle': 'JVC',
  jvc: 'JVC',
  'jumeirah village triangle': 'JVT',
  jvt: 'JVT',
  'jumeirah lakes towers': 'JLT',
  jlt: 'JLT',
  impz: 'Dubai Production City',
  meaisem: "Me'aisem",
  "me'aisem": "Me'aisem",
  dso: 'Dubai Silicon Oasis',
  'dubai silicon oasis': 'Dubai Silicon Oasis',
  dlrc: 'Dubai Land Residence Complex',
  nahda: 'Nahda',
  'dubai marina': 'Dubai Marina',
  'business bay': 'Business Bay',
  'downtown dubai': 'Downtown Dubai'
});

const STATUS_ALIASES = Object.freeze({
  connected: 'contacted',
  contacted: 'contacted',
  followup: 'follow-up',
  'follow up': 'follow-up',
  meeting: 'meeting scheduled',
  'meeting scheduled': 'meeting scheduled',
  negotiation: 'negotiation',
  'closed won': 'closed won',
  won: 'closed won',
  'closed lost': 'closed lost',
  lost: 'closed lost',
  inactive: 'inactive',
  available: 'available',
  reserved: 'reserved',
  rented: 'rented',
  sold: 'sold',
  offmarket: 'off market',
  'off market': 'off market',
  draft: 'draft',
  active: 'active',
  private: 'private',
  shared: 'shared',
  listed: 'listed',
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
  suspended: 'suspended'
});

const LEAD_STATUS_VALUES = new Set([
  'new',
  'contacted',
  'follow-up',
  'meeting scheduled',
  'negotiation',
  'closed won',
  'closed lost',
  'inactive'
]);

const LISTING_STATUS_VALUES = new Set([
  'available',
  'reserved',
  'rented',
  'sold',
  'off market',
  'draft'
]);

const CONNECTOR_STATUS_VALUES = new Set([
  ...LEAD_STATUS_VALUES,
  ...LISTING_STATUS_VALUES,
  'active',
  'private',
  'shared',
  'listed',
  'pending'
]);

export function normalizeTaxonomyToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, ' / ')
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePropertyTypeValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  return PROPERTY_TYPE_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
}

export function normalizePropertyCategoryValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  const normalized = PROPERTY_CATEGORY_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
  return PROPERTY_CATEGORY_VALUES.includes(normalized) ? normalized : '';
}

export function normalizeUnitLayoutValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  const normalized = UNIT_LAYOUT_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
  return UNIT_LAYOUT_VALUES.includes(normalized) ? normalized : '';
}

export function normalizeSalePropertyStatusValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  const normalized = SALE_PROPERTY_STATUS_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
  return SALE_PROPERTY_STATUS_VALUES.includes(normalized) ? normalized : '';
}

export function normalizeHandoverQuarterValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  const normalized = HANDOVER_QUARTER_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ').toUpperCase();
  return HANDOVER_QUARTER_VALUES.includes(normalized) ? normalized : '';
}

export function normalizeHandoverYearValue(value) {
  const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 4);
  return digits.length === 4 ? digits : '';
}

export function formatPropertyHandoverLabel(source) {
  const quarter = normalizeHandoverQuarterValue(
    source?.handoverQuarter
    || source?.handover_quarter
    || source?.quarter
    || ''
  );
  const year = normalizeHandoverYearValue(
    source?.handoverYear
    || source?.handover_year
    || source?.year
    || ''
  );
  return quarter && year ? `${quarter} ${year}` : '';
}

export function derivePropertyDimensions(source, options = {}) {
  const record = source && typeof source === 'object' ? source : { propertyType: source };
  let propertyCategory = normalizePropertyCategoryValue(record?.propertyCategory || record?.property_category);
  let unitLayout = normalizeUnitLayoutValue(record?.unitLayout || record?.unit_layout);

  const legacyPropertyType = normalizePropertyTypeValue(
    record?.propertyType
    || record?.property_type
    || record?.category
    || (options.includeLeadType ? record?.lead_type : '')
    || ''
  );

  const inferredLayout = normalizeUnitLayoutValue(legacyPropertyType);
  const inferredCategory = normalizePropertyCategoryValue(legacyPropertyType);

  if (!unitLayout && inferredLayout) {
    unitLayout = inferredLayout;
  }
  if (!propertyCategory && inferredLayout) {
    propertyCategory = 'Apartment';
  }
  if (!propertyCategory && inferredCategory) {
    propertyCategory = inferredCategory;
  }
  if (!propertyCategory && unitLayout) {
    propertyCategory = unitLayout === 'N/A' ? 'Other' : 'Apartment';
  }
  if (!unitLayout && propertyCategory) {
    unitLayout = 'N/A';
  }
  if (!propertyCategory && legacyPropertyType) {
    propertyCategory = 'Other';
  }
  if (!unitLayout && legacyPropertyType) {
    unitLayout = 'N/A';
  }

  return {
    propertyCategory,
    unitLayout,
    legacyPropertyType
  };
}

export function getDisplayPropertyType(record) {
  const directValue = normalizePropertyTypeValue(
    record?.propertyType
    || record?.property_type
    || record?.legacyPropertyType
    || record?.category
    || ''
  );
  if (directValue) return directValue;
  const dimensions = derivePropertyDimensions(record, { includeLeadType: true });
  if (dimensions.unitLayout && dimensions.unitLayout !== 'N/A') {
    return dimensions.unitLayout;
  }
  return dimensions.propertyCategory || '';
}

export function getDisplayPropertyCategory(record) {
  return derivePropertyDimensions(record, { includeLeadType: true }).propertyCategory || '';
}

export function getDisplayUnitLayout(record) {
  return derivePropertyDimensions(record, { includeLeadType: true }).unitLayout || '';
}

export function getPropertyDimensionDbFields(source, options = {}) {
  const dimensions = derivePropertyDimensions(source, options);
  return {
    property_category: dimensions.propertyCategory || null,
    unit_layout: dimensions.unitLayout || null
  };
}

export function stripPropertyDimensionFields(payload) {
  if (Array.isArray(payload)) {
    return payload.map(item => stripPropertyDimensionFields(item));
  }
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const clone = { ...payload };
  delete clone.property_category;
  delete clone.unit_layout;
  delete clone.sale_property_status;
  delete clone.handover_quarter;
  delete clone.handover_year;
  delete clone.market_price;
  delete clone.distress_gap_percent;
  return clone;
}

export function isPropertyDimensionColumnError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('property_category')
    || message.includes('unit_layout')
    || message.includes('sale_property_status')
    || message.includes('handover_quarter')
    || message.includes('handover_year')
    || message.includes('market_price')
    || message.includes('distress_gap_percent')
  );
}

export function normalizeLocationValue(value) {
  const rawValue = normalizeText(value);
  if (!rawValue) return '';
  return LOCATION_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
}

export function normalizeLeadStatusValue(value, fallback = 'new') {
  const normalized = STATUS_ALIASES[normalizeTaxonomyToken(value)] || normalizeTaxonomyToken(value);
  return LEAD_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

export function normalizeListingStatusValue(value, fallback = 'available') {
  const normalized = STATUS_ALIASES[normalizeTaxonomyToken(value)] || normalizeTaxonomyToken(value);
  return LISTING_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

export function normalizeConnectorStatusValue(value, fallback = 'active') {
  const normalized = STATUS_ALIASES[normalizeTaxonomyToken(value)] || normalizeTaxonomyToken(value);
  return CONNECTOR_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function parseMoneyLikeValue(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function calculateDistressGapPercentValue(marketPrice, askingPrice) {
  const market = parseMoneyLikeValue(marketPrice);
  const asking = parseMoneyLikeValue(askingPrice);
  if (!market || !asking || asking >= market) return '';
  const discount = Math.round(((market - asking) / market) * 100);
  return discount > 0 ? String(discount) : '';
}

export function normalizeListingPurposeValue(value) {
  const normalized = normalizeTaxonomyToken(value);
  if (normalized === 'rent' || normalized === 'rental') return 'rent';
  if (normalized === 'sale' || normalized === 'sell' || normalized === 'selling') return 'sale';
  return '';
}

export function normalizeDecimalValue(value) {
  const rawValue = normalizeText(value).replace(/,/g, '.');
  const sanitized = rawValue.replace(/[^\d.]/g, '');
  if (!sanitized) return '';
  const hasTrailingDot = sanitized.endsWith('.');
  const parts = sanitized.split('.');
  const whole = parts.shift() || '';
  const decimal = parts.join('');
  if (!decimal) return hasTrailingDot ? `${whole}.` : whole;
  return `${whole}.${decimal}`
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '');
}

export function normalizeSizeUnit(value) {
  return normalizeText(value).toLowerCase() === 'sqm' ? 'sqm' : 'sqft';
}

export function formatSizeLabel(value, unit = 'sqft') {
  const normalizedValue = normalizeDecimalValue(value);
  if (!normalizedValue) return '';
  return `${normalizedValue} ${normalizeSizeUnit(unit)}`;
}

export function normalizeBool(value) {
  return Boolean(value);
}

const BROKER_ACTIVITY_THRESHOLDS_MS = Object.freeze({
  online: 2 * 60 * 1000,
  active: 10 * 60 * 1000,
  recent: 60 * 60 * 1000
});

export function deriveBrokerActivity(lastActivity, now = Date.now()) {
  const timestamp = normalizeText(lastActivity);
  const parsedTime = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(parsedTime)) {
    return {
      key: 'offline',
      isOnline: false,
      isActive: false,
      isRecent: false,
      ageMs: Infinity
    };
  }

  const ageMs = Math.max(0, now - parsedTime);
  if (ageMs < BROKER_ACTIVITY_THRESHOLDS_MS.online) {
    return {
      key: 'online',
      isOnline: true,
      isActive: true,
      isRecent: true,
      ageMs
    };
  }
  if (ageMs < BROKER_ACTIVITY_THRESHOLDS_MS.active) {
    return {
      key: 'active',
      isOnline: false,
      isActive: true,
      isRecent: true,
      ageMs
    };
  }
  if (ageMs < BROKER_ACTIVITY_THRESHOLDS_MS.recent) {
    return {
      key: 'recent',
      isOnline: false,
      isActive: false,
      isRecent: true,
      ageMs
    };
  }

  return {
    key: 'offline',
    isOnline: false,
    isActive: false,
    isRecent: false,
    ageMs
  };
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
      sizeUnit: 'sqft',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      salePropertyStatus: '',
      handoverQuarter: '',
      handoverYear: '',
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
      sizeUnit: 'sqft',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      salePropertyStatus: '',
      handoverQuarter: '',
      handoverYear: '',
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
      sizeUnit: normalizeSizeUnit(parsed?.sizeUnit),
      furnishing: normalizeText(parsed?.furnishing),
      cheques: normalizeText(parsed?.cheques),
      chiller: normalizeText(parsed?.chiller),
      mortgageStatus: normalizeText(parsed?.mortgageStatus),
      leasehold: Boolean(parsed?.leasehold),
      salePropertyStatus: normalizeSalePropertyStatusValue(parsed?.salePropertyStatus || parsed?.sale_property_status),
      handoverQuarter: normalizeHandoverQuarterValue(parsed?.handoverQuarter || parsed?.handover_quarter),
      handoverYear: normalizeHandoverYearValue(parsed?.handoverYear || parsed?.handover_year),
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
      sizeUnit: 'sqft',
      furnishing: '',
      cheques: '',
      chiller: '',
      mortgageStatus: '',
      leasehold: false,
      salePropertyStatus: '',
      handoverQuarter: '',
      handoverYear: '',
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
    sizeUnit: normalizeSizeUnit(meta?.sizeUnit),
    furnishing: normalizeText(meta?.furnishing),
    cheques: normalizeText(meta?.cheques),
    chiller: normalizeText(meta?.chiller),
    mortgageStatus: normalizeText(meta?.mortgageStatus),
    leasehold: Boolean(meta?.leasehold),
    salePropertyStatus: normalizeSalePropertyStatusValue(meta?.salePropertyStatus || meta?.sale_property_status),
    handoverQuarter: normalizeHandoverQuarterValue(meta?.handoverQuarter || meta?.handover_quarter),
    handoverYear: normalizeHandoverYearValue(meta?.handoverYear || meta?.handover_year),
    marketPrice: normalizeText(meta?.marketPrice),
    distressAskingPrice: normalizeText(meta?.distressAskingPrice),
    distressDiscountPercent: normalizeText(meta?.distressDiscountPercent),
    legacyDescription: normalizeText(meta?.legacyDescription),
    workflow
  };

  if (
    !payload.buildingName &&
    !payload.floorLevel &&
    payload.sizeUnit === 'sqft' &&
    !payload.furnishing &&
    !payload.cheques &&
    !payload.chiller &&
    !payload.mortgageStatus &&
    !payload.leasehold &&
    !payload.salePropertyStatus &&
    !payload.handoverQuarter &&
    !payload.handoverYear &&
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
  const propertyType = getDisplayPropertyType({
    propertyType: item?.propertyType || item?.property_type || item?.category,
    propertyCategory: item?.propertyCategory || item?.property_category,
    unitLayout: item?.unitLayout || item?.unit_layout
  });
  const location = normalizeLocationValue(item?.location);
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

export function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
}

export async function supabaseAuthAdminGetUser({
  supabaseUrl,
  serviceRoleKey,
  userId
}) {
  if (!normalizeText(userId)) {
    throw new Error('Supabase admin user lookup requires a user ID.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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
      || 'Supabase admin user lookup failed.'
    );
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result?.user || result;
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

function isPostgrestOperatorValue(value) {
  const normalized = normalizeText(value);
  return /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|fts|plfts|phfts|wfts|not)\./i.test(normalized);
}

export function buildPostgrestInFilter(values = []) {
  const normalizedValues = Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => String(value ?? '').trim())
    .filter(Boolean)));

  if (!normalizedValues.length) return '';

  const serialized = normalizedValues.map(value => (
    /^-?\d+(\.\d+)?$/.test(value)
      ? value
      : `"${value.replace(/"/g, '\\"')}"`
  ));

  return `in.(${serialized.join(',')})`;
}

export async function supabaseSelect({
  supabaseUrl,
  serviceRoleKey,
  table,
  select = '*',
  filters = {},
  order,
  signal
  }) {
    const url = createRestUrl(supabaseUrl, table);
    url.searchParams.set('select', select);
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (isPostgrestOperatorValue(value)) {
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
    },
    signal
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
  payload,
  signal
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
    body: JSON.stringify(payload),
    signal
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
      if (isPostgrestOperatorValue(value)) {
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

  const lastActivity = normalizeText(broker.last_activity);
  const parsedLastActivity = lastActivity ? Date.parse(lastActivity) : NaN;
  const shouldTouchActivity = !Number.isFinite(parsedLastActivity) || (Date.now() - parsedLastActivity) >= 60 * 1000;
  if (shouldTouchActivity) {
    const nextLastActivity = new Date().toISOString();
    try {
      await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'brokers',
        filters: { id: broker.id },
        payload: {
          last_activity: nextLastActivity
        }
      });
      broker.last_activity = nextLastActivity;
    } catch (error) {
      broker.last_activity = lastActivity;
    }
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
  const purpose = isLead
    ? normalizeLeadClientPurpose(item.clientPurpose || item.purpose)
    : normalizeListingPurposeValue(item.purpose);
  const dimensions = derivePropertyDimensions({
    propertyCategory: item?.propertyCategory || item?.property_category,
    unitLayout: item?.unitLayout || item?.unit_layout,
    propertyType: item?.propertyType || item?.property_type || item?.category,
    category: item?.category,
    lead_type: item?.lead_type
  }, { includeLeadType: isLead });
  const propertyType = getDisplayPropertyType({
    propertyType: item?.propertyType || item?.property_type || item?.category,
    propertyCategory: dimensions.propertyCategory,
    unitLayout: dimensions.unitLayout
  });
  const category = propertyType;
  const location = normalizeLocationValue(item.location);
  const priceLabel = isLead ? normalizeText(item.budget) : normalizeText(item.price);
  const propertyMeta = !isLead ? parsePropertyMeta(item.description) : null;
  const salePropertyStatus = !isLead
    ? normalizeSalePropertyStatusValue(
      item?.salePropertyStatus
      || item?.sale_property_status
      || propertyMeta?.salePropertyStatus
      || (purpose === 'sale' ? 'Ready Property' : '')
    )
    : '';
  const handoverQuarter = !isLead
    ? normalizeHandoverQuarterValue(item?.handoverQuarter || item?.handover_quarter || propertyMeta?.handoverQuarter)
    : '';
  const handoverYear = !isLead
    ? normalizeHandoverYearValue(item?.handoverYear || item?.handover_year || propertyMeta?.handoverYear)
    : '';
  const marketPrice = !isLead
    ? normalizeText(item?.marketPrice || item?.market_price || propertyMeta?.marketPrice)
    : '';
  const distressGapPercent = !isLead
    ? normalizeText(item?.distressGapPercent || item?.distress_gap_percent || item?.distressDiscountPercent || propertyMeta?.distressDiscountPercent)
    : '';
  const projectOrBuilding = isLead
    ? normalizeText(item.preferredBuildingProject)
    : normalizeText(item.buildingName || propertyMeta?.buildingName);
  const sizeLabel = !isLead
    ? formatSizeLabel(item.sizeSqft || item.size, item.sizeUnit || propertyMeta?.sizeUnit)
    : '';
  const generalNotes = isLead
    ? normalizeText(item.public_general_notes || buildLeadPublicSummary(item))
    : normalizeText(item.public_notes);
  const status = isLead
    ? normalizeLeadStatusValue(item.status || 'new')
    : normalizeListingStatusValue(item.status || 'available');
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
    property_category: dimensions.propertyCategory || null,
    unit_layout: dimensions.unitLayout || null,
    sale_property_status: salePropertyStatus || null,
    handover_quarter: handoverQuarter || null,
    handover_year: handoverYear || null,
    market_price: marketPrice || null,
    distress_gap_percent: distressGapPercent || null,
    location,
    price_label: priceLabel,
    size_label: isLead ? projectOrBuilding : sizeLabel,
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
  const propertyCategory = getDisplayPropertyCategory(row);
  const unitLayout = getDisplayUnitLayout(row);
  const propertyType = getDisplayPropertyType(row);
  const location = normalizeLocationValue(row.location);
  return {
    id: row.id,
    purpose: row.purpose,
    clientPurpose,
    category: propertyType,
    propertyType,
    propertyCategory,
    unitLayout,
    location,
    preferredLocation: location || '',
    budget: row.budget,
    notes: row.notes || '',
    privateNotes: row.notes || '',
    publicGeneralNotes: row.public_general_notes || '',
    leadType: row.lead_type,
    status: normalizeLeadStatusValue(row.status),
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
  const propertyCategory = getDisplayPropertyCategory(row);
  const unitLayout = getDisplayUnitLayout(row);
  const propertyType = getDisplayPropertyType(row);
  const location = normalizeLocationValue(row.location);
  const distressGapPercent = normalizeText(
    row.distress_gap_percent
    || meta.distressDiscountPercent
    || calculateDistressGapPercentValue(row.market_price || meta.marketPrice, row.price || meta.distressAskingPrice)
  );
  const salePropertyStatus = normalizeSalePropertyStatusValue(
    row.sale_property_status
    || meta.salePropertyStatus
    || (normalizeText(row.purpose).toLowerCase() === 'sale' ? 'Ready Property' : '')
  );
  const handoverQuarter = normalizeHandoverQuarterValue(row.handover_quarter || meta.handoverQuarter);
  const handoverYear = normalizeHandoverYearValue(row.handover_year || meta.handoverYear);
  const handoverLabel = formatPropertyHandoverLabel({ handoverQuarter, handoverYear });
  return {
    id: row.id,
    purpose: normalizeListingPurposeValue(row.purpose) || row.purpose,
    propertyType,
    category: propertyType,
    propertyCategory,
    unitLayout,
    location,
    price: row.price,
    rentPrice: normalizeText(row.purpose).toLowerCase() === 'rent' ? row.price || '' : '',
    ownerAskingPrice: normalizeText(row.purpose).toLowerCase() === 'sale' ? row.price || '' : '',
    size: normalizeDecimalValue(row.size),
    sizeSqft: normalizeDecimalValue(row.size),
    sizeUnit: normalizeSizeUnit(meta.sizeUnit),
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
    salePropertyStatus,
    handoverQuarter,
    handoverYear,
    handoverLabel,
    marketPrice: normalizeText(row.market_price || meta.marketPrice),
    distressAskingPrice: meta.distressAskingPrice || '',
    distressDiscountPercent: distressGapPercent,
    distressGapPercent,
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
    status: normalizeListingStatusValue(row.status),
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
    internalType: row.internal_type || row.internalType || '',
    internalId: row.internal_id ?? row.internalId ?? null,
    counterpartType: row.counterpart_type || row.counterpartType || '',
    counterpartSource: row.counterpart_source || row.counterpartSource || '',
    counterpartRecordId: row.counterpart_record_id ?? row.counterpartRecordId ?? null,
    counterpartSourceId: row.counterpart_source_id ?? row.counterpartSourceId ?? null,
    counterpartBrokerUuid: row.counterpart_broker_uuid || row.counterpartBrokerUuid || '',
    counterpartBrokerName: row.counterpart_broker_name || row.counterpartBrokerName || '',
    counterpartBrokerMobile: row.counterpart_broker_mobile || row.counterpartBrokerMobile || '',
    counterpartPurpose: row.counterpart_purpose || row.counterpartPurpose || '',
    counterpartPropertyType: row.counterpart_property_type || row.counterpartPropertyType || '',
    counterpartLocation: row.counterpart_location || row.counterpartLocation || '',
    counterpartBuilding: row.counterpart_building || row.counterpartBuilding || '',
    counterpartPriceLabel: row.counterpart_price_label || row.counterpartPriceLabel || '',
    counterpartPublicNotes: row.counterpart_public_notes || row.counterpartPublicNotes || '',
    counterpartSection: row.counterpart_section || row.counterpartSection || '',
    visibilityScope: row.visibility_scope || row.visibilityScope || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sanitizePublicListing(row, options = {}) {
  if (!row) return null;
  const exposeBrokerContact = Boolean(options?.exposeBrokerContact);
  const isLead = row.source_type === 'lead';
  const propertyCategory = getDisplayPropertyCategory(row);
  const unitLayout = getDisplayUnitLayout(row);
  const propertyType = getDisplayPropertyType(row);
  const location = normalizeLocationValue(row.location);
  const distressGapPercent = !isLead
    ? normalizeText(
        row.distress_gap_percent
        || calculateDistressGapPercentValue(row.market_price, row.price)
      )
    : '';
  const salePropertyStatus = !isLead
    ? normalizeSalePropertyStatusValue(
      row.sale_property_status
      || (normalizeText(row.purpose).toLowerCase() === 'sale' ? 'Ready Property' : '')
    )
    : '';
  const handoverQuarter = !isLead ? normalizeHandoverQuarterValue(row.handover_quarter) : '';
  const handoverYear = !isLead ? normalizeHandoverYearValue(row.handover_year) : '';
  const handoverLabel = !isLead ? formatPropertyHandoverLabel({ handoverQuarter, handoverYear }) : '';
  return {
    id: row.id,
    brokerUuid: exposeBrokerContact ? normalizeText(row.broker_uuid) : '',
    brokerIdNumber: exposeBrokerContact ? normalizeText(row.broker_id_number) : '',
    brokerName: exposeBrokerContact ? normalizeText(row.broker_display_name) : 'Broker Hidden',
    brokerMobile: exposeBrokerContact ? normalizeText(row.broker_mobile) : '',
    brokerLastActivity: exposeBrokerContact ? normalizeText(row.broker_last_activity) : '',
    brokerAvatarUrl: exposeBrokerContact ? normalizeText(row.broker_avatar_url || row.broker_avatar_data_url || row.broker_profile_image_url) : '',
    contactLocked: !exposeBrokerContact,
    sourceType: row.source_type,
    sourceId: row.source_id,
    listingKind: row.listing_kind,
    purpose: isLead ? normalizeLeadClientPurpose(row.purpose) : (normalizeListingPurposeValue(row.purpose) || row.purpose),
    propertyType,
    category: propertyType,
    propertyCategory,
    unitLayout,
    salePropertyStatus,
    handoverQuarter,
    handoverYear,
    handoverLabel,
    location,
    priceLabel: row.price_label,
    marketPrice: !isLead ? normalizeText(row.market_price) : '',
    distressDiscountPercent: distressGapPercent,
    distressGapPercent,
    buildingLabel: row.building_label || (row.source_type === 'lead' ? row.size_label : ''),
    sizeLabel: row.source_type === 'property' ? row.size_label || '' : '',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    publicNotes: row.public_notes,
    status: normalizeConnectorStatusValue(row.status),
    isUrgent: Boolean(row.is_urgent),
    isDistress: Boolean(row.is_distress),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
