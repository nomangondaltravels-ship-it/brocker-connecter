    function normalizeAdminText(value) {
      return String(value || '').trim().toLowerCase();
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatAdminDateTime(value) {
      const timestamp = Date.parse(String(value || ''));
      if (!Number.isFinite(timestamp)) return 'â€”';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(timestamp));
    }

    function getBrokerSummary(account) {
      if (account?.summary && Number.isFinite(Number(account.summary.requirementCount)) && Number.isFinite(Number(account.summary.listingCount))) {
        return {
          requirementCount: Number(account.summary.requirementCount || 0),
          listingCount: Number(account.summary.listingCount || 0),
          sharedCount: Number(account.summary.sharedCount || 0)
        };
      }

      const brokerName = normalizeAdminText(account?.name);
      const brokerPhone = normalizeAdminText(account?.phone);
      const requirementCount = requirements.filter(item => {
        const itemBroker = normalizeAdminText(item?.broker);
        const itemPhone = normalizeAdminText(item?.phone);
        return (brokerPhone && itemPhone && brokerPhone === itemPhone) || (brokerName && itemBroker === brokerName);
      }).length;
      const listingCount = deals.filter(item => {
        const itemBroker = normalizeAdminText(item?.broker);
        const itemPhone = normalizeAdminText(item?.phone);
        return (brokerPhone && itemPhone && brokerPhone === itemPhone) || (brokerName && itemBroker === brokerName);
      }).length;
      return {
        requirementCount,
        listingCount,
        sharedCount: requirementCount + listingCount
      };
    }

    function getBrokerAccountStatus(account) {
      if (account?.blocked) return { label: 'Blocked', tone: 'red' };
      if (account?.approved) return { label: 'Active', tone: 'green' };
      return { label: 'Pending', tone: 'gold' };
    }

    function readAdminFilters() {
      adminUiState.search = document.getElementById('adminSearchInput')?.value || '';
      adminUiState.verification = document.getElementById('adminVerificationFilter')?.value || 'all';
      adminUiState.account = document.getElementById('adminAccountFilter')?.value || 'all';
      adminUiState.queue = document.getElementById('adminQueueFilter')?.value || 'all';
    }

    function getComplaintQueueFilterValue() {
      const globalQueue = String(adminUiState.queue || 'all');
      if (['new', 'under-review', 'resolved', 'rejected'].includes(globalQueue)) {
        return globalQueue;
      }
      return String(adminUiState.complaintQueue || 'all');
    }

    function setComplaintQueueFilter(value) {
      adminUiState.complaintQueue = ['all', 'new', 'under-review', 'resolved', 'rejected'].includes(String(value || ''))
        ? String(value || 'all')
        : 'all';
      const globalQueue = document.getElementById('adminQueueFilter');
      if (globalQueue && ['new', 'under-review', 'resolved', 'rejected'].includes(String(globalQueue.value || ''))) {
        globalQueue.value = 'all';
        adminUiState.queue = 'all';
      }
      renderAdminWorkspace();
    }

    function jumpToComplaintReview() {
      const target = document.getElementById('complaintReviewSection');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function jumpToSupportInbox() {
      const target = document.getElementById('supportInboxSection');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      adminUiState.supportRequested = true;
      ensureSupportRequestsLoaded();
    }

    function jumpToCompanySuggestions() {
      const target = document.getElementById('companySuggestionsSection');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      adminUiState.companiesRequested = true;
      ensureCompanySuggestionsLoaded();
    }

    async function ensureSupportRequestsLoaded(force = false) {
      if ((adminUiState.supportLoaded && !force) || adminUiState.supportLoading) return;
      adminUiState.supportLoading = true;
      renderAdminWorkspace();
      try {
        supportRequests = await fetchAdminSupportRequests();
        adminUiState.supportLoaded = true;
        if (document.getElementById('adminStatus')?.textContent.includes('Support inbox')) {
          setAdminStatus('');
        }
      } catch (error) {
        console.error(error);
        supportRequests = [];
        adminUiState.supportLoaded = true;
        setAdminStatus(error?.message || 'Support inbox could not load.', 'error');
      }
      adminUiState.supportLoading = false;
      renderAdminWorkspace();
    }

    async function ensureCompanySuggestionsLoaded(force = false) {
      if ((adminUiState.companiesLoaded && !force) || adminUiState.companyLoading) return;
      adminUiState.companyLoading = true;
      renderAdminWorkspace();
      try {
        const companyResult = await fetchAdminCompanySuggestions();
        approvedCompanySuggestions = companyResult.approvedCompanies || [];
        pendingCompanySuggestions = companyResult.pendingCompanies || [];
        adminUiState.companiesLoaded = true;
      } catch (error) {
        console.error(error);
        approvedCompanySuggestions = [];
        pendingCompanySuggestions = [];
        adminUiState.companiesLoaded = true;
        setAdminStatus(error?.message || 'Company suggestions could not load.', 'error');
      }
      adminUiState.companyLoading = false;
      renderAdminWorkspace();
    }

    function normalizeSupportStatus(value) {
      const normalized = String(value || 'new').trim().toLowerCase();
      if (normalized === 'in progress') return 'in_progress';
      if (normalized === 'resolved') return 'resolved';
      return normalized === 'in_progress' ? 'in_progress' : 'new';
    }

    function getSupportStatusMeta(value) {
      const normalized = normalizeSupportStatus(value);
      if (normalized === 'resolved') return { label: 'Resolved', tone: 'green' };
      if (normalized === 'in_progress') return { label: 'In Progress', tone: 'blue' };
      return { label: 'New', tone: 'gold' };
    }

    function getFilteredPendingCompanySuggestions() {
      const search = normalizeAdminText(adminUiState.search);
      const rows = pendingCompanySuggestions.filter(item => String(item?.status || '').toLowerCase() === 'pending');
      if (!search) return rows;
      return rows.filter(item => {
        const haystack = [
          item?.name,
          item?.source,
          item?.submitted_by_user_id
        ].map(normalizeAdminText).join(' ');
        return haystack.includes(search);
      });
    }

    function renderComplaintFilterMenu(activeValue, complaintEntries) {
      const menu = document.getElementById('complaintFilterMenu');
      const summary = document.getElementById('complaintFilterSummary');
      if (menu) {
        const countByStatus = complaintEntries.reduce((accumulator, entry) => {
          const key = String(entry?.status || 'new');
          accumulator[key] = (accumulator[key] || 0) + 1;
          return accumulator;
        }, {});
        menu.innerHTML = getComplaintQueueOptions().map(option => {
          const isActive = option.value === activeValue;
          const count = option.value === 'all'
            ? complaintEntries.length
            : (countByStatus[option.value] || 0);
          return `
            <button class="btn btn-secondary tiny-btn admin-complaint-filter-btn${isActive ? ' is-active' : ''}" type="button" onclick="setComplaintQueueFilter('${escapeHtml(option.value)}')">
              ${escapeHtml(option.label)} <span class="badge ${isActive ? 'blue' : 'gold'}">${count}</span>
            </button>
          `;
        }).join('');
      }

      if (summary) {
        const activeLabel = getComplaintQueueOptions().find(option => option.value === activeValue)?.label || 'All';
        summary.textContent = activeValue === 'all'
          ? `Showing all ${complaintEntries.length} complaint records.`
          : `Showing ${complaintEntries.length} ${activeLabel.toLowerCase()} complaint record${complaintEntries.length === 1 ? '' : 's'}.`;
      }
    }

    function getRequirementEntries() {
      return requirements.map((item, index) => ({
        type: 'requirement',
        key: getEntryKey(item, false),
        index,
        status: getPostStatus(item, false),
        item
      }));
    }

    function getDealEntries() {
      return deals.map((item, index) => ({
        type: 'deal',
        key: getEntryKey(item, true),
        index,
        status: getPostStatus(item, true),
        item
      }));
    }

    function getComplaintEntries() {
      return complaints.map((item, index) => ({
        type: 'complaint',
        key: String(item?.id || `${item?.broker || 'complaint'}-${index}`),
        index,
        status: item?.normalizedStatus || 'new',
        item
      }));
    }

    function getFilteredAdminCollections() {
      readAdminFilters();
      const search = normalizeAdminText(adminUiState.search);
      const verification = adminUiState.verification;
      const accountState = adminUiState.account;
      const queue = adminUiState.queue;
      const complaintQueue = getComplaintQueueFilterValue();

      const brokers = adminBrokerAccounts
        .map(account => ({
          ...account,
          type: 'broker',
          key: String(account?.brokerId || account?.id || ''),
          summary: getBrokerSummary(account),
          accountMeta: getBrokerAccountStatus(account)
        }))
        .filter(account => {
          if (verification === 'verified' && !account.approved) return false;
          if (verification === 'unverified' && account.approved) return false;
          if (accountState === 'active' && account.blocked) return false;
          if (accountState === 'blocked' && !account.blocked) return false;
          if (accountState === 'pending' && (account.blocked || account.approved)) return false;
          if (!search) return true;
          const haystack = [
            account.name,
            account.brokerId,
            account.email,
            account.phone,
            account.company
          ].map(normalizeAdminText).join(' ');
          return haystack.includes(search);
        });

      const requirementsList = getRequirementEntries().filter(entry => {
        if (queue !== 'all' && ['open', 'matched', 'closed', 'expired'].includes(queue) && entry.status !== queue) {
          return false;
        }
        if (!search) return true;
        const haystack = [
          entry.item.broker,
          entry.item.phone,
          entry.item.purpose,
          entry.item.category,
          entry.item.location,
          entry.item.budget,
          entry.item.notes
        ].map(normalizeAdminText).join(' ');
        return haystack.includes(search);
      });

      const dealsList = getDealEntries().filter(entry => {
        if (queue !== 'all' && ['open', 'matched', 'closed', 'expired'].includes(queue) && entry.status !== queue) {
          return false;
        }
        if (!search) return true;
        const haystack = [
          entry.item.broker,
          entry.item.phone,
          entry.item.purpose,
          entry.item.category,
          entry.item.location,
          entry.item.budget,
          entry.item.notes,
          entry.item.distress ? 'distress' : ''
        ].map(normalizeAdminText).join(' ');
        return haystack.includes(search);
      });

      const complaintList = getComplaintEntries().filter(entry => {
        if (complaintQueue !== 'all' && entry.status !== complaintQueue) {
          return false;
        }
        if (!search) return true;
        const haystack = [
          entry.item.name,
          entry.item.broker,
          entry.item.displayMessage,
          entry.item.reporterEmail,
          entry.item.reporterName,
          entry.item.targetId,
          entry.item.targetLabel,
          entry.item.reason,
          entry.item.reportedBrokerName
        ].map(normalizeAdminText).join(' ');
        return haystack.includes(search);
      });

      return {
        brokers,
        requirements: requirementsList,
        deals: dealsList,
        complaints: complaintList
      };
    }

    function ensureAdminSelection(collections) {
      const selectionExists =
        (adminUiState.selectedType === 'broker' && collections.brokers.some(item => item.key === adminUiState.selectedKey)) ||
        (adminUiState.selectedType === 'requirement' && collections.requirements.some(item => item.key === adminUiState.selectedKey)) ||
        (adminUiState.selectedType === 'deal' && collections.deals.some(item => item.key === adminUiState.selectedKey)) ||
        (adminUiState.selectedType === 'complaint' && collections.complaints.some(item => item.key === adminUiState.selectedKey));

      if (selectionExists) return;

      adminUiState.selectedType = 'broker';
      adminUiState.selectedKey = '';
    }

    function setAdminSelection(type, key) {
      queueAdminDetailScroll('open', type, key);
      adminUiState.selectedType = type;
      adminUiState.selectedKey = String(key || '');
      renderAdminWorkspace();
    }

    function queueAdminDetailScroll(mode, type, key) {
      adminUiState.pendingDetailScroll = {
        mode,
        type: String(type || ''),
        key: String(key || '')
      };
      if (mode === 'restore' && type) {
        adminUiState.selectedRowMemory[String(type || '')] = String(key || '');
      }
    }

    function scrollAdminDetailTopIntoView(panel, fallbackTarget = null) {
      const target = panel || fallbackTarget;
      if (!target) return;
      const topOffset = 92;
      const absoluteTop = window.scrollY + target.getBoundingClientRect().top - topOffset;
      window.scrollTo({
        top: Math.max(0, absoluteTop),
        behavior: 'smooth'
      });
    }

    function flushAdminDetailScroll() {
      const intent = adminUiState.pendingDetailScroll;
      if (!intent) return;
      adminUiState.pendingDetailScroll = null;
      requestAnimationFrame(() => {
        const grid = document.getElementById('adminMainGrid');
        const panel = document.getElementById('adminDetailStack') || document.getElementById('adminDetailPanel');
        const row = intent.key ? document.querySelector(`[data-admin-row-key="${intent.key}"]`) : null;
        if (intent.mode === 'open') {
          if (intent.type === 'broker' || intent.type === 'complaint') {
            return;
          }
          scrollAdminDetailTopIntoView(panel, grid);
          return;
        }
        if (intent.mode === 'restore' && row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function clearAdminSelection() {
      queueAdminDetailScroll('restore', adminUiState.selectedType, adminUiState.selectedKey);
      adminUiState.selectedType = 'broker';
      adminUiState.selectedKey = '';
      renderAdminWorkspace();
    }

    function syncAdminModalBodyLock() {
      const brokerBackdrop = document.getElementById('brokerAccountModalBackdrop');
      const complaintBackdrop = document.getElementById('complaintReviewModalBackdrop');
      const confirmBackdrop = document.getElementById('complaintActionConfirmBackdrop');
      const adminActionBackdrop = document.getElementById('adminActionConfirmBackdrop');
      const hasVisibleModal = (brokerBackdrop && !brokerBackdrop.classList.contains('hidden'))
        || (complaintBackdrop && !complaintBackdrop.classList.contains('hidden'))
        || (confirmBackdrop && !confirmBackdrop.classList.contains('hidden'))
        || (adminActionBackdrop && !adminActionBackdrop.classList.contains('hidden'));
      document.body.classList.toggle('admin-modal-open', Boolean(hasVisibleModal));
    }

    function renderBrokerDetailMarkup(account, closeHandler = 'clearAdminSelection()') {
      const approved = Boolean(account.approved);
      const blocked = Boolean(account.blocked);
      return `
        <div class="admin-detail-header">
          <div class="admin-detail-head-row">
            <div class="admin-detail-copy">Broker Account</div>
            <button class="btn btn-secondary tiny-btn" type="button" onclick="${closeHandler}">Close</button>
          </div>
          <h3 id="brokerAccountModalTitle">${escapeHtml(account.name || 'Broker')}</h3>
          <div class="admin-detail-meta">
            <span class="badge ${approved ? 'green' : 'gold'}">${approved ? 'Verified' : 'Pending'}</span>
            <span class="badge ${blocked ? 'red' : 'blue'}">${blocked ? 'Blocked' : 'Active'}</span>
            <span class="badge blue">${escapeHtml(account.brokerId || 'No Broker ID')}</span>
          </div>
          <div class="admin-detail-toolbar">
            <button class="btn btn-secondary tiny-btn" type="button" onclick="toggleBrokerApproval('${escapeHtml(account.brokerId)}')">${approved ? 'Remove Verification' : 'Verify Broker'}</button>
            <button class="btn ${blocked ? 'btn-secondary' : 'btn-danger'} tiny-btn" type="button" onclick="toggleBrokerBlock('${escapeHtml(account.brokerId)}')">${blocked ? 'Unblock Broker' : 'Block Broker'}</button>
            <button class="btn btn-secondary tiny-btn" type="button" onclick="updateBrokerId('${escapeHtml(account.brokerId)}')">Edit Broker ID</button>
            <button class="btn btn-secondary tiny-btn" type="button" onclick="updateBrokerPassword('${escapeHtml(account.brokerId)}')">Change Password</button>
            <button class="btn btn-danger tiny-btn" type="button" onclick="deleteBrokerAccount('${escapeHtml(account.brokerId)}')">Delete Broker</button>
          </div>
        </div>
        <div class="admin-detail-section">
          <h4>Account Overview</h4>
          <div class="admin-detail-grid">
            <div class="admin-detail-cell"><small>Email</small><strong>${escapeHtml(account.email || 'No email')}</strong></div>
            <div class="admin-detail-cell"><small>Phone</small><strong>${escapeHtml(account.phone || 'No phone')}</strong></div>
            <div class="admin-detail-cell"><small>Company</small><strong>${escapeHtml(account.company || 'â€”')}</strong></div>
            <div class="admin-detail-cell"><small>Joined</small><strong>${escapeHtml(formatAdminDateTime(account.createdAt))}</strong></div>
          </div>
        </div>
        <div class="admin-detail-section">
          <h4>Marketplace Activity</h4>
          <div class="admin-detail-grid">
            <div class="admin-detail-cell"><small>Requirements</small><strong>${account.summary.requirementCount}</strong></div>
            <div class="admin-detail-cell"><small>Listings</small><strong>${account.summary.listingCount}</strong></div>
            <div class="admin-detail-cell"><small>Total Shared</small><strong>${account.summary.sharedCount}</strong></div>
            <div class="admin-detail-cell"><small>Access State</small><strong>${blocked ? 'Blocked from sign in and posting' : approved ? 'Active and verified' : 'Awaiting verification'}</strong></div>
          </div>
        </div>
      `;
    }

    function renderBrokerAccountModal(account = null) {
      const backdrop = document.getElementById('brokerAccountModalBackdrop');
      const content = document.getElementById('brokerAccountModalContent');
      if (!backdrop || !content) return;
      if (!account) {
        backdrop.classList.add('hidden');
        content.innerHTML = '';
        syncAdminModalBodyLock();
        return;
      }
      content.innerHTML = renderBrokerDetailMarkup(account, 'clearAdminSelection()');
      backdrop.classList.remove('hidden');
      syncAdminModalBodyLock();
    }

    function initBrokerAccountModal() {
      const backdrop = document.getElementById('brokerAccountModalBackdrop');
      const dialog = document.getElementById('brokerAccountModalDialog');
      if (!backdrop || !dialog || backdrop.dataset.ready === 'true') return;
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) clearAdminSelection();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !backdrop.classList.contains('hidden')) {
          clearAdminSelection();
        }
      });
      backdrop.dataset.ready = 'true';
    }

    function renderComplaintHistoryMarkup(item) {
      const historyEntries = getComplaintHistoryEntries(item);
      if (!historyEntries.length) {
        return '<div class="admin-detail-note">No earlier complaint history exists for this broker.</div>';
      }
      return `
        <div class="admin-complaint-history">
          ${historyEntries.slice(0, 6).map(historyItem => {
            const statusMeta = getComplaintStatusMeta(historyItem.normalizedStatus);
            const actionLabel = getComplaintActionLabel(historyItem.actionTaken);
            const notePreview = historyItem.displayMessage || historyItem.message || 'No complaint details provided.';
            return `
              <div class="admin-complaint-history-item">
                <div class="admin-complaint-history-head">
                  <strong>${escapeHtml(String(historyItem.id || 'Complaint'))}</strong>
                  <div class="admin-detail-meta">
                    <span class="badge ${statusMeta.tone}">${statusMeta.label}</span>
                    <span class="badge ${getComplaintActionTone(historyItem.actionTaken)}">${escapeHtml(actionLabel)}</span>
                  </div>
                </div>
                <p>${escapeHtml(notePreview)}</p>
                <div class="admin-complaint-note-meta">
                  <span>${escapeHtml(formatAdminDateTime(historyItem.created_at))}</span>
                  <span>${escapeHtml(historyItem.reason || 'Other')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderComplaintDetailMarkup(entry, closeHandler = 'clearAdminSelection()') {
      const item = entry.item;
      const statusMeta = getComplaintStatusMeta(item.normalizedStatus);
      const linkedBrokerId = findBrokerIdByComplaint(item);
      const reporterName = item.reporterName || item.name || 'Anonymous';
      const reporterEmail = item.reporterEmail || 'No reporter email';
      const reporterRef = item.reporterBrokerId || item.reporterUserId || 'No account linked';
      const reportedName = item.reportedBrokerName || item.broker || 'Reported user not linked';
      const reportedRef = linkedBrokerId || item.reportedBrokerIdNumber || item.reportedUserId || 'No linked broker ID';
      const targetTypeLabel = getComplaintTargetLabel(item);
      const targetId = item.targetId || item.listingId || item.requirementId || 'Not linked';
      const cleanedTargetId = String(targetId || '').includes('Ã¢') ? 'Not linked' : targetId;
      const complaintLabel = String(item.id || '').trim() || 'Not linked';
      const targetLabel = item.targetLabel || `${targetTypeLabel} ${cleanedTargetId}`.trim();
      const complaintText = item.displayMessage || item.message || 'No complaint message provided.';
      const suggestedActionLabel = getComplaintActionLabel(item.suggestedAction || item.repeatOffenseLevel || 'none');
      const resolvedValidCount = Number(item.resolvedValidComplaintCount || 0);
      const nextValidCount = Number(item.nextValidComplaintCount || (resolvedValidCount ? resolvedValidCount + 1 : 1));
      const isBusy = Boolean(adminUiState.complaintActionBusy);
      const recommendationBadge = item.seriousReason
        ? (suggestedActionLabel + ' - ' + (item.seriousReasonLabel || 'Serious reason'))
        : suggestedActionLabel;
      const displayRecommendationBadge = recommendationBadge;
      const canManageBroker = Boolean(linkedBrokerId || item.reportedBrokerId || item.reportedUserId);
      const canDeleteListing = String(item.targetType || '').trim().toLowerCase() === 'listing' || Number(item.listingId || 0) > 0;
      const canDeleteRequirement = String(item.targetType || '').trim().toLowerCase() === 'requirement' || Number(item.requirementId || 0) > 0;
      return `
        <div class="admin-complaint-modal">
          <div class="admin-complaint-modal-top">
            <div class="admin-detail-header admin-complaint-header">
              <div class="admin-detail-head-row">
                <div class="admin-detail-copy">Complaint Review</div>
                <button class="btn btn-secondary tiny-btn" type="button" onclick="${closeHandler}">Close</button>
              </div>
              <h3 id="complaintReviewModalTitle">Complaint #${escapeHtml(complaintLabel)}</h3>
              <div class="admin-detail-meta">
                <span class="badge ${statusMeta.tone}">${statusMeta.label}</span>
                <span class="badge blue">${escapeHtml(targetTypeLabel)}</span>
                <span class="badge ${getComplaintActionTone(item.actionTaken)}">${escapeHtml(getComplaintActionLabel(item.actionTaken))}</span>
                ${isBusy ? '<span class="badge gold">Saving...</span>' : ''}
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-actions">
              <div class="admin-complaint-action-groups">
                <div class="admin-complaint-action-group">
                  <h4>Status</h4>
                  <div class="admin-detail-toolbar admin-complaint-toolbar">
                    <button class="btn btn-orange tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'under-review')" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Saving...' : 'Mark Under Review'}</button>
                    <button class="btn btn-success tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'resolved')" ${isBusy ? 'disabled' : ''}>Resolve Complaint</button>
                    <button class="btn btn-danger tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'rejected')" ${isBusy ? 'disabled' : ''}>Reject Complaint</button>
                  </div>
                </div>
                <div class="admin-complaint-action-group">
                  <h4>Admin Actions</h4>
                  <div class="admin-complaint-action-row">
                    ${canManageBroker ? `<button class="btn btn-secondary tiny-btn" type="button" onclick="handleComplaintAdminAction(${entry.index}, 'warning')" ${isBusy ? 'disabled' : ''}>Send Warning</button>` : ''}
                    ${canManageBroker ? `<button class="btn btn-secondary tiny-btn" type="button" onclick="handleComplaintAdminAction(${entry.index}, 'restrict', { destructive: true, title: 'Restrict broker visibility', description: 'This will remove the broker public visibility from Broker Connector surfaces.' })" ${isBusy ? 'disabled' : ''}>Restrict Broker</button>` : ''}
                    ${canManageBroker ? `<button class="btn btn-danger tiny-btn" type="button" onclick="handleComplaintAdminAction(${entry.index}, 'block', { destructive: true, title: 'Block broker account', description: 'This will block the linked broker account and remove public visibility from Broker Connector.' })" ${isBusy ? 'disabled' : ''}>Block Broker</button>` : ''}
                    ${canDeleteListing ? `<button class="btn btn-danger tiny-btn" type="button" onclick="handleComplaintAdminAction(${entry.index}, 'delete_listing', { destructive: true, title: 'Delete linked listing', description: 'This will permanently remove the linked listing from broker inventory and public Broker Connector views.' })" ${isBusy ? 'disabled' : ''}>Delete Listing</button>` : ''}
                    ${canDeleteRequirement ? `<button class="btn btn-danger tiny-btn" type="button" onclick="handleComplaintAdminAction(${entry.index}, 'delete_requirement', { destructive: true, title: 'Delete linked requirement', description: 'This will permanently remove the linked requirement from broker records and public Broker Connector views.' })" ${isBusy ? 'disabled' : ''}>Delete Requirement</button>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="admin-complaint-modal-body">
            <div class="admin-complaint-note-panel">
              <h4>Admin Note</h4>
              <label class="sr-only" for="complaintAdminNoteField">Admin note</label>
              <textarea id="complaintAdminNoteField" placeholder="Add the review note required for every complaint status or admin action." ${isBusy ? 'disabled' : ''}>${escapeHtml(item.adminNote || '')}</textarea>
              <div class="admin-complaint-note-meta">
                <span>Every complaint action saves this note with reviewer and review time.</span>
                <span class="badge gold">${escapeHtml(displayRecommendationBadge)}</span>
              </div>
              <div class="admin-complaint-note-meta">
                <span>Reviewed By: ${escapeHtml(item.reviewedBy || 'Not reviewed yet')}</span>
                <span>Reviewed At: ${escapeHtml(item.reviewedAt ? formatAdminDateTime(item.reviewedAt) : 'Not reviewed yet')}</span>
              </div>
              ${item.reporterSoftFlag ? `<div class="admin-complaint-note-meta"><span class="badge red">Reporter watch</span><span>${escapeHtml(item.reporterFlagReason || 'Possible complaint abuse pattern detected.')}</span></div>` : ''}
            </div>
            <div class="admin-complaint-meta-grid">
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Reporter Summary</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Name</small><strong>${escapeHtml(reporterName)}</strong></div>
                  <div class="admin-detail-cell"><small>Email</small><strong>${escapeHtml(reporterEmail)}</strong></div>
                  <div class="admin-detail-cell"><small>Reporter Ref</small><strong>${escapeHtml(reporterRef)}</strong></div>
                  <div class="admin-detail-cell"><small>Reason</small><strong>${escapeHtml(item.reason || 'Other')}</strong></div>
                  <div class="admin-detail-cell"><small>Recent Complaints</small><strong>${escapeHtml(String(item.reporterRecentComplaintCount || 0))}</strong></div>
                  <div class="admin-detail-cell"><small>Rejected Complaints</small><strong>${escapeHtml(String(item.reporterRejectedComplaintCount || 0))}</strong></div>
                  <div class="admin-detail-cell"><small>Unique Targets</small><strong>${escapeHtml(String(item.reporterDistinctTargetCount || 0))}</strong></div>
                  <div class="admin-detail-cell"><small>Reporter Flag</small><strong>${escapeHtml(item.reporterSoftFlag ? (item.reporterFlagReason || 'Watch reporter activity') : 'No current flag')}</strong></div>
                </div>
              </div>
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Reported User Summary</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Broker</small><strong>${escapeHtml(reportedName)}</strong></div>
                  <div class="admin-detail-cell"><small>Broker ID</small><strong>${escapeHtml(reportedRef)}</strong></div>
                  <div class="admin-detail-cell"><small>Resolved Valid Complaints</small><strong>${escapeHtml(String(resolvedValidCount))}</strong></div>
                  <div class="admin-detail-cell"><small>Recommended</small><strong>${escapeHtml(displayRecommendationBadge)}</strong></div>
                </div>
              </div>
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Target Summary</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Target Type</small><strong>${escapeHtml(targetTypeLabel)}</strong></div>
                  <div class="admin-detail-cell"><small>Target ID</small><strong>${escapeHtml(String(cleanedTargetId))}</strong></div>
                  <div class="admin-detail-cell"><small>Target Label</small><strong>${escapeHtml(targetLabel || 'Not provided')}</strong></div>
                  <div class="admin-detail-cell"><small>Proof</small><strong>${renderComplaintProofLink(item)}</strong></div>
                </div>
              </div>
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Complaint Meta</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Complaint ID</small><strong>${escapeHtml(complaintLabel)}</strong></div>
                  <div class="admin-detail-cell"><small>Created</small><strong>${escapeHtml(formatAdminDateTime(item.created_at))}</strong></div>
                  <div class="admin-detail-cell"><small>Source</small><strong>${escapeHtml(item.sourceSection || 'Dashboard')}</strong></div>
                  <div class="admin-detail-cell"><small>Action Taken</small><strong>${escapeHtml(getComplaintActionLabel(item.actionTaken))}</strong></div>
                  <div class="admin-detail-cell"><small>Next Valid Complaint</small><strong>${escapeHtml(String(nextValidCount))}</strong></div>
                </div>
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-card">
              <h4>Complaint Description</h4>
              <div class="admin-detail-note admin-complaint-note">${escapeHtml(complaintText)}</div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-card">
              <h4>Complaint History Against Same Broker</h4>
              ${renderComplaintHistoryMarkup(item)}
            </div>
          </div>
        </div>
      `;
    }

    function renderComplaintReviewModal(entry = null) {
      const backdrop = document.getElementById('complaintReviewModalBackdrop');
      const content = document.getElementById('complaintReviewModalContent');
      if (!backdrop || !content) return;
      if (!entry) {
        backdrop.classList.add('hidden');
        content.innerHTML = '';
        closeComplaintActionConfirm();
        syncAdminModalBodyLock();
        return;
      }
      content.innerHTML = renderComplaintDetailMarkup(entry, 'clearAdminSelection()');
      backdrop.classList.remove('hidden');
      syncAdminModalBodyLock();
    }

    function renderComplaintActionConfirmContent(state) {
      if (!state) return '';
      const actionLabel = getComplaintActionLabel(state.actionTaken);
      const isBusy = Boolean(adminUiState.complaintActionBusy);
      return `
        <div class="admin-complaint-confirm">
          <div class="admin-detail-header">
            <div class="admin-detail-head-row">
              <div class="admin-detail-copy">Complaint Review</div>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="closeComplaintActionConfirm()" ${isBusy ? 'disabled' : ''}>Close</button>
            </div>
            <h3 id="complaintActionConfirmTitle">${escapeHtml(state.title || actionLabel)}</h3>
          </div>
          <p>${escapeHtml(state.description || 'Confirm this complaint action.')}</p>
          <div class="admin-detail-note">Your current admin note will be saved together with reviewer and review time.</div>
          <div class="admin-complaint-confirm-actions">
            <button class="btn btn-secondary tiny-btn" type="button" onclick="closeComplaintActionConfirm()" ${isBusy ? 'disabled' : ''}>Cancel</button>
            <button class="btn btn-danger tiny-btn" type="button" onclick="executeComplaintAdminAction(${Number(state.index || 0)}, '${escapeHtml(state.actionTaken || 'none')}', '${escapeHtml(state.status || '')}')" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Working...' : 'Confirm Action'}</button>
          </div>
        </div>
      `;
    }

    function openComplaintActionConfirm(state) {
      const backdrop = document.getElementById('complaintActionConfirmBackdrop');
      const content = document.getElementById('complaintActionConfirmContent');
      if (!backdrop || !content) return;
      content.innerHTML = renderComplaintActionConfirmContent(state);
      backdrop.classList.remove('hidden');
      syncAdminModalBodyLock();
    }

    function closeComplaintActionConfirm() {
      const backdrop = document.getElementById('complaintActionConfirmBackdrop');
      const content = document.getElementById('complaintActionConfirmContent');
      if (!backdrop || !content) return;
      backdrop.classList.add('hidden');
      content.innerHTML = '';
      syncAdminModalBodyLock();
    }

    function initComplaintReviewModal() {
      const backdrop = document.getElementById('complaintReviewModalBackdrop');
      const dialog = document.getElementById('complaintReviewModalDialog');
      const confirmBackdrop = document.getElementById('complaintActionConfirmBackdrop');
      const confirmDialog = document.getElementById('complaintActionConfirmDialog');
      if (!backdrop || !dialog || backdrop.dataset.ready === 'true') return;
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) clearAdminSelection();
      });
      confirmBackdrop?.addEventListener('click', event => {
        if (event.target === confirmBackdrop) closeComplaintActionConfirm();
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (confirmBackdrop && !confirmBackdrop.classList.contains('hidden')) {
          closeComplaintActionConfirm();
          return;
        }
        if (!backdrop.classList.contains('hidden')) {
          clearAdminSelection();
        }
      });
      backdrop.dataset.ready = 'true';
      if (confirmDialog) confirmDialog.dataset.ready = 'true';
    }

    function getSelectedAdminItem(collections) {
      if (adminUiState.selectedType === 'broker') {
        return collections.brokers.find(item => item.key === adminUiState.selectedKey) || null;
      }
      if (adminUiState.selectedType === 'requirement') {
        return collections.requirements.find(item => item.key === adminUiState.selectedKey) || null;
      }
      if (adminUiState.selectedType === 'deal') {
        return collections.deals.find(item => item.key === adminUiState.selectedKey) || null;
      }
      if (adminUiState.selectedType === 'complaint') {
        return collections.complaints.find(item => item.key === adminUiState.selectedKey) || null;
      }
      return null;
    }
