(function initActionFeedbackUi(global) {
  if (global.ActionFeedbackUi) return;

  const STYLE_ID = 'action-feedback-ui-styles';
  const TOAST_STACK_ID = 'actionFeedbackToastStack';
  const PROGRESS_ID = 'actionFeedbackProgress';
  let progressCount = 0;
  let toastSeed = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .action-feedback-progress {
        position: fixed;
        inset: 0 0 auto;
        height: 3px;
        background: linear-gradient(90deg, rgba(212,175,55,0.18), rgba(212,175,55,0.92), rgba(34,197,94,0.48));
        transform-origin: left center;
        transform: scaleX(0);
        opacity: 0;
        transition: opacity 0.18s ease, transform 0.35s ease;
        z-index: 5000;
        pointer-events: none;
      }
      .action-feedback-progress.is-active {
        opacity: 1;
        transform: scaleX(1);
      }
      .action-feedback-toast-stack {
        position: fixed;
        right: 18px;
        bottom: 18px;
        display: grid;
        gap: 10px;
        width: min(360px, calc(100vw - 24px));
        z-index: 5000;
        pointer-events: none;
      }
      .action-feedback-toast {
        display: grid;
        gap: 6px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(255,255,255,0.98);
        color: #243041;
        box-shadow: 0 18px 40px rgba(15,23,42,0.12);
        backdrop-filter: blur(10px);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .action-feedback-toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .action-feedback-toast[data-tone="success"] {
        border-color: rgba(34,197,94,0.24);
        background: rgba(248,255,250,0.98);
      }
      .action-feedback-toast[data-tone="error"] {
        border-color: rgba(239,68,68,0.24);
        background: rgba(255,249,249,0.98);
      }
      .action-feedback-toast[data-tone="warning"] {
        border-color: rgba(249,115,22,0.24);
        background: rgba(255,252,246,0.98);
      }
      .action-feedback-toast[data-tone="info"] {
        border-color: rgba(56,189,248,0.24);
        background: rgba(248,252,255,0.98);
      }
      .action-feedback-toast-title {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .action-feedback-toast-message {
        font-size: 0.92rem;
        line-height: 1.45;
      }
      .btn.is-action-loading,
      button.is-action-loading {
        cursor: wait;
      }
      .action-feedback-inline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .action-feedback-spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        animation: action-feedback-spin 0.6s linear infinite;
        flex: 0 0 auto;
      }
      @keyframes action-feedback-spin {
        to { transform: rotate(360deg); }
      }
      @media (max-width: 720px) {
        .action-feedback-toast-stack {
          right: 12px;
          left: 12px;
          width: auto;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureToastStack() {
    let stack = document.getElementById(TOAST_STACK_ID);
    if (!stack) {
      stack = document.createElement('div');
      stack.id = TOAST_STACK_ID;
      stack.className = 'action-feedback-toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function ensureProgressBar() {
    let bar = document.getElementById(PROGRESS_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = PROGRESS_ID;
      bar.className = 'action-feedback-progress';
      document.body.appendChild(bar);
    }
    return bar;
  }

  function normalizeMessage(message, fallback) {
    return String(message || fallback || '').trim();
  }

  function resolveActionButton(candidate) {
    if (!candidate) {
      if (document.activeElement instanceof HTMLButtonElement) {
        return document.activeElement;
      }
      return null;
    }
    if (candidate instanceof HTMLButtonElement) return candidate;
    if (candidate?.submitter instanceof HTMLButtonElement) return candidate.submitter;
    if (candidate?.currentTarget instanceof HTMLButtonElement) return candidate.currentTarget;
    if (candidate?.target instanceof HTMLButtonElement) return candidate.target;
    if (typeof candidate === 'string') return document.querySelector(candidate);
    return null;
  }

  function setButtonLoading(buttonCandidate, loadingText) {
    const button = resolveActionButton(buttonCandidate);
    if (!button || button.dataset.actionFeedbackLoading === 'true') return button || null;
    const text = normalizeMessage(loadingText, button.textContent || 'Processing...');
    button.dataset.actionFeedbackLoading = 'true';
    button.dataset.actionFeedbackHtml = button.innerHTML;
    button.dataset.actionFeedbackDisabled = button.disabled ? 'true' : 'false';
    button.disabled = true;
    button.classList.add('is-action-loading');
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="action-feedback-inline"><span class="action-feedback-spinner" aria-hidden="true"></span><span>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></span>`;
    return button;
  }

  function resetButtonLoading(buttonCandidate) {
    const button = resolveActionButton(buttonCandidate);
    if (!button || button.dataset.actionFeedbackLoading !== 'true') return;
    button.innerHTML = button.dataset.actionFeedbackHtml || button.innerHTML;
    button.disabled = button.dataset.actionFeedbackDisabled === 'true';
    button.classList.remove('is-action-loading');
    button.removeAttribute('aria-busy');
    delete button.dataset.actionFeedbackLoading;
    delete button.dataset.actionFeedbackHtml;
    delete button.dataset.actionFeedbackDisabled;
  }

  function showToast(type, message, options = {}) {
    const normalizedMessage = normalizeMessage(message);
    if (!normalizedMessage) return null;
    injectStyles();
    const stack = ensureToastStack();
    const toast = document.createElement('div');
    toast.className = 'action-feedback-toast';
    toast.dataset.tone = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toast.dataset.toastId = `toast-${Date.now()}-${++toastSeed}`;
    const titleMap = {
      success: 'Success',
      error: 'Error',
      warning: 'Notice',
      info: 'Update'
    };
    toast.innerHTML = `
      <div class="action-feedback-toast-title">${titleMap[toast.dataset.tone] || 'Update'}</div>
      <div class="action-feedback-toast-message">${normalizedMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    `;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    const duration = Math.max(1800, Number(options.duration || 3600));
    const removeToast = () => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 220);
    };
    setTimeout(removeToast, duration);
    return toast;
  }

  function startProgress() {
    injectStyles();
    progressCount += 1;
    const bar = ensureProgressBar();
    bar.classList.add('is-active');
  }

  function stopProgress() {
    progressCount = Math.max(0, progressCount - 1);
    const bar = ensureProgressBar();
    if (!progressCount) {
      bar.classList.remove('is-active');
    }
  }

  async function withActionFeedback(buttonCandidate, loadingText, successMessage, actionFn, options = {}) {
    const button = setButtonLoading(buttonCandidate, loadingText);
    startProgress();
    const startedAt = Date.now();
    try {
      const result = await actionFn();
      const minimumDuration = Math.max(0, Number(options.minimumDuration || 450));
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimumDuration) {
        await new Promise(resolve => setTimeout(resolve, minimumDuration - elapsed));
      }
      const successText = normalizeMessage(
        typeof options.getSuccessMessage === 'function' ? options.getSuccessMessage(result) : successMessage
      );
      if (successText && options.showSuccessToast !== false) {
        showToast('success', successText, options.toastOptions);
      }
      return result;
    } catch (error) {
      const minimumDuration = Math.max(0, Number(options.minimumDuration || 450));
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimumDuration) {
        await new Promise(resolve => setTimeout(resolve, minimumDuration - elapsed));
      }
      const errorText = normalizeMessage(
        typeof options.getErrorMessage === 'function' ? options.getErrorMessage(error) : (options.errorMessage || error?.message || 'Something went wrong. Please try again.')
      );
      if (errorText && options.showErrorToast !== false) {
        showToast(options.errorTone || 'error', errorText, options.toastOptions);
      }
      throw error;
    } finally {
      resetButtonLoading(button);
      stopProgress();
    }
  }

  injectStyles();

  global.ActionFeedbackUi = {
    resolveActionButton,
    setButtonLoading,
    resetButtonLoading,
    showToast,
    startProgress,
    stopProgress,
    withActionFeedback
  };
  global.setButtonLoading = setButtonLoading;
  global.resetButtonLoading = resetButtonLoading;
  global.showToast = showToast;
  global.withActionFeedback = withActionFeedback;
})(window);
