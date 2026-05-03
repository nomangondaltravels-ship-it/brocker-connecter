    function renderPublicFallbackCards(targetId, items) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.classList.remove('is-loading');
      target.removeAttribute('aria-busy');
      if (!Array.isArray(items) || !items.length) {
        target.innerHTML = `<div class="empty">No matching items are available in this section right now.</div>`;
        return;
      }
      target.innerHTML = items.map((listing, index) => `
        <div class="listing-card" data-listing-id="${listing.id}">
          <div class="listing-top">
            <div class="listing-title">
              <h3>${escapeHtml((listing.sourceType === 'lead' ? 'Requirement' : 'Listing'))} ${index + 1}</h3>
              <div class="muted">${escapeHtml(getConnectorPublicPurposeLabel(listing).toUpperCase() || '--')} | ${escapeHtml(getConnectorDisplayPropertyCategory(listing))} | ${escapeHtml(getConnectorDisplayUnitLayout(listing))}</div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell">
              <small>Location</small>
              <strong>${escapeHtml(listing.location || '--')}</strong>
            </div>
            <div class="detail-cell">
              <small>Building / Project</small>
              <strong>${escapeHtml(listing.buildingLabel || '--')}</strong>
            </div>
            <div class="detail-cell">
              <small>${listing.sourceType === 'lead' ? 'Budget' : 'Price'}</small>
              <strong>${escapeHtml(listing.priceLabel || '--')}</strong>
            </div>
            <div class="detail-cell">
              <small>${listing.sourceType === 'lead' ? 'Type' : 'Category'}</small>
              <strong>${escapeHtml((listing.sourceType === 'lead' ? getConnectorDisplayUnitLayout(listing) : getConnectorDisplayPropertyCategory(listing)) || '--')}</strong>
            </div>
            ${listing.sourceType === 'property' ? `
            <div class="detail-cell">
              <small>Sale Status</small>
              <strong>${escapeHtml(getConnectorSalePropertyStatus(listing) || '--')}</strong>
            </div>
            ` : ''}
            ${listing.sourceType === 'property' && getConnectorHandoverLabel(listing) ? `
            <div class="detail-cell">
              <small>Expected Handover</small>
              <strong>${escapeHtml(getConnectorHandoverLabel(listing))}</strong>
            </div>
            ` : ''}
            ${listing.sourceType === 'property' && listing.isDistress ? `
            <div class="detail-cell">
              <small>Distress Gap</small>
              <strong>${escapeHtml(getConnectorDistressGapLabel(listing) || 'Add prices for gap')}</strong>
            </div>
            ` : ''}
          </div>
        </div>
      `).join('');
    }

    function renderPublicViewsFallback(error = null) {
      const filtered = getFilteredPublicListings();
      const requirements = filtered.filter(item => item.sourceType === 'lead');
      const marketplace = filtered.filter(item => item.sourceType === 'property');
      const distress = marketplace.filter(item => item.isDistress);
      updateStats();
      renderPublicFallbackCards('requirementsGrid', requirements);
      renderPublicFallbackCards('marketplaceGrid', marketplace);
      renderPublicFallbackCards('distressDealsGrid', distress);
      if (error) {
        console.error('BCP primary renderer failed, fallback view used.', error);
      }
    }

    function safeRenderPublicViews() {
      try {
        renderPublicViews();
      } catch (error) {
        try {
          populateConnectorFilterOptionsFallback();
        } catch (filterError) {
          console.error('BCP fallback filters could not render during safe render.', filterError);
        }
        renderPublicViewsFallback(error);
      }
    }

    function setPublicTabCount(target, value, isLoading = false) {
      if (!target) return;
      target.classList.toggle('is-loading', isLoading);
      target.classList.remove('is-error');
      target.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      target.removeAttribute('title');
      target.textContent = isLoading ? '...' : String(value);
    }

    function setPublicTabError(target) {
      if (!target) return;
      target.classList.remove('is-loading');
      target.classList.add('is-error');
      target.removeAttribute('aria-busy');
      target.setAttribute('title', 'Marketplace records could not load');
      target.textContent = '!';
    }

    function getPublicLoadErrorMessage(error) {
      if (typeof error === 'string' && error.trim()) {
        return error.trim();
      }
      return getUiErrorMessage(error, 'Marketplace records could not load. Please try again.');
    }

    function renderPublicLoadErrorPanel(targetId, sectionLabel, message) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.classList.remove('is-loading');
      target.removeAttribute('aria-busy');
      target.innerHTML = `
        <div class="public-load-state is-error">
          <div class="public-load-state-icon" aria-hidden="true">!</div>
          <div class="public-load-state-copy">
            <strong>${escapeHtml(sectionLabel)} could not load</strong>
            <span>${escapeHtml(message)}</span>
          </div>
          <button class="btn btn-primary btn-tiny" type="button" onclick="retryPublicListings()">Retry</button>
        </div>
      `;
    }

    function renderPublicLoadErrorState(error) {
      const message = getPublicLoadErrorMessage(error);
      state.publicListingsLoadError = message;
      state.publicListingsLoading = false;
      setPublicTabError(document.getElementById('tabCountRequirements'));
      setPublicTabError(document.getElementById('tabCountListings'));
      setPublicTabError(document.getElementById('tabCountDistress'));
      renderPublicLoadErrorPanel('requirementsGrid', 'Broker requirements', message);
      renderPublicLoadErrorPanel('marketplaceGrid', 'NexBridge listings', message);
      renderPublicLoadErrorPanel('distressDealsGrid', 'Distress deals', message);
      ['requirementsPager', 'marketplacePager', 'distressDealsPager'].forEach(id => {
        const pager = document.getElementById(id);
        if (pager) pager.classList.add('hidden');
      });
      [
        ['requirementsDetailPanel', 'requirements'],
        ['marketplaceDetailPanel', 'marketplace'],
        ['distressDealsDetailPanel', 'distress-deals']
      ].forEach(([targetId, sectionName]) => {
        renderConnectorDetailPanel(targetId, sectionName, []);
      });
    }

    function renderPublicLoadingRows(targetId, sectionName) {
      const target = document.getElementById(targetId);
      if (!target) return;
      const columns = sectionName === 'requirements'
        ? CONNECTOR_TABLE_COLUMNS.requirements
        : CONNECTOR_TABLE_COLUMNS.listings;
      const rowCount = sectionName === 'requirements' ? 4 : 5;
      target.classList.add('is-loading');
      target.setAttribute('aria-busy', 'true');
      target.innerHTML = `
        <div class="public-sheet-head public-skeleton-head" style="grid-template-columns:${columns};">
          <div class="public-skeleton-line short"></div>
          <div class="public-skeleton-line medium"></div>
          <div class="public-skeleton-line medium"></div>
          <div class="public-skeleton-line long"></div>
          <div class="public-skeleton-line short"></div>
          <div class="public-skeleton-line medium"></div>
          <div class="public-skeleton-line short"></div>
          <div class="public-skeleton-line short"></div>
          ${sectionName === 'requirements' ? '' : '<div class="public-skeleton-line short"></div>'}
        </div>
        ${Array.from({ length: rowCount }, () => `
          <div class="public-row public-skeleton-row" style="grid-template-columns:${columns};">
            <div class="public-skeleton-pill"></div>
            <div class="public-skeleton-cell">
              <div class="public-skeleton-line long"></div>
              <div class="public-skeleton-line medium"></div>
            </div>
            <div class="public-skeleton-cell">
              <div class="public-skeleton-line medium"></div>
              <div class="public-skeleton-line short"></div>
            </div>
            <div class="public-skeleton-cell">
              <div class="public-skeleton-line long"></div>
              <div class="public-skeleton-line medium"></div>
            </div>
            <div class="public-skeleton-cell">
              <div class="public-skeleton-line medium"></div>
            </div>
            <div class="public-skeleton-cell align-right">
              <div class="public-skeleton-line medium"></div>
            </div>
            <div class="public-skeleton-cell align-right">
              <div class="public-skeleton-line short"></div>
            </div>
            <div class="public-skeleton-cell align-right">
              <div class="public-skeleton-line short"></div>
            </div>
            ${sectionName === 'requirements' ? '' : `
              <div class="public-skeleton-cell align-right">
                <div class="public-skeleton-pill wide"></div>
              </div>
            `}
          </div>
        `).join('')}
      `;
    }

    function renderPublicLoadingState() {
      state.publicListingsLoadError = '';
      setPublicTabCount(document.getElementById('tabCountRequirements'), 0, true);
      setPublicTabCount(document.getElementById('tabCountListings'), 0, true);
      setPublicTabCount(document.getElementById('tabCountDistress'), 0, true);
      renderPublicLoadingRows('requirementsGrid', 'requirements');
      renderPublicLoadingRows('marketplaceGrid', 'marketplace');
      renderPublicLoadingRows('distressDealsGrid', 'distress-deals');
      ['requirementsPager', 'marketplacePager', 'distressDealsPager'].forEach(id => {
        const pager = document.getElementById(id);
        if (pager) pager.classList.add('hidden');
      });
    }

    function updateStats() {
      if (state.publicListingsLoadError && !state.publicListingsLoaded) {
        renderPublicLoadErrorState(state.publicListingsLoadError);
        return;
      }
      if (state.publicListingsLoading && !state.publicListingsLoaded) {
        renderPublicLoadingState();
        return;
      }
      const filtered = getFilteredPublicListings();
      const requirements = filtered.filter(item => item.sourceType === 'lead');
      const listings = filtered.filter(item => item.sourceType === 'property');
      const distress = listings.filter(item => item.isDistress);
      const requirementCount = document.getElementById('tabCountRequirements');
      const listingCount = document.getElementById('tabCountListings');
      const distressCount = document.getElementById('tabCountDistress');
      const toolbarMeta = document.getElementById('connectorToolbarMeta');
      setPublicTabCount(requirementCount, requirements.length);
      setPublicTabCount(listingCount, listings.length);
      setPublicTabCount(distressCount, distress.length);
      if (toolbarMeta) {
        toolbarMeta.textContent = '';
      }
    }

    function renderPublicViews() {
      if (state.publicListingsLoadError && !state.publicListingsLoaded) {
        renderPublicLoadErrorState(state.publicListingsLoadError);
        return;
      }
      if (state.publicListingsLoading && !state.publicListingsLoaded) {
        renderPublicLoadingState();
        return;
      }
      const filtered = getFilteredPublicListings();
      const requirements = filtered.filter(item => item.sourceType === 'lead');
      const marketplace = filtered.filter(item => item.sourceType === 'property');
      const distress = marketplace.filter(item => item.isDistress);
      updateStats();
      renderSectionGrid('requirementsGrid', 'requirements', requirements);
      renderSectionGrid('marketplaceGrid', 'marketplace', marketplace);
      renderSectionGrid('distressDealsGrid', 'distress-deals', distress);
    }

    async function loadPublicListings(options = {}) {
      const shouldShowLoading = options.showLoading !== false || !state.publicListingsLoaded;
      state.publicListingsLoading = true;
      state.publicListingsLoadError = '';
      if (shouldShowLoading) {
        renderPublicLoadingState();
      }
      let result = {};
      try {
        const response = await fetch('/api/public-marketplace', {
          headers: state.sessionToken
            ? {
                Authorization: `Bearer ${state.sessionToken}`
              }
            : {}
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.message || 'NexBridge Marketplace could not load.');
        }
      } catch (error) {
        state.publicListingsLoading = false;
        if (!state.publicListingsLoaded || options.showErrorState) {
          renderPublicLoadErrorState(error);
        }
        throw error;
      }
      state.listings = Array.isArray(result.listings) ? result.listings : [];
      state.publicListingsLoaded = true;
      state.publicListingsLoading = false;
      state.publicListingsLoadError = '';
      try {
        populateConnectorFilterOptions();
        renderPublicViews();
        revealSharedListingFromUrl();
      } catch (error) {
        try {
          populateConnectorFilterOptionsFallback();
        } catch (filterError) {
          console.error('BCP filter fallback failed.', filterError);
        }
        renderPublicViewsFallback(error);
      }
    }

    async function retryPublicListings() {
      setSystemBanner('');
      try {
        await loadPublicListings({ showLoading: true, showErrorState: true });
        restoreMarketplaceContactRevealIfNeeded();
      } catch (error) {
        showSystemError(error, 'Marketplace records could not load.');
      }
    }

    if (state.publicListingsLoading && !state.publicListingsLoaded) {
      renderPublicLoadingState();
    }

    async function runPublicInitStep(label, handler, { silent = true } = {}) {
      try {
        return await handler();
      } catch (error) {
        console.error(`BCP init step failed: ${label}`, error);
        if (!silent) {
          showSystemError(error, `Could not complete ${label}.`);
        }
        return null;
      }
    }

    function positionFloatingCard(button, card) {
      const rect = button.getBoundingClientRect();
      const cardWidth = card.offsetWidth;
      const left = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, rect.left + (rect.width / 2) - (cardWidth / 2)));
      const top = Math.max(12, rect.top - card.offsetHeight - 10);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }

    function closeAllPopovers() {
      document.getElementById('sharePopover').classList.remove('active');
      document.getElementById('contactPopover').classList.remove('active');
    }

    function showSharePopover(button, link) {
      closeAllPopovers();
      state.shareLink = link;
      const popover = document.getElementById('sharePopover');
      const card = document.getElementById('shareCard');
      const anchor = document.getElementById('shareLink');
      anchor.href = link;
      anchor.textContent = link;
      popover.classList.add('active');
      positionFloatingCard(button, card);
    }

    async function copyShareLink() {
      await navigator.clipboard.writeText(state.shareLink || '');
      setSystemBanner('Listing link copied successfully.', 'success');
      closeAllPopovers();
    }

    function showContactPopover(button, phone) {
      closeAllPopovers();
      state.contactPhone = formatPhoneDisplay(phone);
      document.getElementById('contactValue').textContent = state.contactPhone;
      document.getElementById('callNowBtn').onclick = () => {
        window.location.href = `tel:${normalizePhoneNumber(phone)}`;
      };
      const popover = document.getElementById('contactPopover');
      const card = document.getElementById('contactCard');
      popover.classList.add('active');
      positionFloatingCard(button, card);
    }

    async function copyContactNumber() {
      await navigator.clipboard.writeText(state.contactPhone || '');
      setSystemBanner('Broker number copied.', 'success');
      closeAllPopovers();
    }

    function showWhatsappPopover(button, phone, encodedText) {
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        setSystemBanner('WhatsApp number is not available for this broker.', 'error');
        return;
      }
      const text = decodeURIComponent(encodedText || '');
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        window.location.href = url;
      }
    }

    function sendMatchInterest(phone, encodedText) {
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        setSystemBanner('WhatsApp number is not available for this broker.', 'error');
        return;
      }
      const text = decodeURIComponent(encodedText || '');
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        window.location.href = url;
      }
    }

    Object.assign(window, {
      openRecordComplaint,
      openBrokerComplaint,
      openAuthRequiredModal,
      openConnectorWhatsappContactById,
      openConnectorWhatsappContact,
      openProtectedCallPopoverById,
      sendProtectedMatchInterest,
      showContactPopover,
      copyContactNumber,
      closeAllPopovers
    });

    function revealSharedListingFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      const listingId = params.get('listing');
      if (!listingId) return;
      const normalizedSection = section === 'shared-leads' ? 'requirements' : section;
      if (normalizedSection && normalizedSection !== state.activeSection) {
        document.getElementById(`${normalizedSection}-section`)?.classList.add('active');
        openSection(normalizedSection, { preserveRevealParams: true });
      }
      if (normalizedSection) {
        state.selectedPublicListingKeys[normalizedSection] = `${normalizedSection}:${listingId}`;
        safeRenderPublicViews();
        clearMarketplaceRevealParams(normalizedSection);
      }
      const target = document.querySelector(`[data-listing-id="${listingId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.borderColor = 'rgba(212,175,55,0.46)';
      }
    }
