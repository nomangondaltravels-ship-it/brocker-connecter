(function () {
  const MAX_IMAGES = 10;
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 1536 * 1024;
  const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const ACCEPTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const PDF_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const GALLERY_OVERLAY_ID = 'listingMediaGalleryOverlay';
  const GALLERY_CONTENT_ID = 'listingMediaGalleryContent';
  const PDF_OPTIONS_OVERLAY_ID = 'listingPdfOptionsOverlay';
  const STYLE_ID = 'listingMediaUiStyles';
  let pdfLibPromise = null;
  let brandLogoPromise = null;
  let pdfOptionsResolver = null;

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function sanitizePdfText(value) {
    const normalized = normalizeText(value)
      .replace(/\u00A0/g, ' ')
      .replace(/[•·]/g, ' - ')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    let output = '';
    for (const char of normalized) {
      const code = char.charCodeAt(0);
      if (code === 9 || code === 10 || code === 13) {
        output += ' ';
        continue;
      }
      if ((code >= 32 && code <= 126) || (code >= 161 && code <= 255)) {
        output += char;
      }
    }
    return output.replace(/\s+/g, ' ').trim();
  }

  function getExtension(name) {
    const normalized = normalizeText(name).toLowerCase();
    if (!normalized.includes('.')) return '';
    return normalized.split('.').pop();
  }

  function estimateDataUrlBytes(dataUrl) {
    const text = normalizeText(dataUrl);
    if (!text.startsWith('data:')) return 0;
    const parts = text.split(',');
    if (parts.length < 2) return 0;
    return Math.floor((parts[1].length * 3) / 4);
  }

  function sanitizeImageRecord(record) {
    const dataUrl = normalizeText(record?.dataUrl || record?.src || record?.url);
    if (!dataUrl.startsWith('data:image/')) return null;
    return {
      id: normalizeText(record?.id) || `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalizeText(record?.name) || 'Listing Image',
      mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg',
      dataUrl,
      width: Number(record?.width || 0) || 0,
      height: Number(record?.height || 0) || 0,
      size: Number(record?.size || estimateDataUrlBytes(dataUrl)) || 0
    };
  }

  function sanitizeImageList(records) {
    const items = (Array.isArray(records) ? records : [])
      .map(sanitizeImageRecord)
      .filter(Boolean)
      .slice(0, MAX_IMAGES);
    let total = 0;
    return items.filter((item) => {
      total += Number(item.size || 0);
      return total <= MAX_TOTAL_BYTES;
    });
  }

  function validateRawFile(file) {
    if (!file) {
      throw new Error('Select at least one picture.');
    }
    const mimeType = normalizeText(file.type).toLowerCase();
    const extension = getExtension(file.name);
    if (!ACCEPTED_MIME_TYPES.has(mimeType) && !ACCEPTED_EXTENSIONS.has(extension)) {
      throw new Error('Pictures must be JPG, JPEG, PNG, or WEBP.');
    }
    if (Number(file.size || 0) > MAX_FILE_BYTES) {
      throw new Error('Each picture must be 8 MB or smaller.');
    }
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`Could not process ${file.name}.`));
        image.onload = () => resolve(image);
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function drawOptimizedImageToDataUrl(image) {
    const maxDimension = 1200;
    let width = Number(image.width || 0) || 0;
    let height = Number(image.height || 0) || 0;
    if (!width || !height) {
      throw new Error('One of the selected pictures is invalid.');
    }
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Picture processing is not supported in this browser.');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (estimateDataUrlBytes(dataUrl) > 220 * 1024 && quality > 0.38) {
      quality -= 0.07;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return {
      dataUrl,
      width,
      height,
      mimeType: 'image/jpeg',
      size: estimateDataUrlBytes(dataUrl)
    };
  }

  async function optimizeImageFile(file) {
    validateRawFile(file);
    const image = await loadImageFromFile(file);
    const optimized = drawOptimizedImageToDataUrl(image);
    return sanitizeImageRecord({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      dataUrl: optimized.dataUrl,
      width: optimized.width,
      height: optimized.height,
      mimeType: optimized.mimeType,
      size: optimized.size
    });
  }

  async function appendFilesToImages(existingImages, fileList) {
    const currentImages = sanitizeImageList(existingImages);
    const files = Array.from(fileList || []);
    if (!files.length) {
      return currentImages;
    }
    if (currentImages.length + files.length > MAX_IMAGES) {
      throw new Error(`You can upload a maximum of ${MAX_IMAGES} pictures per listing.`);
    }
    const nextImages = [...currentImages];
    for (const file of files) {
      const optimized = await optimizeImageFile(file);
      nextImages.push(optimized);
    }
    const sanitized = sanitizeImageList(nextImages);
    const totalBytes = sanitized.reduce((sum, item) => sum + Number(item.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('Pictures are too large. Please use fewer or smaller images.');
    }
    return sanitized;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .listing-upload-stack { display:grid; gap:10px; }
      .listing-upload-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .listing-upload-input { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
      .listing-upload-summary { font-size:13px; line-height:1.5; color:#5f6985; }
      .listing-upload-chip-row { display:flex; gap:8px; flex-wrap:wrap; }
      .listing-upload-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid rgba(196,156,31,.22); border-radius:999px; background:#fffaf0; color:#6f5b20; font-size:12px; }
      .listing-media-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(10,17,35,.58); z-index:1600; }
      .listing-media-overlay.hidden { display:none; }
      .listing-media-card { width:min(1080px, 100%); max-height:min(88vh, 960px); display:grid; grid-template-rows:auto 1fr; border-radius:28px; background:#ffffff; border:1px solid rgba(212, 186, 116, 0.34); box-shadow:0 28px 70px rgba(11, 20, 44, 0.22); overflow:hidden; }
      .listing-media-head { display:flex; justify-content:space-between; gap:16px; align-items:center; padding:22px 24px 18px; border-bottom:1px solid rgba(15, 23, 42, 0.08); }
      .listing-media-head h3 { margin:0; font-size:28px; line-height:1.1; color:#1f2a44; }
      .listing-media-head p { margin:4px 0 0; color:#667085; font-size:14px; }
      .listing-media-body { padding:24px; overflow:auto; }
      .listing-media-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; }
      .listing-media-tile { border:1px solid rgba(15, 23, 42, 0.08); border-radius:20px; padding:12px; background:#fff; display:grid; gap:10px; }
      .listing-media-tile img { width:100%; height:220px; object-fit:cover; border-radius:14px; background:#f7f8fb; }
      .listing-media-tile span { font-size:13px; color:#667085; word-break:break-word; }
      .listing-media-empty { min-height:220px; display:grid; place-items:center; border:1px dashed rgba(15, 23, 42, 0.12); border-radius:20px; color:#667085; background:#fbfcff; text-align:center; padding:24px; }
      .listing-pdf-options-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(10,17,35,.58); z-index:1650; }
      .listing-pdf-options-overlay.hidden { display:none; }
      .listing-pdf-options-card { width:min(480px, 100%); max-height:min(82vh, 700px); display:grid; grid-template-rows:auto 1fr auto; border-radius:24px; background:#fffdfa; border:1px solid rgba(212, 186, 116, 0.34); box-shadow:0 28px 70px rgba(11, 20, 44, 0.22); overflow:hidden; }
      .listing-pdf-options-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:18px 20px 12px; border-bottom:1px solid rgba(15, 23, 42, 0.08); }
      .listing-pdf-options-head h3 { margin:0; font-size:22px; line-height:1.15; color:#1f2a44; }
      .listing-pdf-options-head p { margin:4px 0 0; color:#667085; font-size:13px; line-height:1.5; }
      .listing-pdf-options-body { display:grid; gap:8px; padding:14px 20px 8px; overflow:auto; align-content:start; }
      .listing-pdf-option { display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; padding:10px 12px; border:1px solid rgba(15,23,42,0.08); border-radius:14px; background:#ffffff; transition:background-color .16s ease, border-color .16s ease, box-shadow .16s ease; cursor:pointer; }
      .listing-pdf-option:hover { border-color:rgba(196,156,31,.28); }
      .listing-pdf-option.is-selected { background:#fff6de; border-color:rgba(196,156,31,.38); box-shadow:inset 0 0 0 1px rgba(196,156,31,.08); }
      .listing-pdf-option input { width:18px; height:18px; margin:0; accent-color:#c49c1f; }
      .listing-pdf-option-copy { display:grid; gap:2px; min-width:0; }
      .listing-pdf-option-title { color:#1f2a44; font-size:14px; line-height:1.35; font-weight:700; }
      .listing-pdf-option-desc { color:#667085; font-size:12px; line-height:1.4; }
      .listing-pdf-options-actions { display:flex; justify-content:flex-end; gap:10px; padding:12px 20px 18px; border-top:1px solid rgba(15,23,42,0.08); }
      @media (max-width: 720px) {
        .listing-media-overlay { padding:16px; }
        .listing-media-card { border-radius:20px; }
        .listing-media-head { padding:18px 18px 14px; }
        .listing-media-head h3 { font-size:24px; }
        .listing-media-body { padding:18px; }
        .listing-pdf-options-overlay { padding:16px; }
        .listing-pdf-options-card { border-radius:20px; }
        .listing-pdf-options-head { padding:16px 16px 10px; }
        .listing-pdf-options-head h3 { font-size:20px; }
        .listing-pdf-options-body { padding:12px 16px 8px; }
        .listing-pdf-options-actions { padding:12px 16px 16px; flex-wrap:wrap; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureGalleryShell() {
    ensureStyles();
    let overlay = document.getElementById(GALLERY_OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = GALLERY_OVERLAY_ID;
    overlay.className = 'listing-media-overlay hidden';
    overlay.innerHTML = `
      <div class="listing-media-card" role="dialog" aria-modal="true" aria-labelledby="listingMediaGalleryTitle">
        <div class="listing-media-head">
          <div>
            <h3 id="listingMediaGalleryTitle">Listing Pictures</h3>
            <p id="listingMediaGalleryMeta">Pictures are shown only when requested.</p>
          </div>
          <button class="btn btn-secondary" type="button" id="listingMediaGalleryClose">Close</button>
        </div>
        <div class="listing-media-body" id="${GALLERY_CONTENT_ID}"></div>
      </div>
    `;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeGallery();
      }
    });
    overlay.querySelector('#listingMediaGalleryClose')?.addEventListener('click', closeGallery);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeGallery();
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeGallery() {
    document.getElementById(GALLERY_OVERLAY_ID)?.classList.add('hidden');
  }

  function openGallery(options = {}) {
    const overlay = ensureGalleryShell();
    const titleNode = overlay.querySelector('#listingMediaGalleryTitle');
    const metaNode = overlay.querySelector('#listingMediaGalleryMeta');
    const contentNode = overlay.querySelector(`#${GALLERY_CONTENT_ID}`);
    const title = normalizeText(options.title) || 'Listing Pictures';
    const images = sanitizeImageList(options.images);
    if (titleNode) titleNode.textContent = title;
    if (metaNode) metaNode.textContent = images.length ? `${images.length} picture${images.length === 1 ? '' : 's'} available` : 'Pictures are shown only when requested.';
    if (contentNode) {
      contentNode.innerHTML = images.length
        ? `<div class="listing-media-grid">${images.map((image, index) => `
            <figure class="listing-media-tile">
              <img src="${image.dataUrl}" alt="${escapeHtmlAttr(image.name || `Listing picture ${index + 1}`)}" loading="lazy">
              <span>${escapeHtml(image.name || `Picture ${index + 1}`)}</span>
            </figure>
          `).join('')}</div>`
        : `<div class="listing-media-empty"><div><strong>No pictures uploaded</strong><br><span>Pictures are optional for this listing.</span></div></div>`;
    }
    overlay.classList.remove('hidden');
  }

  function ensurePdfOptionsShell() {
    ensureStyles();
    let overlay = document.getElementById(PDF_OPTIONS_OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = PDF_OPTIONS_OVERLAY_ID;
    overlay.className = 'listing-pdf-options-overlay hidden';
    overlay.innerHTML = `
      <div class="listing-pdf-options-card" role="dialog" aria-modal="true" aria-labelledby="listingPdfOptionsTitle">
        <div class="listing-pdf-options-head">
          <div>
            <h3 id="listingPdfOptionsTitle">Customize PDF Details</h3>
            <p id="listingPdfOptionsMeta">Choose which optional sections should appear in the PDF.</p>
          </div>
          <button class="btn btn-secondary" type="button" id="listingPdfOptionsClose">Close</button>
        </div>
        <form id="listingPdfOptionsForm">
          <div class="listing-pdf-options-body" id="listingPdfOptionsBody"></div>
          <div class="listing-pdf-options-actions">
            <button class="btn btn-secondary" type="button" id="listingPdfOptionsCancel">Cancel</button>
            <button class="btn btn-primary" type="submit">Download PDF</button>
          </div>
        </form>
      </div>
    `;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closePdfOptionsModal();
      }
    });
    overlay.querySelector('#listingPdfOptionsClose')?.addEventListener('click', () => closePdfOptionsModal());
    overlay.querySelector('#listingPdfOptionsCancel')?.addEventListener('click', () => closePdfOptionsModal());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
        closePdfOptionsModal();
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function finishPdfOptionsModal(result) {
    const overlay = document.getElementById(PDF_OPTIONS_OVERLAY_ID);
    if (overlay) overlay.classList.add('hidden');
    const resolver = pdfOptionsResolver;
    pdfOptionsResolver = null;
    if (resolver) resolver(result);
  }

  function closePdfOptionsModal() {
    finishPdfOptionsModal(null);
  }

  function openPdfOptionsModal(config = {}) {
    const sections = (Array.isArray(config.sections) ? config.sections : []).filter((section) => section && !section.hidden);
    if (!sections.length) {
      return Promise.resolve({});
    }
    const overlay = ensurePdfOptionsShell();
    const titleNode = overlay.querySelector('#listingPdfOptionsTitle');
    const metaNode = overlay.querySelector('#listingPdfOptionsMeta');
    const bodyNode = overlay.querySelector('#listingPdfOptionsBody');
    const formNode = overlay.querySelector('#listingPdfOptionsForm');
    if (titleNode) titleNode.textContent = normalizeText(config.title) || 'Customize PDF Details';
    if (metaNode) metaNode.textContent = normalizeText(config.description) || 'Choose which optional sections should appear in the PDF.';
    if (bodyNode) {
      bodyNode.innerHTML = sections.map((section) => `
        <label class="listing-pdf-option${section.checked ? ' is-selected' : ''}">
          <input type="checkbox" name="${escapeHtmlAttr(section.key)}" ${section.checked ? 'checked' : ''}>
          <span class="listing-pdf-option-copy">
            <span class="listing-pdf-option-title">${escapeHtml(section.label || section.key)}</span>
            ${section.description ? `<span class="listing-pdf-option-desc">${escapeHtml(section.description)}</span>` : ''}
          </span>
        </label>
      `).join('');
      bodyNode.querySelectorAll('.listing-pdf-option input').forEach((input) => {
        input.addEventListener('change', () => {
          input.closest('.listing-pdf-option')?.classList.toggle('is-selected', Boolean(input.checked));
        });
      });
    }
    if (formNode) {
      formNode.onsubmit = (event) => {
        event.preventDefault();
        const result = {};
        sections.forEach((section) => {
          result[section.key] = Boolean(formNode.querySelector(`[name="${section.key}"]`)?.checked);
        });
        finishPdfOptionsModal(result);
      };
    }
    overlay.classList.remove('hidden');
    return new Promise((resolve) => {
      pdfOptionsResolver = resolve;
    });
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeHtmlAttr(text) {
    return escapeHtml(text);
  }

  function ensurePdfLib() {
    if (window.PDFLib) {
      return Promise.resolve(window.PDFLib);
    }
    if (pdfLibPromise) {
      return pdfLibPromise;
    }
    pdfLibPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-pdf-lib="${PDF_LIB_URL}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.PDFLib));
        existing.addEventListener('error', () => reject(new Error('PDF library failed to load.')));
        return;
      }
      const script = document.createElement('script');
      script.src = PDF_LIB_URL;
      script.async = true;
      script.dataset.pdfLib = PDF_LIB_URL;
      script.onload = () => {
        if (window.PDFLib) {
          resolve(window.PDFLib);
        } else {
          reject(new Error('PDF library is unavailable.'));
        }
      };
      script.onerror = () => reject(new Error('PDF library failed to load.'));
      document.head.appendChild(script);
    });
    return pdfLibPromise;
  }

  async function getBrandLogoDataUrl() {
    if (brandLogoPromise) {
      return brandLogoPromise;
    }
    brandLogoPromise = (async () => {
      try {
        const response = await fetch('/assets/broker-connector-logo.svg', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Logo not available');
        }
        const svgText = await response.text();
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(blob);
        try {
          const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Logo image failed to load.'));
            img.src = blobUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = 144;
          canvas.height = 144;
          const ctx = canvas.getContext('2d');
          if (!ctx) return '';
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png');
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (error) {
        return '';
      }
    })();
    return brandLogoPromise;
  }

  function splitText(text, maxChars = 90) {
    const input = sanitizePdfText(text);
    if (!input) return [];
    const words = input.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function buildPdfFileName(title) {
    const normalized = sanitizePdfText(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${normalized || 'listing'}-summary.pdf`;
  }

  function normalizePdfFields(fields) {
    return (Array.isArray(fields) ? fields : [])
      .map((field) => ({
        label: sanitizePdfText(field?.label),
        value: sanitizePdfText(field?.value)
      }))
      .filter((field) => field.label && field.value);
  }

  function normalizePdfSections(sections) {
    return (Array.isArray(sections) ? sections : [])
      .map((section) => ({
        title: sanitizePdfText(section?.title),
        fields: normalizePdfFields(section?.fields),
        notes: sanitizePdfText(section?.notes),
        avatarDataUrl: normalizeText(section?.avatarDataUrl)
      }))
      .filter((section) => section.title && (section.fields.length || section.notes || section.avatarDataUrl));
  }

  async function downloadListingPdf(payload = {}) {
    const PDFLib = await ensurePdfLib();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageSize = { width: 595, height: 842 };
    const margin = 42;
    const contentWidth = pageSize.width - (margin * 2);
    const gold = rgb(0.768, 0.612, 0.122);
    const goldSoft = rgb(0.976, 0.953, 0.898);
    const paper = rgb(0.996, 0.988, 0.965);
    const ink = rgb(0.12, 0.16, 0.26);
    const muted = rgb(0.40, 0.45, 0.54);
    const border = rgb(0.874, 0.784, 0.537);
    let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
    let y = pageSize.height - margin;

    function addPage() {
      page = pdfDoc.addPage([pageSize.width, pageSize.height]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageSize.width,
        height: pageSize.height,
        color: paper
      });
      y = pageSize.height - margin;
    }

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
      color: paper
    });

    function ensureSpace(height) {
      if (y - height < margin) {
        addPage();
      }
    }

    function drawText(text, x, nextY, options = {}) {
      page.drawText(sanitizePdfText(text), {
        x,
        y: nextY,
        size: options.size || 11,
        font: options.bold ? fontBold : fontRegular,
        color: options.color || ink
      });
    }

    const fields = normalizePdfFields(payload.fields);
    const sections = normalizePdfSections(payload.sections);
    const images = sanitizeImageList(payload.images);
    const logoDataUrl = await getBrandLogoDataUrl();

    async function embedMaybeImage(dataUrl) {
      const safe = normalizeText(dataUrl);
      if (!safe.startsWith('data:image/')) return null;
      try {
        if (safe.includes('image/png')) {
          return await pdfDoc.embedPng(safe);
        }
        return await pdfDoc.embedJpg(safe);
      } catch (error) {
        return null;
      }
    }

    function sectionLineCount(section) {
      const fieldLines = section.fields.reduce((sum, field) => sum + Math.max(1, splitText(`${field.label}: ${field.value}`, 70).length), 0);
      const noteLines = section.notes ? splitText(section.notes, 74).length : 0;
      return fieldLines + noteLines;
    }

    async function drawSection(section) {
      const hasAvatar = Boolean(section.avatarDataUrl);
      const avatarSize = hasAvatar ? 62 : 0;
      const noteLines = section.notes ? splitText(section.notes, 74) : [];
      const lineCount = sectionLineCount(section);
      const minHeight = hasAvatar ? 118 : 84;
      const boxHeight = Math.max(minHeight, 42 + (lineCount * 16));
      ensureSpace(boxHeight + 14);
      page.drawRectangle({
        x: margin,
        y: y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        borderColor: border,
        borderWidth: 1
      });
      drawText(section.title, margin + 16, y - 18, { size: 10, bold: true, color: gold });
      let contentX = margin + 16;
      let rowY = y - 40;
      if (hasAvatar) {
        const embeddedAvatar = await embedMaybeImage(section.avatarDataUrl);
        if (embeddedAvatar) {
          page.drawImage(embeddedAvatar, {
            x: margin + 16,
            y: y - 96,
            width: avatarSize,
            height: avatarSize
          });
          contentX += avatarSize + 16;
        }
      }
      section.fields.forEach((field) => {
        const lines = splitText(`${field.label}: ${field.value}`, hasAvatar ? 54 : 72);
        lines.forEach((line, index) => {
          drawText(line, contentX, rowY, { size: 11, bold: index === 0 && line.startsWith(`${field.label}:`) });
          rowY -= 14;
        });
        rowY -= 4;
      });
      if (noteLines.length) {
        noteLines.forEach((line) => {
          drawText(line, contentX, rowY, { size: 11, color: muted });
          rowY -= 14;
        });
      }
      y -= boxHeight + 14;
    }

    ensureSpace(88);
    page.drawRectangle({
      x: margin,
      y: y - 70,
      width: contentWidth,
      height: 70,
      color: rgb(1, 1, 1),
      borderColor: border,
      borderWidth: 1.2
    });
    if (logoDataUrl) {
      const embeddedLogo = await embedMaybeImage(logoDataUrl);
      if (embeddedLogo) {
        page.drawImage(embeddedLogo, {
          x: margin + 18,
          y: y - 54,
          width: 38,
          height: 38
        });
      }
    }
    y -= 86;

    await drawSection({
      title: 'Listing Details',
      fields
    });

    for (const section of sections) {
      await drawSection(section);
    }

    if (payload.images !== undefined) {
      const imageSection = {
        title: 'Pictures',
        fields: [],
        notes: images.length ? '' : 'No pictures uploaded'
      };
      await drawSection(imageSection);
      if (images.length) {
        for (let index = 0; index < images.length; index += 1) {
          const image = images[index];
          const targetWidth = 240;
          const targetHeight = 180;
          ensureSpace(targetHeight + 30);
          const embeddedImage = await embedMaybeImage(image.dataUrl);
          if (!embeddedImage) continue;
          const dimensions = embeddedImage.scale(1);
          const ratio = Math.min(targetWidth / dimensions.width, targetHeight / dimensions.height);
          const width = Math.max(60, Math.round(dimensions.width * ratio));
          const height = Math.max(60, Math.round(dimensions.height * ratio));
          page.drawRectangle({
            x: margin,
            y: y - height - 16,
            width: contentWidth,
            height: height + 16,
            color: rgb(1, 1, 1),
            borderColor: border,
            borderWidth: 1
          });
          page.drawImage(embeddedImage, {
            x: margin + 12,
            y: y - height - 4,
            width,
            height
          });
          drawText(sanitizePdfText(image.name || `Picture ${index + 1}`), margin + width + 28, y - 24, { size: 10, bold: true, color: gold });
          y -= height + 28;
        }
      }
    }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildPdfFileName(payload.fileName || payload.title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.ListingMediaUi = {
    MAX_IMAGES,
    ACCEPTED_MIME_TYPES: Array.from(ACCEPTED_MIME_TYPES),
    sanitizeImageList,
    appendFilesToImages,
    openGallery,
    closeGallery,
    openPdfOptionsModal,
    downloadListingPdf
  };
})();
