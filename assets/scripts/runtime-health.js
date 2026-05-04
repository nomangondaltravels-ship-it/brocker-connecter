(function () {
  const BUILD_META_SELECTOR = 'meta[name="nexbridge-build"]';
  const BANNER_ID = 'runtimeHealthBanner';
  const STYLE_ID = 'runtimeHealthStyles';
  const VERSION_ENDPOINT = '/build-version.json';
  const currentBuild = document.querySelector(BUILD_META_SELECTOR)?.content || '';
  let bannerVisible = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .runtime-health-banner {
        position: fixed;
        left: 50%;
        top: max(14px, env(safe-area-inset-top));
        z-index: 5000;
        width: min(680px, calc(100vw - 28px));
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 10px;
        align-items: center;
        padding: 12px 14px;
        border-radius: 18px;
        border: 1px solid rgba(181, 138, 29, 0.28);
        background: rgba(255, 255, 255, 0.96);
        color: #111827;
        box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
        backdrop-filter: blur(14px);
        font: 600 14px/1.45 Arial, Helvetica, sans-serif;
      }

      .runtime-health-banner span {
        min-width: 0;
      }

      .runtime-health-banner button {
        appearance: none;
        border: 1px solid rgba(181, 138, 29, 0.32);
        border-radius: 999px;
        background: #ffffff;
        color: #8f6a12;
        padding: 8px 12px;
        font: 800 13px/1 Arial, Helvetica, sans-serif;
        cursor: pointer;
      }

      .runtime-health-banner button.runtime-health-primary {
        background: linear-gradient(135deg, #d4af37, #b58a1d);
        color: #ffffff;
        border-color: transparent;
      }

      @media (max-width: 520px) {
        .runtime-health-banner {
          grid-template-columns: 1fr;
          justify-items: stretch;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ready(callback) {
    if (document.body) {
      callback();
      return;
    }
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  function showBanner(message, options = {}) {
    if (!message || bannerVisible) return;
    bannerVisible = true;
    ready(() => {
      injectStyles();
      const previous = document.getElementById(BANNER_ID);
      if (previous) previous.remove();
      const banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'runtime-health-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="runtime-health-primary" type="button" data-runtime-refresh>Refresh</button>
        <button type="button" data-runtime-dismiss>Close</button>
      `;
      banner.querySelector('[data-runtime-refresh]')?.addEventListener('click', () => {
        window.location.reload();
      });
      banner.querySelector('[data-runtime-dismiss]')?.addEventListener('click', () => {
        bannerVisible = false;
        banner.remove();
      });
      document.body.appendChild(banner);
      if (options.autoHideMs) {
        window.setTimeout(() => {
          if (banner.isConnected) {
            bannerVisible = false;
            banner.remove();
          }
        }, options.autoHideMs);
      }
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isLocalAsset(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin && parsed.pathname.startsWith('/assets/');
    } catch (error) {
      return false;
    }
  }

  function getFailedAssetType(target) {
    const tagName = target?.tagName;
    if (tagName === 'SCRIPT') return 'script';
    if (tagName === 'LINK' && String(target.rel || '').toLowerCase().includes('stylesheet')) return 'stylesheet';
    return '';
  }

  window.addEventListener('error', event => {
    const assetType = getFailedAssetType(event.target);
    if (!assetType) return;
    const url = event.target?.src || event.target?.href || '';
    if (!isLocalAsset(url)) return;
    showBanner(`A page ${assetType} did not load. Refresh once to get the latest NexBridge files.`);
  }, true);

  window.addEventListener('unhandledrejection', event => {
    const message = String(event.reason?.message || event.reason || '');
    if (!/failed to fetch|loading chunk|network|mime type|script/i.test(message)) return;
    showBanner('A browser loading issue was detected. Refresh once to reload the latest NexBridge files.');
  });

  async function checkBuildVersion() {
    if (!currentBuild || !window.fetch) return;
    try {
      const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      const liveBuild = String(payload?.version || '').trim();
      if (liveBuild && liveBuild !== currentBuild) {
        showBanner('A newer NexBridge version is live. Refresh once before continuing.');
      }
    } catch (error) {
      if (navigator.onLine === false) {
        showBanner('You appear to be offline. Reconnect and refresh to load live NexBridge records.', { autoHideMs: 9000 });
      }
    }
  }

  if (document.readyState === 'complete') {
    checkBuildVersion();
  } else {
    window.addEventListener('load', checkBuildVersion, { once: true });
  }
})();
