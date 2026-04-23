(function attachWhatsappContactUi(global) {
  const state = {
    open: false,
    context: null,
    selectedReason: '',
    customReason: '',
    error: ''
  };

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeReasonText(value, limit = 180) {
    return normalizeText(value).slice(0, limit);
  }

  function normalizePhoneDigits(value) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) return digits.slice(2);
    return digits;
  }

  function getReasonOptions() {
    const configured = global.BROKER_WHATSAPP_CONTACT_CONFIG?.reasons;
    return Array.isArray(configured) ? configured : [];
  }

  function getReasonOption(value) {
    return getReasonOptions().find(option => option.value === value) || null;
  }

  function ensureStyles() {
    if (document.getElementById('whatsappReasonUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'whatsappReasonUiStyles';
    style.textContent = `
      body.whatsapp-reason-open {
        overflow: hidden !important;
      }

      .whatsapp-reason-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, 0.42);
      }

      .whatsapp-reason-backdrop.hidden {
        display: none !important;
      }

      .whatsapp-reason-card {
        width: min(640px, calc(100vw - 32px));
        max-height: calc(100vh - 48px);
        overflow: auto;
        border-radius: 20px;
        border: 1px solid #E5E7EB;
        background: #FFFFFF;
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.18);
        padding: 20px;
        display: grid;
        gap: 16px;
      }

      .whatsapp-reason-card:empty {
        display: none;
      }

      .whatsapp-reason-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .whatsapp-reason-head h3 {
        margin: 2px 0 0;
        color: #0F172A;
        font-size: 1.08rem;
      }

      .whatsapp-reason-copy {
        margin: 0;
        color: #64748B;
        font-size: 0.92rem;
        line-height: 1.55;
      }

      .whatsapp-reason-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .whatsapp-reason-meta-card {
        border: 1px solid #E5E7EB;
        border-radius: 16px;
        background: #F8FAFC;
        padding: 14px 16px;
        display: grid;
        gap: 6px;
      }

      .whatsapp-reason-meta-card small {
        color: #64748B;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .whatsapp-reason-meta-card strong,
      .whatsapp-reason-meta-card span {
        color: #0F172A;
        font-size: 0.92rem;
        line-height: 1.5;
      }

      .whatsapp-reason-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .whatsapp-reason-chip {
        min-height: 38px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid #E5E7EB;
        background: #FFFFFF;
        color: #475569;
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      }

      .whatsapp-reason-chip:hover {
        background: #F8FAFC;
        border-color: #CBD5E1;
        color: #0F172A;
      }

      .whatsapp-reason-chip.is-active {
        background: rgba(200, 169, 107, 0.12);
        border-color: rgba(200, 169, 107, 0.4);
        color: #8A5B00;
        box-shadow: 0 8px 22px rgba(200, 169, 107, 0.12);
      }

      .whatsapp-reason-custom {
        display: grid;
        gap: 8px;
      }

      .whatsapp-reason-custom.hidden {
        display: none !important;
      }

      .whatsapp-reason-custom label {
        color: #64748B;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .whatsapp-reason-custom textarea {
        width: 100%;
        min-height: 88px;
        resize: vertical;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid #E5E7EB;
        background: #F8FAFC;
        color: #0F172A;
        font: inherit;
      }

      .whatsapp-reason-error {
        min-height: 20px;
        color: #B91C1C;
        font-size: 0.84rem;
        line-height: 1.45;
      }

      .whatsapp-reason-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
      }

      .whatsapp-reason-preview {
        border: 1px solid #E5E7EB;
        border-radius: 16px;
        background: #F8FAFC;
        padding: 14px 16px;
        display: grid;
        gap: 8px;
      }

      .whatsapp-reason-preview small {
        color: #64748B;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .whatsapp-reason-preview pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: #475569;
        font: inherit;
        font-size: 0.88rem;
        line-height: 1.55;
      }

      @media (max-width: 720px) {
        .whatsapp-reason-backdrop {
          padding: 16px;
          align-items: flex-end;
        }

        .whatsapp-reason-card {
          width: 100%;
          max-height: min(82vh, calc(100vh - 24px));
          border-radius: 20px 20px 16px 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDom() {
    ensureStyles();
    let backdrop = document.getElementById('whatsappReasonBackdrop');
    let card = document.getElementById('whatsappReasonCard');
    if (!backdrop || !card) {
      backdrop = document.createElement('div');
      backdrop.id = 'whatsappReasonBackdrop';
      backdrop.className = 'whatsapp-reason-backdrop hidden';
      backdrop.innerHTML = '<div class="whatsapp-reason-card" id="whatsappReasonCard"></div>';
      document.body.appendChild(backdrop);
      card = document.getElementById('whatsappReasonCard');

      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) {
          close();
        }
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.open) {
          close();
        }
      });

      backdrop.addEventListener('click', event => {
        const reasonButton = event.target.closest('[data-whatsapp-reason]');
        if (reasonButton) {
          state.selectedReason = reasonButton.getAttribute('data-whatsapp-reason') || '';
          if (state.selectedReason !== 'other') {
            state.customReason = '';
          }
          state.error = '';
          render();
          return;
        }
        if (event.target.closest('[data-whatsapp-close]')) {
          close();
          return;
        }
        if (event.target.closest('[data-whatsapp-submit]')) {
          submit();
          return;
        }
        if (event.target.closest('[data-whatsapp-copy]')) {
          copyNumber();
        }
      });

      backdrop.addEventListener('input', event => {
        if (event.target && event.target.id === 'whatsappReasonCustomInput') {
          state.customReason = sanitizeReasonText(event.target.value, 220);
          state.error = '';
        }
      });
    }
    return { backdrop, card };
  }

  function getDisplayReason() {
    if (state.selectedReason === 'other') {
      return sanitizeReasonText(state.customReason, 220);
    }
    return getReasonOption(state.selectedReason)?.label || '';
  }

  function buildReferenceLabel(context = {}) {
    const candidates = [
      context.referenceLabel,
      context.itemTitle,
      context.buildingName,
      context.location,
      context.propertyType,
      context.itemTypeLabel
    ];
    const reference = candidates.map(normalizeText).find(Boolean);
    return reference || 'Broker Connector post';
  }

  function buildMessage(context = {}, reasonText = '') {
    const reference = buildReferenceLabel(context);
    const currentUserName = normalizeText(context.currentUserName) || 'Broker Connector user';
    const greeting = 'Hello, I saw your post on Broker Connector.';
    return [
      greeting,
      `Reason: ${reasonText}`,
      `Reference: ${reference}`,
      `My name: ${currentUserName}`,
      'Please let me know if we can discuss.'
    ].join('\n');
  }

  function buildAnalyticsPayload(context = {}, reasonText = '') {
    return {
      event: 'contact_attempt',
      source_page: normalizeText(context.sourcePage) || 'unknown',
      item_type: normalizeText(context.itemType) || 'unknown',
      item_id: normalizeText(context.itemId),
      selected_reason: reasonText,
      custom_reason_used: state.selectedReason === 'other'
    };
  }

  function logContactAttempt(context = {}, reasonText = '') {
    const payload = buildAnalyticsPayload(context, reasonText);
    try {
      console.info('contact_attempt', payload);
    } catch (error) {
      // noop
    }
    try {
      global.dispatchEvent(new CustomEvent('contact_attempt', { detail: payload }));
    } catch (error) {
      // noop
    }
    if (typeof context.onContactAttempt === 'function') {
      context.onContactAttempt(payload);
    }
    return payload;
  }

  function render() {
    const { backdrop, card } = ensureDom();
    if (!state.open || !state.context) {
      backdrop.classList.add('hidden');
      card.innerHTML = '';
      document.body.classList.remove('whatsapp-reason-open');
      return;
    }

    const context = state.context;
    const reasonOptions = getReasonOptions();
    const referenceLabel = buildReferenceLabel(context);
    const phoneDisplay = normalizeText(context.phoneDisplay) || `+${context.phoneDigits}`;
    const previewReason = getDisplayReason() || 'Choose a reason to preview the message.';
    const previewMessage = getDisplayReason()
      ? buildMessage(context, getDisplayReason())
      : 'Hello, I saw your post on Broker Connector.\nReason: ...\nReference: ...\nMy name: ...\nPlease let me know if we can discuss.';

    backdrop.classList.remove('hidden');
    document.body.classList.add('whatsapp-reason-open');
    card.innerHTML = `
      <div class="whatsapp-reason-head">
        <div>
          <h3>${escapeHtml(context.title || 'Contact on WhatsApp')}</h3>
          <p class="whatsapp-reason-copy">${escapeHtml(context.copy || 'Select a quick reason so WhatsApp opens with a clear professional message.')}</p>
        </div>
        <button class="btn btn-secondary btn-tiny" type="button" data-whatsapp-close>Close</button>
      </div>
      <div class="whatsapp-reason-meta">
        <div class="whatsapp-reason-meta-card">
          <small>Reference</small>
          <strong>${escapeHtml(referenceLabel)}</strong>
        </div>
        <div class="whatsapp-reason-meta-card">
          <small>WhatsApp Number</small>
          <span>${escapeHtml(phoneDisplay)}</span>
        </div>
      </div>
      <div class="whatsapp-reason-grid">
        ${reasonOptions.map(option => `
          <button class="whatsapp-reason-chip ${state.selectedReason === option.value ? 'is-active' : ''}" type="button" data-whatsapp-reason="${escapeHtml(option.value)}">
            ${escapeHtml(option.label)}
          </button>
        `).join('')}
      </div>
      <div class="whatsapp-reason-custom ${state.selectedReason === 'other' ? '' : 'hidden'}">
        <label for="whatsappReasonCustomInput">Custom reason</label>
        <textarea id="whatsappReasonCustomInput" maxlength="220" placeholder="Add a short professional reason">${escapeHtml(state.customReason)}</textarea>
      </div>
      <div class="whatsapp-reason-error">${escapeHtml(state.error || '')}</div>
      <div class="whatsapp-reason-preview">
        <small>Message Preview</small>
        <pre>${escapeHtml(previewMessage)}</pre>
      </div>
      <div class="whatsapp-reason-actions">
        <button class="btn btn-secondary btn-tiny" type="button" data-whatsapp-copy>Copy Number</button>
        <button class="btn btn-secondary" type="button" data-whatsapp-close>Cancel</button>
        <button class="btn btn-primary" type="button" data-whatsapp-submit>Open WhatsApp</button>
      </div>
    `;
  }

  async function copyNumber() {
    const context = state.context;
    if (!context?.phoneDisplay) return;
    try {
      await navigator.clipboard.writeText(context.phoneDisplay);
      if (typeof context.onCopySuccess === 'function') {
        context.onCopySuccess(context.phoneDisplay);
      }
    } catch (error) {
      if (typeof context?.onError === 'function') {
        context.onError('WhatsApp number could not be copied.');
      }
    }
  }

  function close() {
    state.open = false;
    state.context = null;
    state.selectedReason = '';
    state.customReason = '';
    state.error = '';
    render();
  }

  function submit() {
    const context = state.context || {};
    const reasonText = getDisplayReason();
    if (!state.selectedReason) {
      state.error = 'Select a contact reason before opening WhatsApp.';
      render();
      return false;
    }
    if (state.selectedReason === 'other' && !reasonText) {
      state.error = 'Add a short custom reason before opening WhatsApp.';
      render();
      return false;
    }
    const phoneDigits = normalizePhoneDigits(context.phoneDigits || context.phone || '');
    if (!phoneDigits) {
      state.error = 'WhatsApp number is not available for this contact.';
      render();
      if (typeof context.onError === 'function') {
        context.onError(state.error);
      }
      return false;
    }
    const message = buildMessage(context, reasonText);
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    logContactAttempt(context, reasonText);
    if (typeof context.onBeforeOpen === 'function') {
      context.onBeforeOpen({
        reasonText,
        customReasonUsed: state.selectedReason === 'other',
        message,
        url
      });
    }
    global.open(url, '_blank', 'noopener');
    if (typeof context.onAfterOpen === 'function') {
      context.onAfterOpen({
        reasonText,
        customReasonUsed: state.selectedReason === 'other',
        message,
        url
      });
    }
    close();
    return true;
  }

  function open(context = {}) {
    const phoneDigits = normalizePhoneDigits(context.phoneDigits || context.phone || '');
    if (!phoneDigits) {
      if (typeof context.onError === 'function') {
        context.onError('WhatsApp number is not available for this contact.');
      }
      return false;
    }
    state.open = true;
    state.context = {
      ...context,
      phoneDigits,
      phoneDisplay: normalizeText(context.phoneDisplay) || `+${phoneDigits}`
    };
    state.selectedReason = normalizeText(context.defaultReasonValue);
    state.customReason = '';
    state.error = '';
    render();
    return true;
  }

  global.WhatsAppContactUi = {
    open,
    close,
    buildMessage
  };
})(window);
