    const LEAD_CONFIG = window.BROKER_DASHBOARD_LEAD_CONFIG || {
      uaeLocations: [],
      buildingProjects: [],
      propertyTypes: { rent: [], buy: [] },
      paymentMethods: [],
      listingPropertyTypes: [],
      floorLevels: [],
      furnishingOptions: [],
      chequeOptions: [],
      chillerOptions: [],
      mortgageStatuses: []
    };
    const CORE_TAXONOMY = window.BROKER_CORE_TAXONOMY || {
      locations: LEAD_CONFIG.uaeLocations || [],
      buildingProjects: LEAD_CONFIG.buildingProjects || [],
      propertyTypes: {
        rent: LEAD_CONFIG.propertyTypes?.rent || [],
        buy: LEAD_CONFIG.propertyTypes?.buy || [],
        listing: LEAD_CONFIG.listingPropertyTypes || []
      },
      purposes: {
        leads: [
          { value: 'rent', label: 'Rent' },
          { value: 'buy', label: 'Buy' }
        ],
        listings: [
          { value: 'rent', label: 'Rent' },
          { value: 'sale', label: 'Sale' }
        ]
      },
      statuses: {
        leads: [
          { value: 'new', label: 'New' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'follow-up', label: 'Follow-up' },
          { value: 'meeting scheduled', label: 'Meeting Scheduled' },
          { value: 'negotiation', label: 'Negotiation' },
          { value: 'closed won', label: 'Closed Won' },
          { value: 'closed lost', label: 'Closed Lost' },
          { value: 'inactive', label: 'Inactive' }
        ],
        listings: [
          { value: 'available', label: 'Available' },
          { value: 'reserved', label: 'Reserved' },
          { value: 'rented', label: 'Rented' },
          { value: 'sold', label: 'Sold' },
          { value: 'off market', label: 'Off Market' },
          { value: 'draft', label: 'Draft' }
        ]
      },
      aliases: {
        propertyTypes: {},
        locations: {},
        statuses: {}
      }
    };
    const DASHBOARD_LEAD_STATUS_OPTIONS = (CORE_TAXONOMY.statuses?.leads || []).map(option => option.value);
    const DASHBOARD_LISTING_STATUS_OPTIONS = (CORE_TAXONOMY.statuses?.listings || []).map(option => option.value);
    const BROKER_SESSION_VERSION = '2026-05-04-phase3-session-hardening';
    const BROKER_SESSION_VERSION_KEY = 'broker_session_version';
    const BROKER_FORCE_RELOGIN_REASON_KEY = 'broker_force_relogin_reason';
    const DASHBOARD_NOTIFICATIONS_SEEN_KEY = 'broker_dashboard_notifications_seen';
    const DASHBOARD_MATCHES_SEEN_KEY = 'broker_dashboard_matches_seen';
    const DASHBOARD_MATCHES_META_KEY = 'broker_dashboard_matches_meta';
    const MATCH_OPPORTUNITY_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;

    function clearBrokerClientSessionStorage() {
      localStorage.removeItem('broker_session_token');
      localStorage.removeItem('broker_session_profile');
      localStorage.removeItem('broker_supabase_session');
      sessionStorage.removeItem('broker_supabase_session');
    }

    function enforceBrokerSessionVersion(redirectOnMismatch = false) {
      const storedVersion = String(localStorage.getItem(BROKER_SESSION_VERSION_KEY) || '').trim();
      const hasStoredSession = Boolean(
        localStorage.getItem('broker_session_token')
        || localStorage.getItem('broker_session_profile')
        || localStorage.getItem('broker_supabase_session')
        || sessionStorage.getItem('broker_supabase_session')
      );
      if (storedVersion === BROKER_SESSION_VERSION) {
        return false;
      }
      clearBrokerClientSessionStorage();
      localStorage.setItem(BROKER_SESSION_VERSION_KEY, BROKER_SESSION_VERSION);
      if (hasStoredSession) {
        localStorage.setItem(
          BROKER_FORCE_RELOGIN_REASON_KEY,
          'Broker Desk was refreshed after a safety update. Please sign in again.'
        );
        if (redirectOnMismatch) {
          window.location.href = 'index.html?reauth=1';
          return true;
        }
      }
      return false;
    }

    const state = {
      token: localStorage.getItem('broker_session_token') || '',
      broker: null,
      overview: null,
      leads: [],
      properties: [],
      followUps: [],
      sharedListings: [],
      complaints: [],
      notifications: [],
      aiMatches: [],
      brokerActivity: {
        activeCount: 0,
        brokers: []
      },
      masterDirectory: {
        locations: [],
        buildings: []
      },
      activeSection: 'overview',
      complaintsView: 'my-complaints',
      settingsView: 'account',
      dashboardSearchQuery: '',
      filters: {
        leads: {
          status: 'all',
          purpose: 'all',
          visibility: 'all',
          followUp: 'all',
          archive: 'active',
          urgent: 'all',
          matches: 'all'
        },
        properties: {
          status: 'all',
          purpose: 'all',
          visibility: 'all',
          followUp: 'all',
          archive: 'active',
          distress: 'all',
          matches: 'all'
        }
      },
      leadEditorOriginal: null,
      propertyEditorOriginal: null,
      propertyImageDraft: [],
      propertyImageDraftLoaded: true,
      propertyImageDraftDirty: false,
      propertyMediaCache: {},
      profileExtras: null,
      profileDraft: null,
      profileStorageKey: '',
      isEditingProfile: false,
      profileSavePending: false,
      complaintsLoading: false,
      complaintsError: '',
      complaintCenterDraft: null,
      complaintCenterSubmitting: false,
      complaintDraft: null,
      complaintModalOpen: false,
      complaintModalSubmitting: false,
      rulesPromptOpen: false,
      rulesPromptChecked: false,
      rulesPromptSource: '',
      pendingRulesShareAction: null,
      notificationPanelOpen: false,
      activeNotificationKey: '',
      notificationSeenKeys: [],
      activeMatchKey: '',
      matchSeenKeys: [],
      selectedLeadId: null,
      selectedPropertyId: null,
      selectedDistressId: null,
      privateContactReveal: {
        lead: {},
        property: {}
      },
      splitScrollMemory: {
        leads: '',
        properties: '',
        distress: ''
      },
      pendingSplitScroll: null,
      callPopover: {
        anchor: null,
        phoneRaw: '',
        phoneDisplay: '',
        label: 'Phone number',
        confirmAction: null,
        copyTimer: null
      }
    };

    const leadAutocompleteControllers = {};
    const propertyAutocompleteControllers = {};
    let brokerActivityHeartbeatTimer = null;
    const PROFILE_SPECIALIZATION_OPTIONS = ['Rent', 'Sale', 'Off-plan', 'Commercial'];
    const PROFILE_LANGUAGE_OPTIONS = ['English', 'Arabic', 'Urdu', 'Hindi', 'Punjabi', 'Russian'];
    const COMPLAINT_REASON_OPTIONS = ['Spam', 'Fake Listing', 'Wrong Information', 'Duplicate Content', 'Misleading Price', 'Abuse / Misconduct', 'Harassment', 'Fraud / Scam', 'Other'];
    const COMPLAINT_ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const COMPLAINT_STATUS_LABELS = {
      new: 'New',
      'under-review': 'Under Review',
      resolved: 'Resolved',
      rejected: 'Rejected'
    };
    const PLATFORM_RULES = window.BROKER_PLATFORM_RULES_CONFIG || {
      version: 'default',
      title: 'Platform Rules & Conduct',
      intro: 'Complaint review and broker sharing work best when every report is factual, respectful, and tied to real platform conduct.',
      acceptanceText: 'I agree to platform rules and understand that violating them may result in warning, restriction, or account block.',
      promptTitle: 'Accept Platform Rules',
      promptCopy: 'Before you submit complaints or publish records to NexBridge, confirm that you understand the platform conduct rules.',
      categories: []
    };
    const COMPLAINT_CENTER_RULES = Array.isArray(window.COMPLAINT_CENTER_RULES)
      ? window.COMPLAINT_CENTER_RULES
      : Array.isArray(PLATFORM_RULES.categories)
      ? PLATFORM_RULES.categories
      : [];

    function getComplaintCenterRules() {
      try {
        if (Array.isArray(window.COMPLAINT_CENTER_RULES)) {
          return window.COMPLAINT_CENTER_RULES;
        }
      } catch (error) {
        console.debug('Complaint rules global is unavailable.', error?.message || error);
      }
      try {
        if (Array.isArray(COMPLAINT_CENTER_RULES)) {
          return COMPLAINT_CENTER_RULES;
        }
      } catch (error) {
        console.debug('Complaint rules fallback constant is unavailable.', error?.message || error);
      }
      return Array.isArray(PLATFORM_RULES.categories) ? PLATFORM_RULES.categories : [];
    }

    const DISPLAY_SEPARATOR = ' · ';

    function repairDisplayMojibake(value) {
      return String(value || '')
        .replace(/Ã‚Â·/g, DISPLAY_SEPARATOR)
        .replace(/Ã¢â€ â€/g, ' ? ')
        .replace(/â€™/g, "'")
        .replace(/â€“/g, '–')
        .replace(/â€”/g, '—');
    }

    function joinDisplayParts(parts, separator = DISPLAY_SEPARATOR) {
      return (Array.isArray(parts) ? parts : [parts])
        .map(item => repairDisplayMojibake(item))
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .join(separator);
    }

    function escapeHtml(value) {
      return repairDisplayMojibake(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeText(value) {
      return String(value || '').trim();
    }

    function normalizeTaxonomyToken(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\\/]+/g, ' / ')
        .replace(/[\s_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function dedupeTaxonomyValues(values) {
      const seen = new Set();
      return (Array.isArray(values) ? values : []).filter(value => {
        const key = normalizeTaxonomyToken(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function canonicalizeTaxonomyValue(value, aliases = {}, allowedValues = []) {
      const rawValue = normalizeText(value);
      if (!rawValue) return '';
      const token = normalizeTaxonomyToken(rawValue);
      const allowedMatch = (Array.isArray(allowedValues) ? allowedValues : []).find(option => normalizeTaxonomyToken(option) === token);
      if (allowedMatch) return allowedMatch;
      const aliasMatch = aliases?.[token];
      if (aliasMatch) return aliasMatch;
      return rawValue.replace(/\s+/g, ' ');
    }

    function collectDynamicLocationSuggestions() {
      return dedupeTaxonomyValues([
        state?.broker?.officeLocation,
        ...(state?.leads || []).map(item => item.location),
        ...(state?.properties || []).map(item => item.location),
        ...(state?.sharedListings || []).map(item => item.location)
      ]);
    }

    function collectMasterLocationSuggestions() {
      return dedupeTaxonomyValues((state?.masterDirectory?.locations || []).map(item => item?.name));
    }

    function collectDynamicBuildingSuggestions() {
      return dedupeTaxonomyValues([
        ...(state?.leads || []).map(item => item.preferredBuildingProject),
        ...(state?.properties || []).map(item => item.buildingName),
        ...(state?.sharedListings || []).map(item => item.buildingName)
      ]);
    }

    function collectMasterBuildingSuggestions() {
      return dedupeTaxonomyValues((state?.masterDirectory?.buildings || []).map(item => item?.name));
    }

    function buildDashboardAliasMap(entries = []) {
      const aliasMap = {};
      (Array.isArray(entries) ? entries : []).forEach(entry => {
        const canonicalName = normalizeText(entry?.name);
        if (!canonicalName) return;
        (Array.isArray(entry?.aliases) ? entry.aliases : []).forEach(alias => {
          const aliasToken = normalizeTaxonomyToken(alias);
          if (!aliasToken || aliasMap[aliasToken]) return;
          aliasMap[aliasToken] = canonicalName;
        });
      });
      return aliasMap;
    }

    function getDashboardLocationAliasMap() {
      return {
        ...(CORE_TAXONOMY.aliases?.locations || {}),
        ...buildDashboardAliasMap(state?.masterDirectory?.locations || [])
      };
    }

    function getDashboardBuildingAliasMap() {
      return buildDashboardAliasMap(state?.masterDirectory?.buildings || []);
    }

    function getDashboardLocationAllowedValues() {
      return dedupeTaxonomyValues([
        ...(CORE_TAXONOMY.locations || []),
        ...(LEAD_CONFIG.uaeLocations || []),
        ...collectMasterLocationSuggestions(),
        ...collectDynamicLocationSuggestions()
      ]);
    }

    function getLocationScopedBuildingSuggestions(selectedLocation = '') {
      const normalizedSelectedLocation = normalizeDashboardLocationValue(selectedLocation);
      const masterLocationMatched = [];
      const locationMatched = [];
      const master = [];
      const dynamic = [];

      (state?.masterDirectory?.buildings || []).forEach(item => {
        const normalizedBuildingName = normalizeText(item?.name);
        if (!normalizedBuildingName) return;
        master.push(normalizedBuildingName);
        if (!normalizedSelectedLocation) return;
        if (normalizeDashboardLocationValue(item?.locationName) === normalizedSelectedLocation) {
          masterLocationMatched.push(normalizedBuildingName);
        }
      });

      const appendBuilding = (buildingName, locationValue = '') => {
        const normalizedBuildingName = normalizeText(buildingName);
        if (!normalizedBuildingName) return;
        dynamic.push(normalizedBuildingName);
        if (!normalizedSelectedLocation) return;
        if (normalizeDashboardLocationValue(locationValue) === normalizedSelectedLocation) {
          locationMatched.push(normalizedBuildingName);
        }
      };

      (state?.leads || []).forEach(item => appendBuilding(item.preferredBuildingProject, item.location));
      (state?.properties || []).forEach(item => appendBuilding(item.buildingName, item.location));
      (state?.sharedListings || []).forEach(item => appendBuilding(item.buildingName, item.location));

      return dedupeTaxonomyValues([
        ...masterLocationMatched,
        ...locationMatched,
        ...master,
        ...dynamic,
        ...collectMasterBuildingSuggestions(),
        ...collectDynamicBuildingSuggestions(),
        ...(CORE_TAXONOMY.buildingProjects || []),
        ...(LEAD_CONFIG.buildingProjects || [])
      ]);
    }

    function normalizeDashboardPropertyTypeValue(value) {
      const supportedValues = dedupeTaxonomyValues([
        ...(CORE_TAXONOMY.propertyTypes?.listing || []),
        ...(CORE_TAXONOMY.propertyTypes?.rent || []),
        ...(CORE_TAXONOMY.propertyTypes?.buy || [])
      ]);
      return canonicalizeTaxonomyValue(value, CORE_TAXONOMY.aliases?.propertyTypes || {}, supportedValues);
    }

    const DASHBOARD_PROPERTY_CATEGORY_OPTIONS = Object.freeze([
      'Apartment',
      'Villa',
      'Townhouse',
      'Office',
      'Shop / Retail',
      'Warehouse',
      'Land / Plot',
      'Other'
    ]);

    const DASHBOARD_UNIT_LAYOUT_OPTIONS = Object.freeze([
      'Studio',
      '1 BHK',
      '2 BHK',
      '3 BHK',
      '4 BHK',
      '5 BHK',
      '6+ BHK',
      'N/A'
    ]);

    const DASHBOARD_SALE_PROPERTY_STATUS_OPTIONS = Object.freeze([
      'Ready Property',
      'Off Plan Property'
    ]);

    const DASHBOARD_HANDOVER_QUARTER_OPTIONS = Object.freeze(['Q1', 'Q2', 'Q3', 'Q4']);

    const DASHBOARD_PROPERTY_CATEGORY_ALIASES = Object.freeze({
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

    const DASHBOARD_UNIT_LAYOUT_ALIASES = Object.freeze({
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
      na: 'N/A'
    });

    function normalizeDashboardPropertyCategoryValue(value) {
      const rawValue = normalizeText(value);
      if (!rawValue) return '';
      const normalized = DASHBOARD_PROPERTY_CATEGORY_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
      return DASHBOARD_PROPERTY_CATEGORY_OPTIONS.includes(normalized) ? normalized : '';
    }

    function normalizeDashboardUnitLayoutValue(value) {
      const rawValue = normalizeText(value);
      if (!rawValue) return '';
      const normalized = DASHBOARD_UNIT_LAYOUT_ALIASES[normalizeTaxonomyToken(rawValue)] || rawValue.replace(/\s+/g, ' ');
      return DASHBOARD_UNIT_LAYOUT_OPTIONS.includes(normalized) ? normalized : '';
    }

    function normalizeDashboardSalePropertyStatusValue(value) {
      const normalized = normalizeText(value);
      return DASHBOARD_SALE_PROPERTY_STATUS_OPTIONS.includes(normalized) ? normalized : '';
    }

    function normalizeDashboardHandoverQuarterValue(value) {
      const normalized = normalizeText(value).toUpperCase();
      return DASHBOARD_HANDOVER_QUARTER_OPTIONS.includes(normalized) ? normalized : '';
    }

    function normalizeDashboardHandoverYearValue(value) {
      return String(value || '').replace(/[^\d]/g, '').slice(0, 4);
    }

    function formatPropertyHandoverDisplay(quarter, year) {
      const normalizedQuarter = normalizeDashboardHandoverQuarterValue(quarter);
      const normalizedYear = normalizeDashboardHandoverYearValue(year);
      return normalizedQuarter && normalizedYear.length === 4 ? `${normalizedQuarter} ${normalizedYear}` : '';
    }

    function dashboardCategoryAllowsSelectableLayout(category) {
      return ['Apartment', 'Villa', 'Townhouse'].includes(normalizeDashboardPropertyCategoryValue(category));
    }

    function deriveDashboardPropertyDimensions(source) {
      const record = source && typeof source === 'object' ? source : { propertyType: source };
      let propertyCategory = normalizeDashboardPropertyCategoryValue(record?.propertyCategory || record?.property_category);
      let unitLayout = normalizeDashboardUnitLayoutValue(record?.unitLayout || record?.unit_layout);
      const legacyPropertyType = normalizeDashboardPropertyTypeValue(record?.propertyType || record?.property_type || record?.category || '');
      const inferredLayout = normalizeDashboardUnitLayoutValue(legacyPropertyType);
      const inferredCategory = normalizeDashboardPropertyCategoryValue(legacyPropertyType);

      if (!unitLayout && inferredLayout) unitLayout = inferredLayout;
      if (!propertyCategory && inferredLayout) propertyCategory = 'Apartment';
      if (!propertyCategory && inferredCategory) propertyCategory = inferredCategory;
      if (!propertyCategory && legacyPropertyType) propertyCategory = 'Other';
      if (!unitLayout && propertyCategory) {
        unitLayout = dashboardCategoryAllowsSelectableLayout(propertyCategory) ? '' : 'N/A';
      }

      const propertyType = legacyPropertyType || (unitLayout && unitLayout !== 'N/A' ? unitLayout : propertyCategory);
      return {
        propertyCategory,
        unitLayout,
        propertyType
      };
    }

    function getDashboardDisplayPropertyType(record) {
      return deriveDashboardPropertyDimensions(record).propertyType || '';
    }

    function getDashboardDisplayPropertyCategory(record) {
      return deriveDashboardPropertyDimensions(record).propertyCategory || '';
    }

    function getDashboardDisplayUnitLayout(record) {
      return deriveDashboardPropertyDimensions(record).unitLayout || '';
    }

    function formatDashboardPropertyDimensions(category, layout) {
      const normalizedCategory = normalizeDashboardPropertyCategoryValue(category);
      const normalizedLayout = normalizeDashboardUnitLayoutValue(layout);
      return [normalizedCategory, normalizedLayout && normalizedLayout !== 'N/A' ? normalizedLayout : '']
        .filter(Boolean)
        .join(' · ');
    }

    function normalizeDashboardLocationValue(value) {
      return canonicalizeTaxonomyValue(value, getDashboardLocationAliasMap(), getDashboardLocationAllowedValues());
    }

    function normalizeDashboardLeadStatusValue(value) {
      const normalized = canonicalizeTaxonomyValue(value, CORE_TAXONOMY.aliases?.statuses || {}, DASHBOARD_LEAD_STATUS_OPTIONS);
      return DASHBOARD_LEAD_STATUS_OPTIONS.includes(normalized) ? normalized : 'new';
    }

    function normalizeDashboardListingStatusValue(value) {
      const normalized = canonicalizeTaxonomyValue(value, CORE_TAXONOMY.aliases?.statuses || {}, DASHBOARD_LISTING_STATUS_OPTIONS);
      return DASHBOARD_LISTING_STATUS_OPTIONS.includes(normalized) ? normalized : 'available';
    }

    function buildDashboardOptionMarkup(options, defaultLabel = '') {
      const optionMarkup = (Array.isArray(options) ? options : []).map(option => {
        const value = normalizeText(option?.value);
        const label = normalizeText(option?.label || option?.value);
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      });
      return [
        defaultLabel ? `<option value="all">${escapeHtml(defaultLabel)}</option>` : '',
        ...optionMarkup
      ].join('');
    }

    function syncDashboardSelectOptions(selectId, options, currentValue = '') {
      const select = document.getElementById(selectId);
      if (!select) return;
      const isFilter = String(selectId).endsWith('Filter');
      const nextValue = normalizeText(currentValue || select.value || (isFilter ? 'all' : ''));
      select.innerHTML = buildDashboardOptionMarkup(options, isFilter ? select.options?.[0]?.textContent || '' : '');
      const allowedValues = (Array.isArray(options) ? options : []).map(option => option.value);
      select.value = allowedValues.includes(nextValue) ? nextValue : (isFilter ? 'all' : (allowedValues[0] || ''));
    }

    function syncDashboardTaxonomyOptions() {
      const leadPurposeOptions = CORE_TAXONOMY.purposes?.leads || [];
      const listingPurposeOptions = CORE_TAXONOMY.purposes?.listings || [];
      const leadStatusOptions = CORE_TAXONOMY.statuses?.leads || [];
      const listingStatusOptions = CORE_TAXONOMY.statuses?.listings || [];

      syncDashboardSelectOptions('leadStatusFilter', leadStatusOptions);
      syncDashboardSelectOptions('leadPurposeFilter', leadPurposeOptions);
      syncDashboardSelectOptions('propertyStatusFilter', listingStatusOptions);
      syncDashboardSelectOptions('propertyPurposeFilter', listingPurposeOptions);
      syncDashboardSelectOptions('leadStatus', leadStatusOptions);
      syncDashboardSelectOptions('propertyStatus', listingStatusOptions);
    }

    function sanitizeStringArray(values) {
      if (!Array.isArray(values)) return [];
      return values
        .map(item => normalizeText(item))
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .slice(0, 20);
    }

    function createEmptyProfileExtras() {
      return {
        avatarDataUrl: '',
        whatsappNumber: '',
        officeLocation: '',
        bio: '',
        specializations: [],
        areasServed: [],
        languages: [],
        socialLinks: {
          instagram: '',
          facebook: '',
          linkedin: '',
          website: '',
          whatsappLink: ''
        }
      };
    }

    function sanitizeProfileExtras(raw) {
      const base = createEmptyProfileExtras();
      return {
        avatarDataUrl: normalizeText(raw?.avatarDataUrl),
        whatsappNumber: normalizeLeadPhoneInput(raw?.whatsappNumber || ''),
        officeLocation: normalizeText(raw?.officeLocation),
        bio: normalizeText(raw?.bio),
        specializations: sanitizeStringArray(raw?.specializations),
        areasServed: sanitizeStringArray(raw?.areasServed),
        languages: sanitizeStringArray(raw?.languages),
        socialLinks: {
          instagram: normalizeText(raw?.socialLinks?.instagram),
          facebook: normalizeText(raw?.socialLinks?.facebook),
          linkedin: normalizeText(raw?.socialLinks?.linkedin),
          website: normalizeText(raw?.socialLinks?.website),
          whatsappLink: normalizeText(raw?.socialLinks?.whatsappLink)
        }
      };
    }

    function getProfileStorageKey() {
      const broker = state.overview?.broker || state.broker || {};
      const keyPart = broker.id || broker.brokerIdNumber || 'default';
      return `broker_profile_extras_${keyPart}`;
    }

    function syncProfileStorage(force = false) {
      const nextKey = getProfileStorageKey();
      if (!force && state.profileStorageKey === nextKey && state.profileExtras) return;
      let parsed = createEmptyProfileExtras();
      try {
        const raw = localStorage.getItem(nextKey);
        if (raw) {
          parsed = sanitizeProfileExtras(JSON.parse(raw));
        }
      } catch (error) {
        console.error('Could not load stored profile extras', error);
      }
      state.profileStorageKey = nextKey;
      state.profileExtras = parsed;
    }

    function persistProfileExtras(extras) {
      const normalized = sanitizeProfileExtras(extras);
      syncProfileStorage();
      state.profileExtras = normalized;
      try {
        localStorage.setItem(state.profileStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Could not store broker profile extras', error);
      }
    }

    function buildBrokerProfileModel() {
      syncProfileStorage();
      const broker = state.overview?.broker || state.broker || {};
      const extras = state.profileExtras || createEmptyProfileExtras();
      return {
        fullName: normalizeText(broker.fullName),
        brokerIdNumber: normalizeText(broker.brokerIdNumber),
        mobileNumber: normalizeLeadPhoneInput(broker.mobileNumber || ''),
        email: normalizeText(broker.email),
        companyName: normalizeText(broker.companyName),
        isVerified: Boolean(broker.isVerified),
        avatarDataUrl: extras.avatarDataUrl,
        whatsappNumber: extras.whatsappNumber,
        officeLocation: extras.officeLocation,
        bio: extras.bio,
        specializations: [...extras.specializations],
        areasServed: [...extras.areasServed],
        languages: [...extras.languages],
        socialLinks: { ...extras.socialLinks }
      };
    }

    function getActiveBrokerProfile() {
      return state.isEditingProfile && state.profileDraft ? state.profileDraft : buildBrokerProfileModel();
    }

    function cloneBrokerProfile(profile) {
      return {
        ...profile,
        specializations: [...(profile?.specializations || [])],
        areasServed: [...(profile?.areasServed || [])],
        languages: [...(profile?.languages || [])],
        socialLinks: { ...(profile?.socialLinks || {}) }
      };
    }

    function getProfileCompletion(profile) {
      const checks = [
        { label: 'Basic info complete', done: Boolean(profile.fullName && profile.mobileNumber && profile.email && profile.companyName) },
        { label: 'Photo added', done: Boolean(profile.avatarDataUrl) },
        { label: 'Contact info complete', done: Boolean(profile.whatsappNumber && profile.officeLocation) },
        { label: 'Bio added', done: Boolean(profile.bio) },
        { label: 'Specializations added', done: Array.isArray(profile.specializations) && profile.specializations.length > 0 },
        { label: 'Areas served added', done: Array.isArray(profile.areasServed) && profile.areasServed.length > 0 },
        { label: 'Languages added', done: Array.isArray(profile.languages) && profile.languages.length > 0 },
        { label: 'Social links added', done: Object.values(profile.socialLinks || {}).some(Boolean) }
      ];
      const percent = Math.round((checks.filter(item => item.done).length / checks.length) * 100);
      const hints = [];
      if (!profile.avatarDataUrl) hints.push('Add profile picture to increase trust');
      if (!profile.bio) hints.push('Add a short professional bio');
      if (!(profile.socialLinks && Object.values(profile.socialLinks).some(Boolean))) hints.push('Add social links to complete your profile');
      if (!(Array.isArray(profile.areasServed) && profile.areasServed.length)) hints.push('Add communities you serve');
      return { percent, checks, hints: hints.slice(0, 3) };
    }

    function getProfileInitials(name) {
      const parts = normalizeText(name).split(/\s+/).filter(Boolean).slice(0, 2);
      if (!parts.length) return 'BC';
      return parts.map(item => item.charAt(0).toUpperCase()).join('');
    }

    function beginProfileEdit() {
      state.profileDraft = cloneBrokerProfile(buildBrokerProfileModel());
      state.isEditingProfile = true;
      renderProfile();
    }

    function cancelProfileEdit() {
      state.profileDraft = null;
      state.isEditingProfile = false;
      renderProfile();
    }

    function updateProfileDraftField(path, value) {
      if (!state.profileDraft) return;
      const keys = String(path || '').split('.');
      let target = state.profileDraft;
      while (keys.length > 1) {
        const key = keys.shift();
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        target = target[key];
      }
      target[keys[0]] = value;
      refreshProfileCompletionUi();
    }

    function toggleProfileDraftValue(field, value) {
      if (!state.profileDraft) return;
      const nextValues = new Set(Array.isArray(state.profileDraft[field]) ? state.profileDraft[field] : []);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      state.profileDraft[field] = Array.from(nextValues);
      renderProfile();
    }

    function addProfileAreaTag() {
      if (!state.profileDraft) return;
      const input = document.getElementById('profileAreasInput');
      const nextValue = normalizeText(input?.value);
      if (!nextValue) return;
      state.profileDraft.areasServed = sanitizeStringArray([...(state.profileDraft.areasServed || []), nextValue]);
      renderProfile();
    }

    function removeProfileAreaTag(value) {
      if (!state.profileDraft) return;
      const normalizedValue = decodeURIComponent(String(value || ''));
      state.profileDraft.areasServed = sanitizeStringArray((state.profileDraft.areasServed || []).filter(item => item !== normalizedValue));
      renderProfile();
    }

    function removeProfileAvatar() {
      if (!state.profileDraft) return;
      state.profileDraft.avatarDataUrl = '';
      renderProfile();
    }

    function refreshProfileCompletionUi() {
      const profile = getActiveBrokerProfile();
      const completion = getProfileCompletion(profile);
      const fill = document.getElementById('profileCompletionFill');
      const text = document.getElementById('profileCompletionText');
      const checklist = document.getElementById('profileChecklist');
      const hints = document.getElementById('profileHintList');
      if (fill) fill.style.width = `${completion.percent}%`;
      if (text) text.textContent = `Profile ${completion.percent}% complete`;
      if (checklist) {
        checklist.innerHTML = completion.checks.map(item => `
          <div class="profile-check-item ${item.done ? 'is-done' : ''}">
            <span class="profile-check-icon">${item.done ? '&#10003;' : '&#9711;'}</span>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `).join('');
      }
      if (hints) {
        hints.innerHTML = completion.hints.length
          ? completion.hints.map(item => `<div class="profile-hint-item"><span class="profile-check-icon">&#9675;</span><span>${escapeHtml(item)}</span></div>`).join('')
          : '<div class="profile-hint-item"><span class="profile-check-icon">&#10003;</span><span>Your broker profile is complete and ready.</span></div>';
      }
    }

    function handleProfileAvatarSelection(event) {
      const file = event?.target?.files?.[0];
      if (!file || !state.profileDraft) return;
      const reader = new FileReader();
      reader.onload = loadEvent => {
        state.profileDraft.avatarDataUrl = String(loadEvent?.target?.result || '');
        renderProfile();
      };
      reader.readAsDataURL(file);
    }

    function wireProfileEditor() {
      if (!state.isEditingProfile || !state.profileDraft) return;
      document.getElementById('profileAvatarInput')?.addEventListener('change', handleProfileAvatarSelection);
      document.querySelectorAll('[data-profile-input]').forEach(input => {
        input.addEventListener('input', event => {
          const path = event.currentTarget.getAttribute('data-profile-input');
          const value = path === 'mobileNumber' || path === 'whatsappNumber'
            ? normalizeLeadPhoneInput(event.currentTarget.value)
            : event.currentTarget.value;
          event.currentTarget.value = value;
          updateProfileDraftField(path, value);
        });
      });
      document.getElementById('profileAreasInput')?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          addProfileAreaTag();
        }
      });
      refreshProfileCompletionUi();
    }

    async function saveBrokerProfile() {
      if (!state.profileDraft || state.profileSavePending) return;
      const actionButton = window.ActionFeedbackUi?.resolveActionButton();
      const draft = cloneBrokerProfile(state.profileDraft);
      draft.fullName = normalizeText(draft.fullName);
      draft.mobileNumber = normalizeLeadPhoneInput(draft.mobileNumber);
      draft.email = normalizeText(draft.email);
      draft.companyName = normalizeText(draft.companyName);
      draft.whatsappNumber = normalizeLeadPhoneInput(draft.whatsappNumber);
      draft.officeLocation = normalizeText(draft.officeLocation);
      draft.bio = normalizeText(draft.bio);
      draft.specializations = sanitizeStringArray(draft.specializations);
      draft.areasServed = sanitizeStringArray(draft.areasServed);
      draft.languages = sanitizeStringArray(draft.languages);

      if (draft.fullName.length < 2) {
        setStatus('Please enter the broker name.', 'error');
        return;
      }
      if (!normalizeDialNumber(draft.mobileNumber)) {
        setStatus('Please enter a valid mobile number.', 'error');
        return;
      }
      if (!draft.email || !draft.email.includes('@')) {
        setStatus('Please enter a valid email address.', 'error');
        return;
      }

      state.profileSavePending = true;
      renderProfile();
      setStatus('Saving profile...', 'success');

      try {
        const executeSave = async () => {
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.debug('[dashboard-profile] save request', {
              brokerId: state.broker?.id || '',
              email: draft.email,
              targetPath: '/api/broker-dashboard'
            });
          }

          return dashboardAction({
            action: 'update-profile',
            fullName: draft.fullName,
            mobileNumber: draft.mobileNumber,
            email: draft.email,
            companyName: draft.companyName,
            authAccessToken: getStoredBrokerSupabaseAccessToken()
          }, 'Profile updated.');
        };

        if (window.ActionFeedbackUi) {
          await window.ActionFeedbackUi.withActionFeedback(
            actionButton,
            'Saving Profile...',
            'Profile updated successfully.',
            executeSave,
            { showErrorToast: true }
          );
        } else {
          await executeSave();
        }

        persistProfileExtras({
          avatarDataUrl: draft.avatarDataUrl,
          whatsappNumber: draft.whatsappNumber,
          officeLocation: draft.officeLocation,
          bio: draft.bio,
          specializations: draft.specializations,
          areasServed: draft.areasServed,
          languages: draft.languages,
          socialLinks: draft.socialLinks
        });

        state.profileDraft = null;
        state.isEditingProfile = false;
      } catch (error) {
        setStatus(error?.message || 'Profile could not be saved.', 'error');
      } finally {
        state.profileSavePending = false;
        renderProfile();
      }
    }

    function normalizeDialNumber(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (raw.startsWith('+')) return `+${raw.slice(1).replace(/[^\d]/g, '')}`;
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.startsWith('00')) return `+${digits.slice(2)}`;
      return digits;
    }

    function getStoredBrokerSupabaseAccessToken() {
      try {
        let raw = sessionStorage.getItem('broker_supabase_session');
        const legacyRaw = localStorage.getItem('broker_supabase_session');
        if (!raw && legacyRaw) {
          raw = legacyRaw;
          sessionStorage.setItem('broker_supabase_session', legacyRaw);
        }
        localStorage.removeItem('broker_supabase_session');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return String(parsed?.access_token || '').trim();
      } catch (error) {
        console.error('Could not read stored Supabase session', error);
        return '';
      }
    }

    function formatPhoneDisplay(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const normalized = normalizeDialNumber(raw);
      return normalized || raw;
    }

    function getDashboardCurrentUserName() {
      return normalizeText(
        state.broker?.fullName
        || state.broker?.name
        || state.broker?.email
      || 'NexBridge user'
      );
    }

    async function copyTextToClipboard(value) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const helper = document.createElement('textarea');
      helper.value = value;
      helper.setAttribute('readonly', '');
      helper.style.position = 'absolute';
      helper.style.left = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
    }

    function positionDashboardCallPopover(anchor, popover) {
      if (!anchor || !popover) return;
      const rect = anchor.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth;
      const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.left + (rect.width / 2) - (popoverWidth / 2)));
      let top = rect.bottom + 10;
      const popoverHeight = popover.offsetHeight;
      if (top + popoverHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - popoverHeight - 10);
      }
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }

    function closeDashboardCallPopover() {
      const popover = document.getElementById('dashboardCallPopover');
      const copyButton = document.getElementById('dashboardCallPopoverCopy');
      if (!popover) return;
      popover.classList.add('crm-hidden');
      popover.style.left = '';
      popover.style.top = '';
      if (copyButton) {
        copyButton.textContent = 'Copy';
        copyButton.classList.remove('is-copied');
      }
      if (state.callPopover.copyTimer) {
        clearTimeout(state.callPopover.copyTimer);
      }
      state.callPopover.anchor = null;
      state.callPopover.phoneRaw = '';
      state.callPopover.phoneDisplay = '';
      state.callPopover.confirmAction = null;
      state.callPopover.copyTimer = null;
    }

    function openDashboardCallPopover(anchor, rawPhone, options = {}) {
      const phoneDisplay = formatPhoneDisplay(rawPhone);
      const phoneDial = normalizeDialNumber(rawPhone);
      if (!phoneDisplay || !phoneDial) {
        setStatus(options.emptyMessage || 'No number available.', 'error');
        return;
      }
      const popover = document.getElementById('dashboardCallPopover');
      const valueEl = document.getElementById('dashboardCallPopoverValue');
      const labelEl = document.getElementById('dashboardCallPopoverLabel');
      const actionBtn = document.getElementById('dashboardCallPopoverAction');
      const copyButton = document.getElementById('dashboardCallPopoverCopy');
      if (!popover || !valueEl || !labelEl || !actionBtn || !copyButton) return;

      closeDashboardCallPopover();

      state.callPopover.anchor = anchor || null;
      state.callPopover.phoneRaw = phoneDial;
      state.callPopover.phoneDisplay = phoneDisplay;
      state.callPopover.label = options.label || 'Phone number';
      state.callPopover.confirmAction = typeof options.onConfirm === 'function' ? options.onConfirm : null;

      labelEl.textContent = state.callPopover.label;
      valueEl.textContent = state.callPopover.phoneDisplay;
      copyButton.textContent = 'Copy';
      copyButton.classList.remove('is-copied');
      actionBtn.disabled = false;
      popover.classList.remove('crm-hidden');
      positionDashboardCallPopover(anchor, popover);
    }

    async function copyDashboardCallPopoverValue() {
      if (!state.callPopover.phoneDisplay) return;
      const copyButton = document.getElementById('dashboardCallPopoverCopy');
      if (!copyButton) return;
      try {
        await copyTextToClipboard(state.callPopover.phoneDisplay);
        copyButton.textContent = 'Copied';
        copyButton.classList.add('is-copied');
        if (state.callPopover.copyTimer) clearTimeout(state.callPopover.copyTimer);
        state.callPopover.copyTimer = window.setTimeout(() => {
          copyButton.textContent = 'Copy';
          copyButton.classList.remove('is-copied');
          state.callPopover.copyTimer = null;
        }, 1400);
      } catch (error) {
        console.error('Could not copy contact number', error);
      }
    }

    function initDashboardCallPopover() {
      const popover = document.getElementById('dashboardCallPopover');
      const copyButton = document.getElementById('dashboardCallPopoverCopy');
      const closeButton = document.getElementById('dashboardCallPopoverClose');
      const actionButton = document.getElementById('dashboardCallPopoverAction');
      if (!popover || !copyButton || !closeButton || !actionButton || popover.dataset.ready === 'true') return;

      copyButton.addEventListener('click', copyDashboardCallPopoverValue);
      closeButton.addEventListener('click', closeDashboardCallPopover);
      actionButton.addEventListener('click', async () => {
        if (!state.callPopover.phoneRaw) return;
        const confirmAction = state.callPopover.confirmAction;
        const dialNumber = state.callPopover.phoneRaw;
        closeDashboardCallPopover();
        if (confirmAction) {
          try {
            await confirmAction();
          } catch (error) {
            console.error('Call tracking failed', error);
          }
        }
        window.location.href = `tel:${dialNumber}`;
      });

      document.addEventListener('click', event => {
        if (popover.classList.contains('crm-hidden')) return;
        if (event.target.closest('#dashboardCallPopover')) return;
        if (state.callPopover.anchor && state.callPopover.anchor.contains(event.target)) return;
        closeDashboardCallPopover();
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeDashboardCallPopover();
        }
      });

      window.addEventListener('resize', () => {
        if (!popover.classList.contains('crm-hidden') && state.callPopover.anchor) {
          positionDashboardCallPopover(state.callPopover.anchor, popover);
        }
      });

      window.addEventListener('scroll', () => {
        if (!popover.classList.contains('crm-hidden') && state.callPopover.anchor) {
          positionDashboardCallPopover(state.callPopover.anchor, popover);
        }
      }, true);

      popover.dataset.ready = 'true';
    }

    function getLeadClientPurpose(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'rent') return 'rent';
      if (normalized === 'buy' || normalized === 'sale') return 'buy';
      return '';
    }

    function getLeadClientPurposeLabel(value) {
      const normalized = getLeadClientPurpose(value);
      if (normalized === 'rent') return 'Rent';
      if (normalized === 'buy') return 'Buy';
      return 'Lead';
    }

    function getLeadClientPurposeFromRecord(lead) {
      if (lead?.clientPurpose) return getLeadClientPurpose(lead.clientPurpose);
      return String(lead?.purpose || '').trim().toLowerCase() === 'rent' ? 'rent' : 'buy';
    }

    function normalizeBudgetDigits(value) {
      return String(value || '').replace(/[^\d]/g, '');
    }

    function normalizeDecimalInput(value) {
      const rawValue = String(value || '').replace(/,/g, '.');
      const sanitized = rawValue.replace(/[^\d.]/g, '');
      if (!sanitized) return '';
      const hasTrailingDot = sanitized.endsWith('.');
      const parts = sanitized.split('.');
      const whole = parts.shift() || '';
      const decimal = parts.join('');
      if (!decimal) {
        return hasTrailingDot ? `${whole}.` : whole;
      }
      return `${whole}.${decimal}`;
    }

    function normalizeSizeUnit(value) {
      return String(value || '').trim().toLowerCase() === 'sqm' ? 'sqm' : 'sqft';
    }

    function formatSizeValue(value) {
      const normalized = normalizeDecimalInput(value);
      if (!normalized) return '';
      if (normalized.endsWith('.')) return normalized;
      return normalized
        .replace(/(\.\d*?[1-9])0+$/u, '$1')
        .replace(/\.0+$/u, '');
    }

    function formatSizeDisplay(value, unit = 'sqft') {
      const formattedValue = formatSizeValue(value);
      if (!formattedValue) return '--';
      return `${formattedValue} ${normalizeSizeUnit(unit)}`;
    }

    function normalizeLeadPhoneInput(value) {
      const digits = String(value || '').replace(/[^\d]/g, '');
      if (!digits) return '';
      if (digits.startsWith('00971')) return `+971 ${digits.slice(5)}`;
      if (digits.startsWith('971')) return `+${digits}`;
      if (digits.startsWith('0')) return `+971 ${digits.slice(1)}`;
      return digits.startsWith('+') ? digits : `+${digits}`;
    }

    function formatBudgetLabel(value) {
      const digits = normalizeBudgetDigits(value);
      if (!digits) return 'AED --';
      try {
        return `AED ${Number(digits).toLocaleString('en-AE')}`;
      } catch (error) {
        return `AED ${digits}`;
      }
    }

    function buildLeadPublicSummary(formData) {
      const purposeLabel = getLeadClientPurposeLabel(formData.clientPurpose);
      const budgetLabel = formatBudgetLabel(formData.budget);
      const parts = [
        `${purposeLabel} requirement`,
        formData.propertyType,
        formData.location,
        formData.preferredBuildingProject ? `Building/Project: ${formData.preferredBuildingProject}` : '',
        budgetLabel !== 'AED --' ? `Budget: ${budgetLabel}` : '',
        getLeadClientPurpose(formData.clientPurpose) === 'buy' && formData.paymentMethod ? `Payment: ${formData.paymentMethod}` : ''
      ].filter(Boolean);
      return parts.join(' | ');
    }

    function populateLeadPropertyCategoryOptions(selectedValue = '') {
      const select = document.getElementById('leadPropertyCategory');
      if (!select) return;
      select.innerHTML = '<option value="">Select property category</option>' + DASHBOARD_PROPERTY_CATEGORY_OPTIONS.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      const normalizedSelectedValue = normalizeDashboardPropertyCategoryValue(selectedValue);
      select.value = normalizedSelectedValue && DASHBOARD_PROPERTY_CATEGORY_OPTIONS.includes(normalizedSelectedValue) ? normalizedSelectedValue : '';
    }

    function populateLeadUnitLayoutOptions(selectedValue = '', propertyCategory = '') {
      const select = document.getElementById('leadUnitLayout');
      const helper = document.getElementById('leadUnitLayoutHelper');
      if (!select) return;
      const category = normalizeDashboardPropertyCategoryValue(propertyCategory);
      const allowsLayout = dashboardCategoryAllowsSelectableLayout(category);
      const options = allowsLayout ? DASHBOARD_UNIT_LAYOUT_OPTIONS : ['N/A'];
      const normalizedSelectedValue = normalizeDashboardUnitLayoutValue(selectedValue || (allowsLayout ? '' : 'N/A'));
      select.innerHTML = '<option value="">Select unit layout</option>' + options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      select.value = normalizedSelectedValue && options.includes(normalizedSelectedValue) ? normalizedSelectedValue : (allowsLayout ? '' : 'N/A');
      select.disabled = !category;
      if (helper) {
        helper.textContent = !category
          ? 'Choose a property category first.'
          : allowsLayout
            ? 'Select the layout for apartment, villa, or townhouse requirements.'
            : 'Unit layout defaults to N/A for this property category.';
      }
    }

    function syncLeadPropertyDimensionControls(source = null) {
      const derived = deriveDashboardPropertyDimensions(source || {
        propertyCategory: document.getElementById('leadPropertyCategory')?.value,
        unitLayout: document.getElementById('leadUnitLayout')?.value,
        propertyType: document.getElementById('leadPropertyType')?.value
      });
      populateLeadPropertyCategoryOptions(derived.propertyCategory);
      populateLeadUnitLayoutOptions(derived.unitLayout, derived.propertyCategory);
      const hiddenInput = document.getElementById('leadPropertyType');
      if (hiddenInput) hiddenInput.value = derived.propertyType || '';
      return derived;
    }

    function populateLeadPaymentMethodOptions(selectedValue = '') {
      const select = document.getElementById('leadPaymentMethod');
      if (!select) return;
      select.innerHTML = '<option value="">Select payment method</option>' + (LEAD_CONFIG.paymentMethods || []).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      select.value = selectedValue && (LEAD_CONFIG.paymentMethods || []).includes(selectedValue) ? selectedValue : '';
    }

    function clearLeadErrors() {
      [
        'leadClientPurposeError',
        'leadLocationError',
        'leadPropertyCategoryError',
        'leadUnitLayoutError',
        'leadBudgetError',
        'leadPaymentMethodError',
        'leadClientNameError',
        'leadClientPhoneError'
      ].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.textContent = '';
      });

      [
        'leadLocation',
        'leadBuildingProject',
        'leadPropertyCategory',
        'leadUnitLayout',
        'leadBudget',
        'leadPaymentMethod',
        'leadClientName',
        'leadClientPhone',
        'leadPrivateNotes'
      ].forEach(id => document.getElementById(id)?.classList.remove('is-invalid'));
      document.getElementById('leadPurposeControl')?.classList.remove('is-invalid');
    }

    function setLeadFieldError(field, message) {
      const errorMap = {
        clientPurpose: 'leadClientPurposeError',
        location: 'leadLocationError',
        propertyCategory: 'leadPropertyCategoryError',
        unitLayout: 'leadUnitLayoutError',
        budget: 'leadBudgetError',
        paymentMethod: 'leadPaymentMethodError',
        clientName: 'leadClientNameError',
        clientPhone: 'leadClientPhoneError'
      };
      const inputMap = {
        clientPurpose: 'leadPurposeControl',
        location: 'leadLocation',
        propertyCategory: 'leadPropertyCategory',
        unitLayout: 'leadUnitLayout',
        budget: 'leadBudget',
        paymentMethod: 'leadPaymentMethod',
        clientName: 'leadClientName',
        clientPhone: 'leadClientPhone'
      };

      const errorNode = document.getElementById(errorMap[field]);
      if (errorNode) errorNode.textContent = message;
      document.getElementById(inputMap[field])?.classList.add('is-invalid');
    }

    function setLeadWorkspaceHeader(mode = 'create') {
      const workspaceTitle = document.getElementById('workspaceTitle');
      const workspaceCopy = document.getElementById('workspaceCopy');
      if (!workspaceTitle || !workspaceCopy) return;
      const workspaceKicker = document.getElementById('workspaceKicker');
      const workspaceModePill = document.getElementById('workspaceModePill');
      const workspaceVisibilityPill = document.getElementById('workspaceVisibilityPill');

      if (mode === 'edit') {
        workspaceTitle.textContent = 'Edit Lead';
      workspaceCopy.textContent = 'Update the private client requirement below. Only safe, non-private details can be shared later on NexBridge Marketplace.';
        if (workspaceKicker) workspaceKicker.textContent = 'Requirement Editor';
        if (workspaceModePill) workspaceModePill.textContent = 'Edit flow';
        if (workspaceVisibilityPill) workspaceVisibilityPill.textContent = 'Private client record';
        syncWorkspaceFormSummary('lead');
        return;
      }

      workspaceTitle.textContent = 'Add New Lead';
      workspaceCopy.textContent = 'Create a private client requirement. You can choose later whether to share only the non-private details on NexBridge Marketplace.';
      if (workspaceKicker) workspaceKicker.textContent = 'Requirement Composer';
      if (workspaceModePill) workspaceModePill.textContent = 'Create flow';
      if (workspaceVisibilityPill) workspaceVisibilityPill.textContent = 'Private until shared';
      syncWorkspaceFormSummary('lead');
    }

    function setWorkspaceSummaryValue(id, value, fallback) {
      const node = document.getElementById(id);
      if (!node) return;
      const nextValue = String(value || '').trim();
      node.textContent = nextValue || fallback;
    }

    function syncWorkspaceFormSummary(type) {
      if (type === 'property') {
        const purpose = getPropertyPurposeLabel(document.getElementById('propertyPurposeValue')?.value);
        const propertyCategory = document.getElementById('propertyCategory')?.value || '';
        const unitLayout = document.getElementById('propertyUnitLayout')?.value || '';
        const location = document.getElementById('propertyLocation')?.value || '';
        const building = document.getElementById('propertyBuildingName')?.value || '';
        const status = document.getElementById('propertyStatus')?.value || '';
        const visibilityText = document.getElementById('propertyDistress')?.checked
          ? `Distress workflow active${status ? ` · ${formatStatusLabel(status)}` : ''}`
          : `${status ? formatStatusLabel(status) : 'Available'} · Private inventory`;

        setWorkspaceSummaryValue('workspaceSummaryPurpose', purpose === 'Listing' ? '' : purpose, 'Choose rent or sale');
        setWorkspaceSummaryValue('workspaceSummaryType', formatDashboardPropertyDimensions(propertyCategory, unitLayout), 'Choose category and layout');
        setWorkspaceSummaryValue('workspaceSummaryLocation', [location, building].filter(Boolean).join(' · '), 'Add area or project details');
        setWorkspaceSummaryValue('workspaceSummaryState', visibilityText, 'Starts private inside Broker Desk');
        return;
      }

      const purpose = getLeadClientPurposeLabel(document.getElementById('leadClientPurpose')?.value);
      const propertyCategory = document.getElementById('leadPropertyCategory')?.value || '';
      const unitLayout = document.getElementById('leadUnitLayout')?.value || '';
      const location = document.getElementById('leadLocation')?.value || '';
      const building = document.getElementById('leadBuildingProject')?.value || '';
      const status = document.getElementById('leadStatus')?.value || '';
      const paymentMethod = document.getElementById('leadPaymentMethod')?.value || '';
      const stateText = [status ? formatStatusLabel(status) : '', paymentMethod].filter(Boolean).join(' · ');

      setWorkspaceSummaryValue('workspaceSummaryPurpose', purpose === 'Requirement' ? '' : purpose, 'Choose rent or buy');
      setWorkspaceSummaryValue('workspaceSummaryType', formatDashboardPropertyDimensions(propertyCategory, unitLayout), 'Choose category and layout');
      setWorkspaceSummaryValue('workspaceSummaryLocation', [location, building].filter(Boolean).join(' · '), 'Add area or project details');
      setWorkspaceSummaryValue('workspaceSummaryState', stateText, 'Starts private inside Broker Desk');
    }

    function setLeadPurpose(purpose, options = {}) {
      const normalizedPurpose = ['rent', 'buy'].includes(String(purpose || '').toLowerCase()) ? String(purpose).toLowerCase() : '';
      const hiddenInput = document.getElementById('leadClientPurpose');
      const details = document.getElementById('leadRequirementFields');
      const clientSection = document.getElementById('leadClientSection');
      const notesSection = document.getElementById('leadNotesSection');
      const workflowSection = document.getElementById('leadWorkflowSection');
      const paymentWrap = document.getElementById('leadPaymentMethodWrap');
      const paymentSelect = document.getElementById('leadPaymentMethod');
      const propertyCategorySelect = document.getElementById('leadPropertyCategory');
      const unitLayoutSelect = document.getElementById('leadUnitLayout');

      if (hiddenInput) hiddenInput.value = normalizedPurpose;

      document.querySelectorAll('#leadPurposeControl .segment-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.purpose === normalizedPurpose);
      });

      const showDetails = Boolean(normalizedPurpose);
      details?.classList.toggle('crm-hidden', !showDetails);
      clientSection?.classList.toggle('crm-hidden', !showDetails);
      notesSection?.classList.toggle('crm-hidden', !showDetails);
      // Keep workflow fields in the DOM for compatibility, but hide the form section
      // so add/edit flows stay cleaner.
      workflowSection?.classList.add('crm-hidden');
      paymentWrap?.classList.toggle('crm-hidden', normalizedPurpose !== 'buy');

      syncLeadPropertyDimensionControls(options.preserveValues ? {
        propertyCategory: propertyCategorySelect?.value || '',
        unitLayout: unitLayoutSelect?.value || '',
        propertyType: document.getElementById('leadPropertyType')?.value || ''
      } : {});

      const previousPaymentMethod = options.preserveValues ? paymentSelect?.value || '' : '';
      populateLeadPaymentMethodOptions(previousPaymentMethod);
      if (normalizedPurpose !== 'buy' && paymentSelect) paymentSelect.value = '';
      syncWorkspaceFormSummary('lead');
    }

    function cancelLeadForm() {
      resetLeadForm();
      hideOverviewWorkspace();
    }

    function openLeadComposer() {
      resetLeadForm();
      showOverviewWorkspace('lead');
      setLeadWorkspaceHeader('create');
    }

    function openPropertyComposer() {
      resetPropertyForm();
      showOverviewWorkspace('property');
    }

    function getAutocompleteMatches(dataset, query, options = {}) {
      const normalizedQuery = normalizeTaxonomyToken(query);
      const values = dedupeTaxonomyValues(dataset || []);
      const aliasMap = options?.aliasMap || {};
      const maxResults = Number(options?.maxResults) > 0 ? Number(options.maxResults) : 12;
      const aliasLookup = new Map();

      Object.entries(aliasMap).forEach(([aliasKey, canonicalValue]) => {
        const canonicalToken = normalizeTaxonomyToken(canonicalValue);
        const aliasToken = normalizeTaxonomyToken(aliasKey);
        if (!canonicalToken || !aliasToken) return;
        if (!aliasLookup.has(canonicalToken)) aliasLookup.set(canonicalToken, []);
        aliasLookup.get(canonicalToken).push(aliasToken);
      });

      if (!normalizedQuery) return values.slice(0, maxResults);

      const startsWith = [];
      const wordStarts = [];
      const contains = [];
      const aliasStarts = [];
      const aliasContains = [];

      values.forEach(item => {
        const normalizedItem = normalizeTaxonomyToken(item);
        const itemAliases = aliasLookup.get(normalizedItem) || [];
        const itemWords = normalizedItem.split(' ');

        if (normalizedItem.startsWith(normalizedQuery)) {
          startsWith.push(item);
          return;
        }

        if (itemWords.some(word => word.startsWith(normalizedQuery))) {
          wordStarts.push(item);
          return;
        }

        if (normalizedItem.includes(normalizedQuery)) {
          contains.push(item);
          return;
        }

        if (itemAliases.some(alias => alias.startsWith(normalizedQuery))) {
          aliasStarts.push(item);
          return;
        }

        if (itemAliases.some(alias => alias.includes(normalizedQuery))) {
          aliasContains.push(item);
        }
      });

      return [
        ...startsWith,
        ...wordStarts,
        ...contains,
        ...aliasStarts,
        ...aliasContains
      ].slice(0, maxResults);
    }

    function setupAutocompleteController({ inputId, menuId, boxId, datasetProvider, matchOptionsProvider = null }) {
      const input = document.getElementById(inputId);
      const menu = document.getElementById(menuId);
      const box = document.getElementById(boxId);
      if (!input || !menu || !box) return null;

      const controller = {
        items: [],
        highlightedIndex: -1,
        close() {
          menu.innerHTML = '';
          menu.classList.add('hidden');
          input.setAttribute('aria-expanded', 'false');
          controller.highlightedIndex = -1;
        },
        select(value) {
          input.value = value;
          controller.close();
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        render(query = input.value) {
          controller.items = getAutocompleteMatches(
            datasetProvider(),
            query,
            typeof matchOptionsProvider === 'function' ? matchOptionsProvider() : {}
          );
          if (!controller.items.length) {
            controller.close();
            return;
          }

          menu.innerHTML = controller.items.map((item, index) => `
            <button class="combo-option ${index === controller.highlightedIndex ? 'active' : ''}" type="button" data-index="${index}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>
          `).join('');
          menu.classList.remove('hidden');
          input.setAttribute('aria-expanded', 'true');
        }
      };

      input.addEventListener('input', () => {
        input.classList.remove('is-invalid');
        controller.highlightedIndex = -1;
        controller.render(input.value);
      });

      input.addEventListener('focus', () => controller.render(input.value));

      input.addEventListener('keydown', event => {
        if (menu.classList.contains('hidden')) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            controller.render(input.value);
          }
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          controller.highlightedIndex = Math.min(controller.highlightedIndex + 1, controller.items.length - 1);
          controller.render(input.value);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          controller.highlightedIndex = Math.max(controller.highlightedIndex - 1, 0);
          controller.render(input.value);
        } else if (event.key === 'Enter' && controller.highlightedIndex >= 0) {
          event.preventDefault();
          controller.select(controller.items[controller.highlightedIndex]);
        } else if (event.key === 'Escape') {
          controller.close();
        }
      });

      menu.addEventListener('mousedown', event => {
        event.preventDefault();
      });

      menu.addEventListener('click', event => {
        const option = event.target.closest('.combo-option');
        if (!option) return;
        controller.select(option.dataset.value || '');
      });

      document.addEventListener('click', event => {
        if (!event.target.closest(`#${boxId}`)) {
          controller.close();
        }
      });

      return controller;
    }

    function ensureLeadFormEnhancements() {
      if (!leadAutocompleteControllers.location) {
        leadAutocompleteControllers.location = setupAutocompleteController({
          inputId: 'leadLocation',
          menuId: 'leadLocationMenu',
          boxId: 'leadLocationBox',
          datasetProvider: () => dedupeTaxonomyValues([
            ...(CORE_TAXONOMY.locations || []),
            ...(LEAD_CONFIG.uaeLocations || []),
            ...collectMasterLocationSuggestions(),
            ...collectDynamicLocationSuggestions()
          ]),
          matchOptionsProvider: () => ({
            aliasMap: getDashboardLocationAliasMap(),
            maxResults: 12
          })
        });
      }

      if (!leadAutocompleteControllers.building) {
        leadAutocompleteControllers.building = setupAutocompleteController({
          inputId: 'leadBuildingProject',
          menuId: 'leadBuildingMenu',
          boxId: 'leadBuildingBox',
          datasetProvider: () => getLocationScopedBuildingSuggestions(document.getElementById('leadLocation')?.value || ''),
          matchOptionsProvider: () => ({
            aliasMap: getDashboardBuildingAliasMap(),
            maxResults: 12
          })
        });
      }

      document.querySelectorAll('#leadPurposeControl .segment-btn').forEach(button => {
        button.addEventListener('click', () => {
          clearLeadErrors();
          setLeadPurpose(button.dataset.purpose || '', { preserveValues: true });
        });
      });

      syncLeadPropertyDimensionControls();
      populateLeadPaymentMethodOptions('');
      setLeadPurpose('', { preserveValues: false });

      document.getElementById('leadBudget')?.addEventListener('input', event => {
        event.target.value = normalizeBudgetDigits(event.target.value);
        event.target.classList.remove('is-invalid');
        syncWorkspaceFormSummary('lead');
      });

      ['leadLocation', 'leadBuildingProject', 'leadClientName', 'leadPrivateNotes'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', event => {
          event.target.classList.remove('is-invalid');
          syncWorkspaceFormSummary('lead');
        });
      });

      document.getElementById('leadLocation')?.addEventListener('blur', event => {
        event.target.value = normalizeDashboardLocationValue(event.target.value);
        syncWorkspaceFormSummary('lead');
      });

      ['leadPaymentMethod'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', event => {
          event.target.classList.remove('is-invalid');
          syncWorkspaceFormSummary('lead');
        });
      });

      ['leadPropertyCategory', 'leadUnitLayout'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', event => {
          event.target.classList.remove('is-invalid');
          syncLeadPropertyDimensionControls();
          syncWorkspaceFormSummary('lead');
        });
      });

      ['leadStatus', 'leadNextFollowUpDate', 'leadNextFollowUpTime'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => syncWorkspaceFormSummary('lead'));
      });

      document.getElementById('leadClientPhone')?.addEventListener('input', event => {
        event.target.classList.remove('is-invalid');
        syncWorkspaceFormSummary('lead');
      });

      document.getElementById('leadClientPhone')?.addEventListener('blur', event => {
        event.target.value = normalizeLeadPhoneInput(event.target.value);
        syncWorkspaceFormSummary('lead');
      });
    }

    function getPropertyPurpose(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'rent') return 'rent';
      if (normalized === 'sale') return 'sale';
      return '';
    }

    function getPropertyPurposeLabel(value) {
      const normalized = getPropertyPurpose(value);
      if (normalized === 'rent') return 'Rent';
      if (normalized === 'sale') return 'Sale';
      return 'Listing';
    }

    function populatePropertyCategoryOptions(selectedValue = '') {
      const select = document.getElementById('propertyCategory');
      if (!select) return;
      select.innerHTML = '<option value="">Select property category</option>' + DASHBOARD_PROPERTY_CATEGORY_OPTIONS.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      const normalizedSelectedValue = normalizeDashboardPropertyCategoryValue(selectedValue);
      select.value = normalizedSelectedValue && DASHBOARD_PROPERTY_CATEGORY_OPTIONS.includes(normalizedSelectedValue) ? normalizedSelectedValue : '';
    }

    function populatePropertyUnitLayoutOptions(selectedValue = '', propertyCategory = '') {
      const select = document.getElementById('propertyUnitLayout');
      const helper = document.getElementById('propertyUnitLayoutHelper');
      if (!select) return;
      const category = normalizeDashboardPropertyCategoryValue(propertyCategory);
      const allowsLayout = dashboardCategoryAllowsSelectableLayout(category);
      const options = allowsLayout ? DASHBOARD_UNIT_LAYOUT_OPTIONS : ['N/A'];
      const normalizedSelectedValue = normalizeDashboardUnitLayoutValue(selectedValue || (allowsLayout ? '' : 'N/A'));
      select.innerHTML = '<option value="">Select unit layout</option>' + options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      select.value = normalizedSelectedValue && options.includes(normalizedSelectedValue) ? normalizedSelectedValue : (allowsLayout ? '' : 'N/A');
      select.disabled = !category;
      if (helper) {
        helper.textContent = !category
          ? 'Choose a property category first.'
          : allowsLayout
            ? 'Select the layout for apartment, villa, or townhouse listings.'
            : 'Unit layout defaults to N/A for this property category.';
      }
    }

    function syncPropertyDimensionControls(source = null) {
      const derived = deriveDashboardPropertyDimensions(source || {
        propertyCategory: document.getElementById('propertyCategory')?.value,
        unitLayout: document.getElementById('propertyUnitLayout')?.value,
        propertyType: document.getElementById('propertyType')?.value
      });
      populatePropertyCategoryOptions(derived.propertyCategory);
      populatePropertyUnitLayoutOptions(derived.unitLayout, derived.propertyCategory);
      const hiddenInput = document.getElementById('propertyType');
      if (hiddenInput) hiddenInput.value = derived.propertyType || '';
      return derived;
    }

    function populatePropertyFloorOptions(selectedValue = '') {
      const select = document.getElementById('propertyFloorLevel');
      if (!select) return;
      const options = LEAD_CONFIG.floorLevels || [];
      select.innerHTML = '<option value="">Select floor level</option>' + options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      select.value = selectedValue && options.includes(selectedValue) ? selectedValue : '';
    }

    function populatePropertyRentOptions() {
      const furnishing = document.getElementById('propertyFurnishing');
      const cheques = document.getElementById('propertyCheques');
      const chiller = document.getElementById('propertyChiller');
      if (furnishing) {
        furnishing.innerHTML = '<option value="">Select furnishing</option>' + (LEAD_CONFIG.furnishingOptions || []).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      }
      if (cheques) {
        cheques.innerHTML = '<option value="">Select cheques</option>' + (LEAD_CONFIG.chequeOptions || []).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      }
      if (chiller) {
        chiller.innerHTML = '<option value="">Select chiller status</option>' + (LEAD_CONFIG.chillerOptions || []).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      }
    }

    function populatePropertySaleOptions() {
      const mortgage = document.getElementById('propertyMortgageStatus');
      if (!mortgage) return;
      mortgage.innerHTML = '<option value="">Select mortgage status</option>' + (LEAD_CONFIG.mortgageStatuses || []).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
    }

    function clearPropertyErrors() {
      [
        'propertyPurposeError',
        'propertyCategoryError',
        'propertyUnitLayoutError',
        'propertyLocationError',
        'propertyRentPriceError',
        'propertySalePriceError',
        'propertySaleStatusError',
        'propertyHandoverQuarterError',
        'propertyHandoverYearError',
        'propertyMarketPriceError',
        'propertyListingImagesError'
      ].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.textContent = '';
      });

      [
        'propertyType',
        'propertyLocation',
        'propertyBuildingName',
        'propertySizeSqft',
        'propertyFloorLevel',
        'propertyFurnishing',
        'propertyRentPrice',
        'propertyCheques',
        'propertyChiller',
        'propertySalePrice',
        'propertyMarketPrice',
        'propertyMortgageStatus',
        'propertySaleStatus',
        'propertyHandoverQuarter',
        'propertyHandoverYear',
        'propertyOwnerName',
        'propertyOwnerPhone',
        'propertyInternalNotes',
        'propertyPublicNotes'
      ].forEach(id => document.getElementById(id)?.classList.remove('is-invalid'));

      document.getElementById('propertyPurposeControl')?.classList.remove('is-invalid');
    }

    function setPropertyFieldError(field, message) {
      const errorMap = {
        purpose: 'propertyPurposeError',
        propertyCategory: 'propertyCategoryError',
        unitLayout: 'propertyUnitLayoutError',
        location: 'propertyLocationError',
        rentPrice: 'propertyRentPriceError',
        ownerAskingPrice: 'propertySalePriceError',
        salePropertyStatus: 'propertySaleStatusError',
        handoverQuarter: 'propertyHandoverQuarterError',
        handoverYear: 'propertyHandoverYearError',
        marketPrice: 'propertyMarketPriceError'
      };
      const inputMap = {
        purpose: 'propertyPurposeControl',
        propertyCategory: 'propertyCategory',
        unitLayout: 'propertyUnitLayout',
        location: 'propertyLocation',
        rentPrice: 'propertyRentPrice',
        ownerAskingPrice: 'propertySalePrice',
        salePropertyStatus: 'propertySaleStatus',
        handoverQuarter: 'propertyHandoverQuarter',
        handoverYear: 'propertyHandoverYear',
        marketPrice: 'propertyMarketPrice'
      };
      const errorNode = document.getElementById(errorMap[field]);
      if (errorNode) errorNode.textContent = message;
      document.getElementById(inputMap[field])?.classList.add('is-invalid');
    }

    function setPropertyWorkspaceHeader(mode = 'create') {
      const workspaceTitle = document.getElementById('workspaceTitle');
      const workspaceCopy = document.getElementById('workspaceCopy');
      if (!workspaceTitle || !workspaceCopy) return;
      const workspaceKicker = document.getElementById('workspaceKicker');
      const workspaceModePill = document.getElementById('workspaceModePill');
      const workspaceVisibilityPill = document.getElementById('workspaceVisibilityPill');

      if (mode === 'edit') {
        workspaceTitle.textContent = 'Edit Listing';
      workspaceCopy.textContent = 'Update your private property inventory below. Only non-private details can be published later on NexBridge Marketplace.';
        if (workspaceKicker) workspaceKicker.textContent = 'Listing Editor';
        if (workspaceModePill) workspaceModePill.textContent = 'Edit flow';
        if (workspaceVisibilityPill) workspaceVisibilityPill.textContent = 'Private inventory record';
        syncWorkspaceFormSummary('property');
        return;
      }

      workspaceTitle.textContent = 'Add New Listing';
      workspaceCopy.textContent = 'Create and manage your private property inventory. You can choose later whether to publish non-private details publicly.';
      if (workspaceKicker) workspaceKicker.textContent = 'Listing Composer';
      if (workspaceModePill) workspaceModePill.textContent = 'Create flow';
      if (workspaceVisibilityPill) workspaceVisibilityPill.textContent = 'Private until shared';
      syncWorkspaceFormSummary('property');
    }

    function setPropertyPurpose(purpose, options = {}) {
      const normalizedPurpose = ['rent', 'sale'].includes(String(purpose || '').toLowerCase()) ? String(purpose).toLowerCase() : '';
      const hiddenInput = document.getElementById('propertyPurposeValue');
      const baseFields = document.getElementById('propertyBaseFields');
      const pricingSection = document.getElementById('propertyPricingSection');
      const mediaSection = document.getElementById('propertyMediaSection');
      const contactsSection = document.getElementById('propertyContactsSection');
      const notesSection = document.getElementById('propertyNotesSection');
      const workflowSection = document.getElementById('propertyWorkflowSection');
      const rentFields = document.getElementById('propertyRentFields');
      const saleFields = document.getElementById('propertySaleFields');
      const saleToggleRow = document.getElementById('propertySaleToggleRow');
      const handoverQuarterWrap = document.getElementById('propertyHandoverQuarterWrap');
      const handoverYearWrap = document.getElementById('propertyHandoverYearWrap');
      const distressRow = document.getElementById('propertyDistressRow');
      const distressFields = document.getElementById('propertyDistressFields');

      if (hiddenInput) hiddenInput.value = normalizedPurpose;

      document.querySelectorAll('#propertyPurposeControl .segment-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.purpose === normalizedPurpose);
      });

      const showSections = Boolean(normalizedPurpose);
      baseFields?.classList.toggle('crm-hidden', !showSections);
      pricingSection?.classList.toggle('crm-hidden', !showSections);
      mediaSection?.classList.toggle('crm-hidden', !showSections);
      contactsSection?.classList.toggle('crm-hidden', !showSections);
      notesSection?.classList.toggle('crm-hidden', !showSections);
      // Keep workflow fields in the DOM for compatibility, but hide the form section
      // so add/edit flows stay cleaner.
      workflowSection?.classList.add('crm-hidden');
      rentFields?.classList.toggle('crm-hidden', normalizedPurpose !== 'rent');
      saleFields?.classList.toggle('crm-hidden', normalizedPurpose !== 'sale');
      saleToggleRow?.classList.toggle('crm-hidden', normalizedPurpose !== 'sale');
      handoverQuarterWrap?.classList.toggle('crm-hidden', normalizedPurpose !== 'sale');
      handoverYearWrap?.classList.toggle('crm-hidden', normalizedPurpose !== 'sale');
      distressRow?.classList.toggle('crm-hidden', !showSections);
      distressFields?.classList.toggle('crm-hidden', !showSections || !document.getElementById('propertyDistress')?.checked);

      if (!options.preserveValues) {
        document.getElementById('propertyFurnishing').value = '';
        document.getElementById('propertyRentPrice').value = '';
        document.getElementById('propertyCheques').value = '';
        document.getElementById('propertyChiller').value = '';
        document.getElementById('propertySalePrice').value = '';
        document.getElementById('propertyMarketPrice').value = '';
        document.getElementById('propertyMortgageStatus').value = '';
        document.getElementById('propertySaleStatus').value = 'Ready Property';
        document.getElementById('propertyHandoverQuarter').value = '';
        document.getElementById('propertyHandoverYear').value = '';
        document.getElementById('propertyLeasehold').checked = false;
      }

      refreshPropertyDistressUI();
      refreshPropertySaleStatusUI();
      syncWorkspaceFormSummary('property');
    }

    function refreshPropertySaleStatusUI() {
      const purpose = getPropertyPurpose(document.getElementById('propertyPurposeValue')?.value);
      const saleStatusField = document.getElementById('propertySaleStatus');
      const handoverQuarterWrap = document.getElementById('propertyHandoverQuarterWrap');
      const handoverYearWrap = document.getElementById('propertyHandoverYearWrap');
      const handoverQuarterField = document.getElementById('propertyHandoverQuarter');
      const handoverYearField = document.getElementById('propertyHandoverYear');
      const saleStatus = normalizeDashboardSalePropertyStatusValue(saleStatusField?.value) || 'Ready Property';
      const showHandover = purpose === 'sale' && saleStatus === 'Off Plan Property';

      if (saleStatusField && purpose === 'sale' && !normalizeDashboardSalePropertyStatusValue(saleStatusField.value)) {
        saleStatusField.value = 'Ready Property';
      }
      handoverQuarterWrap?.classList.toggle('crm-hidden', !showHandover);
      handoverYearWrap?.classList.toggle('crm-hidden', !showHandover);

      if (!showHandover) {
        if (handoverQuarterField) handoverQuarterField.value = '';
        if (handoverYearField) handoverYearField.value = '';
      } else if (handoverYearField) {
        handoverYearField.value = normalizeDashboardHandoverYearValue(handoverYearField.value);
      }
    }

    function refreshPropertyDistressUI() {
      const purpose = getPropertyPurpose(document.getElementById('propertyPurposeValue')?.value);
      const distressEnabled = Boolean(document.getElementById('propertyDistress')?.checked);
      const marketPriceField = document.getElementById('propertyMarketPrice');
      const distressFields = document.getElementById('propertyDistressFields');
      const distressMetric = document.getElementById('propertyDistressMetric');
      const distressMetricText = document.getElementById('propertyDistressMetricText');
      const distressMetricBadge = document.getElementById('propertyDistressMetricBadge');
      const rentPriceLabel = document.getElementById('propertyRentPriceLabel');
      const salePriceLabel = document.getElementById('propertySalePriceLabel');
      const activePrice = purpose === 'sale'
        ? normalizeBudgetDigits(document.getElementById('propertySalePrice')?.value || '')
        : normalizeBudgetDigits(document.getElementById('propertyRentPrice')?.value || '');
      const marketPrice = normalizeBudgetDigits(marketPriceField?.value || '');

      if (rentPriceLabel) {
        rentPriceLabel.textContent = distressEnabled ? 'Asking Price' : 'Rent Price';
      }
      if (salePriceLabel) {
        salePriceLabel.textContent = distressEnabled ? 'Asking Price' : 'Owner Asking Price';
      }

      distressFields?.classList.toggle('crm-hidden', !purpose || !distressEnabled);

      const marketValue = Number(marketPrice || 0);
      const askingValue = Number(activePrice || 0);
      if (distressMetric && distressMetricText && distressMetricBadge) {
        const canShowMetric = distressEnabled && marketValue > 0 && askingValue > 0 && marketValue > askingValue;
        distressMetric.classList.toggle('active', Boolean(distressEnabled));
        if (!distressEnabled) {
          distressMetricText.textContent = 'Enable distress deal and enter market plus asking price to see the gap.';
          distressMetricBadge.textContent = '--';
        } else if (canShowMetric) {
          const discountPercent = Math.round(((marketValue - askingValue) / marketValue) * 100);
          distressMetricText.textContent = `Market ${formatBudgetLabel(marketPrice)} vs asking ${formatBudgetLabel(activePrice)}.`;
          distressMetricBadge.textContent = `${discountPercent}% below market`;
        } else {
          distressMetricText.textContent = 'Add both market and asking prices to calculate distress gap.';
          distressMetricBadge.textContent = '--';
        }
      }
    }

    function cancelPropertyForm() {
      resetPropertyForm();
      hideOverviewWorkspace();
    }

    function ensurePropertyFormEnhancements() {
      if (!propertyAutocompleteControllers.location) {
        propertyAutocompleteControllers.location = setupAutocompleteController({
          inputId: 'propertyLocation',
          menuId: 'propertyLocationMenu',
          boxId: 'propertyLocationBox',
          datasetProvider: () => dedupeTaxonomyValues([
            ...(CORE_TAXONOMY.locations || []),
            ...(LEAD_CONFIG.uaeLocations || []),
            ...collectMasterLocationSuggestions(),
            ...collectDynamicLocationSuggestions()
          ]),
          matchOptionsProvider: () => ({
            aliasMap: getDashboardLocationAliasMap(),
            maxResults: 12
          })
        });
      }

      if (!propertyAutocompleteControllers.building) {
        propertyAutocompleteControllers.building = setupAutocompleteController({
          inputId: 'propertyBuildingName',
          menuId: 'propertyBuildingMenu',
          boxId: 'propertyBuildingBox',
          datasetProvider: () => getLocationScopedBuildingSuggestions(document.getElementById('propertyLocation')?.value || ''),
          matchOptionsProvider: () => ({
            aliasMap: getDashboardBuildingAliasMap(),
            maxResults: 12
          })
        });
      }

      document.querySelectorAll('#propertyPurposeControl .segment-btn').forEach(button => {
        button.addEventListener('click', () => {
          clearPropertyErrors();
          setPropertyPurpose(button.dataset.purpose || '', { preserveValues: true });
        });
      });

      syncPropertyDimensionControls();
      populatePropertyFloorOptions('');
      populatePropertyRentOptions();
      populatePropertySaleOptions();
      setPropertyPurpose('', { preserveValues: false });

      ['propertyRentPrice', 'propertySalePrice', 'propertyMarketPrice'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', event => {
          event.target.value = normalizeBudgetDigits(event.target.value);
          event.target.classList.remove('is-invalid');
          refreshPropertyDistressUI();
          syncWorkspaceFormSummary('property');
        });
      });

      document.getElementById('propertySizeSqft')?.addEventListener('input', event => {
        event.target.value = normalizeDecimalInput(event.target.value);
        event.target.classList.remove('is-invalid');
        refreshPropertyDistressUI();
        syncWorkspaceFormSummary('property');
      });

      document.getElementById('propertyDistress')?.addEventListener('change', () => {
        refreshPropertyDistressUI();
        syncWorkspaceFormSummary('property');
      });

      [
        'propertyCategory',
        'propertyUnitLayout',
        'propertyLocation',
        'propertyBuildingName',
        'propertySizeUnit',
        'propertyFloorLevel',
        'propertyFurnishing',
        'propertyCheques',
        'propertyChiller',
        'propertyMortgageStatus',
        'propertySaleStatus',
        'propertyHandoverQuarter',
        'propertyOwnerName',
        'propertyInternalNotes',
        'propertyPublicNotes'
      ].forEach(id => {
        document.getElementById(id)?.addEventListener('input', event => {
          event.target.classList.remove('is-invalid');
          syncWorkspaceFormSummary('property');
        });
        document.getElementById(id)?.addEventListener('change', event => {
          event.target.classList.remove('is-invalid');
          if (id === 'propertyCategory' || id === 'propertyUnitLayout') {
            syncPropertyDimensionControls();
          }
          if (id === 'propertySaleStatus' || id === 'propertyHandoverQuarter') {
            refreshPropertySaleStatusUI();
          }
          syncWorkspaceFormSummary('property');
        });
      });

      document.getElementById('propertyHandoverYear')?.addEventListener('input', event => {
        event.target.value = normalizeDashboardHandoverYearValue(event.target.value);
        event.target.classList.remove('is-invalid');
        syncWorkspaceFormSummary('property');
      });
      document.getElementById('propertyHandoverYear')?.addEventListener('change', event => {
        event.target.value = normalizeDashboardHandoverYearValue(event.target.value);
        event.target.classList.remove('is-invalid');
        refreshPropertySaleStatusUI();
        syncWorkspaceFormSummary('property');
      });

      ['propertyOwnerPhone'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', event => {
          event.target.classList.remove('is-invalid');
          syncWorkspaceFormSummary('property');
        });
        document.getElementById(id)?.addEventListener('blur', event => {
          event.target.value = normalizeLeadPhoneInput(event.target.value);
          syncWorkspaceFormSummary('property');
        });
      });

      document.getElementById('propertyLocation')?.addEventListener('blur', event => {
        event.target.value = normalizeDashboardLocationValue(event.target.value);
        syncWorkspaceFormSummary('property');
      });

      const propertyImagesInput = document.getElementById('propertyImagesInput');
      if (propertyImagesInput && propertyImagesInput.dataset.bound !== 'true') {
        propertyImagesInput.addEventListener('change', handlePropertyImagesSelected);
        propertyImagesInput.dataset.bound = 'true';
      }
      updatePropertyImageUploadUi();
    }

    function setPropertyImagesError(message = '') {
      const node = document.getElementById('propertyListingImagesError');
      if (node) node.textContent = message;
    }

    function updatePropertyImageUploadUi(options = {}) {
      const summary = document.getElementById('propertyImagesSummary');
      const chipRow = document.getElementById('propertyImagesChipRow');
      const clearButton = document.getElementById('propertyImagesClearBtn');
      const images = Array.isArray(state.propertyImageDraft) ? state.propertyImageDraft : [];
      const isLoading = Boolean(options.loading);
      const countHint = Number(options.countHint || 0) || 0;

      if (summary) {
        if (isLoading) {
          summary.textContent = countHint > 0
            ? `Loading ${countHint} uploaded picture${countHint === 1 ? '' : 's'}...`
            : 'Loading uploaded pictures...';
        } else if (!images.length) {
          summary.textContent = 'No pictures uploaded';
        } else {
          summary.textContent = `${images.length} picture${images.length === 1 ? '' : 's'} ready`;
        }
      }

      if (chipRow) {
        if (isLoading) {
          chipRow.innerHTML = '';
        } else {
          chipRow.innerHTML = images.map((image, index) => `
            <span class="listing-upload-chip" title="${escapeHtml(image.name || `Picture ${index + 1}`)}">
              <strong>${index + 1}</strong>
              <span>${escapeHtml(image.name || `Picture ${index + 1}`)}</span>
            </span>
          `).join('');
        }
      }

      if (clearButton) {
        clearButton.disabled = isLoading || !images.length;
      }
    }

    function setPropertyImages(images, options = {}) {
      state.propertyImageDraft = window.ListingMediaUi?.sanitizeImageList(images) || [];
      state.propertyImageDraftLoaded = options.loaded !== undefined ? Boolean(options.loaded) : true;
      state.propertyImageDraftDirty = options.dirty !== undefined ? Boolean(options.dirty) : state.propertyImageDraftDirty;
      if (options.cacheKey) {
        state.propertyMediaCache[String(options.cacheKey)] = [...state.propertyImageDraft];
      }
      updatePropertyImageUploadUi(options);
    }

    function triggerPropertyImagesUpload() {
      document.getElementById('propertyImagesInput')?.click();
    }

    function clearPropertyImages() {
      document.getElementById('propertyImagesInput').value = '';
      setPropertyImagesError('');
      setPropertyImages([], { loaded: true, dirty: true });
    }

    async function handlePropertyImagesSelected(event) {
      const input = event?.target;
      if (!input) return;
      setPropertyImagesError('');
      try {
        if (!window.ListingMediaUi?.appendFilesToImages) {
          throw new Error('Picture tools are unavailable right now. Refresh and try again.');
        }
        updatePropertyImageUploadUi({ loading: true, countHint: state.propertyImageDraft.length });
        const images = await window.ListingMediaUi.appendFilesToImages(state.propertyImageDraft, input.files);
        setPropertyImages(images || [], { loaded: true, dirty: true });
      } catch (error) {
        updatePropertyImageUploadUi();
        setPropertyImagesError(error?.message || 'Could not add pictures.');
      } finally {
        input.value = '';
      }
    }

    async function fetchPropertyMedia(propertyId) {
      const cacheKey = String(propertyId || '');
      if (state.propertyMediaCache[cacheKey]) {
        return state.propertyMediaCache[cacheKey];
      }
      const response = await fetch('/api/broker-dashboard', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ action: 'get-property-media', id: propertyId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Could not load listing pictures.');
      }
      const images = window.ListingMediaUi?.sanitizeImageList(result?.images) || [];
      state.propertyMediaCache[cacheKey] = images;
      return images;
    }

    async function savePropertyMedia(propertyId, images) {
      const response = await fetch('/api/broker-dashboard', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          action: 'set-property-media',
          id: propertyId,
          listingImages: Array.isArray(images) ? images : []
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Pictures could not be uploaded.');
      }
      const safeImages = window.ListingMediaUi?.sanitizeImageList(result?.images) || [];
      state.propertyMediaCache[String(propertyId || '')] = safeImages;
      return {
        images: safeImages,
        count: Number(result?.count || safeImages.length || 0) || 0,
        property: result?.property || null
      };
    }

    async function openPropertyPictures(id) {
      const property = (Array.isArray(state.properties) ? state.properties : []).find(item => item.id === Number(id));
      if (!property) return;
      try {
        if (!window.ListingMediaUi?.openGallery) {
          throw new Error('Picture viewer is unavailable right now. Refresh and try again.');
        }
        const images = await fetchPropertyMedia(property.id);
        window.ListingMediaUi.openGallery({
          title: `${getPropertyPurposeLabel(property.purpose)} ${property.propertyType ? `- ${property.propertyType}` : 'Listing Pictures'}`,
          images
        });
      } catch (error) {
        setStatus(error?.message || 'Could not load listing pictures.', 'error');
      }
    }

    function getPropertyPdfRequesterProfile() {
      const profile = getActiveBrokerProfile() || {};
      return {
        fullName: normalizeText(profile.fullName),
        mobileNumber: normalizeLeadPhoneInput(profile.whatsappNumber || profile.mobileNumber || ''),
        email: normalizeText(profile.email),
        companyName: normalizeText(profile.companyName),
        officeLocation: normalizeText(profile.officeLocation),
        avatarDataUrl: normalizeText(profile.avatarDataUrl)
      };
    }

    function buildPropertyPdfOptionSections(property, requester) {
      const purpose = getPropertyPurpose(property?.purpose);
      const handoverLabel = getPropertyHandoverLabel(property);
      const saleStatus = getPropertySaleStatusLabel(property);
      const isOffPlan = normalizeText(saleStatus).toLowerCase() === 'off plan property';
      const distressLabel = getPropertyDistressLabel(property);
      const hasCompanyDetails = Boolean(requester?.companyName || requester?.officeLocation);
      return [
        {
          key: 'paymentDetails',
          label: 'Payment details',
          description: 'Include chiller, mortgage, and ownership details where available.',
          checked: false,
          hidden: !(property?.chiller || property?.mortgageStatus || property?.leasehold)
        },
        {
          key: 'chequesDetails',
          label: 'Cheques details',
          description: 'Include cheque count for rent listings.',
          checked: false,
          hidden: purpose !== 'rent'
        },
        {
          key: 'companyDetails',
          label: 'Company details',
          description: 'Show your company name and office location.',
          checked: false,
          hidden: !hasCompanyDetails
        },
        {
          key: 'images',
          label: 'Images',
          description: 'Include uploaded listing pictures in the PDF.',
          checked: true
        },
        {
          key: 'publicNotes',
          label: 'Public notes/description',
          description: 'Include the public-safe listing note.',
          checked: false,
          hidden: !normalizeText(property?.publicNotes)
        },
        {
          key: 'distressDetails',
          label: 'Distress details if available',
          description: 'Include distress gap and market price details.',
          checked: false,
          hidden: !(property?.isDistress || distressLabel || property?.marketPrice)
        },
        {
          key: 'offPlanDetails',
          label: 'Off-plan handover details if available',
          description: 'Include sale status and handover timing.',
          checked: false,
          hidden: !(isOffPlan || handoverLabel)
        }
      ];
    }

    function buildPropertyPublicSafePdfPayload(property, requester, selections = {}, images = []) {
      const purpose = getPropertyPurpose(property?.purpose);
      const handoverLabel = getPropertyHandoverLabel(property);
      const saleStatus = getPropertySaleStatusLabel(property) || 'Ready Property';
      const distressLabel = getPropertyDistressLabel(property) || 'Add both market and asking prices to calculate distress gap.';
      const fields = [
        { label: 'Purpose', value: getPropertyPurposeLabel(property.purpose) },
        { label: 'Property Category', value: getDashboardDisplayPropertyCategory(property) || '--' },
        { label: 'Unit Layout', value: getDashboardDisplayUnitLayout(property) || property.propertyType || '--' },
        { label: 'Location', value: property.location || '--' },
        { label: 'Building / Project', value: property.buildingName || '--' },
        { label: 'Price', value: getPropertyDisplayPrice(property) },
        { label: 'Size', value: formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit) || '--' }
      ];
      if (property.furnishing) {
        fields.push({ label: 'Furnishing', value: property.furnishing });
      }

      const sections = [];
      if (selections.paymentDetails) {
        const paymentFields = [];
        if (property.chiller) paymentFields.push({ label: 'Chiller', value: property.chiller });
        if (property.mortgageStatus) paymentFields.push({ label: 'Mortgage Status', value: property.mortgageStatus });
        if (property.leasehold) paymentFields.push({ label: 'Ownership', value: 'Leasehold' });
        if (paymentFields.length) {
          sections.push({ title: 'Payment Details', fields: paymentFields });
        }
      }
      if (selections.chequesDetails && purpose === 'rent' && property.cheques) {
        sections.push({
          title: 'Cheques Details',
          fields: [{ label: 'Cheques', value: property.cheques }]
        });
      }
      if (selections.companyDetails && (requester?.companyName || requester?.officeLocation)) {
        const companyFields = [];
        if (requester.companyName) companyFields.push({ label: 'Company Name', value: requester.companyName });
        if (requester.officeLocation) companyFields.push({ label: 'Office Location', value: requester.officeLocation });
        if (companyFields.length) {
          sections.push({ title: 'Company Details', fields: companyFields });
        }
      }
      if (selections.publicNotes && normalizeText(property.publicNotes)) {
        sections.push({
          title: 'Public Notes',
          notes: normalizeText(property.publicNotes)
        });
      }
      if (selections.distressDetails && (property.isDistress || normalizeText(property.marketPrice) || distressLabel)) {
        const distressFields = [
          { label: 'Distress Gap', value: distressLabel }
        ];
        if (property.marketPrice) {
          distressFields.push({ label: 'Market Price', value: formatBudgetLabel(property.marketPrice) });
        }
        sections.push({ title: 'Distress Details', fields: distressFields });
      }
      if (selections.offPlanDetails && (saleStatus || handoverLabel)) {
        const offPlanFields = [{ label: 'Sale Status', value: saleStatus }];
        if (handoverLabel) {
          offPlanFields.push({ label: 'Expected Handover', value: handoverLabel });
        }
        sections.push({ title: 'Off-plan Handover Details', fields: offPlanFields });
      }

      return {
        title: `${getPropertyPurposeLabel(property.purpose)} ${property.propertyType ? `- ${property.propertyType}` : 'Listing'}`,
        fileName: `${getPropertyPurposeLabel(property.purpose)}-${property.propertyType || 'listing'}`,
        fields,
        sections,
        images: selections.images ? images : undefined
      };
    }

    async function downloadPropertyPdf(id) {
      const property = (Array.isArray(state.properties) ? state.properties : []).find(item => item.id === Number(id));
      if (!property) return;
      try {
        if (!window.ListingMediaUi?.downloadListingPdf || !window.ListingMediaUi?.openPdfOptionsModal) {
          throw new Error('PDF tools are unavailable right now. Refresh and try again.');
        }
        const requester = getPropertyPdfRequesterProfile();
        const selections = await window.ListingMediaUi.openPdfOptionsModal({
          title: 'Customize PDF Details',
          description: 'Select which optional public-safe sections should appear in the PDF.',
          sections: buildPropertyPdfOptionSections(property, requester)
        });
        if (!selections) return;
        const images = selections.images ? await fetchPropertyMedia(property.id) : [];
        await window.ListingMediaUi.downloadListingPdf(buildPropertyPublicSafePdfPayload(property, requester, selections, images));
      } catch (error) {
        setStatus(error?.message || 'Could not download listing PDF.', 'error');
      }
    }

    function getPropertyPreservedState() {
      const original = state.propertyEditorOriginal || {};
      return {
        status: original.status || 'available',
        bedrooms: original.bedrooms ?? null,
        bathrooms: original.bathrooms ?? null,
        legacyDescription: original.legacyDescription || original.description || ''
      };
    }

    function collectPropertyFormData() {
      const preserved = getPropertyPreservedState();
      const purpose = document.getElementById('propertyPurposeValue').value;
      return {
        id: Number(document.getElementById('propertyId').value || 0),
        purpose,
        propertyType: document.getElementById('propertyType').value.trim(),
        location: document.getElementById('propertyLocation').value.trim(),
        buildingName: document.getElementById('propertyBuildingName').value.trim(),
        sizeSqft: formatSizeValue(document.getElementById('propertySizeSqft').value),
        sizeUnit: normalizeSizeUnit(document.getElementById('propertySizeUnit').value),
        floorLevel: document.getElementById('propertyFloorLevel').value.trim(),
        furnishing: document.getElementById('propertyFurnishing').value.trim(),
        rentPrice: normalizeBudgetDigits(document.getElementById('propertyRentPrice').value),
        cheques: document.getElementById('propertyCheques').value.trim(),
        chiller: document.getElementById('propertyChiller').value.trim(),
        ownerAskingPrice: normalizeBudgetDigits(document.getElementById('propertySalePrice').value),
        mortgageStatus: document.getElementById('propertyMortgageStatus').value.trim(),
        leasehold: document.getElementById('propertyLeasehold').checked,
        distressDeal: document.getElementById('propertyDistress').checked,
        ownerName: document.getElementById('propertyOwnerName').value.trim(),
        ownerPhone: normalizeLeadPhoneInput(document.getElementById('propertyOwnerPhone').value.trim()),
        internalNotes: document.getElementById('propertyInternalNotes').value.trim(),
        publicNotes: document.getElementById('propertyPublicNotes').value.trim(),
        status: preserved.status,
        bedrooms: preserved.bedrooms,
        bathrooms: preserved.bathrooms,
        legacyDescription: preserved.legacyDescription
      };
    }

    function validatePropertyFormData(formData) {
      const errors = {};
      if (!formData.purpose) errors.purpose = 'Select purpose';
      if (!formData.propertyCategory) errors.propertyCategory = 'Select property category';
      if (dashboardCategoryAllowsSelectableLayout(formData.propertyCategory) && !formData.unitLayout) errors.unitLayout = 'Select unit layout';
      if (!formData.location) errors.location = 'Enter location';
      if (getPropertyPurpose(formData.purpose) === 'rent' && (!formData.rentPrice || Number(formData.rentPrice) <= 0)) {
        errors.rentPrice = 'Enter rent price';
      }
      if (getPropertyPurpose(formData.purpose) === 'sale' && (!formData.ownerAskingPrice || Number(formData.ownerAskingPrice) <= 0)) {
        errors.ownerAskingPrice = 'Enter owner asking price';
      }
      return errors;
    }

    function setStatus(message = '', tone = 'success') {
      const el = document.getElementById('dashboardStatus');
      if (!el) return;
      if (!message) {
        el.className = 'status-bar';
        el.textContent = '';
        return;
      }
      el.className = `status-bar active ${tone}`;
      el.textContent = message;
    }

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      };
    }

    function formatComplaintStatusLabel(value) {
      const normalized = String(value || '').trim().toLowerCase();
      return COMPLAINT_STATUS_LABELS[normalized] || 'New';
    }

    function getComplaintTargetTypeLabel(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'listing') return 'Listing';
      if (normalized === 'requirement') return 'Requirement';
      if (normalized === 'broker') return 'Broker';
      return 'General';
    }

    function getComplaintSourceLabel(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'connector') return 'NexBridge';
      if (normalized === 'profile') return 'Profile';
      if (normalized === 'distress') return 'Distress Deals';
      if (normalized === 'listing') return 'Listings';
      if (normalized === 'requirement') return 'Requirements';
      return 'Broker Desk';
    }

    function getDefaultComplaintDraft(context = {}) {
      return {
        reason: '',
        description: '',
        proofAttachment: null,
        rulesAccepted: Boolean(context?.rulesAccepted),
        targetType: String(context?.targetType || '').trim().toLowerCase(),
        targetId: String(context?.targetId || '').trim(),
        targetLabel: String(context?.targetLabel || '').trim(),
        reportedUserId: String(context?.reportedUserId || '').trim(),
        reportedBrokerIdNumber: String(context?.reportedBrokerIdNumber || '').trim(),
        reportedBrokerName: String(context?.reportedBrokerName || '').trim(),
        sourceSection: String(context?.sourceSection || state.activeSection || 'dashboard').trim().toLowerCase(),
        title: String(context?.title || 'Report record').trim(),
        copy: String(context?.copy || 'Tell us what is wrong and our admin team will review it.').trim()
      };
    }

    function countComplaintsByStatus(status) {
      return state.complaints.filter(item => String(item?.normalizedStatus || item?.status || '').trim().toLowerCase() === status).length;
    }

    function getPlatformRulesStorageKey() {
      const broker = state.overview?.broker || state.broker || {};
      const keyPart = String(broker.id || broker.email || broker.brokerIdNumber || state.token || 'guest').trim() || 'guest';
      return `broker_platform_rules_acceptance_${keyPart}`;
    }

    function getPlatformRulesAcceptanceRecord() {
      try {
        const raw = localStorage.getItem(getPlatformRulesStorageKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== PLATFORM_RULES.version) return null;
        return parsed;
      } catch (error) {
        return null;
      }
    }

    function hasAcceptedPlatformRules() {
      return Boolean(getPlatformRulesAcceptanceRecord()?.acceptedAt);
    }

    function storePlatformRulesAcceptance(source = 'dashboard') {
      const record = {
        acceptedAt: new Date().toISOString(),
        version: PLATFORM_RULES.version,
        source
      };
      try {
        localStorage.setItem(getPlatformRulesStorageKey(), JSON.stringify(record));
      } catch (error) {
        console.debug('Could not store platform rules acceptance', error?.message || error);
      }
      return record;
    }

    function getPlatformRulesAcceptedLabel() {
      const record = getPlatformRulesAcceptanceRecord();
      if (!record?.acceptedAt) return '';
      return `Accepted ${formatDateTime(record.acceptedAt)}`;
    }

    function renderPlatformRulesAgreementControl(prefix, accepted, checked, onChange) {
      const statusText = accepted ? getPlatformRulesAcceptedLabel() || 'Rules already accepted for this broker session.' : 'Required before complaint submission or public sharing.';
      return `
        <div class="rules-agreement-card">
          <label class="rules-agreement-label" for="${escapeHtml(prefix)}RulesAcceptance">
            <input id="${escapeHtml(prefix)}RulesAcceptance" type="checkbox" ${checked ? 'checked' : ''} onchange="${onChange}">
            <span>${escapeHtml(PLATFORM_RULES.acceptanceText)}</span>
          </label>
          <div class="rules-agreement-status">${escapeHtml(statusText)}</div>
        </div>
      `;
    }

    function syncComplaintModalBodyLock() {
      const shouldLock = Boolean(state.complaintModalOpen || state.rulesPromptOpen);
      document.body.classList.toggle('complaint-modal-open', shouldLock);
      document.body.classList.toggle('rules-prompt-open', shouldLock);
    }

    function normalizeComplaintCenterTab(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'report-new' || normalized === 'rules') return normalized;
      return 'my-complaints';
    }

    function setComplaintCenterTab(view) {
      state.complaintsView = normalizeComplaintCenterTab(view);
      if (state.complaintsView === 'report-new') {
        ensureComplaintCenterDraft();
      }
      renderComplaintCenter();
    }

    function ensureComplaintCenterDraft(forceReset = false) {
      if (!state.complaintCenterDraft || forceReset) {
        state.complaintCenterDraft = getDefaultComplaintDraft({
          sourceSection: 'complaints',
          title: 'Report New Complaint',
          copy: 'Submit a complaint manually when you need admin review for a broker, listing, or requirement.',
          targetType: 'listing',
          rulesAccepted: hasAcceptedPlatformRules()
        });
      }
      return state.complaintCenterDraft;
    }

    function resetComplaintCenterDraft() {
      state.complaintCenterDraft = null;
      ensureComplaintCenterDraft(true);
      renderComplaintCenter();
    }

    function updateComplaintCenterDraftField(field, value) {
      const draft = ensureComplaintCenterDraft();
      draft[field] = value;
    }

    function closeComplaintComposer() {
      state.complaintModalOpen = false;
      state.complaintModalSubmitting = false;
      state.complaintDraft = null;
      renderComplaintModal();
      syncComplaintModalBodyLock();
    }

    function openComplaintComposer(context = {}) {
      state.complaintDraft = getDefaultComplaintDraft({
        ...context,
        rulesAccepted: hasAcceptedPlatformRules()
      });
      state.complaintModalSubmitting = false;
      state.complaintModalOpen = true;
      renderComplaintModal();
      syncComplaintModalBodyLock();
    }

    function openLeadComplaint(id) {
      const lead = state.leads.find(item => String(item.id) === String(id));
      if (!lead) {
        setStatus('Requirement could not be loaded for reporting.', 'error');
        return;
      }
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId: state.broker?.id || '',
        reportedUserId: state.broker?.id || '',
        targetType: 'requirement',
        targetId: lead.id,
        selfDisabledText: 'You cannot report your own requirement.'
      }) || { hidden: false, disabled: false };
      if (buttonState.hidden || buttonState.disabled) {
        setStatus(buttonState.disabledReason || 'You cannot report this requirement.', 'error');
        return;
      }
      openComplaintComposer({
        targetType: 'requirement',
        targetId: lead.id,
        targetLabel: `${getLeadClientPurposeLabel(lead.clientPurpose)} - ${lead.propertyType || 'Requirement'}`,
        reportedUserId: state.broker?.id || '',
        reportedBrokerIdNumber: state.broker?.brokerIdNumber || state.broker?.broker_id_number || '',
        reportedBrokerName: state.broker?.fullName || state.broker?.name || '',
        sourceSection: 'requirement',
        title: 'Report Requirement',
        copy: 'Submit a private complaint about this requirement. Admin will review the details without changing your workflow automatically.'
      });
    }

    function openPropertyComplaint(id, panelType = 'listing') {
      const property = state.properties.find(item => String(item.id) === String(id));
      if (!property) {
        setStatus('Listing could not be loaded for reporting.', 'error');
        return;
      }
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId: state.broker?.id || '',
        reportedUserId: state.broker?.id || '',
        targetType: 'listing',
        targetId: property.id,
        selfDisabledText: panelType === 'distress' ? 'You cannot report your own distress deal.' : 'You cannot report your own listing.'
      }) || { hidden: false, disabled: false };
      if (buttonState.hidden || buttonState.disabled) {
        setStatus(buttonState.disabledReason || 'You cannot report this listing.', 'error');
        return;
      }
      openComplaintComposer({
        targetType: 'listing',
        targetId: property.id,
        targetLabel: `${getPropertyPurposeLabel(property.purpose)} - ${property.propertyType || 'Listing'}`,
        reportedUserId: state.broker?.id || '',
        reportedBrokerIdNumber: state.broker?.brokerIdNumber || state.broker?.broker_id_number || '',
        reportedBrokerName: state.broker?.fullName || state.broker?.name || '',
        sourceSection: panelType === 'distress' ? 'distress' : 'listing',
        title: panelType === 'distress' ? 'Report Distress Deal' : 'Report Listing',
        copy: 'Explain the issue clearly so admin can review the record and any linked broker details.'
      });
    }

    function openBrokerComplaintFromProfile() {
      const broker = getActiveBrokerProfile();
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId: state.broker?.id || '',
        reportedUserId: broker.id || state.broker?.id || '',
        targetType: 'broker',
        targetId: broker.id || state.broker?.id || '',
        selfDisabledText: 'You cannot report your own broker profile.'
      }) || { hidden: false, disabled: false };
      if (buttonState.hidden || buttonState.disabled) {
        setStatus(buttonState.disabledReason || 'You cannot report this broker profile.', 'error');
        return;
      }
      openComplaintComposer({
        targetType: 'broker',
        targetId: broker.id || state.broker?.id || '',
        targetLabel: broker.fullName || broker.email || 'Broker account',
        reportedUserId: broker.id || state.broker?.id || '',
        reportedBrokerIdNumber: broker.brokerIdNumber || state.broker?.brokerIdNumber || '',
        reportedBrokerName: broker.fullName || '',
        sourceSection: 'profile',
        title: 'Report Broker Account',
        copy: 'Use this only if you need admin help reviewing or flagging this broker account.'
      });
    }

    function updateComplaintDraftField(field, value) {
      if (!state.complaintDraft) return;
      state.complaintDraft[field] = value;
    }

    function getComplaintTargetSummary(draft) {
      if (!draft) return 'No target selected';
      return draft.targetLabel || `${getComplaintTargetTypeLabel(draft.targetType)} ${draft.targetId || ''}`.trim() || 'No target selected';
    }

    function getComplaintStatusBadgeClass(status) {
      const normalized = String(status || '').trim().toLowerCase();
      if (normalized === 'new') return 'badge-yellow';
      if (normalized === 'under-review') return 'badge-orange';
      if (normalized === 'resolved') return 'badge-green';
      if (normalized === 'rejected') return 'badge-red';
      return 'badge-blue';
    }

    function getComplaintCenterTabItems() {
      return [
        {
          value: 'my-complaints',
          label: 'My Complaints',
          count: Array.isArray(state.complaints) ? state.complaints.length : 0
        },
        {
          value: 'report-new',
          label: 'Report New',
          count: null
        },
        {
          value: 'rules',
          label: 'Rules',
          count: getComplaintCenterRules().length
        }
      ];
    }

    function buildComplaintSubmissionPayload(draft) {
      return {
        action: 'create',
        reason: draft.reason,
        description: draft.description,
        proofAttachment: draft.proofAttachment,
        targetType: draft.targetType,
        targetId: draft.targetId,
        targetLabel: draft.targetLabel,
        reportedUserId: draft.reportedUserId,
        reportedBrokerIdNumber: draft.reportedBrokerIdNumber,
        reportedBrokerName: draft.reportedBrokerName,
        sourceSection: draft.sourceSection
      };
    }

    function validateComplaintDraft(draft) {
      if (!draft) return 'Complaint form is not ready.';
      if (!hasAcceptedPlatformRules() && !draft.rulesAccepted) return 'Accept platform rules before submitting a complaint.';
      if (!String(draft.targetType || '').trim()) return 'Select what you are reporting.';
      if (!String(draft.targetId || '').trim()) return 'Add the target ID or reference.';
      if (!String(draft.reason || '').trim()) return 'Select a complaint reason.';
      if (String(draft.description || '').trim().length < 10) return 'Add a brief complaint description.';
      return '';
    }

    async function submitComplaintDraftRequest(draft) {
      const response = await fetch('/api/broker-complaints', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(buildComplaintSubmissionPayload(draft))
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Complaint submission failed.');
      }
      return result;
    }

    function readComplaintProofAttachment(file) {
      if (!COMPLAINT_ALLOWED_PROOF_TYPES.includes(String(file?.type || '').toLowerCase())) {
        return Promise.reject(new Error('Proof upload must be JPG, PNG, WEBP, GIF, or PDF.'));
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = loadEvent => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: String(loadEvent?.target?.result || '')
        });
        reader.onerror = () => reject(new Error('Proof upload could not be read.'));
        reader.readAsDataURL(file);
      });
    }

    function renderComplaintMyComplaintsTab(complaints) {
      if (state.complaintsLoading && !complaints.length) {
        return `
          <div class="complaint-empty-state">
            <small>Loading</small>
            <strong>Fetching your submitted complaints</strong>
            <span>Complaint history and admin review notes are loading now.</span>
          </div>
        `;
      }

      if (state.complaintsError) {
        return `
          <div class="complaint-empty-state">
            <small>Complaint Center</small>
            <strong>Complaints could not be loaded</strong>
            <span>${escapeHtml(state.complaintsError)}</span>
            <div><button class="btn btn-secondary btn-tiny" type="button" onclick="loadBrokerComplaints(true)">Retry</button></div>
          </div>
        `;
      }

      if (!complaints.length) {
        return `
          <div class="complaint-empty-state">
            <small>No Complaints Yet</small>
            <strong>Your complaint center is clear</strong>
            <span>Reports you submit from listings, requirements, broker profiles, or the manual form will appear here with their latest review status.</span>
            <div><button class="btn btn-secondary btn-tiny" type="button" onclick="setComplaintCenterTab('report-new')">Report New</button></div>
          </div>
        `;
      }

      return `
        <div class="complaint-table-wrap">
          <table class="complaint-table">
            <thead>
              <tr>
                <th>Target Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th>Admin Note</th>
              </tr>
            </thead>
            <tbody>
              ${complaints.map(item => `
                <tr>
                  <td>
                    <strong>${escapeHtml(getComplaintTargetTypeLabel(item.targetType))}</strong>
                    <span>${escapeHtml(getComplaintSourceLabel(item.sourceSection || 'dashboard'))}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(item.reason || 'Complaint')}</strong>
                    <span>${escapeHtml(getComplaintTargetSummary(item))}</span>
                  </td>
                  <td>
                    <span class="badge ${getComplaintStatusBadgeClass(item.normalizedStatus)}">${escapeHtml(formatComplaintStatusLabel(item.normalizedStatus))}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(formatDateOnly(item.created_at || item.createdAt || ''))}</strong>
                    <span>${escapeHtml(formatDateTime(item.created_at || item.createdAt || ''))}</span>
                  </td>
                  <td class="complaint-note-cell">
                    ${item.adminNote
                      ? `<strong>${escapeHtml(item.adminNote)}</strong>`
                      : `<span class="complaint-note-empty">No admin note yet</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderComplaintReportNewTab() {
      const draft = ensureComplaintCenterDraft();
      const accepted = hasAcceptedPlatformRules();
      return `
        <form class="complaint-form-shell" onsubmit="submitComplaintCenterDraft(event)">
          <div class="complaint-form-layout">
            <div class="complaint-form-stack">
              <div class="complaint-center-card">
                <div class="complaint-center-head">
                  <div class="complaint-center-head-copy">
                    <h3>Report New Complaint</h3>
                    <p>Use the target reference from a listing, requirement, or broker profile. This submits directly to admin review without changing any live workflow.</p>
                  </div>
                  <div class="complaint-modal-actions">
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="resetComplaintCenterDraft()">Reset</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="loadBrokerComplaints(true)">Refresh Status</button>
                  </div>
                </div>
                <div class="complaint-field-grid">
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterTargetType">Target Type</label>
                    <select id="complaintCenterTargetType" onchange="updateComplaintCenterDraftField('targetType', this.value)">
                      <option value="listing" ${draft.targetType === 'listing' ? 'selected' : ''}>Listing</option>
                      <option value="requirement" ${draft.targetType === 'requirement' ? 'selected' : ''}>Requirement</option>
                      <option value="broker" ${draft.targetType === 'broker' ? 'selected' : ''}>Broker</option>
                    </select>
                  </div>
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterReason">Reason</label>
                    <select id="complaintCenterReason" onchange="updateComplaintCenterDraftField('reason', this.value)">
                      <option value="">Select reason</option>
                      ${COMPLAINT_REASON_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${draft.reason === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterTargetId">Target ID / Reference</label>
                    <input id="complaintCenterTargetId" type="text" value="${escapeHtml(draft.targetId || '')}" placeholder="Example: 284 or BC-REQ-102" oninput="updateComplaintCenterDraftField('targetId', this.value)">
                  </div>
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterTargetLabel">Target Label</label>
                    <input id="complaintCenterTargetLabel" type="text" value="${escapeHtml(draft.targetLabel || '')}" placeholder="Listing title, requirement summary, or broker name" oninput="updateComplaintCenterDraftField('targetLabel', this.value)">
                  </div>
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterReportedUserId">Reported User ID</label>
                    <input id="complaintCenterReportedUserId" type="text" value="${escapeHtml(draft.reportedUserId || '')}" placeholder="Optional if known" oninput="updateComplaintCenterDraftField('reportedUserId', this.value)">
                  </div>
                  <div class="complaint-form-section">
                    <label class="small" for="complaintCenterReportedBrokerIdNumber">Broker ID</label>
                    <input id="complaintCenterReportedBrokerIdNumber" type="text" value="${escapeHtml(draft.reportedBrokerIdNumber || '')}" placeholder="Optional broker ID or code" oninput="updateComplaintCenterDraftField('reportedBrokerIdNumber', this.value)">
                  </div>
                  <div class="complaint-form-section is-full">
                    <label class="small" for="complaintCenterReportedBrokerName">Reported Broker Name</label>
                    <input id="complaintCenterReportedBrokerName" type="text" value="${escapeHtml(draft.reportedBrokerName || '')}" placeholder="Optional broker or company name" oninput="updateComplaintCenterDraftField('reportedBrokerName', this.value)">
                  </div>
                  <div class="complaint-form-section is-full">
                    <label class="small" for="complaintCenterDescription">Description</label>
                    <textarea id="complaintCenterDescription" rows="6" placeholder="Describe the issue clearly so admin can review it quickly." oninput="updateComplaintCenterDraftField('description', this.value)">${escapeHtml(draft.description || '')}</textarea>
                  </div>
                  <div class="complaint-form-section is-full">
                    <label class="small" for="complaintCenterProof">Optional Proof</label>
                    <div class="complaint-upload-row">
                      <input id="complaintCenterProof" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" class="crm-hidden">
                      <button class="btn btn-secondary btn-tiny" type="button" onclick="document.getElementById('complaintCenterProof').click()">Upload Proof</button>
                      <span class="complaint-upload-note">${escapeHtml(draft.proofAttachment?.name || 'Images or PDF up to 2 MB')}</span>
                    </div>
                  </div>
                </div>
                <div class="complaint-modal-actions">
                  <button class="btn btn-secondary" type="button" onclick="resetComplaintCenterDraft()" ${state.complaintCenterSubmitting ? 'disabled' : ''}>Clear</button>
                  <button class="btn btn-primary" type="submit" ${state.complaintCenterSubmitting ? 'disabled' : ''}>${state.complaintCenterSubmitting ? 'Submitting...' : 'Submit Complaint'}</button>
                </div>
              </div>
            </div>
            <aside class="complaint-form-aside">
              ${renderPlatformRulesAgreementControl('complaintCenterForm', accepted, accepted || Boolean(draft.rulesAccepted), "updateComplaintCenterDraftField('rulesAccepted', this.checked)")}
              <div class="complaint-context-card">
                <div class="small">Submission Summary</div>
                <strong>${escapeHtml(getComplaintTargetTypeLabel(draft.targetType))}</strong>
                <span>${escapeHtml(getComplaintTargetSummary(draft))}</span>
              </div>
              <div class="complaint-context-card">
                <div class="small">Before You Submit</div>
                <ul class="complaint-helper-list">
                  <li>Use the exact target ID or reference when possible.</li>
                  <li>Include a broker name or user ID if you know who should be reviewed.</li>
                  <li>Duplicate complaints on the same target are temporarily blocked.</li>
                </ul>
              </div>
            </aside>
          </div>
        </form>
      `;
    }

    function renderComplaintRulesTab() {
      const accepted = hasAcceptedPlatformRules();
      const categories = getComplaintCenterRules();
      return `
        <div class="complaint-rules-grid">
          <div class="complaint-rule-card">
            <small>${escapeHtml(PLATFORM_RULES.title || 'Platform Rules')}</small>
            <strong>${escapeHtml(PLATFORM_RULES.title || 'Platform Rules & Conduct')}</strong>
            <p>${escapeHtml(PLATFORM_RULES.intro || '')}</p>
            ${renderPlatformRulesAgreementControl('complaintCenterRules', accepted, accepted, "if(this.checked){storePlatformRulesAcceptance('rules-tab');renderComplaintCenter();setStatus('Platform rules accepted for this broker session.','success')}")}
          </div>
          ${categories.length ? categories.map(rule => `
            <div class="complaint-rule-card">
              <small>Complaint Rule</small>
              <strong>${escapeHtml(rule.title)}</strong>
              <p>${escapeHtml(rule.description || rule.copy || '')}</p>
            </div>
          `).join('') : `
            <div class="complaint-rule-card">
              <small>Complaint Rules</small>
              <strong>Rules unavailable right now</strong>
              <p>Platform complaint and conduct rules are not available right now. You can still use the Complaint Center safely.</p>
            </div>
          `}
          <div class="complaint-acceptance-note">
            ${escapeHtml(PLATFORM_RULES.acceptanceText)} Reports should stay factual, relevant, and submitted in good faith.
          </div>
        </div>
      `;
    }

    function renderComplaintCenter() {
      const target = document.getElementById('complaintsCard');
      if (!target) return;
      try {
        const complaints = Array.isArray(state.complaints) ? state.complaints : [];
        const activeTab = normalizeComplaintCenterTab(state.complaintsView);
        const totalLabel = state.complaintsLoading && !complaints.length ? '--' : complaints.length;
        const newLabel = state.complaintsLoading && !complaints.length ? '--' : countComplaintsByStatus('new');
        const reviewLabel = state.complaintsLoading && !complaints.length ? '--' : countComplaintsByStatus('under-review');
        const resolvedLabel = state.complaintsLoading && !complaints.length ? '--' : countComplaintsByStatus('resolved');
        const tabItems = getComplaintCenterTabItems();
        let tabContent = renderComplaintMyComplaintsTab(complaints);

        if (activeTab === 'report-new') {
          tabContent = renderComplaintReportNewTab();
        } else if (activeTab === 'rules') {
          tabContent = renderComplaintRulesTab();
        }

        target.innerHTML = `
          <div class="complaint-center-shell">
            <div class="complaint-summary-grid">
              <div class="complaint-summary-card"><small>Total Complaints</small><strong>${totalLabel}</strong><span>All reports you submitted</span></div>
              <div class="complaint-summary-card"><small>New</small><strong>${newLabel}</strong><span>Waiting for review</span></div>
              <div class="complaint-summary-card"><small>Under Review</small><strong>${reviewLabel}</strong><span>Currently with admin</span></div>
              <div class="complaint-summary-card"><small>Resolved</small><strong>${resolvedLabel}</strong><span>Completed reports</span></div>
            </div>
            <div class="complaint-center-card">
              <div class="complaint-center-head">
                <div class="complaint-center-head-copy">
                  <h3>Complaint Workspace</h3>
                  <p>Submit new complaints, review current statuses, and understand the conduct rules that guide admin action.</p>
                </div>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="loadBrokerComplaints(true)">${state.complaintsLoading ? 'Refreshing...' : 'Refresh'}</button>
              </div>
              <div class="complaint-tabs" role="tablist" aria-label="Complaint Center tabs">
                ${tabItems.map(item => `
                  <button
                    class="complaint-tab ${activeTab === item.value ? 'is-active' : ''}"
                    type="button"
                    role="tab"
                    aria-selected="${activeTab === item.value ? 'true' : 'false'}"
                    onclick="setComplaintCenterTab('${item.value}')"
                  >
                    <span>${escapeHtml(item.label)}</span>
                    ${item.count === null ? '' : `<span class="complaint-tab-count">${escapeHtml(String(item.count))}</span>`}
                  </button>
                `).join('')}
              </div>
              <div class="complaint-page-grid">
                ${tabContent}
              </div>
            </div>
          </div>
        `;

        if (activeTab === 'report-new') {
          document.getElementById('complaintCenterProof')?.addEventListener('change', handleComplaintCenterProofSelection);
        }
      } catch (error) {
        console.error('Complaint Center render failed.', error);
        target.innerHTML = `
          <div class="complaint-center-card">
            <div class="complaint-empty-state">
              <small>Complaint Center</small>
              <strong>Rules unavailable right now</strong>
              <span>Complaint tools could not load completely, but Broker Desk is still available.</span>
              <div><button class="btn btn-secondary btn-tiny" type="button" onclick="renderComplaintCenter()">Retry</button></div>
            </div>
          </div>
        `;
      }
    }

    async function loadBrokerComplaints(showStatus = false) {
      state.complaintsLoading = true;
      state.complaintsError = '';
      renderComplaintCenter();
      try {
        const response = await fetch('/api/broker-complaints', {
          method: 'GET',
          headers: apiHeaders()
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.message || 'Complaint center failed to load.');
        }
        state.complaints = Array.isArray(result?.complaints) ? result.complaints : [];
        if (showStatus) {
          setStatus('Complaint Center refreshed.', 'success');
        }
      } catch (error) {
        state.complaintsError = error?.message || 'Complaint center failed to load.';
      } finally {
        state.complaintsLoading = false;
        renderComplaintCenter();
      }
    }

    function renderComplaintModal() {
      const backdrop = document.getElementById('dashboardComplaintModalBackdrop');
      const content = document.getElementById('dashboardComplaintModalContent');
      if (!backdrop || !content) return;

      if (!state.complaintModalOpen || !state.complaintDraft) {
        backdrop.classList.add('hidden');
        content.innerHTML = '';
        return;
      }

      const draft = state.complaintDraft;
      const accepted = hasAcceptedPlatformRules();
      backdrop.classList.remove('hidden');
      content.innerHTML = window.ComplaintCenterUi?.renderComplaintFormModal({
        variant: 'dashboard',
        titleId: 'dashboardComplaintModalTitle',
        title: draft.title || 'Submit Complaint',
        copy: draft.copy || 'Tell us what is wrong and our admin team will review it.',
        targetTypeLabel: getComplaintTargetTypeLabel(draft.targetType),
        targetSummary: getComplaintTargetSummary(draft),
        reportedUserLabel: draft.reportedBrokerName || 'Broker account',
        reportedMeta: draft.reportedBrokerIdNumber || 'Submitted privately to admin review.',
        reasonOptions: COMPLAINT_REASON_OPTIONS,
        selectedReason: draft.reason,
        proofName: draft.proofAttachment?.name || 'Images or PDF up to 2 MB',
        description: draft.description || '',
        closeHandler: 'closeComplaintComposer()',
        cancelHandler: 'closeComplaintComposer()',
        submitHandler: 'submitDashboardComplaint(event)',
        reasonInputId: 'dashboardComplaintReason',
        descriptionInputId: 'dashboardComplaintDescription',
        uploadInputId: 'dashboardComplaintProof',
        uploadInputClass: 'crm-hidden',
        uploadHandler: "document.getElementById('dashboardComplaintProof').click()",
        reasonChangeHandler: "updateComplaintDraftField('reason', this.value)",
        descriptionChangeHandler: "updateComplaintDraftField('description', this.value)",
        descriptionPlaceholder: 'Explain the issue clearly so admin can review it quickly.',
        extraContentHtml: renderPlatformRulesAgreementControl('dashboardComplaint', accepted, accepted || Boolean(draft.rulesAccepted), "updateComplaintDraftField('rulesAccepted', this.checked)"),
        submitting: state.complaintModalSubmitting,
        submitLabel: 'Submit Complaint',
        submittingLabel: 'Submitting...'
      }) || '';

      document.getElementById('dashboardComplaintProof')?.addEventListener('change', handleDashboardComplaintProofSelection);
    }

    async function handleDashboardComplaintProofSelection(event) {
      const file = event?.target?.files?.[0];
      if (!state.complaintDraft) return;
      if (!file) {
        state.complaintDraft.proofAttachment = null;
        renderComplaintModal();
        return;
      }
      if (file.size > (2 * 1024 * 1024)) {
        setStatus('Proof upload must be 2 MB or smaller.', 'error');
        event.target.value = '';
        return;
      }
      if (!COMPLAINT_ALLOWED_PROOF_TYPES.includes(String(file.type || '').toLowerCase())) {
        setStatus('Proof upload must be JPG, PNG, WEBP, GIF, or PDF.', 'error');
        event.target.value = '';
        return;
      }
      try {
        state.complaintDraft.proofAttachment = await readComplaintProofAttachment(file);
        renderComplaintModal();
      } catch (error) {
        event.target.value = '';
        setStatus(error?.message || 'Proof upload could not be read.', 'error');
      }
    }

    async function handleComplaintCenterProofSelection(event) {
      const file = event?.target?.files?.[0];
      const draft = ensureComplaintCenterDraft();
      if (!file) {
        draft.proofAttachment = null;
        renderComplaintCenter();
        return;
      }
      if (file.size > (2 * 1024 * 1024)) {
        setStatus('Proof upload must be 2 MB or smaller.', 'error');
        event.target.value = '';
        return;
      }
      if (!COMPLAINT_ALLOWED_PROOF_TYPES.includes(String(file.type || '').toLowerCase())) {
        setStatus('Proof upload must be JPG, PNG, WEBP, GIF, or PDF.', 'error');
        event.target.value = '';
        return;
      }
      try {
        draft.proofAttachment = await readComplaintProofAttachment(file);
        renderComplaintCenter();
      } catch (error) {
        event.target.value = '';
        setStatus(error?.message || 'Proof upload could not be read.', 'error');
      }
    }

    async function submitDashboardComplaint(event) {
      event?.preventDefault?.();
      if (!state.complaintDraft || state.complaintModalSubmitting) return;
      const submitButton = event?.submitter || document.querySelector('#dashboardComplaintModalContent button[type="submit"]');
      const draft = state.complaintDraft;
      const validationError = validateComplaintDraft(draft);
      if (validationError) {
        setStatus(validationError, 'error');
        return;
      }
      state.complaintModalSubmitting = true;
      renderComplaintModal();
      try {
        if (!hasAcceptedPlatformRules() && draft.rulesAccepted) {
          storePlatformRulesAcceptance('complaint-modal');
        }
        const result = window.ActionFeedbackUi
          ? await window.ActionFeedbackUi.withActionFeedback(
              submitButton,
              'Submitting Complaint...',
              'Complaint submitted successfully.',
              () => submitComplaintDraftRequest(draft),
              { showErrorToast: true }
            )
          : await submitComplaintDraftRequest(draft);
        setStatus(result?.message || 'Complaint submitted successfully.', 'success');
        await loadBrokerComplaints();
        closeComplaintComposer();
      } catch (error) {
        state.complaintModalSubmitting = false;
        renderComplaintModal();
        setStatus(error?.message || 'Complaint submission failed.', 'error');
      }
    }

    async function submitComplaintCenterDraft(event) {
      event?.preventDefault?.();
      const draft = ensureComplaintCenterDraft();
      if (state.complaintCenterSubmitting) return;
      const submitButton = event?.submitter || document.querySelector('.complaint-center-shell button[type="submit"]');
      const validationError = validateComplaintDraft(draft);
      if (validationError) {
        setStatus(validationError, 'error');
        return;
      }
      state.complaintCenterSubmitting = true;
      renderComplaintCenter();
      try {
        if (!hasAcceptedPlatformRules() && draft.rulesAccepted) {
          storePlatformRulesAcceptance('complaint-center');
        }
        const result = window.ActionFeedbackUi
          ? await window.ActionFeedbackUi.withActionFeedback(
              submitButton,
              'Submitting Complaint...',
              'Complaint submitted successfully.',
              () => submitComplaintDraftRequest(draft),
              { showErrorToast: true }
            )
          : await submitComplaintDraftRequest(draft);
        setStatus(result?.message || 'Complaint submitted successfully.', 'success');
        await loadBrokerComplaints();
        state.complaintCenterSubmitting = false;
        state.complaintsView = 'my-complaints';
        state.complaintCenterDraft = null;
        renderComplaintCenter();
      } catch (error) {
        state.complaintCenterSubmitting = false;
        renderComplaintCenter();
        setStatus(error?.message || 'Complaint submission failed.', 'error');
      }
    }

    function initDashboardComplaintModal() {
      const backdrop = document.getElementById('dashboardComplaintModalBackdrop');
      const card = document.getElementById('dashboardComplaintModalCard');
      if (!backdrop || !card || backdrop.dataset.ready === 'true') return;
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) {
          closeComplaintComposer();
        }
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.complaintModalOpen) {
          closeComplaintComposer();
        }
      });
      backdrop.dataset.ready = 'true';
    }
