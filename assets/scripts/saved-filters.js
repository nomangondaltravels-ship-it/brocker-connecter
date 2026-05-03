    const SESSION_TOKEN_KEY = 'broker_session_token';
    const SESSION_PROFILE_KEY = 'broker_session_profile';
    const filtersList = document.getElementById('filtersList');
    const saveButton = document.getElementById('saveButton');
    const refreshButton = document.getElementById('refreshButton');
    const resetButton = document.getElementById('resetButton');
    const formMessage = document.getElementById('formMessage');
    const sessionMessage = document.getElementById('sessionMessage');
    const filterNameInput = document.getElementById('filterName');
    const filterTypeInput = document.getElementById('filterType');
    const filterJsonInput = document.getElementById('filterJson');

    let activeFilterId = '';
    let savedFilters = [];

    function showMessage(target, message, isError = false) {
      target.textContent = message || '';
      target.classList.toggle('hidden', !message);
      target.classList.toggle('error', Boolean(isError));
    }

    function getSessionToken() {
      return String(localStorage.getItem(SESSION_TOKEN_KEY) || '').trim();
    }

    function prettyJson(value) {
      return JSON.stringify(value || {}, null, 2);
    }

    function resetForm() {
      activeFilterId = '';
      filterNameInput.value = '';
      filterTypeInput.value = 'all';
      filterJsonInput.value = prettyJson({
        search: '',
        location: '',
        propertyType: ''
      });
      saveButton.textContent = 'Save Filter';
      showMessage(formMessage, '');
    }

    function parseFiltersJson() {
      try {
        const parsed = JSON.parse(filterJsonInput.value || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Filters JSON must be an object.');
        }
        return parsed;
      } catch (error) {
        throw new Error(error?.message || 'Filters JSON is invalid.');
      }
    }

    async function request(path, options = {}) {
      const token = getSessionToken();
      if (!token) {
        throw new Error('Your broker session was not found. Please sign in again from the website first.');
      }

      const response = await fetch(path, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Request failed.');
      }
      return payload;
    }

    function renderSavedFilters() {
      if (!savedFilters.length) {
        filtersList.innerHTML = '<div class="empty">No saved filters yet. Create your first one from the panel on the left.</div>';
        return;
      }

      filtersList.innerHTML = savedFilters.map(filter => `
        <article class="filter-card">
          <div class="filter-meta">
            <div>
              <h3>${escapeHtml(filter.name || 'Saved Filter')}</h3>
              <div class="muted" style="margin-top:6px;">Updated ${escapeHtml(formatDate(filter.updatedAt || filter.createdAt))}</div>
            </div>
            <span class="filter-type">${escapeHtml(filter.type || 'all')}</span>
          </div>
          <pre>${escapeHtml(prettyJson(filter.filters || {}))}</pre>
          <div class="card-actions">
            <button class="btn btn-secondary" type="button" onclick="window.editSavedFilter('${escapeAttribute(filter.id)}')">Rename / Edit</button>
            <button class="btn btn-gold" type="button" onclick="window.copySavedFilter('${escapeAttribute(filter.id)}')">Copy JSON</button>
            <button class="btn btn-secondary" type="button" onclick="window.deleteSavedFilter('${escapeAttribute(filter.id)}')">Delete</button>
          </div>
        </article>
      `).join('');
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeAttribute(value) {
      return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function formatDate(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return 'recently';
      }
      return date.toLocaleString();
    }

    async function loadSavedFilters() {
      try {
        const payload = await request('/api/broker-dashboard', {
          method: 'POST',
          body: { action: 'list-saved-filters' }
        });
        savedFilters = Array.isArray(payload.savedFilters) ? payload.savedFilters : [];
        renderSavedFilters();
        showMessage(sessionMessage, '');
      } catch (error) {
        savedFilters = [];
        renderSavedFilters();
        showMessage(sessionMessage, error?.message || 'Unable to load saved filters right now.', true);
      }
    }

    async function saveSavedFilter() {
      try {
        const name = String(filterNameInput.value || '').trim();
        if (!name) {
          throw new Error('Saved filter name is required.');
        }
        const filters = parseFiltersJson();
        const type = String(filterTypeInput.value || 'all').trim();
        const payload = {
          name,
          type,
          filters
        };

        if (activeFilterId) {
          await request('/api/broker-dashboard', {
            method: 'POST',
            body: {
              action: 'update-saved-filter',
              id: activeFilterId,
              ...payload
            }
          });
          showMessage(formMessage, 'Saved filter updated successfully.');
        } else {
          await request('/api/broker-dashboard', {
            method: 'POST',
            body: {
              action: 'create-saved-filter',
              ...payload
            }
          });
          showMessage(formMessage, 'Saved filter created successfully.');
        }

        resetForm();
        await loadSavedFilters();
      } catch (error) {
        showMessage(formMessage, error?.message || 'Unable to save the filter.', true);
      }
    }

    window.editSavedFilter = function editSavedFilter(id) {
      const target = savedFilters.find(item => item.id === id);
      if (!target) return;
      activeFilterId = target.id;
      filterNameInput.value = target.name || '';
      filterTypeInput.value = target.type || 'all';
      filterJsonInput.value = prettyJson(target.filters || {});
      saveButton.textContent = 'Update Filter';
      showMessage(formMessage, 'Editing selected filter.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.copySavedFilter = async function copySavedFilter(id) {
      const target = savedFilters.find(item => item.id === id);
      if (!target) return;
      const text = prettyJson(target.filters || {});
      try {
        await navigator.clipboard.writeText(text);
        showMessage(formMessage, 'Filter JSON copied to clipboard.');
      } catch (_) {
        showMessage(formMessage, 'Unable to copy automatically. Please copy it manually from the card.', true);
      }
    };

    window.deleteSavedFilter = async function deleteSavedFilter(id) {
      const target = savedFilters.find(item => item.id === id);
      if (!target) return;
      const confirmed = window.confirm(`Delete saved filter "${target.name}"?`);
      if (!confirmed) return;
      try {
        await request('/api/broker-dashboard', {
          method: 'POST',
          body: {
            action: 'delete-saved-filter',
            id
          }
        });
        if (activeFilterId === id) {
          resetForm();
        }
        showMessage(formMessage, 'Saved filter deleted.');
        await loadSavedFilters();
      } catch (error) {
        showMessage(formMessage, error?.message || 'Unable to delete the filter.', true);
      }
    };

    saveButton.addEventListener('click', saveSavedFilter);
    refreshButton.addEventListener('click', loadSavedFilters);
    resetButton.addEventListener('click', resetForm);

    (function init() {
      const sessionProfile = localStorage.getItem(SESSION_PROFILE_KEY);
      if (!getSessionToken()) {
        showMessage(sessionMessage, 'Please sign in from the NexBridge website first, then open this page again.', true);
      } else if (sessionProfile) {
        showMessage(sessionMessage, 'Broker session detected. You can manage your real saved filters here.');
      }
      resetForm();
      loadSavedFilters();
    }());
