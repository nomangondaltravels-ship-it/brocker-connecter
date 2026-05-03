    function openSection(name, options = {}) {
      const preserveRevealParams = Boolean(options?.preserveRevealParams);
      const normalized = name === 'shared-leads' ? 'requirements' : name;
      const targetSection = document.getElementById(`${normalized}-section`) ? normalized : 'requirements';
      state.activeSection = targetSection;
      document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
      document.querySelectorAll('.menu-btn').forEach(button => button.classList.remove('active'));
      document.querySelectorAll('.section-switch-btn').forEach(button => button.classList.remove('is-active'));
      document.getElementById(`${targetSection}-section`)?.classList.add('active');
      document.querySelector(`.menu-btn[data-target="${targetSection}"]`)?.classList.add('active');
      document.querySelector(`.section-switch-btn[data-target="${targetSection}"]`)?.classList.add('is-active');
      mountConnectorToolbar(targetSection);
      populateConnectorFilterOptions();
      closeMenuDrawer();
      if (!preserveRevealParams) {
        clearMarketplaceRevealParams(targetSection);
      }
    }

    function mountConnectorToolbar(sectionName = 'requirements') {
      const toolbar = document.getElementById('connectorToolbar');
      const section = document.getElementById(`${sectionName}-section`);
      if (!toolbar || !section) return;
      const head = section.querySelector('.page-head.compact-head') || section.querySelector('.page-head');
      if (head) {
        head.insertAdjacentElement('afterend', toolbar);
        return;
      }
      section.insertAdjacentElement('afterbegin', toolbar);
    }

    function openBrokerEmail(email) {
      const normalized = String(email || '').trim();
      if (!normalized) return;
      window.location.href = `mailto:${normalized}`;
    }

    function badgeClass(listing) {
      if (listing.isDistress) return 'badge-red';
      if (listing.sourceType === 'lead') return 'badge-blue';
      return 'badge-green';
    }

    function badgeText(listing) {
      if (listing.isDistress) return 'Hot Distress';
      return listing.sourceType === 'lead' ? 'Broker Requirement' : 'NexBridge Listing';
    }

    function normalizeText(value) {
      return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function getConnectorCurrentUserName() {
      return normalizeText(
        state.brokerProfile?.fullName
        || state.brokerProfile?.name
        || state.brokerProfile?.email
        || ''
      );
    }

    function buildConnectorWhatsappReference(listing) {
      if (!listing) return 'NexBridge post';
      const parts = listing.sourceType === 'lead'
        ? [
            getConnectorPublicPurposeLabel(listing).toUpperCase(),
            listing.propertyType || listing.category,
            listing.location,
            listing.buildingLabel
          ]
        : [
            getConnectorPublicPurposeLabel(listing).toUpperCase(),
            listing.propertyType || listing.category,
            listing.buildingLabel,
            listing.location
          ];
      const cleaned = parts.map(normalizeText).filter(Boolean);
      return cleaned.length ? cleaned.join(' | ') : 'NexBridge post';
    }

    function getConnectorWhatsappIntro(listing) {
      return listing?.sourceType === 'lead'
        ? 'I checked your requirement on BCP.'
        : 'I checked your listing on BCP.';
    }

    function getConnectorWhatsappIdentityLine() {
      const brokerName = getConnectorCurrentUserName();
      return brokerName ? `I am ${brokerName}.` : 'I am a broker from BCP.';
    }

    function buildConnectorWhatsappMessage(listing, sectionName) {
      const referenceLabel = buildConnectorWhatsappReference(listing);
      const link = listing ? buildListingLink(listing, sectionName) : '';
      return [
        getConnectorWhatsappIdentityLine(),
        getConnectorWhatsappIntro(listing),
        referenceLabel ? `Reference: ${referenceLabel}` : '',
        link ? `Link: ${link}` : '',
        'I have a client/buyer for this.'
      ].filter(Boolean).join('\n');
    }

    function logConnectorContactAttempt(listing, sectionName) {
      const payload = {
        event: 'contact_attempt',
        source_page: normalizeText(sectionName || 'connector') || 'connector',
        item_type: listing?.sourceType === 'lead' ? 'requirement' : (listing?.isDistress ? 'distress' : 'listing'),
        item_id: normalizeText(listing?.sourceId || listing?.id),
        selected_reason: 'bcp-auto-message',
        custom_reason_used: false
      };
      try {
        console.info('contact_attempt', payload);
      } catch (error) {
        // noop
      }
      try {
        window.dispatchEvent(new CustomEvent('contact_attempt', { detail: payload }));
      } catch (error) {
        // noop
      }
      return payload;
    }

    function canAccessBrokerContact(listing) {
      return Boolean(isMarketplaceBrokerAuthenticated() && listing && !listing.contactLocked && normalizePhoneNumber(listing.brokerMobile));
    }

    function renderProtectedBrokerContact(listing, sectionName, options = {}) {
      const normalizedSection = sectionName === 'shared-leads' ? 'requirements' : sectionName;
      const unlockLabel = options.unlockLabel || 'Unlock Broker Details';
      const compact = Boolean(options.compact);
      if (canAccessBrokerContact(listing)) {
        return options.unlockedHtml || '';
      }
      return `
        <div class="protected-broker-contact${compact ? ' is-compact' : ''}">
          <div class="protected-broker-contact-copy">
            <strong>Broker Hidden</strong>
            <span>Phone Hidden</span>
          </div>
          <button class="btn btn-primary btn-tiny" type="button" onclick="event.stopPropagation();openAuthRequiredModal('${normalizedSection}', '${listing?.id || ''}', null, 'signin')">${unlockLabel}</button>
          <small>Sign in or register to view contact information</small>
        </div>
      `;
    }

    function openConnectorWhatsappContact(listing, sectionName = 'connector') {
      if (!canAccessBrokerContact(listing)) {
        openAuthRequiredModal(sectionName, listing?.id, listing, 'signin');
        return false;
      }
      if (!listing?.brokerMobile) {
        setSystemBanner('WhatsApp number is not available for this broker.', 'error');
        return false;
      }
      const normalized = normalizePhoneNumber(listing.brokerMobile);
      if (!normalized) {
        setSystemBanner('WhatsApp number is not available for this broker.', 'error');
        return false;
      }
      const message = buildConnectorWhatsappMessage(listing, sectionName);
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
      logConnectorContactAttempt(listing, sectionName);
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        window.location.href = url;
      }
      return true;
    }

    function openConnectorWhatsappContactById(sectionName, listingId) {
      const listing = findMarketplaceListing(sectionName, listingId) || state.listings.find(item => String(item.id) === String(listingId));
      if (!listing) {
        setSystemBanner('Broker post could not be loaded for WhatsApp.', 'error');
        return false;
      }
      return openConnectorWhatsappContact(listing, sectionName);
    }

    function openProtectedCallPopoverById(button, sectionName, listingId) {
      const listing = findMarketplaceListing(sectionName, listingId);
      if (!listing) {
        setSystemBanner('Broker contact could not be loaded.', 'error');
        return false;
      }
      if (!canAccessBrokerContact(listing)) {
        openAuthRequiredModal(sectionName, listingId, listing, 'signin');
        return false;
      }
      showContactPopover(button, listing.brokerMobile);
      return true;
    }

    function sendProtectedMatchInterest(sectionName, listingId) {
      const listing = findMarketplaceListing(sectionName, listingId);
      if (!listing) {
        setSystemBanner('Broker post could not be loaded for matching.', 'error');
        return false;
      }
      if (!canAccessBrokerContact(listing)) {
        openAuthRequiredModal(sectionName, listingId, listing, 'signin');
        return false;
      }
      sendMatchInterest(listing.brokerMobile, encodeURIComponent(prefilledMatchText(listing)));
      return true;
    }

    function prefilledMatchText(listing) {
      return listing?.sourceType === 'lead'
        ? 'I have a matching property for your requirement.'
        : 'I have a matching client for your property.';
    }

    function buildListingLink(listing, sectionName) {
      const url = new URL(window.location.href);
      url.searchParams.set('section', sectionName);
      url.searchParams.set('listing', String(listing.id));
      return url.toString();
    }

    function getPublicSearchText(listing) {
      return [
        listing.sourceType === 'lead' ? 'broker requirement' : 'nexbridge listing',
        listing.purpose,
        getConnectorPublicPurposeLabel(listing),
        getConnectorDisplayPropertyType(listing),
        getConnectorDisplayPropertyCategory(listing),
        getConnectorDisplayUnitLayout(listing),
        getConnectorSalePropertyStatus(listing),
        getConnectorHandoverLabel(listing),
        getConnectorDistressGapLabel(listing),
        listing.location,
        listing.priceLabel,
        listing.publicNotes,
        listing.brokerName,
        listing.isDistress ? 'distress deal hot deal' : ''
      ].join(' ').toLowerCase();
    }

    function getConnectorFilterSelectConfigs() {
      return [
        { id: 'connectorPurposeFilter', field: 'purpose', defaultLabel: 'All Purposes' },
        { id: 'connectorCategoryFilter', field: 'propertyCategory', defaultLabel: 'All Categories' },
        { id: 'connectorLayoutFilter', field: 'unitLayout', defaultLabel: 'All Types' },
        { id: 'connectorLocationFilter', field: 'location', defaultLabel: 'All Areas' }
      ];
    }

    function getFallbackConnectorFieldValue(field, listing) {
      if (field === 'purpose') return getConnectorPublicPurposeValue(listing);
      if (field === 'propertyCategory') return getConnectorDisplayPropertyCategory(listing);
      if (field === 'unitLayout') return getConnectorDisplayUnitLayout(listing);
      if (field === 'location') return String(listing?.location || '').trim();
      return String(listing?.[field] || '').trim();
    }

    function getFallbackConnectorFilterOptions(field) {
      const values = dedupeConnectorValues(
        getListingsForActiveConnectorSection(state.activeSection)
          .map(listing => {
            try {
              return getConnectorCanonicalFieldValue(field, listing, state.activeSection);
            } catch (error) {
              return getFallbackConnectorFieldValue(field, listing);
            }
          })
          .filter(Boolean)
      );
      return values.map(value => ({
        value,
        label: String(value || '').trim()
      }));
    }

    function populateConnectorFilterOptionsFallback() {
      getConnectorFilterSelectConfigs().forEach(config => {
        const select = document.getElementById(config.id);
        if (!select) return;
        const currentValue = state.publicFilters[config.field] || 'all';
        const options = getFallbackConnectorFilterOptions(config.field);
        select.innerHTML = [
          `<option value="all">${config.defaultLabel}</option>`,
          ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        ].join('');
        select.value = options.some(option => option.value === currentValue) ? currentValue : 'all';
        state.publicFilters[config.field] = select.value;
      });
    }

    function populateConnectorFilterOptions() {
      try {
        getConnectorFilterSelectConfigs().forEach(config => {
          const select = document.getElementById(config.id);
          if (!select) return;
          const currentValue = state.publicFilters[config.field] || 'all';
          const options = getConnectorFilterOptions(config.field);
          select.innerHTML = [
            `<option value="all">${config.defaultLabel}</option>`,
            ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
          ].join('');
          select.value = options.some(option => option.value === currentValue) ? currentValue : 'all';
          state.publicFilters[config.field] = select.value;
        });
      } catch (error) {
        console.error('BCP filter options fallback activated.', error);
        populateConnectorFilterOptionsFallback();
      }
    }

    function applyConnectorFilters() {
      state.publicFilters.purpose = document.getElementById('connectorPurposeFilter')?.value || 'all';
      state.publicFilters.propertyCategory = document.getElementById('connectorCategoryFilter')?.value || 'all';
      state.publicFilters.unitLayout = document.getElementById('connectorLayoutFilter')?.value || 'all';
      state.publicFilters.location = document.getElementById('connectorLocationFilter')?.value || 'all';
      state.pagination.requirements = 1;
      state.pagination.marketplace = 1;
      state.pagination['distress-deals'] = 1;
      safeRenderPublicViews();
    }

    function clearConnectorFilters() {
      state.publicFilters = {
        purpose: 'all',
        propertyCategory: 'all',
        unitLayout: 'all',
        location: 'all'
      };
      ['connectorPurposeFilter', 'connectorCategoryFilter', 'connectorLayoutFilter', 'connectorLocationFilter'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = 'all';
      });
      state.pagination.requirements = 1;
      state.pagination.marketplace = 1;
      state.pagination['distress-deals'] = 1;
      safeRenderPublicViews();
    }

    function getPublicSelectionKey(sectionName, listing) {
      return `${sectionName}:${listing?.id ?? ''}`;
    }

    function isPublicContactRevealed(sectionName, listing) {
      return state.revealedPublicContactKeys[sectionName] === getPublicSelectionKey(sectionName, listing);
    }

    function ensureSelectedPublicListing(sectionName, items) {
      if (!Array.isArray(items) || !items.length) {
        state.selectedPublicListingKeys[sectionName] = '';
        state.revealedPublicContactKeys[sectionName] = '';
        return null;
      }
      const selectedKey = state.selectedPublicListingKeys[sectionName];
      const selectedItem = items.find(item => getPublicSelectionKey(sectionName, item) === selectedKey);
      if (selectedItem) return selectedItem;
      state.revealedPublicContactKeys[sectionName] = '';
      return null;
    }

    function selectPublicListing(sectionName, listingId) {
      queuePublicSplitScroll(sectionName, 'open', listingId);
      state.selectedPublicListingKeys[sectionName] = `${sectionName}:${listingId}`;
      state.revealedPublicContactKeys[sectionName] = '';
      safeRenderPublicViews();
    }

    function queuePublicSplitScroll(sectionName, mode, listingId) {
      state.pendingPublicSplitScroll = {
        sectionName,
        mode,
        listingId: String(listingId || '')
      };
      if (mode === 'restore') {
        state.publicSplitScrollMemory[sectionName] = String(listingId || '');
      }
    }

    function scrollConnectorPanelTopIntoView(panel, fallbackTarget = null) {
      const target = panel || fallbackTarget;
      if (!target) return;
      const topOffset = 92;
      const absoluteTop = window.scrollY + target.getBoundingClientRect().top - topOffset;
      window.scrollTo({
        top: Math.max(0, absoluteTop),
        behavior: 'smooth'
      });
    }

    function flushPublicSplitScroll(sectionName) {
      const intent = state.pendingPublicSplitScroll;
      if (!intent || intent.sectionName !== sectionName) return;
      state.pendingPublicSplitScroll = null;
      requestAnimationFrame(() => {
        const section = document.getElementById(`${sectionName}-section`);
        const shell = section?.querySelector('.connector-results-shell');
        const detailPanel = shell?.querySelector('.connector-detail-panel');
        const row = intent.listingId ? section?.querySelector(`[data-listing-id="${intent.listingId}"]`) : null;
        if (intent.mode === 'open') {
          scrollConnectorPanelTopIntoView(detailPanel, shell || section);
          return;
        }
        if (intent.mode === 'restore' && row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        (section || shell)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function closePublicDetailPanel(sectionName) {
      const selectedKey = state.selectedPublicListingKeys[sectionName] || '';
      const listingId = selectedKey.includes(':') ? selectedKey.split(':').slice(1).join(':') : '';
      queuePublicSplitScroll(sectionName, 'restore', listingId);
      state.selectedPublicListingKeys[sectionName] = '';
      state.revealedPublicContactKeys[sectionName] = '';
      safeRenderPublicViews();
    }

    function revealPublicContact(sectionName, listingId) {
      const listing = findMarketplaceListing(sectionName, listingId);
      if (!canAccessBrokerContact(listing)) {
        openAuthRequiredModal(sectionName, listingId, listing, 'signin');
        return;
      }
      state.revealedPublicContactKeys[sectionName] = `${sectionName}:${listingId}`;
      safeRenderPublicViews();
    }

    function getFilteredPublicListings() {
      const query = state.publicSearchQuery.trim().toLowerCase();
      return state.listings.filter(listing => {
        if (query && !getPublicSearchText(listing).includes(query)) return false;
        if (state.publicFilters.purpose !== 'all' && getConnectorCanonicalFieldValue('purpose', listing) !== state.publicFilters.purpose) return false;
        if (state.publicFilters.propertyCategory !== 'all' && getConnectorCanonicalFieldValue('propertyCategory', listing) !== state.publicFilters.propertyCategory) return false;
        if (state.publicFilters.unitLayout !== 'all' && getConnectorCanonicalFieldValue('unitLayout', listing) !== state.publicFilters.unitLayout) return false;
        if (state.publicFilters.location !== 'all' && getConnectorCanonicalFieldValue('location', listing) !== state.publicFilters.location) return false;
        return true;
      });
    }

    function buildPublicSuggestions(query) {
      const normalized = String(query || '').trim().toLowerCase();
      if (!normalized) return [];
      const terms = new Set();
      state.listings.forEach(listing => {
        [
          listing.location,
          getConnectorDisplayPropertyCategory(listing),
          getConnectorDisplayUnitLayout(listing),
          getConnectorDisplayPropertyType(listing),
          listing.purpose,
          listing.brokerName,
          listing.isDistress ? 'Distress Deals' : '',
        listing.sourceType === 'lead' ? 'Broker Requirements' : 'NexBridge Listings'
        ].filter(Boolean).forEach(term => {
          if (String(term).toLowerCase().includes(normalized)) terms.add(String(term));
        });
      });
      return [...terms].slice(0, 7);
    }

    function renderPublicSuggestions(query) {
      const target = document.getElementById('publicSearchSuggestions');
      const suggestions = buildPublicSuggestions(query);
      if (!suggestions.length) {
        target.innerHTML = '';
        target.classList.add('hidden');
        return;
      }
      target.innerHTML = suggestions.map(term => `
        <button class="btn btn-secondary suggestion-chip" type="button" onclick="selectPublicSuggestion('${term.replace(/'/g, '\\&#39;')}')">${term}</button>
      `).join('');
      target.classList.remove('hidden');
    }

    function applyPublicSearch(query = document.getElementById('publicSearchInput').value) {
      state.publicSearchQuery = String(query || '').trim();
      state.pagination.requirements = 1;
      state.pagination.marketplace = 1;
      state.pagination['distress-deals'] = 1;
      document.getElementById('publicSearchInput').value = state.publicSearchQuery;
      renderPublicSuggestions('');
      safeRenderPublicViews();
      if (state.publicSearchQuery) {
        setSystemBanner(`Showing results for "${state.publicSearchQuery}".`, 'success');
      } else {
        setSystemBanner('');
      }
    }

    function clearPublicSearch() {
      state.publicSearchQuery = '';
      state.pagination.requirements = 1;
      state.pagination.marketplace = 1;
      state.pagination['distress-deals'] = 1;
      document.getElementById('publicSearchInput').value = '';
      renderPublicSuggestions('');
      safeRenderPublicViews();
      setSystemBanner('');
    }

    function selectPublicSuggestion(term) {
      applyPublicSearch(term);
    }

    function renderListingCard(listing, sectionName) {
      const shareLink = buildListingLink(listing, sectionName);
      const priceLabel = formatConnectorMoney(listing.priceLabel);
      const contactActions = canAccessBrokerContact(listing)
        ? `
              <button class="btn btn-secondary btn-tiny" type="button" onclick="sendProtectedMatchInterest('${sectionName}', '${listing.id}')">I Have Match</button>
              <button class="btn btn-green btn-tiny" type="button" onclick="openConnectorWhatsappContactById('${sectionName}', '${listing.id}')">WhatsApp Broker</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openProtectedCallPopoverById(this, '${sectionName}', '${listing.id}')">Call Broker</button>
            `
        : renderProtectedBrokerContact(listing, sectionName, { compact: true, unlockLabel: 'Unlock Broker Details' });
      return `
          <div class="listing-card ${listing.isDistress ? 'distress-card' : ''}" data-listing-id="${listing.id}">
          <div class="listing-top">
            <div class="listing-title">
              <h3>${getConnectorPublicPurposeLabel(listing)} · ${getConnectorDisplayPropertyType(listing)}</h3>
              <div class="muted">${listing.location} · ${priceLabel}</div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell"><small>Category</small><strong>${getConnectorDisplayPropertyCategory(listing)}</strong></div>
            <div class="detail-cell"><small>Type</small><strong>${getConnectorDisplayUnitLayout(listing)}</strong></div>
            <div class="detail-cell"><small>Location</small><strong>${listing.location || '--'}</strong></div>
            <div class="detail-cell"><small>Price / Budget</small><strong>${priceLabel}</strong></div>
            </div>
            <div class="actions" style="margin-top:12px;">
              ${contactActions}
              <button class="btn btn-secondary btn-tiny" type="button" onclick="showSharePopover(this, '${shareLink.replace(/'/g, '%27')}')">Share Listing</button>
            </div>
          </div>
        `;
      }

    function renderPublicCard(listing, sectionName) {
      const shareLink = buildListingLink(listing, sectionName);
      const priceLabel = formatConnectorMoney(listing.priceLabel);
      const contactActions = canAccessBrokerContact(listing)
        ? `
              <button class="btn btn-secondary btn-tiny" type="button" onclick="sendProtectedMatchInterest('${sectionName}', '${listing.id}')">I Have Match</button>
              <button class="btn btn-green btn-tiny" type="button" onclick="openConnectorWhatsappContactById('${sectionName}', '${listing.id}')">WhatsApp Broker</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openProtectedCallPopoverById(this, '${sectionName}', '${listing.id}')">Call Broker</button>
            `
        : renderProtectedBrokerContact(listing, sectionName, { compact: true, unlockLabel: 'Unlock Broker Details' });
      return `
          <div class="listing-card ${listing.isDistress ? 'distress-card' : ''}" data-listing-id="${listing.id}">
          <div class="listing-top">
            <div class="listing-title">
              <h3>${listing.sourceType === 'lead' ? 'Broker Requirement' : 'NexBridge Listing'} &middot; ${getConnectorDisplayPropertyType(listing)}</h3>
              <div class="muted">${listing.location} &middot; ${priceLabel}</div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell"><small>Category</small><strong>${getConnectorDisplayPropertyCategory(listing)}</strong></div>
            <div class="detail-cell"><small>Type</small><strong>${getConnectorDisplayUnitLayout(listing)}</strong></div>
            <div class="detail-cell"><small>Location</small><strong>${listing.location || '--'}</strong></div>
            <div class="detail-cell"><small>Price / Budget</small><strong>${priceLabel}</strong></div>
            </div>
            <div class="actions" style="margin-top:12px;">
              ${contactActions}
              <button class="btn btn-secondary btn-tiny" type="button" onclick="showSharePopover(this, '${shareLink.replace(/'/g, '%27')}')">Share Listing</button>
            </div>
          </div>
        `;
    }

    function renderHomeHighlights() {
      const target = document.getElementById('homeHighlights');
      if (!target) return;
      const highlights = getFilteredPublicListings()
        .sort((a, b) => Number(Boolean(b.isDistress)) - Number(Boolean(a.isDistress)))
        .slice(0, 4);
      if (!highlights.length) {
        target.innerHTML = `<div class="empty">No public broker requirements or NexBridge listings are live yet. Brokers can list private requirements or properties publicly from their dashboard.</div>`;
        return;
      }
      target.innerHTML = highlights.map(item => renderListingCard(item, item.sourceType === 'lead' ? 'requirements' : item.isDistress ? 'distress-deals' : 'marketplace')).join('');
    }

    function formatCompactRelativeTime(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '--';
      const diffMs = Date.now() - date.getTime();
      const diffHours = Math.max(0, Math.floor(diffMs / 3600000));
      if (diffHours < 24) return `${Math.max(1, diffHours)}h`;
      return `${Math.max(1, Math.floor(diffHours / 24))}d`;
    }

    function formatRelativeTimeLabel(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '--';
      const diffMs = Math.max(0, Date.now() - date.getTime());
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 60) {
        const minutes = Math.max(1, diffMinutes);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      }
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      }
      const diffDays = Math.max(1, Math.floor(diffHours / 24));
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }

    function formatConnectorMoney(value) {
      const raw = normalizeText(value);
      if (!raw || raw === '--') return '--';
      const amountText = raw.replace(/[^\d.]/g, '');
      if (!amountText) return raw;
      const amount = Number(amountText);
      if (!Number.isFinite(amount) || amount <= 0) return raw;
      return `AED ${Math.round(amount).toLocaleString('en-AE')}`;
    }

    function getConnectorBuildingDisplay(listing) {
      const value = normalizeText(listing?.buildingLabel || listing?.sizeLabel);
      if (!value || value === '--' || value.toLowerCase() === 'any') {
        return 'Building not specified';
      }
      return value;
    }

    function getConnectorPaymentMethod(listing) {
      const direct = normalizeText(listing?.paymentMethod);
      if (direct) return direct;
      const notes = normalizeText(listing?.publicNotes);
      const match = notes.match(/(?:^|\|)\s*Payment\s*:\s*([^|]+)/i);
      return normalizeText(match?.[1]);
    }

    function getConnectorDetailTitle(listing) {
      const purpose = getConnectorPublicPurposeLabel(listing);
      if (listing?.sourceType === 'lead') return `${purpose} Requirement`;
      if (listing?.isDistress) return 'Distress Deal';
      return `${purpose} Listing`;
    }

    function getBrokerActivityStatusInfo(lastActivity) {
      return { key: 'online', label: 'Online', dotClass: 'is-online' };
    }

    function renderBrokerActivityLine(listing, brokerLabel = '') {
      const info = getBrokerActivityStatusInfo(listing?.brokerLastActivity);
      const label = brokerLabel || String(listing?.brokerName || 'Broker');
      return `<span class="broker-activity-inline"><span class="broker-activity-dot ${info.dotClass}" aria-hidden="true"></span><span>${escapeHtml(label)} • ${escapeHtml(info.label)}</span></span>`;
    }

    function getBrokerInitials(name) {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (!parts.length) return 'BC';
      return parts.map(part => part.charAt(0).toUpperCase()).join('');
    }

    function renderBcpBrokerIdentity(listing) {
      const brokerName = String(listing?.brokerName || 'Broker').trim() || 'Broker';
      const activity = getBrokerActivityStatusInfo(listing?.brokerLastActivity);
      const avatarMarkup = listing?.brokerAvatarUrl
        ? `<span class="bcp-broker-avatar"><img src="${escapeHtml(listing.brokerAvatarUrl)}" alt="${escapeHtml(brokerName)}"></span>`
        : `<span class="bcp-broker-avatar">${escapeHtml(getBrokerInitials(brokerName))}</span>`;
      return `
        <div class="bcp-broker-identity">
          ${avatarMarkup}
          <div class="bcp-broker-copy">
            <strong>${escapeHtml(brokerName)}</strong>
            <span class="broker-activity-stack"><span class="broker-activity-dot ${activity.dotClass}" aria-hidden="true"></span><span>${escapeHtml(activity.label)}</span></span>
          </div>
        </div>
      `;
    }

    function getConnectorActionIcon(icon) {
      switch (icon) {
        case 'whatsapp':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11.5A8.5 8.5 0 0 1 7.1 18.8L4 20l1.3-3A8.5 8.5 0 1 1 20 11.5Z"></path>
              <path d="M9.6 8.9c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.4l.7 1.8c.1.2.1.4-.1.6l-.5.7c.5.9 1.2 1.6 2.1 2.1l.7-.5c.2-.1.4-.1.6-.1l1.8.7c.3.1.4.3.4.5v.5c0 .2 0 .4-.4.6-.4.2-.9.4-1.5.3-1.3-.2-2.7-1-4-2.2s-2-2.7-2.2-4c-.1-.6.1-1.1.3-1.5Z"></path>
            </svg>
          `;
        case 'call':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.9 4.5h2.6l1.3 4.2-1.7 1.7a14.5 14.5 0 0 0 4.5 4.5l1.7-1.7 4.2 1.3v2.6a1.6 1.6 0 0 1-1.8 1.6A15.8 15.8 0 0 1 5.3 6.3 1.6 1.6 0 0 1 6.9 4.5Z"></path>
            </svg>
          `;
        case 'match':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 7h7a4 4 0 0 1 0 8H8"></path>
              <path d="M16 17H9a4 4 0 0 1 0-8h7"></path>
              <path d="M12 6v12"></path>
            </svg>
          `;
        case 'share':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V5"></path>
              <path d="m7 10 5-5 5 5"></path>
              <path d="M5 19.5h14"></path>
            </svg>
          `;
        case 'email':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7.5h16v9H4z"></path>
              <path d="m5 8 7 5 7-5"></path>
            </svg>
          `;
        case 'open':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14"></path>
              <path d="m13 6 6 6-6 6"></path>
            </svg>
          `;
        case 'report':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4v16"></path>
              <path d="M5 5h9l1.5 3H19l-1.5 4H5"></path>
            </svg>
          `;
        case 'image':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2"></rect>
              <circle cx="9" cy="10" r="1.5"></circle>
              <path d="m21 16-5.5-5.5L7 19"></path>
            </svg>
          `;
        case 'download':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v10"></path>
              <path d="m8 10 4 4 4-4"></path>
              <path d="M5 20h14"></path>
            </svg>
          `;
      }
      return '';
    }

    function renderConnectorActionButton({ label, icon, tone = 'secondary', onclick, disabled = false }) {
      return `
        <button class="btn connector-action-btn ${tone === 'ghost' ? 'btn-ghost' : tone === 'primary' ? 'btn-primary' : 'btn-secondary'}" type="button" ${disabled ? 'disabled' : ''} onclick="${onclick}">
          ${getConnectorActionIcon(icon)}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }

    function renderConnectorReportButton({ label, onClick, currentUserId, reportedUserId, targetType, targetId, selfDisabledText }) {
      const buttonState = window.ComplaintCenterUi?.getReportButtonState({
        currentUserId,
        reportedUserId,
        targetType,
        targetId,
        selfDisabledText
      }) || { hidden: false, disabled: false, disabledReason: '' };
      if (buttonState.hidden) return '';
      return `
        <button class="btn connector-action-btn btn-ghost" type="button" ${buttonState.disabled ? 'disabled' : ''} ${buttonState.disabledReason ? `title="${escapeHtml(buttonState.disabledReason)}"` : ''} onclick="${buttonState.disabled ? '' : onClick}">
          ${getConnectorActionIcon('report')}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }

    function renderConnectorDetailActions(listing, shareLink) {
      const reportRecordButton = renderConnectorReportButton({
        label: listing.sourceType === 'lead' ? 'Report Requirement' : 'Report Listing',
        onClick: `openRecordComplaint('${listing.sourceType === 'lead' ? 'requirements' : listing.isDistress ? 'distress-deals' : 'marketplace'}', '${listing.id}')`,
        currentUserId: state.brokerProfile?.id || '',
        reportedUserId: listing.brokerUuid || '',
        targetType: listing.sourceType === 'lead' ? 'requirement' : 'listing',
        targetId: listing.sourceId || listing.id,
        selfDisabledText: 'You cannot report your own shared record.'
      });
      const sectionName = listing.sourceType === 'lead' ? 'requirements' : listing.isDistress ? 'distress-deals' : 'marketplace';
      const mediaActions = listing.sourceType === 'property'
        ? `
            ${renderConnectorActionButton({
              label: 'View Pictures',
              icon: 'image',
              tone: 'secondary',
              onclick: `openConnectorListingPictures('${sectionName}', '${listing.id}')`
            })}
            ${isMarketplaceBrokerAuthenticated() ? renderConnectorActionButton({
              label: 'Download PDF',
              icon: 'download',
              tone: 'ghost',
              onclick: `downloadConnectorListingPdf('${sectionName}', '${listing.id}')`
            }) : ''}
          `
        : '';
      const protectedActions = canAccessBrokerContact(listing)
        ? `
            ${renderConnectorActionButton({
              label: 'WhatsApp',
              icon: 'whatsapp',
              tone: 'primary',
              onclick: `openConnectorWhatsappContactById('${sectionName}', '${listing.id}')`,
              disabled: !listing.brokerMobile
            })}
            ${renderConnectorActionButton({
              label: 'Call',
              icon: 'call',
              tone: 'secondary',
              onclick: `openProtectedCallPopoverById(this, '${sectionName}', '${listing.id}')`,
              disabled: !listing.brokerMobile
            })}
            ${renderConnectorActionButton({
              label: 'I Have Match',
              icon: 'match',
              tone: 'secondary',
              onclick: `sendProtectedMatchInterest('${sectionName}', '${listing.id}')`,
              disabled: !listing.brokerMobile
            })}
          `
        : renderConnectorActionButton({
            label: 'Unlock Broker Details',
            icon: 'call',
            tone: 'primary',
            onclick: `openAuthRequiredModal('${sectionName}', '${listing.id}', null, 'signin')`
          });
      return `
          <div class="connector-action-bar">
            ${protectedActions}
            ${mediaActions}
            ${renderConnectorActionButton({
              label: 'Share',
              icon: 'share',
              tone: 'ghost',
              onclick: `showSharePopover(this, '${shareLink.replace(/'/g, '%27')}')`
          })}
          ${listing.brokerEmail ? renderConnectorActionButton({
            label: 'Email',
            icon: 'email',
            tone: 'ghost',
            onclick: `openBrokerEmail('${String(listing.brokerEmail).replace(/'/g, '%27')}')`
          }) : ''}
          ${reportRecordButton}
        </div>
      `;
    }

    function findConnectorListing(sectionName, listingId) {
      const items = getListingsForActiveConnectorSection(sectionName);
      return items.find(item => String(item.id) === String(listingId)) || null;
    }

    async function fetchConnectorListingMediaBundle(listing) {
      const cacheKey = String(listing?.id || '');
      if (!cacheKey) {
        return { images: [], count: 0, details: {} };
      }
      if (state.listingMediaCache[cacheKey]) {
        return state.listingMediaCache[cacheKey];
      }
      const response = await fetch(`/api/public-marketplace?mediaFor=${encodeURIComponent(cacheKey)}`, { method: 'GET' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Could not load listing pictures.');
      }
      const mediaBundle = {
        images: window.ListingMediaUi?.sanitizeImageList(result?.images) || [],
        count: Number(result?.count || 0) || 0,
        details: result?.details && typeof result.details === 'object' ? result.details : {}
      };
      state.listingMediaCache[cacheKey] = mediaBundle;
      return mediaBundle;
    }

    function buildConnectorListingPdfOptionSections(listing, mediaBundle = {}, requester = {}) {
      const details = mediaBundle?.details && typeof mediaBundle.details === 'object' ? mediaBundle.details : {};
      const purpose = getConnectorPublicPurposeValue(listing);
      const saleStatus = getConnectorSalePropertyStatus(listing) || details.salePropertyStatus || '';
      const handoverLabel = getConnectorHandoverLabel(listing)
        || [details.handoverQuarter, details.handoverYear].filter(Boolean).join(' ');
      const isOffPlan = normalizeText(saleStatus).toLowerCase() === 'off plan property';
      const distressLabel = getConnectorDistressGapLabel(listing) || details.distressGapPercent || '';
      const hasCompanyDetails = Boolean(requester?.companyName || requester?.officeLocation);
      return [
        {
          key: 'paymentDetails',
          label: 'Payment details',
          description: 'Include chiller, mortgage, and ownership details where available.',
          checked: false,
          hidden: !(details.chiller || details.mortgageStatus || details.leasehold)
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
          hidden: !normalizeText(listing?.publicNotes)
        },
        {
          key: 'distressDetails',
          label: 'Distress details if available',
          description: 'Include distress gap and market price details.',
          checked: false,
          hidden: !(listing?.isDistress || distressLabel || listing?.marketPrice || details.marketPrice)
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

    function buildConnectorListingPdfPayload(listing, requester = {}, selections = {}, mediaBundle = {}) {
      const details = mediaBundle?.details && typeof mediaBundle.details === 'object' ? mediaBundle.details : {};
      const fields = [
        { label: 'Purpose', value: getConnectorPublicPurposeLabel(listing) },
        { label: 'Property Category', value: getConnectorDisplayPropertyCategory(listing) || '--' },
        { label: 'Type', value: getConnectorDisplayUnitLayout(listing) || getConnectorDisplayPropertyType(listing) || '--' },
        { label: 'Location', value: listing.location || '--' },
        { label: 'Building / Project', value: listing.buildingLabel || '--' },
        { label: 'Price', value: formatConnectorMoney(listing.priceLabel) },
        { label: 'Size', value: listing.sizeLabel || '--' }
      ];
      if (details.furnishing) fields.push({ label: 'Furnishing', value: details.furnishing });
      const sections = [];
      if (selections.paymentDetails) {
        const paymentFields = [];
        if (details.chiller) paymentFields.push({ label: 'Chiller', value: details.chiller });
        if (details.mortgageStatus) paymentFields.push({ label: 'Mortgage Status', value: details.mortgageStatus });
        if (details.leasehold) paymentFields.push({ label: 'Ownership', value: 'Leasehold' });
        if (paymentFields.length) {
          sections.push({ title: 'Payment Details', fields: paymentFields });
        }
      }
      if (selections.chequesDetails && getConnectorPublicPurposeValue(listing) === 'rent' && details.cheques) {
        sections.push({
          title: 'Cheques Details',
          fields: [{ label: 'Cheques', value: details.cheques }]
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
      if (selections.publicNotes && normalizeText(listing.publicNotes)) {
        sections.push({
          title: 'Public Notes',
          notes: normalizeText(listing.publicNotes)
        });
      }
      if (selections.distressDetails && (listing.isDistress || listing.marketPrice || details.marketPrice || details.distressGapPercent)) {
        const distressFields = [
          { label: 'Distress Gap', value: getConnectorDistressGapLabel(listing) || details.distressGapPercent || 'Add both market and asking prices to calculate distress gap.' }
        ];
        if (listing.marketPrice || details.marketPrice) {
          distressFields.push({ label: 'Market Price', value: `AED ${normalizeBudgetDigits(listing.marketPrice || details.marketPrice)}` });
        }
        sections.push({ title: 'Distress Details', fields: distressFields });
      }
      if (selections.offPlanDetails) {
        const saleStatus = getConnectorSalePropertyStatus(listing) || details.salePropertyStatus || 'Ready Property';
        const handoverLabel = getConnectorHandoverLabel(listing)
          || [details.handoverQuarter, details.handoverYear].filter(Boolean).join(' ');
        const offPlanFields = [];
        if (saleStatus) offPlanFields.push({ label: 'Sale Status', value: saleStatus });
        if (handoverLabel) offPlanFields.push({ label: 'Expected Handover', value: handoverLabel });
        if (offPlanFields.length) {
          sections.push({ title: 'Off-plan Handover Details', fields: offPlanFields });
        }
      }
      return {
        title: `${getConnectorPublicPurposeLabel(listing)} ${getConnectorDisplayPropertyType(listing) ? `- ${getConnectorDisplayPropertyType(listing)}` : 'Listing'}`,
        fileName: `${getConnectorPublicPurposeLabel(listing)}-${getConnectorDisplayPropertyType(listing) || 'listing'}`,
        fields,
        sections,
        images: selections.images ? (mediaBundle.images || []) : undefined
      };
    }

    async function openConnectorListingPictures(sectionName, listingId) {
      const listing = findConnectorListing(sectionName, listingId);
      if (!listing) return;
      try {
        if (!window.ListingMediaUi?.openGallery) {
          throw new Error('Picture viewer is unavailable right now. Refresh and try again.');
        }
        const mediaBundle = await fetchConnectorListingMediaBundle(listing);
        window.ListingMediaUi.openGallery({
          title: `${getConnectorPublicPurposeLabel(listing)} ${getConnectorDisplayPropertyType(listing) ? `- ${getConnectorDisplayPropertyType(listing)}` : 'Listing Pictures'}`,
          images: mediaBundle.images
        });
      } catch (error) {
        showActionToast('error', getUiErrorMessage(error, 'Could not load listing pictures.'));
      }
    }

    async function downloadConnectorListingPdf(sectionName, listingId) {
      const listing = findConnectorListing(sectionName, listingId);
      if (!listing) return;
      try {
        if (!isMarketplaceBrokerAuthenticated()) {
          openAuthRequiredModal(sectionName, listing?.id, listing, 'signin');
          return;
        }
        if (!window.ListingMediaUi?.downloadListingPdf || !window.ListingMediaUi?.openPdfOptionsModal) {
          throw new Error('PDF tools are unavailable right now. Refresh and try again.');
        }
        const mediaBundle = await fetchConnectorListingMediaBundle(listing);
        const requester = getMarketplaceCurrentBrokerProfile();
        const selections = await window.ListingMediaUi.openPdfOptionsModal({
          title: 'Customize PDF Details',
          description: 'Select which optional public-safe sections should appear in the PDF.',
          sections: buildConnectorListingPdfOptionSections(listing, mediaBundle, requester)
        });
        if (!selections) return;
        await window.ListingMediaUi.downloadListingPdf(buildConnectorListingPdfPayload(listing, requester, selections, mediaBundle));
      } catch (error) {
        showActionToast('error', getUiErrorMessage(error, 'Could not download listing PDF.'));
      }
    }

    function buildPublicActionButtons(listing, sectionName) {
      const selectionKey = getPublicSelectionKey(sectionName, listing);
      const isSelected = state.selectedPublicListingKeys[sectionName] === selectionKey;
      return `
        <div class="row-open-action" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-tiny row-view-btn" type="button" onclick="selectPublicListing('${sectionName}', '${listing.id}')">
            ${getConnectorActionIcon('open')}
            <span>${isSelected ? 'Viewing' : 'View'}</span>
          </button>
        </div>
      `;
    }

    function sortPublicListings(items) {
      return [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    }

    function paginatePublicItems(sectionName, items) {
      const pageSize = 30;
      const currentPage = Math.max(1, Number(state.pagination?.[sectionName] || 1));
      const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
      const safePage = Math.min(currentPage, totalPages);
      state.pagination[sectionName] = safePage;
      const startIndex = (safePage - 1) * pageSize;
      return {
        pageItems: items.slice(startIndex, startIndex + pageSize),
        startIndex,
        currentPage: safePage,
        totalPages
      };
    }

    function renderPager(sectionName, totalItems) {
      const pager = document.getElementById(`${sectionName}Pager`);
      if (!pager) return;
      const totalPages = Math.max(1, Math.ceil(totalItems / 30));
      if (totalPages <= 1) {
        pager.classList.add('hidden');
        pager.innerHTML = '';
        return;
      }
      const currentPage = Number(state.pagination?.[sectionName] || 1);
      pager.classList.remove('hidden');
      pager.innerHTML = `
        <button class="btn btn-secondary btn-tiny" type="button" ${currentPage <= 1 ? 'disabled' : ''} onclick="changePublicPage('${sectionName}', -1)">Prev</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-secondary btn-tiny" type="button" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changePublicPage('${sectionName}', 1)">Next</button>
      `;
    }

    function changePublicPage(sectionName, delta) {
      state.pagination[sectionName] = Math.max(1, Number(state.pagination?.[sectionName] || 1) + Number(delta || 0));
      safeRenderPublicViews();
      document.getElementById(`${sectionName}-section`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderConnectorDetailPanel(targetId, sectionName, items) {
      const target = document.getElementById(targetId);
      if (!target) return;
      const shell = target.closest('.connector-results-shell');
      const selected = ensureSelectedPublicListing(sectionName, items);
      if (!selected) {
        if (shell) {
          shell.classList.add('no-detail');
          shell.classList.remove('has-detail');
        }
        target.innerHTML = '';
        return;
      }
      if (shell) {
        shell.classList.add('has-detail');
        shell.classList.remove('no-detail');
      }
      const shareLink = buildListingLink(selected, sectionName);
      const detailTitle = getConnectorDetailTitle(selected);
        const locationSummary = [getConnectorDisplayPropertyCategory(selected), selected.location || '--']
          .filter(Boolean)
          .join(' | ');
        const priceLabel = formatConnectorMoney(selected.priceLabel);
        const buildingLabel = getConnectorBuildingDisplay(selected);
        const paymentMethod = getConnectorPaymentMethod(selected);
        const priceRowLabel = selected.sourceType === 'lead' ? 'Budget' : 'Price';
      target.innerHTML = `
        <div class="connector-detail-header">
          <div class="connector-detail-head-row">
            <div class="connector-detail-meta">
              <span class="badge ${selected.sourceType === 'lead' ? 'badge-blue' : 'badge-green'}">${selected.sourceType === 'lead' ? 'Shared Requirement' : 'Shared Listing'}</span>
            </div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="closePublicDetailPanel('${sectionName}')">Close</button>
          </div>
          <h3>${escapeHtml(detailTitle)}</h3>
          <div class="connector-detail-location">${escapeHtml(locationSummary || '--')}</div>
          <div class="connector-detail-price">${escapeHtml(priceLabel)}</div>
          <div class="connector-detail-inline-meta">
            <span>Updated ${escapeHtml(formatRelativeTimeLabel(selected.updatedAt || selected.createdAt))}</span>
          </div>
          <div class="connector-detail-toolbar">
            ${renderConnectorDetailActions(selected, shareLink)}
          </div>
        </div>
        <div class="connector-detail-section">
          <h4>Details</h4>
          <div class="connector-detail-grid">
            <div class="connector-detail-cell"><small>Purpose</small><strong>${escapeHtml(getConnectorPublicPurposeLabel(selected))}</strong></div>
            <div class="connector-detail-cell"><small>Type</small><strong>${escapeHtml(getConnectorDisplayUnitLayout(selected))}</strong></div>
            <div class="connector-detail-cell"><small>Category</small><strong>${escapeHtml(getConnectorDisplayPropertyCategory(selected))}</strong></div>
            ${selected.sourceType === 'property' && getConnectorPublicPurposeValue(selected) === 'sale' ? `<div class="connector-detail-cell"><small>Sale Status</small><strong>${escapeHtml(getConnectorSalePropertyStatus(selected) || '--')}</strong></div>` : ''}
            ${selected.sourceType === 'property' && getConnectorHandoverLabel(selected) ? `<div class="connector-detail-cell"><small>Expected Handover</small><strong>${escapeHtml(getConnectorHandoverLabel(selected))}</strong></div>` : ''}
            <div class="connector-detail-cell"><small>Location</small><strong>${escapeHtml(selected.location || '--')}</strong></div>
            <div class="connector-detail-cell"><small>Building / Project</small><strong>${escapeHtml(buildingLabel)}</strong></div>
            <div class="connector-detail-cell"><small>${escapeHtml(priceRowLabel)}</small><strong>${escapeHtml(priceLabel)}</strong></div>
            ${paymentMethod ? `<div class="connector-detail-cell"><small>Payment</small><strong>${escapeHtml(paymentMethod)}</strong></div>` : ''}
            <div class="connector-detail-cell"><small>Size</small><strong>${escapeHtml(selected.sizeLabel || '--')}</strong></div>
            ${selected.sourceType === 'property' && selected.isDistress ? `<div class="connector-detail-cell"><small>Distress Gap</small><strong>${escapeHtml(getConnectorDistressGapLabel(selected) || 'Add both market and asking prices to calculate distress gap.')}</strong></div>` : ''}
          </div>
        </div>
        <div class="connector-detail-section">
          <h4>Notes</h4>
          <div class="connector-detail-note">${escapeHtml(selected.publicNotes || 'No extra public note was shared for this record.')}</div>
        </div>
          <div class="connector-detail-section">
            <h4>Broker</h4>
            ${renderBcpBrokerIdentity(selected)}
            <div class="connector-detail-toolbar">
            ${renderConnectorReportButton({
              label: 'Report Broker',
              onClick: `openBrokerComplaint('${sectionName}', '${selected.id}')`,
              currentUserId: state.brokerProfile?.id || '',
              reportedUserId: selected.brokerUuid || '',
              targetType: 'broker',
              targetId: selected.brokerUuid || selected.brokerIdNumber || selected.id,
              selfDisabledText: 'You cannot report your own broker account.'
            })}
          </div>
        </div>
      `;
    }

    function renderRequirementsSheet(items, sectionName, startIndex) {
      const columns = CONNECTOR_TABLE_COLUMNS.requirements;
      return `
        <div class="public-sheet-head" style="grid-template-columns:${columns};">
          <div class="sheet-head-center">#</div>
          <div>Intent</div>
          <div>Location</div>
          <div>Building / Project</div>
          <div>Type</div>
          <div class="sheet-head-right">Budget</div>
          <div class="sheet-head-right">Updated</div>
          <div class="sheet-head-right">Open</div>
        </div>
        ${items.map((listing, index) => `
          <div class="public-row ${state.selectedPublicListingKeys[sectionName] === getPublicSelectionKey(sectionName, listing) ? 'is-selected' : ''}" data-listing-id="${listing.id}" onclick="selectPublicListing('${sectionName}', '${listing.id}')" style="grid-template-columns:${columns};">
            <div class="sheet-col sheet-col-center">
              <span class="sheet-label">#</span>
              <span class="sheet-index">${startIndex + index + 1}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Intent</span>
              <span class="sheet-primary">${listing.purpose === 'rent' ? 'My client is looking to rent' : 'My client is looking to buy'}</span>
              <span class="sheet-secondary is-rich">${renderBrokerActivityLine(listing)}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Location</span>
              <span class="sheet-primary">${listing.location || '--'}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Building / Project</span>
              <span class="sheet-primary">${listing.buildingLabel || listing.sizeLabel || '--'}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Type</span>
              <span class="sheet-primary">${getConnectorDisplayUnitLayout(listing)}</span>
              <span class="sheet-secondary">${escapeHtml(joinDisplayParts([
                getConnectorSalePropertyStatus(listing),
                getConnectorHandoverLabel(listing) ? `Handover ${getConnectorHandoverLabel(listing)}` : '',
                getConnectorDistressGapLabel(listing)
              ]) || '--')}</span>
            </div>
            <div class="sheet-col sheet-col-right">
              <span class="sheet-label">Budget</span>
              <span class="sheet-primary money-text">${formatConnectorMoney(listing.priceLabel)}</span>
            </div>
            <div class="sheet-col sheet-col-right">
              <span class="sheet-label">Updated</span>
              <span class="time-badge">${formatRelativeTimeLabel(listing.updatedAt || listing.createdAt)}</span>
            </div>
            ${buildPublicActionButtons(listing, sectionName)}
          </div>
        `).join('')}
      `;
    }

    function renderListingsSheet(items, sectionName, startIndex) {
      const columns = CONNECTOR_TABLE_COLUMNS.listings;
      return `
        <div class="public-sheet-head" style="grid-template-columns:${columns};">
          <div class="sheet-head-center">#</div>
          <div>Purpose</div>
          <div>Location</div>
          <div>Building / Project</div>
          <div>Type</div>
          <div class="sheet-head-right">Price</div>
          <div class="sheet-head-right">Size</div>
          <div class="sheet-head-right">Updated</div>
          <div class="sheet-head-right">Open</div>
        </div>
        ${items.map((listing, index) => `
          <div class="public-row ${listing.isDistress ? 'is-distress' : ''} ${state.selectedPublicListingKeys[sectionName] === getPublicSelectionKey(sectionName, listing) ? 'is-selected' : ''}" data-listing-id="${listing.id}" onclick="selectPublicListing('${sectionName}', '${listing.id}')" style="grid-template-columns:${columns};">
            <div class="sheet-col sheet-col-center">
              <span class="sheet-label">#</span>
              <span class="sheet-index">${startIndex + index + 1}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Purpose</span>
              <span class="sheet-primary">${getConnectorPublicPurposeLabel(listing).toUpperCase()} | ${getConnectorDisplayPropertyCategory(listing)}</span>
              <span class="sheet-secondary is-rich">${renderBrokerActivityLine(listing)}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Location</span>
              <span class="sheet-primary">${listing.location || '--'}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Building / Project</span>
              <span class="sheet-primary">${listing.buildingLabel || '--'}</span>
            </div>
            <div class="sheet-col">
              <span class="sheet-label">Type</span>
              <span class="sheet-primary">${getConnectorDisplayUnitLayout(listing)}</span>
            </div>
            <div class="sheet-col sheet-col-right">
              <span class="sheet-label">Price</span>
              <span class="sheet-primary money-text">${formatConnectorMoney(listing.priceLabel)}</span>
            </div>
            <div class="sheet-col sheet-col-right">
              <span class="sheet-label">Size</span>
              <span class="sheet-primary">${listing.sizeLabel || '--'}</span>
            </div>
            <div class="sheet-col sheet-col-right">
              <span class="sheet-label">Updated</span>
              <span class="time-badge">${formatRelativeTimeLabel(listing.updatedAt || listing.createdAt)}</span>
            </div>
            ${buildPublicActionButtons(listing, sectionName)}
          </div>
        `).join('')}
      `;
    }

    function renderSectionGrid(targetId, sectionName, items) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.classList.remove('is-loading');
      target.removeAttribute('aria-busy');
      if (!items.length) {
        target.innerHTML = `<div class="empty">No matching items are available in this section right now.</div>`;
        renderPager(sectionName, 0);
        const detailTargetId = sectionName === 'requirements' ? 'requirementsDetailPanel' : sectionName === 'marketplace' ? 'marketplaceDetailPanel' : 'distressDealsDetailPanel';
        renderConnectorDetailPanel(detailTargetId, sectionName, []);
        flushPublicSplitScroll(sectionName);
        return;
      }
      const sortedItems = sortPublicListings(items);
      const page = paginatePublicItems(sectionName, sortedItems);
      target.innerHTML = sectionName === 'requirements'
        ? renderRequirementsSheet(page.pageItems, sectionName, page.startIndex)
        : renderListingsSheet(page.pageItems, sectionName, page.startIndex);
      renderPager(sectionName, sortedItems.length);
      const detailTargetId = sectionName === 'requirements' ? 'requirementsDetailPanel' : sectionName === 'marketplace' ? 'marketplaceDetailPanel' : 'distressDealsDetailPanel';
      renderConnectorDetailPanel(detailTargetId, sectionName, sortedItems);
      flushPublicSplitScroll(sectionName);
    }
