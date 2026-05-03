    function renderOverview() {
      const overview = state.overview || { totals: {}, broker: {} };
      const stats = [
        {
          label: 'Leads',
          value: overview.totals?.leads || 0,
          section: 'leads'
        },
        {
          label: 'Inventory',
          value: overview.totals?.properties || 0,
          section: 'properties'
        }
      ];

      document.getElementById('overviewStats').innerHTML = stats.map(item => `
        <div
          class="stat-card is-clickable"
          role="button"
          tabindex="0"
          aria-label="Open ${item.label} page"
          onclick="openOverviewCardSection('${item.section}')"
          onkeydown="handleOverviewCardKeydown(event, '${item.section}')"
        >
          <small>${item.label}</small>
          <strong>${item.value}</strong>
        </div>
      `).join('');
    }

    function leadChecklistSummary(lead) {
      if (String(lead.purpose).toLowerCase() === 'rent') {
      return joinDisplayParts([
        `Booking: ${lead.rentChecklist.booking ? 'Yes' : 'No'}`,
        `Agreement: ${lead.rentChecklist.agreementSigned ? 'Yes' : 'No'}`,
        `Handover: ${lead.rentChecklist.handoverDone ? 'Yes' : 'No'}`
      ]);
      }
      return joinDisplayParts([
        `Contract A: ${lead.saleChecklist.contractA ? 'Yes' : 'No'}`,
        `Contract B: ${lead.saleChecklist.contractB ? 'Yes' : 'No'}`,
        `Contract F: ${lead.saleChecklist.contractF ? 'Yes' : 'No'}`
      ]);
    }

    function renderLeads() {
      const target = document.getElementById('leadsList');
      const requirements = getFilteredDashboardItems(state.leads, 'lead');
      if (!requirements.length) {
        target.innerHTML = `<div class="empty">No broker requirements match your current search. Add your first private broker requirement above.</div>`;
        return;
      }

      target.innerHTML = requirements.map(lead => `
        <div class="item-card">
          <div class="item-top">
            <div class="item-title">
                <h4>${escapeHtml(joinDisplayParts([getLeadClientPurposeLabel(lead.clientPurpose), lead.propertyType || 'Requirement']))}</h4>
                <div class="muted">${escapeHtml(joinDisplayParts([lead.location || '--', formatBudgetLabel(lead.budget), `Created ${new Date(lead.createdAt || Date.now()).toLocaleDateString()}`]))}</div>
            </div>
            <div class="badges">
              <span class="badge ${badgeClass(lead.status)}">${escapeHtml(lead.status || 'new')}</span>
              <span class="badge ${lead.isListedPublic ? 'badge-green' : 'badge-blue'}">${lead.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell"><small>Preferred Location</small><strong>${escapeHtml(lead.location || '--')}</strong></div>
            <div class="detail-cell"><small>Building / Project</small><strong>${escapeHtml(lead.preferredBuildingProject || '--')}</strong></div>
            <div class="detail-cell"><small>Property Type</small><strong>${escapeHtml(lead.propertyType || '--')}</strong></div>
            <div class="detail-cell"><small>${getLeadClientPurpose(lead.clientPurpose) === 'buy' ? 'Payment Method' : 'Client Purpose'}</small><strong>${escapeHtml(getLeadClientPurpose(lead.clientPurpose) === 'buy' ? (lead.paymentMethod || '--') : getLeadClientPurposeLabel(lead.clientPurpose))}</strong></div>
          </div>
                  <div class="muted"><strong>Private client:</strong> ${escapeHtml(getLeadPrivateContactSummary(lead))}</div>
          <div class="muted"><strong>Private CRM note:</strong> ${escapeHtml(lead.privateNotes || 'No private note added')}</div>
          <div class="muted"><strong>Public-safe summary:</strong> ${escapeHtml(lead.publicGeneralNotes || 'No public summary generated yet')}</div>
          <div class="actions">
            <button class="btn btn-secondary btn-tiny" type="button" onclick="editLead(${lead.id})">Edit</button>
            <button class="btn btn-danger btn-tiny" type="button" onclick="deleteLead(${lead.id})">Delete</button>
            <button class="btn ${getBcpShareButtonClass(lead.isListedPublic)} btn-tiny" type="button" onclick="toggleListItem('lead', ${lead.id}, ${lead.isListedPublic}, this)" title="${lead.isListedPublic ? 'Remove from Marketplace' : 'Share on Marketplace'}">${getBcpShareButtonLabel(lead.isListedPublic)}</button>
          </div>
        </div>
      `).join('');
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
                <h4>${escapeHtml(joinDisplayParts([property.propertyType, property.category]))}</h4>
                <div class="muted">${escapeHtml(joinDisplayParts([property.location, property.price, property.purpose]))}</div>
            </div>
            <div class="badges">
              <span class="badge ${badgeClass(property.status)}">${property.status}</span>
              ${property.isDistress ? '<span class="badge badge-red">Hot Distress</span>' : ''}
              <span class="badge ${property.isListedPublic ? 'badge-green' : 'badge-blue'}">${property.isListedPublic ? 'Listed Public' : 'Private Only'}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-cell"><small>Size</small><strong>${formatSizeDisplay(property.sizeSqft || property.size, property.sizeUnit)}</strong></div>
            <div class="detail-cell"><small>Bedrooms</small><strong>${property.bedrooms ?? '--'}</strong></div>
            <div class="detail-cell"><small>Bathrooms</small><strong>${property.bathrooms ?? '--'}</strong></div>
            <div class="detail-cell"><small>Updated</small><strong>${new Date(property.updatedAt || property.createdAt || Date.now()).toLocaleDateString()}</strong></div>
          </div>
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

    function renderSharedListings() {
      const target = document.getElementById('sharedListingsList');
      if (!target) return;
      const sharedListings = getFilteredDashboardItems(state.sharedListings, 'shared');
      if (!sharedListings.length) {
        target.innerHTML = `<div class="empty">No NexBridge listings match your current search yet.</div>`;
        return;
      }

      target.innerHTML = sharedListings
        .sort((a, b) => Number(Boolean(b.isDistress)) - Number(Boolean(a.isDistress)))
        .map(item => `
        <div class="item-card ${item.isDistress ? 'distress-card' : ''}">
          <div class="item-top">
            <div class="item-title">
                <h4>${escapeHtml(joinDisplayParts([item.listingKind.replace('_', ' '), item.purpose, item.category]))}</h4>
                <div class="muted">${escapeHtml(joinDisplayParts([item.location, item.priceLabel]))}</div>
            </div>
            <div class="badges">
              <span class="badge badge-green">${item.status}</span>
              ${item.isDistress ? '<span class="badge badge-red">Hot Distress</span>' : ''}
            </div>
          </div>
          <div class="muted">${item.publicNotes || 'No public note added.'}</div>
          <div class="actions">
            <button class="btn btn-bcp-unshare btn-tiny" type="button" onclick="toggleListItem('${item.sourceType}', ${item.sourceId}, true, this)" title="Remove from Marketplace">${getBcpShareButtonLabel(true)}</button>
          </div>
        </div>
      `).join('');
    }

    function renderFollowups() {
      const target = document.getElementById('followupsList');
      if (!target) return;
      const followUps = getFilteredDashboardItems(state.followUps, 'followup');
      if (!followUps.length) {
        target.innerHTML = `<div class="empty">No meetings or follow-ups match your current search.</div>`;
        return;
      }

      target.innerHTML = followUps.map(item => `
        <div class="mini-item">
          <strong>${item.followUpType}</strong>
                <div class="muted">${escapeHtml(joinDisplayParts([`${item.entityType} #${item.entityId}`, `${item.meetingDate || '--'} ${item.meetingTime || ''}`]))}</div>
                <div class="muted">${escapeHtml(joinDisplayParts([item.note || 'No note', item.nextAction ? `Next: ${item.nextAction}` : '']))}</div>
        </div>
      `).join('');
    }

    function renderProgress() {
      const progressBoard = document.getElementById('progressBoard');
      if (!progressBoard) return;
      const columns = {
        new: [],
        active: [],
        meetings: [],
        closed: []
      };

      getFilteredDashboardItems(state.leads, 'lead').forEach(lead => {
        const status = String(lead.status || '').toLowerCase();
        const html = `<div class="mini-item"><strong>${escapeHtml(lead.category)}</strong><div class="muted">${escapeHtml(joinDisplayParts([lead.location, lead.budget]))}</div></div>`;
        if (status === 'new') columns.new.push(html);
        else if (['contacted', 'demand confirmed', 'negotiation'].includes(status)) columns.active.push(html);
        else if (status === 'meeting scheduled') columns.meetings.push(html);
        else columns.closed.push(html);
      });

      progressBoard.innerHTML = `
        <div class="kanban-card"><h4>New</h4><div class="mini-list">${columns.new.join('') || '<div class="empty">No new requirements</div>'}</div></div>
        <div class="kanban-card"><h4>Active</h4><div class="mini-list">${columns.active.join('') || '<div class="empty">No active negotiations</div>'}</div></div>
        <div class="kanban-card"><h4>Meetings</h4><div class="mini-list">${columns.meetings.join('') || '<div class="empty">No scheduled meetings</div>'}</div></div>
        <div class="kanban-card"><h4>Closed / Cancelled</h4><div class="mini-list">${columns.closed.join('') || '<div class="empty">No closed requirements yet</div>'}</div></div>
      `;
    }

    function renderProfile() {
      syncProfileStorage();
      const profile = getActiveBrokerProfile();
      const completion = getProfileCompletion(profile);
      const verificationLabel = profile.isVerified ? 'Verified' : 'Pending';
      const verificationClass = profile.isVerified ? 'is-verified' : 'is-pending';
      const isEditing = state.isEditingProfile;
      const completionDescription = completion.percent >= 100
        ? 'Profile complete and ready for internal CRM trust.'
        : 'Finish the remaining fields to strengthen your internal broker profile.';
      const socialEntries = [
        ['Instagram', profile.socialLinks?.instagram],
        ['Facebook', profile.socialLinks?.facebook],
        ['LinkedIn', profile.socialLinks?.linkedin],
        ['Website', profile.socialLinks?.website],
        ['WhatsApp Link', profile.socialLinks?.whatsappLink]
      ];
      const target = document.getElementById('profileCard');
      if (!target) return;

      target.innerHTML = `
        <div class="profile-shell">
          <div class="profile-summary-card">
            <div class="profile-summary-main">
              <div class="profile-avatar-wrap">
                <div class="profile-avatar">
                  ${profile.avatarDataUrl
                    ? `<img src="${escapeHtml(profile.avatarDataUrl)}" alt="Broker profile picture">`
                    : `<span class="profile-avatar-fallback">${escapeHtml(getProfileInitials(profile.fullName))}</span>`}
                </div>
                ${isEditing ? `
                  <div class="profile-avatar-actions">
                    <input id="profileAvatarInput" type="file" accept="image/*" class="crm-hidden">
                    <button class="btn btn-secondary btn-tiny" type="button" onclick="document.getElementById('profileAvatarInput').click()">${profile.avatarDataUrl ? 'Replace' : 'Upload'} Photo</button>
                    ${profile.avatarDataUrl ? '<button class="btn btn-secondary btn-tiny" type="button" onclick="removeProfileAvatar()">Remove</button>' : ''}
                  </div>
                ` : ''}
              </div>
              <div class="profile-summary-copy">
                <div class="settings-section-kicker">Account Settings</div>
                <div class="profile-summary-headline">
                  <h3>${escapeHtml(profile.fullName || 'Broker Profile')}</h3>
                  <span class="profile-summary-role">Broker Account</span>
                  <span class="verification-pill ${verificationClass}">${verificationLabel}</span>
                </div>
                <div class="profile-summary-company">${escapeHtml(profile.companyName || 'Add your brokerage or company name')}</div>
                <div class="profile-summary-meta">
                  <span>Broker ID <strong>${escapeHtml(profile.brokerIdNumber || '--')}</strong></span>
                  <span>Email <strong>${escapeHtml(profile.email || '--')}</strong></span>
                  <span>Mobile <strong>${escapeHtml(profile.mobileNumber || '--')}</strong></span>
                </div>
                <div class="profile-summary-note">Your account details stay inside Broker Desk unless future features explicitly publish a public-safe version.</div>
              </div>
            </div>
            <div class="profile-summary-side">
              <div class="profile-summary-statline">
                <div class="settings-section-kicker">Profile ${completion.percent}% complete</div>
                <div class="profile-progress-bar">
                  <div class="profile-progress-fill" style="width:${completion.percent}%"></div>
                </div>
                <div class="profile-summary-company">${escapeHtml(completionDescription)}</div>
              </div>
              <div class="profile-section-actions">
                ${isEditing ? `
                  <button class="btn btn-secondary" type="button" onclick="cancelProfileEdit()" ${state.profileSavePending ? 'disabled' : ''}>Cancel</button>
                  <button class="btn btn-primary" type="button" onclick="saveBrokerProfile()" ${state.profileSavePending ? 'disabled' : ''}>${state.profileSavePending ? 'Saving...' : 'Save Profile'}</button>
                ` : `
                  ${window.ComplaintCenterUi?.renderReportButton({
                    label: 'Report Broker',
                    iconHtml: getRecordActionIcon('report'),
                    className: 'btn btn-secondary',
                    onClick: 'openBrokerComplaintFromProfile()',
                    currentUserId: state.broker?.id || '',
                    reportedUserId: profile.id || state.broker?.id || '',
                    targetType: 'broker',
                    targetId: profile.id || state.broker?.id || '',
                    selfDisabledText: 'You cannot report your own broker profile.'
                  }) || ''}
                  <button class="btn btn-primary" type="button" onclick="beginProfileEdit()">Edit Profile</button>
                `}
              </div>
            </div>
          </div>

          <div class="profile-settings-layout">
            <div class="profile-settings-main">
              <div class="profile-section-card">
                <div class="settings-section-head">
                  <div>
                    <div class="settings-section-kicker">Personal Information</div>
                    <h3>Basic Info</h3>
                  </div>
                  <span class="verification-pill ${verificationClass}">${verificationLabel}</span>
                </div>
                <div class="profile-field-grid">
                  ${isEditing ? `
                    <div class="field-block">
                      <label class="small" for="profileFullNameInput">Full Name</label>
                      <input id="profileFullNameInput" type="text" data-profile-input="fullName" value="${escapeHtml(profile.fullName)}" placeholder="Enter broker name" autocomplete="name">
                    </div>
                    <div class="field-block">
                      <label class="small" for="profileBrokerIdInput">Broker ID</label>
                      <input id="profileBrokerIdInput" type="text" value="${escapeHtml(profile.brokerIdNumber)}" readonly autocomplete="off">
                    </div>
                  ` : `
                    <div class="profile-display-cell"><small>Full Name</small><strong>${escapeHtml(profile.fullName || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Broker ID</small><strong>${escapeHtml(profile.brokerIdNumber || '--')}</strong></div>
                  `}
                </div>
              </div>

              <div class="profile-section-card">
                <div class="settings-section-head">
                  <div>
                    <div class="settings-section-kicker">Contact Details</div>
                    <h3>Contact Info</h3>
                  </div>
                </div>
                <div class="profile-field-grid">
                  ${isEditing ? `
                    <div class="field-block">
                      <label class="small" for="profileMobileNumberInput">Mobile Number</label>
                      <input id="profileMobileNumberInput" type="tel" data-profile-input="mobileNumber" value="${escapeHtml(profile.mobileNumber)}" placeholder="Enter mobile number" autocomplete="tel">
                    </div>
                    <div class="field-block">
                      <label class="small" for="profileEmailInput">Email</label>
                      <input id="profileEmailInput" type="email" data-profile-input="email" value="${escapeHtml(profile.email)}" placeholder="Enter email" autocomplete="email">
                    </div>
                    <div class="field-block">
                      <label class="small" for="profileWhatsappInput">WhatsApp Number</label>
                      <input id="profileWhatsappInput" type="tel" data-profile-input="whatsappNumber" value="${escapeHtml(profile.whatsappNumber)}" placeholder="Enter WhatsApp number" autocomplete="tel">
                    </div>
                    <div class="field-block">
                      <label class="small" for="profileOfficeLocationInput">Office Location</label>
                      <input id="profileOfficeLocationInput" type="text" data-profile-input="officeLocation" value="${escapeHtml(profile.officeLocation)}" placeholder="Enter office location" autocomplete="off">
                    </div>
                  ` : `
                    <div class="profile-display-cell"><small>Mobile</small><strong>${escapeHtml(profile.mobileNumber || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Email</small><strong>${escapeHtml(profile.email || '--')}</strong></div>
                    <div class="profile-display-cell"><small>WhatsApp</small><strong>${escapeHtml(profile.whatsappNumber || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Office Location</small><strong>${escapeHtml(profile.officeLocation || '--')}</strong></div>
                  `}
                </div>
              </div>

              <div class="profile-section-card">
                <div class="settings-section-head">
                  <div>
                    <div class="settings-section-kicker">Professional Information</div>
                    <h3>Broker / Company Details</h3>
                  </div>
                </div>
                <div class="profile-field-grid">
                  ${isEditing ? `
                    <div class="field-block">
                      <label class="small" for="profileCompanyNameInput">Company Name</label>
                      <input id="profileCompanyNameInput" type="text" data-profile-input="companyName" value="${escapeHtml(profile.companyName)}" placeholder="Enter company name" autocomplete="organization">
                    </div>
                    <div class="field-block full">
                      <label class="small" for="profileBioInput">Short Bio</label>
                      <textarea id="profileBioInput" data-profile-input="bio" placeholder="Add a short broker bio">${escapeHtml(profile.bio)}</textarea>
                    </div>
                    <div class="field-block full">
                      <div class="small" id="profileSpecializationLabel">Specialization</div>
                      <div class="choice-chip-grid" aria-labelledby="profileSpecializationLabel">
                        ${PROFILE_SPECIALIZATION_OPTIONS.map(option => `
                          <label class="choice-chip ${profile.specializations.includes(option) ? 'is-selected' : ''}">
                            <input type="checkbox" ${profile.specializations.includes(option) ? 'checked' : ''} onclick="toggleProfileDraftValue('specializations', '${escapeHtml(option)}')">
                            <span>${escapeHtml(option)}</span>
                          </label>
                        `).join('')}
                      </div>
                    </div>
                    <div class="field-block full">
                      <label class="small" for="profileAreasInput">Areas / Communities Served</label>
                      <div class="areas-input-row">
                        <input id="profileAreasInput" type="text" placeholder="Type an area and press Enter" autocomplete="off">
                        <button class="btn btn-secondary btn-tiny" type="button" onclick="addProfileAreaTag()">Add</button>
                      </div>
                      <div class="profile-tags">
                        ${(profile.areasServed || []).length
                          ? profile.areasServed.map(area => `<span class="profile-tag">${escapeHtml(area)} <button type="button" onclick="removeProfileAreaTag('${encodeURIComponent(area)}')">&times;</button></span>`).join('')
                          : '<span class="profile-empty">No communities added yet.</span>'}
                      </div>
                    </div>
                    <div class="field-block full">
                      <div class="small" id="profileLanguagesLabel">Languages Spoken</div>
                      <div class="choice-chip-grid" aria-labelledby="profileLanguagesLabel">
                        ${PROFILE_LANGUAGE_OPTIONS.map(option => `
                          <label class="choice-chip ${profile.languages.includes(option) ? 'is-selected' : ''}">
                            <input type="checkbox" ${profile.languages.includes(option) ? 'checked' : ''} onclick="toggleProfileDraftValue('languages', '${escapeHtml(option)}')">
                            <span>${escapeHtml(option)}</span>
                          </label>
                        `).join('')}
                      </div>
                    </div>
                  ` : `
                    <div class="profile-display-cell"><small>Company Name</small><strong>${escapeHtml(profile.companyName || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Specialization</small><strong>${escapeHtml((profile.specializations || []).join(', ') || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Areas Served</small><strong>${escapeHtml((profile.areasServed || []).join(', ') || '--')}</strong></div>
                    <div class="profile-display-cell"><small>Languages</small><strong>${escapeHtml((profile.languages || []).join(', ') || '--')}</strong></div>
                    <div class="profile-display-cell" style="grid-column:1 / -1;"><small>Short Bio</small><strong>${escapeHtml(profile.bio || '--')}</strong></div>
                  `}
                </div>
              </div>

              <div class="profile-section-card">
                <div class="settings-section-head">
                  <div>
                    <div class="settings-section-kicker">Social Presence</div>
                    <h3>Social Links</h3>
                  </div>
                ${
                  isEditing ? `
                    <div class="profile-field-grid">
                      <div class="field-block">
                        <label class="small" for="profileInstagramInput">Instagram</label>
                        <input id="profileInstagramInput" type="url" data-profile-input="socialLinks.instagram" value="${escapeHtml(profile.socialLinks?.instagram || '')}" placeholder="https://instagram.com/...">
                      </div>
                      <div class="field-block">
                        <label class="small" for="profileFacebookInput">Facebook</label>
                        <input id="profileFacebookInput" type="url" data-profile-input="socialLinks.facebook" value="${escapeHtml(profile.socialLinks?.facebook || '')}" placeholder="https://facebook.com/...">
                      </div>
                      <div class="field-block">
                        <label class="small" for="profileLinkedinInput">LinkedIn</label>
                        <input id="profileLinkedinInput" type="url" data-profile-input="socialLinks.linkedin" value="${escapeHtml(profile.socialLinks?.linkedin || '')}" placeholder="https://linkedin.com/in/...">
                      </div>
                      <div class="field-block">
                        <label class="small" for="profileWebsiteInput">Website</label>
                        <input id="profileWebsiteInput" type="url" data-profile-input="socialLinks.website" value="${escapeHtml(profile.socialLinks?.website || '')}" placeholder="https://yourwebsite.com">
                      </div>
                      <div class="field-block full">
                        <label class="small" for="profileWhatsappLinkInput">WhatsApp Link</label>
                        <input id="profileWhatsappLinkInput" type="url" data-profile-input="socialLinks.whatsappLink" value="${escapeHtml(profile.socialLinks?.whatsappLink || '')}" placeholder="https://wa.me/...">
                      </div>
                    </div>
                  ` : `
                    <div class="profile-link-list">
                      ${socialEntries.some(([, value]) => value)
                        ? socialEntries.filter(([, value]) => value).map(([label, value]) => `
                            <div class="profile-link-row">
                              <div>
                                <small>${escapeHtml(label)}</small>
                                <strong>${escapeHtml(value)}</strong>
                              </div>
                            </div>
                          `).join('')
                        : '<div class="profile-empty">No social links added yet.</div>'}
                    </div>
                  `
                }
              </div>
            </div>

            <div class="profile-settings-side">
              <div class="profile-progress-card">
                <div class="profile-progress-top">
                  <div class="profile-progress-copy">
                    <h3>Profile Completion</h3>
                    <p>Complete the remaining details to make your internal profile stronger and easier to trust at a glance.</p>
                  </div>
                </div>
                <div class="profile-progress-bar">
                  <div class="profile-progress-fill" id="profileCompletionFill" style="width:${completion.percent}%"></div>
                </div>
                <div class="profile-progress-meta">
                  <div>
                    <div class="settings-section-kicker" id="profileCompletionText">Profile ${completion.percent}% complete</div>
                    <div class="profile-hint-list" id="profileHintList"></div>
                  </div>
                  <div class="profile-checklist" id="profileChecklist"></div>
                </div>
              </div>

              <div class="profile-side-card">
                <div class="settings-section-head">
                  <div>
                    <div class="settings-section-kicker">Account Snapshot</div>
                    <h3>Verification & Presence</h3>
                  </div>
                </div>
                <div class="profile-side-list">
                  <div class="profile-side-item">
                    <strong>Verification Status</strong>
                    <span>${escapeHtml(verificationLabel)} broker account</span>
                  </div>
                  <div class="profile-side-item">
                    <strong>Company / Brokerage</strong>
                    <span>${escapeHtml(profile.companyName || 'Add your brokerage name to complete this section')}</span>
                  </div>
                  <div class="profile-side-item">
                    <strong>Profile Visibility</strong>
                    <span>Profile details stay private inside Broker Desk unless future connector features explicitly publish safe public fields.</span>
                  </div>
                </div>
              </div>

              ${isEditing ? `
                <div class="profile-save-rail">
                  <div class="settings-section-head">
                    <div>
                      <div class="settings-section-kicker">Save Actions</div>
                      <h3>Update Profile</h3>
                    </div>
                  </div>
                  <div class="profile-note">Save after finishing your edits, or cancel to return to the current live profile values.</div>
                  <div class="profile-section-actions">
                    <button class="btn btn-secondary" type="button" onclick="cancelProfileEdit()" ${state.profileSavePending ? 'disabled' : ''}>Cancel</button>
                    <button class="btn btn-primary" type="button" onclick="saveBrokerProfile()" ${state.profileSavePending ? 'disabled' : ''}>${state.profileSavePending ? 'Saving...' : 'Save Profile'}</button>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          ${isEditing ? `
            <div class="profile-section-actions profile-section-actions-bottom">
              <button class="btn btn-secondary" type="button" onclick="cancelProfileEdit()" ${state.profileSavePending ? 'disabled' : ''}>Cancel</button>
              <button class="btn btn-primary" type="button" onclick="saveBrokerProfile()" ${state.profileSavePending ? 'disabled' : ''}>${state.profileSavePending ? 'Saving...' : 'Save Profile'}</button>
            </div>
          ` : ''}
        </div>
      `;

      if (isEditing) wireProfileEditor();
      else refreshProfileCompletionUi();
    }

    function renderSettings() {
      syncProfileStorage();
      const target = document.getElementById('settingsCard');
      if (!target) return;
      const profile = getActiveBrokerProfile();
      const completion = getProfileCompletion(profile);
      const verificationLabel = profile.isVerified ? 'Verified' : 'Pending';
      const socialCount = Object.values(profile.socialLinks || {}).filter(Boolean).length;
      const verificationClass = profile.isVerified ? 'is-verified' : 'is-pending';
      const socialSummary = socialCount === 1 ? '1 link connected' : `${socialCount} links connected`;
      const settingsViews = [
        { id: 'account', label: 'Account', copy: 'Identity, access, and linked broker account details.' },
        { id: 'preferences', label: 'Preferences', copy: 'Workspace defaults and future personal controls.' },
        { id: 'privacy', label: 'Privacy & Security', copy: 'Session, visibility, and account safety guidance.' },
        { id: 'broker', label: 'Broker Controls', copy: 'Operational shortcuts tied to broker workflows.' },
        { id: 'workspace', label: 'Workspace', copy: 'Expandable settings architecture for future modules.' }
      ];
      const activeSettingsView = settingsViews.some(view => view.id === state.settingsView) ? state.settingsView : 'account';
      state.settingsView = activeSettingsView;

      let panelMarkup = '';
      if (activeSettingsView === 'account') {
        panelMarkup = `
          <div class="profile-section-card settings-section-card">
            <div class="settings-section-head">
              <div>
                <div class="settings-section-kicker">Account</div>
                <h3>Broker Account</h3>
              </div>
              <span class="verification-pill ${verificationClass}">${verificationLabel}</span>
            </div>
            <div class="settings-kv-grid">
              <div class="settings-kv-item"><small>Full Name</small><strong>${escapeHtml(profile.fullName || '--')}</strong></div>
              <div class="settings-kv-item"><small>Broker ID</small><strong>${escapeHtml(profile.brokerIdNumber || '--')}</strong></div>
              <div class="settings-kv-item"><small>Email</small><strong>${escapeHtml(profile.email || '--')}</strong></div>
              <div class="settings-kv-item"><small>Mobile Number</small><strong>${escapeHtml(profile.mobileNumber || '--')}</strong></div>
            </div>
          </div>
          <div class="settings-card-grid">
            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Profile</div>
                  <h3>Identity Workspace</h3>
                </div>
                <div class="profile-section-actions">
                  <button class="btn btn-secondary btn-tiny" type="button" onclick="openProfilePage()">View Profile</button>
                  <button class="btn btn-primary btn-tiny" type="button" onclick="openProfileEditorFromSettings()">Edit Profile</button>
                </div>
              </div>
              <div class="settings-copy-block">
                <p>Profile stays separate from Settings and remains the home for broker identity, professional details, social links, and completion progress.</p>
              </div>
              <div class="settings-kv-grid">
                <div class="settings-kv-item"><small>Company / Brokerage</small><strong>${escapeHtml(profile.companyName || '--')}</strong></div>
                <div class="settings-kv-item"><small>Office Location</small><strong>${escapeHtml(profile.officeLocation || '--')}</strong></div>
                <div class="settings-kv-item"><small>Profile Completion</small><strong>${completion.percent}% complete</strong></div>
                <div class="settings-kv-item"><small>Social Links</small><strong>${escapeHtml(socialSummary)}</strong></div>
              </div>
            </div>
            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Access</div>
                  <h3>Session & Access</h3>
                </div>
              </div>
              <div class="settings-note-list">
                <div class="settings-note-item">
                  <strong>Authenticated Broker Session</strong>
                  <span>Your account access continues to use the existing Broker Desk auth flow without any routing changes.</span>
                </div>
                <div class="settings-note-item">
                  <strong>Top Bar Account Menu</strong>
                  <span>Open Profile, Settings, or Logout from the account area in the top bar for the standard SaaS navigation pattern.</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (activeSettingsView === 'preferences') {
        panelMarkup = `
          <div class="profile-section-card settings-section-card">
            <div class="settings-section-head">
              <div>
                <div class="settings-section-kicker">Preferences</div>
                <h3>Workspace Defaults</h3>
              </div>
            </div>
            <div class="settings-copy-block">
              <p>Settings is now ready for future broker preferences while today’s working CRM logic stays in its existing sections. These blocks keep the architecture expandable without inventing unsupported controls.</p>
            </div>
            <div class="settings-hero-statline">
              <div class="settings-mini-stat"><small>Profile Readiness</small><strong>${completion.percent}% complete</strong></div>
              <div class="settings-mini-stat"><small>Social Presence</small><strong>${escapeHtml(socialSummary)}</strong></div>
              <div class="settings-mini-stat"><small>Verification</small><strong>${escapeHtml(verificationLabel)}</strong></div>
            </div>
          </div>
          <div class="settings-card-grid">
            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Current Defaults</div>
                  <h3>Operational Preferences</h3>
                </div>
              </div>
              <div class="settings-note-list">
                <div class="settings-note-item">
                  <strong>Search & Filters</strong>
                  <span>Lead, listing, and distress filters continue to work inside their own modules so today’s workflows stay unchanged.</span>
                </div>
                <div class="settings-note-item">
                  <strong>Display Consistency</strong>
                  <span>Workspace lists, split views, and detail panels follow the same Noman Core layout without creating a separate preference engine yet.</span>
                </div>
              </div>
            </div>
            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Future Ready</div>
                  <h3>Expandable Controls</h3>
                </div>
              </div>
              <div class="settings-note-list">
                <div class="settings-note-item">
                  <strong>Notifications</strong>
                  <span>This section is ready for future notification preferences when those controls become supported.</span>
                </div>
                <div class="settings-note-item">
                  <strong>Workspace Personalization</strong>
                  <span>Future dashboard, AI, and broker connector preferences can be added here without merging them back into Profile.</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (activeSettingsView === 'privacy') {
        panelMarkup = `
          <div class="profile-section-card settings-section-card">
            <div class="settings-section-head">
              <div>
                <div class="settings-section-kicker">Privacy & Security</div>
                <h3>Account Safety</h3>
              </div>
            </div>
            <div class="settings-card-grid">
              <div class="profile-side-card settings-section-card">
                <div class="settings-copy-block">
                  <p>Security continues to follow the current authenticated broker flow. This page keeps those controls visible without changing the working session and routing architecture.</p>
                </div>
                <div class="settings-note-list">
                  <div class="settings-note-item">
                    <strong>Session Access</strong>
                    <span>Your dashboard session remains protected by the existing login flow and access checks.</span>
                  </div>
                  <div class="settings-note-item">
                    <strong>Password Recovery</strong>
                    <span>Password reset still follows the existing sign-in and recovery flow outside the dashboard, so no working auth behavior is changed here.</span>
                  </div>
                </div>
              </div>
              <div class="profile-side-card settings-section-card">
                <div class="settings-note-list">
                  <div class="settings-note-item">
                    <strong>Profile Visibility</strong>
                    <span>Profile details remain private inside Broker Desk unless future public-safe publishing is explicitly supported.</span>
                  </div>
                  <div class="settings-note-item">
                    <strong>Broker Connector Safety</strong>
                    <span>Public and shared listing visibility continues to be controlled from operational workflows, not from this safety page.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (activeSettingsView === 'broker') {
        panelMarkup = `
          <div class="profile-section-card settings-section-card">
            <div class="settings-section-head">
              <div>
                <div class="settings-section-kicker">Broker Controls</div>
                <h3>Operational Controls</h3>
              </div>
            </div>
            <div class="settings-copy-block">
              <p>Operational sharing, visibility, and record-level actions stay exactly where brokers already use them today: inside Requirements, Listings, and Distress workflows.</p>
            </div>
            <div class="profile-section-actions">
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('leads')">Open Requirements</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('properties')">Open Listings</button>
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('distress')">Open Distress Deals</button>
            </div>
          </div>
          <div class="settings-card-grid">
            <div class="profile-side-card settings-section-card">
              <div class="settings-note-list">
                <div class="settings-note-item">
                  <strong>Requirements Workflow</strong>
                  <span>Create, edit, and manage demand-side records directly inside Requirements with no logic moved into Settings.</span>
                </div>
                <div class="settings-note-item">
                  <strong>Listings Workflow</strong>
                  <span>Inventory visibility, share state, and deal updates continue to live in Listings and Distress modules where brokers already act on them.</span>
                </div>
              </div>
            </div>
            <div class="profile-side-card settings-section-card">
              <div class="settings-note-list">
                <div class="settings-note-item">
                  <strong>Profile Shortcut</strong>
                  <span>Use Profile for identity and public-facing broker information, then return here for workspace controls and future settings modules.</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        panelMarkup = `
          <div class="profile-section-card settings-section-card">
            <div class="settings-section-head">
              <div>
                <div class="settings-section-kicker">Workspace</div>
                <h3>Expandable Settings Architecture</h3>
              </div>
            </div>
            <div class="settings-copy-block">
              <p>Settings is now a dedicated control center that can grow without turning Profile back into a mixed identity/settings page. This keeps navigation clean and future expansion simple.</p>
            </div>
            <div class="settings-card-grid">
              <div class="profile-side-card settings-section-card">
                <div class="settings-note-list">
                  <div class="settings-note-item">
                    <strong>Notifications</strong>
                    <span>Ready for future alert preferences and delivery controls when those features are formally supported.</span>
                  </div>
                  <div class="settings-note-item">
                    <strong>AI & Automation</strong>
                    <span>Future AI, matching, and automation controls can be added here without changing current business logic.</span>
                  </div>
                </div>
              </div>
              <div class="profile-side-card settings-section-card">
                <div class="settings-note-list">
                  <div class="settings-note-item">
                    <strong>Workspace Controls</strong>
                    <span>Additional broker connector, team, or dashboard preferences can be layered into this structure later while keeping today’s modules stable.</span>
                  </div>
                  <div class="settings-note-item">
                    <strong>Consistent Navigation</strong>
                    <span>Sidebar Settings stays dedicated to controls, while Profile remains accessible from the top bar account area.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      target.innerHTML = `
        <div class="settings-shell">
          <div class="settings-page-head">
            <div class="settings-page-copy">
              <div class="settings-section-kicker">Workspace Control Center</div>
              <h3>Settings</h3>
              <p>Use Settings for broker account controls, privacy guidance, workspace management, and future preferences. Profile remains a separate identity page in the top bar account area.</p>
            </div>
            <div class="settings-page-actions">
              <button class="btn btn-secondary btn-tiny" type="button" onclick="openProfilePage()">Open Profile</button>
              <button class="btn btn-primary btn-tiny" type="button" onclick="openProfileEditorFromSettings()">Edit Profile</button>
            </div>
          </div>
          <div class="settings-page-body">
            <div class="settings-nav-card">
              <div class="settings-section-kicker">Navigate</div>
              <div class="settings-nav-list">
                ${settingsViews.map(view => `
                  <button class="settings-nav-btn ${activeSettingsView === view.id ? 'is-active' : ''}" type="button" onclick="setSettingsView('${view.id}')">
                    <span class="settings-nav-meta">
                      <strong>${escapeHtml(view.label)}</strong>
                      <span>${escapeHtml(view.copy)}</span>
                    </span>
                    <span class="settings-nav-arrow">&rsaquo;</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="settings-content-stack">
              ${panelMarkup}
            </div>
          </div>
        </div>
      `;
      return;

      target.innerHTML = `
        <div class="settings-layout">
          <div class="settings-stack">
            <div class="profile-section-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Account</div>
                  <h3>Broker Account</h3>
                </div>
                <span class="verification-pill ${profile.isVerified ? 'is-verified' : 'is-pending'}">${verificationLabel}</span>
              </div>
              <div class="profile-field-grid">
                <div class="profile-display-cell"><small>Full Name</small><strong>${escapeHtml(profile.fullName || '--')}</strong></div>
                <div class="profile-display-cell"><small>Broker ID</small><strong>${escapeHtml(profile.brokerIdNumber || '--')}</strong></div>
                <div class="profile-display-cell"><small>Email</small><strong>${escapeHtml(profile.email || '--')}</strong></div>
                <div class="profile-display-cell"><small>Mobile Number</small><strong>${escapeHtml(profile.mobileNumber || '--')}</strong></div>
              </div>
            </div>

            <div class="profile-section-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Profile</div>
                  <h3>Profile Management</h3>
                </div>
                <div class="profile-section-actions">
                  <button class="btn btn-secondary btn-tiny" type="button" onclick="openProfilePage()">View Profile</button>
                  <button class="btn btn-primary btn-tiny" type="button" onclick="openProfileEditorFromSettings()">Edit Profile</button>
                </div>
              </div>
              <div class="profile-note">Profile is now a dedicated page for identity, professional details, social links, and completion progress. Open it from the top bar account area anytime.</div>
              <div class="profile-field-grid">
                <div class="profile-display-cell"><small>Company / Brokerage</small><strong>${escapeHtml(profile.companyName || '--')}</strong></div>
                <div class="profile-display-cell"><small>Office Location</small><strong>${escapeHtml(profile.officeLocation || '--')}</strong></div>
                <div class="profile-display-cell"><small>Profile Completion</small><strong>${completion.percent}% complete</strong></div>
                <div class="profile-display-cell"><small>Social Links</small><strong>${escapeHtml(String(socialCount))} connected</strong></div>
              </div>
            </div>

            <div class="profile-section-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Broker Controls</div>
                  <h3>Operational Controls</h3>
                </div>
              </div>
              <div class="profile-note">Sharing and visibility controls remain inside Leads, Listings, and Distress workflows so operational logic stays unchanged.</div>
              <div class="profile-section-actions">
                <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('leads')">Open Requirements</button>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('properties')">Open Listings</button>
                <button class="btn btn-secondary btn-tiny" type="button" onclick="openSection('distress')">Open Distress Deals</button>
              </div>
            </div>
          </div>

          <div class="settings-stack">
            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Privacy & Security</div>
                  <h3>Account Safety</h3>
                </div>
              </div>
              <div class="profile-side-list">
                <div class="profile-side-item">
                  <strong>Session Access</strong>
                  <span>Your login session and account access continue to follow the existing Broker Desk auth flow.</span>
                </div>
                <div class="profile-side-item">
                  <strong>Profile Visibility</strong>
                  <span>Profile details remain private inside Broker Desk unless future public-safe publishing is explicitly supported.</span>
                </div>
              </div>
            </div>

            <div class="profile-side-card settings-section-card">
              <div class="settings-section-head">
                <div>
                  <div class="settings-section-kicker">Future Modules</div>
                  <h3>Settings Workspace</h3>
                </div>
              </div>
              <div class="profile-side-list">
                <div class="profile-side-item">
                  <strong>Notifications</strong>
                  <span>This area is ready for future notification and account preference controls without changing today’s working logic.</span>
                </div>
                <div class="profile-side-item">
                  <strong>Account Preferences</strong>
                  <span>Additional broker controls can be added here later while keeping Profile focused on identity and professional information.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function populateFollowupEntities() {
      const select = document.getElementById('followupEntityId');
      const typeField = document.getElementById('followupEntityType');
      if (!select || !typeField) return;
      const type = typeField.value;
      const source = type === 'lead' ? state.leads : state.properties;
      select.innerHTML = source.map(item => {
        const label = type === 'lead'
          ? joinDisplayParts([item.id, item.category, item.location])
          : joinDisplayParts([item.id, item.propertyType, item.location]);
        return `<option value="${item.id}">${label}</option>`;
      }).join('');
      if (!source.length) {
        select.innerHTML = '<option value="">No records available</option>';
      }
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
      leadAutocompleteControllers.location?.close();
      leadAutocompleteControllers.building?.close();
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
        location: normalizeDashboardLocationValue(document.getElementById('leadLocation').value),
        preferredBuildingProject: document.getElementById('leadBuildingProject').value.trim(),
        propertyType: normalizeDashboardPropertyTypeValue(document.getElementById('leadPropertyType').value),
        budget: normalizeBudgetDigits(document.getElementById('leadBudget').value),
        paymentMethod: document.getElementById('leadPaymentMethod').value.trim(),
        clientName: document.getElementById('leadClientName').value.trim(),
        clientPhone: normalizeLeadPhoneInput(document.getElementById('leadClientPhone').value.trim()),
        privateNotes: document.getElementById('leadPrivateNotes').value.trim(),
        publicGeneralNotes: '',
        source: preserved.source,
        priority: preserved.priority,
        status: preserved.status,
        meetingDate: preserved.meetingDate,
        meetingTime: preserved.meetingTime,
        nextAction: preserved.nextAction,
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
      if (!formData.propertyCategory) errors.propertyCategory = 'Select property category';
      if (dashboardCategoryAllowsSelectableLayout(formData.propertyCategory) && !formData.unitLayout) errors.unitLayout = 'Select unit layout';
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

    function resetPropertyForm() {
      document.getElementById('propertyForm').reset();
      document.getElementById('propertyId').value = '';
      document.getElementById('propertyFormTitle').textContent = 'Add Property';
      document.getElementById('propertySubmitBtn').textContent = 'Save Property';
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
      document.getElementById('leadSubmitBtn').textContent = 'Update Lead';
    }

    function editProperty(id) {
      const property = state.properties.find(item => item.id === id);
      if (!property) return;
      showOverviewWorkspace('property');
      document.getElementById('propertyId').value = property.id;
      document.getElementById('propertyPurpose').value = property.purpose || '';
      document.getElementById('propertyType').value = property.propertyType || '';
      document.getElementById('propertyCategory').value = property.category || '';
      document.getElementById('propertyLocation').value = property.location || '';
      document.getElementById('propertyPrice').value = property.price || '';
      document.getElementById('propertySize').value = property.size || '';
      document.getElementById('propertyBedrooms').value = property.bedrooms ?? '';
      document.getElementById('propertyBathrooms').value = property.bathrooms ?? '';
      document.getElementById('propertyDescription').value = property.description || '';
      document.getElementById('propertyPublicNotes').value = property.publicNotes || '';
      document.getElementById('propertyInternalNotes').value = property.internalNotes || '';
      document.getElementById('propertyOwnerName').value = property.ownerName || '';
      document.getElementById('propertyOwnerPhone').value = property.ownerPhone || '';
      document.getElementById('propertyStatus').value = property.status || 'available';
      document.getElementById('propertyDistress').checked = property.isDistress;
      document.getElementById('propertyFormTitle').textContent = 'Edit Property';
      document.getElementById('propertySubmitBtn').textContent = 'Update Property';
    }

    async function deleteLead(id) {
      if (!window.confirm('Delete this private broker requirement?')) return;
      try {
        await dashboardAction({ action: 'delete-lead', id }, 'Requirement deleted successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Deleting Requirement...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function deleteProperty(id) {
      if (!window.confirm('Delete this private property?')) return;
      try {
        await dashboardAction({ action: 'delete-property', id }, 'Listing deleted successfully.', {
          button: window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: 'Deleting Listing...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    async function proceedToggleListItem(entityType, id, listed, buttonCandidate = null) {
      try {
        await dashboardAction({
          action: listed ? 'unlist-item' : 'list-item',
          entityType,
          id
        }, listed ? 'Removed from Marketplace successfully.' : 'Shared on Marketplace successfully.', {
          button: buttonCandidate || window.ActionFeedbackUi?.resolveActionButton(),
          loadingText: listed ? 'Removing from Marketplace...' : 'Sharing on Marketplace...'
        });
      } catch (error) {
        setStatus(error.message, 'error');
      }
    }

    document.getElementById('leadForm').addEventListener('submit', async event => {
      event.preventDefault();
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
        ownerName: formData.ownerName,
        ownerPhone: formData.ownerPhone,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        legacyFollowUpNotes: formData.legacyFollowUpNotes,
        rentChecklist: formData.rentChecklist,
        saleChecklist: formData.saleChecklist
      };

      try {
        await dashboardAction(payload, formData.id ? 'Broker requirement updated successfully.' : 'Broker requirement created successfully.');
        resetLeadForm();
        hideOverviewWorkspace();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    document.getElementById('propertyForm').addEventListener('submit', async event => {
      event.preventDefault();
      const id = Number(document.getElementById('propertyId').value || 0);
      const payload = {
        action: id ? 'update-property' : 'create-property',
        id,
        purpose: document.getElementById('propertyPurpose').value,
        propertyType: document.getElementById('propertyType').value,
        category: document.getElementById('propertyCategory').value,
        location: document.getElementById('propertyLocation').value,
        price: document.getElementById('propertyPrice').value,
        size: document.getElementById('propertySize').value,
        bedrooms: document.getElementById('propertyBedrooms').value ? Number(document.getElementById('propertyBedrooms').value) : null,
        bathrooms: document.getElementById('propertyBathrooms').value ? Number(document.getElementById('propertyBathrooms').value) : null,
        description: document.getElementById('propertyDescription').value,
        publicNotes: document.getElementById('propertyPublicNotes').value,
        internalNotes: document.getElementById('propertyInternalNotes').value,
        ownerName: document.getElementById('propertyOwnerName').value,
        ownerPhone: document.getElementById('propertyOwnerPhone').value,
        status: document.getElementById('propertyStatus').value,
        isDistress: document.getElementById('propertyDistress').checked
      };

      try {
        await dashboardAction(payload, id ? 'Property updated successfully.' : 'Property created successfully.');
        resetPropertyForm();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    const followupForm = document.getElementById('followupForm');
    if (followupForm) {
      followupForm.addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await dashboardAction({
            action: 'save-followup',
            entityType: document.getElementById('followupEntityType').value,
            entityId: document.getElementById('followupEntityId').value,
            followUpType: document.getElementById('followupType').value,
            meetingDate: document.getElementById('followupDate').value,
            meetingTime: document.getElementById('followupTime').value,
            note: document.getElementById('followupNote').value,
            nextAction: document.getElementById('followupNextAction').value
          }, 'Follow-up saved.');
          followupForm.reset();
          populateFollowupEntities();
        } catch (error) {
          setStatus(error.message, 'error');
        }
      });
    }

    const followupEntityType = document.getElementById('followupEntityType');
    if (followupEntityType) {
      followupEntityType.addEventListener('change', populateFollowupEntities);
    }
    document.getElementById('dashboardSearchInput').addEventListener('input', event => {
      renderDashboardSuggestions(event.target.value);
    });
    document.getElementById('dashboardSearchInput').addEventListener('focus', event => {
      if (String(event.target.value || '').trim()) {
        renderDashboardSuggestions(event.target.value);
      }
    });
    document.getElementById('dashboardSearchInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyDashboardSearch(event.target.value);
      }
      if (event.key === 'Escape') {
        renderDashboardSuggestions('');
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('#dashboardSearchBox') && !event.target.closest('#dashboardSearchSuggestions')) {
        renderDashboardSuggestions('');
      }
      if (!event.target.closest('.notification-menu-wrap')) {
        closeNotificationPanel();
      }
      if (!event.target.closest('.account-menu-wrap')) {
        closeAccountMenu();
      }
      if (!event.target.closest('.activity-brokers-wrap')) {
        closeBrokerActivityMenu();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeNotificationPanel();
        closeAccountMenu();
        closeBrokerActivityMenu();
        closeWorkflowContextModal();
      }
    });
