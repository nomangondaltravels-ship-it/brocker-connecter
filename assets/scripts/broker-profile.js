(() => {
  const state = {
    broker: null,
    listings: [],
    activeTab: 'all',
    query: '',
    location: 'all',
    layout: 'all',
    maxPrice: ''
  };

  const els = {
    hero: document.getElementById('profileHero'),
    tabs: document.getElementById('profileTabs'),
    search: document.getElementById('profileSearch'),
    location: document.getElementById('locationFilter'),
    layout: document.getElementById('layoutFilter'),
    maxPrice: document.getElementById('maxPriceFilter'),
    clear: document.getElementById('clearFiltersBtn'),
    grid: document.getElementById('listingGrid'),
    meta: document.getElementById('resultMeta'),
    toast: document.getElementById('profileToast'),
    copy: document.getElementById('copyProfileBtn')
  };

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return normalizeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseMoney(value) {
    const normalized = normalizeText(value).toLowerCase().replace(/,/g, '');
    const number = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(number)) return 0;
    if (normalized.includes('m')) return number * 1000000;
    if (normalized.includes('k')) return number * 1000;
    return number;
  }

  function uniqueSorted(values) {
    return [...new Set(values.map(normalizeText).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function getQueryBroker() {
    const params = new URLSearchParams(window.location.search);
    return normalizeText(params.get('broker') || params.get('b') || params.get('slug'));
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('active');
    window.setTimeout(() => els.toast.classList.remove('active'), 1800);
  }

  function getPurposeLabel(listing) {
    if (listing?.sourceType === 'lead') return listing.purpose === 'buy' ? 'Requirement: Buy' : 'Requirement: Rent';
    if (listing?.purpose === 'monthly_rent') return 'Monthly Rent';
    if (listing?.purpose === 'rent') return 'Yearly Rent';
    return 'Sale';
  }

  function getListingSection(listing) {
    if (listing?.sourceType === 'lead') return 'requirements';
    if (listing?.purpose === 'monthly_rent') return 'monthly-rent';
    if (listing?.isDistress && listing?.purpose === 'sale') return 'distress-deals';
    return 'marketplace';
  }

  function getListingLink(listing) {
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('view', 'public');
    url.searchParams.set('section', getListingSection(listing));
    url.searchParams.set('listing', listing.id);
    return url.toString();
  }

  function getListingPrice(listing) {
    if (listing?.sourceType === 'lead') return listing.priceLabel || 'Budget on request';
    if (listing?.purpose === 'monthly_rent') return listing.monthlyRentPrice || listing.priceLabel || 'Price on request';
    return listing.priceLabel || 'Price on request';
  }

  function getListingTitle(listing) {
    const category = listing.propertyCategory || listing.category || '';
    const layout = listing.unitLayout && listing.unitLayout !== 'N/A' ? listing.unitLayout : '';
    if (listing.sourceType === 'lead') {
      return [getPurposeLabel(listing), layout || category].filter(Boolean).join(' | ');
    }
    return [getPurposeLabel(listing), layout || category].filter(Boolean).join(' | ');
  }

  function getSearchText(listing) {
    return [
      getPurposeLabel(listing),
      listing.location,
      listing.buildingLabel,
      listing.propertyCategory,
      listing.unitLayout,
      listing.priceLabel,
      listing.publicNotes,
      listing.status
    ].map(item => normalizeText(item).toLowerCase()).join(' ');
  }

  function isListingInTab(listing) {
    if (state.activeTab === 'all') return true;
    if (state.activeTab === 'sale') return listing.sourceType === 'property' && listing.purpose === 'sale' && !listing.isDistress;
    if (state.activeTab === 'rent') return listing.sourceType === 'property' && listing.purpose === 'rent';
    if (state.activeTab === 'monthly') return listing.sourceType === 'property' && listing.purpose === 'monthly_rent';
    if (state.activeTab === 'distress') return listing.sourceType === 'property' && listing.isDistress;
    return true;
  }

  function getFilteredListings() {
    const query = normalizeText(state.query).toLowerCase();
    const maxPrice = parseMoney(state.maxPrice);
    return state.listings.filter(listing => {
      if (!isListingInTab(listing)) return false;
      if (query && !getSearchText(listing).includes(query)) return false;
      if (state.location !== 'all' && normalizeText(listing.location) !== state.location) return false;
      if (state.layout !== 'all' && normalizeText(listing.unitLayout || listing.propertyType) !== state.layout) return false;
      if (maxPrice > 0 && parseMoney(getListingPrice(listing)) > maxPrice) return false;
      return true;
    });
  }

  function renderHero() {
    const broker = state.broker || {};
    const avatar = broker.avatarUrl
      ? `<img src="${escapeHtml(broker.avatarUrl)}" alt="${escapeHtml(broker.name || 'Broker')}">`
      : escapeHtml(broker.initials || 'NB');
    els.hero.innerHTML = `
      <div class="profile-avatar">${avatar}</div>
      <div class="profile-copy">
        <span class="profile-kicker">NexBridge Broker Profile</span>
        <h1>${escapeHtml(broker.name || 'Broker Listings')}</h1>
        <p>${escapeHtml(broker.companyName || 'Verified real estate marketplace profile')}</p>
        <div class="profile-badges">
          <span class="profile-badge">${broker.isVerified ? 'Verified Broker' : 'NexBridge Broker'}</span>
          <span class="profile-badge">${Number(broker.listingCount || 0)} public listings</span>
          <span class="profile-badge">Share-safe listings only</span>
        </div>
      </div>
    `;
  }

  function renderTabs() {
    const counts = state.broker?.counts || {};
    const tabs = [
      { key: 'all', label: 'All', count: state.listings.length },
      { key: 'sale', label: 'Sale', count: counts.sale || 0 },
      { key: 'rent', label: 'Yearly Rent', count: counts.yearlyRent || 0 },
      { key: 'monthly', label: 'Monthly Rent', count: counts.monthlyRent || 0 },
      { key: 'distress', label: 'Distress', count: counts.distress || 0 }
    ];
    els.tabs.innerHTML = tabs.map(tab => `
      <button class="tab-btn ${state.activeTab === tab.key ? 'is-active' : ''}" type="button" data-tab="${escapeHtml(tab.key)}">
        ${escapeHtml(tab.label)} <span class="tab-count">${Number(tab.count || 0)}</span>
      </button>
    `).join('');
    els.tabs.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.tab || 'all';
        render();
      });
    });
  }

  function renderFilterOptions() {
    const locationValue = state.location;
    const layoutValue = state.layout;
    const locations = uniqueSorted(state.listings.map(item => item.location));
    const layouts = uniqueSorted(state.listings.map(item => item.unitLayout || item.propertyType));
    els.location.innerHTML = `<option value="all">All Areas</option>${locations.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    els.layout.innerHTML = `<option value="all">All Layouts</option>${layouts.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
    els.location.value = locations.includes(locationValue) ? locationValue : 'all';
    els.layout.value = layouts.includes(layoutValue) ? layoutValue : 'all';
  }

  function renderCards() {
    const listings = getFilteredListings();
    els.meta.textContent = listings.length
      ? `${listings.length} public listing${listings.length === 1 ? '' : 's'} available from this broker.`
      : 'No listings match these filters.';

    if (!listings.length) {
      els.grid.innerHTML = `
        <div class="empty-state">
          <h2>No matching listings</h2>
          <p>Clear filters or check this broker profile again later.</p>
        </div>
      `;
      return;
    }

    els.grid.innerHTML = listings.map(listing => {
      const imageMarkup = listing.coverImageUrl
        ? `<img src="${escapeHtml(listing.coverImageUrl)}" alt="${escapeHtml(getListingTitle(listing))}">`
        : `<div class="listing-media-fallback">NB</div>`;
      const badges = [
        getPurposeLabel(listing),
        listing.isDistress ? 'Distress Deal' : '',
        listing.status ? listing.status : '',
        listing.purpose === 'monthly_rent' && listing.billsIncluded ? 'Bills Included' : ''
      ].filter(Boolean);
      const specs = [
        listing.unitLayout && listing.unitLayout !== 'N/A' ? listing.unitLayout : '',
        listing.propertyCategory || '',
        listing.sizeLabel || '',
        listing.purpose === 'monthly_rent' && listing.furnishedStatus ? listing.furnishedStatus.replace(/_/g, ' ') : ''
      ].filter(Boolean);
      return `
        <article class="listing-card">
          <div class="listing-media">
            ${imageMarkup}
            <div class="listing-badge-row">
              ${badges.slice(0, 3).map(badge => `<span class="listing-badge">${escapeHtml(badge)}</span>`).join('')}
            </div>
          </div>
          <div class="listing-body">
            <div class="listing-price">${escapeHtml(getListingPrice(listing))}</div>
            <h2 class="listing-title">${escapeHtml(getListingTitle(listing))}</h2>
            <div class="listing-meta">${escapeHtml([listing.location, listing.buildingLabel].filter(Boolean).join(' | ') || 'Location available on request')}</div>
            <div class="listing-specs">${specs.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
            ${listing.publicNotes ? `<div class="listing-meta">${escapeHtml(listing.publicNotes)}</div>` : ''}
            <div class="listing-actions">
              <a class="btn btn-primary" href="${escapeHtml(getListingLink(listing))}">Open Listing</a>
              <button class="btn btn-secondary" type="button" data-copy-listing="${escapeHtml(getListingLink(listing))}">Copy Link</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    els.grid.querySelectorAll('[data-copy-listing]').forEach(button => {
      button.addEventListener('click', async () => {
        await navigator.clipboard?.writeText(button.dataset.copyListing || '');
        showToast('Listing link copied');
      });
    });
  }

  function render() {
    renderHero();
    renderTabs();
    renderFilterOptions();
    renderCards();
  }

  function bindFilters() {
    els.search.addEventListener('input', event => {
      state.query = event.target.value;
      renderCards();
    });
    els.location.addEventListener('change', event => {
      state.location = event.target.value;
      renderCards();
    });
    els.layout.addEventListener('change', event => {
      state.layout = event.target.value;
      renderCards();
    });
    els.maxPrice.addEventListener('input', event => {
      state.maxPrice = event.target.value;
      renderCards();
    });
    els.clear.addEventListener('click', () => {
      state.query = '';
      state.location = 'all';
      state.layout = 'all';
      state.maxPrice = '';
      els.search.value = '';
      els.maxPrice.value = '';
      render();
    });
    els.copy.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(window.location.href);
      showToast('Broker profile link copied');
    });
  }

  async function loadProfile() {
    const broker = getQueryBroker();
    if (!broker) {
      els.meta.textContent = 'Broker profile link is missing.';
      els.grid.innerHTML = '<div class="empty-state"><h2>Profile link missing</h2><p>Open this page from a NexBridge broker profile link.</p></div>';
      return;
    }
    const response = await fetch(`/api/public-broker-profile?broker=${encodeURIComponent(broker)}`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.message || 'Broker profile could not load.');
    }
    state.broker = result.broker || null;
    state.listings = Array.isArray(result.listings) ? result.listings : [];
    render();
  }

  bindFilters();
  loadProfile().catch(error => {
    els.hero.innerHTML = `
      <div class="profile-avatar">NB</div>
      <div class="profile-copy">
        <span class="profile-kicker">NexBridge Broker Profile</span>
        <h1>Profile unavailable</h1>
        <p>${escapeHtml(error.message || 'This broker profile could not load right now.')}</p>
      </div>
    `;
    els.meta.textContent = 'Profile unavailable.';
    els.grid.innerHTML = '<div class="empty-state"><h2>Could not load profile</h2><p>Please check the link or try again shortly.</p></div>';
  });
})();
