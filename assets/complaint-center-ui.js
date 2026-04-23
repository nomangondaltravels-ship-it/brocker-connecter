(function attachComplaintCenterUi(global) {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeValue(value) {
    return String(value ?? '').trim();
  }

  function hasAdminSession() {
    try {
      return Boolean(global.localStorage?.getItem('admin_session_token'));
    } catch (error) {
      return false;
    }
  }

  function getReportButtonState(options = {}) {
    const currentUserId = normalizeValue(options.currentUserId);
    const reportedUserId = normalizeValue(options.reportedUserId);
    const targetType = normalizeValue(options.targetType).toLowerCase();
    const targetId = normalizeValue(options.targetId);
    const isAdmin = Boolean(options.isAdmin) || hasAdminSession();
    const isSelfTarget = Boolean(currentUserId && reportedUserId && currentUserId === reportedUserId);
    const isMissingTarget = !targetType || !targetId;
    const disabledReason = isSelfTarget
      ? normalizeValue(options.selfDisabledText) || 'You cannot report your own record.'
      : isMissingTarget
        ? 'Report target could not be identified.'
        : normalizeValue(options.disabledReason);

    return {
      hidden: isAdmin,
      disabled: Boolean(options.disabled) || isSelfTarget || isMissingTarget,
      disabledReason
    };
  }

  function renderReportButton(options = {}) {
    const state = getReportButtonState(options);
    if (state.hidden) return '';

    const className = normalizeValue(options.className) || 'btn btn-secondary';
    const label = normalizeValue(options.label) || 'Report';
    const iconHtml = typeof options.iconHtml === 'string' ? options.iconHtml : '';
    const onClick = state.disabled ? '' : normalizeValue(options.onClick);
    const title = state.disabled && state.disabledReason ? ` title="${escapeHtml(state.disabledReason)}"` : '';
    const disabledAttr = state.disabled ? ' disabled' : '';
    const onClickAttr = onClick ? ` onclick="${onClick}"` : '';

    return `<button class="${escapeHtml(className)}" type="button"${disabledAttr}${title}${onClickAttr}>${iconHtml}<span>${escapeHtml(label)}</span></button>`;
  }

  function renderReasonOptions(reasonOptions = [], selectedReason = '') {
    return (Array.isArray(reasonOptions) ? reasonOptions : [])
      .map(option => `<option value="${escapeHtml(option)}" ${selectedReason === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
      .join('');
  }

  // Shared modal shell keeps complaint form markup consistent without forcing a redesign.
  function renderComplaintFormModal(options = {}) {
    const variant = normalizeValue(options.variant).toLowerCase() === 'public' ? 'public' : 'dashboard';
    const shellClass = variant === 'public' ? 'complaint-shell' : 'complaint-modal-shell';
    const headClass = variant === 'public' ? 'complaint-head' : 'complaint-modal-head';
    const fieldClass = variant === 'public' ? 'complaint-form-card' : 'complaint-form-section';
    const actionsClass = variant === 'public' ? 'complaint-actions-row' : 'complaint-modal-actions';
    const hiddenInputClass = normalizeValue(options.uploadInputClass) || (variant === 'public' ? 'hidden' : 'crm-hidden');
    const reasonOptionsHtml = renderReasonOptions(options.reasonOptions, options.selectedReason);
    const uploadInputId = normalizeValue(options.uploadInputId) || 'complaintProofInput';
    const uploadHandler = normalizeValue(options.uploadHandler) || `document.getElementById('${uploadInputId}').click()`;
    const closeHandler = normalizeValue(options.closeHandler) || 'return false';
    const cancelHandler = normalizeValue(options.cancelHandler) || closeHandler;
    const submitHandler = normalizeValue(options.submitHandler) || 'return false';
    const reasonChangeHandler = normalizeValue(options.reasonChangeHandler) || '';
    const descriptionChangeHandler = normalizeValue(options.descriptionChangeHandler) || '';
    const proofName = normalizeValue(options.proofName) || 'Images or PDF up to 2 MB';
    const targetTypeLabel = normalizeValue(options.targetTypeLabel) || 'Record';
    const targetSummary = normalizeValue(options.targetSummary) || 'Selected record';
    const reportedUserLabel = normalizeValue(options.reportedUserLabel) || 'Broker account';
    const reportedMeta = normalizeValue(options.reportedMeta);
    const cancelLabel = normalizeValue(options.cancelLabel) || 'Cancel';
    const submitLabel = normalizeValue(options.submitLabel) || 'Submit Complaint';
    const submittingLabel = normalizeValue(options.submittingLabel) || 'Submitting...';
    const extraContentHtml = typeof options.extraContentHtml === 'string' ? options.extraContentHtml : '';

    return `
      <form class="${shellClass}" onsubmit="${submitHandler}">
        <div class="${headClass}">
          <div>
            <div class="${variant === 'public' ? 'small' : 'settings-section-kicker'}">${escapeHtml(normalizeValue(options.kicker) || 'Complaint Center')}</div>
            <h3 id="${escapeHtml(normalizeValue(options.titleId) || 'complaintModalTitle')}">${escapeHtml(normalizeValue(options.title) || 'Submit Complaint')}</h3>
            <p class="${variant === 'public' ? 'complaint-copy' : 'complaint-modal-copy'}">${escapeHtml(normalizeValue(options.copy) || 'Share the issue clearly so admin can review it.')}</p>
          </div>
          <button class="btn btn-secondary btn-tiny" type="button" onclick="${closeHandler}">Close</button>
        </div>
        <div class="complaint-context-grid">
          <div class="complaint-context-card">
            <label class="small">Target Type</label>
            <strong>${escapeHtml(targetTypeLabel)}</strong>
            <span>${escapeHtml(targetSummary)}</span>
          </div>
          <div class="complaint-context-card">
            <label class="small">Reported Broker</label>
            <strong>${escapeHtml(reportedUserLabel)}</strong>
            <span>${escapeHtml(reportedMeta || 'Submitted to admin review')}</span>
          </div>
        </div>
        <div class="complaint-form-grid">
          <div class="${fieldClass}">
            <label class="small" for="${escapeHtml(normalizeValue(options.reasonInputId) || 'complaintReason')}">Reason</label>
            <select id="${escapeHtml(normalizeValue(options.reasonInputId) || 'complaintReason')}" ${reasonChangeHandler ? `onchange="${reasonChangeHandler}"` : ''}>
              <option value="">Select reason</option>
              ${reasonOptionsHtml}
            </select>
          </div>
          <div class="${fieldClass}">
            <label class="small" for="${escapeHtml(uploadInputId)}">Optional Proof</label>
            <div class="complaint-upload-row">
              <input id="${escapeHtml(uploadInputId)}" type="file" accept="image/*,application/pdf" class="${escapeHtml(hiddenInputClass)}">
              <button class="btn btn-secondary btn-tiny" type="button" onclick="${uploadHandler}">Upload Proof</button>
              <span class="complaint-upload-note">${escapeHtml(proofName)}</span>
            </div>
          </div>
          <div class="${fieldClass} is-full">
            <label class="small" for="${escapeHtml(normalizeValue(options.descriptionInputId) || 'complaintDescription')}">Description</label>
            <textarea id="${escapeHtml(normalizeValue(options.descriptionInputId) || 'complaintDescription')}" rows="6" placeholder="${escapeHtml(normalizeValue(options.descriptionPlaceholder) || 'Describe the issue clearly so admin can review it quickly.')}" ${descriptionChangeHandler ? `oninput="${descriptionChangeHandler}"` : ''}>${escapeHtml(normalizeValue(options.description))}</textarea>
          </div>
        </div>
        ${extraContentHtml}
        <div class="${actionsClass}">
          <button class="btn btn-secondary" type="button" onclick="${cancelHandler}" ${options.submitting ? 'disabled' : ''}>${escapeHtml(cancelLabel)}</button>
          <button class="btn btn-primary" type="submit" ${options.submitting ? 'disabled' : ''}>${escapeHtml(options.submitting ? submittingLabel : submitLabel)}</button>
        </div>
      </form>
    `;
  }

  global.ComplaintCenterUi = {
    hasAdminSession,
    getReportButtonState,
    renderReportButton,
    renderComplaintFormModal
  };
})(window);
