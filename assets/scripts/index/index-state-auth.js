      const state = {
        authMode: 'signin',
        authRequestId: 0,
        authIntent: null,
        sessionToken: localStorage.getItem('broker_session_token') || '',
        brokerProfile: null,
      approvedCompanies: [],
      approvedCompaniesLoaded: false,
      approvedCompaniesRequest: null,
      authCompanyQuery: '',
      authCompanyMenuOpen: false,
      authCompanyActiveIndex: -1,
      listings: [],
      publicListingsLoading: true,
      publicListingsLoaded: false,
      listingMediaCache: {},
      activeSection: 'requirements',
      publicSearchQuery: '',
      publicFilters: {
        purpose: 'all',
        propertyCategory: 'all',
        unitLayout: 'all',
        location: 'all'
      },
      selectedPublicListingKeys: {
        requirements: '',
        marketplace: '',
        'distress-deals': ''
      },
      publicSplitScrollMemory: {
        requirements: '',
        marketplace: '',
        'distress-deals': ''
      },
      pendingPublicSplitScroll: null,
      revealedPublicContactKeys: {
        requirements: '',
        marketplace: '',
        'distress-deals': ''
      },
      complaintDraft: null,
      complaintModalOpen: false,
      complaintModalSubmitting: false,
      supportModalOpen: false,
      supportModalSubmitting: false,
      supportModalView: '',
      supportDraft: null,
      pagination: {
        requirements: 1,
        marketplace: 1,
        'distress-deals': 1
      },
      shareLink: '',
      contactPhone: '',
      menuOpen: false,
      forcePublicView: new URLSearchParams(window.location.search).get('view') === 'public'
    };
      const BROKER_SESSION_VERSION = '2026-04-23-complaint-rules-fix';
      const BROKER_SESSION_VERSION_KEY = 'broker_session_version';
      const BROKER_FORCE_RELOGIN_REASON_KEY = 'broker_force_relogin_reason';
      const BCP_AUTH_RETURN_KEY = 'bcp_auth_return_intent';
    const COMPLAINT_REASON_OPTIONS = ['Spam', 'Fake Listing', 'Wrong Information', 'Duplicate Content', 'Misleading Price', 'Abuse / Misconduct', 'Harassment', 'Fraud / Scam', 'Other'];
    const SUPPORT_SUBJECT_OPTIONS = ['General Help', 'Report Issue', 'Complaint', 'Account Problem'];
      const COMPLAINT_ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      const APPROVED_COMPANY_FALLBACKS = [
        'Xsite Real Estate',
        'Emaar Properties',
        'DAMAC Properties',
        'Nakheel',
        'Sobha Realty',
        'Azizi Developments',
        'Binghatti Developers',
        'Ellington Properties',
        'Danube Properties',
        'MAG Property Development',
        'Deyaar',
        'Meraas',
        'Dubai Properties',
        'Tiger Group',
        'Select Group',
        'Omniyat',
        'Imtiaz Developments',
        'Reportage Properties',
        'Samana Developers',
        'Nshama',
        'Arada',
        'Union Properties',
        'Wasl Properties',
        'Al Habtoor Group',
        'Allsopp & Allsopp',
        'Betterhomes',
        'Driven Properties',
        'fam Properties',
        'haus & haus',
        'Metropolitan Premium Properties',
        'AX Capital',
        'LuxuryProperty.com',
        'Espace Real Estate',
        'D&B Properties',
        'White & Co Real Estate',
        'Coldwell Banker UAE',
        'Engel & Volkers Dubai',
        'Provident Estate',
        'Seven Century Real Estate',
        'Key One Realty'
      ];
      const PLATFORM_RULES = window.BROKER_PLATFORM_RULES_CONFIG || {
        version: 'default',
        acceptanceText: 'I agree to platform rules and understand that violating them may result in warning, restriction, or account block.'
      };
    const authSupabaseUrl = 'https://unggpaomyzvurmawnahj.supabase.co';
    const authSupabaseKey = 'sb_publishable_32o5MAuNPn1e0Uy6ZC09Wg_2skR1xQW';

    function safeJsonRead(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        console.error(error);
        return fallback;
      }
    }

    function getPlatformRulesStorageKey() {
      const broker = state.brokerProfile || {};
      const keyPart = String(broker.id || broker.email || state.sessionToken || 'public').trim() || 'public';
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

    function storePlatformRulesAcceptance(source = 'connector') {
      const record = {
        acceptedAt: new Date().toISOString(),
        version: PLATFORM_RULES.version,
        source
      };
      try {
        localStorage.setItem(getPlatformRulesStorageKey(), JSON.stringify(record));
      } catch (error) {}
      return record;
    }

    function getPlatformRulesAcceptedLabel() {
      const record = getPlatformRulesAcceptanceRecord();
      if (!record?.acceptedAt) return '';
      try {
        return `Accepted ${new Date(record.acceptedAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}`;
      } catch (error) {
        return 'Rules already accepted';
      }
    }

    function renderPlatformRulesAgreementControl(prefix, accepted, checked, onChange) {
      const statusText = accepted ? getPlatformRulesAcceptedLabel() || 'Rules already accepted for this broker session.' : 'Required before complaint submission.';
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

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const CONNECTOR_DISPLAY_SEPARATOR = ' · ';

    function joinDisplayParts(parts, separator = CONNECTOR_DISPLAY_SEPARATOR) {
      return (Array.isArray(parts) ? parts : [parts])
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .join(separator);
    }

    const CORE_TAXONOMY = window.BROKER_CORE_TAXONOMY || {
      locations: [],
      propertyTypes: { listing: [] },
      purposes: {
        connector: [
          { value: 'rent', label: 'Rent' },
          { value: 'sale', label: 'Sale' }
        ]
      },
      statuses: { connector: [] },
      aliases: {
        propertyTypes: {},
        locations: {},
        purposes: {},
        statuses: {}
      }
    };

    const CONNECTOR_PURPOSE_OPTIONS = Object.freeze({
      requirements: [
        { value: 'rent', label: 'Rent' },
        { value: 'buy', label: 'Buy' }
      ],
      marketplace: [
        { value: 'rent', label: 'Rent' },
        { value: 'sale', label: 'Sale' }
      ],
      'distress-deals': [
        { value: 'rent', label: 'Rent' },
        { value: 'sale', label: 'Sale' }
      ]
    });

    function normalizeTaxonomyToken(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\\/]+/g, ' / ')
        .replace(/[\s_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function dedupeConnectorValues(values) {
      const seen = new Set();
      return (Array.isArray(values) ? values : []).filter(value => {
        const key = normalizeTaxonomyToken(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function canonicalizeConnectorValue(value, aliases = {}, allowedValues = []) {
      const rawValue = String(value || '').trim();
      if (!rawValue) return '';
      const token = normalizeTaxonomyToken(rawValue);
      const allowedMatch = (Array.isArray(allowedValues) ? allowedValues : []).find(option => normalizeTaxonomyToken(option) === token);
      if (allowedMatch) return allowedMatch;
      const aliasMatch = aliases?.[token];
      if (aliasMatch) return aliasMatch;
      return rawValue.replace(/\s+/g, ' ');
    }

    const CONNECTOR_PROPERTY_CATEGORY_OPTIONS = Object.freeze([
      'Apartment',
      'Villa',
      'Townhouse',
      'Office',
      'Shop / Retail',
      'Warehouse',
      'Land / Plot',
      'Other'
    ]);

    const CONNECTOR_UNIT_LAYOUT_OPTIONS = Object.freeze([
      'Studio',
      '1 BHK',
      '2 BHK',
      '3 BHK',
      '4 BHK',
      '5 BHK',
      '6+ BHK',
      'N/A'
    ]);

    const CONNECTOR_PROPERTY_CATEGORY_ALIASES = Object.freeze({
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

    const CONNECTOR_UNIT_LAYOUT_ALIASES = Object.freeze({
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

    function deriveConnectorPropertyDimensions(record = {}) {
      const rawCategory = String(record?.propertyCategory || record?.property_category || '').trim();
      const rawLayout = String(record?.unitLayout || record?.unit_layout || '').trim();
      const legacyType = normalizeConnectorPropertyType(record?.propertyType || record?.property_type || record?.category);
      let propertyCategory = canonicalizeConnectorValue(rawCategory, CONNECTOR_PROPERTY_CATEGORY_ALIASES, CONNECTOR_PROPERTY_CATEGORY_OPTIONS);
      let unitLayout = canonicalizeConnectorValue(rawLayout, CONNECTOR_UNIT_LAYOUT_ALIASES, CONNECTOR_UNIT_LAYOUT_OPTIONS);

      if (!propertyCategory || !unitLayout) {
        const legacyLayout = canonicalizeConnectorValue(legacyType, CONNECTOR_UNIT_LAYOUT_ALIASES, CONNECTOR_UNIT_LAYOUT_OPTIONS);
        if (!unitLayout && legacyLayout) {
          unitLayout = legacyLayout;
        }
        if (!propertyCategory) {
          propertyCategory = legacyLayout
            ? 'Apartment'
            : canonicalizeConnectorValue(legacyType, CONNECTOR_PROPERTY_CATEGORY_ALIASES, CONNECTOR_PROPERTY_CATEGORY_OPTIONS) || 'Other';
        }
        if (!unitLayout) {
          unitLayout = 'N/A';
        }
      }

      if (!propertyCategory) propertyCategory = 'Other';
      if (!unitLayout) unitLayout = 'N/A';

      return {
        propertyCategory,
        unitLayout,
        propertyType: legacyType || (unitLayout !== 'N/A' ? unitLayout : propertyCategory)
      };
    }

    function getConnectorDisplayPropertyCategory(record = {}) {
      return deriveConnectorPropertyDimensions(record).propertyCategory || '--';
    }

    function getConnectorDisplayUnitLayout(record = {}) {
      return deriveConnectorPropertyDimensions(record).unitLayout || '--';
    }

    function getConnectorDisplayPropertyType(record = {}) {
      return deriveConnectorPropertyDimensions(record).propertyType || '--';
    }

    function getConnectorSalePropertyStatus(record = {}) {
      const purpose = String(record?.purpose || '').trim().toLowerCase();
      if (purpose !== 'sale') return '';
      const status = String(record?.salePropertyStatus || record?.sale_property_status || '').trim();
      return status || 'Ready Property';
    }

    function getConnectorHandoverLabel(record = {}) {
      const quarter = String(record?.handoverQuarter || record?.handover_quarter || '').trim().toUpperCase();
      const year = String(record?.handoverYear || record?.handover_year || '').replace(/[^\d]/g, '').slice(0, 4);
      return quarter && year ? `${quarter} ${year}` : '';
    }

    function getConnectorDistressGapLabel(record = {}) {
      const marketValue = Number(String(record?.marketPrice || record?.market_price || '').replace(/[^\d]/g, ''));
      const askingValue = Number(String(record?.priceLabel || '').replace(/[^\d]/g, ''));
      const fallbackPercent = marketValue > askingValue && marketValue > 0 && askingValue > 0
        ? Math.round(((marketValue - askingValue) / marketValue) * 100)
        : 0;
      const percent = Number(record?.distressDiscountPercent || record?.distressGapPercent || record?.distress_gap_percent || fallbackPercent || 0);
      if (!record?.isDistress || !percent) return '';
      return `${percent}% below market`;
    }

    function getConnectorTaxonomyOptions(field, sectionName = state.activeSection) {
      if (field === 'purpose') {
        const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : (sectionName || state.activeSection || 'requirements');
        return CONNECTOR_PURPOSE_OPTIONS[normalizedSection] || CONNECTOR_PURPOSE_OPTIONS.requirements;
      }
      if (field === 'propertyCategory') {
        return CONNECTOR_PROPERTY_CATEGORY_OPTIONS.map(value => ({ value, label: value }));
      }
      if (field === 'unitLayout') {
        return CONNECTOR_UNIT_LAYOUT_OPTIONS.map(value => ({ value, label: value }));
      }
      if (field === 'location') {
        return dedupeConnectorValues(CORE_TAXONOMY.locations || []).map(value => ({ value, label: value }));
      }
      return [];
    }

    function getConnectorOptionLabel(field, value, sectionName = state.activeSection) {
      const option = getConnectorTaxonomyOptions(field, sectionName).find(item => item.value === value);
      if (option?.label) return option.label;
      return String(value || '').trim();
    }

    function normalizeConnectorPurpose(value, sourceType = '', sectionName = state.activeSection) {
      const normalized = (CORE_TAXONOMY.aliases?.purposes || {})[normalizeTaxonomyToken(value)] || normalizeTaxonomyToken(value);
      if (!normalized) return '';
      const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : (sectionName || state.activeSection || 'requirements');
      if (sourceType === 'lead' && normalized === 'sale') return 'buy';
      if (normalized === 'buy' && sourceType !== 'lead') {
        return normalizedSection === 'requirements' ? 'buy' : 'sale';
      }
      return ['rent', 'buy', 'sale'].includes(normalized) ? normalized : '';
    }

    function getConnectorPublicPurposeValue(record = {}) {
      return normalizeConnectorPurpose(record?.purpose, record?.sourceType, record?.sourceType === 'lead' ? 'requirements' : 'marketplace') || '';
    }

    function getConnectorPublicPurposeLabel(record = {}) {
      const normalized = getConnectorPublicPurposeValue(record);
      if (normalized === 'rent') return 'Rent';
      if (normalized === 'buy') return 'Buy';
      if (normalized === 'sale') return 'Sale';
      return '--';
    }

    function normalizeConnectorPropertyType(value) {
      return canonicalizeConnectorValue(
        value,
        CORE_TAXONOMY.aliases?.propertyTypes || {},
        dedupeConnectorValues([
          ...(CORE_TAXONOMY.propertyTypes?.listing || []),
          ...(CORE_TAXONOMY.propertyTypes?.rent || []),
          ...(CORE_TAXONOMY.propertyTypes?.buy || [])
        ])
      );
    }

    function normalizeConnectorPropertyCategory(value) {
      return canonicalizeConnectorValue(value, CONNECTOR_PROPERTY_CATEGORY_ALIASES, CONNECTOR_PROPERTY_CATEGORY_OPTIONS);
    }

    function normalizeConnectorUnitLayout(value) {
      return canonicalizeConnectorValue(value, CONNECTOR_UNIT_LAYOUT_ALIASES, CONNECTOR_UNIT_LAYOUT_OPTIONS);
    }

    function normalizeConnectorLocation(value) {
      return canonicalizeConnectorValue(
        value,
        CORE_TAXONOMY.aliases?.locations || {},
        getConnectorTaxonomyOptions('location').map(option => option.value)
      );
    }

    function getConnectorCanonicalFieldValue(field, listing, sectionName = state.activeSection) {
      if (field === 'purpose') return normalizeConnectorPurpose(listing?.purpose, listing?.sourceType, sectionName);
      if (field === 'propertyCategory') return normalizeConnectorPropertyCategory(getConnectorDisplayPropertyCategory(listing));
      if (field === 'unitLayout') return normalizeConnectorUnitLayout(getConnectorDisplayUnitLayout(listing));
      if (field === 'location') return normalizeConnectorLocation(listing?.location);
      return String(listing?.[field] || '').trim();
    }

    function getListingsForActiveConnectorSection(sectionName = state.activeSection) {
      const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : (sectionName || state.activeSection || 'requirements');
      if (normalizedSection === 'requirements') {
        return state.listings.filter(listing => listing?.sourceType === 'lead');
      }
      if (normalizedSection === 'distress-deals') {
        return state.listings.filter(listing => listing?.sourceType === 'property' && listing?.isDistress);
      }
      return state.listings.filter(listing => listing?.sourceType === 'property');
    }

    function getConnectorFilterOptions(field) {
      const baseOptions = getConnectorTaxonomyOptions(field, state.activeSection);
      const baseValues = baseOptions.map(option => option.value);
      const dynamicValues = getListingsForActiveConnectorSection(state.activeSection)
        .map(listing => getConnectorCanonicalFieldValue(field, listing, state.activeSection))
        .filter(Boolean);
      return dedupeConnectorValues([...baseValues, ...dynamicValues]).map(value => ({
        value,
        label: getConnectorOptionLabel(field, value, state.activeSection)
      }));
    }

    const CONNECTOR_TABLE_COLUMNS = {
      requirements: '54px minmax(210px,1.45fr) minmax(120px,0.9fr) minmax(150px,1fr) 96px 132px 118px 86px',
      listings: '54px minmax(190px,1.3fr) minmax(120px,0.9fr) minmax(150px,1fr) 96px 132px 96px 118px 86px'
    };

    state.brokerProfile = safeJsonRead('broker_session_profile', null);

    function createMarketplaceProfileExtras() {
      return {
        avatarDataUrl: '',
        whatsappNumber: '',
        officeLocation: ''
      };
    }

    function sanitizeMarketplaceProfileExtras(raw) {
      return {
        avatarDataUrl: normalizeText(raw?.avatarDataUrl),
        whatsappNumber: normalizeText(raw?.whatsappNumber),
        officeLocation: normalizeText(raw?.officeLocation)
      };
    }

    function getMarketplaceProfileStorageKey() {
      const broker = state.brokerProfile || {};
      const keyPart = String(broker.id || broker.brokerIdNumber || broker.email || 'default').trim() || 'default';
      return `broker_profile_extras_${keyPart}`;
    }

    function getMarketplaceProfileExtras() {
      return sanitizeMarketplaceProfileExtras(
        safeJsonRead(getMarketplaceProfileStorageKey(), createMarketplaceProfileExtras())
      );
    }

    function getMarketplaceCurrentBrokerProfile() {
      const broker = state.brokerProfile || {};
      const extras = getMarketplaceProfileExtras();
      return {
        fullName: normalizeText(broker.fullName || broker.name),
        mobileNumber: normalizeText(extras.whatsappNumber || broker.mobileNumber || broker.phone || ''),
        email: normalizeText(broker.email),
        companyName: normalizeText(broker.companyName || broker.company),
        officeLocation: normalizeText(extras.officeLocation),
        avatarDataUrl: normalizeText(extras.avatarDataUrl)
      };
    }

    function normalizePhoneNumber(phone) {
      const digits = String(phone || '').replace(/[^\d]/g, '');
      if (!digits) return '';
      if (digits.startsWith('00971')) return `971${digits.slice(5)}`;
      if (digits.startsWith('971')) return digits;
      if (digits.startsWith('0')) return `971${digits.slice(1)}`;
      return digits;
    }

    function formatPhoneDisplay(phone) {
      const digits = normalizePhoneNumber(phone);
      return digits ? `+${digits}` : '--';
    }

    function setSystemBanner(message = '', tone = 'success') {
      const el = document.getElementById('systemBanner');
      if (!message) {
        el.className = 'system-banner';
        el.textContent = '';
        return;
      }
      el.className = `system-banner active ${tone}`;
      el.textContent = message;
    }

    function getUiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
      const message = normalizeText(error?.message);
      return message || fallback;
    }

    function showSystemError(error, fallback = 'Something went wrong. Please try again.') {
      setSystemBanner(getUiErrorMessage(error, fallback), 'error');
    }

    function showActionToast(type, message) {
      window.ActionFeedbackUi?.showToast(type, message);
    }

    function toggleMenuDrawer() {
      state.menuOpen = !state.menuOpen;
      document.getElementById('menuDrawer').classList.toggle('open', state.menuOpen);
      document.getElementById('menuBackdrop').classList.toggle('active', state.menuOpen);
    }

    function closeMenuDrawer() {
      state.menuOpen = false;
      document.getElementById('menuDrawer').classList.remove('open');
      document.getElementById('menuBackdrop').classList.remove('active');
    }

    function handleBrokerDeskClick() {
      if (state.sessionToken || state.brokerProfile) {
        window.location.href = 'dashboard.html';
        return;
      }
      openAuthModal('signin');
    }

    function clearBrokerSessionState() {
      localStorage.removeItem('broker_session_token');
      localStorage.removeItem('broker_session_profile');
      localStorage.removeItem('broker_supabase_session');
      state.sessionToken = '';
      state.brokerProfile = null;
    }

    function enforceBrokerSessionVersion() {
      const storedVersion = String(localStorage.getItem(BROKER_SESSION_VERSION_KEY) || '').trim();
      const hasStoredSession = Boolean(
        localStorage.getItem('broker_session_token')
        || localStorage.getItem('broker_session_profile')
        || localStorage.getItem('broker_supabase_session')
      );
      if (storedVersion === BROKER_SESSION_VERSION) {
        return false;
      }
      clearBrokerSessionState();
      localStorage.setItem(BROKER_SESSION_VERSION_KEY, BROKER_SESSION_VERSION);
      if (hasStoredSession) {
        localStorage.setItem(
          BROKER_FORCE_RELOGIN_REASON_KEY,
          'Broker Desk was refreshed after a safety update. Please sign in again.'
        );
        return true;
      }
      return false;
    }

    function showForcedReloginNotice() {
      const message = String(localStorage.getItem(BROKER_FORCE_RELOGIN_REASON_KEY) || '').trim();
      if (!message) return false;
      localStorage.removeItem(BROKER_FORCE_RELOGIN_REASON_KEY);
      setSystemBanner(message, 'success');
      if (!state.forcePublicView) {
        openAuthModal('signin');
      }
      return true;
    }

    function normalizeAuthPayload(payload) {
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      const token = String(
        payload.token
        || payload.access_token
        || payload.session?.access_token
        || ''
      ).trim();
      const broker = payload.broker || payload.user || payload.session?.user || null;
      if (!token || !broker || typeof broker !== 'object') {
        return null;
      }
      return { token, broker };
    }

    function isValidAuthPayload(payload) {
      return Boolean(normalizeAuthPayload(payload));
    }

    function persistBrokerSession(payload) {
      const authPayload = normalizeAuthPayload(payload);
      if (!authPayload) {
        return false;
      }
      if (payload?.session && typeof payload.session === 'object') {
        localStorage.setItem('broker_supabase_session', JSON.stringify(payload.session));
      }
      localStorage.setItem('broker_session_token', authPayload.token);
      localStorage.setItem('broker_session_profile', JSON.stringify(authPayload.broker));
      state.sessionToken = authPayload.token;
      state.brokerProfile = authPayload.broker;
      return true;
    }

    function isMarketplaceBrokerAuthenticated() {
      return Boolean(state.sessionToken && state.brokerProfile?.id);
    }

    function buildMarketplaceReturnUrl(sectionName = state.activeSection, listingId = '') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'public');
      if (sectionName) {
        url.searchParams.set('section', sectionName);
      }
      if (listingId) {
        url.searchParams.set('listing', listingId);
        url.searchParams.set('revealContact', '1');
      } else {
        url.searchParams.delete('listing');
        url.searchParams.delete('revealContact');
      }
      return `${url.pathname}${url.search}${url.hash || ''}`;
    }

    function clearMarketplaceRevealParams(sectionName = state.activeSection) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'public');
      if (sectionName) {
        url.searchParams.set('section', sectionName);
      }
      url.searchParams.delete('listing');
      url.searchParams.delete('revealContact');
      window.history.replaceState({}, document.title, url.toString());
    }

    function saveMarketplaceAuthIntent(intent = null) {
      state.authIntent = intent ? { ...intent } : null;
      try {
        if (!intent) {
          sessionStorage.removeItem(BCP_AUTH_RETURN_KEY);
          return;
        }
        sessionStorage.setItem(BCP_AUTH_RETURN_KEY, JSON.stringify(state.authIntent));
      } catch (error) {
        console.error('Could not persist marketplace auth intent.', error);
      }
    }

    function loadMarketplaceAuthIntent() {
      if (state.authIntent) return state.authIntent;
      try {
        const raw = sessionStorage.getItem(BCP_AUTH_RETURN_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        state.authIntent = parsed;
        return state.authIntent;
      } catch (error) {
        console.error('Could not read marketplace auth intent.', error);
        return null;
      }
    }

    function clearMarketplaceAuthIntent() {
      state.authIntent = null;
      try {
        sessionStorage.removeItem(BCP_AUTH_RETURN_KEY);
      } catch (error) {
        console.error('Could not clear marketplace auth intent.', error);
      }
    }

    function getActiveAuthIntent() {
      return state.authIntent || loadMarketplaceAuthIntent();
    }

    function isContactRevealAuthIntent() {
      return getActiveAuthIntent()?.type === 'contact-reveal';
    }

    function getMarketplaceContactRecordType(listing) {
      if (listing?.sourceType === 'lead') return 'requirement';
      if (listing?.isDistress) return 'distress';
      return 'listing';
    }

    function findMarketplaceListing(sectionName, listingId) {
      const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : sectionName;
      return (Array.isArray(state.listings) ? state.listings : []).find(item =>
        String(item?.id || '') === String(listingId || '')
        && (!normalizedSection || normalizedSection === 'all'
          || (normalizedSection === 'requirements' && item?.sourceType === 'lead')
          || (normalizedSection === 'marketplace' && item?.sourceType === 'property' && !item?.isDistress)
          || (normalizedSection === 'distress-deals' && item?.sourceType === 'property' && item?.isDistress))
      ) || null;
    }

    function openAuthRequiredModal(sectionName, listingId, listing = null, preferredMode = 'signin') {
      const selectedListing = listing || findMarketplaceListing(sectionName, listingId);
      const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : sectionName;
      saveMarketplaceAuthIntent({
        type: 'contact-reveal',
        sectionName: normalizedSection || state.activeSection || 'marketplace',
        listingId: String(listingId || selectedListing?.id || '').trim(),
        recordType: getMarketplaceContactRecordType(selectedListing),
        returnTo: buildMarketplaceReturnUrl(normalizedSection || state.activeSection || 'marketplace', String(listingId || selectedListing?.id || '').trim())
      });
      openAuthModal(preferredMode);
    }

    function syncPublicComplaintBodyLock() {
      document.body.classList.toggle('complaint-modal-open', Boolean(state.complaintModalOpen || state.supportModalOpen));
    }

    function closePublicComplaintModal() {
      state.complaintModalOpen = false;
      state.complaintModalSubmitting = false;
      state.complaintDraft = null;
      renderPublicComplaintModal();
      syncPublicComplaintBodyLock();
    }

    function getSupportRulesEntries() {
      return Array.isArray(PLATFORM_RULES?.categories) ? PLATFORM_RULES.categories : [];
    }

    function createSupportDraft() {
      return {
        name: normalizeText(state.brokerProfile?.fullName || state.brokerProfile?.name || ''),
        email: normalizeText(state.brokerProfile?.email || ''),
        subject: '',
        message: ''
      };
    }

    function closeSupportModal() {
      state.supportModalOpen = false;
      state.supportModalSubmitting = false;
      state.supportModalView = '';
      state.supportDraft = null;
      renderSupportModal();
      syncPublicComplaintBodyLock();
    }

    function openSupportRules() {
      state.supportModalOpen = true;
      state.supportModalSubmitting = false;
      state.supportModalView = 'rules';
      state.supportDraft = null;
      renderSupportModal();
      syncPublicComplaintBodyLock();
      closeMenuDrawer();
    }

    function openSupportHelp() {
      state.supportModalOpen = true;
      state.supportModalSubmitting = false;
      state.supportModalView = 'help';
      state.supportDraft = createSupportDraft();
      renderSupportModal();
      syncPublicComplaintBodyLock();
      closeMenuDrawer();
    }

    function updateSupportDraft(field, value) {
      if (!state.supportDraft) return;
      state.supportDraft[field] = value;
    }

    function renderSupportRulesMarkup() {
      const rules = getSupportRulesEntries();
      return `
        <div class="complaint-shell">
          <div class="complaint-head">
            <div>
              <h3 id="supportModalTitle">${escapeHtml(PLATFORM_RULES?.title || 'Platform Rules')}</h3>
              <p class="complaint-copy">${escapeHtml(PLATFORM_RULES?.intro || 'Review the current platform rules before you continue.')}</p>
            </div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="closeSupportModal()">Close</button>
          </div>
          ${
            rules.length
              ? `<div class="support-rules-list">${rules.map(rule => `
                  <div class="support-rule-card">
                    <h4>${escapeHtml(rule?.title || 'Rule')}</h4>
                    <p>${escapeHtml(rule?.description || '')}</p>
                  </div>
                `).join('')}</div>`
              : '<div class="support-rule-card"><h4>Rules unavailable</h4><p>Rules unavailable right now.</p></div>'
          }
        </div>
      `;
    }

    function renderSupportHelpMarkup() {
      const draft = state.supportDraft || createSupportDraft();
      return `
        <div class="complaint-shell">
          <div class="complaint-head">
            <div>
              <h3 id="supportModalTitle">Contact Center</h3>
              <p class="complaint-copy">Send a support request for admin review without leaving NexBridge Marketplace.</p>
            </div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="closeSupportModal()">Close</button>
          </div>
          <form class="support-form-shell" onsubmit="submitSupportRequest(event)">
            <div class="support-form-grid">
              <div class="complaint-form-card">
                <label class="small" for="supportName">Name</label>
                <input id="supportName" type="text" value="${escapeHtml(draft.name || '')}" oninput="updateSupportDraft('name', this.value)" autocomplete="name" required>
              </div>
              <div class="complaint-form-card">
                <label class="small" for="supportEmail">Email</label>
                <input id="supportEmail" type="email" value="${escapeHtml(draft.email || '')}" oninput="updateSupportDraft('email', this.value)" autocomplete="email" required>
              </div>
              <div class="complaint-form-card is-full">
                <label class="small" for="supportSubject">Subject</label>
                <select id="supportSubject" onchange="updateSupportDraft('subject', this.value)" required>
                  <option value="">Select subject</option>
                  ${SUPPORT_SUBJECT_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${draft.subject === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                </select>
              </div>
              <div class="complaint-form-card is-full">
                <label class="small" for="supportMessage">Message</label>
                <textarea id="supportMessage" placeholder="Tell us how we can help." oninput="updateSupportDraft('message', this.value)" required>${escapeHtml(draft.message || '')}</textarea>
              </div>
            </div>
            <div class="complaint-actions-row">
              <button class="btn btn-secondary" type="button" onclick="closeSupportModal()">Cancel</button>
              <button class="btn btn-primary" type="submit" ${state.supportModalSubmitting ? 'disabled' : ''}>${state.supportModalSubmitting ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderSupportModal() {
      const overlay = document.getElementById('supportModal');
      const content = document.getElementById('supportModalContent');
      if (!overlay || !content) return;
      if (!state.supportModalOpen || !state.supportModalView) {
        overlay.classList.add('hidden');
        content.innerHTML = '';
        return;
      }
      overlay.classList.remove('hidden');
      content.innerHTML = state.supportModalView === 'rules'
        ? renderSupportRulesMarkup()
        : renderSupportHelpMarkup();
    }

    async function submitSupportRequest(event) {
      event?.preventDefault?.();
      if (state.supportModalSubmitting) return;
      const submitButton = event?.submitter || document.querySelector('#supportModalContent button[type="submit"]');
      const draft = state.supportDraft || createSupportDraft();
      if (!normalizeText(draft.name)) {
        setSystemBanner('Name is required.', 'error');
        return;
      }
      if (!normalizeText(draft.email)) {
        setSystemBanner('Email is required.', 'error');
        return;
      }
      if (!normalizeText(draft.subject)) {
        setSystemBanner('Select a support subject.', 'error');
        return;
      }
      if (normalizeText(draft.message).length < 10) {
        setSystemBanner('Message is required.', 'error');
        return;
      }

      state.supportModalSubmitting = true;
      renderSupportModal();
      try {
        const result = window.ActionFeedbackUi
          ? await window.ActionFeedbackUi.withActionFeedback(
              submitButton,
              'Submitting...',
              'Request submitted successfully.',
              async () => {
                const response = await fetch('/api/support', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {})
                  },
                  body: JSON.stringify({
                    name: draft.name,
                    email: draft.email,
                    subject: draft.subject,
                    message: draft.message
                  })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload?.message || 'Failed to submit request.');
                }
                return payload;
              },
              { showErrorToast: true }
            )
          : await (async () => {
              const response = await fetch('/api/support', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {})
                },
                body: JSON.stringify({
                  name: draft.name,
                  email: draft.email,
                  subject: draft.subject,
                  message: draft.message
                })
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(payload?.message || 'Failed to submit request.');
              }
              return payload;
            })();
        closeSupportModal();
        setSystemBanner('We have received your request. Our help desk will contact you soon.', 'success');
      } catch (error) {
        state.supportModalSubmitting = false;
        renderSupportModal();
        showSystemError(error, 'Support request failed.');
      }
    }

    function getComplaintTargetTypeLabel(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'listing') return 'Listing';
      if (normalized === 'requirement') return 'Requirement';
      if (normalized === 'broker') return 'Broker';
      return 'Record';
    }

    function ensureComplaintAuth() {
      if (state.sessionToken) return true;
      openAuthModal('signin');
      setAuthStatus('Sign in to submit a complaint.', 'error');
      return false;
    }

    function createPublicComplaintDraft(context = {}) {
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
        sourceSection: String(context?.sourceSection || state.activeSection || 'connector').trim().toLowerCase(),
        title: String(context?.title || 'Submit Complaint').trim(),
        copy: String(context?.copy || 'Share the issue clearly so the admin team can review this record.').trim()
      };
    }

    function openPublicComplaintModal(context = {}) {
      if (!ensureComplaintAuth()) return;
      state.complaintDraft = createPublicComplaintDraft({
        ...context,
        rulesAccepted: hasAcceptedPlatformRules()
      });
      state.complaintModalOpen = true;
      state.complaintModalSubmitting = false;
      renderPublicComplaintModal();
      syncPublicComplaintBodyLock();
    }

    function updatePublicComplaintDraft(field, value) {
      if (!state.complaintDraft) return;
      state.complaintDraft[field] = value;
    }

    function openRecordComplaint(sectionName, listingId) {
      const listing = state.listings.find(item => String(item.id) === String(listingId));
      if (!listing) {
        setSystemBanner('Record could not be loaded for complaint.', 'error');
        return;
      }
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId: state.brokerProfile?.id || '',
        reportedUserId: listing.brokerUuid || '',
        targetType: listing.sourceType === 'lead' ? 'requirement' : 'listing',
        targetId: listing.sourceId || listing.id,
        selfDisabledText: 'You cannot report your own shared record.'
      }) || { hidden: false, disabled: false };
      if (buttonState.hidden || buttonState.disabled) {
        setSystemBanner(buttonState.disabledReason || 'You cannot report this record.', 'error');
        return;
      }
      openPublicComplaintModal({
        targetType: listing.sourceType === 'lead' ? 'requirement' : 'listing',
        targetId: listing.sourceId || listing.id,
        targetLabel: listing.sourceType === 'lead'
          ? `${getConnectorPublicPurposeLabel(listing)} - ${listing.propertyType || 'Requirement'}`
          : `${getConnectorPublicPurposeLabel(listing).toUpperCase()} - ${listing.propertyType || 'Listing'}`,
        reportedUserId: listing.brokerUuid || '',
        reportedBrokerIdNumber: listing.brokerIdNumber || '',
        reportedBrokerName: listing.brokerName || '',
        sourceSection: sectionName || state.activeSection,
        title: listing.sourceType === 'lead' ? 'Report Requirement' : 'Report Listing',
        copy: 'This report goes to admin review. Contact actions remain unchanged.'
      });
    }

    function openBrokerComplaint(sectionName, listingId) {
      const listing = state.listings.find(item => String(item.id) === String(listingId));
      if (!listing) {
        setSystemBanner('Broker could not be loaded for complaint.', 'error');
        return;
      }
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId: state.brokerProfile?.id || '',
        reportedUserId: listing.brokerUuid || '',
        targetType: 'broker',
        targetId: listing.brokerUuid || listing.brokerIdNumber || listing.id,
        selfDisabledText: 'You cannot report your own broker account.'
      }) || { hidden: false, disabled: false };
      if (buttonState.hidden || buttonState.disabled) {
        setSystemBanner(buttonState.disabledReason || 'You cannot report this broker.', 'error');
        return;
      }
      openPublicComplaintModal({
        targetType: 'broker',
        targetId: listing.brokerUuid || listing.brokerIdNumber || listing.id,
        targetLabel: listing.brokerName || 'Broker account',
        reportedUserId: listing.brokerUuid || '',
        reportedBrokerIdNumber: listing.brokerIdNumber || '',
        reportedBrokerName: listing.brokerName || '',
        sourceSection: sectionName || state.activeSection,
        title: 'Report Broker',
        copy: 'Report broker behavior or identity issues without changing current contact actions.'
      });
    }

    function renderPublicComplaintModal() {
      const overlay = document.getElementById('publicComplaintModal');
      const content = document.getElementById('publicComplaintModalContent');
      if (!overlay || !content) return;
      if (!state.complaintModalOpen || !state.complaintDraft) {
        overlay.classList.add('hidden');
        content.innerHTML = '';
        return;
      }

      const draft = state.complaintDraft;
      const accepted = hasAcceptedPlatformRules();
      overlay.classList.remove('hidden');
      content.innerHTML = window.ComplaintCenterUi?.renderComplaintFormModal({
        variant: 'public',
        titleId: 'publicComplaintModalTitle',
        title: draft.title || 'Submit Complaint',
        copy: draft.copy || 'Share the issue clearly so admin can review it.',
        targetTypeLabel: getComplaintTargetTypeLabel(draft.targetType),
        targetSummary: draft.targetLabel || 'Selected record',
        reportedUserLabel: draft.reportedBrokerName || 'Broker account',
        reportedMeta: 'Submitted to admin review without exposing internal broker identifiers.',
        reasonOptions: COMPLAINT_REASON_OPTIONS,
        selectedReason: draft.reason,
        proofName: draft.proofAttachment?.name || 'Images or PDF up to 2 MB',
        description: draft.description || '',
        closeHandler: 'closePublicComplaintModal()',
        cancelHandler: 'closePublicComplaintModal()',
        submitHandler: 'submitPublicComplaint(event)',
        reasonInputId: 'publicComplaintReason',
        descriptionInputId: 'publicComplaintDescription',
        uploadInputId: 'publicComplaintProof',
        uploadInputClass: 'hidden',
        uploadHandler: "document.getElementById('publicComplaintProof').click()",
        reasonChangeHandler: "updatePublicComplaintDraft('reason', this.value)",
        descriptionChangeHandler: "updatePublicComplaintDraft('description', this.value)",
        descriptionPlaceholder: 'Describe what is wrong with this listing, requirement, or broker.',
        extraContentHtml: renderPlatformRulesAgreementControl('publicComplaint', accepted, accepted || Boolean(draft.rulesAccepted), "updatePublicComplaintDraft('rulesAccepted', this.checked)"),
        submitting: state.complaintModalSubmitting,
        submitLabel: 'Submit Complaint',
        submittingLabel: 'Submitting...'
      }) || '';

      document.getElementById('publicComplaintProof')?.addEventListener('change', handlePublicComplaintProofSelection);
    }

    async function handlePublicComplaintProofSelection(event) {
      const file = event?.target?.files?.[0];
      if (!state.complaintDraft) return;
      if (!file) {
        state.complaintDraft.proofAttachment = null;
        renderPublicComplaintModal();
        return;
      }
      if (file.size > (2 * 1024 * 1024)) {
        setSystemBanner('Proof upload must be 2 MB or smaller.', 'error');
        event.target.value = '';
        return;
      }
      if (!COMPLAINT_ALLOWED_PROOF_TYPES.includes(String(file.type || '').toLowerCase())) {
        setSystemBanner('Proof upload must be JPG, PNG, WEBP, GIF, or PDF.', 'error');
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = loadEvent => {
        state.complaintDraft.proofAttachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: String(loadEvent?.target?.result || '')
        };
        renderPublicComplaintModal();
      };
      reader.readAsDataURL(file);
    }

    async function submitPublicComplaint(event) {
      event?.preventDefault?.();
      if (!state.complaintDraft || state.complaintModalSubmitting) return;
      const submitButton = event?.submitter || document.querySelector('#publicComplaintModalContent button[type="submit"]');
      const draft = state.complaintDraft;
      if (!hasAcceptedPlatformRules() && !draft.rulesAccepted) {
        setSystemBanner('Accept platform rules before submitting a complaint.', 'error');
        return;
      }
      if (!draft.reason) {
        setSystemBanner('Select a complaint reason.', 'error');
        return;
      }
      if (String(draft.description || '').trim().length < 10) {
        setSystemBanner('Add a brief complaint description.', 'error');
        return;
      }
      state.complaintModalSubmitting = true;
      renderPublicComplaintModal();
      try {
        if (!hasAcceptedPlatformRules() && draft.rulesAccepted) {
          storePlatformRulesAcceptance('connector-complaint');
        }
        const result = window.ActionFeedbackUi
          ? await window.ActionFeedbackUi.withActionFeedback(
              submitButton,
              'Submitting Complaint...',
              'Complaint submitted successfully.',
              async () => {
                const response = await fetch('/api/broker-complaints', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${state.sessionToken}`
                  },
                  body: JSON.stringify({
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
                  })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload?.message || 'Failed to submit complaint.');
                }
                return payload;
              },
              { showErrorToast: true }
            )
          : await (async () => {
              const response = await fetch('/api/broker-complaints', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${state.sessionToken}`
                },
                body: JSON.stringify({
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
                })
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(payload?.message || 'Failed to submit complaint.');
              }
              return payload;
            })();
        closePublicComplaintModal();
        setSystemBanner(result?.message || 'Complaint submitted successfully.', 'success');
      } catch (error) {
        state.complaintModalSubmitting = false;
        renderPublicComplaintModal();
        if (/missing or invalid/i.test(error?.message || '')) {
          clearBrokerSessionState();
          closePublicComplaintModal();
          openAuthModal('signin');
        }
        showSystemError(error, 'Complaint submission failed.');
      }
    }

    function initPublicComplaintModal() {
      const overlay = document.getElementById('publicComplaintModal');
      if (!overlay || overlay.dataset.ready === 'true') return;
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          closePublicComplaintModal();
        }
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.complaintModalOpen) {
          closePublicComplaintModal();
        }
      });
      overlay.dataset.ready = 'true';
    }

    function initSupportModal() {
      const overlay = document.getElementById('supportModal');
      if (!overlay || overlay.dataset.ready === 'true') return;
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          closeSupportModal();
        }
      });
      overlay.dataset.ready = 'true';
    }

    function normalizeCompanyName(value) {
      return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

      function getApprovedCompanySuggestions(query = '') {
        const normalizedQuery = normalizeCompanyName(query);
        const companies = Array.isArray(state.approvedCompanies) ? state.approvedCompanies : [];
        if (!normalizedQuery) return companies.slice(0, 8);
        return companies
          .filter(company => normalizeCompanyName(company?.name).includes(normalizedQuery))
          .slice(0, 8);
      }

      function getApprovedCompanyFallbackRows() {
        return APPROVED_COMPANY_FALLBACKS.map((name, index) => ({
          id: `fallback-company-${index + 1}`,
          name,
          status: 'approved'
        }));
      }

    function closeAuthCompanyMenu() {
      state.authCompanyMenuOpen = false;
      state.authCompanyActiveIndex = -1;
      renderAuthCompanySuggestions();
    }

    function renderAuthCompanySuggestions() {
      const menu = document.getElementById('authCompanyMenu');
      if (!menu) return;
      const suggestions = getApprovedCompanySuggestions(state.authCompanyQuery);
      if (state.authMode !== 'register' || !state.authCompanyMenuOpen || !suggestions.length) {
        menu.classList.add('hidden');
        menu.innerHTML = '';
        return;
      }

      menu.classList.remove('hidden');
      menu.innerHTML = suggestions.map((company, index) => `
        <button class="auth-company-option${index === state.authCompanyActiveIndex ? ' is-active' : ''}" type="button" data-company-name="${escapeHtml(company.name)}" onclick="selectApprovedCompanySuggestion(this.dataset.companyName)">${escapeHtml(company.name)}</button>
      `).join('');
    }

    function selectApprovedCompanySuggestion(name) {
      const input = document.getElementById('authCompany');
      if (input) input.value = name;
      state.authCompanyQuery = name;
      closeAuthCompanyMenu();
    }

      async function loadApprovedCompanySuggestions() {
        if (state.approvedCompaniesLoaded) {
          return state.approvedCompanies;
        }
        if (state.approvedCompaniesRequest) {
          return state.approvedCompaniesRequest;
        }
        state.approvedCompaniesRequest = (async () => {
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          const timeoutId = controller ? window.setTimeout(() => controller.abort(), 4000) : null;
          try {
            const response = await fetch('/api/companies', {
              signal: controller?.signal
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(result?.message || 'Company suggestions could not load.');
            }
            state.approvedCompanies = Array.isArray(result?.companies)
              ? result.companies.map(company => ({ ...company, name: String(company?.name || '').trim() })).filter(company => company.name)
              : [];
            if (!state.approvedCompanies.length) {
              state.approvedCompanies = getApprovedCompanyFallbackRows();
            }
            state.approvedCompaniesLoaded = true;
            renderAuthCompanySuggestions();
          } catch (error) {
            state.approvedCompanies = getApprovedCompanyFallbackRows();
            state.approvedCompaniesLoaded = true;
            renderAuthCompanySuggestions();
          } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
            state.approvedCompaniesRequest = null;
          }
          return state.approvedCompanies;
        })();
        return state.approvedCompaniesRequest;
    }

    function ensureApprovedCompanySuggestionsLoaded() {
      return loadApprovedCompanySuggestions();
    }

    function initAuthCompanyAutocomplete() {
      const input = document.getElementById('authCompany');
      const menu = document.getElementById('authCompanyMenu');
      if (!input || input.dataset.ready === 'true') return;

        input.addEventListener('input', event => {
          if (!state.approvedCompaniesLoaded && !state.approvedCompaniesRequest) {
            ensureApprovedCompanySuggestionsLoaded();
          }
          state.authCompanyQuery = String(event.target.value || '');
          state.authCompanyMenuOpen = true;
          state.authCompanyActiveIndex = -1;
          renderAuthCompanySuggestions();
        });

        input.addEventListener('focus', event => {
          if (!state.approvedCompaniesLoaded && !state.approvedCompaniesRequest) {
            ensureApprovedCompanySuggestionsLoaded();
          }
          state.authCompanyQuery = String(event.target.value || '');
          state.authCompanyMenuOpen = true;
          renderAuthCompanySuggestions();
        });

      input.addEventListener('keydown', event => {
        const suggestions = getApprovedCompanySuggestions(state.authCompanyQuery);
        if (!suggestions.length) return;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          state.authCompanyMenuOpen = true;
          state.authCompanyActiveIndex = Math.min(state.authCompanyActiveIndex + 1, suggestions.length - 1);
          renderAuthCompanySuggestions();
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          state.authCompanyActiveIndex = Math.max(state.authCompanyActiveIndex - 1, 0);
          renderAuthCompanySuggestions();
          return;
        }

        if (event.key === 'Enter' && state.authCompanyMenuOpen && state.authCompanyActiveIndex >= 0) {
          event.preventDefault();
          selectApprovedCompanySuggestion(suggestions[state.authCompanyActiveIndex]?.name || '');
          return;
        }

        if (event.key === 'Escape') {
          closeAuthCompanyMenu();
        }
      });

      document.addEventListener('click', event => {
        if (!event.target.closest('#companyWrap')) {
          closeAuthCompanyMenu();
        }
      });

      menu?.addEventListener('mousedown', event => event.preventDefault());
      input.dataset.ready = 'true';
    }

    function normalizeBrokerIdInput(value) {
      return String(value || '').trim();
    }

    function isValidEmailAddress(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function getAuthModeFallbackMessage(mode) {
      return mode === 'forgot'
        ? 'Unable to send reset email. Please try again.'
        : mode === 'register'
          ? 'Broker registration failed.'
          : 'Login failed, please try again.';
    }

    function setAuthSubmitLoading(isLoading, mode = state.authMode) {
      const button = document.getElementById('authSubmitBtn');
      if (!button) return;
      const loadingText = mode === 'register'
        ? 'Registering...'
        : mode === 'forgot'
          ? 'Submitting...'
          : 'Logging in...';
      const defaultText = mode === 'register'
        ? 'Register and Continue'
        : mode === 'forgot'
          ? 'Send Reset Link'
          : 'Sign In and Continue';
      button.dataset.loading = isLoading ? 'true' : 'false';
      if (window.ActionFeedbackUi) {
        if (isLoading) {
          window.ActionFeedbackUi.setButtonLoading(button, loadingText);
        } else {
          window.ActionFeedbackUi.resetButtonLoading(button);
          button.textContent = defaultText;
        }
        return;
      }
      button.disabled = Boolean(isLoading);
      button.textContent = isLoading ? loadingText : defaultText;
    }

    function getAuthFailureMessage(result, mode = 'signin', fallback = getAuthModeFallbackMessage(mode)) {
      const message = String(result?.message || '').trim();
      if (!message) return fallback;
      if (/cannot read properties/i.test(message)) return fallback;
      if (/invalid email or password/i.test(message)) return 'Invalid email or password';
      if (/invalid password/i.test(message)) return 'Invalid email or password';
      if (/account not found/i.test(message)) return 'Account not found';
      if (/broker not found/i.test(message)) return 'Account not found';
      if (/enter email address/i.test(message)) return mode === 'forgot' ? 'Enter your email address' : 'Enter email';
      if (/enter password/i.test(message)) return 'Enter password';
      if (/valid email address/i.test(message)) return mode === 'forgot' ? 'Invalid email address' : 'Enter a valid email address';
      if (/passwords do not match/i.test(message)) return 'Passwords do not match';
      if (/verify your email/i.test(message)) return 'Please verify your email first';
      if (/email confirmed successfully/i.test(message)) return 'Email confirmed successfully. You can now sign in.';
      if (/confirmation link is invalid or expired/i.test(message)) return 'Confirmation link is invalid or expired.';
      if (/reset link has been sent/i.test(message)) return 'If an account exists for this email, a reset link has been sent.';
      if (/unable to send reset email/i.test(message)) return 'Unable to send reset email. Please try again.';
      if (/password reset could not be sent/i.test(message)) return 'Unable to send reset email. Please try again.';
      if (/please wait a minute/i.test(message) || /security purposes/i.test(message) || /rate limit/i.test(message)) return 'Please wait a minute before requesting another reset email.';
      if (/already registered/i.test(message) || /already exists/i.test(message)) return 'This email address is already registered. Please sign in instead.';
      if (/session creation failed/i.test(message)) return 'Login failed, please try again.';
      return message;
    }

    async function requestPasswordResetEmail(emailValue) {
      const redirectTo = new URL('reset-password.html', window.location.origin).toString();
      const response = await fetch(`${authSupabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: authSupabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: emailValue,
          redirect_to: redirectTo
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.msg
          || result?.message
          || result?.error_description
          || 'Unable to send reset email. Please try again.'
        );
      }
      return {
        message: 'If an account exists for this email, a reset link has been sent.'
      };
    }
