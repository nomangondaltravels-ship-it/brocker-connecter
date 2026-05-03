    function openOverviewMetric(metricKey) {
      if (metricKey === 'activeLeads') {
        state.filters.leads.archive = 'active';
        syncFilterInputs('leads');
        openSection('leads');
        renderLeads();
        return;
      }
      if (metricKey === 'activeListings') {
        state.filters.properties.archive = 'active';
        syncFilterInputs('properties');
        openSection('properties');
        renderProperties();
        return;
      }
      if (metricKey === 'archivedLeads') {
        state.filters.leads.archive = 'archived';
        syncFilterInputs('leads');
        openSection('leads');
        renderLeads();
        return;
      }
      if (metricKey === 'archivedListings') {
        state.filters.properties.archive = 'archived';
        syncFilterInputs('properties');
        openSection('properties');
        renderProperties();
        return;
      }
      focusWorkflowAlerts();
    }

    function badgeClass(status) {
      const value = String(status || '').toLowerCase();
      if (['new', 'available', 'listed', 'open'].includes(value)) return 'badge-yellow';
      if (['contacted', 'follow-up', 'meeting scheduled', 'negotiation', 'reserved'].includes(value)) return 'badge-orange';
      if (['closed won', 'sold', 'rented', 'resolved', 'verified'].includes(value)) return 'badge-green';
      if (['closed lost', 'cancelled', 'rejected', 'blocked', 'off market'].includes(value)) return 'badge-red';
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
          item.clientName,
          item.clientPhone,
          item.followUpNote,
          item.lastContactMethod,
          item.isArchived ? 'archived' : 'active'
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
          item.sizeSqft,
          item.size,
          item.publicNotes,
          item.internalNotes,
          item.ownerName,
          item.ownerPhone,
          item.status,
          item.followUpNote,
          item.lastOwnerContactMethod,
          item.isDistress ? 'distress deal hot listing' : '',
          item.isArchived ? 'archived' : 'active'
        ].join(' ').toLowerCase();
      }
      return [
        item.title,
        item.message,
        item.matchReason,
        item.location,
        item.propertyType
      ].join(' ').toLowerCase();
    }

    function matchesCommonSearch(item, type) {
      const query = String(state.dashboardSearchQuery || '').trim().toLowerCase();
      if (!query) return true;
      return getDashboardSearchText(item, type).includes(query);
    }

    function getFilteredDashboardItems(items, type) {
      const source = Array.isArray(items) ? [...items] : [];
      if (type === 'lead') {
        const filters = getLeadFilterState();
        return source.filter(item => {
          const followUpState = getFollowUpStateInfo(item);
          const isArchived = Boolean(item.isArchived);
          if (!matchesCommonSearch(item, type)) return false;
          if (filters.status !== 'all' && normalizeDashboardLeadStatusValue(item.status) !== filters.status) return false;
          if (filters.purpose !== 'all' && getLeadClientPurpose(item.clientPurpose) !== filters.purpose) return false;
          if (filters.visibility !== 'all' && getLeadVisibility(item) !== filters.visibility) return false;
          if (filters.followUp !== 'all' && followUpState.key !== filters.followUp) return false;
          if (filters.archive === 'active' && isArchived) return false;
          if (filters.archive === 'archived' && !isArchived) return false;
          if (filters.urgent === 'urgent' && !item.isUrgentFollowUp) return false;
          if (filters.urgent === 'standard' && item.isUrgentFollowUp) return false;
          if (filters.matches === 'matched' && !item.matchCount) return false;
          if (filters.matches === 'unmatched' && item.matchCount) return false;
          return true;
        });
      }

      if (type === 'property') {
        const filters = getPropertyFilterState();
        return source.filter(item => {
          const followUpState = getFollowUpStateInfo(item);
          const isArchived = Boolean(item.isArchived);
          if (!matchesCommonSearch(item, type)) return false;
          if (filters.status !== 'all' && normalizeDashboardListingStatusValue(item.status) !== filters.status) return false;
          if (filters.purpose !== 'all' && getPropertyPurpose(item.purpose) !== filters.purpose) return false;
          if (filters.visibility !== 'all' && getPropertyVisibility(item) !== filters.visibility) return false;
          if (filters.followUp !== 'all' && followUpState.key !== filters.followUp) return false;
          if (filters.archive === 'active' && isArchived) return false;
          if (filters.archive === 'archived' && !isArchived) return false;
          if (filters.distress === 'distress' && !item.isDistress) return false;
          if (filters.distress === 'standard' && item.isDistress) return false;
          if (filters.matches === 'matched' && !item.matchCount) return false;
          if (filters.matches === 'unmatched' && item.matchCount) return false;
          return true;
        });
      }

      return source.filter(item => matchesCommonSearch(item, type));
    }

    function renderWorkflowAlerts() {
      const alertsTarget = document.getElementById('workflowAlertsList');
      const matchesTarget = document.getElementById('workflowMatchesList');
      const unreadAlerts = getUnreadNotificationItems(getWorkflowNotificationItems());
      const alertCount = unreadAlerts.length;
      const matchCount = Array.isArray(state.aiMatches) ? state.aiMatches.length : 0;
      const countNode = document.getElementById('notificationCountBadge');
      const workflowCountNode = document.getElementById('workflowAlertsCount');
      const workflowMatchesNode = document.getElementById('workflowMatchesCount');
      if (countNode) countNode.textContent = String(alertCount);
      if (workflowCountNode) workflowCountNode.textContent = String(alertCount);
      if (workflowMatchesNode) workflowMatchesNode.textContent = String(matchCount);

      if (alertsTarget) {
        if (!alertCount) {
          alertsTarget.innerHTML = '<div class="empty">No alerts right now. Your workflow looks clear.</div>';
        } else {
          alertsTarget.innerHTML = unreadAlerts.slice(0, 8).map(({ item }) => `
            <div class="workflow-alert-item">
              <strong>${escapeHtml(item.title || 'Alert')}</strong>
              <div class="muted">${escapeHtml(item.message || '')}</div>
              <small>${escapeHtml(formatDateTime(item.createdAt || item.updatedAt || new Date().toISOString()))}</small>
            </div>
          `).join('');
        }
      }

      if (matchesTarget) {
        if (!Array.isArray(state.aiMatches) || !state.aiMatches.length) {
          matchesTarget.innerHTML = '<div class="empty">No match opportunities found yet.</div>';
        } else {
          matchesTarget.innerHTML = state.aiMatches.slice(0, 6).map(match => {
            const lead = state.leads.find(item => item.id === match.requirementId);
            const property = state.properties.find(item => item.id === match.propertyId);
            return `
              <div class="workflow-alert-item">
                <strong>${escapeHtml(match.status === 'strong' ? 'Strong Match' : 'Partial Match')}</strong>
                <div class="muted">${escapeHtml(`Lead #${match.requirementId} ? Listing #${match.propertyId}`)}</div>
                <div class="muted">${escapeHtml(match.matchReason || '')}</div>
                <small>${escapeHtml(joinDisplayParts([
                  lead?.location || property?.location || '',
                  lead?.propertyType || property?.propertyType || ''
                ]))}</small>
              </div>
            `;
          }).join('');
        }
      }
    }

    async function loadDashboard() {
      const response = await fetch('/api/broker-dashboard', {
        method: 'GET',
        headers: apiHeaders()
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
      state.notifications = Array.isArray(result.notifications) ? result.notifications : [];
      state.aiMatches = Array.isArray(result.aiMatches) ? result.aiMatches : [];
      if (result.overview?.broker) {
        state.broker = { ...(state.broker || {}), ...result.overview.broker };
        localStorage.setItem('broker_session_profile', JSON.stringify(state.broker));
      }
      syncProfileStorage();
      syncBrokerIdentityButton();

      syncFilterInputs('leads');
      syncFilterInputs('properties');
      renderOverview();
      renderWorkflowAlerts();
      renderLeads();
      renderProperties();
      renderDistressDeals();
      renderSharedListings();
      renderFollowups();
      renderProgress();
      renderProfile();
      renderComplaintCenter();
      renderSettings();
      populateFollowupEntities();
      await loadBrokerComplaints();
    }

    function renderOverview() {
      const overview = state.overview || { totals: {}, broker: {} };
      const stats = [
        { label: 'Active Leads', value: overview.totals?.activeLeads || 0, metric: 'activeLeads' },
        { label: 'Inventory', value: overview.totals?.activeProperties || 0, metric: 'activeListings' }
      ];

      document.getElementById('overviewStats').innerHTML = stats.map(item => `
        <div
          class="stat-card is-clickable"
          role="button"
          tabindex="0"
          aria-label="Open ${item.label}"
          onclick="openOverviewMetric('${item.metric}')"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openOverviewMetric('${item.metric}')}"
        >
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `).join('');
    }

    function renderActivityTimeline(entries) {
      const activity = Array.isArray(entries) ? entries : [];
      if (!activity.length) return '<div class="empty">No activity yet.</div>';
      return `<div class="timeline-list">${activity.slice(0, 8).map(entry => `
        <div class="timeline-item">
          <strong>${escapeHtml(entry.text || 'Activity')}</strong>
          <small>${escapeHtml(formatDateTime(entry.createdAt || new Date().toISOString()))}</small>
        </div>
      `).join('')}</div>`;
    }

    function renderLeadMatches(lead) {
      const matches = Array.isArray(lead.matchingListings) ? lead.matchingListings : [];
      if (!matches.length) return '<div class="empty">No matching listings yet.</div>';
      return `<div class="match-list">${matches.slice(0, 8).map(match => `
        <div class="match-item">
          <strong>${escapeHtml(joinDisplayParts([match.confidence === 'strong' ? 'Strong Match' : 'Partial Match', `Listing #${match.id}`]))}</strong>
          <div class="muted">${escapeHtml(joinDisplayParts([match.propertyType, match.location, match.price]))}</div>
          <small>${escapeHtml(match.matchReason || '')}</small>
        </div>
      `).join('')}</div>`;
    }

    function renderPropertyMatches(property) {
      const matches = Array.isArray(property.matchingLeads) ? property.matchingLeads : [];
      if (!matches.length) return '<div class="empty">No matching leads yet.</div>';
      return `<div class="match-list">${matches.slice(0, 8).map(match => `
        <div class="match-item">
          <strong>${escapeHtml(joinDisplayParts([match.confidence === 'strong' ? 'Strong Match' : 'Partial Match', `Lead #${match.id}`]))}</strong>
          <div class="muted">${escapeHtml(joinDisplayParts([formatStatusLabel(match.clientPurpose), match.propertyType, match.location, formatBudgetLabel(match.budget)]))}</div>
          <small>${escapeHtml(match.matchReason || '')}</small>
        </div>
      `).join('')}</div>`;
    }

    function openRecordPanel(panelId) {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      panel.open = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderEmptyState(title, copy, actionLabel, actionHandler) {
      return `
        <div class="empty crm-empty-state">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(copy)}</span>
          <button class="btn btn-primary btn-tiny" type="button" onclick="${actionHandler}">${escapeHtml(actionLabel)}</button>
        </div>
      `;
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = `<div class="empty">No broker requirements match your current filters. Adjust your filters or add a new lead from Overview.</div>`;
        return;
      }

      target.innerHTML = requirements.map(lead => {
        const followUpState = getFollowUpStateInfo(lead);
        const phoneAvailable = String(lead.clientPhone || '').trim();
        return `
          <div class="item-card">
            <div class="item-top">
              <div class="item-title">
                <h4>${escapeHtml(joinDisplayParts([getLeadClientPurposeLabel(lead.clientPurpose), lead.propertyType || 'Requirement']))}</h4>
                <div class="muted">${escapeHtml(joinDisplayParts([lead.location, formatBudgetLabel(lead.budget), lead.preferredBuildingProject]))}</div>
              </div>
              <div class="badges">
                <span class="badge ${badgeClass(lead.status)}">${escapeHtml(formatStatusLabel(lead.status || 'new'))}</span>
                <span class="badge ${lead.isListedPublic ? 'badge-green' : 'badge-blue'}">${lead.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                ${lead.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                ${lead.matchCount ? `<span class="badge badge-match">${lead.matchCount} Match${lead.matchCount === 1 ? '' : 'es'}</span>` : ''}
                ${lead.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-cell"><small>Client Name</small><strong>${renderPrivateNameValue('lead', lead.id, lead.clientName, 'Hidden for privacy')}</strong></div>
              <div class="detail-cell"><small>Client Phone</small><strong>${renderPrivatePhoneValue('lead', lead.id, lead.clientPhone)}</strong></div>
              <div class="detail-cell"><small>Payment / Purpose</small><strong>${escapeHtml(getLeadClientPurpose(lead.clientPurpose) === 'buy' ? (lead.paymentMethod || '--') : getLeadClientPurposeLabel(lead.clientPurpose))}</strong></div>
              <div class="detail-cell"><small>Next Follow-up</small><strong>${escapeHtml([lead.nextFollowUpDate || '', lead.nextFollowUpTime || ''].filter(Boolean).join(' ') || 'Not set')}</strong></div>
            </div>

            <div class="record-summary">
              <div class="muted"><strong>Private Notes:</strong> ${escapeHtml(lead.privateNotes || 'No private notes yet')}</div>
              <div class="muted"><strong>Public-safe Summary:</strong> ${escapeHtml(lead.publicGeneralNotes || 'No public summary yet')}</div>
              <div class="record-meta-row">
                <span>Calls: ${escapeHtml(lead.callCount || 0)}</span>
                <span>WhatsApp: ${escapeHtml(lead.whatsappCount || 0)}</span>
                <span>Last Contacted: ${escapeHtml(formatLastContactLabel(lead.lastContactedAt))}</span>
                <span>Last Method: ${escapeHtml(lead.lastContactMethod || '--')}</span>
              </div>
            </div>

            <div class="record-actions">
              <button class="btn btn-secondary btn-tiny" type="button" onclick="editLead(${lead.id})">Edit</button>
              <button class="btn btn-secondary btn-tiny" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'call', this)">Call</button>
              <button class="btn btn-success btn-tiny" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'whatsapp')">WhatsApp</button>
              <button class="btn ${getBcpShareButtonClass(lead.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)" title="${lead.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(lead.isListedPublic)}</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="${lead.isArchived ? `restoreLead(${lead.id})` : `archiveLead(${lead.id})`}">${lead.isArchived ? 'Restore' : 'Archive'}</button>
              <button class="btn btn-danger btn-tiny" type="button" onclick="deleteLead(${lead.id})">Delete</button>
            </div>

            <details class="record-details-panel">
              <summary>Workflow tools, matches, and history</summary>
              <div class="workflow-strip">
                <select id="lead-status-action-${lead.id}">
                  ${DASHBOARD_LEAD_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(lead.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="changeLeadStatus(${lead.id})">Update Status</button>
              </div>
              <div class="record-inline-grid">
                <div class="field-block">
                  <label class="small" for="lead-followup-date-${lead.id}">Next Follow-up Date</label>
                  <input id="lead-followup-date-${lead.id}" type="date" value="${escapeHtml(lead.nextFollowUpDate || '')}">
                </div>
                <div class="field-block">
                  <label class="small" for="lead-followup-time-${lead.id}">Next Follow-up Time</label>
                  <input id="lead-followup-time-${lead.id}" type="time" value="${escapeHtml(lead.nextFollowUpTime || '')}">
                </div>
                <div class="field-block full">
                  <label class="small" for="lead-followup-note-${lead.id}">Follow-up Note</label>
                  <textarea id="lead-followup-note-${lead.id}" placeholder="Add next-step note">${escapeHtml(lead.followUpNote || '')}</textarea>
                </div>
                <label class="toggle-card compact-toggle">
                  <input id="lead-followup-urgent-${lead.id}" type="checkbox" ${lead.isUrgentFollowUp ? 'checked' : ''}>
                  <span><strong>Urgent Reminder</strong><small>Flag this lead as urgent.</small></span>
                </label>
              </div>
              <div class="workflow-strip">
                <button class="btn btn-primary btn-tiny" type="button" onclick="saveLeadFollowUp(${lead.id})">Save Follow-up</button>
              </div>
              <div>
                <h4>Matching Listings</h4>
                ${renderLeadMatches(lead)}
              </div>
              <div>
                <h4>Activity History</h4>
                ${renderActivityTimeline(lead.activityLog)}
              </div>
            </details>
          </div>
        `;
      }).join('');
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = `<div class="empty">No listings match your current filters. Adjust your filters or add a new listing from Overview.</div>`;
        return;
      }

      target.innerHTML = properties.map(property => {
        const followUpState = getFollowUpStateInfo(property);
        const ownerPhone = String(property.ownerPhone || '').trim();
        return `
          <div class="item-card ${property.isDistress ? 'distress-card' : ''}">
            <div class="item-top">
              <div class="item-title">
                <h4>${escapeHtml(joinDisplayParts([getPropertyPurposeLabel(property.purpose), property.propertyType || 'Listing']))}</h4>
                <div class="muted">${escapeHtml(joinDisplayParts([property.location, property.buildingName, getPropertyDisplayPrice(property)]))}</div>
              </div>
              <div class="badges">
                <span class="badge ${badgeClass(property.status)}">${escapeHtml(formatStatusLabel(property.status || 'available'))}</span>
                <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                ${property.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                ${property.isDistress ? '<span class="badge badge-red">Distress</span>' : ''}
                ${property.matchCount ? `<span class="badge badge-match">${property.matchCount} Match${property.matchCount === 1 ? '' : 'es'}</span>` : ''}
                ${property.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-cell"><small>Owner Name</small><strong>${renderPrivateNameValue('property', property.id, property.ownerName, 'Private contact')}</strong></div>
              <div class="detail-cell"><small>Owner Phone</small><strong>${renderPrivatePhoneValue('property', property.id, property.ownerPhone)}</strong></div>
              <div class="detail-cell"><small>Terms</small><strong>${escapeHtml(getPropertyTermsSummary(property))}</strong></div>
              <div class="detail-cell"><small>Next Follow-up</small><strong>${escapeHtml([property.nextFollowUpDate || '', property.nextFollowUpTime || ''].filter(Boolean).join(' ') || 'Not set')}</strong></div>
            </div>

            <div class="record-summary">
              <div class="muted"><strong>Internal Notes:</strong> ${escapeHtml(property.internalNotes || 'No internal notes yet')}</div>
              <div class="muted"><strong>Public Notes:</strong> ${escapeHtml(property.publicNotes || 'No public note added')}</div>
              <div class="record-meta-row">
                <span>Calls: ${escapeHtml(property.ownerCallCount || 0)}</span>
                <span>WhatsApp: ${escapeHtml(property.ownerWhatsappCount || 0)}</span>
                <span>Last Contacted: ${escapeHtml(formatLastContactLabel(property.lastOwnerContactedAt))}</span>
                <span>Last Method: ${escapeHtml(property.lastOwnerContactMethod || '--')}</span>
              </div>
            </div>

            <div class="record-actions">
              <button class="btn btn-secondary btn-tiny" type="button" onclick="editProperty(${property.id})">Edit</button>
              <button class="btn btn-secondary btn-tiny" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'call', this)">Call Owner</button>
              <button class="btn btn-success btn-tiny" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'whatsapp')">WhatsApp Owner</button>
              <button class="btn ${getBcpShareButtonClass(property.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)" title="${property.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(property.isListedPublic)}</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="${property.isArchived ? `restoreProperty(${property.id})` : `archiveProperty(${property.id})`}">${property.isArchived ? 'Restore' : 'Archive'}</button>
              <button class="btn btn-danger btn-tiny" type="button" onclick="deleteProperty(${property.id})">Delete</button>
            </div>

            <details class="record-details-panel">
              <summary>Workflow tools, matches, and history</summary>
              <div class="workflow-strip">
                <select id="property-status-action-${property.id}">
                  ${DASHBOARD_LISTING_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(property.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="changePropertyStatus(${property.id})">Update Status</button>
              </div>
              <div class="record-inline-grid">
                <div class="field-block">
                  <label class="small" for="property-followup-date-${property.id}">Next Follow-up Date</label>
                  <input id="property-followup-date-${property.id}" type="date" value="${escapeHtml(property.nextFollowUpDate || '')}">
                </div>
                <div class="field-block">
                  <label class="small" for="property-followup-time-${property.id}">Next Follow-up Time</label>
                  <input id="property-followup-time-${property.id}" type="time" value="${escapeHtml(property.nextFollowUpTime || '')}">
                </div>
                <div class="field-block full">
                  <label class="small" for="property-followup-note-${property.id}">Follow-up Note</label>
                  <textarea id="property-followup-note-${property.id}" placeholder="Add next owner or viewing reminder">${escapeHtml(property.followUpNote || '')}</textarea>
                </div>
                <label class="toggle-card compact-toggle">
                  <input id="property-followup-urgent-${property.id}" type="checkbox" ${property.isUrgentFollowUp ? 'checked' : ''}>
                  <span><strong>Urgent Reminder</strong><small>Flag this listing for urgent owner follow-up.</small></span>
                </label>
              </div>
              <div class="workflow-strip">
                <button class="btn btn-primary btn-tiny" type="button" onclick="savePropertyFollowUp(${property.id})">Save Follow-up</button>
              </div>
              <div>
                <h4>Matching Leads</h4>
                ${renderPropertyMatches(property)}
              </div>
              <div>
                <h4>Activity History</h4>
                ${renderActivityTimeline(property.activityLog)}
              </div>
            </details>
          </div>
        `;
      }).join('');
    }

    function getLeadPreservedState() {
      const original = state.leadEditorOriginal || {};
      return {
        source: original.source || 'Manual',
        priority: original.priority || 'normal',
        status: original.status || 'new',
        meetingDate: original.meetingDate || '',
        meetingTime: original.meetingTime || '',
        nextAction: original.nextAction || '',
        ownerName: original.ownerName || '',
        ownerPhone: original.ownerPhone || '',
        legacyFollowUpNotes: original.legacyFollowUpNotes || original.followUpNotes || '',
        nextFollowUpDate: original.nextFollowUpDate || '',
        nextFollowUpTime: original.nextFollowUpTime || '',
        followUpNote: original.followUpNote || '',
        isUrgentFollowUp: Boolean(original.isUrgentFollowUp),
        rentChecklist: original.rentChecklist || {
          booking: false,
          agreementSigned: false,
          handoverDone: false
        },
        saleChecklist: original.saleChecklist || {
          contractA: false,
          contractB: false,
          contractF: false
        }
      };
    }

    function collectLeadFormData() {
      const preserved = getLeadPreservedState();
      const dimensions = syncLeadPropertyDimensionControls();
      return {
        id: Number(document.getElementById('leadId').value || 0),
        clientPurpose: document.getElementById('leadClientPurpose').value,
        location: document.getElementById('leadLocation').value.trim(),
        preferredBuildingProject: document.getElementById('leadBuildingProject').value.trim(),
        propertyType: dimensions.propertyType || '',
        propertyCategory: dimensions.propertyCategory || '',
        unitLayout: dimensions.unitLayout || '',
        budget: normalizeBudgetDigits(document.getElementById('leadBudget').value),
        paymentMethod: document.getElementById('leadPaymentMethod').value.trim(),
        clientName: document.getElementById('leadClientName').value.trim(),
        clientPhone: normalizeLeadPhoneInput(document.getElementById('leadClientPhone').value.trim()),
        privateNotes: document.getElementById('leadPrivateNotes').value.trim(),
        publicGeneralNotes: '',
        source: preserved.source,
        priority: preserved.priority,
        status: document.getElementById('leadStatus').value || preserved.status,
        meetingDate: preserved.meetingDate,
        meetingTime: preserved.meetingTime,
        nextAction: preserved.nextAction,
        nextFollowUpDate: document.getElementById('leadNextFollowUpDate').value,
        nextFollowUpTime: document.getElementById('leadNextFollowUpTime').value,
        followUpNote: document.getElementById('leadFollowUpNote').value.trim(),
        isUrgentFollowUp: document.getElementById('leadUrgentFollowUp').checked,
        ownerName: preserved.ownerName,
        ownerPhone: preserved.ownerPhone,
        legacyFollowUpNotes: preserved.legacyFollowUpNotes,
        rentChecklist: preserved.rentChecklist,
        saleChecklist: preserved.saleChecklist
      };
    }

    function validateLeadFormData(formData) {
      const errors = {};
      if (!formData.clientPurpose) errors.clientPurpose = 'Select client purpose';
      if (!formData.location) errors.location = 'Enter preferred location';
      if (!formData.propertyType) errors.propertyType = 'Select property type';
      if (!formData.budget || Number(formData.budget) <= 0) errors.budget = 'Enter budget';
      if (getLeadClientPurpose(formData.clientPurpose) === 'buy' && !formData.paymentMethod) {
        errors.paymentMethod = 'Select payment method';
      }
      if (!formData.clientName) errors.clientName = 'Enter client name';
      const phoneDigits = formData.clientPhone.replace(/[^\d]/g, '');
      if (!formData.clientPhone || phoneDigits.length < 8) {
        errors.clientPhone = 'Enter client phone number';
      }
      return errors;
    }

    function resetLeadForm() {
      document.getElementById('leadForm').reset();
      document.getElementById('leadId').value = '';
      document.getElementById('leadSubmitBtn').textContent = 'Save Lead';
      state.leadEditorOriginal = null;
      setLeadWorkspaceHeader('create');
      clearLeadErrors();
      setLeadPurpose('', { preserveValues: false });
      document.getElementById('leadLocation').value = '';
      document.getElementById('leadBuildingProject').value = '';
      document.getElementById('leadBudget').value = '';
      document.getElementById('leadClientName').value = '';
      document.getElementById('leadClientPhone').value = '';
      document.getElementById('leadPrivateNotes').value = '';
      document.getElementById('leadStatus').value = 'new';
      document.getElementById('leadNextFollowUpDate').value = '';
      document.getElementById('leadNextFollowUpTime').value = '';
      document.getElementById('leadFollowUpNote').value = '';
      document.getElementById('leadUrgentFollowUp').checked = false;
      leadAutocompleteControllers.location?.close();
      leadAutocompleteControllers.building?.close();
      syncWorkspaceFormSummary('lead');
    }

    function editLead(id) {
      const lead = state.leads.find(item => item.id === id);
      if (!lead) return;
      state.leadEditorOriginal = lead;
      showOverviewWorkspace('lead');
      setLeadWorkspaceHeader('edit');
      clearLeadErrors();
      document.getElementById('leadId').value = lead.id;
      const clientPurpose = getLeadClientPurposeFromRecord(lead);
      setLeadPurpose(clientPurpose, { preserveValues: false });
      document.getElementById('leadLocation').value = lead.location || '';
      document.getElementById('leadBuildingProject').value = lead.preferredBuildingProject || '';
      syncLeadPropertyDimensionControls(lead);
      document.getElementById('leadBudget').value = normalizeBudgetDigits(lead.budget || '');
      populateLeadPaymentMethodOptions(lead.paymentMethod || '');
      document.getElementById('leadClientName').value = lead.clientName || '';
      document.getElementById('leadClientPhone').value = lead.clientPhone || '';
      document.getElementById('leadPrivateNotes').value = lead.privateNotes || lead.notes || '';
      document.getElementById('leadStatus').value = lead.status || 'new';
      document.getElementById('leadNextFollowUpDate').value = lead.nextFollowUpDate || '';
      document.getElementById('leadNextFollowUpTime').value = lead.nextFollowUpTime || '';
      document.getElementById('leadFollowUpNote').value = lead.followUpNote || '';
      document.getElementById('leadUrgentFollowUp').checked = Boolean(lead.isUrgentFollowUp);
      document.getElementById('leadSubmitBtn').textContent = 'Update Lead';
      syncWorkspaceFormSummary('lead');
    }

    function getPropertyPreservedState() {
      const original = state.propertyEditorOriginal || {};
      return {
        status: original.status || 'available',
        nextFollowUpDate: original.nextFollowUpDate || '',
        nextFollowUpTime: original.nextFollowUpTime || '',
        followUpNote: original.followUpNote || '',
        isUrgentFollowUp: Boolean(original.isUrgentFollowUp),
        bedrooms: original.bedrooms ?? null,
        bathrooms: original.bathrooms ?? null
      };
    }

    function collectPropertyFormData() {
      const preserved = getPropertyPreservedState();
      const purpose = getPropertyPurpose(document.getElementById('propertyPurposeValue').value);
      const dimensions = syncPropertyDimensionControls();
      const salePropertyStatus = purpose === 'sale'
        ? (normalizeDashboardSalePropertyStatusValue(document.getElementById('propertySaleStatus').value) || 'Ready Property')
        : '';
      const handoverQuarter = purpose === 'sale' && salePropertyStatus === 'Off Plan Property'
        ? normalizeDashboardHandoverQuarterValue(document.getElementById('propertyHandoverQuarter').value)
        : '';
      const handoverYear = purpose === 'sale' && salePropertyStatus === 'Off Plan Property'
        ? normalizeDashboardHandoverYearValue(document.getElementById('propertyHandoverYear').value)
        : '';
      const handoverLabel = formatPropertyHandoverDisplay(handoverQuarter, handoverYear);
      const distressDeal = document.getElementById('propertyDistress').checked;
      const marketPrice = normalizeBudgetDigits(document.getElementById('propertyMarketPrice').value);
      const activePrice = purpose === 'sale'
        ? normalizeBudgetDigits(document.getElementById('propertySalePrice').value)
        : normalizeBudgetDigits(document.getElementById('propertyRentPrice').value);
      const distressDiscountPercent = distressDeal && Number(marketPrice || 0) > 0 && Number(activePrice || 0) > 0 && Number(marketPrice || 0) > Number(activePrice || 0)
        ? Math.round(((Number(marketPrice) - Number(activePrice)) / Number(marketPrice)) * 100)
        : '';
      return {
        id: Number(document.getElementById('propertyId').value || 0),
        purpose,
        propertyType: dimensions.propertyType || '',
        propertyCategory: dimensions.propertyCategory || '',
        unitLayout: dimensions.unitLayout || '',
        location: normalizeDashboardLocationValue(document.getElementById('propertyLocation').value),
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
        salePropertyStatus,
        handoverQuarter,
        handoverYear,
        handoverLabel,
        leasehold: document.getElementById('propertyLeasehold').checked,
        distressDeal,
        marketPrice,
        distressAskingPrice: distressDeal ? activePrice : '',
        distressDiscountPercent,
        distressGapPercent: distressDiscountPercent,
        listingImages: state.propertyImageDraftLoaded ? state.propertyImageDraft : undefined,
        ownerName: document.getElementById('propertyOwnerName').value.trim(),
        ownerPhone: normalizeLeadPhoneInput(document.getElementById('propertyOwnerPhone').value.trim()),
        internalNotes: document.getElementById('propertyInternalNotes').value.trim(),
        publicNotes: document.getElementById('propertyPublicNotes').value.trim(),
        status: document.getElementById('propertyStatus').value || preserved.status,
        nextFollowUpDate: document.getElementById('propertyNextFollowUpDate').value,
        nextFollowUpTime: document.getElementById('propertyNextFollowUpTime').value,
        followUpNote: document.getElementById('propertyFollowUpNote').value.trim(),
        isUrgentFollowUp: document.getElementById('propertyUrgentFollowUp').checked,
        bedrooms: preserved.bedrooms,
        bathrooms: preserved.bathrooms
      };
    }

    function validatePropertyFormData(formData) {
      const errors = {};
      if (!formData.purpose) errors.purpose = 'Select purpose';
      if (!formData.propertyType) errors.propertyType = 'Select property type';
      if (!formData.location) errors.location = 'Enter location';
      if (formData.purpose === 'rent' && (!formData.rentPrice || Number(formData.rentPrice) <= 0)) {
        errors.rentPrice = 'Enter rent price';
      }
      if (formData.purpose === 'sale' && (!formData.ownerAskingPrice || Number(formData.ownerAskingPrice) <= 0)) {
        errors.ownerAskingPrice = 'Enter owner asking price';
      }
      if (formData.purpose === 'sale' && !formData.salePropertyStatus) {
        errors.salePropertyStatus = 'Select sale status';
      }
      if (formData.purpose === 'sale' && formData.salePropertyStatus === 'Off Plan Property' && !formData.handoverQuarter) {
        errors.handoverQuarter = 'Select handover quarter';
      }
      if (formData.purpose === 'sale' && formData.salePropertyStatus === 'Off Plan Property' && normalizeDashboardHandoverYearValue(formData.handoverYear).length !== 4) {
        errors.handoverYear = 'Enter handover year';
      }
      if (formData.distressDeal && (!formData.marketPrice || Number(formData.marketPrice) <= 0)) {
        errors.marketPrice = 'Enter market price';
      }
      return errors;
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
      document.getElementById('propertyMarketPrice').value = '';
      document.getElementById('propertySaleStatus').value = 'Ready Property';
      document.getElementById('propertyHandoverQuarter').value = '';
      document.getElementById('propertyHandoverYear').value = '';
      document.getElementById('propertyOwnerName').value = '';
      document.getElementById('propertyOwnerPhone').value = '';
      document.getElementById('propertyInternalNotes').value = '';
      document.getElementById('propertyPublicNotes').value = '';
      document.getElementById('propertyStatus').value = 'available';
      document.getElementById('propertyNextFollowUpDate').value = '';
      document.getElementById('propertyNextFollowUpTime').value = '';
      document.getElementById('propertyFollowUpNote').value = '';
      document.getElementById('propertyUrgentFollowUp').checked = false;
      document.getElementById('propertySubmitBtn').textContent = 'Save Listing';
      state.propertyImageDraft = [];
      state.propertyImageDraftLoaded = true;
      state.propertyImageDraftDirty = false;
      setPropertyImagesError('');
      const propertyImagesInput = document.getElementById('propertyImagesInput');
      if (propertyImagesInput) propertyImagesInput.value = '';
      syncPropertyDimensionControls();
      propertyAutocompleteControllers.location?.close();
      propertyAutocompleteControllers.building?.close();
      refreshPropertyDistressUI();
      updatePropertyImageUploadUi();
      syncWorkspaceFormSummary('property');
    }

    async function editProperty(id) {
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
      document.getElementById('propertyMarketPrice').value = normalizeBudgetDigits(property.marketPrice || '');
      document.getElementById('propertyMortgageStatus').value = property.mortgageStatus || '';
      document.getElementById('propertySaleStatus').value = normalizeDashboardSalePropertyStatusValue(property.salePropertyStatus) || 'Ready Property';
      document.getElementById('propertyHandoverQuarter').value = normalizeDashboardHandoverQuarterValue(property.handoverQuarter);
      document.getElementById('propertyHandoverYear').value = normalizeDashboardHandoverYearValue(property.handoverYear);
      document.getElementById('propertyLeasehold').checked = Boolean(property.leasehold);
      document.getElementById('propertyPublicNotes').value = property.publicNotes || '';
      document.getElementById('propertyInternalNotes').value = property.internalNotes || '';
      document.getElementById('propertyOwnerName').value = property.ownerName || '';
      document.getElementById('propertyOwnerPhone').value = property.ownerPhone || '';
      document.getElementById('propertyDistress').checked = Boolean(property.isDistress);
      document.getElementById('propertyStatus').value = property.status || 'available';
      document.getElementById('propertyNextFollowUpDate').value = property.nextFollowUpDate || '';
      document.getElementById('propertyNextFollowUpTime').value = property.nextFollowUpTime || '';
      document.getElementById('propertyFollowUpNote').value = property.followUpNote || '';
      document.getElementById('propertyUrgentFollowUp').checked = Boolean(property.isUrgentFollowUp);
      document.getElementById('propertySubmitBtn').textContent = 'Update Listing';
      setPropertyImagesError('');
      const propertyImagesInput = document.getElementById('propertyImagesInput');
      if (propertyImagesInput) propertyImagesInput.value = '';
      const cacheKey = String(property.id);
      if (state.propertyMediaCache[cacheKey]) {
        setPropertyImages(state.propertyMediaCache[cacheKey], { loaded: true, dirty: false });
      } else if (Number(property.listingImageCount || 0) > 0) {
        state.propertyImageDraft = [];
        state.propertyImageDraftLoaded = false;
        state.propertyImageDraftDirty = false;
        updatePropertyImageUploadUi({ loading: true, countHint: property.listingImageCount });
        try {
          const images = await fetchPropertyMedia(property.id);
          if (String(document.getElementById('propertyId')?.value || '') === cacheKey) {
            setPropertyImages(images, { loaded: true, dirty: false, cacheKey });
          }
        } catch (error) {
          if (String(document.getElementById('propertyId')?.value || '') === cacheKey) {
            updatePropertyImageUploadUi({ loading: false, countHint: 0 });
            setPropertyImagesError(error?.message || 'Could not load existing pictures.');
          }
        }
      } else {
        setPropertyImages([], { loaded: true, dirty: false });
      }
      refreshPropertySaleStatusUI();
      refreshPropertyDistressUI();
      syncWorkspaceFormSummary('property');
    }

    function wireLeadFormSubmission() {
      const currentForm = document.getElementById('leadForm');
      if (!currentForm || currentForm.dataset.wired === 'true') return;
      const nextForm = currentForm.cloneNode(true);
      currentForm.parentNode.replaceChild(nextForm, currentForm);
      nextForm.dataset.wired = 'true';

      nextForm.addEventListener('submit', async event => {
        event.preventDefault();
        const submitButton = event.submitter || nextForm.querySelector('[type="submit"]');
        clearLeadErrors();
        const formData = collectLeadFormData();
        const validationErrors = validateLeadFormData(formData);
        if (Object.keys(validationErrors).length) {
          Object.entries(validationErrors).forEach(([field, message]) => setLeadFieldError(field, message));
          setStatus('Please complete the required lead details.', 'error');
          return;
        }

        const payload = {
          action: formData.id ? 'update-lead' : 'create-lead',
          id: formData.id,
          clientPurpose: formData.clientPurpose,
          purpose: formData.clientPurpose,
          propertyType: formData.propertyType,
          category: formData.propertyType,
          propertyCategory: formData.propertyCategory,
          unitLayout: formData.unitLayout,
          location: formData.location,
          budget: formData.budget,
          preferredBuildingProject: formData.preferredBuildingProject,
          paymentMethod: formData.paymentMethod,
          privateNotes: formData.privateNotes,
          publicGeneralNotes: buildLeadPublicSummary(formData),
          source: formData.source,
          priority: formData.priority,
          status: formData.status,
          meetingDate: formData.meetingDate,
          meetingTime: formData.meetingTime,
          nextAction: formData.nextAction,
          nextFollowUpDate: formData.nextFollowUpDate,
          nextFollowUpTime: formData.nextFollowUpTime,
          followUpNote: formData.followUpNote,
          isUrgentFollowUp: formData.isUrgentFollowUp,
          ownerName: formData.ownerName,
          ownerPhone: formData.ownerPhone,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          legacyFollowUpNotes: formData.legacyFollowUpNotes,
          rentChecklist: formData.rentChecklist,
          saleChecklist: formData.saleChecklist
        };

        try {
          await dashboardAction(payload, formData.id ? 'Requirement updated successfully.' : 'Requirement saved successfully.', {
            button: submitButton,
            loadingText: formData.id ? 'Updating Requirement...' : 'Saving Requirement...'
          });
          resetLeadForm();
          hideOverviewWorkspace();
        } catch (error) {
          setStatus(error.message, 'error');
        }
      });
    }

    function wirePropertyFormSubmission() {
      const currentForm = document.getElementById('propertyForm');
      if (!currentForm || currentForm.dataset.wired === 'true') return;
      const nextForm = currentForm.cloneNode(true);
      currentForm.parentNode.replaceChild(nextForm, currentForm);
      nextForm.dataset.wired = 'true';

      nextForm.addEventListener('submit', async event => {
        event.preventDefault();
        const submitButton = event.submitter || nextForm.querySelector('[type="submit"]');
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
          nextFollowUpDate: formData.nextFollowUpDate,
          nextFollowUpTime: formData.nextFollowUpTime,
          followUpNote: formData.followUpNote,
          isUrgentFollowUp: formData.isUrgentFollowUp,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          legacyDescription: formData.legacyDescription
        };

        try {
          const result = await dashboardAction(payload, formData.id ? 'Listing updated successfully.' : 'Listing saved successfully.', {
            button: submitButton,
            loadingText: formData.id ? 'Updating Listing...' : 'Saving Listing...'
          });
          let savedProperty = result?.property || null;
          if (savedProperty?.id && formData.listingImages !== undefined && state.propertyImageDraftDirty) {
            const mediaResult = await savePropertyMedia(savedProperty.id, formData.listingImages);
            savedProperty = mediaResult.property || savedProperty;
          } else if (savedProperty?.id && formData.listingImages !== undefined) {
            state.propertyMediaCache[String(savedProperty.id)] = window.ListingMediaUi?.sanitizeImageList(formData.listingImages) || [];
          }
          resetPropertyForm();
          hideOverviewWorkspace();
        } catch (error) {
          setStatus(error.message, 'error');
        }
      });
    }

    async function changeLeadStatus(id) {
      const nextStatus = document.getElementById(`lead-status-action-${id}`)?.value;
      if (!nextStatus) return;
      try {
        await dashboardAction({ action: 'update-lead-status', id, status: nextStatus }, 'Requirement updated successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Updating...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function changePropertyStatus(id) {
      const nextStatus = document.getElementById(`property-status-action-${id}`)?.value;
      if (!nextStatus) return;
      try {
        await dashboardAction({ action: 'update-property-status', id, status: nextStatus }, 'Listing updated successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Updating...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function saveLeadFollowUp(id) {
      try {
        await dashboardAction({
          action: 'set-lead-followup',
          id,
          nextFollowUpDate: document.getElementById(`lead-followup-date-${id}`)?.value || '',
          nextFollowUpTime: document.getElementById(`lead-followup-time-${id}`)?.value || '',
          followUpNote: document.getElementById(`lead-followup-note-${id}`)?.value || '',
          isUrgentFollowUp: Boolean(document.getElementById(`lead-followup-urgent-${id}`)?.checked)
        }, 'Requirement follow-up saved successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Saving Follow-up...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function savePropertyFollowUp(id) {
      try {
        await dashboardAction({
          action: 'set-property-followup',
          id,
          nextFollowUpDate: document.getElementById(`property-followup-date-${id}`)?.value || '',
          nextFollowUpTime: document.getElementById(`property-followup-time-${id}`)?.value || '',
          followUpNote: document.getElementById(`property-followup-note-${id}`)?.value || '',
          isUrgentFollowUp: Boolean(document.getElementById(`property-followup-urgent-${id}`)?.checked)
        }, 'Listing follow-up saved successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Saving Follow-up...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function contactLead(id, method, anchor) {
      const lead = state.leads.find(item => item.id === id);
      if (!lead?.clientPhone) {
        setStatus('Client phone number is not available for this lead.', 'error');
        return;
      }
      const phoneDigits = String(lead.clientPhone).replace(/[^\d]/g, '');
      if (method === 'call') {
        openDashboardCallPopover(anchor, lead.clientPhone, {
          label: 'Client phone',
          emptyMessage: 'Client phone number is not available for this lead.',
          onConfirm: () => dashboardAction({ action: 'track-lead-contact', id, method }).catch(error => {
            console.error('Lead call tracking failed', error);
          })
        });
        return;
      } else {
        const message = encodeURIComponent('Hello, I am following up regarding your property requirement.');
        window.open(`https://wa.me/${phoneDigits}?text=${message}`, '_blank', 'noopener');
      }
      try {
        await dashboardAction({ action: 'track-lead-contact', id, method });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function contactPropertyOwner(id, method, anchor) {
      const property = state.properties.find(item => item.id === id);
      if (!property?.ownerPhone) {
        setStatus('Owner phone number is not available for this listing.', 'error');
        return;
      }
      const phoneDigits = String(property.ownerPhone).replace(/[^\d]/g, '');
      if (method === 'call') {
        openDashboardCallPopover(anchor, property.ownerPhone, {
          label: 'Owner phone',
          emptyMessage: 'Owner phone number is not available for this listing.',
          onConfirm: () => dashboardAction({ action: 'track-property-contact', id, method }).catch(error => {
            console.error('Listing call tracking failed', error);
          })
        });
        return;
      } else {
        const message = encodeURIComponent('Hello, I am following up regarding your property listing.');
        window.open(`https://wa.me/${phoneDigits}?text=${message}`, '_blank', 'noopener');
      }
      try {
        await dashboardAction({ action: 'track-property-contact', id, method });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function archiveLead(id) {
      try {
        await dashboardAction({ action: 'archive-lead', id }, 'Requirement archived successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Archiving Requirement...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function restoreLead(id) {
      try {
        await dashboardAction({ action: 'restore-lead', id }, 'Requirement restored successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Restoring Requirement...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function archiveProperty(id) {
      try {
        await dashboardAction({ action: 'archive-property', id }, 'Listing archived successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Archiving Listing...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function restoreProperty(id) {
      try {
        await dashboardAction({ action: 'restore-property', id }, 'Listing restored successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Restoring Listing...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
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

    function markWorkflowNotificationDone(event, element) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const key = String(element?.dataset?.notificationKey || '').trim();
      if (!key) return;
      markNotificationRead(key);
      if (state.activeNotificationKey === key) {
        state.activeNotificationKey = '';
      }
      renderWorkflowAlerts();
      setStatus('Notification marked done.', 'success');
    }

    function snoozeWorkflowNotification(event, element) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const key = String(element?.dataset?.notificationKey || '').trim();
      if (!key) return;
      markNotificationRead(key);
      if (state.activeNotificationKey === key) {
        state.activeNotificationKey = '';
      }
      renderWorkflowAlerts();
      setStatus('Notification snoozed for now.', 'success');
    }

    function renderNotificationAlertItems(items, limit = 8) {
      const unreadEntries = getUnreadNotificationItems(items);
      if (!unreadEntries.length) {
        return '<div class="overview-empty-state"><strong>No urgent work right now.</strong><span>Your workflow looks clear.</span></div>';
      }
      return unreadEntries.slice(0, limit).map(entry => {
        const item = entry.item;
        const notificationKey = entry.key;
        const isSelected = notificationKey === state.activeNotificationKey;
        const createdLabel = formatDashboardRelativeTime(item.createdAt || item.updatedAt || new Date().toISOString())
          || formatDateTime(item.createdAt || item.updatedAt || new Date().toISOString());
        return `
          <div
            class="workflow-alert-item is-clickable ${isSelected ? 'is-selected' : ''}"
            data-notification-key="${escapeHtml(notificationKey)}"
            role="button"
            tabindex="0"
            onclick="openWorkflowNotificationFromElement(this)"
            onkeydown="handleWorkflowNotificationKeydown(event, this)"
          >
            <strong>${escapeHtml(item.title || 'Notification')}</strong>
            <div class="muted">${escapeHtml(item.message || '')}</div>
            <small>${escapeHtml(createdLabel)}</small>
            <div class="workflow-alert-actions" aria-label="Notification actions">
              <button class="btn btn-secondary btn-tiny" type="button" data-notification-key="${escapeHtml(notificationKey)}" onclick="event.stopPropagation();openWorkflowNotificationFromElement(this.closest('.workflow-alert-item'))">Open</button>
              <button class="btn btn-secondary btn-tiny" type="button" data-notification-key="${escapeHtml(notificationKey)}" onclick="markWorkflowNotificationDone(event, this)">Mark Done</button>
              <button class="btn btn-secondary btn-tiny" type="button" data-notification-key="${escapeHtml(notificationKey)}" onclick="snoozeWorkflowNotification(event, this)">Snooze</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderWorkflowAlerts() {
      const alertsTarget = document.getElementById('workflowAlertsList');
      const panelListTarget = document.getElementById('notificationPanelList');
      const matchesTarget = document.getElementById('workflowMatchesList');
      const todayActionsTarget = document.getElementById('overviewTodayActions');
      const notifications = getWorkflowNotificationItems();
      const allNotifications = getNotificationItems();
      const aiMatches = getVisibleMatchItems();
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.debug('matchCount value:', aiMatches.length);
      }

      const notificationsMarkup = renderNotificationAlertItems(notifications, 8);
      if (alertsTarget) {
        alertsTarget.innerHTML = notificationsMarkup;
      }
      if (panelListTarget) {
        panelListTarget.innerHTML = renderNotificationAlertItems(allNotifications, 8);
      }
      if (todayActionsTarget) {
        todayActionsTarget.innerHTML = renderOverviewTodayActions(getUnreadNotificationItems(notifications));
      }
      syncNotificationIndicator();

      if (matchesTarget) {
        matchesTarget.innerHTML = aiMatches.length
          ? aiMatches.slice(0, 6).map(match => {
              const matchIndex = aiMatches.indexOf(match);
              const matchKey = getMatchKey(match, matchIndex);
              const isSelected = matchKey === state.activeMatchKey;
              const isRead = isMatchRead(matchKey);
              const lead = getWorkflowMatchInternalLead(match);
              const property = getWorkflowMatchInternalProperty(match);
              const isInternalMatch = String(match.internalType || '').toLowerCase() === 'internal'
                || String(match.visibilityScope || '').toLowerCase() === 'internal';
              const counterpartLabel = String(match.counterpartType || '').toLowerCase() === 'lead'
                ? 'Shared Requirement'
                : 'Shared Listing';
              const summaryBits = [
                lead?.location || property?.location || match.counterpartLocation || '',
                lead?.propertyType || property?.propertyType || match.counterpartPropertyType || ''
              ].filter(Boolean).join(' | ');
              return `
                <div
                  class="workflow-alert-item is-clickable ${isSelected ? 'is-selected' : ''} ${isRead ? 'is-read' : ''}"
                  data-match-key="${escapeHtml(matchKey)}"
                  role="button"
                  tabindex="0"
                  onclick="openWorkflowMatchFromElement(this)"
                  onkeydown="handleWorkflowMatchKeydown(event, this)"
                >
                  <strong>${escapeHtml(match.status === 'strong' ? 'Strong Match' : 'Partial Match')}</strong>
                  <div class="muted">${escapeHtml(
                    isInternalMatch
                      ? `Your Requirement #${match.requirementId || ''} <-> Your Listing #${match.propertyId || ''}`
                      : String(match.internalType || '').toLowerCase() === 'lead'
                      ? `Your Requirement #${match.internalId || match.requirementId} <-> ${counterpartLabel}`
                      : `Your Listing #${match.internalId || match.propertyId} <-> ${counterpartLabel}`
                  )}</div>
                  <div class="muted">${escapeHtml(match.matchReason || '')}</div>
                  ${summaryBits ? `<small>${escapeHtml(summaryBits)}</small>` : ''}
                  <div class="workflow-alert-meta-row">
                    <small>${escapeHtml(formatMatchExpiryLabel(matchKey))}</small>
                    <button
                      class="btn btn-secondary btn-tiny workflow-match-remove-btn"
                      type="button"
                      data-match-key="${escapeHtml(matchKey)}"
                      onclick="removeWorkflowMatchFromElement(event, this)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              `;
            }).join('')
          : '<div class="empty">No match opportunities found yet.</div>';
      }
    }

    function renderLeadMatches(lead) {
      const matches = Array.isArray(lead.matchingListings) ? lead.matchingListings : [];
      if (!matches.length) return '<div class="empty">No matching listings yet.</div>';
      return `<div class="match-list">${matches.slice(0, 8).map(match => `
        <div class="match-item">
          <strong>${escapeHtml(match.confidence === 'strong' ? 'Strong Match' : 'Partial Match')} | Listing #${escapeHtml(match.id)}</strong>
          <div class="muted">${escapeHtml([match.propertyType, match.location, match.price].filter(Boolean).join(' | '))}</div>
          <small>${escapeHtml(match.matchReason || '')}</small>
        </div>
      `).join('')}</div>`;
    }

    function renderPropertyMatches(property) {
      const matches = Array.isArray(property.matchingLeads) ? property.matchingLeads : [];
      if (!matches.length) return '<div class="empty">No matching leads yet.</div>';
      return `<div class="match-list">${matches.slice(0, 8).map(match => `
        <div class="match-item">
          <strong>${escapeHtml(match.confidence === 'strong' ? 'Strong Match' : 'Partial Match')} | Lead #${escapeHtml(match.id)}</strong>
          <div class="muted">${escapeHtml([formatStatusLabel(match.clientPurpose), match.propertyType, match.location, formatBudgetLabel(match.budget)].filter(Boolean).join(' | '))}</div>
          <small>${escapeHtml(match.matchReason || '')}</small>
        </div>
      `).join('')}</div>`;
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      if (!target) return;
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = renderEmptyState(
          'No broker requirements yet',
          'Adjust your filters or add your first lead from Overview to start tracking client demand.',
          'Add New Lead',
          'openLeadComposer()'
        );
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet">
          <div class="crm-sheet-head">
            <div>Sr.</div>
            <div>Purpose / Type</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Budget</div>
            <div>Status</div>
            <div>Follow-up</div>
            <div>Visibility</div>
            <div>Actions</div>
          </div>
          ${requirements.map((lead, index) => {
        const followUpState = getFollowUpStateInfo(lead);
        const phoneAvailable = String(lead.clientPhone || '').trim();
        const lastTouched = formatCompactAge(lead.updatedAt || lead.createdAt);
        return `
          <div class="crm-record-group">
            <div class="crm-row">
              <div class="crm-col">
                <span class="crm-col-label">Sr.</span>
                <span class="crm-index">#${index + 1}</span>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Purpose / Type</span>
                <div class="crm-primary">${escapeHtml(`${getLeadClientPurposeLabel(lead.clientPurpose)} | ${lead.propertyType || 'Requirement'}`)}</div>
                <div class="crm-secondary">${escapeHtml(joinDisplayParts([getLeadIntentText(lead), lead.paymentMethod]))}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Location</span>
                <div class="crm-primary">${escapeHtml(lead.location || '--')}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Building / Project</span>
                <div class="crm-primary">${escapeHtml(lead.preferredBuildingProject || '--')}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Budget</span>
                <div class="crm-primary">${escapeHtml(formatBudgetLabel(lead.budget))}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Status</span>
                <div class="crm-chip-stack">
                  <span class="badge ${badgeClass(lead.status)}">${escapeHtml(formatStatusLabel(lead.status || 'new'))}</span>
                </div>
                <div class="crm-quick-meta">
                  <span>${escapeHtml(lastTouched)} ago</span>
                </div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Follow-up</span>
                <div class="crm-chip-stack">
                  <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                  ${lead.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                </div>
                <div class="crm-quick-meta">
                  <span>Calls ${escapeHtml(lead.callCount || 0)}</span>
                  <span>WA ${escapeHtml(lead.whatsappCount || 0)}</span>
                </div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Visibility</span>
                <div class="crm-chip-stack">
                  <span class="badge ${lead.isListedPublic ? 'badge-green' : 'badge-blue'}">${lead.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                  ${lead.matchCount ? `<span class="badge badge-match">${lead.matchCount} Match${lead.matchCount === 1 ? '' : 'es'}</span>` : ''}
                  ${lead.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
                </div>
              </div>
              <div class="crm-row-actions">
                <button class="btn btn-secondary btn-tiny crm-row-action-btn primary-action" type="button" onclick="editLead(${lead.id})">Edit</button>
                <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'call', this)">Call</button>
                <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'whatsapp')">WA</button>
                <details class="crm-row-more">
                  <summary class="crm-row-more-toggle">More</summary>
                  <div class="crm-row-more-menu">
                    <button class="btn ${getBcpShareButtonClass(lead.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)" title="${lead.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(lead.isListedPublic, true)}</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="${lead.isArchived ? `restoreLead(${lead.id})` : `archiveLead(${lead.id})`}">${lead.isArchived ? 'Restore' : 'Archive'}</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">Matches</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">History</button>
                    <button class="btn btn-danger btn-tiny" type="button" onclick="deleteLead(${lead.id})">Delete</button>
                  </div>
                </details>
              </div>
            </div>

            <details class="record-details-panel crm-row-panel" id="lead-panel-${lead.id}">
              <summary>Workflow tools, matches, and history</summary>
              <div class="workflow-strip">
                <select id="lead-status-action-${lead.id}">
                  ${DASHBOARD_LEAD_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(lead.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="changeLeadStatus(${lead.id})">Update Status</button>
              </div>
              <div class="record-inline-grid">
                <div class="field-block">
                  <label class="small" for="lead-followup-date-${lead.id}">Next Follow-up Date</label>
                  <input id="lead-followup-date-${lead.id}" type="date" value="${escapeHtml(lead.nextFollowUpDate || '')}">
                </div>
                <div class="field-block">
                  <label class="small" for="lead-followup-time-${lead.id}">Next Follow-up Time</label>
                  <input id="lead-followup-time-${lead.id}" type="time" value="${escapeHtml(lead.nextFollowUpTime || '')}">
                </div>
                <div class="field-block full">
                  <label class="small" for="lead-followup-note-${lead.id}">Follow-up Note</label>
                  <textarea id="lead-followup-note-${lead.id}" placeholder="Add next-step note">${escapeHtml(lead.followUpNote || '')}</textarea>
                </div>
                <label class="toggle-card compact-toggle">
                  <input id="lead-followup-urgent-${lead.id}" type="checkbox" ${lead.isUrgentFollowUp ? 'checked' : ''}>
                  <span><strong>Urgent Reminder</strong><small>Flag this lead as urgent.</small></span>
                </label>
              </div>
              <div class="workflow-strip">
                <button class="btn btn-primary btn-tiny" type="button" onclick="saveLeadFollowUp(${lead.id})">Save Follow-up</button>
              </div>
              <div>
                <h4>Matching Listings</h4>
                ${renderLeadMatches(lead)}
              </div>
              <div>
                <h4>Activity History</h4>
                ${renderActivityTimeline(lead.activityLog)}
              </div>
            </details>
          </div>
        `;
      }).join('')}
        </div>
      `;
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      if (!target) return;
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = renderEmptyState(
          'No listings yet',
          'Adjust your filters or add your first listing from Overview to start managing inventory.',
          'Add New Listing',
          'openPropertyComposer()'
        );
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet">
          <div class="crm-sheet-head">
            <div>Sr.</div>
            <div>Purpose / Type</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Price</div>
            <div>Status</div>
            <div>Follow-up</div>
            <div>Visibility</div>
            <div>Actions</div>
          </div>
          ${properties.map((property, index) => {
        const followUpState = getFollowUpStateInfo(property);
        const ownerPhone = String(property.ownerPhone || '').trim();
        const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
        const distressLabel = getPropertyDistressLabel(property);
        return `
          <div class="crm-record-group">
            <div class="crm-row ${property.isDistress ? 'is-distress' : ''}">
              <div class="crm-col">
                <span class="crm-col-label">Sr.</span>
                <span class="crm-index">#${index + 1}</span>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Purpose / Type</span>
                <div class="crm-primary">${escapeHtml(`${getPropertyPurposeLabel(property.purpose)} | ${property.propertyType || 'Listing'}`)}</div>
                <div class="crm-secondary">${escapeHtml(getPropertyTermsSummary(property))}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Location</span>
                <div class="crm-primary">${escapeHtml(property.location || '--')}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Building / Project</span>
                <div class="crm-primary">${escapeHtml(property.buildingName || '--')}</div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Price</span>
                <div class="crm-primary">${escapeHtml(getPropertyDisplayPrice(property))}</div>
                ${distressLabel ? `<div class="crm-secondary">${escapeHtml(distressLabel)}</div>` : ''}
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Status</span>
                <div class="crm-chip-stack">
                  <span class="badge ${badgeClass(property.status)}">${escapeHtml(formatStatusLabel(property.status || 'available'))}</span>
                </div>
                <div class="crm-quick-meta">
                  <span>${escapeHtml(lastTouched)} ago</span>
                </div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Follow-up</span>
                <div class="crm-chip-stack">
                  <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                  ${property.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                </div>
                <div class="crm-quick-meta">
                  <span>Calls ${escapeHtml(property.ownerCallCount || 0)}</span>
                  <span>WA ${escapeHtml(property.ownerWhatsappCount || 0)}</span>
                </div>
              </div>
              <div class="crm-col">
                <span class="crm-col-label">Visibility</span>
                <div class="crm-chip-stack">
                  <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                  ${property.isDistress ? '<span class="badge badge-red">Distress</span>' : ''}
                  ${property.matchCount ? `<span class="badge badge-match">${property.matchCount} Match${property.matchCount === 1 ? '' : 'es'}</span>` : ''}
                  ${property.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
                </div>
              </div>
              <div class="crm-row-actions">
                <button class="btn btn-secondary btn-tiny crm-row-action-btn primary-action" type="button" onclick="editProperty(${property.id})">Edit</button>
                <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'call', this)">Call</button>
                <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'whatsapp')">WA</button>
                <details class="crm-row-more">
                  <summary class="crm-row-more-toggle">More</summary>
                  <div class="crm-row-more-menu">
                    <button class="btn ${getBcpShareButtonClass(property.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)" title="${property.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(property.isListedPublic, true)}</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="${property.isArchived ? `restoreProperty(${property.id})` : `archiveProperty(${property.id})`}">${property.isArchived ? 'Restore' : 'Archive'}</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('property-panel-${property.id}')">Matches</button>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('property-panel-${property.id}')">History</button>
                    <button class="btn btn-danger btn-tiny" type="button" onclick="deleteProperty(${property.id})">Delete</button>
                  </div>
                </details>
              </div>
            </div>

            <details class="record-details-panel crm-row-panel" id="property-panel-${property.id}">
              <summary>Workflow tools, matches, and history</summary>
              <div class="workflow-strip">
                <select id="property-status-action-${property.id}">
                  ${DASHBOARD_LISTING_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(property.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="changePropertyStatus(${property.id})">Update Status</button>
              </div>
              <div class="record-inline-grid">
                <div class="field-block">
                  <label class="small" for="property-followup-date-${property.id}">Next Follow-up Date</label>
                  <input id="property-followup-date-${property.id}" type="date" value="${escapeHtml(property.nextFollowUpDate || '')}">
                </div>
                <div class="field-block">
                  <label class="small" for="property-followup-time-${property.id}">Next Follow-up Time</label>
                  <input id="property-followup-time-${property.id}" type="time" value="${escapeHtml(property.nextFollowUpTime || '')}">
                </div>
                <div class="field-block full">
                  <label class="small" for="property-followup-note-${property.id}">Follow-up Note</label>
                  <textarea id="property-followup-note-${property.id}" placeholder="Add next owner or viewing reminder">${escapeHtml(property.followUpNote || '')}</textarea>
                </div>
                <label class="toggle-card compact-toggle">
                  <input id="property-followup-urgent-${property.id}" type="checkbox" ${property.isUrgentFollowUp ? 'checked' : ''}>
                  <span><strong>Urgent Reminder</strong><small>Flag this listing for urgent owner follow-up.</small></span>
                </label>
              </div>
              <div class="workflow-strip">
                <button class="btn btn-primary btn-tiny" type="button" onclick="savePropertyFollowUp(${property.id})">Save Follow-up</button>
              </div>
              <div>
                <h4>Matching Leads</h4>
                ${renderPropertyMatches(property)}
              </div>
              <div>
                <h4>Activity History</h4>
                ${renderActivityTimeline(property.activityLog)}
              </div>
            </details>
          </div>
        `;
      }).join('')}
        </div>
      `;
    }

    function renderOverview() {
      const overview = state.overview || { totals: {}, broker: {} };
      const stats = [
        { label: 'Leads', value: overview.totals?.activeLeads || 0, metric: 'activeLeads' },
        { label: 'Inventory', value: overview.totals?.activeProperties || 0, metric: 'activeListings' }
      ];

      document.getElementById('overviewStats').innerHTML = stats.map(item => `
        <div
          class="stat-card is-clickable"
          role="button"
          tabindex="0"
          aria-label="Open ${item.label}"
          onclick="openOverviewMetric('${item.metric}')"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openOverviewMetric('${item.metric}')}"
        >
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `).join('');
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      if (!target) return;
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = renderEmptyState(
          'No broker requirements yet',
          'Adjust your filters or add your first lead from Overview to start tracking client demand.',
          'Add New Lead',
          'openLeadComposer()'
        );
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet lead-sheet">
          <div class="crm-sheet-head">
            <div>#</div>
            <div>Purpose</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Type</div>
            <div>Budget</div>
            <div>Payment</div>
            <div>Status</div>
            <div>Updated</div>
            <div>Actions</div>
          </div>
          ${requirements.map((lead, index) => {
            const followUpState = getFollowUpStateInfo(lead);
            const phoneAvailable = String(lead.clientPhone || '').trim();
            const lastTouched = formatCompactAge(lead.updatedAt || lead.createdAt);
            return `
              <div class="crm-record-group">
                <div class="crm-row">
                  <div class="crm-col">
                    <span class="crm-col-label">#</span>
                    <span class="crm-index">${index + 1}</span>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Purpose</span>
                    <div class="crm-primary">${escapeHtml(getLeadClientPurposeLabel(lead.clientPurpose))}</div>
                    <div class="crm-secondary">${escapeHtml(getLeadIntentText(lead))}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Location</span>
                    <div class="crm-primary">${escapeHtml(lead.location || 'â€”')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Building / Project</span>
                    <div class="crm-primary">${escapeHtml(lead.preferredBuildingProject || 'â€”')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Type</span>
                    <div class="crm-primary">${escapeHtml(lead.propertyType || 'â€”')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Budget</span>
                    <div class="crm-primary">${escapeHtml(formatBudgetLabel(lead.budget))}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Payment</span>
                    <div class="crm-primary">${escapeHtml(lead.paymentMethod || 'â€”')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Status</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${badgeClass(lead.status)}">${escapeHtml(formatStatusLabel(lead.status || 'new'))}</span>
                      <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                      ${lead.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                      ${lead.isListedPublic ? '<span class="badge badge-green">Public</span>' : '<span class="badge badge-blue">Private</span>'}
                    </div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Updated</span>
                    <div class="crm-primary">${escapeHtml(`${lastTouched} ago`)}</div>
                    <div class="crm-quick-meta">
                      <span>Calls ${escapeHtml(lead.callCount || 0)}</span>
                      <span>WA ${escapeHtml(lead.whatsappCount || 0)}</span>
                      ${lead.matchCount ? `<span>${escapeHtml(`${lead.matchCount} matches`)}</span>` : ''}
                    </div>
                  </div>
                  <div class="crm-row-actions">
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn primary-action" type="button" onclick="editLead(${lead.id})">Edit</button>
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'call', this)">Call</button>
                    <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'whatsapp')">WA</button>
                    <details class="crm-row-more">
                      <summary class="crm-row-more-toggle">More</summary>
                      <div class="crm-row-more-menu">
                        <button class="btn ${getBcpShareButtonClass(lead.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)" title="${lead.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(lead.isListedPublic, true)}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="${lead.isArchived ? `restoreLead(${lead.id})` : `archiveLead(${lead.id})`}">${lead.isArchived ? 'Restore' : 'Archive'}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">Matches</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">History</button>
                        <button class="btn btn-danger btn-tiny" type="button" onclick="deleteLead(${lead.id})">Delete</button>
                      </div>
                    </details>
                  </div>
                </div>
                <details class="record-details-panel crm-row-panel" id="lead-panel-${lead.id}">
                  <summary>Status, follow-up, matches, history</summary>
                  <div class="record-summary">
                    <div class="muted"><strong>Private Notes:</strong> ${escapeHtml(lead.privateNotes || 'No private notes yet')}</div>
                    <div class="muted"><strong>Last Contact:</strong> ${escapeHtml(formatLastContactLabel(lead.lastContactedAt))} via ${escapeHtml(lead.lastContactMethod || '--')}</div>
                  </div>
                  <div class="workflow-strip">
                    <select id="lead-status-action-${lead.id}">
                      ${DASHBOARD_LEAD_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(lead.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="changeLeadStatus(${lead.id})">Update Status</button>
                  </div>
                  <div class="record-inline-grid">
                    <div class="field-block">
                  <label class="small" for="lead-followup-date-${lead.id}">Next Follow-up Date</label>
                      <input id="lead-followup-date-${lead.id}" type="date" value="${escapeHtml(lead.nextFollowUpDate || '')}">
                    </div>
                    <div class="field-block">
                  <label class="small" for="lead-followup-time-${lead.id}">Next Follow-up Time</label>
                      <input id="lead-followup-time-${lead.id}" type="time" value="${escapeHtml(lead.nextFollowUpTime || '')}">
                    </div>
                    <div class="field-block full">
                  <label class="small" for="lead-followup-note-${lead.id}">Follow-up Note</label>
                      <textarea id="lead-followup-note-${lead.id}" placeholder="Add next-step note">${escapeHtml(lead.followUpNote || '')}</textarea>
                    </div>
                    <label class="toggle-card compact-toggle">
                      <input id="lead-followup-urgent-${lead.id}" type="checkbox" ${lead.isUrgentFollowUp ? 'checked' : ''}>
                      <span><strong>Urgent Reminder</strong><small>Flag this lead as urgent.</small></span>
                    </label>
                  </div>
                  <div class="workflow-strip">
                    <button class="btn btn-primary btn-tiny" type="button" onclick="saveLeadFollowUp(${lead.id})">Save Follow-up</button>
                  </div>
                  <div>
                    <h4>Matching Listings</h4>
                    ${renderLeadMatches(lead)}
                  </div>
                  <div>
                    <h4>Activity History</h4>
                    ${renderActivityTimeline(lead.activityLog)}
                  </div>
                </details>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      if (!target) return;
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = '<div class="empty">No listings match your current filters. Adjust your filters or add a new listing from Overview.</div>';
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet">
          <div class="crm-sheet-head">
            <div>Sr.</div>
            <div>Listing</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Property Type</div>
            <div>Price</div>
            <div>Workflow</div>
            <div>Actions</div>
          </div>
          ${properties.map((property, index) => {
            const followUpState = getFollowUpStateInfo(property);
            const ownerPhone = String(property.ownerPhone || '').trim();
            const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
            const distressLabel = getPropertyDistressLabel(property);
            return `
              <div class="crm-record-group">
                <div class="crm-row ${property.isDistress ? 'is-distress' : ''}">
                  <div class="crm-col">
                    <span class="crm-col-label">Sr.</span>
                    <span class="crm-index">#${index + 1}</span>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Listing</span>
                    <div class="crm-primary">${escapeHtml(getPropertyPurposeLabel(property.purpose))}</div>
                    <div class="crm-secondary">${escapeHtml(property.status ? `Status: ${formatStatusLabel(property.status)}` : 'Private listing')}</div>
                    <div class="crm-chip-stack">
                      <span class="badge ${badgeClass(property.status)}">${escapeHtml(formatStatusLabel(property.status || 'available'))}</span>
                      <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                      ${property.isDistress ? '<span class="badge badge-red">Distress</span>' : ''}
                      ${property.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
                    </div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Location</span>
                    <div class="crm-primary">${escapeHtml(property.location || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Building / Project</span>
                    <div class="crm-primary">${escapeHtml(property.buildingName || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Property Type</span>
                    <div class="crm-primary">${escapeHtml(property.propertyType || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Price</span>
                    <div class="crm-primary">${escapeHtml(getPropertyDisplayPrice(property))}</div>
                    ${distressLabel ? `<div class="crm-secondary">${escapeHtml(distressLabel)}</div>` : ''}
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Workflow</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                      ${property.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                      ${property.matchCount ? `<span class="badge badge-match">${property.matchCount} Match${property.matchCount === 1 ? '' : 'es'}</span>` : ''}
                    </div>
                    <div class="crm-quick-meta">
                      <span>Calls ${escapeHtml(property.ownerCallCount || 0)}</span>
                      <span>WA ${escapeHtml(property.ownerWhatsappCount || 0)}</span>
                      <span>${escapeHtml(lastTouched)} ago</span>
                    </div>
                  </div>
                  <div class="crm-row-actions">
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" onclick="editProperty(${property.id})" title="Edit">&#9998; Edit</button>
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'call', this)" title="Call Owner">&#9742; Call</button>
                    <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'whatsapp')" title="WhatsApp Owner">WA</button>
                    <button class="btn ${getBcpShareButtonClass(property.isListedPublic)} btn-tiny crm-row-action-btn" type="button" onclick="toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)" title="${property.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(property.isListedPublic, true)}</button>
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" onclick="${property.isArchived ? `restoreProperty(${property.id})` : `archiveProperty(${property.id})`}" title="${property.isArchived ? 'Restore' : 'Archive'}">${property.isArchived ? '&#8634; Restore' : 'Archive'}</button>
                    <button class="btn btn-danger btn-tiny crm-row-action-btn" type="button" onclick="deleteProperty(${property.id})" title="Delete">&times;</button>
                  </div>
                </div>
                <details class="record-details-panel crm-row-panel">
                  <summary>Status, follow-up, matches, history</summary>
                  <div class="record-summary">
                    <div class="muted"><strong>Owner:</strong> ${escapeHtml(getPropertyPrivateContactSummary(property))}</div>
                    <div class="muted"><strong>Terms:</strong> ${escapeHtml(getPropertyTermsSummary(property))}</div>
                    <div class="muted"><strong>Public Notes:</strong> ${escapeHtml(property.publicNotes || 'No public note added')}</div>
                    <div class="muted"><strong>Internal Notes:</strong> ${escapeHtml(property.internalNotes || 'No internal notes yet')}</div>
                    <div class="muted"><strong>Last Contact:</strong> ${escapeHtml(formatLastContactLabel(property.lastOwnerContactedAt))} via ${escapeHtml(property.lastOwnerContactMethod || '--')}</div>
                  </div>
                  <div class="workflow-strip">
                    <select id="property-status-action-${property.id}">
                      ${DASHBOARD_LISTING_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(property.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="changePropertyStatus(${property.id})">Update Status</button>
                  </div>
                  <div class="record-inline-grid">
                    <div class="field-block">
                  <label class="small" for="property-followup-date-${property.id}">Next Follow-up Date</label>
                      <input id="property-followup-date-${property.id}" type="date" value="${escapeHtml(property.nextFollowUpDate || '')}">
                    </div>
                    <div class="field-block">
                  <label class="small" for="property-followup-time-${property.id}">Next Follow-up Time</label>
                      <input id="property-followup-time-${property.id}" type="time" value="${escapeHtml(property.nextFollowUpTime || '')}">
                    </div>
                    <div class="field-block full">
                  <label class="small" for="property-followup-note-${property.id}">Follow-up Note</label>
                      <textarea id="property-followup-note-${property.id}" placeholder="Add next owner or viewing reminder">${escapeHtml(property.followUpNote || '')}</textarea>
                    </div>
                    <label class="toggle-card compact-toggle">
                      <input id="property-followup-urgent-${property.id}" type="checkbox" ${property.isUrgentFollowUp ? 'checked' : ''}>
                      <span><strong>Urgent Reminder</strong><small>Flag this listing for urgent owner follow-up.</small></span>
                    </label>
                  </div>
                  <div class="workflow-strip">
                    <button class="btn btn-primary btn-tiny" type="button" onclick="savePropertyFollowUp(${property.id})">Save Follow-up</button>
                  </div>
                  <div>
                    <h4>Matching Leads</h4>
                    ${renderPropertyMatches(property)}
                  </div>
                  <div>
                    <h4>Activity History</h4>
                    ${renderActivityTimeline(property.activityLog)}
                  </div>
                </details>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      if (!target) return;
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = renderEmptyState(
          'No broker requirements yet',
          'Adjust your filters or add your first lead from Overview to start tracking client demand.',
          'Add New Lead',
          'openLeadComposer()'
        );
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet lead-sheet">
          <div class="crm-sheet-head">
            <div>#</div>
            <div>Purpose</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Type</div>
            <div>Budget</div>
            <div>Payment</div>
            <div>Status</div>
            <div>Updated</div>
            <div>Actions</div>
          </div>
          ${requirements.map((lead, index) => {
            const followUpState = getFollowUpStateInfo(lead);
            const phoneAvailable = String(lead.clientPhone || '').trim();
            const lastTouched = formatCompactAge(lead.updatedAt || lead.createdAt);
            return `
              <div class="crm-record-group">
                <div class="crm-row">
                  <div class="crm-col">
                    <span class="crm-col-label">#</span>
                    <span class="crm-index">${index + 1}</span>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Purpose</span>
                    <div class="crm-primary">${escapeHtml(getLeadClientPurposeLabel(lead.clientPurpose))}</div>
                    <div class="crm-secondary">${escapeHtml(getLeadIntentText(lead))}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Location</span>
                    <div class="crm-primary">${escapeHtml(lead.location || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Building / Project</span>
                    <div class="crm-primary">${escapeHtml(lead.preferredBuildingProject || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Type</span>
                    <div class="crm-primary">${escapeHtml(lead.propertyType || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Budget</span>
                    <div class="crm-primary">${escapeHtml(formatBudgetLabel(lead.budget))}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Payment</span>
                    <div class="crm-primary">${escapeHtml(lead.paymentMethod || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Status</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${badgeClass(lead.status)}">${escapeHtml(formatStatusLabel(lead.status || 'new'))}</span>
                      <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                      ${lead.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                      ${lead.isListedPublic ? '<span class="badge badge-green">Public</span>' : '<span class="badge badge-blue">Private</span>'}
                    </div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Updated</span>
                    <div class="crm-primary">${escapeHtml(`${lastTouched} ago`)}</div>
                    <div class="crm-quick-meta">
                      <span>Calls ${escapeHtml(lead.callCount || 0)}</span>
                      <span>WA ${escapeHtml(lead.whatsappCount || 0)}</span>
                      ${lead.matchCount ? `<span>${escapeHtml(`${lead.matchCount} matches`)}</span>` : ''}
                    </div>
                  </div>
                  <div class="crm-row-actions">
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn primary-action" type="button" onclick="editLead(${lead.id})">Edit</button>
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'call', this)">Call</button>
                    <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${phoneAvailable ? '' : 'disabled'} onclick="contactLead(${lead.id}, 'whatsapp')">WA</button>
                    <details class="crm-row-more">
                      <summary class="crm-row-more-toggle">More</summary>
                      <div class="crm-row-more-menu">
            <button class="btn ${getBcpShareButtonClass(lead.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)" title="${lead.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(lead.isListedPublic, true)}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="${lead.isArchived ? `restoreLead(${lead.id})` : `archiveLead(${lead.id})`}">${lead.isArchived ? 'Restore' : 'Archive'}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">Matches</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('lead-panel-${lead.id}')">History</button>
                        <button class="btn btn-danger btn-tiny" type="button" onclick="deleteLead(${lead.id})">Delete</button>
                      </div>
                    </details>
                  </div>
                </div>
                <details class="record-details-panel crm-row-panel" id="lead-panel-${lead.id}">
                  <summary>Status, follow-up, matches, history</summary>
                  <div class="record-summary">
                    <div class="muted"><strong>Private Notes:</strong> ${escapeHtml(lead.privateNotes || 'No private notes yet')}</div>
                    <div class="muted"><strong>Last Contact:</strong> ${escapeHtml(formatLastContactLabel(lead.lastContactedAt))} via ${escapeHtml(lead.lastContactMethod || '--')}</div>
                  </div>
                  <div class="workflow-strip">
                    <select id="lead-status-action-${lead.id}">
                      ${DASHBOARD_LEAD_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(lead.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="changeLeadStatus(${lead.id})">Update Status</button>
                  </div>
                  <div class="record-inline-grid">
                    <div class="field-block">
                      <label class="small" for="lead-followup-date-${lead.id}">Next Follow-up Date</label>
                      <input id="lead-followup-date-${lead.id}" type="date" value="${escapeHtml(lead.nextFollowUpDate || '')}">
                    </div>
                    <div class="field-block">
                      <label class="small" for="lead-followup-time-${lead.id}">Next Follow-up Time</label>
                      <input id="lead-followup-time-${lead.id}" type="time" value="${escapeHtml(lead.nextFollowUpTime || '')}">
                    </div>
                    <div class="field-block full">
                      <label class="small" for="lead-followup-note-${lead.id}">Follow-up Note</label>
                      <textarea id="lead-followup-note-${lead.id}" placeholder="Add next-step note">${escapeHtml(lead.followUpNote || '')}</textarea>
                    </div>
                    <label class="toggle-card compact-toggle">
                      <input id="lead-followup-urgent-${lead.id}" type="checkbox" ${lead.isUrgentFollowUp ? 'checked' : ''}>
                      <span><strong>Urgent Reminder</strong><small>Flag this lead as urgent.</small></span>
                    </label>
                  </div>
                  <div class="workflow-strip">
                    <button class="btn btn-primary btn-tiny" type="button" onclick="saveLeadFollowUp(${lead.id})">Save Follow-up</button>
                  </div>
                  <div>
                    <h4>Matching Listings</h4>
                    ${renderLeadMatches(lead)}
                  </div>
                  <div>
                    <h4>Activity History</h4>
                    ${renderActivityTimeline(lead.activityLog)}
                  </div>
                </details>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      if (!target) return;
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = renderEmptyState(
          'No listings yet',
          'Adjust your filters or add your first listing from Overview to start managing inventory.',
          'Add New Listing',
          'openPropertyComposer()'
        );
        return;
      }

      target.innerHTML = `
        <div class="crm-sheet property-sheet">
          <div class="crm-sheet-head">
            <div>#</div>
            <div>Purpose</div>
            <div>Location</div>
            <div>Building / Project</div>
            <div>Type</div>
            <div>Price</div>
            <div>Status</div>
            <div>Follow-up</div>
            <div>Visibility</div>
            <div>Actions</div>
          </div>
          ${properties.map((property, index) => {
            const followUpState = getFollowUpStateInfo(property);
            const ownerPhone = String(property.ownerPhone || '').trim();
            const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
            const distressLabel = getPropertyDistressLabel(property);
            return `
              <div class="crm-record-group">
                <div class="crm-row ${property.isDistress ? 'is-distress' : ''}">
                  <div class="crm-col">
                    <span class="crm-col-label">#</span>
                    <span class="crm-index">${index + 1}</span>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Purpose</span>
                    <div class="crm-primary">${escapeHtml(getPropertyPurposeLabel(property.purpose))}</div>
                    <div class="crm-secondary">${escapeHtml(getPropertyTermsSummary(property))}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Location</span>
                    <div class="crm-primary">${escapeHtml(property.location || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Building / Project</span>
                    <div class="crm-primary">${escapeHtml(property.buildingName || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Type</span>
                    <div class="crm-primary">${escapeHtml(property.propertyType || '--')}</div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Price</span>
                    <div class="crm-primary">${escapeHtml(getPropertyDisplayPrice(property))}</div>
                    ${distressLabel ? `<div class="crm-secondary">${escapeHtml(distressLabel)}</div>` : ''}
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Status</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${badgeClass(property.status)}">${escapeHtml(formatStatusLabel(property.status || 'available'))}</span>
                      ${property.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
                    </div>
                    <div class="crm-quick-meta">
                      <span>${escapeHtml(lastTouched)} ago</span>
                    </div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Follow-up</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
                      ${property.matchCount ? `<span class="badge badge-match">${property.matchCount} Match${property.matchCount === 1 ? '' : 'es'}</span>` : ''}
                    </div>
                    <div class="crm-quick-meta">
                      <span>Calls ${escapeHtml(property.ownerCallCount || 0)}</span>
                      <span>WA ${escapeHtml(property.ownerWhatsappCount || 0)}</span>
                    </div>
                  </div>
                  <div class="crm-col">
                    <span class="crm-col-label">Visibility</span>
                    <div class="crm-chip-stack">
                      <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
                      ${property.isDistress ? '<span class="badge badge-red">Distress</span>' : ''}
                      ${property.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
                    </div>
                  </div>
                  <div class="crm-row-actions">
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn primary-action" type="button" onclick="editProperty(${property.id})">Edit</button>
                    <button class="btn btn-secondary btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'call', this)">Call</button>
                    <button class="btn btn-success btn-tiny crm-row-action-btn" type="button" ${ownerPhone ? '' : 'disabled'} onclick="contactPropertyOwner(${property.id}, 'whatsapp')">WA</button>
                    <details class="crm-row-more">
                      <summary class="crm-row-more-toggle">More</summary>
                      <div class="crm-row-more-menu">
                        <button class="btn ${getBcpShareButtonClass(property.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)" title="${property.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(property.isListedPublic, true)}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="${property.isArchived ? `restoreProperty(${property.id})` : `archiveProperty(${property.id})`}">${property.isArchived ? 'Restore' : 'Archive'}</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('property-panel-${property.id}')">Matches</button>
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="openRecordPanel('property-panel-${property.id}')">History</button>
                        <button class="btn btn-danger btn-tiny" type="button" onclick="deleteProperty(${property.id})">Delete</button>
                      </div>
                    </details>
                  </div>
                </div>
                <details class="record-details-panel crm-row-panel" id="property-panel-${property.id}">
                  <summary>Status, follow-up, matches, history</summary>
                  <div class="record-summary">
                    <div class="muted"><strong>Owner:</strong> ${escapeHtml(getPropertyPrivateContactSummary(property))}</div>
                    <div class="muted"><strong>Terms:</strong> ${escapeHtml(getPropertyTermsSummary(property))}</div>
                    <div class="muted"><strong>Public Notes:</strong> ${escapeHtml(property.publicNotes || 'No public note added')}</div>
                    <div class="muted"><strong>Internal Notes:</strong> ${escapeHtml(property.internalNotes || 'No internal notes yet')}</div>
                    <div class="muted"><strong>Last Contact:</strong> ${escapeHtml(formatLastContactLabel(property.lastOwnerContactedAt))} via ${escapeHtml(property.lastOwnerContactMethod || '--')}</div>
                  </div>
                  <div class="workflow-strip">
                    <select id="property-status-action-${property.id}">
                      ${DASHBOARD_LISTING_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(property.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="changePropertyStatus(${property.id})">Update Status</button>
                  </div>
                  <div class="record-inline-grid">
                    <div class="field-block">
                      <label class="small" for="property-followup-date-${property.id}">Next Follow-up Date</label>
                      <input id="property-followup-date-${property.id}" type="date" value="${escapeHtml(property.nextFollowUpDate || '')}">
                    </div>
                    <div class="field-block">
                      <label class="small" for="property-followup-time-${property.id}">Next Follow-up Time</label>
                      <input id="property-followup-time-${property.id}" type="time" value="${escapeHtml(property.nextFollowUpTime || '')}">
                    </div>
                    <div class="field-block full">
                      <label class="small" for="property-followup-note-${property.id}">Follow-up Note</label>
                      <textarea id="property-followup-note-${property.id}" placeholder="Add next owner or viewing reminder">${escapeHtml(property.followUpNote || '')}</textarea>
                    </div>
                    <label class="toggle-card compact-toggle">
                      <input id="property-followup-urgent-${property.id}" type="checkbox" ${property.isUrgentFollowUp ? 'checked' : ''}>
                      <span><strong>Urgent Reminder</strong><small>Flag this listing for urgent owner follow-up.</small></span>
                    </label>
                  </div>
                  <div class="workflow-strip">
                    <button class="btn btn-primary btn-tiny" type="button" onclick="savePropertyFollowUp(${property.id})">Save Follow-up</button>
                  </div>
                  <div>
                    <h4>Matching Leads</h4>
                    ${renderPropertyMatches(property)}
                  </div>
                  <div>
                    <h4>Activity History</h4>
                    ${renderActivityTimeline(property.activityLog)}
                  </div>
                </details>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function ensureSelectedWorkspaceId(items, currentId) {
      const records = Array.isArray(items) ? items : [];
      if (!records.length) return null;
      return records.some(item => String(item.id) === String(currentId)) ? currentId : null;
    }

    function scrollPanelTopIntoView(panel, fallbackTarget = null) {
      const target = panel || fallbackTarget;
      if (!target) return;
      const topOffset = 92;
      const absoluteTop = window.scrollY + target.getBoundingClientRect().top - topOffset;
      window.scrollTo({
        top: Math.max(0, absoluteTop),
        behavior: 'smooth'
      });
    }

    function queueWorkspaceSplitScroll(sectionName, mode, rowId) {
      state.pendingSplitScroll = {
        sectionName,
        mode,
        rowId: String(rowId || '')
      };
      if (mode === 'restore') {
        state.splitScrollMemory[sectionName] = String(rowId || '');
      }
    }

    function flushWorkspaceSplitScroll(sectionName) {
      const intent = state.pendingSplitScroll;
      if (!intent || intent.sectionName !== sectionName) return;
      state.pendingSplitScroll = null;
      requestAnimationFrame(() => {
        const section = document.getElementById(`${sectionName}-section`);
        const listTargetId = sectionName === 'leads' ? 'leadsList' : sectionName === 'properties' ? 'propertiesList' : 'distressList';
        const target = document.getElementById(listTargetId);
        const shell = target?.querySelector('.workspace-split');
        const detailPanel = shell?.querySelector('.workspace-detail-card');
        const row = intent.rowId ? target?.querySelector(`[data-workspace-row-id="${intent.rowId}"]`) : null;
        if (intent.mode === 'open') {
          scrollPanelTopIntoView(detailPanel, shell || section || target);
          return;
        }
        if (intent.mode === 'restore' && row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        (section || target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function closeLeadRecordPanel() {
      queueWorkspaceSplitScroll('leads', 'restore', state.selectedLeadId);
      state.selectedLeadId = null;
      renderLeads();
    }

    function closePropertyRecordPanel() {
      queueWorkspaceSplitScroll('properties', 'restore', state.selectedPropertyId);
      state.selectedPropertyId = null;
      renderProperties();
    }

    function closeDistressRecordPanel() {
      queueWorkspaceSplitScroll('distress', 'restore', state.selectedDistressId);
      state.selectedDistressId = null;
      renderDistressDeals();
    }

    function openLeadRecord(id) {
      queueWorkspaceSplitScroll('leads', 'open', id);
      state.selectedLeadId = id;
      openSection('leads');
      renderLeads();
    }

    function openPropertyRecord(id, section = 'properties') {
      if (section === 'distress') {
        queueWorkspaceSplitScroll('distress', 'open', id);
        state.selectedDistressId = id;
        openSection('distress');
        renderDistressDeals();
        return;
      }
      queueWorkspaceSplitScroll('properties', 'open', id);
      state.selectedPropertyId = id;
      openSection('properties');
      renderProperties();
    }

    function openRecordPanel(panelId) {
      if (String(panelId || '').startsWith('lead-panel-')) {
        openLeadRecord(Number(String(panelId).replace('lead-panel-', '')));
        return;
      }
      if (String(panelId || '').startsWith('property-panel-')) {
        openPropertyRecord(Number(String(panelId).replace('property-panel-', '')), 'properties');
        return;
      }
      if (String(panelId || '').startsWith('distress-panel-')) {
        openPropertyRecord(Number(String(panelId).replace('distress-panel-', '')), 'distress');
        return;
      }
      const panel = document.getElementById(panelId);
      if (!panel) return;
      panel.open = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function changeLeadStatusFromPanel(id, prefix = 'requirement') {
      const nextStatus = document.getElementById(`${prefix}-status-action-${id}`)?.value;
      if (!nextStatus) return;
      try {
        await dashboardAction({ action: 'update-lead-status', id, status: nextStatus }, 'Requirement status updated.');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function toggleListItem(entityType, id, listed, buttonCandidate = null) {
      if (!listed && !hasAcceptedPlatformRules()) {
        openDashboardRulesPromptForShare(entityType, id, listed, buttonCandidate);
        return;
      }
      await proceedToggleListItem(entityType, id, listed, buttonCandidate);
    }

    function getBcpShareButtonClass(listed) {
      return listed ? 'btn-bcp-unshare' : 'btn-bcp-share';
    }

    function getBcpShareButtonLabel(listed, compact = false) {
      if (listed) {
        return compact ? 'Remove from Marketplace' : 'Remove from Marketplace';
      }
      return compact ? 'Share on Marketplace' : 'Share on Marketplace';
    }

    async function saveLeadFollowUpFromPanel(id, prefix = 'requirement') {
      try {
        await dashboardAction({
          action: 'set-lead-followup',
          id,
          nextFollowUpDate: document.getElementById(`${prefix}-followup-date-${id}`)?.value || '',
          nextFollowUpTime: document.getElementById(`${prefix}-followup-time-${id}`)?.value || '',
          followUpNote: document.getElementById(`${prefix}-followup-note-${id}`)?.value || '',
          isUrgentFollowUp: Boolean(document.getElementById(`${prefix}-followup-urgent-${id}`)?.checked)
        }, 'Requirement follow-up updated.');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function changePropertyStatusFromPanel(id, prefix = 'listing') {
      const nextStatus = document.getElementById(`${prefix}-status-action-${id}`)?.value;
      if (!nextStatus) return;
      try {
        await dashboardAction({ action: 'update-property-status', id, status: nextStatus }, 'Listing status updated.');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function savePropertyFollowUpFromPanel(id, prefix = 'listing') {
      try {
        await dashboardAction({
          action: 'set-property-followup',
          id,
          nextFollowUpDate: document.getElementById(`${prefix}-followup-date-${id}`)?.value || '',
          nextFollowUpTime: document.getElementById(`${prefix}-followup-time-${id}`)?.value || '',
          followUpNote: document.getElementById(`${prefix}-followup-note-${id}`)?.value || '',
          isUrgentFollowUp: Boolean(document.getElementById(`${prefix}-followup-urgent-${id}`)?.checked)
        }, prefix === 'distress' ? 'Distress follow-up updated.' : 'Listing follow-up updated.');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    function formatDashboardRelativeTime(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const diffMs = Date.now() - date.getTime();
      const isFuture = diffMs < 0;
      const absMs = Math.abs(diffMs);
      const minutes = Math.max(1, Math.floor(absMs / 60000));
      let label = 'Just now';
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
          label = `${hours} hour${hours === 1 ? '' : 's'}`;
        } else {
          const days = Math.floor(hours / 24);
          label = `${days} day${days === 1 ? '' : 's'}`;
        }
      }
      if (label === 'Just now') return label;
      return isFuture ? `in ${label}` : `${label} ago`;
    }

    function getOverviewRecordTimestamp(item) {
      return item?.updatedAt || item?.lastActivityAt || item?.createdAt || '';
    }

    function getOverviewRecordStatus(item, type) {
      if (type === 'distress') return 'Distress';
      if (type === 'lead') return formatStatusLabel(item?.status || 'new');
      return formatStatusLabel(item?.status || 'available');
    }

    function getOverviewEmptyAction(type) {
      if (type === 'lead') {
        return { label: 'Add Requirement', action: 'openLeadComposer()' };
      }
      if (type === 'distress') {
        return { label: 'Add Distress Listing', action: 'openSection(\'distress\');openPropertyComposer()' };
      }
      return { label: 'Add Listing', action: 'openPropertyComposer()' };
    }

    function getOverviewMetricIcon(label) {
      const value = String(label || '').toLowerCase();
      if (value.includes('requirement')) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path><path d="M2.5 20a5.5 5.5 0 0 1 11 0"></path><path d="M17 8v6"></path><path d="M14 11h6"></path></svg>';
      }
      if (value.includes('listing')) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V5l9-2v18"></path><path d="M14 9h5v12"></path><path d="M8 8h2"></path><path d="M8 12h2"></path><path d="M8 16h2"></path><path d="M17 13h1"></path><path d="M17 17h1"></path></svg>';
      }
      if (value.includes('distress')) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 20h18Z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path></svg>';
      }
      if (value.includes('alert')) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg>';
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4Z"></path><path d="M13 4h7v7h-7Z"></path><path d="M4 13h7v7H4Z"></path><path d="M13 13h7v7h-7Z"></path></svg>';
    }

    function renderOverviewTodayActions(unreadEntries) {
      const entries = Array.isArray(unreadEntries) ? unreadEntries : [];
      if (!entries.length) {
        return `
          <div class="today-actions-card is-clear">
            <div class="today-actions-copy">
              <span class="today-actions-kicker">Today</span>
              <strong>No urgent action pending.</strong>
              <p>Your workspace is clear. Add a requirement or listing to keep matching active.</p>
            </div>
            <div class="today-actions-buttons">
              <button class="btn btn-primary btn-tiny" type="button" onclick="openLeadComposer()">Add Requirement</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openPropertyComposer()">Add Listing</button>
            </div>
          </div>
        `;
      }
      const entry = entries[0];
      const item = entry.item || {};
      const notificationKey = entry.key || '';
      const createdLabel = formatDashboardRelativeTime(item.createdAt || item.updatedAt || new Date().toISOString())
        || formatDateTime(item.createdAt || item.updatedAt || new Date().toISOString());
      return `
        <div class="today-actions-card has-alert" data-notification-key="${escapeHtml(notificationKey)}">
          <div class="today-actions-copy">
            <span class="today-actions-kicker">Today / Urgent</span>
            <strong>${escapeHtml(item.title || 'Workflow alert')}</strong>
            <p>${escapeHtml(item.message || 'Review this item before it becomes stale.')}</p>
            <small>${escapeHtml(createdLabel)}</small>
          </div>
          <div class="today-actions-buttons">
            <button class="btn btn-primary btn-tiny" type="button" onclick="openWorkflowNotification(this.closest('.today-actions-card')?.dataset?.notificationKey || '')">Open</button>
            <button class="btn btn-secondary btn-tiny" type="button" data-notification-key="${escapeHtml(notificationKey)}" onclick="markWorkflowNotificationDone(event, this)">Mark Done</button>
            <button class="btn btn-secondary btn-tiny" type="button" data-notification-key="${escapeHtml(notificationKey)}" onclick="snoozeWorkflowNotification(event, this)">Snooze</button>
          </div>
        </div>
      `;
    }

    function renderOverviewMiniList(items, type) {
      const records = Array.isArray(items) ? items : [];
      if (!records.length) {
        const emptyAction = getOverviewEmptyAction(type);
        return `
          <div class="overview-mini-list">
            <div class="overview-empty-state">
              <strong>No records to show right now.</strong>
              <span>Add fresh data to keep this workspace useful.</span>
              <button class="btn btn-primary btn-tiny" type="button" onclick="${emptyAction.action}">${escapeHtml(emptyAction.label)}</button>
            </div>
          </div>
        `;
      }
      return `<div class="overview-mini-list">${records.slice(0, 5).map(item => {
        const isLead = type === 'lead';
        const isDistress = type === 'distress';
        const title = isLead
          ? (getLeadIntentText(item) || `${getLeadClientPurposeLabel(item.clientPurpose)} requirement`)
          : `${getPropertyPurposeLabel(item.purpose)} ${item.propertyType ? `- ${item.propertyType}` : 'listing'}`;
        const meta = isLead
          ? [item.location || '', item.preferredBuildingProject || 'Building not specified'].filter(Boolean).join(' | ')
          : [item.location || '', item.buildingName || 'Building not specified'].filter(Boolean).join(' | ');
        const tertiary = isLead ? formatBudgetLabel(item.budget) : getPropertyDisplayPrice(item);
        const statusLabel = getOverviewRecordStatus(item, type);
        const updatedLabel = formatDashboardRelativeTime(getOverviewRecordTimestamp(item));
        const action = isLead
          ? `openLeadRecord(${item.id})`
          : `openPropertyRecord(${item.id}, '${isDistress ? 'distress' : 'properties'}')`;
        return `
          <div
            class="overview-mini-row is-clickable"
            role="button"
            tabindex="0"
            onclick="${action}"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${action}}"
          >
            <div class="overview-mini-main">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(meta || '--')}</span>
            </div>
            <div class="overview-mini-meta">
              <span class="overview-price-chip">${escapeHtml(tertiary || '--')}</span>
              <span class="badge ${escapeHtml(badgeClass(statusLabel))}">${escapeHtml(statusLabel || '--')}</span>
              <small>${escapeHtml(updatedLabel || 'Recently updated')}</small>
            </div>
          </div>
        `;
      }).join('')}</div>`;
    }

    function renderOverview() {
      const overview = state.overview || { totals: {}, broker: {} };
      const activeRequirements = (Array.isArray(state.leads) ? state.leads : []).filter(item => !item.isArchived);
      const activeListings = (Array.isArray(state.properties) ? state.properties : []).filter(item => !item.isArchived);
      const distressItems = activeListings.filter(item => item.isDistress);
      const recentRequirements = [...activeRequirements].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 5);
      const recentListings = [...activeListings].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 5);
      const recentDistress = [...distressItems].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 5);
      const unreadAlertEntries = getUnreadNotificationItems(getWorkflowNotificationItems());
      const unreadAlerts = unreadAlertEntries.length;
      const stats = [
        {
          label: 'Requirements',
          value: activeRequirements.length || overview.totals?.activeLeads || 0,
          hint: `${activeRequirements.length || overview.totals?.activeLeads || 0} active`,
          action: "openOverviewMetric('activeLeads')"
        },
        {
          label: 'Listings',
          value: activeListings.length || overview.totals?.activeProperties || 0,
          hint: `${activeListings.length || overview.totals?.activeProperties || 0} active`,
          action: "openOverviewMetric('activeListings')"
        },
        {
          label: 'Distress Deals',
          value: distressItems.length,
          hint: `${distressItems.length} urgent`,
          action: "openSection('distress');renderDistressDeals()"
        },
        {
          label: 'Alerts',
          value: unreadAlerts,
          hint: unreadAlerts ? `${unreadAlerts} overdue` : '0 overdue',
          action: 'focusWorkflowAlerts()'
        }
      ];

      const overviewStats = document.getElementById('overviewStats');
      if (overviewStats) {
        overviewStats.innerHTML = stats.map(item => `
          <div
            class="stat-card is-clickable"
            role="button"
            tabindex="0"
            aria-label="Open ${item.label}"
            onclick="${item.action}"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${item.action}}"
          >
            <span class="stat-icon" aria-hidden="true">${getOverviewMetricIcon(item.label)}</span>
            <small>${escapeHtml(item.label)}</small>
            <strong>${escapeHtml(item.value || 0)}</strong>
            <span class="stat-helper">${escapeHtml(item.hint || '')}</span>
          </div>
        `).join('');
      }

      const todayActionsNode = document.getElementById('overviewTodayActions');
      if (todayActionsNode) {
        todayActionsNode.innerHTML = renderOverviewTodayActions(unreadAlertEntries);
      }

      const requirementsNode = document.getElementById('overviewRecentRequirements');
      const listingsNode = document.getElementById('overviewRecentListings');
      const distressNode = document.getElementById('overviewRecentDistress');
      if (requirementsNode) requirementsNode.innerHTML = renderOverviewMiniList(recentRequirements, 'lead');
      if (listingsNode) listingsNode.innerHTML = renderOverviewMiniList(recentListings, 'property');
      if (distressNode) distressNode.innerHTML = renderOverviewMiniList(recentDistress, 'distress');
    }

    function getRecordActionIcon(icon) {
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
        case 'edit':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
          `;
        case 'archive':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h18"></path>
              <path d="M5 7l1 12h12l1-12"></path>
              <path d="M9 11h6"></path>
              <path d="M9 3h6l1 4H8l1-4Z"></path>
            </svg>
          `;
        case 'delete':
          return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18"></path>
              <path d="M8 6V4h8v2"></path>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
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
        default:
          return '';
      }
    }

    function renderRecordActionButton({ label, icon, tone = 'secondary', onclick, disabled = false, extraClass = '' }) {
      const className = ['btn', 'btn-tiny', 'record-action-btn', `is-${tone}`, extraClass].filter(Boolean).join(' ');
      return `
        <button class="${className}" type="button" ${disabled ? 'disabled' : ''} onclick="${onclick}">
          ${getRecordActionIcon(icon)}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }

    function renderLeadActionBar(lead, phoneAvailable) {
      return `
        <div class="record-action-bar">
          ${renderRecordActionButton({
            label: 'WhatsApp',
            icon: 'whatsapp',
            tone: 'primary',
            onclick: `contactLead(${lead.id}, 'whatsapp')`,
            disabled: !phoneAvailable
          })}
          ${renderRecordActionButton({
            label: 'Call',
            icon: 'call',
            tone: 'secondary',
            onclick: `contactLead(${lead.id}, 'call', this)`,
            disabled: !phoneAvailable
          })}
          ${renderRecordActionButton({
            label: getBcpShareButtonLabel(lead.isListedPublic, true),
            icon: 'share',
            tone: 'ghost',
            onclick: `toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)`,
            extraClass: getBcpShareButtonClass(lead.isListedPublic)
          })}
        </div>
      `;
    }

    function renderLeadSecondaryActions(lead) {
      const reportButton = window.ComplaintCenterUi?.renderReportButton({
        label: 'Report',
        iconHtml: getRecordActionIcon('report'),
        className: 'btn btn-secondary',
        onClick: `openLeadComplaint(${lead.id})`,
        currentUserId: state.broker?.id || '',
        reportedUserId: state.broker?.id || '',
        targetType: 'requirement',
        targetId: lead.id,
        selfDisabledText: 'You cannot report your own requirement.'
      }) || '';
      return `
        <div class="record-secondary-actions">
          ${renderRecordActionButton({
            label: 'Edit',
            icon: 'edit',
            tone: 'secondary',
            onclick: `editLead(${lead.id})`
          })}
          ${renderRecordActionButton({
            label: lead.isArchived ? 'Restore' : 'Archive',
            icon: 'archive',
            tone: 'secondary',
            onclick: lead.isArchived ? `restoreLead(${lead.id})` : `archiveLead(${lead.id})`
          })}
          ${renderRecordActionButton({
            label: 'Delete',
            icon: 'delete',
            tone: 'danger',
            onclick: `deleteLead(${lead.id})`
          })}
          ${reportButton}
        </div>
      `;
    }

    function renderPropertyActionBar(property, phoneAvailable) {
      return `
        <div class="record-action-bar">
          ${renderRecordActionButton({
            label: 'WhatsApp',
            icon: 'whatsapp',
            tone: 'primary',
            onclick: `contactPropertyOwner(${property.id}, 'whatsapp')`,
            disabled: !phoneAvailable
          })}
          ${renderRecordActionButton({
            label: 'Call',
            icon: 'call',
            tone: 'secondary',
            onclick: `contactPropertyOwner(${property.id}, 'call', this)`,
            disabled: !phoneAvailable
          })}
          ${renderRecordActionButton({
            label: getBcpShareButtonLabel(property.isListedPublic, true),
            icon: 'share',
            tone: 'ghost',
            onclick: `toggleListItem('property', ${property.id}, ${property.isListedPublic}, this)`,
            extraClass: getBcpShareButtonClass(property.isListedPublic)
          })}
        </div>
      `;
    }

    function renderPropertySecondaryActions(property) {
      const reportButton = window.ComplaintCenterUi?.renderReportButton({
        label: 'Report',
        iconHtml: getRecordActionIcon('report'),
        className: 'btn btn-secondary',
        onClick: `openPropertyComplaint(${property.id}, '${property.isDistress ? 'distress' : 'listing'}')`,
        currentUserId: state.broker?.id || '',
        reportedUserId: state.broker?.id || '',
        targetType: 'listing',
        targetId: property.id,
        selfDisabledText: property.isDistress ? 'You cannot report your own distress deal.' : 'You cannot report your own listing.'
      }) || '';
      return `
        <div class="record-secondary-actions">
          ${renderRecordActionButton({
            label: 'Edit',
            icon: 'edit',
            tone: 'secondary',
            onclick: `editProperty(${property.id})`
          })}
          ${renderRecordActionButton({
            label: property.isArchived ? 'Restore' : 'Archive',
            icon: 'archive',
            tone: 'secondary',
            onclick: property.isArchived ? `restoreProperty(${property.id})` : `archiveProperty(${property.id})`
          })}
          ${renderRecordActionButton({
            label: 'Delete',
            icon: 'delete',
            tone: 'danger',
            onclick: `deleteProperty(${property.id})`
          })}
          ${renderRecordActionButton({
            label: 'View Pictures',
            icon: 'image',
            tone: 'secondary',
            onclick: `openPropertyPictures(${property.id})`
          })}
          ${renderRecordActionButton({
            label: 'Download PDF',
            icon: 'download',
            tone: 'secondary',
            onclick: `downloadPropertyPdf(${property.id})`
          })}
          ${reportButton}
        </div>
      `;
    }

    function normalizeWorkspacePropertyRowActions(target, section = 'properties') {
      if (!target) return;
      const onclickBuilder = (id) => `event.stopPropagation();editProperty(${Number(id)})`;
      target.querySelectorAll('.workspace-table-row[data-workspace-row-id]').forEach(row => {
        const rowId = row.getAttribute('data-workspace-row-id');
        const actions = row.querySelector('.workspace-actions');
        if (!rowId || !actions) return;
        actions.innerHTML = renderRecordActionButton({
          label: 'Edit',
          icon: 'edit',
          tone: 'secondary',
          onclick: onclickBuilder(rowId),
          extraClass: 'record-quick-btn'
        });
      });
    }

    const WORKSPACE_TABLE_COLUMNS = {
      leads: '56px 180px 110px 120px 160px 120px 110px 96px 90px',
      listings: '56px 180px 120px 160px 110px 120px 110px 110px 90px',
      distress: '56px 180px 110px 160px 120px 120px 110px 96px 90px'
    };

    function renderLeadDetailPanel(lead) {
      if (!lead) {
        return `
          <div class="workspace-detail-empty">
            Select a requirement to review client details, workflow, and follow-up actions.
          </div>
        `;
      }

      const followUpState = getFollowUpStateInfo(lead);
      const phoneAvailable = String(lead.clientPhone || '').trim();
      const lastTouched = formatCompactAge(lead.updatedAt || lead.createdAt);

      return `
        <div class="detail-panel-header">
          <div class="detail-panel-head-row">
            <div class="detail-panel-copy">Requirement / Lead</div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="closeLeadRecordPanel()">Close</button>
          </div>
          <h3>${escapeHtml(`${getLeadClientPurposeLabel(lead.clientPurpose)} ${lead.propertyType ? `- ${lead.propertyType}` : 'Requirement'}`)}</h3>
          <div class="detail-panel-meta">
            <span class="badge ${badgeClass(lead.status)}">${escapeHtml(formatStatusLabel(lead.status || 'new'))}</span>
            <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
            <span class="badge ${lead.isListedPublic ? 'badge-green' : 'badge-blue'}">${lead.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
            ${lead.isUrgentFollowUp ? '<span class="badge badge-red">Urgent</span>' : ''}
          </div>
        </div>
        ${renderLeadActionBar(lead, phoneAvailable)}
        ${renderLeadSecondaryActions(lead)}
        <div class="detail-section">
          <h4>Overview</h4>
          <div class="detail-grid">
            <div class="detail-cell"><small>Client Name</small><strong>${renderPrivateNameValue('lead', lead.id, lead.clientName, 'Hidden for privacy')}</strong></div>
            <div class="detail-cell"><small>Client Phone</small><strong>${renderPrivatePhoneValue('lead', lead.id, lead.clientPhone)}</strong></div>
            <div class="detail-cell"><small>Purpose</small><strong>${escapeHtml(getLeadClientPurposeLabel(lead.clientPurpose))}</strong></div>
            <div class="detail-cell"><small>Property Type</small><strong>${escapeHtml(lead.propertyType || '--')}</strong></div>
            <div class="detail-cell"><small>Preferred Location</small><strong>${escapeHtml(lead.location || '--')}</strong></div>
            <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(lead.preferredBuildingProject || '--')}</strong></div>
            <div class="detail-cell"><small>Budget</small><strong>${escapeHtml(formatBudgetLabel(lead.budget))}</strong></div>
            <div class="detail-cell"><small>Payment</small><strong>${escapeHtml(lead.paymentMethod || '--')}</strong></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>Workflow</h4>
          <div class="detail-grid">
            <div class="detail-cell"><small>Status</small><strong>${escapeHtml(formatStatusLabel(lead.status || 'new'))}</strong></div>
            <div class="detail-cell"><small>Last Updated</small><strong>${escapeHtml(`${lastTouched} ago`)}</strong></div>
            <div class="detail-cell"><small>Calls</small><strong>${escapeHtml(lead.callCount || 0)}</strong></div>
            <div class="detail-cell"><small>WhatsApp</small><strong>${escapeHtml(lead.whatsappCount || 0)}</strong></div>
          </div>
          <div class="workflow-strip">
            <select id="requirement-status-action-${lead.id}">
              ${DASHBOARD_LEAD_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(lead.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="changeLeadStatusFromPanel(${lead.id}, 'requirement')">Update Status</button>
          </div>
          <div class="record-inline-grid">
            <div class="field-block">
              <label class="small" for="requirement-followup-date-${lead.id}">Next Follow-up Date</label>
              <input id="requirement-followup-date-${lead.id}" type="date" value="${escapeHtml(lead.nextFollowUpDate || '')}">
            </div>
            <div class="field-block">
              <label class="small" for="requirement-followup-time-${lead.id}">Next Follow-up Time</label>
              <input id="requirement-followup-time-${lead.id}" type="time" value="${escapeHtml(lead.nextFollowUpTime || '')}">
            </div>
            <div class="field-block full">
              <label class="small" for="requirement-followup-note-${lead.id}">Follow-up Note</label>
              <textarea id="requirement-followup-note-${lead.id}" placeholder="Add next-step note">${escapeHtml(lead.followUpNote || '')}</textarea>
            </div>
            <label class="toggle-card compact-toggle">
              <input id="requirement-followup-urgent-${lead.id}" type="checkbox" ${lead.isUrgentFollowUp ? 'checked' : ''}>
              <span><strong>Urgent Reminder</strong><small>Flag this requirement as urgent.</small></span>
            </label>
          </div>
          <div class="detail-toolbar">
            <button class="btn btn-primary btn-tiny" type="button" onclick="saveLeadFollowUpFromPanel(${lead.id}, 'requirement')">Save Follow-up</button>
          </div>
        </div>
        <div class="detail-section">
          <h4>Notes</h4>
          <div class="detail-note">${escapeHtml(lead.privateNotes || 'No private notes yet.')}</div>
        </div>
        <div class="detail-section">
          <h4>Matches</h4>
          ${renderLeadMatches(lead)}
        </div>
        <div class="detail-section">
          <h4>Activity</h4>
          ${renderActivityTimeline(lead.activityLog)}
        </div>
      `;
    }

    function renderPropertyDetailPanel(property, panelType = 'listing') {
      if (!property) {
        return `
          <div class="workspace-detail-empty">
            Select a ${panelType === 'distress' ? 'distress deal' : 'listing'} to review owner details, workflow, and visibility controls.
          </div>
        `;
      }

      const followUpState = getFollowUpStateInfo(property);
      const ownerPhone = String(property.ownerPhone || '').trim();
      const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
      const distressLabel = getPropertyDistressLabel(property);
      const prefix = panelType === 'distress' ? 'distress' : 'listing';

      return `
        <div class="detail-panel-header">
          <div class="detail-panel-head-row">
            <div class="detail-panel-copy">${panelType === 'distress' ? 'Distress Deal' : 'Listing'}</div>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="${panelType === 'distress' ? 'closeDistressRecordPanel()' : 'closePropertyRecordPanel()'}">Close</button>
          </div>
          <h3>${escapeHtml(`${getPropertyPurposeLabel(property.purpose)} ${property.propertyType ? `- ${property.propertyType}` : 'Listing'}`)}</h3>
          <div class="detail-panel-meta">
            <span class="badge ${badgeClass(property.status)}">${escapeHtml(formatStatusLabel(property.status || 'available'))}</span>
            <span class="badge ${followUpState.className}">${escapeHtml(followUpState.label)}</span>
            <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
            ${property.isDistress ? '<span class="badge badge-red">Distress</span>' : ''}
            ${property.isArchived ? '<span class="badge badge-archived">Archived</span>' : ''}
          </div>
        </div>
        ${renderPropertyActionBar(property, ownerPhone)}
        ${renderPropertySecondaryActions(property)}
        <div class="detail-section">
          <h4>Overview</h4>
          <div class="detail-grid">
            <div class="detail-cell"><small>Purpose</small><strong>${escapeHtml(getPropertyPurposeLabel(property.purpose))}</strong></div>
            <div class="detail-cell"><small>Property Type</small><strong>${escapeHtml(property.propertyType || '--')}</strong></div>
            <div class="detail-cell"><small>Property Category</small><strong>${escapeHtml(getDashboardDisplayPropertyCategory(property) || '--')}</strong></div>
            <div class="detail-cell"><small>Unit Layout</small><strong>${escapeHtml(getDashboardDisplayUnitLayout(property) || '--')}</strong></div>
            <div class="detail-cell"><small>Area / Location</small><strong>${escapeHtml(property.location || '--')}</strong></div>
            <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(property.buildingName || '--')}</strong></div>
            <div class="detail-cell"><small>Price</small><strong>${escapeHtml(getPropertyDisplayPrice(property))}</strong></div>
            <div class="detail-cell"><small>Size</small><strong>${escapeHtml(formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit))}</strong></div>
            <div class="detail-cell"><small>Furnishing</small><strong>${escapeHtml(property.furnishing || '--')}</strong></div>
            <div class="detail-cell"><small>Terms</small><strong>${escapeHtml(getPropertyTermsSummary(property))}</strong></div>
            ${getPropertyPurpose(property.purpose) === 'sale' ? `<div class="detail-cell"><small>Sale Status</small><strong>${escapeHtml(getPropertySaleStatusLabel(property) || '--')}</strong></div>` : ''}
            ${getPropertyPurpose(property.purpose) === 'sale' && getPropertyHandoverLabel(property) ? `<div class="detail-cell"><small>Expected Handover</small><strong>${escapeHtml(getPropertyHandoverLabel(property))}</strong></div>` : ''}
            ${property.isDistress ? `<div class="detail-cell"><small>Distress Gap</small><strong>${escapeHtml(distressLabel || 'Add both market and asking prices to calculate distress gap.')}</strong></div>` : ''}
            ${property.isDistress ? `<div class="detail-cell"><small>Market Price</small><strong>${escapeHtml(property.marketPrice ? formatBudgetLabel(property.marketPrice) : 'Add both market and asking prices to calculate distress gap.')}</strong></div>` : ''}
            <div class="detail-cell"><small>Owner Name</small><strong>${renderPrivateNameValue('property', property.id, property.ownerName, 'Private contact')}</strong></div>
            <div class="detail-cell"><small>Owner Phone</small><strong>${renderPrivatePhoneValue('property', property.id, property.ownerPhone)}</strong></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>Workflow</h4>
          <div class="detail-grid">
            <div class="detail-cell"><small>Status</small><strong>${escapeHtml(formatStatusLabel(property.status || 'available'))}</strong></div>
            <div class="detail-cell"><small>Last Updated</small><strong>${escapeHtml(`${lastTouched} ago`)}</strong></div>
            <div class="detail-cell"><small>Owner Calls</small><strong>${escapeHtml(property.ownerCallCount || 0)}</strong></div>
            <div class="detail-cell"><small>Owner WhatsApp</small><strong>${escapeHtml(property.ownerWhatsappCount || 0)}</strong></div>
          </div>
          <div class="workflow-strip">
            <select id="${prefix}-status-action-${property.id}">
              ${DASHBOARD_LISTING_STATUS_OPTIONS.map(option => `<option value="${escapeHtml(option)}" ${option === String(property.status || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(formatStatusLabel(option))}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-tiny" type="button" onclick="changePropertyStatusFromPanel(${property.id}, '${prefix}')">Update Status</button>
          </div>
          <div class="record-inline-grid">
            <div class="field-block">
              <label class="small" for="${prefix}-followup-date-${property.id}">Next Follow-up Date</label>
              <input id="${prefix}-followup-date-${property.id}" type="date" value="${escapeHtml(property.nextFollowUpDate || '')}">
            </div>
            <div class="field-block">
              <label class="small" for="${prefix}-followup-time-${property.id}">Next Follow-up Time</label>
              <input id="${prefix}-followup-time-${property.id}" type="time" value="${escapeHtml(property.nextFollowUpTime || '')}">
            </div>
            <div class="field-block full">
              <label class="small" for="${prefix}-followup-note-${property.id}">Follow-up Note</label>
              <textarea id="${prefix}-followup-note-${property.id}" placeholder="Add owner or viewing follow-up">${escapeHtml(property.followUpNote || '')}</textarea>
            </div>
            <label class="toggle-card compact-toggle">
              <input id="${prefix}-followup-urgent-${property.id}" type="checkbox" ${property.isUrgentFollowUp ? 'checked' : ''}>
              <span><strong>Urgent Reminder</strong><small>Flag this ${panelType === 'distress' ? 'distress deal' : 'listing'} for urgent follow-up.</small></span>
            </label>
          </div>
          <div class="detail-toolbar">
            <button class="btn btn-primary btn-tiny" type="button" onclick="savePropertyFollowUpFromPanel(${property.id}, '${prefix}')">Save Follow-up</button>
          </div>
        </div>
        <div class="detail-section">
          <h4>Notes</h4>
          <div class="detail-note">${escapeHtml(property.publicNotes || property.internalNotes || 'No notes added yet.')}</div>
        </div>
        <div class="detail-section">
          <h4>Matches</h4>
          ${renderPropertyMatches(property)}
        </div>
        <div class="detail-section">
          <h4>Activity</h4>
          ${renderActivityTimeline(property.activityLog)}
        </div>
      `;
    }

    function renderWorkspaceActionBar(title, description, buttonLabel, buttonAction) {
      return `
        <div class="record-toolbar distress-toolbar">
          <div class="workspace-toolbar-copy">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(description)}</span>
          </div>
          <div class="profile-section-actions">
            <button class="btn btn-primary btn-tiny" type="button" onclick="${escapeHtml(buttonAction)}">${escapeHtml(buttonLabel)}</button>
          </div>
        </div>
      `;
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      if (!target) return;
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = `
          ${renderEmptyState(
            'No broker requirements yet',
            'Adjust your filters or add your first lead from Broker Desk to start tracking client demand.',
            'Add New Lead',
            'openLeadComposer()'
          )}
        `;
        return;
      }

      state.selectedLeadId = ensureSelectedWorkspaceId(requirements, state.selectedLeadId);
      const selectedLead = requirements.find(item => String(item.id) === String(state.selectedLeadId)) || null;
      const leadColumns = WORKSPACE_TABLE_COLUMNS.leads;

      target.innerHTML = `
        <div class="workspace-split ${selectedLead ? 'has-detail' : 'no-detail'}">
          <div class="workspace-table-card">
            <div class="workspace-table-scroll">
              <div class="workspace-table-inner">
                <div class="workspace-table-head" style="grid-template-columns:${leadColumns};">
                  <div class="workspace-head-center">#</div>
                  <div>Client / Purpose</div>
                  <div>Property Type</div>
                  <div>Preferred Location</div>
                  <div>Building</div>
                  <div class="workspace-head-right">Budget</div>
                  <div>Status</div>
                  <div class="workspace-head-right">Updated</div>
                  <div class="workspace-head-right">Quick Actions</div>
                </div>
                <div class="workspace-table-body">
                  ${requirements.map((lead, index) => {
                    const followUpState = getFollowUpStateInfo(lead);
                    const phoneAvailable = String(lead.clientPhone || '').trim();
                    const isSelected = String(lead.id) === String(state.selectedLeadId);
                    const lastTouched = formatCompactAge(lead.updatedAt || lead.createdAt);
                    return `
                      <div
                        class="workspace-table-row ${isSelected ? 'is-selected' : ''}"
                        data-workspace-row-id="${lead.id}"
                        role="button"
                        tabindex="0"
                        onclick="openLeadRecord(${lead.id})"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLeadRecord(${lead.id})}"
                        style="grid-template-columns:${leadColumns};"
                      >
                        <div class="workspace-cell workspace-cell-center" data-label="#"><span class="workspace-number">#${index + 1}</span></div>
                        <div class="workspace-cell" data-label="Client / Purpose">
                          <strong>${escapeHtml(lead.clientName || getLeadClientPurposeLabel(lead.clientPurpose))}</strong>
                          <span>${escapeHtml(getLeadIntentText(lead))}</span>
                        </div>
                        <div class="workspace-cell" data-label="Property Type">
                          <strong>${escapeHtml(lead.propertyType || '--')}</strong>
                          <span>${escapeHtml(getLeadClientPurposeLabel(lead.clientPurpose))}</span>
                        </div>
                        <div class="workspace-cell" data-label="Preferred Location">
                          <strong>${escapeHtml(lead.location || '--')}</strong>
                          <span>${escapeHtml(lead.preferredBuildingProject || '--')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Building">
                          <strong>${escapeHtml(lead.preferredBuildingProject || '--')}</strong>
                          <span>${escapeHtml(lead.paymentMethod || '--')}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Budget">
                          <strong>${escapeHtml(formatBudgetLabel(lead.budget))}</strong>
                          <span>${escapeHtml(lead.source || 'Broker desk')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Status">
                          <strong>${escapeHtml(formatStatusLabel(lead.status || 'new'))}</strong>
                          <span>${escapeHtml(followUpState.label)}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Updated">
                          <strong>${escapeHtml(`${lastTouched} ago`)}</strong>
                          <span>${escapeHtml(`${lead.callCount || 0} calls / ${lead.whatsappCount || 0} WA`)}</span>
                        </div>
                        <div class="workspace-actions" data-label="Quick Actions">
                          ${renderRecordActionButton({
                            label: 'Edit',
                            icon: 'edit',
                            tone: 'secondary',
                            onclick: `event.stopPropagation();editLead(${lead.id})`,
                            extraClass: 'record-quick-btn'
                          })}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
          <aside class="workspace-detail-card">
            ${renderLeadDetailPanel(selectedLead)}
          </aside>
        </div>
      `;
      flushWorkspaceSplitScroll('leads');
    }

    function renderProperties() {
      const target = document.getElementById('propertiesList');
      if (!target) return;
      const properties = getFilteredDashboardItems(state.properties, 'property');
      if (!properties.length) {
        target.innerHTML = `
          ${renderEmptyState(
            'No listings yet',
            'Adjust your filters or add your first listing from Broker Desk to start managing inventory.',
            'Add New Listing',
            'openPropertyComposer()'
          )}
        `;
        return;
      }

      state.selectedPropertyId = ensureSelectedWorkspaceId(properties, state.selectedPropertyId);
      const selectedProperty = properties.find(item => String(item.id) === String(state.selectedPropertyId)) || null;
      const listingColumns = WORKSPACE_TABLE_COLUMNS.listings;

      target.innerHTML = `
        <div class="workspace-split ${selectedProperty ? 'has-detail' : 'no-detail'}">
          <div class="workspace-table-card">
            <div class="workspace-table-scroll">
              <div class="workspace-table-inner">
                <div class="workspace-table-head" style="grid-template-columns:${listingColumns};">
                  <div class="workspace-head-center">#</div>
                  <div>Purpose</div>
                  <div>Location</div>
                  <div>Building / Project</div>
                  <div>Type</div>
                  <div class="workspace-head-right">Price</div>
                  <div>Status</div>
                  <div>Visibility</div>
                  <div class="workspace-head-right">Quick Actions</div>
                </div>
                <div class="workspace-table-body">
                  ${properties.map((property, index) => {
                    const ownerPhone = String(property.ownerPhone || '').trim();
                    const isSelected = String(property.id) === String(state.selectedPropertyId);
                    const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
                    return `
                      <div
                        class="workspace-table-row ${isSelected ? 'is-selected' : ''}"
                        data-workspace-row-id="${property.id}"
                        role="button"
                        tabindex="0"
                        onclick="openPropertyRecord(${property.id}, 'properties')"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPropertyRecord(${property.id}, 'properties')}"
                        style="grid-template-columns:${listingColumns};"
                      >
                        <div class="workspace-cell workspace-cell-center" data-label="#"><span class="workspace-number">#${index + 1}</span></div>
                        <div class="workspace-cell" data-label="Purpose">
                          <strong>${escapeHtml(`${getPropertyPurposeLabel(property.purpose)} | ${property.propertyType || 'Listing'}`)}</strong>
                          <span>${escapeHtml(getPropertyTermsSummary(property))}</span>
                        </div>
                        <div class="workspace-cell" data-label="Location">
                          <strong>${escapeHtml(property.location || '--')}</strong>
                          <span>${escapeHtml(property.location ? 'Area / location' : 'No area set')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Building / Project">
                          <strong>${escapeHtml(property.buildingName || '--')}</strong>
                          <span>${escapeHtml(property.buildingName ? 'Building / project' : 'No building set')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Type">
                          <strong>${escapeHtml(property.propertyType || '--')}</strong>
                          <span>${escapeHtml(
                            getPropertyPurpose(property.purpose) === 'sale'
                              ? joinDisplayParts([
                                getPropertySaleStatusLabel(property),
                                getPropertyHandoverLabel(property) ? `Handover ${getPropertyHandoverLabel(property)}` : ''
                              ]) || '--'
                              : property.furnishing || '--'
                          )}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Price">
                          <strong>${escapeHtml(getPropertyDisplayPrice(property))}</strong>
                          <span>${escapeHtml(formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit))}</span>
                        </div>
                        <div class="workspace-cell" data-label="Status">
                          <strong>${escapeHtml(formatStatusLabel(property.status || 'available'))}</strong>
                          <span>${escapeHtml(`${lastTouched} ago`)}</span>
                        </div>
                        <div class="workspace-cell" data-label="Visibility">
                          <strong>${property.isListedPublic ? 'Listed Public' : 'Private Only'}</strong>
                          <span>${property.isDistress ? (getPropertyDistressLabel(property, 'Add prices for gap') || 'Distress deal') : 'Standard inventory'}</span>
                        </div>
                        <div class="workspace-actions" data-label="Quick Actions">
                          ${renderRecordActionButton({
                            label: 'Edit',
                            icon: 'edit',
                            tone: 'secondary',
                            onclick: `event.stopPropagation();editProperty(${property.id})`,
                            extraClass: 'record-quick-btn'
                          })}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
          <aside class="workspace-detail-card">
            ${renderPropertyDetailPanel(selectedProperty, 'listing')}
          </aside>
        </div>
      `;
      normalizeWorkspacePropertyRowActions(target, 'properties');
      flushWorkspaceSplitScroll('properties');
    }

    function renderDistressDeals() {
      const target = document.getElementById('distressList');
      if (!target) return;
      const distressItems = getFilteredDashboardItems(state.properties, 'property').filter(item => item.isDistress);
      if (!distressItems.length) {
        target.innerHTML = renderEmptyState(
          'No distress deals yet',
          'Mark a listing as distress to surface urgent discounted stock in this operational view.',
          'Add Listing',
          'openPropertyComposer()'
        );
        return;
      }

      state.selectedDistressId = ensureSelectedWorkspaceId(distressItems, state.selectedDistressId);
      const selectedDistress = distressItems.find(item => String(item.id) === String(state.selectedDistressId)) || null;
      const distressColumns = WORKSPACE_TABLE_COLUMNS.distress;

      target.innerHTML = `
        <div class="workspace-split ${selectedDistress ? 'has-detail' : 'no-detail'}">
          <div class="workspace-table-card">
            <div class="workspace-table-scroll">
              <div class="workspace-table-inner">
                <div class="workspace-table-head" style="grid-template-columns:${distressColumns};">
                  <div class="workspace-head-center">#</div>
                  <div>Purpose</div>
                  <div>Type</div>
                  <div>Area / Building</div>
                  <div class="workspace-head-right">Asking Price</div>
                  <div class="workspace-head-right">Distress Gap</div>
                  <div>Visibility</div>
                  <div class="workspace-head-right">Updated</div>
                  <div class="workspace-head-right">Quick Actions</div>
                </div>
                <div class="workspace-table-body">
                  ${distressItems.map((property, index) => {
                    const ownerPhone = String(property.ownerPhone || '').trim();
                    const isSelected = String(property.id) === String(state.selectedDistressId);
                    const lastTouched = formatCompactAge(property.updatedAt || property.createdAt);
                    return `
                      <div
                        class="workspace-table-row ${isSelected ? 'is-selected' : ''}"
                        data-workspace-row-id="${property.id}"
                        role="button"
                        tabindex="0"
                        onclick="openPropertyRecord(${property.id}, 'distress')"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPropertyRecord(${property.id}, 'distress')}"
                        style="grid-template-columns:${distressColumns};"
                      >
                        <div class="workspace-cell workspace-cell-center" data-label="#"><span class="workspace-number">#${index + 1}</span></div>
                        <div class="workspace-cell" data-label="Purpose">
                          <strong>${escapeHtml(`${getPropertyPurposeLabel(property.purpose)} | ${property.propertyType || 'Listing'}`)}</strong>
                          <span>${escapeHtml(property.isDistress ? 'Distress deal' : 'Active listing')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Type">
                          <strong>${escapeHtml(property.propertyType || '--')}</strong>
                          <span>${escapeHtml(joinDisplayParts([
                            getPropertySaleStatusLabel(property),
                            getPropertyHandoverLabel(property) ? `Handover ${getPropertyHandoverLabel(property)}` : '',
                            property.furnishing
                          ]) || '--')}</span>
                        </div>
                        <div class="workspace-cell" data-label="Area / Building">
                          <strong>${escapeHtml(property.location || '--')}</strong>
                          <span>${escapeHtml(property.buildingName || '--')}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Asking Price">
                          <strong>${escapeHtml(getPropertyDisplayPrice(property))}</strong>
                          <span>${escapeHtml(formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit))}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Distress Gap">
                          <strong>${escapeHtml(getPropertyDistressLabel(property, 'Add prices for gap') || 'Add prices for gap')}</strong>
                          <span>${escapeHtml(property.marketPrice ? `Market ${formatBudgetLabel(property.marketPrice)}` : formatStatusLabel(property.status || 'available'))}</span>
                        </div>
                        <div class="workspace-cell" data-label="Visibility">
                          <strong>${property.isListedPublic ? 'Listed Public' : 'Private Only'}</strong>
                          <span>${property.isArchived ? 'Archived' : 'Active'}</span>
                        </div>
                        <div class="workspace-cell workspace-cell-right" data-label="Updated">
                          <strong>${escapeHtml(`${lastTouched} ago`)}</strong>
                          <span>${escapeHtml(`${property.ownerCallCount || 0} calls / ${property.ownerWhatsappCount || 0} WA`)}</span>
                        </div>
                        <div class="workspace-actions" data-label="Quick Actions">
                          ${renderRecordActionButton({
                            label: 'Edit',
                            icon: 'edit',
                            tone: 'secondary',
                            onclick: `event.stopPropagation();editProperty(${property.id})`,
                            extraClass: 'record-quick-btn'
                          })}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
          <aside class="workspace-detail-card">
            ${renderPropertyDetailPanel(selectedDistress, 'distress')}
          </aside>
        </div>
      `;
      normalizeWorkspacePropertyRowActions(target, 'distress');
      flushWorkspaceSplitScroll('distress');
    }

    async function logoutBroker() {
      const button = window.ActionFeedbackUi?.resolveActionButton();
      window.ActionFeedbackUi?.setButtonLoading(button, 'Logging out...');
      window.ActionFeedbackUi?.startProgress();
      clearAllPrivateRevealTimers();
      if (brokerActivityHeartbeatTimer) {
        clearInterval(brokerActivityHeartbeatTimer);
        brokerActivityHeartbeatTimer = null;
      }
      clearBrokerClientSessionStorage();
      window.location.href = 'index.html';
    }

    (async function init() {
      try {
        if (enforceBrokerSessionVersion(true)) {
          return;
        }
        initDashboardCallPopover();
        if (typeof initDashboardComplaintModal === 'function') {
          try {
            initDashboardComplaintModal();
          } catch (error) {
            console.error('Complaint modal init failed.', error);
          }
        }
        if (typeof initDashboardRulesPrompt === 'function') {
          try {
            initDashboardRulesPrompt();
          } catch (error) {
            console.error('Complaint rules prompt init failed.', error);
          }
        }
        renderComplaintModal();
        renderDashboardRulesPrompt();
        syncComplaintModalBodyLock();
        wireLeadFormSubmission();
        wirePropertyFormSubmission();
        ensureLeadFormEnhancements();
        ensurePropertyFormEnhancements();
        syncDashboardTaxonomyOptions();
        syncFilterInputs('leads');
        syncFilterInputs('properties');
        renderComplaintCenter();
        const ok = await verifySession();
        if (!ok) return;
        await loadDashboard();
        startBrokerActivityHeartbeat();
      } catch (error) {
        setStatus(error.message || 'Could not open the dashboard.', 'error');
      }
    })();
