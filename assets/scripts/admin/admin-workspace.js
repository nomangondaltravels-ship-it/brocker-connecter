    function renderAdminWorkspace() {
      const collections = getFilteredAdminCollections();
      renderStats(adminBrokerAccounts);
      ensureAdminSelection(collections);
      const grid = document.getElementById('adminMainGrid');
      const selected = getSelectedAdminItem(collections);
      const inlineSelected = selected && selected.type !== 'broker' && selected.type !== 'complaint' ? selected : null;
      if (grid) {
        grid.classList.toggle('no-detail', !inlineSelected);
        grid.classList.toggle('has-detail', Boolean(inlineSelected));
      }
      renderBrokerApprovals(collections.brokers);
      renderPostLists(collections);
      renderComplaintFilterMenu(getComplaintQueueFilterValue(), collections.complaints);
      renderComplaints(collections.complaints);
      renderSupportRequests();
      renderCompanySuggestions();
      renderAdminDetailPanel(collections);
      renderBrokerAccountModal(selected && selected.type === 'broker' ? selected : null);
      renderComplaintReviewModal(selected && selected.type === 'complaint' ? selected : null);
      flushAdminDetailScroll();
    }

    const ADMIN_TABLE_COLUMNS = {
      brokers: '180px 160px 180px 110px 80px 80px 110px 96px 220px',
      requirements: '180px 140px 120px 120px 110px 96px 200px',
      deals: '180px 140px 120px 120px 110px 96px 200px',
      complaints: '120px 140px 140px 96px 110px 132px 110px 120px 128px'
    };

    function applyAdminFilters() {
      renderAdminWorkspace();
    }

    function clearAdminFilters() {
      const searchInput = document.getElementById('adminSearchInput');
      const verification = document.getElementById('adminVerificationFilter');
      const accountState = document.getElementById('adminAccountFilter');
      const queue = document.getElementById('adminQueueFilter');
      if (searchInput) searchInput.value = '';
      if (verification) verification.value = 'all';
      if (accountState) accountState.value = 'all';
      if (queue) queue.value = 'all';
      adminUiState.search = '';
      adminUiState.verification = 'all';
      adminUiState.account = 'all';
      adminUiState.queue = 'all';
      adminUiState.complaintQueue = 'all';
      renderAdminWorkspace();
    }

    function renderBrokerApprovals(accounts) {
      const target = document.getElementById('brokerApprovalList');
      if (!accounts.length) {
        target.innerHTML = `<div class="admin-detail-empty">No broker accounts match the current filter set.</div>`;
        return;
      }

      const columns = ADMIN_TABLE_COLUMNS.brokers;
      target.innerHTML = `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${columns};">
            <div>User</div>
            <div>Company</div>
            <div>Contact</div>
            <div>Verification</div>
            <div class="admin-head-center">Req</div>
            <div class="admin-head-center">List</div>
            <div>Status</div>
            <div class="admin-head-right">Joined</div>
            <div class="admin-head-right">Quick Actions</div>
          </div>
          ${accounts.map(account => {
            const approved = Boolean(account.approved);
            const blocked = Boolean(account.blocked);
            const selected = adminUiState.selectedType === 'broker' && adminUiState.selectedKey === account.key ? ' is-selected' : '';
            return `
              <div class="admin-table-row${selected}" data-admin-row-key="${escapeHtml(account.key)}" style="grid-template-columns:${columns};" onclick="setAdminSelection('broker', '${escapeHtml(account.key)}')">
                <div class="admin-cell">
                  <strong>${escapeHtml(account.name || 'Broker')}</strong>
                  <span>${escapeHtml(account.brokerId || 'No Broker ID')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(account.company || 'â€”')}</strong>
                  <span>${account.summary.sharedCount} shared records</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(account.email || 'No email')}</strong>
                  <span>${escapeHtml(account.phone || 'No phone')}</span>
                </div>
                <div class="admin-cell">
                  <span class="badge ${approved ? 'green' : 'gold'}">${approved ? 'Verified' : 'Pending'}</span>
                </div>
                <div class="admin-cell admin-cell-center">
                  <strong>${account.summary.requirementCount}</strong>
                  <span>requirements</span>
                </div>
                <div class="admin-cell admin-cell-center">
                  <strong>${account.summary.listingCount}</strong>
                  <span>listings</span>
                </div>
                <div class="admin-cell">
                  <span class="badge ${account.accountMeta.tone}">${account.accountMeta.label}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(formatAdminDateTime(account.createdAt))}</strong>
                  <span>${blocked ? 'Access disabled' : approved ? 'Live account' : 'Needs review'}</span>
                </div>
                <div class="admin-table-actions" onclick="event.stopPropagation()">
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="toggleBrokerApproval('${escapeHtml(account.brokerId)}')">${approved ? 'Unverify' : 'Verify'}</button>
                  <button class="btn ${blocked ? 'btn-secondary' : 'btn-danger'} tiny-btn" type="button" onclick="toggleBrokerBlock('${escapeHtml(account.brokerId)}')">${blocked ? 'Unblock' : 'Block'}</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="updateBrokerPassword('${escapeHtml(account.brokerId)}')">Password</button>
                  <button class="btn btn-danger tiny-btn" type="button" onclick="deleteBrokerAccount('${escapeHtml(account.brokerId)}')">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderPostLists(collections) {
      const reqTarget = document.getElementById('requirementReviewList');
      const dealTarget = document.getElementById('dealReviewList');
      const requirementColumns = ADMIN_TABLE_COLUMNS.requirements;
      const dealColumns = ADMIN_TABLE_COLUMNS.deals;

      reqTarget.innerHTML = collections.requirements.length ? `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${requirementColumns};">
            <div>Requirement</div>
            <div>Broker</div>
            <div>Area</div>
            <div class="admin-head-right">Budget</div>
            <div>Status</div>
            <div class="admin-head-right">Updated</div>
            <div class="admin-head-right">Quick Actions</div>
          </div>
          ${collections.requirements.map(entry => {
            const selected = adminUiState.selectedType === 'requirement' && adminUiState.selectedKey === entry.key ? ' is-selected' : '';
            return `
              <div class="admin-table-row${selected}" data-admin-row-key="${escapeHtml(entry.key)}" style="grid-template-columns:${requirementColumns};" onclick="setAdminSelection('requirement', '${escapeHtml(entry.key)}')">
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.purpose)} Â· ${escapeHtml(entry.item.category)}</strong>
                  <span>${escapeHtml(entry.item.notes || 'No notes provided')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.broker || 'Unknown broker')}</strong>
                  <span>${escapeHtml(entry.item.phone || 'No phone')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.location || 'Area missing')}</strong>
                  <span>${entry.item.verified ? 'Verified details' : 'Pending verification'}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(entry.item.budget || 'â€”')}</strong>
                  <span>Requirement budget</span>
                </div>
                <div class="admin-cell">
                  <span class="status-pill ${entry.status}">${escapeHtml(entry.status)}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(formatPostedTime(entry.item.postedAt))}</strong>
                  <span>${escapeHtml(formatAdminDateTime(entry.item.postedAt))}</span>
                </div>
                <div class="admin-table-actions" onclick="event.stopPropagation()">
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'open')">Open</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'matched')">Matched</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'closed')">Closed</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'expired')">Expired</button>
                  <button class="btn btn-danger tiny-btn" type="button" onclick="deleteRequirementAt(${entry.index})">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="admin-detail-empty">No requirements match the current queue or search filter.</div>`;

      dealTarget.innerHTML = collections.deals.length ? `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${dealColumns};">
            <div>Listing</div>
            <div>Broker</div>
            <div>Area</div>
            <div class="admin-head-right">Price</div>
            <div>Status</div>
            <div class="admin-head-right">Updated</div>
            <div class="admin-head-right">Quick Actions</div>
          </div>
          ${collections.deals.map(entry => {
            const selected = adminUiState.selectedType === 'deal' && adminUiState.selectedKey === entry.key ? ' is-selected' : '';
            return `
              <div class="admin-table-row${selected}" data-admin-row-key="${escapeHtml(entry.key)}" style="grid-template-columns:${dealColumns};" onclick="setAdminSelection('deal', '${escapeHtml(entry.key)}')">
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.purpose)} Â· ${escapeHtml(entry.item.category)}</strong>
                  <span>${entry.item.distress ? 'Distress listing' : 'Standard connector listing'}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.broker || 'Unknown broker')}</strong>
                  <span>${escapeHtml(entry.item.phone || 'No phone')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.location || 'Area missing')}</strong>
                  <span>${entry.item.urgent ? 'Urgent exposure' : 'Normal visibility'}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(entry.item.budget || 'â€”')}</strong>
                  <span>${entry.item.distress ? 'Distress pricing' : 'Listing price'}</span>
                </div>
                <div class="admin-cell">
                  <span class="status-pill ${entry.status}">${escapeHtml(entry.status)}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(formatPostedTime(entry.item.postedAt))}</strong>
                  <span>${escapeHtml(formatAdminDateTime(entry.item.postedAt))}</span>
                </div>
                <div class="admin-table-actions" onclick="event.stopPropagation()">
                  ${entry.item.distress ? '<span class="badge gold">Distress</span>' : ''}
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'open')">Open</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'matched')">Matched</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'closed')">Closed</button>
                  <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'expired')">Expired</button>
                  <button class="btn btn-danger tiny-btn" type="button" onclick="deleteDealAt(${entry.index})">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="admin-detail-empty">No broker connector listings match the current queue or search filter.</div>`;
    }

    function renderComplaints(complaintEntries) {
      const target = document.getElementById('complaintList');
      if (adminUiState.complaintsLoading) {
        target.innerHTML = `<div class="admin-detail-empty">Loading complaint review queue...</div>`;
        return;
      }
      if (!complaintsReadable) {
        target.innerHTML = `<div class="admin-detail-empty">Complaint review is currently unavailable because complaint read access is blocked by Supabase permissions.</div>`;
        return;
      }

      const columns = ADMIN_TABLE_COLUMNS.complaints;
      target.innerHTML = `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${columns};">
            <div>Complaint ID</div>
            <div>Reporter</div>
            <div>Reported User</div>
            <div>Target Type</div>
            <div>Target ID</div>
            <div>Reason</div>
            <div>Status</div>
            <div class="admin-head-right">Created</div>
            <div>Action Taken</div>
          </div>
          ${complaintEntries.map(entry => {
            const statusMeta = getComplaintStatusMeta(entry.item.normalizedStatus);
            const actionLabel = getComplaintActionLabel(entry.item.actionTaken);
            const targetTypeLabel = getComplaintTargetLabel(entry.item);
            const reportedLabel = entry.item.reportedBrokerName || entry.item.broker || 'Not linked';
            const targetId = entry.item.targetId || entry.item.listingId || entry.item.requirementId || 'Not linked';
            const selected = adminUiState.selectedType === 'complaint' && adminUiState.selectedKey === entry.key ? ' is-selected' : '';
            return `
              <div class="admin-table-row${selected}" data-admin-row-key="${escapeHtml(entry.key)}" style="grid-template-columns:${columns};" onclick="setAdminSelection('complaint', '${escapeHtml(entry.key)}')">
                <div class="admin-cell">
                  <strong>#${escapeHtml(String(entry.item.id || 'Not linked'))}</strong>
                  <span>${escapeHtml(targetTypeLabel)}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.reporterName || entry.item.name || 'Anonymous')}</strong>
                  <span>${escapeHtml(entry.item.reporterEmail || 'No reporter email')}${entry.item.reporterSoftFlag ? ' - Reporter watch' : ''}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(reportedLabel)}</strong>
                  <span>${escapeHtml(findBrokerIdByComplaint(entry.item) || entry.item.reportedUserId || 'No linked broker')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(targetTypeLabel)}</strong>
                  <span>${escapeHtml(entry.item.targetLabel || 'General complaint')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(String(targetId))}</strong>
                  <span>${escapeHtml(entry.item.sourceSection || 'Dashboard')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(entry.item.reason || 'Other')}</strong>
                  <span>${escapeHtml((entry.item.displayMessage || entry.item.message || '').slice(0, 50) || 'No complaint text')}</span>
                </div>
                <div class="admin-cell">
                  <span class="badge ${statusMeta.tone}">${statusMeta.label}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(formatAdminDateTime(entry.item.created_at))}</strong>
                  <span>${escapeHtml(formatPostedTime(entry.item.created_at))}</span>
                </div>
                <div class="admin-cell">
                  <span class="badge ${getComplaintActionTone(entry.item.actionTaken)}">${escapeHtml(actionLabel)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    async function updateSupportRequestStatus(requestId, status) {
      if (!requestId || adminUiState.supportActionBusy) return;
      const actionButton = resolveAdminActionButton();
      adminUiState.supportActionBusy = true;
      renderAdminWorkspace();
      try {
        const result = await runAdminActionFeedback(
          actionButton,
          status === 'resolved' ? 'Resolving...' : 'Updating...',
          `Support request marked as ${getSupportStatusMeta(status).label}.`,
          () => requestSupportAction({
            action: 'update-status',
            requestId,
            status
          })
        );
        if (Array.isArray(result?.supportRequests) && result.supportRequests.length) {
          supportRequests = result.supportRequests;
        }
        setAdminStatus(`Support request marked as ${getSupportStatusMeta(status).label}.`, 'success');
      } catch (error) {
        showAdminError(error, 'Support request update failed.');
      }
      adminUiState.supportActionBusy = false;
      renderAdminWorkspace();
    }

    function getFilteredSupportRequests() {
      const search = normalizeAdminText(adminUiState.search);
      if (!search) return supportRequests;
      return supportRequests.filter(item => {
        const haystack = [
          item?.name,
          item?.email,
          item?.subject,
          item?.message,
          item?.status
        ].map(normalizeAdminText).join(' ');
        return haystack.includes(search);
      });
    }

    function renderSupportRequests() {
      const target = document.getElementById('supportInboxList');
      if (!target) return;
      if (adminUiState.supportLoading) {
        target.innerHTML = `<div class="admin-detail-empty">Loading support inbox...</div>`;
        return;
      }

      if (!adminUiState.supportRequested) {
        target.innerHTML = `<div class="admin-detail-empty">Open Help Desk to load support requests.</div>`;
        return;
      }

      if (!adminUiState.supportLoaded) {
        target.innerHTML = `<div class="admin-detail-empty">Open Help Desk to load support requests.</div>`;
        return;
      }

      const entries = getFilteredSupportRequests();
      if (!entries.length) {
        target.innerHTML = `<div class="admin-detail-empty">No support requests found.</div>`;
        return;
      }

      const columns = '1.05fr 1.1fr 0.85fr 2fr 0.9fr 1.1fr';
      target.innerHTML = `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${columns};">
            <div>Name</div>
            <div>Email</div>
            <div>Subject</div>
            <div>Message</div>
            <div class="admin-head-right">Created</div>
            <div>Status</div>
          </div>
          ${entries.map(item => {
            const statusMeta = getSupportStatusMeta(item.status);
            return `
              <div class="admin-table-row" style="grid-template-columns:${columns};">
                <div class="admin-cell">
                  <strong>${escapeHtml(item.name || 'Unknown')}</strong>
                  <span>${escapeHtml(item.requesterBrokerId || 'Public request')}</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(item.email || 'No email')}</strong>
                  <span>Help Desk request</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml(item.subject || 'General Help')}</strong>
                  <span>Support form</span>
                </div>
                <div class="admin-cell">
                  <strong>${escapeHtml((item.message || '').slice(0, 120) || 'No message')}</strong>
                  <span>${item.message && item.message.length > 120 ? 'Full message saved' : 'Compact preview'}</span>
                </div>
                <div class="admin-cell admin-cell-right">
                  <strong>${escapeHtml(formatAdminDateTime(item.created_at))}</strong>
                  <span>${escapeHtml(formatPostedTime(item.created_at))}</span>
                </div>
                <div class="admin-cell">
                  <span class="badge ${statusMeta.tone}">${statusMeta.label}</span>
                  <div class="admin-table-actions" style="margin-top:8px;">
                    <button class="btn btn-secondary tiny-btn" type="button" ${adminUiState.supportActionBusy ? 'disabled' : ''} onclick="updateSupportRequestStatus('${escapeHtml(item.id)}', 'new')">New</button>
                    <button class="btn btn-secondary tiny-btn" type="button" ${adminUiState.supportActionBusy ? 'disabled' : ''} onclick="updateSupportRequestStatus('${escapeHtml(item.id)}', 'in_progress')">In Progress</button>
                    <button class="btn btn-secondary tiny-btn" type="button" ${adminUiState.supportActionBusy ? 'disabled' : ''} onclick="updateSupportRequestStatus('${escapeHtml(item.id)}', 'resolved')">Resolved</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    async function handleCompanySuggestionAction(pendingId, action) {
      if (!pendingId || adminUiState.companyActionBusy) return;
      const actionButton = resolveAdminActionButton();
      adminUiState.companyActionBusy = true;
      renderAdminWorkspace();
      try {
        const result = await runAdminActionFeedback(
          actionButton,
          action === 'approve' ? 'Approving...' : 'Rejecting...',
          action === 'approve' ? 'Company suggestion approved successfully.' : 'Company suggestion rejected successfully.',
          () => requestCompanySuggestionAction({
            action,
            pendingId
          })
        );
        approvedCompanySuggestions = Array.isArray(result?.approvedCompanies) ? result.approvedCompanies : approvedCompanySuggestions;
        pendingCompanySuggestions = Array.isArray(result?.pendingCompanies) ? result.pendingCompanies : pendingCompanySuggestions;
        setAdminStatus(
          action === 'approve' ? 'Company suggestion approved successfully.' : 'Company suggestion rejected successfully.',
          'success'
        );
      } catch (error) {
        showAdminError(error, 'Company suggestion update failed.');
      }
      adminUiState.companyActionBusy = false;
      renderAdminWorkspace();
    }

    function renderCompanySuggestions() {
      const target = document.getElementById('companySuggestionsList');
      if (!target) return;
      if (adminUiState.companyLoading) {
        target.innerHTML = `<div class="admin-detail-empty">Loading pending companies...</div>`;
        return;
      }
      if (!adminUiState.companiesRequested) {
        target.innerHTML = `<div class="admin-detail-empty">Open Pending Companies to load suggestions.</div>`;
        return;
      }

      if (!adminUiState.companiesLoaded) {
        target.innerHTML = `<div class="admin-detail-empty">Open Pending Companies to load suggestions.</div>`;
        return;
      }
      const entries = getFilteredPendingCompanySuggestions();
      if (!entries.length) {
        target.innerHTML = `<div class="admin-detail-empty">No pending company suggestions found.</div>`;
        return;
      }

      const columns = '1.35fr 1fr 0.9fr 1fr 1.1fr';
      target.innerHTML = `
        <div class="admin-table-inner">
          <div class="admin-table-head" style="grid-template-columns:${columns};">
            <div>Company Name</div>
            <div>Source</div>
            <div>Status</div>
            <div class="admin-head-right">Submitted</div>
            <div class="admin-head-right">Actions</div>
          </div>
          ${entries.map(item => `
            <div class="admin-table-row" style="grid-template-columns:${columns};">
              <div class="admin-cell">
                <strong>${escapeHtml(item.name || 'Unnamed company')}</strong>
                <span>${escapeHtml(item.submitted_by_user_id || 'Submitted without user link')}</span>
              </div>
              <div class="admin-cell">
                <strong>${escapeHtml(item.source || 'registration_form')}</strong>
                <span>${approvedCompanySuggestions.length} approved companies live</span>
              </div>
              <div class="admin-cell">
                <span class="badge gold">Pending</span>
              </div>
              <div class="admin-cell admin-cell-right">
                <strong>${escapeHtml(formatAdminDateTime(item.created_at))}</strong>
                <span>${escapeHtml(formatPostedTime(item.created_at))}</span>
              </div>
              <div class="admin-table-actions">
                <button class="btn btn-secondary tiny-btn" type="button" ${adminUiState.companyActionBusy ? 'disabled' : ''} onclick="handleCompanySuggestionAction('${escapeHtml(item.id)}', 'approve')">Approve</button>
                <button class="btn btn-danger tiny-btn" type="button" ${adminUiState.companyActionBusy ? 'disabled' : ''} onclick="handleCompanySuggestionAction('${escapeHtml(item.id)}', 'reject')">Reject</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }


    function renderAdminDetailPanel(collections) {
      const target = document.getElementById('adminDetailPanel');
      if (!target) return;
      const selected = getSelectedAdminItem(collections);
      if (!selected) {
        target.className = 'admin-detail-empty';
        target.innerHTML = 'Select a broker, requirement, listing, or complaint to review actions and full context here.';
        return;
      }

      target.className = '';

      if (selected.type === 'broker') {
        target.className = 'admin-detail-empty';
        target.innerHTML = 'Select a requirement, listing, or complaint to review actions and full context here.';
        return;
      }

      if (selected.type === 'complaint') {
        target.className = 'admin-detail-empty';
        target.innerHTML = 'Select a requirement or listing to review actions and full context here.';
        return;
      }

      if (selected.type === 'broker') {
        const account = selected;
        const approved = Boolean(account.approved);
        const blocked = Boolean(account.blocked);
        target.innerHTML = `
          <div class="admin-detail-header">
            <div class="admin-detail-head-row">
              <div class="admin-detail-copy">Broker Account</div>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="clearAdminSelection()">Close</button>
            </div>
            <h3>${escapeHtml(account.name || 'Broker')}</h3>
            <div class="admin-detail-meta">
              <span class="badge ${approved ? 'green' : 'gold'}">${approved ? 'Verified' : 'Pending'}</span>
              <span class="badge ${blocked ? 'red' : 'blue'}">${blocked ? 'Blocked' : 'Active'}</span>
              <span class="badge blue">${escapeHtml(account.brokerId || 'No Broker ID')}</span>
            </div>
            <div class="admin-detail-toolbar">
              <button class="btn btn-secondary tiny-btn" type="button" onclick="toggleBrokerApproval('${escapeHtml(account.brokerId)}')">${approved ? 'Remove Verification' : 'Verify Broker'}</button>
              <button class="btn ${blocked ? 'btn-secondary' : 'btn-danger'} tiny-btn" type="button" onclick="toggleBrokerBlock('${escapeHtml(account.brokerId)}')">${blocked ? 'Unblock Broker' : 'Block Broker'}</button>
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
        return;
      }

      if (selected.type === 'requirement') {
        const entry = selected;
        target.innerHTML = `
          <div class="admin-detail-header">
            <div class="admin-detail-head-row">
              <div class="admin-detail-copy">Requirement Review</div>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="clearAdminSelection()">Close</button>
            </div>
            <h3>${escapeHtml(entry.item.purpose)} Â· ${escapeHtml(entry.item.category)}</h3>
            <div class="admin-detail-meta">
              <span class="status-pill ${entry.status}">${escapeHtml(entry.status)}</span>
              <span class="badge ${entry.item.verified ? 'green' : 'gold'}">${entry.item.verified ? 'Verified' : 'Pending'}</span>
            </div>
            <div class="admin-detail-toolbar">
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'open')">Open</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'matched')">Matched</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'closed')">Closed</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(requirements[${entry.index}], false, 'expired')">Expired</button>
              <button class="btn btn-danger tiny-btn" type="button" onclick="deleteRequirementAt(${entry.index})">Delete Requirement</button>
            </div>
          </div>
          <div class="admin-detail-section">
            <h4>Requirement Details</h4>
            <div class="admin-detail-grid">
              <div class="admin-detail-cell"><small>Broker</small><strong>${escapeHtml(entry.item.broker || 'Unknown broker')}</strong></div>
              <div class="admin-detail-cell"><small>Contact</small><strong>${escapeHtml(entry.item.phone || 'No phone')}</strong></div>
              <div class="admin-detail-cell"><small>Preferred Area</small><strong>${escapeHtml(entry.item.location || 'â€”')}</strong></div>
              <div class="admin-detail-cell"><small>Budget</small><strong>${escapeHtml(entry.item.budget || 'â€”')}</strong></div>
              <div class="admin-detail-cell"><small>Posted</small><strong>${escapeHtml(formatAdminDateTime(entry.item.postedAt))}</strong></div>
              <div class="admin-detail-cell"><small>Queue State</small><strong>${escapeHtml(entry.status)}</strong></div>
            </div>
          </div>
          <div class="admin-detail-section">
            <h4>Notes</h4>
            <div class="admin-detail-note">${escapeHtml(entry.item.notes || 'No notes provided for this requirement.')}</div>
          </div>
        `;
        return;
      }

      if (selected.type === 'deal') {
        const entry = selected;
        target.innerHTML = `
          <div class="admin-detail-header">
            <div class="admin-detail-head-row">
              <div class="admin-detail-copy">Listing Review</div>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="clearAdminSelection()">Close</button>
            </div>
            <h3>${escapeHtml(entry.item.purpose)} Â· ${escapeHtml(entry.item.category)}</h3>
            <div class="admin-detail-meta">
              <span class="status-pill ${entry.status}">${escapeHtml(entry.status)}</span>
              ${entry.item.distress ? '<span class="badge gold">Distress</span>' : '<span class="badge blue">Connector Listing</span>'}
            </div>
            <div class="admin-detail-toolbar">
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'open')">Open</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'matched')">Matched</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'closed')">Closed</button>
              <button class="btn btn-secondary tiny-btn" type="button" onclick="savePostStatus(deals[${entry.index}], true, 'expired')">Expired</button>
              <button class="btn btn-danger tiny-btn" type="button" onclick="deleteDealAt(${entry.index})">Delete Listing</button>
            </div>
          </div>
          <div class="admin-detail-section">
            <h4>Listing Details</h4>
            <div class="admin-detail-grid">
              <div class="admin-detail-cell"><small>Broker</small><strong>${escapeHtml(entry.item.broker || 'Unknown broker')}</strong></div>
              <div class="admin-detail-cell"><small>Contact</small><strong>${escapeHtml(entry.item.phone || 'No phone')}</strong></div>
              <div class="admin-detail-cell"><small>Area</small><strong>${escapeHtml(entry.item.location || 'â€”')}</strong></div>
              <div class="admin-detail-cell"><small>Price</small><strong>${escapeHtml(entry.item.budget || 'â€”')}</strong></div>
              <div class="admin-detail-cell"><small>Urgency</small><strong>${entry.item.urgent ? 'Urgent' : 'Standard'}</strong></div>
              <div class="admin-detail-cell"><small>Posted</small><strong>${escapeHtml(formatAdminDateTime(entry.item.postedAt))}</strong></div>
            </div>
          </div>
          <div class="admin-detail-section">
            <h4>Notes</h4>
            <div class="admin-detail-note">${escapeHtml(entry.item.notes || 'No notes provided for this listing.')}</div>
          </div>
        `;
        return;
      }

      if (selected.type === 'complaint') {
        const entry = selected;
        const statusMeta = getComplaintStatusMeta(entry.item.normalizedStatus);
        const linkedBrokerId = findBrokerIdByComplaint(entry.item);
        const reporterName = entry.item.reporterName || entry.item.name || 'Anonymous';
        const reporterEmail = entry.item.reporterEmail || 'No reporter email';
        const linkedBrokerLabel = entry.item.broker || 'No broker';
        const submittedAt = formatAdminDateTime(entry.item.created_at);
        const targetLabel = entry.item.targetLabel || `${getComplaintTargetLabel(entry.item)} ${entry.item.targetId || ''}`.trim();
        const complaintText = entry.item.displayMessage || entry.item.message || 'No complaint message provided.';
        target.innerHTML = `
          <div class="admin-complaint-detail">
            <div class="admin-detail-header admin-complaint-header">
              <div class="admin-detail-head-row">
                <div class="admin-detail-copy">Complaint Review</div>
                <button class="btn btn-secondary tiny-btn" type="button" onclick="clearAdminSelection()">Close</button>
              </div>
              <h3>${escapeHtml(reporterName)}</h3>
              <div class="admin-detail-meta">
                <span class="badge ${statusMeta.tone}">${statusMeta.label}</span>
                <span class="badge blue">${escapeHtml(linkedBrokerLabel)}</span>
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-actions">
              <div class="admin-complaint-action-groups">
                <div class="admin-complaint-action-group">
                  <h4>Status</h4>
                  <div class="admin-detail-toolbar admin-complaint-toolbar">
                    <button class="btn btn-warning tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'new')">New</button>
                    <button class="btn btn-orange tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'under-review')">Under Review</button>
                    <button class="btn btn-success tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'resolved')">Resolve</button>
                    <button class="btn btn-danger tiny-btn" type="button" onclick="updateComplaintStatus(${entry.index}, 'rejected')">Reject</button>
                  </div>
                </div>
                <div class="admin-complaint-action-group">
                  <h4>Admin Actions</h4>
                  <div class="admin-detail-toolbar admin-complaint-toolbar">
                    <button class="btn btn-danger tiny-btn" type="button" onclick="blockComplaintBroker(${entry.index})">Block Broker</button>
                    <button class="btn btn-danger tiny-btn" type="button" onclick="deleteComplaintAt(${entry.index})">Delete Complaint</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="admin-complaint-meta-grid">
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Reporter</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Name</small><strong>${escapeHtml(reporterName)}</strong></div>
                  <div class="admin-detail-cell"><small>Email</small><strong>${escapeHtml(reporterEmail)}</strong></div>
                  <div class="admin-detail-cell"><small>Reason</small><strong>${escapeHtml(entry.item.reason || 'Other')}</strong></div>
                  <div class="admin-detail-cell"><small>Source</small><strong>${escapeHtml(entry.item.sourceSection || 'Dashboard')}</strong></div>
                </div>
              </div>
              <div class="admin-detail-section admin-complaint-section admin-complaint-card">
                <h4>Broker</h4>
                <div class="admin-detail-grid">
                  <div class="admin-detail-cell"><small>Broker</small><strong>${escapeHtml(linkedBrokerLabel)}</strong></div>
                  <div class="admin-detail-cell"><small>Linked Broker</small><strong>${escapeHtml(linkedBrokerId || 'Broker not matched')}</strong></div>
                  <div class="admin-detail-cell"><small>Broker Name</small><strong>${escapeHtml(entry.item.reportedBrokerName || '--')}</strong></div>
                </div>
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-card">
              <h4>Target</h4>
              <div class="admin-detail-grid">
                <div class="admin-detail-cell"><small>Type</small><strong>${escapeHtml(getComplaintTargetLabel(entry.item))}</strong></div>
                <div class="admin-detail-cell"><small>Target</small><strong>${escapeHtml(targetLabel || 'Not provided')}</strong></div>
                <div class="admin-detail-cell"><small>Target ID</small><strong>${escapeHtml(entry.item.targetId || '--')}</strong></div>
                <div class="admin-detail-cell"><small>Proof</small><strong>${renderComplaintProofLink(entry.item)}</strong></div>
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-card">
              <h4>Submitted</h4>
              <div class="admin-detail-grid admin-complaint-single">
                <div class="admin-detail-cell"><small>Submitted</small><strong>${escapeHtml(submittedAt)}</strong></div>
              </div>
            </div>
            <div class="admin-detail-section admin-complaint-section admin-complaint-card">
              <h4>Complaint</h4>
              <div class="admin-detail-note admin-complaint-note">${escapeHtml(complaintText)}</div>
            </div>
          </div>
        `;
      }
    }

    initBrokerAccountModal();
    initComplaintReviewModal();
    initAdminActionModal();
    restoreAdminSession();
