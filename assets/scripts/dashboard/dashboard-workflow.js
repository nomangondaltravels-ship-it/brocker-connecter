    function getPropertyDisplayPrice(property) {
      const purpose = getPropertyPurpose(property.purpose);
      const primaryPrice = normalizeBudgetDigits(property.rentPrice || property.ownerAskingPrice || property.price || '');
      if (!primaryPrice) return '--';
      const formattedPrice = Number(primaryPrice).toLocaleString('en-AE');
      return `AED ${formattedPrice}${purpose === 'rent' ? ' / year' : ''}`;
    }

    function getPropertySaleStatusLabel(property) {
      if (getPropertyPurpose(property?.purpose) !== 'sale') return '';
      return normalizeDashboardSalePropertyStatusValue(property?.salePropertyStatus) || 'Ready Property';
    }

    function getPropertyHandoverLabel(property) {
      return formatPropertyHandoverDisplay(property?.handoverQuarter, property?.handoverYear);
    }

    function getPropertyTermsSummary(property) {
      const purpose = getPropertyPurpose(property.purpose);
      if (purpose === 'rent') {
        return joinDisplayParts([
          property.furnishing,
          property.cheques,
          property.chiller
        ]) || 'Standard rent terms';
      }

      return joinDisplayParts([
        getPropertySaleStatusLabel(property),
        getPropertyHandoverLabel(property) ? `Handover: ${getPropertyHandoverLabel(property)}` : '',
        property.leasehold ? 'Leasehold' : 'Freehold / Standard',
        property.mortgageStatus
      ]) || 'Standard sale terms';
    }

    function getPrivateRevealEntry(kind, id) {
      const bucket = state.privateContactReveal?.[kind];
      if (!bucket) return null;
      const key = String(id ?? '');
      if (!bucket[key]) {
        bucket[key] = {
          nameVisible: false,
          phoneVisible: false,
          nameTimer: null,
          phoneTimer: null
        };
      }
      return bucket[key];
    }

    function rerenderPrivateRevealKind(kind) {
      if (kind === 'lead') {
        renderLeads();
        return;
      }
      renderProperties();
      renderDistressDeals();
    }

    function clearPrivateRevealTimer(entry, field) {
      const timerKey = field === 'name' ? 'nameTimer' : 'phoneTimer';
      if (entry?.[timerKey]) {
        clearTimeout(entry[timerKey]);
        entry[timerKey] = null;
      }
    }

    function isPrivateFieldRevealed(kind, id, field) {
      const entry = getPrivateRevealEntry(kind, id);
      if (!entry) return false;
      return Boolean(field === 'name' ? entry.nameVisible : entry.phoneVisible);
    }

    function hidePrivateField(kind, id, field) {
      const entry = getPrivateRevealEntry(kind, id);
      if (!entry) return;
      if (field === 'name') {
        entry.nameVisible = false;
      } else {
        entry.phoneVisible = false;
      }
      clearPrivateRevealTimer(entry, field);
      rerenderPrivateRevealKind(kind);
    }

    function revealPrivateField(kind, id, field) {
      const entry = getPrivateRevealEntry(kind, id);
      if (!entry) return;
      if (field === 'name') {
        entry.nameVisible = true;
      } else {
        entry.phoneVisible = true;
      }
      clearPrivateRevealTimer(entry, field);
      const timerKey = field === 'name' ? 'nameTimer' : 'phoneTimer';
      entry[timerKey] = window.setTimeout(() => {
        hidePrivateField(kind, id, field);
      }, 30000);
      rerenderPrivateRevealKind(kind);
    }

    function clearAllPrivateRevealTimers() {
      ['lead', 'property'].forEach(kind => {
        const bucket = state.privateContactReveal?.[kind];
        if (!bucket) return;
        Object.values(bucket).forEach(entry => {
          clearPrivateRevealTimer(entry, 'name');
          clearPrivateRevealTimer(entry, 'phone');
        });
      });
    }

    function getPropertyPrivateContactSummary(property) {
      const nameVisible = isPrivateFieldRevealed('property', property?.id, 'name');
      const phoneVisible = isPrivateFieldRevealed('property', property?.id, 'phone');
      const details = [];
      if (nameVisible && property?.ownerName) details.push(property.ownerName);
      if (phoneVisible && property?.ownerPhone) details.push(formatPhoneDisplay(property.ownerPhone));
      if (details.length) return `Private contact - ${joinDisplayParts(details)}`;
      if (property?.ownerName || property?.ownerPhone) return 'Private contact hidden';
      return 'No owner details added';
    }

    function getLeadPrivateContactSummary(lead) {
      const nameVisible = isPrivateFieldRevealed('lead', lead?.id, 'name');
      const phoneVisible = isPrivateFieldRevealed('lead', lead?.id, 'phone');
      const details = [];
      if (nameVisible && lead?.clientName) details.push(lead.clientName);
      if (phoneVisible && lead?.clientPhone) details.push(formatPhoneDisplay(lead.clientPhone));
      if (details.length) return `Private contact - ${joinDisplayParts(details)}`;
      if (lead?.clientName || lead?.clientPhone) return 'Private contact hidden';
      return 'No client details added';
    }

    function renderPrivateNameValue(kind, id, value, hiddenLabel = 'Hidden for privacy') {
      const displayValue = normalizeText(value);
      if (!displayValue) {
        return `<span class="private-contact-placeholder">No contact added</span>`;
      }
      if (isPrivateFieldRevealed(kind, id, 'name')) {
        return `<span class="private-contact-value">${escapeHtml(displayValue)}</span>`;
      }
      return `<button class="btn btn-secondary btn-tiny private-reveal-btn" type="button" onclick='revealPrivateField(${JSON.stringify(kind)}, ${JSON.stringify(String(id ?? ""))}, "name")'>Show name</button>`;
    }

    function renderPrivatePhoneValue(kind, id, rawPhone) {
      const phoneDisplay = formatPhoneDisplay(rawPhone);
      if (!phoneDisplay) {
        return '<span class="private-contact-placeholder">No number added</span>';
      }
      if (isPrivateFieldRevealed(kind, id, 'phone')) {
        return `<span class="private-contact-value">${escapeHtml(phoneDisplay)}</span>`;
      }
      return `<button class="btn btn-secondary btn-tiny private-reveal-btn" type="button" onclick='revealPrivateField(${JSON.stringify(kind)}, ${JSON.stringify(String(id ?? ""))}, "phone")'>Show number</button>`;
    }

    function formatCompactAge(value) {
      if (!value) return '--';
      try {
        const diffMs = Date.now() - new Date(value).getTime();
        const hours = Math.max(0, Math.floor(diffMs / 3600000));
        if (hours < 24) return `${Math.max(1, hours)}h`;
        return `${Math.max(1, Math.floor(hours / 24))}d`;
      } catch (error) {
        return '--';
      }
    }

    function formatCompactRelativeTime(value) {
      if (!value) return '--';
      const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
      const minutes = Math.max(1, Math.floor(diffMs / 60000));
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.max(1, Math.floor(minutes / 60));
      if (hours < 24) return `${hours} hr ago`;
      return `${Math.max(1, Math.floor(hours / 24))} d ago`;
    }

    function getLeadIntentText(lead) {
      return getLeadClientPurpose(lead.clientPurpose) === 'buy'
        ? 'My client is looking to buy'
        : 'My client is looking to rent';
    }

    function calculateDashboardDistressPercent(property) {
      const marketValue = Number(normalizeBudgetDigits(property?.marketPrice || ''));
      const askingSource = getPropertyPurpose(property?.purpose) === 'sale'
        ? (property?.ownerAskingPrice || property?.price || '')
        : (property?.rentPrice || property?.price || '');
      const askingValue = Number(normalizeBudgetDigits(askingSource));
      if (!marketValue || !askingValue || askingValue >= marketValue) return 0;
      return Math.round(((marketValue - askingValue) / marketValue) * 100);
    }

    function getPropertyDistressLabel(property, fallback = '') {
      const percent = Number(property?.distressDiscountPercent || property?.distressGapPercent || calculateDashboardDistressPercent(property) || 0);
      if (!property?.isDistress || !percent) return fallback;
      return `${percent}% below market`;
    }

    function getDashboardSearchText(item, type) {
      if (type === 'lead') {
        return [
          'broker requirement',
          item.clientPurpose,
          item.propertyType,
          item.location,
          item.preferredBuildingProject,
          item.budget,
          item.paymentMethod,
          item.privateNotes,
          item.publicGeneralNotes,
          item.status,
          item.clientName
        ].join(' ').toLowerCase();
      }
      if (type === 'property') {
        return [
          'broker connector listing',
          item.purpose,
          item.propertyType,
          item.location,
          item.buildingName,
          item.floorLevel,
          item.furnishing,
          item.cheques,
          item.chiller,
          item.mortgageStatus,
          item.salePropertyStatus,
          item.handoverLabel,
          item.rentPrice,
          item.ownerAskingPrice,
          item.price,
          item.sizeSqft,
          item.size,
          item.marketPrice,
          item.distressDiscountPercent,
          item.publicNotes,
          item.internalNotes,
          item.status,
          item.isDistress ? 'distress deal hot listing' : ''
        ].join(' ').toLowerCase();
      }
      if (type === 'shared') {
        return [
          item.listingKind,
          item.purpose,
          item.propertyType,
          item.category,
          item.location,
          item.priceLabel,
          item.publicNotes,
          item.status,
          item.isDistress ? 'distress deal hot listing' : ''
        ].join(' ').toLowerCase();
      }
      return [
        item.followUpType,
        item.entityType,
        item.note,
        item.nextAction,
        item.meetingDate,
        item.meetingTime
      ].join(' ').toLowerCase();
    }

    function buildDashboardSuggestions(query) {
      const normalized = String(query || '').trim().toLowerCase();
      if (!normalized) return [];
      const pool = new Set();
      [...state.leads, ...state.properties, ...state.sharedListings].forEach(item => {
        [
          item.location,
          item.propertyType || item.category,
          item.preferredBuildingProject,
          item.buildingName,
          item.propertyType,
          item.purpose,
          item.price,
          item.rentPrice,
          item.ownerAskingPrice,
          item.priceLabel,
          item.sourceType === 'lead' || item.leadType ? 'Broker Requirements' : 'Broker Connector Listings',
          item.isDistress ? 'Distress Deals' : ''
        ].filter(Boolean).forEach(term => {
          if (String(term).toLowerCase().includes(normalized)) pool.add(String(term));
        });
      });
      return [...pool].slice(0, 8);
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = `<div class="empty">No properties match your current search. Add your first private property above.</div>`;
        return;
      }

      target.innerHTML = properties.map(property => `
        <div class="item-card ${property.isDistress ? 'distress-card' : ''}">
          <div class="item-top">
            <div class="item-title">
              <h4>${escapeHtml(joinDisplayParts([getPropertyPurposeLabel(property.purpose), property.propertyType || 'Property']))}</h4>
              <div class="muted">${escapeHtml(joinDisplayParts([
                property.location,
                getPropertyDisplayPrice(property),
                property.buildingName
              ]))}</div>
            </div>
            <div class="badges">
              <span class="badge ${badgeClass(property.status)}">${property.status}</span>
              ${property.isDistress ? '<span class="badge badge-red">Hot Distress</span>' : ''}
              <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell"><small>${getPropertyPurpose(property.purpose) === 'rent' ? 'Rent Price' : 'Asking Price'}</small><strong>${getPropertyDisplayPrice(property)}</strong></div>
            <div class="detail-cell"><small>Size</small><strong>${formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit)}</strong></div>
            <div class="detail-cell"><small>Floor Level</small><strong>${property.floorLevel || '--'}</strong></div>
            <div class="detail-cell"><small>Updated</small><strong>${new Date(property.updatedAt || property.createdAt || Date.now()).toLocaleDateString()}</strong></div>
          </div>
          <div class="muted"><strong>Terms:</strong> ${getPropertyTermsSummary(property)}</div>
          <div class="muted"><strong>Private contacts:</strong> ${getPropertyPrivateContactSummary(property)}</div>
          <div class="muted"><strong>Public-safe note:</strong> ${property.publicNotes || 'No public note added'}</div>
          <div class="muted"><strong>Internal note:</strong> ${property.internalNotes || 'No internal note added'}</div>
          <div class="actions">
            <button class="btn btn-secondary btn-tiny" type="button" onclick="editProperty(${property.id})">Edit</button>
            <button class="btn btn-danger btn-tiny" type="button" onclick="deleteProperty(${property.id})">Delete</button>
            <button class="btn ${getBcpShareButtonClass(property.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)" title="${property.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(property.isListedPublic)}</button>
          </div>
        </div>
      `).join('');
    }

    function resetPropertyForm() {
      document.getElementById('propertyForm').reset();
      document.getElementById('propertyId').value = '';
      state.propertyEditorOriginal = null;
      setPropertyWorkspaceHeader('create');
      clearPropertyErrors();
      setPropertyPurpose('', { preserveValues: false });
      document.getElementById('propertyLocation').value = '';
      document.getElementById('propertyBuildingName').value = '';
      document.getElementById('propertySizeSqft').value = '';
      document.getElementById('propertySizeUnit').value = 'sqft';
      document.getElementById('propertyOwnerName').value = '';
      document.getElementById('propertyOwnerPhone').value = '';
      document.getElementById('propertyInternalNotes').value = '';
      document.getElementById('propertyPublicNotes').value = '';
      document.getElementById('propertySubmitBtn').textContent = 'Save Listing';
      propertyAutocompleteControllers.location?.close();
      propertyAutocompleteControllers.building?.close();
    }

    function editProperty(id) {
      const property = state.properties.find(item => item.id === id);
      if (!property) return;
      state.propertyEditorOriginal = property;
      showOverviewWorkspace('property');
      setPropertyWorkspaceHeader('edit');
      clearPropertyErrors();
      document.getElementById('propertyId').value = property.id;
      setPropertyPurpose(getPropertyPurpose(property.purpose), { preserveValues: false });
      syncPropertyDimensionControls(property);
      populatePropertyFloorOptions(property.floorLevel || '');
      document.getElementById('propertyLocation').value = property.location || '';
      document.getElementById('propertyBuildingName').value = property.buildingName || '';
      document.getElementById('propertySizeSqft').value = formatSizeValue(property.sizeSqft || property.size || '');
      document.getElementById('propertySizeUnit').value = normalizeSizeUnit(property.sizeUnit || 'sqft');
      document.getElementById('propertyFurnishing').value = property.furnishing || '';
      document.getElementById('propertyRentPrice').value = normalizeBudgetDigits(property.rentPrice || (getPropertyPurpose(property.purpose) === 'rent' ? property.price : ''));
      document.getElementById('propertyCheques').value = property.cheques || '';
      document.getElementById('propertyChiller').value = property.chiller || '';
      document.getElementById('propertySalePrice').value = normalizeBudgetDigits(property.ownerAskingPrice || (getPropertyPurpose(property.purpose) === 'sale' ? property.price : ''));
      document.getElementById('propertyMortgageStatus').value = property.mortgageStatus || '';
      document.getElementById('propertyLeasehold').checked = Boolean(property.leasehold);
      document.getElementById('propertyPublicNotes').value = property.publicNotes || '';
      document.getElementById('propertyInternalNotes').value = property.internalNotes || '';
      document.getElementById('propertyOwnerName').value = property.ownerName || '';
      document.getElementById('propertyOwnerPhone').value = property.ownerPhone || '';
      document.getElementById('propertyDistress').checked = Boolean(property.isDistress);
      document.getElementById('propertySubmitBtn').textContent = 'Update Listing';
    }

    function wirePropertyFormSubmission() {
      const currentForm = document.getElementById('propertyForm');
      if (!currentForm || currentForm.dataset.wired === 'true') return;

      const nextForm = currentForm.cloneNode(true);
      currentForm.parentNode.replaceChild(nextForm, currentForm);
      nextForm.dataset.wired = 'true';

      nextForm.addEventListener('submit', async event => {
        event.preventDefault();
        clearPropertyErrors();
        const formData = collectPropertyFormData();
        const validationErrors = validatePropertyFormData(formData);
        if (Object.keys(validationErrors).length) {
          Object.entries(validationErrors).forEach(([field, message]) => setPropertyFieldError(field, message));
          setStatus('Please complete the required listing details.', 'error');
          return;
        }

        const payload = {
          action: formData.id ? 'update-property' : 'create-property',
          id: formData.id,
          purpose: formData.purpose,
          propertyType: formData.propertyType,
          propertyCategory: formData.propertyCategory,
          unitLayout: formData.unitLayout,
          location: formData.location,
          buildingName: formData.buildingName,
          sizeSqft: formData.sizeSqft,
          sizeUnit: formData.sizeUnit,
          floorLevel: formData.floorLevel,
          furnishing: formData.furnishing,
          rentPrice: formData.rentPrice,
          cheques: formData.cheques,
          chiller: formData.chiller,
          ownerAskingPrice: formData.ownerAskingPrice,
          salePropertyStatus: formData.salePropertyStatus,
          handoverQuarter: formData.handoverQuarter,
          handoverYear: formData.handoverYear,
          marketPrice: formData.marketPrice,
          distressAskingPrice: formData.distressAskingPrice,
          distressGapPercent: formData.distressGapPercent,
          distressDiscountPercent: formData.distressDiscountPercent,
          mortgageStatus: formData.mortgageStatus,
          leasehold: formData.leasehold,
          isDistress: formData.distressDeal,
          ownerName: formData.ownerName,
          ownerPhone: formData.ownerPhone,
          internalNotes: formData.internalNotes,
          publicNotes: formData.publicNotes,
          status: formData.status,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          legacyDescription: formData.legacyDescription
        };

        try {
          await dashboardAction(payload, formData.id ? 'Listing updated successfully.' : 'Listing created successfully.');
          resetPropertyForm();
          hideOverviewWorkspace();
        } catch (error) {
          setStatus(error.message, 'error');
        }
      });
    }

    function formatStatusLabel(value) {
      return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Status';
    }

    function getDashboardTodayString() {
      return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }

    function getFollowUpStateInfo(record) {
      const rawDate = String(record?.nextFollowUpDate || '').trim();
      if (!rawDate) return { key: 'none', label: 'No follow-up set', className: 'badge-ghost' };
      const today = getDashboardTodayString();
      if (rawDate === today) return { key: 'today', label: 'Follow-up Today', className: 'badge-yellow' };
      const targetDate = new Date(`${rawDate}T00:00:00`);
      const todayDate = new Date(`${today}T00:00:00`);
      const diffDays = Math.round((targetDate - todayDate) / 86400000);
      if (diffDays < 0) {
        return { key: 'overdue', label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, className: 'badge-overdue' };
      }
      if (diffDays === 1) {
        return { key: 'upcoming', label: 'Due Tomorrow', className: 'badge-blue' };
      }
      return { key: 'upcoming', label: `Upcoming on ${rawDate}`, className: 'badge-blue' };
    }

    function formatDateTime(value) {
      if (!value) return '--';
      try {
        return new Date(value).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' });
      } catch (error) {
        return String(value);
      }
    }

    function formatDateOnly(value) {
      if (!value) return '--';
      try {
        return new Date(value).toLocaleDateString('en-AE', { dateStyle: 'medium' });
      } catch (error) {
        return String(value);
      }
    }

    function formatLastContactLabel(value) {
      if (!value) return 'No contact yet';
      try {
        const date = new Date(value);
        const now = new Date();
        const diffDays = Math.floor((now - date) / 86400000);
        if (diffDays <= 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays} days ago`;
      } catch (error) {
        return value;
      }
    }

    function getLeadVisibility(record) {
      return record.isListedPublic ? 'listed' : 'private';
    }

    function getPropertyVisibility(record) {
      return record.isListedPublic ? 'listed' : 'private';
    }

    function getLeadFilterState() {
      return state.filters?.leads || {};
    }

    function getPropertyFilterState() {
      return state.filters?.properties || {};
    }

    function updateDashboardFilter(section, key, value) {
      if (!state.filters?.[section]) return;
      state.filters[section][key] = value;
      if (section === 'leads') renderLeads();
      if (section === 'properties') {
        renderProperties();
        renderDistressDeals();
      }
    }

    function syncFilterInputs(section) {
      const filters = state.filters?.[section];
      if (!filters) return;
      const prefix = section === 'leads' ? 'lead' : 'property';
      const fieldMap = {
        status: `${prefix}StatusFilter`,
        purpose: `${prefix}PurposeFilter`,
        visibility: `${prefix}VisibilityFilter`,
        followUp: `${prefix}FollowUpFilter`,
        archive: `${prefix}ArchiveFilter`,
        urgent: `${prefix}UrgentFilter`,
        distress: `${prefix}DistressFilter`,
        matches: `${prefix}MatchFilter`
      };

      Object.entries(filters).forEach(([key, value]) => {
        const node = document.getElementById(fieldMap[key] || `${prefix}${key.charAt(0).toUpperCase() + key.slice(1)}Filter`);
        if (node) node.value = value;
      });
    }

    function getDashboardNotificationStorageKey(kind = 'notifications') {
      const brokerKey = String(
        state.broker?.id
        || state.broker?.brokerId
        || state.broker?.email
        || 'default'
      ).trim().toLowerCase();
      const keyPrefix = kind === 'matches' ? DASHBOARD_MATCHES_SEEN_KEY : DASHBOARD_NOTIFICATIONS_SEEN_KEY;
      return `${keyPrefix}:${brokerKey || 'default'}`;
    }

    function getDashboardMatchMetaStorageKey() {
      const brokerKey = String(
        state.broker?.id
        || state.broker?.brokerId
        || state.broker?.email
        || 'default'
      ).trim().toLowerCase();
      return `${DASHBOARD_MATCHES_META_KEY}:${brokerKey || 'default'}`;
    }

    function getNotificationItems() {
      return Array.isArray(state.notifications) ? state.notifications : [];
    }

    function getWorkflowNotificationItems() {
      return getNotificationItems().filter(item => String(item?.notificationType || '').trim().toLowerCase() !== 'match');
    }

    function getMatchItems() {
      return Array.isArray(state.aiMatches) ? state.aiMatches : [];
    }

    function getNotificationKey(item, index = 0) {
      return [
        String(item?.id || item?.notificationId || '').trim(),
        String(item?.title || 'Notification').trim(),
        String(item?.message || '').trim(),
        String(item?.createdAt || item?.updatedAt || index).trim()
      ].join('|');
    }

    function getNotificationOriginalIndex(item, fallbackIndex = 0) {
      const originalIndex = getNotificationItems().indexOf(item);
      return originalIndex >= 0 ? originalIndex : fallbackIndex;
    }

    function getNotificationEntryKey(item, fallbackIndex = 0) {
      return getNotificationKey(item, getNotificationOriginalIndex(item, fallbackIndex));
    }

    function getMatchKey(item, index = 0) {
      return [
        String(item?.requirementId || '').trim(),
        String(item?.propertyId || '').trim(),
        String(item?.status || '').trim(),
        String(item?.matchReason || '').trim(),
        String(index).trim()
      ].join('|');
    }

    function getMatchMetaStore() {
      const raw = String(localStorage.getItem(getDashboardMatchMetaStorageKey()) || '').trim();
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function setMatchMetaStore(store = {}) {
      const normalized = Object.entries(store || {}).reduce((accumulator, [key, value]) => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) return accumulator;
        const firstSeenAt = Number(value?.firstSeenAt || 0);
        const removedAt = Number(value?.removedAt || 0);
        accumulator[normalizedKey] = {
          firstSeenAt: firstSeenAt > 0 ? firstSeenAt : Date.now(),
          removedAt: removedAt > 0 ? removedAt : 0
        };
        return accumulator;
      }, {});
      localStorage.setItem(getDashboardMatchMetaStorageKey(), JSON.stringify(normalized));
      return normalized;
    }

    function syncMatchMetaStore(items = getMatchItems()) {
      const store = { ...getMatchMetaStore() };
      const now = Date.now();
      let changed = false;
      (Array.isArray(items) ? items : []).forEach((item, index) => {
        const matchKey = getMatchKey(item, index);
        if (!matchKey) return;
        if (!store[matchKey]) {
          store[matchKey] = {
            firstSeenAt: now,
            removedAt: 0
          };
          changed = true;
          return;
        }
        const firstSeenAt = Number(store[matchKey]?.firstSeenAt || 0);
        const removedAt = Number(store[matchKey]?.removedAt || 0);
        if (firstSeenAt <= 0 || removedAt < 0) {
          store[matchKey] = {
            firstSeenAt: firstSeenAt > 0 ? firstSeenAt : now,
            removedAt: removedAt > 0 ? removedAt : 0
          };
          changed = true;
        }
      });
      return changed ? setMatchMetaStore(store) : store;
    }

    function getMatchLifecycleInfo(matchKey = '', store = getMatchMetaStore()) {
      const key = String(matchKey || '').trim();
      const record = key ? store[key] : null;
      const firstSeenAt = Number(record?.firstSeenAt || 0);
      const removedAt = Number(record?.removedAt || 0);
      const expiresAt = firstSeenAt > 0 ? firstSeenAt + MATCH_OPPORTUNITY_LIFETIME_MS : 0;
      const now = Date.now();
      return {
        firstSeenAt,
        removedAt,
        expiresAt,
        isRemoved: removedAt > 0,
        isExpired: expiresAt > 0 && now >= expiresAt,
        remainingMs: expiresAt > now ? expiresAt - now : 0
      };
    }

    function formatMatchExpiryLabel(matchKey = '', store = getMatchMetaStore()) {
      const lifecycle = getMatchLifecycleInfo(matchKey, store);
      if (!lifecycle.firstSeenAt) return 'Auto removes in 3 days.';
      if (lifecycle.isRemoved || lifecycle.isExpired) return 'Auto removed after 3 days.';
      const daysRemaining = Math.max(1, Math.ceil(lifecycle.remainingMs / 86400000));
      return `Auto removes in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`;
    }

    function getVisibleMatchItems() {
      const matches = Array.isArray(state.aiMatches) ? state.aiMatches : [];
      const store = syncMatchMetaStore(matches);
      return matches.filter((item, index) => {
        const lifecycle = getMatchLifecycleInfo(getMatchKey(item, index), store);
        return !lifecycle.isRemoved && !lifecycle.isExpired;
      });
    }

    function getSeenKeys(kind = 'notifications') {
      const raw = String(localStorage.getItem(getDashboardNotificationStorageKey(kind)) || '').trim();
      if (!raw) return [];
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter(item => String(item || '').trim()) : [];
        } catch (error) {
          return [];
        }
      }
      if (raw.includes('||')) {
        return raw.split('||').map(item => String(item || '').trim()).filter(Boolean);
      }
      return [raw];
    }

    function setSeenKeys(kind = 'notifications', keys = []) {
      const normalized = [...new Set((Array.isArray(keys) ? keys : []).map(item => String(item || '').trim()).filter(Boolean))];
      localStorage.setItem(getDashboardNotificationStorageKey(kind), JSON.stringify(normalized));
      if (kind === 'matches') {
        state.matchSeenKeys = normalized;
        return;
      }
      state.notificationSeenKeys = normalized;
    }

    function hasNotificationWithKey(key) {
      if (!key) return false;
      return getNotificationItems().some((item, index) => getNotificationKey(item, index) === key);
    }

    function hasMatchWithKey(key) {
      if (!key) return false;
      return getVisibleMatchItems().some((item, index) => getMatchKey(item, index) === key);
    }

    function isNotificationRead(key) {
      return state.notificationSeenKeys.includes(key);
    }

    function getUnreadNotificationItems(items = getNotificationItems()) {
      return (Array.isArray(items) ? items : [])
        .map((item, index) => ({
          item,
          index: getNotificationOriginalIndex(item, index),
          key: getNotificationEntryKey(item, index)
        }))
        .filter(entry => entry.key && !isNotificationRead(entry.key));
    }

    function isMatchRead(key) {
      return state.matchSeenKeys.includes(key);
    }

    function getUnreadCount(items, keyBuilder, seenKeys = []) {
      const seenSet = new Set(seenKeys);
      return items.reduce((count, item, index) => (
        seenSet.has(keyBuilder(item, index)) ? count : count + 1
      ), 0);
    }

    function syncNotificationIndicator() {
      const items = getNotificationItems();
      const workflowItems = getWorkflowNotificationItems();
      const matches = getVisibleMatchItems();
      state.notificationSeenKeys = getSeenKeys('notifications');
      state.matchSeenKeys = getSeenKeys('matches');
      const unreadNotificationItems = getUnreadNotificationItems(items);
      const unreadWorkflowItems = getUnreadNotificationItems(workflowItems);
      const unreadNotifications = unreadNotificationItems.length;
      const unreadWorkflowNotifications = unreadWorkflowItems.length;
      const unreadMatches = getUnreadCount(matches, getMatchKey, state.matchSeenKeys);
      const button = document.getElementById('alertsButton');
      const dot = document.getElementById('notificationUnreadDot');
      const meta = document.getElementById('notificationPanelMeta');
      if (!hasNotificationWithKey(state.activeNotificationKey) || isNotificationRead(state.activeNotificationKey)) {
        state.activeNotificationKey = unreadNotificationItems.length ? unreadNotificationItems[0].key : '';
      }
      if (!hasMatchWithKey(state.activeMatchKey)) {
        state.activeMatchKey = matches.length ? getMatchKey(matches[0], 0) : '';
      }
      if (button) {
        button.setAttribute('aria-label', unreadNotifications ? `Notifications ${unreadNotifications}` : 'Notifications');
      }
      const countNode = document.getElementById('notificationCountBadge');
      const workflowCountNode = document.getElementById('workflowAlertsCount');
      const workflowMatchesNode = document.getElementById('workflowMatchesCount');
      if (countNode) countNode.textContent = String(unreadNotifications);
      if (workflowCountNode) workflowCountNode.textContent = String(unreadWorkflowNotifications);
      if (workflowMatchesNode) workflowMatchesNode.textContent = String(unreadMatches);
      if (countNode) {
        countNode.classList.toggle('hidden', unreadNotifications < 1);
      }
      if (meta) {
        meta.textContent = unreadNotifications
          ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`
          : 'No unread notifications';
      }
      if (dot) {
        dot.classList.toggle('hidden', unreadNotifications < 1);
      }
    }

    function markNotificationRead(notificationKey = '') {
      const key = String(notificationKey || '').trim();
      if (!key) return;
      const nextKeys = [...new Set([...state.notificationSeenKeys, key])];
      setSeenKeys('notifications', nextKeys);
    }

    function markNotificationsSeen() {
      const keys = getNotificationItems().map((item, index) => getNotificationKey(item, index));
      setSeenKeys('notifications', keys);
      syncNotificationIndicator();
    }

    function markMatchRead(matchKey = '') {
      const key = String(matchKey || '').trim();
      if (!key) return;
      const nextKeys = [...new Set([...state.matchSeenKeys, key])];
      setSeenKeys('matches', nextKeys);
    }

    function removeMatchOpportunity(matchKey = '') {
      const key = String(matchKey || '').trim();
      if (!key) return;
      const store = { ...syncMatchMetaStore() };
      const existing = store[key] || {};
      store[key] = {
        firstSeenAt: Number(existing.firstSeenAt || 0) > 0 ? Number(existing.firstSeenAt) : Date.now(),
        removedAt: Date.now()
      };
      setMatchMetaStore(store);
      if (state.activeMatchKey === key) {
        state.activeMatchKey = '';
      }
      renderWorkflowAlerts();
    }

    function removeWorkflowMatchFromElement(event, element) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const key = String(element?.dataset?.matchKey || '').trim();
      if (!key) return;
      removeMatchOpportunity(key);
    }

    function removeWorkflowMatchFromModal(matchKey = '') {
      const key = String(matchKey || '').trim();
      if (!key) return;
      removeMatchOpportunity(key);
      closeWorkflowContextModal();
    }

    function closeNotificationPanel() {
      const panel = document.getElementById('notificationPanel');
      const button = document.getElementById('alertsButton');
      if (panel) panel.classList.add('hidden');
      if (button) button.setAttribute('aria-expanded', 'false');
      state.notificationPanelOpen = false;
    }

    function toggleNotificationPanel() {
      const panel = document.getElementById('notificationPanel');
      const button = document.getElementById('alertsButton');
      if (!panel || !button) return;
      closeAccountMenu();
      closeBrokerActivityMenu();
      const willOpen = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      state.notificationPanelOpen = willOpen;
      if (willOpen) {
        renderWorkflowAlerts();
      }
    }

    function handleWorkflowNotificationKeydown(event, element) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWorkflowNotificationFromElement(element);
      }
    }

    function openWorkflowNotificationFromElement(element) {
      const key = String(element?.dataset?.notificationKey || '').trim();
      openWorkflowNotification(key);
    }

    function openWorkflowNotification(notificationKey = '') {
      const key = String(notificationKey || state.activeNotificationKey || '').trim();
      const context = buildWorkflowNotificationContext(key);
      if (key) {
        state.activeNotificationKey = key;
        markNotificationRead(key);
      }
      closeNotificationPanel();
      openSection('overview');
      renderWorkflowAlerts();
      openWorkflowContextModal(context);
    }

    function handleWorkflowMatchKeydown(event, element) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWorkflowMatchFromElement(element);
      }
    }

    function openWorkflowMatchFromElement(element) {
      const key = String(element?.dataset?.matchKey || '').trim();
      openWorkflowMatch(key);
    }

    function openWorkflowMatch(matchKey = '') {
      if (matchKey) {
        state.activeMatchKey = matchKey;
        markMatchRead(matchKey);
      }
      closeNotificationPanel();
      openSection('overview');
      renderWorkflowAlerts();
      openWorkflowContextModal(buildWorkflowMatchContext(state.activeMatchKey));
    }

    function focusWorkflowAlerts() {
      closeNotificationPanel();
      openSection('overview');
      renderWorkflowAlerts();
      const card = document.getElementById('workflowAlertsCard');
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (card) {
        card.classList.add('is-highlighted');
        window.setTimeout(() => {
          card.classList.remove('is-highlighted');
        }, 1800);
      }
    }

    function getLeadById(id) {
      return (Array.isArray(state.leads) ? state.leads : []).find(item => String(item.id) === String(id)) || null;
    }

    function getPropertyById(id) {
      return (Array.isArray(state.properties) ? state.properties : []).find(item => String(item.id) === String(id)) || null;
    }

    function openLeadRecordFromWorkflow(id) {
      closeWorkflowContextModal();
      openLeadRecord(id);
    }

    function openPropertyRecordFromWorkflow(id, section = 'properties') {
      closeWorkflowContextModal();
      openPropertyRecord(id, section);
    }

    function openBrokerConnectorFromWorkflow(section = 'marketplace', listingId = '') {
      const normalizedSection = ({
        'broker-requirements': 'requirements',
        'broker-connector-listings': 'marketplace',
        'distress-deals': 'distress-deals'
      })[String(section || '').trim().toLowerCase()] || section || 'marketplace';
      const url = new URL('index.html', window.location.href);
      url.searchParams.set('section', normalizedSection);
      if (listingId) {
        url.searchParams.set('listing', String(listingId));
      }
      window.open(url.toString(), '_blank', 'noopener');
    }

    function renderWorkflowLeadSummary(lead) {
      if (!lead) {
        return '<div class="empty">Lead details are not available for this notification.</div>';
      }
      return `
        <div class="detail-grid">
          <div class="detail-cell"><small>Intent</small><strong>${escapeHtml(getLeadIntentText(lead) || '--')}</strong></div>
          <div class="detail-cell"><small>Type</small><strong>${escapeHtml(lead.propertyType || '--')}</strong></div>
          <div class="detail-cell"><small>Location</small><strong>${escapeHtml(lead.location || '--')}</strong></div>
          <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(lead.preferredBuildingProject || '--')}</strong></div>
          <div class="detail-cell"><small>Budget</small><strong>${escapeHtml(formatBudgetLabel(lead.budget))}</strong></div>
          <div class="detail-cell"><small>Status</small><strong>${escapeHtml(formatStatusLabel(lead.status || 'new'))}</strong></div>
        </div>
      `;
    }

    function renderWorkflowPropertySummary(property) {
      if (!property) {
        return '<div class="empty">Listing details are not available for this notification.</div>';
      }
      return `
        <div class="detail-grid">
          <div class="detail-cell"><small>Purpose</small><strong>${escapeHtml(getPropertyPurposeLabel(property.purpose))}</strong></div>
          <div class="detail-cell"><small>Type</small><strong>${escapeHtml(property.propertyType || '--')}</strong></div>
          <div class="detail-cell"><small>Location</small><strong>${escapeHtml(property.location || '--')}</strong></div>
          <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(property.buildingName || '--')}</strong></div>
          <div class="detail-cell"><small>Price</small><strong>${escapeHtml(getPropertyDisplayPrice(property))}</strong></div>
          <div class="detail-cell"><small>Status</small><strong>${escapeHtml(formatStatusLabel(property.status || 'available'))}</strong></div>
        </div>
      `;
    }

    function renderWorkflowLeadMatchRows(lead) {
      const matches = Array.isArray(lead?.matchingListings) ? lead.matchingListings : [];
      if (!matches.length) {
        return '<div class="empty">No linked listing details are available right now.</div>';
      }
      return `
        <div class="workflow-related-list">
          ${matches.slice(0, 6).map(match => {
            const property = getPropertyById(match.id);
            const targetSection = property?.isDistress ? 'distress' : 'properties';
            return `
              <div class="workflow-related-row">
              <div class="workflow-related-copy">
                <strong>${escapeHtml(`${match.confidence === 'strong' ? 'Strong Match' : 'Partial Match'} | Listing #${match.id}`)}</strong>
                <span>${escapeHtml(joinDisplayParts([match.propertyType, match.location, match.price]))}</span>
                <small>${escapeHtml(match.matchReason || '')}</small>
              </div>
              <div class="workflow-modal-actions">
                ${match.isExternalPublic
                  ? `<button class="btn btn-secondary btn-tiny" type="button" onclick="openBrokerConnectorFromWorkflow('${escapeHtml(match.sourceSection || 'marketplace')}', '${escapeHtml(match.id)}')">Open NexBridge Marketplace</button>`
                  : `<button class="btn btn-secondary btn-tiny" type="button" onclick="openPropertyRecordFromWorkflow(${Number(match.id)}, '${targetSection}')">Open Listing</button>`}
              </div>
            </div>
          `;
          }).join('')}
        </div>
      `;
    }

    function renderWorkflowPropertyMatchRows(property) {
      const matches = Array.isArray(property?.matchingLeads) ? property.matchingLeads : [];
      if (!matches.length) {
        return '<div class="empty">No linked lead details are available right now.</div>';
      }
      return `
        <div class="workflow-related-list">
          ${matches.slice(0, 6).map(match => `
            <div class="workflow-related-row">
              <div class="workflow-related-copy">
                <strong>${escapeHtml(`${match.confidence === 'strong' ? 'Strong Match' : 'Partial Match'} | Lead #${match.id}`)}</strong>
                <span>${escapeHtml(joinDisplayParts([formatStatusLabel(match.clientPurpose), match.propertyType, match.location, formatBudgetLabel(match.budget)]))}</span>
                <small>${escapeHtml(match.matchReason || '')}</small>
              </div>
              <div class="workflow-modal-actions">
                ${match.isExternalPublic
                  ? `<button class="btn btn-secondary btn-tiny" type="button" onclick="openBrokerConnectorFromWorkflow('${escapeHtml(match.sourceSection || 'requirements')}', '${escapeHtml(match.id)}')">Open NexBridge Marketplace</button>`
                  : `<button class="btn btn-secondary btn-tiny" type="button" onclick="openLeadRecordFromWorkflow(${Number(match.id)})">Open Requirement</button>`}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    function getWorkflowMatchInternalLead(match) {
      if (!match) return null;
      return getLeadById(match.requirementId || (match.internalType === 'lead' ? match.internalId : null));
    }

    function getWorkflowMatchInternalProperty(match) {
      if (!match) return null;
      return getPropertyById(match.propertyId || (match.internalType === 'property' ? match.internalId : null));
    }

    function renderWorkflowExternalLeadSummary(match) {
      if (!match) {
        return '<div class="empty">Matching requirement details are not available right now.</div>';
      }
      return `
        <div class="detail-grid">
          <div class="detail-cell"><small>Purpose</small><strong>${escapeHtml(formatStatusLabel(match.counterpartPurpose || '--'))}</strong></div>
          <div class="detail-cell"><small>Type</small><strong>${escapeHtml(match.counterpartPropertyType || '--')}</strong></div>
          <div class="detail-cell"><small>Location</small><strong>${escapeHtml(match.counterpartLocation || '--')}</strong></div>
          <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(match.counterpartBuilding || '--')}</strong></div>
          <div class="detail-cell"><small>Budget</small><strong>${escapeHtml(match.counterpartPriceLabel || '--')}</strong></div>
          <div class="detail-cell"><small>Broker</small><strong>${escapeHtml(match.counterpartBrokerName || 'Broker')}</strong></div>
        </div>
        ${match.counterpartPublicNotes ? `<div class="detail-note">${escapeHtml(match.counterpartPublicNotes)}</div>` : ''}
      `;
    }

    function renderWorkflowExternalPropertySummary(match) {
      if (!match) {
        return '<div class="empty">Matching listing details are not available right now.</div>';
      }
      return `
        <div class="detail-grid">
          <div class="detail-cell"><small>Purpose</small><strong>${escapeHtml(getPropertyPurposeLabel(match.counterpartPurpose || '--'))}</strong></div>
          <div class="detail-cell"><small>Type</small><strong>${escapeHtml(match.counterpartPropertyType || '--')}</strong></div>
          <div class="detail-cell"><small>Location</small><strong>${escapeHtml(match.counterpartLocation || '--')}</strong></div>
          <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(match.counterpartBuilding || '--')}</strong></div>
          <div class="detail-cell"><small>Price</small><strong>${escapeHtml(match.counterpartPriceLabel || '--')}</strong></div>
          <div class="detail-cell"><small>Broker</small><strong>${escapeHtml(match.counterpartBrokerName || 'Broker')}</strong></div>
        </div>
        ${match.counterpartPublicNotes ? `<div class="detail-note">${escapeHtml(match.counterpartPublicNotes)}</div>` : ''}
      `;
    }

    function buildWorkflowNotificationContext(notificationKey = '') {
      const notifications = getNotificationItems();
      const item = notifications.find((entry, index) => getNotificationKey(entry, index) === notificationKey) || null;
      if (!item) {
        return {
          kicker: 'Notification',
          title: 'Notification unavailable',
          copy: 'This notification could not be opened right now.',
          sections: [],
          actions: []
        };
      }
      const relatedType = String(item.relatedSourceType || '').trim().toLowerCase();
      const relatedId = item.relatedSourceId;
      const lead = relatedType === 'lead' ? getLeadById(relatedId) : null;
      const property = relatedType === 'property' ? getPropertyById(relatedId) : null;
      const sections = [];
      const actions = [];

      if (lead) {
        sections.push({
          title: 'Lead Details',
          body: renderWorkflowLeadSummary(lead)
        });
        actions.push(`<button class="btn btn-primary btn-tiny" type="button" onclick="openLeadRecordFromWorkflow(${Number(lead.id)})">Open Requirement</button>`);
        if (String(item.notificationType || '').toLowerCase() === 'match') {
          sections.push({
            title: 'Matching Listings',
            body: renderWorkflowLeadMatchRows(lead)
          });
        }
      }

      if (property) {
        sections.push({
          title: property.isDistress ? 'Distress Listing Details' : 'Listing Details',
          body: renderWorkflowPropertySummary(property)
        });
        actions.push(`<button class="btn btn-primary btn-tiny" type="button" onclick="openPropertyRecordFromWorkflow(${Number(property.id)}, '${property.isDistress ? 'distress' : 'properties'}')">${property.isDistress ? 'Open Distress Deal' : 'Open Listing'}</button>`);
        if (String(item.notificationType || '').toLowerCase() === 'match') {
          sections.push({
            title: 'Matching Requirements',
            body: renderWorkflowPropertyMatchRows(property)
          });
        }
      }

      if (!sections.length) {
        sections.push({
          title: 'Notification Details',
          body: `<div class="detail-note">${escapeHtml(item.message || 'No additional details available.')}</div>`
        });
      }

      return {
        kicker: 'Workflow Notification',
        title: item.title || 'Notification',
        copy: item.message || 'Review the related workflow item and continue where needed.',
        sections,
        actions
      };
    }

    function buildWorkflowMatchContext(matchKey = '') {
      const matches = getVisibleMatchItems();
      const match = matches.find((entry, index) => getMatchKey(entry, index) === matchKey) || null;
      const lead = getWorkflowMatchInternalLead(match);
      const property = getWorkflowMatchInternalProperty(match);
      if (!match) {
        return {
          kicker: 'Match Opportunity',
          title: 'Match unavailable',
          copy: 'This match could not be opened right now.',
          sections: [],
          actions: []
        };
      }
      const isInternalMatch = String(match.internalType || '').trim().toLowerCase() === 'internal'
        || String(match.visibilityScope || '').trim().toLowerCase() === 'internal';
      const isLeadPrimary = String(match.internalType || '').trim().toLowerCase() === 'lead';
      const visibilityScope = String(match.visibilityScope || '').trim().toLowerCase();
      const copy = isInternalMatch
        ? (match.matchReason || 'Your requirement and listing are aligned inside your private CRM.')
        : visibilityScope === 'private-pocket'
        ? 'A shared public record matches your private / pocket record. Only you were notified so you can contact the other broker directly.'
        : (match.matchReason || 'A shared public match is available on Broker Connector Page.');
      const sections = [];
      const actions = [];

      if (lead) {
        sections.push({
          title: (isLeadPrimary || isInternalMatch) ? 'Your Requirement' : 'Matching Requirement',
          body: renderWorkflowLeadSummary(lead)
        });
        if (isLeadPrimary || isInternalMatch) {
          actions.push(`<button class="btn btn-secondary btn-tiny" type="button" onclick="openLeadRecordFromWorkflow(${Number(lead.id)})">Open Requirement</button>`);
        }
      }

      if (property) {
        const propertyTitle = isInternalMatch
          ? (property?.isDistress ? 'Your Distress Listing' : 'Your Listing')
          : property?.isDistress
            ? (isLeadPrimary ? 'Matching Distress Listing' : 'Your Distress Listing')
            : (isLeadPrimary ? 'Matching Listing' : 'Your Listing');
        sections.push({
          title: propertyTitle,
          body: renderWorkflowPropertySummary(property)
        });
        if (!isLeadPrimary || isInternalMatch) {
          actions.push(`<button class="btn btn-secondary btn-tiny" type="button" onclick="openPropertyRecordFromWorkflow(${Number(property.id)}, '${property.isDistress ? 'distress' : 'properties'}')">${property.isDistress ? 'Open Distress Deal' : 'Open Listing'}</button>`);
        }
      }

      if (!isInternalMatch && String(match.counterpartType || '').toLowerCase() === 'property') {
        sections.push({
          title: 'Shared Public Listing',
          body: renderWorkflowExternalPropertySummary(match)
        });
      } else if (!isInternalMatch && String(match.counterpartType || '').toLowerCase() === 'lead') {
        sections.push({
          title: 'Shared Public Requirement',
          body: renderWorkflowExternalLeadSummary(match)
        });
      }

      if (!isInternalMatch && match.counterpartSection) {
        actions.push(`<button class="btn btn-primary btn-tiny" type="button" onclick="openBrokerConnectorFromWorkflow('${escapeHtml(match.counterpartSection)}', '${escapeHtml(match.counterpartRecordId || '')}')">Open NexBridge Marketplace</button>`);
      }

      return {
        kicker: 'Match Opportunity',
        title: match.status === 'strong' ? 'Strong Match' : 'Partial Match',
        copy,
        sections,
        actions: actions.filter(Boolean),
        matchKey
      };
    }

    function renderWorkflowContextModal(context) {
      const sections = Array.isArray(context?.sections) ? context.sections : [];
      const actions = Array.isArray(context?.actions) ? context.actions.filter(Boolean) : [];
      const matchKey = String(context?.matchKey || '').trim();
      const modalActions = matchKey
        ? [
            ...actions,
            `<button class="btn btn-danger btn-tiny" type="button" onclick='removeWorkflowMatchFromModal(${JSON.stringify(matchKey)})'>Remove Match</button>`
          ]
        : actions;
      return `
        <div class="workflow-modal-shell">
          <div class="workflow-modal-head">
            <div>
              <div class="workflow-modal-kicker">${escapeHtml(context?.kicker || 'Notification')}</div>
              <h3 id="dashboardWorkflowModalTitle">${escapeHtml(context?.title || 'Workflow details')}</h3>
              <p class="workflow-modal-copy">${escapeHtml(context?.copy || 'Review the details below.')}</p>
            </div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="closeWorkflowContextModal()">Close</button>
          </div>
          <div class="workflow-modal-grid">
            ${sections.map(section => `
              <div class="workflow-modal-section">
                <h4>${escapeHtml(section.title || 'Details')}</h4>
                ${section.body || '<div class="empty">No details available.</div>'}
              </div>
            `).join('')}
          </div>
          <div class="workflow-modal-actions">
            ${modalActions.join('')}
          </div>
        </div>
      `;
    }

    function openWorkflowContextModal(context) {
      const backdrop = document.getElementById('dashboardWorkflowModalBackdrop');
      const content = document.getElementById('dashboardWorkflowModalContent');
      if (!backdrop || !content) return;
      content.innerHTML = renderWorkflowContextModal(context);
      backdrop.classList.remove('hidden');
      document.body.classList.add('workflow-modal-open');
    }

    function closeWorkflowContextModal() {
      const backdrop = document.getElementById('dashboardWorkflowModalBackdrop');
      const content = document.getElementById('dashboardWorkflowModalContent');
      if (backdrop) backdrop.classList.add('hidden');
      if (content) content.innerHTML = '';
      document.body.classList.remove('workflow-modal-open');
    }
