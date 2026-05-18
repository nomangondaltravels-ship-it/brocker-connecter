(() => {
  const state = {
    broker: null,
    listings: [],
    activeTab: 'all',
    query: '',
    location: 'all',
    layout: 'all',
    maxPrice: '',
    mediaCache: new Map()
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
    copy: document.getElementById('copyProfileBtn'),
    detailOverlay: document.getElementById('listingDetailOverlay'),
    detailContent: document.getElementById('listingDetailContent')
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

  function formatMoney(value, suffix = '') {
    const amount = parseMoney(value);
    if (!amount) return normalizeText(value) || 'Price on request';
    return `AED ${Math.round(amount).toLocaleString('en-US')}${suffix}`;
  }

  function normalizePhoneNumber(phone) {
    const digits = normalizeText(phone).replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('00971')) return `971${digits.slice(5)}`;
    if (digits.startsWith('971')) return digits;
    if (digits.startsWith('0')) return `971${digits.slice(1)}`;
    return digits;
  }

  function formatPhoneDisplay(phone) {
    const digits = normalizePhoneNumber(phone);
    if (!digits) return '';
    if (digits.startsWith('971') && digits.length >= 12) {
      return `+971 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    }
    return digits ? `+${digits}` : '';
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

  function getBrokerNameFromSlug(slug) {
    const parts = normalizeText(slug)
      .split('-')
      .filter(Boolean);
    if (parts.length > 1 && (/^\d+$/.test(parts[parts.length - 1]) || /^bc$/i.test(parts[parts.length - 2]))) {
      parts.pop();
    }
    return parts.length
      ? parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      : 'NexBridge Broker';
  }

  function buildBrokerFromPublicListings(slug, listings) {
    const items = Array.isArray(listings) ? listings : [];
    const name = getBrokerNameFromSlug(slug);
    return {
      slug,
      name,
      companyName: 'NexBridge public broker profile',
      initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NB',
      avatarUrl: '',
      contactMobile: '',
      isVerified: false,
      listingCount: items.length,
      counts: {
        sale: items.filter(item => item.sourceType === 'property' && item.purpose === 'sale' && !item.isDistress).length,
        yearlyRent: items.filter(item => item.sourceType === 'property' && item.purpose === 'rent').length,
        monthlyRent: items.filter(item => item.sourceType === 'property' && item.purpose === 'monthly_rent').length,
        distress: items.filter(item => item.sourceType === 'property' && item.isDistress).length
      }
    };
  }

  async function loadPublicListingsFallback(slug) {
    const response = await fetch('/api/public-marketplace?section=all', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.message || 'Broker profile could not load.');
    }
    const listings = (Array.isArray(result.listings) ? result.listings : [])
      .filter(listing => normalizeText(listing.brokerSlug).toLowerCase() === normalizeText(slug).toLowerCase());
    if (!listings.length) {
      throw new Error('Broker profile was not found.');
    }
    return {
      broker: buildBrokerFromPublicListings(slug, listings),
      listings
    };
  }

  function getProfileListingLink(listing) {
    const url = new URL(window.location.href);
    url.searchParams.set('listing', listing.id);
    return url.toString();
  }

  function getListingPrice(listing) {
    if (listing?.sourceType === 'lead') return formatMoney(listing.priceLabel || listing.budget, '');
    if (listing?.purpose === 'monthly_rent') return formatMoney(listing.monthlyRentPrice || listing.priceLabel, ' / month');
    if (listing?.purpose === 'rent') return formatMoney(listing.priceLabel, ' / year');
    return formatMoney(listing.priceLabel, '');
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
        <span class="profile-kicker">NexBridge Client Inventory</span>
        <h1>${escapeHtml(broker.name || 'Broker Listings')}</h1>
        <p>${escapeHtml(broker.companyName || 'Verified real estate marketplace profile')}</p>
        <div class="profile-badges">
          <span class="profile-badge">${broker.isVerified ? 'Verified Broker' : 'NexBridge Broker'}</span>
          <span class="profile-badge">${Number(broker.listingCount || 0)} public listings</span>
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

  function getListingById(id) {
    return state.listings.find(item => String(item.id) === String(id)) || null;
  }

  function getImageUrl(image) {
    if (!image) return '';
    if (typeof image === 'string') return normalizeText(image);
    return normalizeText(image.url || image.dataUrl || image.src || image.imageUrl);
  }

  async function loadListingMedia(listing) {
    if (!listing?.id) return { images: [], details: {} };
    const cacheKey = String(listing.id);
    if (state.mediaCache.has(cacheKey)) return state.mediaCache.get(cacheKey);
    const response = await fetch(`/api/public-marketplace?mediaFor=${encodeURIComponent(listing.id)}`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    const media = {
      images: Array.isArray(result.images) ? result.images.map(getImageUrl).filter(Boolean) : [],
      details: result.details || {}
    };
    if (listing.coverImageUrl && !media.images.includes(listing.coverImageUrl)) {
      media.images.unshift(listing.coverImageUrl);
    }
    state.mediaCache.set(cacheKey, media);
    return media;
  }

  function getBrokerContactNumber() {
    return normalizePhoneNumber(state.broker?.contactMobile || '');
  }

  function getWhatsappMessage(listing) {
    return [
      `Hi ${state.broker?.name || 'NexBridge Broker'},`,
      `I am interested in this listing: ${getListingTitle(listing)}`,
      `Location: ${[listing.location, listing.buildingLabel].filter(Boolean).join(' | ') || '-'}`,
      `Price: ${getListingPrice(listing)}`,
      `Reference: ${listing.id}`
    ].join('\n');
  }

  function getDetailRows(listing, details = {}) {
    const furnishedStatus = normalizeText(listing.furnishedStatus || details.furnishedStatus || details.furnishing).replace(/_/g, ' ');
    const rows = [
      ['Purpose', getPurposeLabel(listing)],
      ['Property Type', listing.propertyCategory || listing.category],
      ['Unit Layout', listing.unitLayout || listing.propertyType],
      ['Location', listing.location],
      ['Building / Project', listing.buildingLabel || 'Building not specified'],
      ['Price', getListingPrice(listing)],
      ['Market Price', listing.marketPrice ? formatMoney(listing.marketPrice) : ''],
      ['Size', listing.sizeLabel],
      ['Bedrooms', listing.bedrooms],
      ['Bathrooms', listing.bathrooms],
      ['Status', listing.availabilityStatus || listing.status],
      ['Furnishing', furnishedStatus],
      ['Cheques', details.cheques],
      ['Chiller', details.chiller],
      ['Mortgage Status', details.mortgageStatus],
      ['Ownership', details.leasehold ? 'Leasehold' : ''],
      ['Handover', listing.handoverLabel],
      ['Available From', listing.availableFrom || details.availableFrom],
      ['Minimum Stay', listing.minimumStay || details.minimumStay],
      ['Payment Terms', listing.paymentTerms || details.paymentTerms],
      ['Security Deposit', listing.securityDeposit ? formatMoney(listing.securityDeposit) : ''],
      ['Permit', listing.unitPermit || details.unitPermit]
    ];
    if (listing.purpose === 'monthly_rent') {
      rows.push(
        ['Bills Included', listing.billsIncluded ? 'Yes' : 'No'],
        ['Chiller', listing.chillerIncluded ? 'Included' : 'Not included'],
        ['Internet', listing.internetIncluded ? 'Included' : 'Not included'],
        ['DEWA', listing.dewaIncluded ? 'Included' : 'Not included'],
        ['Gym', listing.gymAvailable ? 'Available' : 'Not specified'],
        ['Pool', listing.poolAvailable ? 'Available' : 'Not specified'],
        ['Parking', listing.parkingAvailable ? 'Available' : 'Not specified'],
        ['Pets', listing.petsAvailable ? 'Allowed' : 'Not allowed']
      );
    }
    return rows.filter(([, value]) => normalizeText(value));
  }

  function renderDetailLoading(listing) {
    if (!els.detailContent) return;
    els.detailContent.innerHTML = `
      <div class="detail-topbar">
        <div>
          <span class="profile-kicker">Client Inventory</span>
          <h2 id="listingDetailTitle">${escapeHtml(getListingTitle(listing))}</h2>
        </div>
        <button class="detail-close" type="button" data-close-detail>Close</button>
      </div>
      <div class="detail-loading">Loading listing photos and details...</div>
    `;
  }

  function renderDetailSheet(listing, media) {
    const images = Array.isArray(media?.images) ? media.images : [];
    const primaryImage = images[0] || listing.coverImageUrl || '';
    const brokerPhone = getBrokerContactNumber();
    const phoneDisplay = formatPhoneDisplay(brokerPhone);
    const whatsappHref = brokerPhone
      ? `https://wa.me/${brokerPhone}?text=${encodeURIComponent(getWhatsappMessage(listing))}`
      : '';
    const details = media?.details || {};
    const rows = getDetailRows(listing, details);
    const notes = normalizeText(listing.publicNotes);
    const badges = [
      getPurposeLabel(listing),
      listing.status,
      listing.isDistress ? 'Distress Deal' : '',
      listing.purpose === 'monthly_rent' && listing.billsIncluded ? 'Bills Included' : ''
    ].filter(Boolean);
    els.detailContent.innerHTML = `
      <div class="detail-topbar">
        <div>
          <span class="profile-kicker">Client Inventory</span>
          <h2 id="listingDetailTitle">${escapeHtml(getListingTitle(listing))}</h2>
          <p>${escapeHtml([listing.location, listing.buildingLabel].filter(Boolean).join(' | ') || 'Location available on request')}</p>
        </div>
        <button class="detail-close" type="button" data-close-detail>Close</button>
      </div>
      <div class="detail-layout">
        <section class="detail-gallery">
          <div class="detail-main-photo">
            ${primaryImage ? `<img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(getListingTitle(listing))}">` : '<div class="listing-media-fallback">NB</div>'}
          </div>
          ${images.length > 1 ? `
            <div class="detail-thumbs">
              ${images.slice(0, 10).map((image, index) => `<button type="button" data-thumb="${index}" aria-label="Show photo ${index + 1}"><img src="${escapeHtml(image)}" alt=""></button>`).join('')}
            </div>
          ` : ''}
        </section>
        <section class="detail-copy">
          <div class="detail-price">${escapeHtml(getListingPrice(listing))}</div>
          <div class="listing-badge-row is-static">
            ${badges.map(badge => `<span class="listing-badge">${escapeHtml(badge)}</span>`).join('')}
          </div>
          <div class="client-contact-card">
            <div>
              <small>Contact Broker</small>
              <strong>${escapeHtml(state.broker?.name || 'NexBridge Broker')}</strong>
              <span>${escapeHtml(phoneDisplay || 'Number not set')}</span>
            </div>
            <div class="detail-actions">
              <a class="btn btn-primary" href="${escapeHtml(whatsappHref || '#')}" ${brokerPhone ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}>WhatsApp</a>
              <a class="btn btn-secondary" href="${brokerPhone ? `tel:${brokerPhone}` : '#'}" ${brokerPhone ? '' : 'aria-disabled="true"'}>Call</a>
            </div>
          </div>
          <div class="detail-grid">
            ${rows.map(([label, value]) => `
              <div class="detail-cell">
                <small>${escapeHtml(label)}</small>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `).join('')}
          </div>
          ${notes ? `
            <div class="detail-notes">
              <small>Notes</small>
              <p>${escapeHtml(notes)}</p>
            </div>
          ` : ''}
        </section>
      </div>
    `;
    els.detailContent.querySelectorAll('[data-thumb]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.thumb || 0);
        const image = images[index] || primaryImage;
        const mainPhoto = els.detailContent.querySelector('.detail-main-photo');
        if (mainPhoto && image) {
          mainPhoto.innerHTML = `<img src="${escapeHtml(image)}" alt="${escapeHtml(getListingTitle(listing))}">`;
        }
      });
    });
  }

  async function openListingDetail(listingId, updateUrl = true) {
    const listing = getListingById(listingId);
    if (!listing || !els.detailOverlay) return;
    els.detailOverlay.hidden = false;
    document.body.classList.add('detail-open');
    renderDetailLoading(listing);
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('listing', listing.id);
      window.history.replaceState({}, '', url.toString());
    }
    try {
      const media = await loadListingMedia(listing);
      renderDetailSheet(listing, media);
    } catch (error) {
      renderDetailSheet(listing, { images: listing.coverImageUrl ? [listing.coverImageUrl] : [], details: {} });
    }
  }

  function closeListingDetail() {
    if (!els.detailOverlay) return;
    els.detailOverlay.hidden = true;
    document.body.classList.remove('detail-open');
    const url = new URL(window.location.href);
    url.searchParams.delete('listing');
    window.history.replaceState({}, '', url.toString());
  }

  function openListingFromUrl() {
    const listingId = new URLSearchParams(window.location.search).get('listing');
    if (listingId) openListingDetail(listingId, false);
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
        Number(listing.listingImageCount || 0) > 0 ? `${Number(listing.listingImageCount)} photos` : '',
        listing.purpose === 'monthly_rent' && listing.furnishedStatus ? listing.furnishedStatus.replace(/_/g, ' ') : ''
      ].filter(Boolean);
      return `
        <article class="listing-card" data-open-listing="${escapeHtml(listing.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(getListingTitle(listing))}">
          <div class="listing-media" aria-hidden="true">
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
              <button class="btn btn-primary" type="button" data-open-listing="${escapeHtml(listing.id)}">Open Details</button>
              <button class="btn btn-secondary" type="button" data-copy-listing="${escapeHtml(getProfileListingLink(listing))}">Copy Link</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    els.grid.querySelectorAll('[data-copy-listing]').forEach(button => {
      button.addEventListener('click', async event => {
        event.stopPropagation();
        await navigator.clipboard?.writeText(button.dataset.copyListing || '');
        showToast('Listing link copied');
      });
    });
    els.grid.querySelectorAll('[data-open-listing]').forEach(element => {
      element.addEventListener('click', event => {
        event.stopPropagation();
        openListingDetail(element.dataset.openListing);
      });
      element.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openListingDetail(element.dataset.openListing);
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
      showToast('Inventory link copied');
    });
    els.detailOverlay?.addEventListener('click', event => {
      if (event.target === els.detailOverlay || event.target.closest('[data-close-detail]')) {
        closeListingDetail();
      }
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !els.detailOverlay?.hidden) closeListingDetail();
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
      const fallback = await loadPublicListingsFallback(broker);
      state.broker = fallback.broker || null;
      state.listings = Array.isArray(fallback.listings) ? fallback.listings : [];
      render();
      openListingFromUrl();
      return;
    }
    state.broker = result.broker || null;
    state.listings = Array.isArray(result.listings) ? result.listings : [];
    render();
    openListingFromUrl();
  }

  bindFilters();
  loadProfile().catch(error => {
    els.hero.innerHTML = `
      <div class="profile-avatar">NB</div>
      <div class="profile-copy">
        <span class="profile-kicker">NexBridge Client Inventory</span>
        <h1>Profile unavailable</h1>
        <p>${escapeHtml(error.message || 'This broker profile could not load right now.')}</p>
      </div>
    `;
    els.meta.textContent = 'Profile unavailable.';
    els.grid.innerHTML = '<div class="empty-state"><h2>Could not load profile</h2><p>Please check the link or try again shortly.</p></div>';
  });
})();
