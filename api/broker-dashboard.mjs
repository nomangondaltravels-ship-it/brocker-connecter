import {
  buildLeadPublicSummary,
  buildPublicListingPayload,
  json,
  normalizeBool,
  normalizePhoneNumber,
  normalizeText,
  requireBrokerSession,
  sanitizeAiMatch,
  sanitizeFollowUp,
  sanitizeLead,
  sanitizeNotification,
  sanitizeProperty,
  sanitizePublicListing,
  serializeLeadMeta,
  serializePropertyMeta,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect
} from './_broker-platform.mjs';

function getLeadPayload(body, brokerId) {
  const clientPurpose = normalizeText(body?.clientPurpose || body?.purpose).toLowerCase() === 'rent' ? 'rent' : 'buy';
  const purpose = clientPurpose === 'rent' ? 'rent' : 'sale';
  const propertyType = normalizeText(body?.propertyType || body?.category);
  const preferredBuildingProject = normalizeText(body?.preferredBuildingProject);
  const paymentMethod = clientPurpose === 'buy' ? normalizeText(body?.paymentMethod) : '';
  const legacyFollowUpNotes = normalizeText(body?.legacyFollowUpNotes);
  const serializedMeta = serializeLeadMeta({
    preferredBuildingProject,
    paymentMethod,
    legacyFollowUpNotes
  });
  const publicGeneralNotes = normalizeText(body?.publicGeneralNotes || buildLeadPublicSummary({
    clientPurpose,
    category: propertyType,
    location: normalizeText(body?.location),
    budget: normalizeText(body?.budget),
    preferredBuildingProject,
    paymentMethod
  }));

  return {
    broker_uuid: brokerId,
    lead_type: clientPurpose === 'rent' ? 'tenant' : 'buyer',
    purpose,
    category: propertyType,
    location: normalizeText(body?.location),
    budget: normalizeText(body?.budget),
    notes: normalizeText(body?.privateNotes ?? body?.notes),
    // Public note stays separate from the broker's private CRM note.
    public_general_notes: publicGeneralNotes,
    source: normalizeText(body?.source || 'Manual'),
    priority: normalizeText(body?.priority || 'normal').toLowerCase(),
    status: normalizeText(body?.status || 'new').toLowerCase(),
    meeting_date: body?.meetingDate || null,
    meeting_time: body?.meetingTime || null,
    follow_up_notes: serializedMeta,
    next_action: normalizeText(body?.nextAction),
    rent_booking: normalizeBool(body?.rentChecklist?.booking),
    rent_agreement_signed: normalizeBool(body?.rentChecklist?.agreementSigned),
    rent_handover_done: normalizeBool(body?.rentChecklist?.handoverDone),
    sale_contract_a: normalizeBool(body?.saleChecklist?.contractA),
    sale_contract_b: normalizeBool(body?.saleChecklist?.contractB),
    sale_contract_f: normalizeBool(body?.saleChecklist?.contractF),
    owner_name: normalizeText(body?.ownerName),
    owner_phone: normalizePhoneNumber(body?.ownerPhone),
    client_name: normalizeText(body?.clientName),
    client_phone: normalizePhoneNumber(body?.clientPhone),
    is_listed_public: normalizeBool(body?.isListedPublic),
    public_listing_status: normalizeBool(body?.isListedPublic) ? 'listed' : 'private',
    updated_at: new Date().toISOString()
  };
}

function getPropertyPayload(body, brokerId) {
  const purpose = normalizeText(body?.purpose).toLowerCase() === 'rent' ? 'rent' : 'sale';
  const propertyType = normalizeText(body?.propertyType);
  const serializedMeta = serializePropertyMeta({
    buildingName: normalizeText(body?.buildingName),
    floorLevel: normalizeText(body?.floorLevel),
    furnishing: purpose === 'rent' ? normalizeText(body?.furnishing) : '',
    cheques: purpose === 'rent' ? normalizeText(body?.cheques) : '',
    chiller: purpose === 'rent' ? normalizeText(body?.chiller) : '',
    mortgageStatus: purpose === 'sale' ? normalizeText(body?.mortgageStatus) : '',
    leasehold: normalizeBool(body?.leasehold),
    legacyDescription: normalizeText(body?.legacyDescription)
  });

  return {
    broker_uuid: brokerId,
    purpose,
    property_type: propertyType,
    category: propertyType,
    location: normalizeText(body?.location),
    price: normalizeText(body?.price || body?.rentPrice || body?.ownerAskingPrice),
    size: normalizeText(body?.size || body?.sizeSqft),
    bedrooms: body?.bedrooms ?? null,
    bathrooms: body?.bathrooms ?? null,
    description: serializedMeta,
    public_notes: normalizeText(body?.publicNotes),
    internal_notes: normalizeText(body?.internalNotes),
    owner_name: normalizeText(body?.ownerName),
    owner_phone: normalizePhoneNumber(body?.ownerPhone),
    status: normalizeText(body?.status || 'available').toLowerCase(),
    is_urgent: false,
    is_distress: normalizeBool(body?.isDistress),
    is_listed_public: normalizeBool(body?.isListedPublic),
    public_listing_status: normalizeBool(body?.isListedPublic) ? 'listed' : 'private',
    updated_at: new Date().toISOString()
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
    created_at: new Date().toISOString()
  };
}

function buildOverview(leads, properties, followUps, sharedListings, broker) {
  const activeLeads = leads.filter(item => !['closed', 'cancelled'].includes(String(item.status || '').toLowerCase()));
  const activeProperties = properties.filter(item => !['closed', 'unlisted'].includes(String(item.status || '').toLowerCase()));
  const upcomingMeetings = [...leads, ...followUps].filter(item => item.meetingDate || item.meeting_date).length;

  return {
    broker: {
      fullName: broker.full_name,
      brokerIdNumber: broker.broker_id_number,
      mobileNumber: broker.mobile_number,
      email: broker.email,
      companyName: broker.company_name || '',
      isVerified: Boolean(broker.is_verified)
    },
    totals: {
      leads: leads.length,
      properties: properties.length,
      sharedListings: sharedListings.length,
      activeLeads: activeLeads.length,
      activeProperties: activeProperties.length,
      meetings: upcomingMeetings
    }
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
    if (
      message.includes('could not find') ||
      message.includes('relation') ||
      message.includes('does not exist')
    ) {
      return [];
    }
    throw error;
  }
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
    await supabasePatch({
      supabaseUrl,
      serviceRoleKey,
      table: 'public_listings',
      filters: { id: existing[0].id },
      payload
    });
    return;
  }

  await supabaseInsert({
    supabaseUrl,
    serviceRoleKey,
    table: 'public_listings',
    payload: [{
      ...payload,
      created_at: new Date().toISOString()
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

async function fetchBrokerDataset(context) {
  const { supabaseUrl, serviceRoleKey, broker } = context;
  const brokerFilter = { broker_uuid: broker.id };

  const [leadRows, propertyRows, followUpRows, listingRows, notificationRows, aiMatchRows] = await Promise.all([
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
    selectOptionalBrokerRows(context, 'broker_notifications'),
    selectOptionalBrokerRows(context, 'broker_ai_matches')
  ]);

  const leads = (Array.isArray(leadRows) ? leadRows : []).map(sanitizeLead);
  const properties = (Array.isArray(propertyRows) ? propertyRows : []).map(sanitizeProperty);
  const followUps = (Array.isArray(followUpRows) ? followUpRows : []).map(sanitizeFollowUp);
  const sharedListings = (Array.isArray(listingRows) ? listingRows : []).map(sanitizePublicListing);
  const notifications = (Array.isArray(notificationRows) ? notificationRows : []).map(sanitizeNotification);
  const aiMatches = (Array.isArray(aiMatchRows) ? aiMatchRows : []).map(sanitizeAiMatch);

  return {
    overview: buildOverview(leads, properties, followUps, sharedListings, broker),
    leads,
    properties,
    followUps,
    sharedListings,
    notifications,
    aiMatches
  };
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

    if (action === 'create-lead') {
      const payload = {
        ...getLeadPayload(body, broker.id),
        created_at: new Date().toISOString()
      };
      const rows = await supabaseInsert({
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
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_leads',
        filters: { id, broker_uuid: broker.id },
        payload: getLeadPayload(body, broker.id)
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
      const payload = {
        ...getPropertyPayload(body, broker.id),
        created_at: new Date().toISOString()
      };
      const rows = await supabaseInsert({
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
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table: 'broker_properties',
        filters: { id, broker_uuid: broker.id },
        payload: getPropertyPayload(body, broker.id)
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
      const rows = await supabasePatch({
        supabaseUrl,
        serviceRoleKey,
        table,
        filters: { id: entityId, broker_uuid: broker.id },
        payload: {
          is_listed_public: action === 'list-item',
          public_listing_status: action === 'list-item' ? 'listed' : 'private',
          updated_at: new Date().toISOString()
        }
      });
      const item = Array.isArray(rows) ? rows[0] : null;
      if (!item) {
        return json({ message: 'Item not found.' }, 404);
      }
      if (action === 'list-item') {
        await syncPublicListing(context, entityType, item, broker);
      } else {
        await removePublicListing(context, entityType, entityId);
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
