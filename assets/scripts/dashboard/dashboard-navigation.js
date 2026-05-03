    function renderDashboardRulesPrompt() {
      const backdrop = document.getElementById('dashboardRulesPromptBackdrop');
      const card = document.getElementById('dashboardRulesPromptCard');
      if (!backdrop || !card) return;
      if (!state.rulesPromptOpen) {
        backdrop.classList.add('hidden');
        card.innerHTML = '';
        return;
      }
      const categories = (Array.isArray(PLATFORM_RULES.categories) ? PLATFORM_RULES.categories : []).slice(0, 4);
      backdrop.classList.remove('hidden');
      card.innerHTML = `
        <div class="complaint-center-head">
          <div class="complaint-center-head-copy">
            <h3 id="dashboardRulesPromptTitle">${escapeHtml(PLATFORM_RULES.promptTitle || 'Accept Platform Rules')}</h3>
      <p>${escapeHtml(PLATFORM_RULES.promptCopy || 'Before you publish records to NexBridge, confirm that you understand the platform conduct rules.')}</p>
          </div>
          <button class="btn btn-secondary btn-tiny" type="button" onclick="closeDashboardRulesPrompt()">Close</button>
        </div>
        <div class="rules-prompt-grid">
          ${categories.map(rule => `
            <div class="complaint-context-card">
              <div class="small">${escapeHtml(rule.title || 'Rule')}</div>
              <strong>${escapeHtml(rule.title || 'Rule')}</strong>
              <span>${escapeHtml(rule.description || '')}</span>
            </div>
          `).join('')}
        </div>
        ${renderPlatformRulesAgreementControl('dashboardSharePrompt', false, state.rulesPromptChecked, "state.rulesPromptChecked=this.checked")}
        <div class="complaint-modal-actions">
          <button class="btn btn-secondary" type="button" onclick="closeDashboardRulesPrompt()">Cancel</button>
          <button class="btn btn-primary" type="button" onclick="acceptDashboardRulesPrompt()">Accept and Continue</button>
        </div>
      `;
    }

    function closeDashboardRulesPrompt() {
      state.rulesPromptOpen = false;
      state.rulesPromptChecked = false;
      state.rulesPromptSource = '';
      state.pendingRulesShareAction = null;
      renderDashboardRulesPrompt();
      syncComplaintModalBodyLock();
    }

    function openDashboardRulesPromptForShare(entityType, id, listed, buttonCandidate = null) {
      state.rulesPromptOpen = true;
      state.rulesPromptChecked = false;
      state.rulesPromptSource = 'share';
      state.pendingRulesShareAction = { entityType, id, listed, buttonCandidate };
      renderDashboardRulesPrompt();
      syncComplaintModalBodyLock();
    }

    async function acceptDashboardRulesPrompt() {
      if (!state.rulesPromptChecked) {
        setStatus('Accept platform rules before sharing records publicly.', 'error');
        return;
      }
      const pending = state.pendingRulesShareAction;
      storePlatformRulesAcceptance('share-prompt');
      closeDashboardRulesPrompt();
      setStatus('Platform rules accepted for this broker session.', 'success');
      if (pending) {
        await proceedToggleListItem(pending.entityType, pending.id, pending.listed, pending.buttonCandidate);
      }
    }

    function initDashboardRulesPrompt() {
      const backdrop = document.getElementById('dashboardRulesPromptBackdrop');
      if (!backdrop || backdrop.dataset.ready === 'true') return;
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) {
          closeDashboardRulesPrompt();
        }
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.rulesPromptOpen) {
          closeDashboardRulesPrompt();
        }
      });
      backdrop.dataset.ready = 'true';
    }

    function getBrokerActivityStatusInfo(lastActivity) {
      const timestamp = normalizeText(lastActivity);
      const parsed = timestamp ? new Date(timestamp).getTime() : NaN;
      const ageMs = Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : 0;
      return { key: 'online', label: 'Online', dotClass: 'is-online', ageMs, isActive: true };
    }

    function formatBrokerActivityMeta(lastActivity) {
      const info = getBrokerActivityStatusInfo(lastActivity);
      if (info.key === 'online') return 'Online';
      if (info.key === 'active') return `Active ${formatCompactRelativeTime(lastActivity)}`;
      if (info.key === 'recent') return `Recently active ${formatCompactRelativeTime(lastActivity)}`;
      return 'Offline';
    }

    function renderBrokerActivityInline(lastActivity, fallbackLabel = '') {
      const info = getBrokerActivityStatusInfo(lastActivity);
      const label = fallbackLabel || formatBrokerActivityMeta(lastActivity);
      return `<span class="broker-activity-inline"><span class="broker-activity-dot ${info.dotClass}" aria-hidden="true"></span><span>${escapeHtml(label)}</span></span>`;
    }

    function closeBrokerActivityMenu() {
      const panel = document.getElementById('activeBrokersPanel');
      const button = document.getElementById('activeBrokersBtn');
      if (panel) panel.classList.add('hidden');
      if (button) button.setAttribute('aria-expanded', 'false');
    }

    function syncBrokerActivityIndicator() {
      const labelEl = document.getElementById('activeBrokersLabel');
      const metaEl = document.getElementById('activeBrokersMeta');
      const listEl = document.getElementById('activeBrokersList');
      const items = Array.isArray(state.brokerActivity?.brokers) ? state.brokerActivity.brokers : [];
      if (labelEl) {
        labelEl.textContent = 'Brokers Online';
      }
      if (metaEl) {
        metaEl.textContent = items.length ? `${items.length} brokers visible` : 'Live activity';
      }
      if (listEl) {
        listEl.innerHTML = items.length
          ? items.map(item => `
            <div class="activity-broker-row">
              <div class="activity-broker-copy">
                <strong>${escapeHtml(item.fullName || 'Broker')}</strong>
                <span>${escapeHtml(item.companyName || 'Broker account')}</span>
              </div>
              ${renderBrokerActivityInline(item.lastActivity)}
            </div>
          `).join('')
          : '<div class="activity-brokers-empty">No brokers are online or recently active right now.</div>';
      }
    }

    function toggleBrokerActivityMenu() {
      const panel = document.getElementById('activeBrokersPanel');
      const button = document.getElementById('activeBrokersBtn');
      if (!panel || !button) return;
      closeAccountMenu();
      closeNotificationPanel();
      const willOpen = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    function closeAccountMenu() {
      const panel = document.getElementById('accountMenuPanel');
      const button = document.getElementById('brokerIdentityBtn');
      if (panel) panel.classList.add('hidden');
      if (button) button.setAttribute('aria-expanded', 'false');
    }

    function toggleAccountMenu() {
      const panel = document.getElementById('accountMenuPanel');
      const button = document.getElementById('brokerIdentityBtn');
      if (!panel || !button) return;
      closeBrokerActivityMenu();
      closeNotificationPanel();
      const willOpen = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    function openProfilePage() {
      closeAccountMenu();
      openSection('profile');
      document.getElementById('profile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function openSettingsPage() {
      closeAccountMenu();
      openSection('settings');
      document.getElementById('settings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function setSettingsView(view) {
      state.settingsView = view;
      renderSettings();
    }

    function openProfileEditorFromSettings() {
      openProfilePage();
      beginProfileEdit();
    }

    function syncBrokerIdentityButtonLegacy() {
      const profile = getActiveBrokerProfile();
      const trigger = document.getElementById('brokerIdentityBtn');
      const avatar = document.getElementById('brokerIdentityAvatar');
      const name = document.getElementById('brokerIdentityName');
      const meta = document.getElementById('brokerIdentityMeta');
      if (!trigger || !avatar || !name || !meta) return;
      const fullName = profile.fullName || profile.companyName || 'Broker Account';
      const label = profile.brokerIdNumber ? `${fullName}` : fullName;
      const activityMeta = formatBrokerActivityMeta(profile.lastActivity || state.overview?.broker?.lastActivity || '');
      const metaText = `${profile.brokerIdNumber ? `Broker ID ${profile.brokerIdNumber}` : 'Broker Account'} • ${activityMeta}`;
      name.textContent = label;
      meta.textContent = metaText;
      if (profile.avatarDataUrl) {
        avatar.innerHTML = `<img src="${escapeHtml(profile.avatarDataUrl)}" alt="Broker profile picture">`;
      } else {
        avatar.textContent = getProfileInitials(fullName);
      }
    }

    function syncBrokerIdentityButton() {
      const profile = getActiveBrokerProfile();
      const trigger = document.getElementById('brokerIdentityBtn');
      const avatar = document.getElementById('brokerIdentityAvatar');
      const name = document.getElementById('brokerIdentityName');
      const meta = document.getElementById('brokerIdentityMeta');
      if (!trigger || !avatar || !name || !meta) return;
      const fullName = profile.fullName || profile.companyName || 'Broker Account';
      const activityInfo = getBrokerActivityStatusInfo(profile.lastActivity || state.overview?.broker?.lastActivity || '');
      const metaText = activityInfo.label || 'Offline';
      name.textContent = fullName;
      meta.textContent = metaText;
      trigger.title = `${fullName} · ${metaText}`;
      if (profile.avatarDataUrl) {
        avatar.innerHTML = `<img src="${escapeHtml(profile.avatarDataUrl)}" alt="Broker profile picture">`;
      } else {
        avatar.textContent = getProfileInitials(fullName);
      }
    }

    async function refreshBrokerActivityHeartbeat() {
      if (!state.token || document.hidden) return;
      try {
        const response = await fetch('/api/broker-dashboard', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ action: 'heartbeat' })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) return;
        if (result?.broker) {
          state.broker = { ...(state.broker || {}), ...result.broker };
          localStorage.setItem('broker_session_profile', JSON.stringify(state.broker));
        }
        state.brokerActivity = result?.brokerActivity || { activeCount: 0, brokers: [] };
        syncBrokerIdentityButton();
        syncBrokerActivityIndicator();
      } catch (error) {
        console.debug('Broker activity heartbeat skipped', error?.message || error);
      }
    }

    function startBrokerActivityHeartbeat() {
      if (brokerActivityHeartbeatTimer) {
        clearInterval(brokerActivityHeartbeatTimer);
      }
      brokerActivityHeartbeatTimer = window.setInterval(() => {
        refreshBrokerActivityHeartbeat();
      }, 90000);
    }

    async function verifySession() {
      if (!state.token) {
        window.location.href = 'index.html';
        return false;
      }

      const response = await fetch('/api/broker-auth', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.authenticated) {
        clearBrokerClientSessionStorage();
        window.location.href = 'index.html';
        return false;
      }

      state.broker = result.broker;
      localStorage.setItem('broker_session_profile', JSON.stringify(result.broker));
      syncBrokerIdentityButton();
      return true;
    }

    async function loadDashboard() {
      const response = await fetch('/api/broker-dashboard', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Dashboard load failed.');
      }

      state.overview = result.overview || null;
      state.leads = Array.isArray(result.leads) ? result.leads : [];
      state.properties = Array.isArray(result.properties) ? result.properties : [];
      state.followUps = Array.isArray(result.followUps) ? result.followUps : [];
      state.sharedListings = Array.isArray(result.sharedListings) ? result.sharedListings : [];
      state.masterDirectory = {
        locations: Array.isArray(result.masterDirectory?.locations) ? result.masterDirectory.locations : [],
        buildings: Array.isArray(result.masterDirectory?.buildings) ? result.masterDirectory.buildings : []
      };
      state.brokerActivity = result.brokerActivity || { activeCount: 0, brokers: [] };
      if (result.overview?.broker) {
        state.broker = { ...(state.broker || {}), ...result.overview.broker };
        localStorage.setItem('broker_session_profile', JSON.stringify(state.broker));
      }
      syncProfileStorage();
      syncBrokerIdentityButton();
      syncBrokerActivityIndicator();

      renderOverview();
      renderLeads();
      renderProperties();
      renderSharedListings();
      renderFollowups();
      renderProgress();
      renderProfile();
      renderComplaintCenter();
      renderSettings();
      populateFollowupEntities();
      await loadBrokerComplaints();
    }

    async function dashboardAction(payload, successMessage, options = {}) {
      const fallbackButton = options.button && !window.ActionFeedbackUi ? options.button : null;
      const fallbackOriginalText = fallbackButton ? fallbackButton.textContent : '';
      const execute = async () => {
        const response = await fetch('/api/broker-dashboard', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.message || 'Dashboard action failed.');
        }
        if (successMessage) setStatus(successMessage, 'success');
        await loadDashboard();
        return result;
      };

      if (window.ActionFeedbackUi && (options.button || options.loadingText)) {
        return window.ActionFeedbackUi.withActionFeedback(
          options.button,
          options.loadingText || 'Processing...',
          successMessage,
          execute,
          {
            showSuccessToast: Boolean(successMessage),
            showErrorToast: true,
            errorMessage: options.errorMessage || ''
          }
        );
      }

      try {
        if (fallbackButton) {
          fallbackButton.disabled = true;
          fallbackButton.dataset.loading = 'true';
          fallbackButton.textContent = options.loadingText || fallbackOriginalText || 'Processing...';
        }
        const startedAt = Date.now();
        const result = await execute();
        const minimumDuration = Math.max(0, Number(options.minimumDuration || 450));
        const elapsed = Date.now() - startedAt;
        if (elapsed < minimumDuration) {
          await new Promise(resolve => setTimeout(resolve, minimumDuration - elapsed));
        }
        return result;
      } finally {
        if (fallbackButton) {
          fallbackButton.disabled = false;
          delete fallbackButton.dataset.loading;
          fallbackButton.textContent = fallbackOriginalText || fallbackButton.textContent;
        }
      }
    }

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 5000) {
      const controller = new AbortController();
      let timer = null;
      try {
        timer = setTimeout(() => controller.abort(), timeoutMs);
        return await fetch(url, {
          ...options,
          signal: controller.signal
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function openSection(name) {
      closeAccountMenu();
      state.activeSection = name;
      document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
      document.querySelectorAll('.menu button').forEach(button => button.classList.remove('active'));
      const activeSection = document.getElementById(`${name}-section`);
      const mainPanel = document.querySelector('.app-shell > main.panel');
      activeSection?.classList.add('active');
      document.querySelector(`.menu button[data-section="${name}"]`)?.classList.add('active');
      if (name !== 'overview') {
        hideOverviewWorkspace();
        scrollPanelTopIntoView(mainPanel || activeSection, activeSection);
      } else {
        scrollPanelTopIntoView(mainPanel || activeSection, activeSection);
      }
    }

    function showOverviewWorkspace(type = 'lead') {
      openSection('overview');
      const shell = document.getElementById('overviewWorkspace');
      const leadCard = document.getElementById('overviewLeadCard');
      const propertyCard = document.getElementById('overviewPropertyCard');
      const title = document.getElementById('workspaceTitle');
      const copy = document.getElementById('workspaceCopy');
      if (!shell || !leadCard || !propertyCard || !title || !copy) return;

      const showLead = type === 'lead';
      shell.classList.add('active');
      leadCard.classList.toggle('hidden', !showLead);
      propertyCard.classList.toggle('hidden', showLead);
      if (showLead) {
        setLeadWorkspaceHeader(state.leadEditorOriginal ? 'edit' : 'create');
      } else {
        setPropertyWorkspaceHeader(state.propertyEditorOriginal ? 'edit' : 'create');
      }
      shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateOverviewActionState(type);
    }

    function hideOverviewWorkspace() {
      document.getElementById('overviewWorkspace')?.classList.remove('active');
      updateOverviewActionState('');
    }

    function updateOverviewActionState(activeType = '') {
      const leadButton = document.getElementById('newLeadActionBtn');
      const listingButton = document.getElementById('newListingActionBtn');
      if (!leadButton || !listingButton) return;

      const setButtonState = (button, isActive) => {
        button.classList.toggle('is-active', isActive);
        button.classList.toggle('is-idle', Boolean(activeType) && !isActive);
      };

      if (!activeType) {
        leadButton.classList.remove('is-active', 'is-idle');
        listingButton.classList.remove('is-active', 'is-idle');
        return;
      }

      setButtonState(leadButton, activeType === 'lead');
      setButtonState(listingButton, activeType === 'property');
    }

    function badgeClass(status) {
      const value = String(status || '').toLowerCase();
      if (['new', 'available', 'listed', 'open'].includes(value)) return 'badge-yellow';
      if (['contacted', 'demand confirmed', 'meeting scheduled', 'under negotiation', 'under review'].includes(value)) return 'badge-orange';
      if (['closed', 'resolved', 'verified'].includes(value)) return 'badge-green';
      if (['cancelled', 'rejected', 'blocked', 'unlisted', 'distress'].includes(value)) return 'badge-red';
      return 'badge-blue';
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
          item.rentPrice,
          item.ownerAskingPrice,
          item.price,
          item.size,
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

    function getFilteredDashboardItems(items, type) {
      const query = String(state.dashboardSearchQuery || '').trim().toLowerCase();
      if (!query) return [...items];
      return items.filter(item => getDashboardSearchText(item, type).includes(query));
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
        item.sourceType === 'lead' || item.leadType ? 'Broker Requirements' : 'NexBridge Listings',
          item.isDistress ? 'Distress Deals' : ''
        ].filter(Boolean).forEach(term => {
          if (String(term).toLowerCase().includes(normalized)) pool.add(String(term));
        });
      });
      return [...pool].slice(0, 8);
    }

    function renderDashboardSuggestions(query) {
      const target = document.getElementById('dashboardSearchSuggestions');
      const suggestions = buildDashboardSuggestions(query);
      if (!suggestions.length) {
        target.innerHTML = '';
        target.classList.add('hidden');
        return;
      }
      target.innerHTML = suggestions.map(term => `
        <button class="btn btn-secondary btn-tiny suggestion-chip" type="button" onclick="selectDashboardSuggestion('${term.replace(/'/g, '\\&#39;')}')">${term}</button>
      `).join('');
      target.classList.remove('hidden');
    }

    function applyDashboardSearch(query = document.getElementById('dashboardSearchInput').value) {
      state.dashboardSearchQuery = String(query || '').trim();
      document.getElementById('dashboardSearchInput').value = state.dashboardSearchQuery;
      renderDashboardSuggestions('');
      renderLeads();
      renderProperties();
      renderDistressDeals();
      renderSharedListings();
      renderFollowups();
      renderProgress();
      if (state.dashboardSearchQuery) {
        setStatus(`Showing CRM results for "${state.dashboardSearchQuery}".`, 'success');
      } else {
        setStatus('');
      }
    }

    function clearDashboardSearch() {
      state.dashboardSearchQuery = '';
      document.getElementById('dashboardSearchInput').value = '';
      renderDashboardSuggestions('');
      renderLeads();
      renderProperties();
      renderSharedListings();
      renderFollowups();
      renderProgress();
      setStatus('');
    }

    function selectDashboardSuggestion(term) {
      applyDashboardSearch(term);
    }

    function openOverviewCardSection(sectionName) {
      openSection(sectionName);
      scrollPanelTopIntoView(document.getElementById(`${sectionName}-section`));
    }

    function handleOverviewCardKeydown(event, sectionName) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOverviewCardSection(sectionName);
      }
    }
