(function () {
  const MAX_IMAGES = 10;
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
  const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const ACCEPTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const PDF_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const GALLERY_OVERLAY_ID = 'listingMediaGalleryOverlay';
  const GALLERY_CONTENT_ID = 'listingMediaGalleryContent';
  const STYLE_ID = 'listingMediaUiStyles';
  let pdfLibPromise = null;

  function normalizeText(value) {
    return String(value || '').trim();
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
    const maxDimension = 1400;
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

    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (estimateDataUrlBytes(dataUrl) > 450 * 1024 && quality > 0.46) {
      quality -= 0.08;
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
      @media (max-width: 720px) {
        .listing-media-overlay { padding:16px; }
        .listing-media-card { border-radius:20px; }
        .listing-media-head { padding:18px 18px 14px; }
        .listing-media-head h3 { font-size:24px; }
        .listing-media-body { padding:18px; }
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

  function splitText(text, maxChars = 90) {
    const input = normalizeText(text);
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
    const normalized = normalizeText(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${normalized || 'listing'}-summary.pdf`;
  }

  async function downloadListingPdf(payload = {}) {
    const PDFLib = await ensurePdfLib();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageSize = { width: 595, height: 842 };
    const margin = 42;
    let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
    let y = pageSize.height - margin;

    function addPage() {
      page = pdfDoc.addPage([pageSize.width, pageSize.height]);
      y = pageSize.height - margin;
    }

    function ensureSpace(height) {
      if (y - height < margin) {
        addPage();
      }
    }

    function drawText(text, x, nextY, options = {}) {
      page.drawText(String(text || ''), {
        x,
        y: nextY,
        size: options.size || 11,
        font: options.bold ? fontBold : fontRegular,
        color: options.color || rgb(0.14, 0.18, 0.28)
      });
    }

    ensureSpace(80);
    drawText(normalizeText(payload.title) || 'Listing Summary', margin, y, { size: 22, bold: true });
    y -= 24;
    drawText('Public-safe listing summary', margin, y, { size: 11, color: rgb(0.41, 0.46, 0.56) });
    y -= 28;

    const fields = Array.isArray(payload.fields) ? payload.fields.filter((field) => normalizeText(field?.value)) : [];
    fields.forEach((field) => {
      const valueLines = splitText(field.value, 70);
      ensureSpace(24 + Math.max(1, valueLines.length) * 14);
      drawText(normalizeText(field.label) || 'Field', margin, y, { size: 10, bold: true, color: rgb(0.48, 0.43, 0.27) });
      y -= 14;
      valueLines.forEach((line) => {
        drawText(line, margin, y, { size: 11 });
        y -= 14;
      });
      y -= 10;
    });

    const notes = normalizeText(payload.notes);
    if (notes) {
      const noteLines = splitText(notes, 78);
      ensureSpace(30 + noteLines.length * 14);
      drawText('Notes', margin, y, { size: 10, bold: true, color: rgb(0.48, 0.43, 0.27) });
      y -= 14;
      noteLines.forEach((line) => {
        drawText(line, margin, y, { size: 11 });
        y -= 14;
      });
      y -= 8;
    }

    const images = sanitizeImageList(payload.images);
    if (images.length) {
      ensureSpace(28);
      drawText('Pictures', margin, y, { size: 10, bold: true, color: rgb(0.48, 0.43, 0.27) });
      y -= 18;
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const targetWidth = 240;
        const targetHeight = 180;
        ensureSpace(targetHeight + 28);
        let embeddedImage;
        if (String(image.mimeType || '').toLowerCase() === 'image/png') {
          embeddedImage = await pdfDoc.embedPng(image.dataUrl);
        } else {
          embeddedImage = await pdfDoc.embedJpg(image.dataUrl);
        }
        const dimensions = embeddedImage.scale(1);
        const ratio = Math.min(targetWidth / dimensions.width, targetHeight / dimensions.height);
        const width = Math.max(60, Math.round(dimensions.width * ratio));
        const height = Math.max(60, Math.round(dimensions.height * ratio));
        page.drawImage(embeddedImage, {
          x: margin,
          y: y - height,
          width,
          height
        });
        drawText(image.name || `Picture ${index + 1}`, margin + width + 16, y - 12, { size: 10, bold: true });
        y -= Math.max(height, 76) + 16;
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
    downloadListingPdf
  };
})();
