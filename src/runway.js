/**
 * STRIDE LONDON — Try the Look & Leather Atelier
 * Plain HTML, CSS & Vanilla JavaScript (<runway-section> + Express Backend SPA)
 */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const SESSION_KEY = 'stride-london-session-v1';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'sl-guest-session';
  }
}

/**
 * @param {string} url
 * @param {RequestInit} [options]
 */
async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-session-id', getSessionId());
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request could not be completed.');
  }
  return data;
}

/** @type {{ brand?: any, products: any[], looks: any[], factory?: { images: any, stages: any[] } }} */
let catalogState = {
  products: [],
  looks: [],
};

/** @type {Promise<void> | null} */
let catalogPromise = null;

function ensureCatalogLoaded() {
  if (catalogState.products.length > 0) return Promise.resolve();
  if (!catalogPromise) {
    catalogPromise = apiFetch('/api/catalog')
      .then((data) => {
        catalogState = {
          brand: data.brand,
          products: Array.isArray(data.products) ? data.products : [],
          looks: Array.isArray(data.looks) ? data.looks : [],
          factory: data.factory || undefined,
        };
      })
      .catch(() => {
        // Keep safe empty catalog on transient failure
      });
  }
  return catalogPromise;
}

/**
 * Backend-synchronized styling & atelier bag
 */
function createBag() {
  /** @type {{ items: any[], subtotal: number, bundleDiscount: number, matchedLooks: string[], total: number, totalQuantity: number }} */
  let summary = {
    items: [],
    subtotal: 0,
    bundleDiscount: 0,
    matchedLooks: [],
    total: 0,
    totalQuantity: 0,
  };

  let toastTimer = 0;
  /** @type {Array<(s: typeof summary) => void>} */
  const listeners = [];

  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('bag-dialog'));
  const openBtn = document.getElementById('open-bag');
  const closeBtn = document.getElementById('close-bag');
  const itemsEl = document.getElementById('bag-items');
  const summaryLinesEl = document.getElementById('bag-summary-lines');
  const checkoutBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('bag-checkout-btn'));
  const exportBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('export-bag'));
  const statusEl = document.getElementById('bag-status');

  function showToast(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      statusEl.classList.remove('is-on');
    }, 2600);
  }

  function updateCount() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(summary.totalQuantity || 0);
    });
  }

  function notify() {
    updateCount();
    renderDialog();
    listeners.forEach((fn) => fn(summary));
  }

  function setSummary(next) {
    summary = {
      items: Array.isArray(next?.items) ? next.items : [],
      subtotal: Number(next?.subtotal || 0),
      bundleDiscount: Number(next?.bundleDiscount || 0),
      matchedLooks: Array.isArray(next?.matchedLooks) ? next.matchedLooks : [],
      total: Number(next?.total || 0),
      totalQuantity: Number(next?.totalQuantity || 0),
    };
    notify();
  }

  function renderDialog() {
    if (!itemsEl || !summaryLinesEl || !exportBtn || !checkoutBtn) return;

    itemsEl.textContent = '';
    summaryLinesEl.textContent = '';

    if (summary.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bag-note';
      empty.textContent = 'Your styling bag is empty. Choose a size beside a leather piece to save it.';
      itemsEl.appendChild(empty);
      exportBtn.disabled = true;
      checkoutBtn.disabled = true;
      return;
    }

    for (const item of summary.items) {
      const row = document.createElement('div');
      row.className = 'bag-row';

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      img.width = 64;
      img.height = 82;
      row.appendChild(img);

      const details = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.textContent = item.name;
      details.appendChild(h3);

      const meta = document.createElement('p');
      meta.textContent = `${item.leather} · Size ${item.size} · ${usd.format(item.unitPrice)} each`;
      details.appendChild(meta);

      const qtyControls = document.createElement('div');
      qtyControls.className = 'bag-qty-controls';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'bag-qty-btn';
      minusBtn.setAttribute('aria-label', `Decrease quantity of ${item.name}`);
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        updateQuantity(item.variantId, item.quantity - 1);
      });

      const qtyVal = document.createElement('span');
      qtyVal.className = 'bag-qty-val';
      qtyVal.textContent = String(item.quantity);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'bag-qty-btn';
      plusBtn.setAttribute('aria-label', `Increase quantity of ${item.name}`);
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        updateQuantity(item.variantId, item.quantity + 1);
      });

      qtyControls.appendChild(minusBtn);
      qtyControls.appendChild(qtyVal);
      qtyControls.appendChild(plusBtn);
      details.appendChild(qtyControls);

      row.appendChild(details);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'bag-remove';
      removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        remove(item.variantId);
      });
      row.appendChild(removeBtn);

      itemsEl.appendChild(row);
    }

    const subLine = document.createElement('div');
    subLine.className = 'bag-summary-line';
    subLine.innerHTML = `<span>Subtotal</span><span>${usd.format(summary.subtotal)}</span>`;
    summaryLinesEl.appendChild(subLine);

    if (summary.bundleDiscount > 0) {
      const discLine = document.createElement('div');
      discLine.className = 'bag-summary-line';
      discLine.innerHTML = `<span>10% Look Set Savings (${summary.matchedLooks[0] || 'Look'})</span><span>−${usd.format(summary.bundleDiscount)}</span>`;
      summaryLinesEl.appendChild(discLine);
    }

    const totalLine = document.createElement('div');
    totalLine.className = 'bag-summary-line is-total';
    totalLine.innerHTML = `<span>Estimated Total</span><span>${usd.format(summary.total)}</span>`;
    summaryLinesEl.appendChild(totalLine);

    exportBtn.disabled = false;
    checkoutBtn.disabled = false;
  }

  async function refresh() {
    try {
      const data = await apiFetch('/api/bag');
      setSummary(data);
    } catch {
      // Keep local summary state if offline
    }
  }

  async function add(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    const data = await apiFetch('/api/bag/items', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    setSummary(data);
    showToast(items.length === 1 ? 'Piece added to your STRIDE LONDON bag' : 'Complete leather look added to bag');
    return data;
  }

  async function updateQuantity(variantId, quantity) {
    try {
      if (quantity <= 0) {
        await remove(variantId);
        return;
      }
      const data = await apiFetch(`/api/bag/items/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      setSummary(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update quantity.');
    }
  }

  async function remove(variantId) {
    try {
      const data = await apiFetch(`/api/bag/items/${variantId}`, {
        method: 'DELETE',
      });
      setSummary(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove piece.');
    }
  }

  if (openBtn && dialog) {
    openBtn.addEventListener('click', async () => {
      await refresh();
      dialog.showModal();
    });
  }

  if (closeBtn && dialog) {
    closeBtn.addEventListener('click', () => {
      dialog.close();
    });
  }

  if (checkoutBtn && dialog) {
    checkoutBtn.addEventListener('click', () => {
      dialog.close();
      navigateTo('/checkout');
    });
  }

  if (dialog) {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) dialog.close();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (summary.items.length === 0) return;
      const lines = summary.items.map(
        (item) =>
          `${item.name} (${item.leather}) · Size ${item.size} · Qty ${item.quantity} · ${usd.format(item.lineTotal)}`
      );

      const content = [
        'STRIDE LONDON — ATELIER STYLING SHORTLIST',
        '14 Redchurch Street, Shoreditch, London E2 7DP',
        '',
        ...lines,
        '',
        `Subtotal: ${usd.format(summary.subtotal)}`,
        summary.bundleDiscount > 0 ? `Look Bundle Savings (10%): -${usd.format(summary.bundleDiscount)}` : '',
        `Estimated Total: ${usd.format(summary.total)}`,
      ]
        .filter(Boolean)
        .join('\n');

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stride-london-shortlist.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  refresh();

  return {
    add,
    refresh,
    updateQuantity,
    remove,
    setSummary,
    showToast,
    getSummary: () => summary,
    subscribe: (fn) => {
      listeners.push(fn);
    },
  };
}

const bagInstance = createBag();

/* ==========================================================================
   Product Specification Quick-View Modal
   ========================================================================== */

const productDialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('product-dialog'));
const closeProductBtn = document.getElementById('close-product');
const pdBody = document.getElementById('pd-body');

if (closeProductBtn && productDialog) {
  closeProductBtn.addEventListener('click', () => productDialog.close());
}

if (productDialog) {
  productDialog.addEventListener('click', (e) => {
    if (e.target !== productDialog) return;
    const r = productDialog.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!inside) productDialog.close();
  });
}

/**
 * @param {string} productId
 */
async function openProductModal(productId) {
  await ensureCatalogLoaded();
  const prod = catalogState.products.find((p) => p.id === productId);
  if (!prod || !productDialog || !pdBody) return;

  let selectedVariantId = prod.variants[0]?.id || 0;
  pdBody.textContent = '';

  const grid = document.createElement('div');
  grid.className = 'pd-grid';

  const media = document.createElement('div');
  media.className = 'pd-media';
  const img = document.createElement('img');
  img.src = prod.image;
  img.alt = prod.name;
  media.appendChild(img);

  const info = document.createElement('div');
  info.className = 'pd-info';

  const kicker = document.createElement('span');
  kicker.className = 'pd-kicker';
  kicker.textContent = `${prod.vendor} · ${prod.type}`;

  const title = document.createElement('h2');
  title.id = 'pd-title';
  title.className = 'pd-title';
  title.textContent = prod.name;

  const price = document.createElement('div');
  price.className = 'pd-price';
  price.textContent = usd.format(prod.price);

  const desc = document.createElement('p');
  desc.className = 'pd-desc';
  desc.textContent = prod.description;

  const specs = document.createElement('ul');
  specs.className = 'pd-specs';
  for (const s of prod.specs || []) {
    const li = document.createElement('li');
    li.textContent = s;
    specs.appendChild(li);
  }

  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'pd-kicker';
  sizeLabel.textContent = prod.optionName || 'Size';

  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'explore-card-sizes';

  prod.variants.forEach((v, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'explore-size-btn';
    btn.textContent = v.o.join(' / ');
    btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
    btn.disabled = !v.a;
    btn.addEventListener('click', () => {
      selectedVariantId = v.id;
      sizeWrap.querySelectorAll('.explore-size-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
    });
    sizeWrap.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-primary';
  addBtn.textContent = `Add to Bag — ${usd.format(prod.price)}`;
  addBtn.addEventListener('click', async () => {
    if (!selectedVariantId) return;
    addBtn.disabled = true;
    const origText = addBtn.textContent;
    addBtn.textContent = 'Adding to Bag…';
    try {
      await bagInstance.add([{ id: selectedVariantId, quantity: 1 }]);
      addBtn.textContent = 'Added to Bag ✓';
      window.setTimeout(() => {
        addBtn.disabled = false;
        addBtn.textContent = origText;
      }, 1400);
    } catch (err) {
      addBtn.disabled = false;
      addBtn.textContent = origText;
      bagInstance.showToast(err instanceof Error ? err.message : 'Unable to add piece.');
    }
  });

  info.appendChild(kicker);
  info.appendChild(title);
  info.appendChild(price);
  info.appendChild(desc);
  info.appendChild(specs);
  info.appendChild(sizeLabel);
  info.appendChild(sizeWrap);
  info.appendChild(addBtn);

  grid.appendChild(media);
  grid.appendChild(info);
  pdBody.appendChild(grid);

  productDialog.showModal();
}

/* ==========================================================================
   <runway-section> Custom Element
   ========================================================================== */

class RunwaySection extends HTMLElement {
  constructor() {
    super();
    this._raf = 0;
    this._cursorRaf = 0;
    this._autoTimer = 0;
    this._lbTimer = 0;
    this._resizeTimer = 0;
    this._wheelTimer = 0;
    this._dragSuppressUntil = 0;
    /** @type {Array<IntersectionObserver | ResizeObserver>} */
    this._observers = [];
    /** @type {Array<() => void>} */
    this._cleanups = [];
    /** @type {HTMLElement | null} */
    this._sheetHost = null;
    /** @type {Element | null} */
    this._openSheetCard = null;
    /** @type {HTMLElement | null} */
    this._sheetReturnFocus = null;
    /** @type {(() => void) | null} */
    this._measureFn = null;
  }

  refreshLayout() {
    if (this._measureFn) {
      window.requestAnimationFrame(() => {
        if (this._measureFn) this._measureFn();
      });
    }
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    this.classList.add('rw--js');

    const bag = bagInstance;
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedQuery.matches;

    const stage = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-stage]'));
    const actorsEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-actors]'));
    const heroes = /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('[data-rw-hero]')));
    const ticks = /** @type {HTMLButtonElement[]} */ (Array.from(this.querySelectorAll('[data-rw-tick]')));
    const ticksWrap = /** @type {HTMLElement | null} */ (this.querySelector('.rw__ticks'));
    const panels = /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('[data-rw-panel]')));
    const piecesEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-pieces]'));
    const liveEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-live]'));
    const autoBtn = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-rw-auto]'));
    const panelEl = /** @type {HTMLElement | null} */ (this.querySelector('.rw__panel'));
    const cursorEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-cursor]'));
    const lbEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-lb]'));
    const lbStage = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-lb-stage]'));
    const lbKicker = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-lb-kicker]'));
    const lbName = /** @type {HTMLElement | null} */ (this.querySelector('[data-rw-lb-name]'));
    const lbClose = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-rw-zoom-close]'));

    if (!stage || !actorsEl || heroes.length === 0) return;

    const n = heroes.length;
    const N = n * Math.ceil(8 / n);

    const speed = Math.max(1000, Number(this.dataset.speed || 5000));
    const autoplayConfigured = this.dataset.autoplay === 'true';
    const mheightVh = Number(this.dataset.mheightVh || 109);
    const msgChoose = this.dataset.msgChoose || 'Pick a size for: [items]';
    const msgError = this.dataset.msgError || 'Couldn’t add to bag. Please try again.';
    const msgSoldout = this.dataset.msgSoldout || 'Sold out';

    const K = 95;
    const C = 2 * Math.sqrt(K);

    // Clone bodies 0..5 -> 6..11
    const origModels = Array.from(actorsEl.querySelectorAll('[data-rw-model]'));
    for (let a = origModels.length; a < N; a++) {
      const clone = /** @type {HTMLElement} */ (origModels[a % n].cloneNode(true));
      clone.setAttribute('data-rw-clone', '');
      clone.setAttribute('data-index', String(a % n));
      const img = clone.querySelector('img[data-model-image]');
      if (img) img.setAttribute('loading', 'lazy');
      actorsEl.appendChild(clone);
    }

    const allModelEls = /** @type {HTMLElement[]} */ (Array.from(actorsEl.querySelectorAll('[data-rw-model]')));

    const wrapN = (v) => {
      let r = ((v % N) + N) % N;
      if (r < 0) r += N;
      return r;
    };

    const startOffset = reducedMotion ? 0 : 1.15;

    const bodies = allModelEls.map((el, a) => {
      const initX = wrapN(a) + startOffset;
      return {
        el,
        idx: a % n,
        x: initX,
        g: initX,
        v: 0,
        from: initX,
        goal: wrapN(a),
        trip: false,
        w: 0,
        hit: /** @type {HTMLButtonElement | null} */ (el.querySelector('.rw__hit')),
        lastBlur: '',
      };
    });

    let index = 0;
    let target = 0;
    let cur = -startOffset;
    let vel = 0;
    let still = false;
    let visible = true;
    let playing = false;
    let engaged = false;
    let panelHover = false;
    let dragging = false;
    let zoomed = false;
    let lastTime = 0;
    let isMobile = window.innerWidth <= 749;
    let mode = isMobile ? (this.dataset.mstyle || 'classic') : (this.dataset.style || 'ring');

    let W = 0;
    let H = 0;
    let fs = mode === 'ring' ? 1.08 : 1;
    let unit = 200;
    let latchedW = window.innerWidth;
    let latchedVh = window.innerHeight;

    // Decode all model images
    const decodeImg = (img) => {
      if (!img) return;
      const done = () => img.classList.add('is-decoded');
      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(() => {
          if (img.complete && img.naturalWidth > 0) done();
        });
      }
      if (!img.complete) {
        img.addEventListener('load', () => {
          if (typeof img.decode === 'function') {
            img.decode().then(done).catch(() => {
              if (img.naturalWidth > 0) done();
            });
          } else if (img.naturalWidth > 0) {
            done();
          }
        }, { once: true });
      } else if (img.naturalWidth > 0) {
        done();
      }
    };

    this.querySelectorAll('img[data-model-image]').forEach(decodeImg);

    // Feet detection
    const detectFeet = () => {
      heroes.forEach((hero, lookIdx) => {
        const probeUrl = hero.dataset.probe;
        if (!probeUrl) return;
        const probe = new Image();
        probe.onload = () => {
          try {
            if (!probe.naturalWidth || !probe.naturalHeight) return;
            const cw = 48;
            const ch = Math.max(1, Math.round(cw * (probe.naturalHeight / probe.naturalWidth)));
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(probe, 0, 0, cw, ch);
            const data = ctx.getImageData(0, 0, cw, ch).data;
            let lastRow = ch - 1;
            let found = false;
            for (let y = ch - 1; y >= 0; y--) {
              const rowStart = y * cw * 4;
              for (let x = 0; x < cw; x++) {
                if (data[rowStart + x * 4 + 3] > 40) {
                  lastRow = y;
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (!found) return;
            const foot = clamp((ch - 1 - lastRow) / ch, 0, 0.4);
            const val = foot.toFixed(4);
            hero.style.setProperty('--rw-foot', val);
            bodies.forEach((b) => {
              if (b.idx === lookIdx) {
                b.el.style.setProperty('--rw-foot', val);
              }
            });
          } catch {
            // Silently keep offset 0
          }
        };
        probe.src = probeUrl;
      });
    };
    detectFeet();

    // Variant & picker management
    const variantCache = new WeakMap();
    const getVariants = (card) => {
      if (variantCache.has(card)) return variantCache.get(card);
      const script = card.querySelector('script[data-rw-variants]');
      let list = [];
      if (script) {
        try {
          list = JSON.parse(script.textContent || '[]');
        } catch {
          list = [];
        }
      }
      variantCache.set(card, list);
      return list;
    };

    const syncCardOptions = (card, markTouched) => {
      if (!(card instanceof HTMLElement)) return;
      const variants = getVariants(card);
      const picker =
        card.querySelector('[data-rw-picker]') ||
        (this._openSheetCard === card && this._sheetHost ? this._sheetHost.querySelector('[data-rw-picker]') : null);
      if (!picker || variants.length === 0) return;

      const checkedInputs = Array.from(picker.querySelectorAll('input[data-rw-option]:checked'));
      /** @type {string[]} */
      const selectedValues = [];
      for (const inp of checkedInputs) {
        if (!(inp instanceof HTMLInputElement)) continue;
        const optIdx = Number(inp.getAttribute('data-rw-option') || 0);
        selectedValues[optIdx] = inp.value;
      }

      const match = variants.find((v) =>
        selectedValues.every((val, optIdx) => v.o[optIdx] === val)
      );

      const pills = Array.from(picker.querySelectorAll('.rw__pill'));
      for (const pill of pills) {
        const inp = pill.querySelector('input[data-rw-option]');
        if (!(inp instanceof HTMLInputElement)) continue;
        const optIdx = Number(inp.getAttribute('data-rw-option') || 0);
        const testVal = inp.value;
        const hasAvail = variants.some((v) => {
          if (!v.a || v.o[optIdx] !== testVal) return false;
          return selectedValues.every((sv, i) => i === optIdx || v.o[i] === sv);
        });
        pill.classList.toggle('is-unavailable', !hasAvail);
      }

      const confirmBtn = /** @type {HTMLButtonElement | null} */ (picker.querySelector('[data-rw-confirm]'));
      const confirmLabel = picker.querySelector('[data-rw-confirm-label]');
      const available = Boolean(match && match.a);

      card.dataset.selected = match ? String(match.id) : '';
      if (markTouched) {
        card.dataset.touched = '1';
      }
      if (confirmBtn) {
        confirmBtn.disabled = !available;
      }
      if (confirmLabel) {
        confirmLabel.textContent = available ? (confirmLabel.getAttribute('data-add') || 'Add to bag') : msgSoldout;
      }
    };

    this.querySelectorAll('[data-rw-card]').forEach((card) => {
      syncCardOptions(card, false);
    });

    const getPickerForCard = (card) => {
      const inline = card.querySelector('[data-rw-picker]');
      if (inline) return inline;
      if (this._openSheetCard === card && this._sheetHost) {
        return this._sheetHost.querySelector('[data-rw-picker]');
      }
      return null;
    };

    const dockSheet = () => {
      if (this._sheetHost && this._openSheetCard) {
        const picker = this._sheetHost.querySelector('[data-rw-picker]');
        if (picker instanceof HTMLElement) {
          picker.hidden = true;
          this._openSheetCard.appendChild(picker);
        }
        this._openSheetCard.classList.remove('is-picking');
        const addBtn = this._openSheetCard.querySelector('[data-rw-add]');
        if (addBtn && !this._openSheetCard.classList.contains('is-added')) {
          addBtn.setAttribute('aria-expanded', 'false');
        }
      }
      if (this._sheetHost) {
        this._sheetHost.classList.remove('is-open');
        this._sheetHost.remove();
        this._sheetHost = null;
      }
      this._openSheetCard = null;
      this.classList.remove('rw--picking');
    };

    const closeSheet = (restoreFocus = false) => {
      const ret = this._sheetReturnFocus;
      this._sheetReturnFocus = null;
      dockSheet();
      if (restoreFocus && ret && typeof ret.focus === 'function') {
        ret.focus({ preventScroll: true });
      }
    };

    const revealCard = (card) => {
      const list = card.closest('.rw__items');
      if (!list) return;
      const behavior = reducedMotion ? 'auto' : 'smooth';
      if (list.scrollWidth > list.clientWidth + 2) {
        const cr = card.getBoundingClientRect();
        const lr = list.getBoundingClientRect();
        list.scrollTo({ left: list.scrollLeft + (cr.left - lr.left) - 20, behavior });
      } else if (list.scrollHeight > list.clientHeight + 2) {
        const top = /** @type {HTMLElement} */ (card).offsetTop - /** @type {HTMLElement} */ (list).offsetTop - 12;
        list.scrollTo({ top: Math.max(0, top), behavior });
      }
    };

    const openPicker = (card, focusChecked = true) => {
      if (card.classList.contains('is-added')) return;
      const picker = getPickerForCard(card);
      if (!(picker instanceof HTMLElement)) return;

      if (isMobile) {
        if (this._openSheetCard === card) return;
        dockSheet();
        const host = document.createElement('div');
        host.className = 'rw-sheet-host';

        const cs = getComputedStyle(this);
        const varsToCopy = [
          '--rw-panel', '--rw-text', '--rw-muted', '--rw-line', '--rw-accent',
          '--rw-on-accent', '--rw-btn-bg', '--rw-btn-fg', '--rw-btn-radius',
          '--rw-pill-radius', '--rw-bar-r', '--rw-thumb-radius', '--rw-pt-size',
          '--rw-price', '--rw-opt', '--rw-ease', '--rw-ease-sheet', '--rw-ease-spring',
        ];
        for (const v of varsToCopy) {
          const val = cs.getPropertyValue(v);
          if (val) host.style.setProperty(v, val.trim());
        }
        host.style.fontFamily = cs.fontFamily;
        host.style.color = cs.color;

        const scrim = document.createElement('button');
        scrim.type = 'button';
        scrim.className = 'rw__pick-scrim';
        scrim.setAttribute('data-rw-pick-close', '');
        scrim.tabIndex = -1;
        scrim.setAttribute('aria-hidden', 'true');
        host.appendChild(scrim);

        picker.hidden = false;
        host.appendChild(picker);
        document.body.appendChild(host);

        void host.offsetWidth;
        host.classList.add('is-open');

        this._sheetHost = host;
        this._openSheetCard = card;
        this._sheetReturnFocus = /** @type {HTMLElement | null} */ (card.querySelector('[data-rw-add]'));
        this.classList.add('rw--picking');
        card.classList.add('is-picking');
        const addBtn = card.querySelector('[data-rw-add]');
        if (addBtn) addBtn.setAttribute('aria-expanded', 'true');

        host.addEventListener('click', (e) => {
          const t = /** @type {HTMLElement} */ (e.target);
          if (t.closest('[data-rw-pick-close]')) {
            closeSheet(true);
          } else if (t.closest('[data-rw-confirm]')) {
            confirmCard(card);
          }
        });

        host.addEventListener('change', (e) => {
          const t = /** @type {HTMLElement} */ (e.target);
          if (t.matches('input[data-rw-option]')) {
            engage();
            syncCardOptions(card, true);
          }
        });

        host.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeSheet(true);
          }
        });
      } else {
        picker.hidden = false;
        card.classList.add('is-picking');
        const addBtn = card.querySelector('[data-rw-add]');
        if (addBtn) addBtn.setAttribute('aria-expanded', 'true');
        revealCard(card);
      }

      if (focusChecked) {
        const checked = /** @type {HTMLElement | null} */ (picker.querySelector('input[data-rw-option]:checked'));
        if (checked) checked.focus({ preventScroll: true });
      }
    };

    const closeInlinePicker = (card) => {
      const picker = card.querySelector('[data-rw-picker]');
      if (!(picker instanceof HTMLElement)) return;
      picker.hidden = true;
      card.classList.remove('is-picking');
      const addBtn = card.querySelector('[data-rw-add]');
      if (addBtn) addBtn.setAttribute('aria-expanded', 'false');
    };

    const hot = (num, scroll = false) => {
      this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
      if (!num) return;
      const pinContainer = zoomed && lbStage ? lbStage : heroes[index];
      const pin = pinContainer ? pinContainer.querySelector(`[data-rw-pin="${num}"]`) : null;
      if (pin) pin.classList.add('is-hot');
      const activePanel = panels[index];
      const card = activePanel ? activePanel.querySelector(`[data-rw-card="${num}"]`) : null;
      if (card) {
        card.classList.add('is-hot');
        if (scroll) revealCard(card);
      }
    };

    const checkPanelComplete = (panel) => {
      if (!panel) return;
      const cards = Array.from(panel.querySelectorAll('[data-rw-card]'));
      if (cards.length >= 2 && cards.every((c) => c.classList.contains('is-added'))) {
        panel.classList.add('is-complete');
        const msgEl = panel.querySelector('[data-rw-msg]');
        if (msgEl) msgEl.textContent = '';
      }
    };

    const markAdded = (card) => {
      if (this._openSheetCard === card) {
        dockSheet();
      } else {
        closeInlinePicker(card);
      }
      card.classList.remove('is-loading', 'is-picking');
      card.classList.add('is-added');
      const addBtn = card.querySelector('[data-rw-add]');
      if (addBtn) {
        const addedLabel = addBtn.getAttribute('data-added-label');
        if (addedLabel) addBtn.setAttribute('aria-label', addedLabel);
        addBtn.removeAttribute('aria-expanded');
      }
      if (isMobile && !reducedMotion && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          // Ignore vibrate errors
        }
      }
      const panel = card.closest('[data-rw-panel]');
      checkPanelComplete(panel);
    };

    const confirmCard = async (card) => {
      if (!(card instanceof HTMLElement)) return;
      if (card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
      const directId = Number(card.getAttribute('data-variant-id') || 0);
      if (!directId) {
        syncCardOptions(card, true);
      }
      const vid = directId || Number(card.dataset.selected || 0);
      if (!vid) return;
      const panel = card.closest('[data-rw-panel]');
      const msgEl = panel ? panel.querySelector('[data-rw-msg]') : null;
      if (msgEl) msgEl.textContent = '';
      card.classList.add('is-loading');
      try {
        await bag.add([{ id: vid, quantity: 1 }]);
        markAdded(card);
      } catch (err) {
        card.classList.remove('is-loading');
        if (msgEl) msgEl.textContent = (err instanceof Error && err.message) || msgError;
      }
    };

    const addFullLook = async (panel) => {
      if (!panel || panel.classList.contains('is-complete')) return;
      const cta = /** @type {HTMLButtonElement | null} */ (panel.querySelector('[data-rw-all]'));
      if (!cta || cta.classList.contains('is-loading')) return;
      const msgEl = panel.querySelector('[data-rw-msg]');
      if (msgEl) msgEl.textContent = '';

      const cards = Array.from(panel.querySelectorAll('[data-rw-card]')).filter((c) => {
        if (!(c instanceof HTMLElement)) return false;
        if (c.classList.contains('is-added')) return false;
        const p = getPickerForCard(c);
        const conf = /** @type {HTMLButtonElement | null} */ (p ? p.querySelector('[data-rw-confirm]') : null);
        if (conf && conf.disabled && !c.dataset.selected) return false;
        return true;
      });

      /** @type {Array<{ card: HTMLElement, id: number }>} */
      const readyCards = [];
      /** @type {HTMLElement[]} */
      const pendingCards = [];

      for (const c of cards) {
        if (!(c instanceof HTMLElement)) continue;
        const directId = Number(c.getAttribute('data-variant-id') || 0);
        const selectedId = Number(c.dataset.selected || 0);
        if (directId > 0) {
          readyCards.push({ card: c, id: directId });
        } else if (c.dataset.touched === '1' && selectedId > 0) {
          readyCards.push({ card: c, id: selectedId });
        } else {
          pendingCards.push(c);
        }
      }

      if (readyCards.length > 0) {
        cta.classList.add('is-loading');
        readyCards.forEach(({ card }) => card.classList.add('is-loading'));
        try {
          await bag.add(readyCards.map(({ id }) => ({ id, quantity: 1 })));
          readyCards.forEach(({ card }) => markAdded(card));
        } catch (err) {
          readyCards.forEach(({ card }) => card.classList.remove('is-loading'));
          if (msgEl) msgEl.textContent = (err instanceof Error && err.message) || msgError;
        } finally {
          cta.classList.remove('is-loading');
        }
      }

      if (pendingCards.length > 0) {
        if (isMobile) {
          openPicker(pendingCards[0], true);
          revealCard(pendingCards[0]);
        } else {
          pendingCards.forEach((c, idx) => openPicker(c, idx === 0));
          revealCard(pendingCards[0]);
        }
        const names = pendingCards.map((c) => c.getAttribute('data-title') || '').filter(Boolean);
        if (msgEl) {
          msgEl.textContent = msgChoose.replace('[items]', names.join(', '));
        }
      }
    };

    const put = (b, x, bottom, scale, opacity, blur, z) => {
      const halfW = (b.w * scale) / 2;
      let op = opacity;
      if (x + halfW < -4 || x - halfW > W + 4) op = 0;

      const el = b.el;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${(-bottom).toFixed(2)}px, 0) translateX(-50%) scale(${scale.toFixed(4)})`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(z);
      el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = op < 0.5 ? 'none' : 'auto';

      const bRound = Math.round(blur * 10) / 10;
      const blurStr = bRound <= 0.05 ? '' : `blur(${bRound}px)`;
      if (blurStr !== b.lastBlur) {
        el.style.filter = blurStr;
        b.lastBlur = blurStr;
      }
    };

    const renderAll = () => {
      if (W <= 0 || H <= 0) return;

      if (mode === 'ring') {
        const cx = 0.5 * W;
        const R = (isMobile ? 0.72 : 0.62) * W;
        const P = (isMobile ? 1.9 : 1.65) * W;
        const floor = H - 34;
        const horizon = 0.36 * H;
        const step = (2 * Math.PI) / N;

        for (let a = 0; a < N; a++) {
          const b = bodies[a];
          let phi = ((a - cur) * step) % (2 * Math.PI);
          if (phi > Math.PI) phi -= 2 * Math.PI;
          if (phi <= -Math.PI) phi += 2 * Math.PI;

          const zDepth = R * (1 - Math.cos(phi));
          const persp = P / (P + zDepth);
          const sl = Math.abs(phi) / step;
          const scale = persp * (1 + (fs - 1) * clamp(1 - sl, 0, 1));
          const x = cx + R * Math.sin(phi) * persp;
          const feet = horizon + (floor - horizon) * persp;
          const bottom = H - feet;
          const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
          let op = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
          if (still && sl < 0.02) op = 0;
          const z = Math.round(scale * 1000);
          put(b, x, bottom, scale, op, blur, z);
        }
      } else {
        const ax = isMobile ? 0.3 : 0.4;
        const ay = isMobile ? 22 : 36;
        const sx = isMobile ? 0.32 : 0.125;
        const sy = isMobile ? 22 : 58;
        const sr = 0.76;
        const ex = isMobile ? 0.55 : 0.38;
        const d = isMobile ? 4 : 5;

        for (let a = 0; a < N; a++) {
          const b = bodies[a];
          let k = b.x;
          let e = -1;

          if (b.trip) {
            const denom = b.goal - b.from;
            const u = Math.abs(denom) > 1e-6 ? Math.abs(b.x - b.from) / Math.abs(denom) : 1;
            if (b.goal > b.from) {
              if (u < 0.5) e = 2 * u * 1.4;
              else k = b.goal + 2 * (1 - u);
            } else {
              if (u < 0.5) k = b.from + 2 * u;
              else e = 2 * (1 - u) * 1.4;
            }
          } else if (k < 0) {
            e = Math.min(-k, 1.4);
          }

          if (e >= 0) {
            const x = W * (ax - ex * e);
            const bottom = ay - 22 * e;
            const scale = 1 + 0.14 * e;
            const op = Math.max(0, 1 - 1.05 * e);
            const blur = 4 * Math.min(e, 1);
            put(b, x, bottom, scale, op, blur, 1100);
          } else {
            const x = W * (ax + sx * k);
            const bottom = ay + sy * k;
            const scale = Math.pow(sr, k);
            let op = k <= d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (d - k));
            if (still && Math.abs(k) < 0.02) op = 0;
            const blur = Math.min(0.9 * k, 3.2);
            const z = 1000 - Math.round(10 * k);
            put(b, x, bottom, scale, op, blur, z);
          }
        }
      }
    };

    const setStill = (val) => {
      if (still === val) return;
      still = val;
      this.classList.toggle('rw--still', val);
    };

    const kick = () => {
      if (this._raf || !visible || document.hidden || this.closest('[hidden]')) return;
      lastTime = 0;
      this._raf = window.requestAnimationFrame(step);
    };

    const step = (now) => {
      this._raf = 0;
      if (!visible || document.hidden || this.closest('[hidden]')) return;

      const rawDt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
      lastTime = now;
      const dt = Math.min(0.034, Math.max(0.001, rawDt));

      let allSettled = true;

      if (mode === 'ring') {
        if (reducedMotion && !dragging) {
          cur = target;
          vel = 0;
          allSettled = true;
        } else {
          const h = dt / 3;
          for (let s = 0; s < 3; s++) {
            const acc = -K * (cur - target) - C * vel;
            vel += acc * h;
            cur += vel * h;
          }
          if (!dragging && Math.abs(cur - target) <= 0.0005 && Math.abs(vel) <= 0.0005) {
            cur = target;
            vel = 0;
            allSettled = true;
          } else {
            allSettled = false;
          }
        }
      } else {
        for (let a = 0; a < N; a++) {
          const b = bodies[a];
          const newGoal = wrapN(a - target);
          if (Math.abs(newGoal - b.goal) > N / 2) {
            b.from = b.x;
            b.trip = true;
          }
          b.goal = newGoal;

          if (reducedMotion && !dragging) {
            b.x = b.goal;
            b.g = b.goal;
            b.v = 0;
            b.trip = false;
          } else {
            const tau = dragging ? 0.016 : b.trip ? 0.1 : 0.03 + 0.04 * Math.min(b.goal, 4);
            b.g += (b.goal - b.g) * (1 - Math.exp(-dt / tau));
            const h = dt / 3;
            for (let s = 0; s < 3; s++) {
              const acc = -K * (b.x - b.g) - C * b.v;
              b.v += acc * h;
              b.x += b.v * h;
            }
            if (b.trip && Math.abs(b.x - b.goal) < 0.02) {
              b.trip = false;
            }
            if (!dragging && Math.abs(b.x - b.goal) <= 0.0006 && Math.abs(b.v) <= 0.0006 && Math.abs(b.g - b.goal) <= 0.0006) {
              b.x = b.goal;
              b.g = b.goal;
              b.v = 0;
              b.trip = false;
            } else {
              allSettled = false;
            }
          }
        }
      }

      if (allSettled && !dragging) {
        setStill(true);
        renderAll();
      } else {
        setStill(false);
        renderAll();
        this._raf = window.requestAnimationFrame(step);
      }
    };

    const openLightbox = () => {
      if (zoomed || !lbEl || !lbStage) return;
      engage();
      hot(null);

      const hero = heroes[index];
      const heroFig = /** @type {HTMLElement | null} */ (hero.querySelector('.rw__figure'));
      if (!heroFig) return;

      const a = heroFig.getBoundingClientRect();

      window.clearTimeout(this._lbTimer);
      lbStage.textContent = '';

      const modelWrap = document.createElement('div');
      modelWrap.className = 'rw__lb-model';

      const foot = hero.style.getPropertyValue('--rw-foot');
      if (foot) modelWrap.style.setProperty('--rw-foot', foot);

      const shadowClone = hero.querySelector('.rw__shadow')?.cloneNode(true);
      const figClone = /** @type {HTMLElement} */ (heroFig.cloneNode(true));
      figClone.querySelector('.rw__zoom')?.remove();

      figClone.querySelectorAll('.rw__pin').forEach((pin) => {
        if (pin instanceof HTMLElement) pin.tabIndex = 0;
      });
      figClone.querySelectorAll('img[data-model-image]').forEach((img) => {
        img.setAttribute('loading', 'eager');
        decodeImg(img);
      });

      if (shadowClone) modelWrap.appendChild(shadowClone);
      modelWrap.appendChild(figClone);
      lbStage.appendChild(modelWrap);

      const sr = lbStage.getBoundingClientRect();
      const h = Math.max(160, Math.min(sr.height, sr.width / 0.5625));
      modelWrap.style.setProperty('--rw-model-h', `${Math.round(h)}px`);

      const word = lbEl.dataset.word || 'Look';
      if (lbKicker) lbKicker.textContent = `${word} ${String(index + 1).padStart(2, '0')}`;
      if (lbName) lbName.textContent = hero.dataset.name || '';

      const b = figClone.getBoundingClientRect();

      zoomed = true;
      this.classList.add('rw--zoom');
      lbEl.setAttribute('aria-hidden', 'false');

      if (!reducedMotion && a.height > 0 && b.height > 0) {
        modelWrap.style.transition = 'none';
        modelWrap.style.transformOrigin = '0 100%';
        modelWrap.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
        void modelWrap.offsetWidth;
        modelWrap.style.transition = '';
        modelWrap.style.transform = '';
      }

      if (lbClose) lbClose.focus({ preventScroll: true });
    };

    const closeLightbox = () => {
      if (!zoomed || !lbEl || !lbStage) return;
      zoomed = false;
      const modelWrap = /** @type {HTMLElement | null} */ (lbStage.querySelector('.rw__lb-model'));
      const figClone = modelWrap ? /** @type {HTMLElement | null} */ (modelWrap.querySelector('.rw__figure')) : null;
      const hero = heroes[index];
      const heroFig = hero ? /** @type {HTMLElement | null} */ (hero.querySelector('.rw__figure')) : null;

      if (!reducedMotion && modelWrap && figClone && heroFig) {
        const a = heroFig.getBoundingClientRect();
        const b = figClone.getBoundingClientRect();
        if (a.height > 0 && b.height > 0) {
          modelWrap.style.transformOrigin = '0 100%';
          modelWrap.style.transform = `translate3d(${a.left - b.left}px, ${a.bottom - b.bottom}px, 0) scale(${a.height / b.height})`;
        }
      }

      this.classList.remove('rw--zoom');
      lbEl.setAttribute('aria-hidden', 'true');
      hot(null);

      if (lbEl.contains(document.activeElement)) {
        stage.focus({ preventScroll: true });
      }

      window.clearTimeout(this._lbTimer);
      if (reducedMotion) {
        lbStage.textContent = '';
      } else {
        this._lbTimer = window.setTimeout(() => {
          if (!zoomed) lbStage.textContent = '';
        }, 950);
      }
    };

    const restartBar = () => {
      window.clearTimeout(this._autoTimer);
      ticks.forEach((t) => t.classList.remove('is-run'));
      if (!playing) return;
      if (ticksWrap) void ticksWrap.offsetWidth;
      const activeTick = ticks[index];
      if (activeTick) activeTick.classList.add('is-run');
      this._autoTimer = window.setTimeout(() => {
        if (playing && visible && !dragging && !document.hidden && !panelHover && !zoomed && !engaged && !this.closest('[hidden]')) {
          next();
        } else if (playing) {
          restartBar();
        }
      }, speed);
    };

    const play = (on) => {
      playing = Boolean(on);
      if (autoBtn) {
        autoBtn.classList.toggle('is-playing', playing);
        autoBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      }
      if (playing) {
        restartBar();
      } else {
        window.clearTimeout(this._autoTimer);
        ticks.forEach((t) => t.classList.remove('is-run'));
      }
    };

    const engage = () => {
      if (engaged) return;
      engaged = true;
      play(false);
    };

    const setIndex = (i, silent = false) => {
      const prevIdx = index;
      index = ((i % n) + n) % n;

      bodies.forEach((b, a) => {
        let k = 0;
        if (mode === 'ring') {
          k = ((a - Math.round(target)) % N + N) % N;
          if (k > N / 2) k -= N;
        } else {
          k = ((a - Math.round(target)) % N + N) % N;
        }
        const activeRange = mode === 'ring' ? (k !== 0 && Math.abs(k) <= 2) : (k >= 1 && k <= 3);
        if (activeRange) {
          b.el.removeAttribute('aria-hidden');
          if (b.hit) b.hit.tabIndex = 0;
        } else {
          b.el.setAttribute('aria-hidden', 'true');
          if (b.hit) b.hit.tabIndex = -1;
        }
      });

      if (silent) {
        this.style.setProperty('--rw-progress', ((index + 1) / n).toFixed(3));
        kick();
        return;
      }

      closeLightbox();
      closeSheet(false);

      this.style.setProperty('--rw-progress', ((index + 1) / n).toFixed(3));

      heroes.forEach((h, hi) => {
        const isOn = hi === index;
        h.classList.toggle('is-on', isOn);
        h.classList.toggle('was', !isOn && hi === prevIdx);
        h.setAttribute('aria-hidden', isOn ? 'false' : 'true');
        const zoomBtn = /** @type {HTMLButtonElement | null} */ (h.querySelector('[data-rw-zoom]'));
        if (zoomBtn) zoomBtn.tabIndex = isOn ? 0 : -1;
      });

      if (!reducedMotion) {
        stage.classList.remove('is-sweep');
        void stage.offsetWidth;
        stage.classList.add('is-sweep');
      }

      if (liveEl) {
        liveEl.textContent = heroes[index].dataset.label || '';
      }

      ticks.forEach((t, ti) => {
        t.setAttribute('aria-current', ti === index ? 'true' : 'false');
        t.classList.toggle('is-past', ti < index);
      });

      panels.forEach((p, pi) => {
        p.hidden = pi !== index;
        p.classList.remove('is-in');
      });

      const activePanel = panels[index];
      if (activePanel) {
        void activePanel.offsetWidth;
        activePanel.classList.add('is-in');
        const tpl = /** @type {HTMLTemplateElement | null} */ (activePanel.querySelector('template[data-rw-pieces-text]'));
        if (piecesEl && tpl) {
          piecesEl.textContent = tpl.content.textContent || tpl.innerHTML;
          piecesEl.classList.remove('is-swap');
          void piecesEl.offsetWidth;
          piecesEl.classList.add('is-swap');
        }
      }

      hot(null);
      restartBar();
      kick();
    };

    const moveTo = (T) => {
      target = T;
      setStill(false);
      setIndex(T, false);
    };

    const next = () => moveTo(Math.round(target) + 1);
    const prev = () => moveTo(Math.round(target) - 1);
    const go = (i) => {
      let d = ((i - index) % n + n) % n;
      if (d > n / 2) d -= n;
      moveTo(Math.round(target) + d);
    };

    const measure = () => {
      if (this.closest('[hidden]')) return;
      const wasMobile = isMobile;
      isMobile = window.innerWidth <= 749;
      mode = isMobile ? (this.dataset.mstyle || 'classic') : (this.dataset.style || 'ring');

      if (!isMobile && wasMobile) {
        closeSheet(false);
      }

      let frameH;
      if (!isMobile) {
        let headerH = 0;
        document.querySelectorAll('.shopify-section-group-header-group').forEach((el) => {
          if (!el.contains(this) && el instanceof HTMLElement) {
            const st = getComputedStyle(el);
            if (st.display !== 'none' && st.visibility !== 'hidden') {
              headerH += el.getBoundingClientRect().height;
            }
          }
        });
        frameH = Math.max(380, window.innerHeight - headerH);
      } else {
        if (window.innerWidth !== latchedW || Math.abs(window.innerHeight - latchedVh) >= 160) {
          latchedW = window.innerWidth;
          latchedVh = window.innerHeight;
        }
        frameH = Math.round(latchedVh * clamp(mheightVh, 50, 120) / 100);
      }

      this.style.setProperty('--rw-frame-h', `${Math.round(frameH)}px`);

      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;

      fs = mode === 'ring' ? 1.08 : 1;
      stage.style.setProperty('--rw-fs', String(fs));

      const modelH = mode === 'ring'
        ? Math.max(200, Math.round((H - 34 - 18) / 1.08))
        : Math.max(200, Math.round(H - (isMobile ? 24 : 36) - 18));
      stage.style.setProperty('--rw-model-h', `${modelH}px`);

      let hx;
      let hy;
      if (mode === 'ring') {
        hx = 0.5 * W;
        hy = 34;
        unit = Math.max(isMobile ? 90 : 120, 0.3 * W);
      } else {
        hx = (isMobile ? 0.3 : 0.4) * W;
        hy = isMobile ? 22 : 36;
        unit = Math.max(90, W * 0.32 * 1.6);
      }

      stage.style.setProperty('--rw-hx', `${hx.toFixed(1)}px`);
      stage.style.setProperty('--rw-hy', `${hy}px`);
      this.style.setProperty('--rw-ax', `${(W > 0 ? (hx / W) * 100 : 40).toFixed(2)}%`);

      for (const b of bodies) {
        b.w = b.el.offsetWidth || modelH * 0.5625;
      }

      if (wasMobile !== isMobile) {
        if (mode !== 'ring') {
          for (let a = 0; a < N; a++) {
            bodies[a].x = wrapN(a - target);
            bodies[a].g = bodies[a].x;
            bodies[a].v = 0;
            bodies[a].trip = false;
          }
        } else {
          cur = target;
          vel = 0;
        }
      }

      renderAll();
      kick();
    };

    this._measureFn = measure;
    measure();
    setIndex(0, true);

    const visObserver = new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) {
        kick();
        if (playing) restartBar();
      }
    }, { threshold: 0 });
    visObserver.observe(this);
    this._observers.push(visObserver);

    if (reducedMotion) {
      this.classList.add('is-revealed');
    } else {
      const revObserver = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          revObserver.disconnect();
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              this.classList.add('is-revealed');
            });
          });
        }
      }, { threshold: 0, rootMargin: '0px 0px -22% 0px' });
      revObserver.observe(this);
      this._observers.push(revObserver);
    }

    if (typeof ResizeObserver === 'function') {
      let roTimer = 0;
      const ro = new ResizeObserver(() => {
        window.clearTimeout(roTimer);
        roTimer = window.setTimeout(() => measure(), 50);
      });
      ro.observe(stage);
      this._observers.push(ro);
    }

    const onResize = () => {
      window.clearTimeout(this._resizeTimer);
      this._resizeTimer = window.setTimeout(measure, 120);
    };
    window.addEventListener('resize', onResize);
    this._cleanups.push(() => window.removeEventListener('resize', onResize));

    const onVisChange = () => {
      if (!document.hidden && visible) {
        kick();
        if (playing) restartBar();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    this._cleanups.push(() => document.removeEventListener('visibilitychange', onVisChange));

    const onReducedChange = (e) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        this.classList.add('is-revealed');
        play(false);
      }
    };
    reducedQuery.addEventListener('change', onReducedChange);
    this._cleanups.push(() => reducedQuery.removeEventListener('change', onReducedChange));

    // Pointer drag / swipe
    let pActive = false;
    let pId = -1;
    let pStartX = 0;
    let pStartY = 0;
    let pStartT = 0;
    let pAborted = false;
    /** @type {{x: number, time: number}[]} */
    let pSamples = [];

    stage.addEventListener('pointerdown', (e) => {
      if (zoomed) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pActive = true;
      pAborted = false;
      pId = e.pointerId;
      pStartX = e.clientX;
      pStartY = e.clientY;
      pStartT = target;
      pSamples = [{ x: e.clientX, time: performance.now() }];
    });

    stage.addEventListener('pointermove', (e) => {
      if (!pActive || e.pointerId !== pId || pAborted) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        finishDrag(e);
        return;
      }

      const dx = e.clientX - pStartX;
      const dy = e.clientY - pStartY;

      if (!dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          pAborted = true;
          pActive = false;
          return;
        }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          dragging = true;
          this.classList.add('is-dragging');
          setStill(false);
          try {
            stage.setPointerCapture(pId);
          } catch {
            // Ignore capture errors
          }
        } else {
          return;
        }
      }

      const now = performance.now();
      pSamples.push({ x: e.clientX, time: now });
      if (pSamples.length > 6) pSamples.shift();

      target = pStartT - dx / unit;
      kick();
    });

    const finishDrag = (e) => {
      if (!pActive || e.pointerId !== pId) return;
      pActive = false;
      if (!dragging) return;

      dragging = false;
      this.classList.remove('is-dragging');
      this._dragSuppressUntil = performance.now() + 60;

      try {
        if (stage.hasPointerCapture(pId)) stage.releasePointerCapture(pId);
      } catch {
        // Ignore
      }

      const dx = e.clientX - pStartX;
      const first = pSamples[0];
      const last = pSamples[pSamples.length - 1];
      const dt = last && first ? Math.max(1, last.time - first.time) : 1;
      const vx = last && first ? (last.x - first.x) / dt : 0;
      const sign = -1;
      const from = Math.round(pStartT);

      if (isMobile) {
        if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
          const dir = dx > 0 ? 1 : -1;
          moveTo(from + sign * dir);
        } else {
          moveTo(from);
        }
      } else {
        let i = Math.round(target + (sign * vx * 160) / unit);
        if (i === from && Math.abs(vx) > 0.3) {
          i = from + sign * (vx > 0 ? 1 : -1);
        }
        i = clamp(i, from - 2, from + 2);
        moveTo(i);
      }
    };

    stage.addEventListener('pointerup', finishDrag);
    stage.addEventListener('pointercancel', finishDrag);

    stage.addEventListener('click', (e) => {
      if (performance.now() < this._dragSuppressUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    let wheelAcc = 0;
    let wheelLock = false;
    stage.addEventListener('wheel', (e) => {
      if (zoomed) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 45) {
        if (wheelAcc > 0) next();
        else prev();
        wheelAcc = 0;
        wheelLock = true;
        window.clearTimeout(this._wheelTimer);
        this._wheelTimer = window.setTimeout(() => {
          wheelLock = false;
          wheelAcc = 0;
        }, 520);
      }
    }, { passive: false });

    stage.addEventListener('keydown', (e) => {
      if (zoomed) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    });

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._sheetHost) {
          e.preventDefault();
          closeSheet(true);
        } else if (zoomed) {
          e.preventDefault();
          closeLightbox();
        }
      }
    });

    if (panelEl) {
      panelEl.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') panelHover = true;
      });
      panelEl.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') {
          panelHover = false;
          if (playing) restartBar();
        }
      });

      panelEl.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('button, a, input, select, label')) {
          engage();
        }
      });
      panelEl.addEventListener('change', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.matches('input[data-rw-option]')) {
          engage();
          const card = t.closest('[data-rw-card]');
          if (card) syncCardOptions(card, true);
        }
      });

      panelEl.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-rw-card]'));
        if (card) {
          hot(card.getAttribute('data-rw-card'), false);
        }
      });
      panelEl.addEventListener('pointerout', (e) => {
        if (e.pointerType !== 'mouse') return;
        const card = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-rw-card]'));
        if (card && (!e.relatedTarget || !card.contains(/** @type {Node} */ (e.relatedTarget)))) {
          hot(null);
        }
      });
    }

    this.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement} */ (e.target);

      // 0. product inspection modal
      const modalTrigger = t.closest('[data-product-modal]');
      if (modalTrigger) {
        const pid = modalTrigger.getAttribute('data-product-modal');
        if (pid) openProductModal(pid);
        return;
      }

      // 1. pick-close
      if (t.closest('[data-rw-pick-close]')) {
        closeSheet(true);
        return;
      }

      // 2. popup close
      if (t.closest('[data-rw-zoom-close]')) {
        closeLightbox();
        return;
      }

      // 3. click popup backdrop
      if (zoomed && lbEl && lbEl.contains(t) && !t.closest('.rw__lb-model')) {
        closeLightbox();
        return;
      }

      // 4. zoom open
      if (t.closest('[data-rw-zoom]')) {
        openLightbox();
        return;
      }

      // 5. next
      if (t.closest('[data-rw-next]')) {
        next();
        return;
      }

      // 6. prev
      if (t.closest('[data-rw-prev]')) {
        prev();
        return;
      }

      // 7. tick
      const tickBtn = t.closest('[data-rw-tick]');
      if (tickBtn) {
        go(Number(tickBtn.getAttribute('data-rw-tick') || 0));
        return;
      }

      // 8. autoplay toggle
      if (t.closest('[data-rw-auto]')) {
        if (!playing) engaged = false;
        play(!playing);
        return;
      }

      // 9. pin
      const pinBtn = t.closest('[data-rw-pin]');
      if (pinBtn) {
        engage();
        hot(pinBtn.getAttribute('data-rw-pin'), true);
        return;
      }

      // 10. queue body
      const goBtn = t.closest('[data-rw-go]');
      if (goBtn) {
        const bodyEl = goBtn.closest('[data-rw-model]');
        const a = bodyEl instanceof HTMLElement ? allModelEls.indexOf(bodyEl) : -1;
        if (a >= 0) {
          let k = ((a - Math.round(target)) % N + N) % N;
          if (mode === 'ring' && k > N / 2) k -= N;
          if (k === 0) {
            openLightbox();
          } else if (Math.abs(k) < 6) {
            moveTo(Math.round(target) + k);
          }
        }
        return;
      }

      // 11. confirm size
      const confBtn = t.closest('[data-rw-confirm]');
      if (confBtn) {
        const card = confBtn.closest('[data-rw-card]');
        if (card) confirmCard(card);
        return;
      }

      // 12. plus button
      const addBtn = t.closest('[data-rw-add]');
      if (addBtn) {
        const card = addBtn.closest('[data-rw-card]');
        if (!card || card.classList.contains('is-added')) return;
        const directId = Number(card.getAttribute('data-variant-id') || 0);
        if (directId > 0) {
          confirmCard(card);
        } else if (card.classList.contains('is-picking')) {
          if (isMobile) closeSheet(true);
          else closeInlinePicker(card);
        } else {
          openPicker(card, true);
        }
        return;
      }

      // 13. add full look
      const allBtn = t.closest('[data-rw-all]');
      if (allBtn) {
        const panel = allBtn.closest('[data-rw-panel]');
        if (panel) addFullLook(panel);
      }
    });

    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fineHover) {
      if (cursorEl) cursorEl.remove();
    } else if (cursorEl) {
      this.classList.add('rw--cursor');
      let cx = 0;
      let cy = 0;
      let tx = 0;
      let ty = 0;
      let cursorOn = false;

      const tickCursor = () => {
        this._cursorRaf = 0;
        const f = reducedMotion ? 1 : 0.18;
        cx += (tx - cx) * f;
        cy += (ty - cy) * f;
        cursorEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
        if (Math.abs(tx - cx) >= 0.2 || Math.abs(ty - cy) >= 0.2) {
          this._cursorRaf = window.requestAnimationFrame(tickCursor);
        } else {
          cx = tx;
          cy = ty;
          cursorEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
        }
      };

      stage.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const sr = stage.getBoundingClientRect();
        tx = e.clientX - sr.left;
        ty = e.clientY - sr.top;

        if (!cursorOn) {
          cursorOn = true;
          cx = tx;
          cy = ty;
          cursorEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
          cursorEl.classList.add('is-on');
        }

        const t = /** @type {HTMLElement} */ (e.target);
        const overZoom = !dragging && Boolean(t.closest('.rw__zoom'));
        const overLink = !dragging && Boolean(t.closest('.rw__pin, .rw__hit'));
        cursorEl.classList.toggle('is-view', overZoom);
        cursorEl.classList.toggle('is-link', overLink);

        if (!this._cursorRaf) {
          this._cursorRaf = window.requestAnimationFrame(tickCursor);
        }
      });

      stage.addEventListener('pointerleave', () => {
        cursorOn = false;
        cursorEl.classList.remove('is-on', 'is-link', 'is-view');
      });
    }

    if (autoplayConfigured && !reducedMotion) {
      play(true);
    }
  }

  disconnectedCallback() {
    window.cancelAnimationFrame(this._raf);
    window.cancelAnimationFrame(this._cursorRaf);
    window.clearTimeout(this._autoTimer);
    window.clearTimeout(this._lbTimer);
    window.clearTimeout(this._resizeTimer);
    window.clearTimeout(this._wheelTimer);
    this._observers.forEach((o) => o.disconnect());
    this._cleanups.forEach((fn) => fn());
    if (this._sheetHost && this._openSheetCard) {
      const picker = this._sheetHost.querySelector('[data-rw-picker]');
      if (picker instanceof HTMLElement) {
        picker.hidden = true;
        this._openSheetCard.appendChild(picker);
      }
      this._sheetHost.remove();
      this._sheetHost = null;
      this._openSheetCard = null;
    }
  }
}

if (!customElements.get('runway-section')) {
  customElements.define('runway-section', RunwaySection);
}

/* ==========================================================================
   Explore All Leather Page Controller (/explore)
   ========================================================================== */

const exploreState = {
  category: 'All',
  leather: 'All',
  q: '',
  sort: 'featured',
};

const exploreGrid = document.getElementById('explore-grid');
const exploreEmpty = document.getElementById('explore-empty');
const exploreCount = document.getElementById('explore-count');
const exploreTabs = document.getElementById('explore-tabs');
const exploreSearch = /** @type {HTMLInputElement | null} */ (document.getElementById('explore-search'));
const exploreLeather = /** @type {HTMLSelectElement | null} */ (document.getElementById('explore-leather'));
const exploreSort = /** @type {HTMLSelectElement | null} */ (document.getElementById('explore-sort'));

async function loadExploreProducts() {
  if (!exploreGrid || !exploreEmpty || !exploreCount) return;

  const params = new URLSearchParams();
  if (exploreState.category !== 'All') params.set('category', exploreState.category);
  if (exploreState.leather !== 'All') params.set('leather', exploreState.leather);
  if (exploreState.q.trim()) params.set('q', exploreState.q.trim());
  if (exploreState.sort !== 'featured') params.set('sort', exploreState.sort);

  try {
    const data = await apiFetch(`/api/products?${params.toString()}`);
    const list = Array.isArray(data.products) ? data.products : [];

    exploreCount.textContent = `${list.length} ${list.length === 1 ? 'leather piece' : 'leather pieces'}`;
    exploreGrid.textContent = '';

    if (list.length === 0) {
      exploreEmpty.hidden = false;
      return;
    }

    exploreEmpty.hidden = true;

    for (const prod of list) {
      let chosenVariantId = prod.variants[0]?.id || 0;

      const card = document.createElement('article');
      card.className = 'explore-card';

      const mediaBtn = document.createElement('button');
      mediaBtn.type = 'button';
      mediaBtn.className = 'explore-card-media';
      mediaBtn.setAttribute('aria-label', `Inspect ${prod.name}`);
      mediaBtn.addEventListener('click', () => openProductModal(prod.id));

      const img = document.createElement('img');
      img.src = prod.image;
      img.alt = prod.name;
      img.loading = 'lazy';
      mediaBtn.appendChild(img);

      if (prod.tag) {
        const tag = document.createElement('span');
        tag.className = 'explore-card-tag';
        tag.textContent = prod.tag;
        mediaBtn.appendChild(tag);
      }

      const meta = document.createElement('div');
      meta.className = 'explore-card-meta';
      const typeSpan = document.createElement('span');
      typeSpan.className = 'explore-card-type';
      typeSpan.textContent = `${prod.category} · ${prod.leather}`;
      const priceSpan = document.createElement('span');
      priceSpan.className = 'explore-card-price';
      priceSpan.textContent = usd.format(prod.price);
      meta.appendChild(typeSpan);
      meta.appendChild(priceSpan);

      const titleBtn = document.createElement('button');
      titleBtn.type = 'button';
      titleBtn.className = 'explore-card-title';
      titleBtn.textContent = prod.name;
      titleBtn.addEventListener('click', () => openProductModal(prod.id));

      const desc = document.createElement('p');
      desc.className = 'explore-card-desc';
      desc.textContent = prod.description;

      const sizesRow = document.createElement('div');
      sizesRow.className = 'explore-card-sizes';
      prod.variants.forEach((v, idx) => {
        const sBtn = document.createElement('button');
        sBtn.type = 'button';
        sBtn.className = 'explore-size-btn';
        sBtn.textContent = v.o.join(' / ');
        sBtn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
        sBtn.disabled = !v.a;
        sBtn.addEventListener('click', () => {
          chosenVariantId = v.id;
          sizesRow.querySelectorAll('.explore-size-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          sBtn.setAttribute('aria-pressed', 'true');
        });
        sizesRow.appendChild(sBtn);
      });

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-primary';
      addBtn.style.width = '100%';
      addBtn.textContent = 'Add to Bag';
      addBtn.addEventListener('click', async () => {
        if (!chosenVariantId) return;
        addBtn.disabled = true;
        addBtn.textContent = 'Adding…';
        try {
          await bagInstance.add([{ id: chosenVariantId, quantity: 1 }]);
          addBtn.textContent = 'Added ✓';
          window.setTimeout(() => {
            addBtn.disabled = false;
            addBtn.textContent = 'Add to Bag';
          }, 1200);
        } catch (err) {
          addBtn.disabled = false;
          addBtn.textContent = 'Add to Bag';
          bagInstance.showToast(err instanceof Error ? err.message : 'Unable to add piece.');
        }
      });

      card.appendChild(mediaBtn);
      card.appendChild(meta);
      card.appendChild(titleBtn);
      card.appendChild(desc);
      card.appendChild(sizesRow);
      card.appendChild(addBtn);
      exploreGrid.appendChild(card);
    }
  } catch (err) {
    bagInstance.showToast(err instanceof Error ? err.message : 'Unable to load archive.');
  }
}

if (exploreTabs) {
  exploreTabs.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-category]'));
    if (!btn) return;
    exploreState.category = btn.getAttribute('data-category') || 'All';
    exploreTabs.querySelectorAll('.explore-tab').forEach((b) => {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    loadExploreProducts();
  });
}

let searchDebounce = 0;
if (exploreSearch) {
  exploreSearch.addEventListener('input', () => {
    exploreState.q = exploreSearch.value;
    window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(loadExploreProducts, 180);
  });
}

if (exploreLeather) {
  exploreLeather.addEventListener('change', () => {
    exploreState.leather = exploreLeather.value;
    loadExploreProducts();
  });
}

if (exploreSort) {
  exploreSort.addEventListener('change', () => {
    exploreState.sort = exploreSort.value;
    loadExploreProducts();
  });
}

/* ==========================================================================
   About & Leather Factory Controller (/about)
   ========================================================================== */

const factoryStagesEl = document.getElementById('factory-stages-list');
const inquiryForm = /** @type {HTMLFormElement | null} */ (document.getElementById('inquiry-form'));
const inquirySubmit = /** @type {HTMLButtonElement | null} */ (document.getElementById('inq-submit'));
const inquiryFeedback = document.getElementById('inq-feedback');

let factoryStagesRendered = false;

async function renderFactoryPage() {
  if (factoryStagesRendered || !factoryStagesEl) return;
  await ensureCatalogLoaded();
  const stages = catalogState.factory?.stages || [];
  if (stages.length === 0) return;

  factoryStagesEl.textContent = '';
  for (const st of stages) {
    const row = document.createElement('div');
    row.className = 'factory-stage-row';

    const num = document.createElement('div');
    num.className = 'factory-step-num';
    num.textContent = st.step;

    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'factory-stage-head';
    const h3 = document.createElement('h3');
    h3.textContent = st.title;
    const dur = document.createElement('span');
    dur.textContent = st.duration;
    head.appendChild(h3);
    head.appendChild(dur);

    const p = document.createElement('p');
    p.textContent = st.detail;

    const spec = document.createElement('div');
    spec.className = 'factory-stage-spec';
    spec.textContent = st.spec;

    body.appendChild(head);
    body.appendChild(p);
    body.appendChild(spec);
    row.appendChild(num);
    row.appendChild(body);
    factoryStagesEl.appendChild(row);
  }
  factoryStagesRendered = true;
}

if (inquiryForm && inquirySubmit && inquiryFeedback) {
  inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(inquiryForm);
    const payload = {
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      pieceType: String(fd.get('pieceType') || ''),
      hidePreference: String(fd.get('hidePreference') || ''),
      measurements: String(fd.get('measurements') || ''),
      message: String(fd.get('message') || ''),
    };

    inquirySubmit.disabled = true;
    inquirySubmit.textContent = 'Sending to Workshop…';
    inquiryFeedback.hidden = true;

    try {
      const data = await apiFetch('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      inquiryForm.reset();
      inquiryFeedback.hidden = false;
      inquiryFeedback.textContent = `Commission logged (${data.inquiry.id}). Our Shoreditch head cutter will respond to ${data.inquiry.email} within 1 business day.`;
      bagInstance.showToast('Workshop inquiry logged');
    } catch (err) {
      inquiryFeedback.hidden = false;
      inquiryFeedback.textContent = err instanceof Error ? err.message : 'Unable to send inquiry.';
    } finally {
      inquirySubmit.disabled = false;
      inquirySubmit.textContent = 'Submit Factory Inquiry';
    }
  });
}

/* ==========================================================================
   Final Checkout & Order Confirmation Controller (/checkout)
   ========================================================================== */

const checkoutWorkspace = document.getElementById('checkout-workspace');
const checkoutForm = /** @type {HTMLFormElement | null} */ (document.getElementById('checkout-form'));
const checkoutSummaryEl = document.getElementById('checkout-summary');
const checkoutSubmit = /** @type {HTMLButtonElement | null} */ (document.getElementById('checkout-submit'));
const checkoutError = document.getElementById('checkout-error');
const checkoutReceipt = document.getElementById('checkout-receipt');
const ordersHistoryEl = document.getElementById('orders-history');
const ordersHistoryList = document.getElementById('orders-history-list');

function getSelectedShippingMethod() {
  if (!checkoutForm) return 'standard';
  const checked = checkoutForm.querySelector('input[name="shippingMethod"]:checked');
  return checked instanceof HTMLInputElement && checked.value === 'express' ? 'express' : 'standard';
}

function renderCheckoutSummary() {
  if (!checkoutSummaryEl) return;
  const s = bagInstance.getSummary();
  const shippingMethod = getSelectedShippingMethod();
  const shippingFee = s.items.length > 0 && shippingMethod === 'express' ? 25 : 0;
  const grandTotal = Math.round((s.total + shippingFee) * 100) / 100;

  checkoutSummaryEl.textContent = '';

  if (s.items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'bag-note';
    empty.textContent = 'Your leather bag is currently empty. Add pieces from the Runway or Explore All Leather archive.';
    checkoutSummaryEl.appendChild(empty);

    const exploreLink = document.createElement('a');
    exploreLink.href = '/explore';
    exploreLink.setAttribute('data-link', '');
    exploreLink.className = 'btn-secondary';
    exploreLink.style.marginTop = '12px';
    exploreLink.textContent = 'Browse All Leather →';
    checkoutSummaryEl.appendChild(exploreLink);

    if (checkoutSubmit) {
      checkoutSubmit.disabled = true;
      checkoutSubmit.textContent = 'Confirm & Place Order';
    }
    return;
  }

  for (const item of s.items) {
    const row = document.createElement('div');
    row.className = 'bag-row';

    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name;
    row.appendChild(img);

    const info = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = item.name;
    const p = document.createElement('p');
    p.textContent = `${item.leather} · Size ${item.size} · ${usd.format(item.lineTotal)}`;
    info.appendChild(h3);
    info.appendChild(p);

    const qtyControls = document.createElement('div');
    qtyControls.className = 'bag-qty-controls';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'bag-qty-btn';
    minus.textContent = '−';
    minus.addEventListener('click', () => bagInstance.updateQuantity(item.variantId, item.quantity - 1));
    const qv = document.createElement('span');
    qv.className = 'bag-qty-val';
    qv.textContent = String(item.quantity);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'bag-qty-btn';
    plus.textContent = '+';
    plus.addEventListener('click', () => bagInstance.updateQuantity(item.variantId, item.quantity + 1));
    qtyControls.appendChild(minus);
    qtyControls.appendChild(qv);
    qtyControls.appendChild(plus);
    info.appendChild(qtyControls);
    row.appendChild(info);

    const rem = document.createElement('button');
    rem.type = 'button';
    rem.className = 'bag-remove';
    rem.setAttribute('aria-label', `Remove ${item.name}`);
    rem.textContent = '×';
    rem.addEventListener('click', () => bagInstance.remove(item.variantId));
    row.appendChild(rem);

    checkoutSummaryEl.appendChild(row);
  }

  const lines = document.createElement('div');
  lines.className = 'bag-summary-lines';

  const subLine = document.createElement('div');
  subLine.className = 'bag-summary-line';
  subLine.innerHTML = `<span>Pieces Subtotal</span><span>${usd.format(s.subtotal)}</span>`;
  lines.appendChild(subLine);

  if (s.bundleDiscount > 0) {
    const discLine = document.createElement('div');
    discLine.className = 'bag-summary-line';
    discLine.innerHTML = `<span>10% Look Set Savings (${s.matchedLooks[0] || 'Look'})</span><span>−${usd.format(s.bundleDiscount)}</span>`;
    lines.appendChild(discLine);
  }

  const shipLine = document.createElement('div');
  shipLine.className = 'bag-summary-line';
  shipLine.innerHTML = `<span>Atelier Dispatch (${shippingMethod === 'express' ? 'Express 48h' : 'Standard'})</span><span>${shippingFee === 0 ? 'Free' : usd.format(shippingFee)}</span>`;
  lines.appendChild(shipLine);

  const totLine = document.createElement('div');
  totLine.className = 'bag-summary-line is-total';
  totLine.innerHTML = `<span>Total Due</span><span>${usd.format(grandTotal)}</span>`;
  lines.appendChild(totLine);

  checkoutSummaryEl.appendChild(lines);

  if (checkoutSubmit) {
    checkoutSubmit.disabled = false;
    checkoutSubmit.textContent = `Confirm & Place Order — ${usd.format(grandTotal)}`;
  }
}

bagInstance.subscribe(() => {
  renderCheckoutSummary();
});

if (checkoutForm) {
  checkoutForm.addEventListener('change', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.getAttribute('name') === 'shippingMethod') {
      renderCheckoutSummary();
    }
  });
}

function downloadOrderReceiptTxt(order) {
  const lines = (order.items || []).map(
    (it) => `- ${it.name} (${it.leather}, Size ${it.size}) x${it.quantity} — ${usd.format(it.lineTotal)}`
  );
  const txt = [
    'STRIDE LONDON — OFFICIAL WORKSHOP ORDER RECEIPT',
    '14 Redchurch Street, Shoreditch, London E2 7DP',
    'atelier@stridelondon.com',
    '====================================================',
    `Order Number: ${order.orderNumber}`,
    `Status: ${order.status}`,
    `Factory Allocation: ${order.factoryStage}`,
    `Estimated Dispatch: ${order.estimatedDispatch}`,
    '',
    'CLIENT & DELIVERY',
    `${order.customer.fullName} · ${order.customer.email} · ${order.customer.phone}`,
    `${order.customer.address}, ${order.customer.city}, ${order.customer.postalCode}, ${order.customer.country}`,
    `Shipping: ${order.shippingMethod === 'express' ? 'Express 48h ($25.00)' : 'Standard Atelier Courier (Free)'}`,
    `Payment: ${order.paymentMethod === 'cod' ? 'White-Glove Courier Settlement' : 'Atelier Card / Direct Invoice'}`,
    '',
    'GARMENTS & LEATHER GOODS',
    ...lines,
    '',
    `Subtotal: ${usd.format(order.subtotal)}`,
    order.bundleDiscount > 0 ? `Look Bundle Savings: -${usd.format(order.bundleDiscount)}` : '',
    `Shipping: ${order.shippingFee === 0 ? 'Free' : usd.format(order.shippingFee)}`,
    `Total Paid / Authorized: ${usd.format(order.total)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${order.orderNumber}-stride-london-receipt.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showOrderReceipt(order) {
  if (!checkoutWorkspace || !checkoutReceipt) return;
  checkoutWorkspace.hidden = true;
  checkoutReceipt.hidden = false;
  checkoutReceipt.textContent = '';

  const header = document.createElement('div');
  header.className = 'receipt-header';

  const headLeft = document.createElement('div');
  const kicker = document.createElement('span');
  kicker.className = 'page-kicker';
  kicker.textContent = order.status;
  const h2 = document.createElement('h2');
  h2.className = 'page-title';
  h2.style.fontSize = '32px';
  h2.textContent = `Order ${order.orderNumber}`;
  headLeft.appendChild(kicker);
  headLeft.appendChild(h2);

  const headRight = document.createElement('div');
  headRight.style.display = 'flex';
  headRight.style.gap = '10px';
  headRight.style.flexWrap = 'wrap';

  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'btn-primary';
  dlBtn.textContent = 'Download Receipt (.txt)';
  dlBtn.addEventListener('click', () => downloadOrderReceiptTxt(order));

  const newOrderBtn = document.createElement('button');
  newOrderBtn.type = 'button';
  newOrderBtn.className = 'btn-secondary';
  newOrderBtn.textContent = 'New Order / Return';
  newOrderBtn.addEventListener('click', () => {
    checkoutReceipt.hidden = true;
    checkoutWorkspace.hidden = false;
    renderCheckoutSummary();
  });

  headRight.appendChild(dlBtn);
  headRight.appendChild(newOrderBtn);
  header.appendChild(headLeft);
  header.appendChild(headRight);

  const metaGrid = document.createElement('div');
  metaGrid.className = 'receipt-meta-grid';
  const cells = [
    ['Workshop Stage', order.factoryStage],
    ['Estimated Dispatch', order.estimatedDispatch],
    ['Ship To', `${order.customer.fullName}, ${order.customer.city} ${order.customer.postalCode}`],
    ['Order Total', usd.format(order.total)],
  ];
  for (const [label, val] of cells) {
    const cell = document.createElement('div');
    cell.className = 'receipt-meta-cell';
    const s = document.createElement('span');
    s.textContent = label;
    const st = document.createElement('strong');
    st.textContent = val;
    cell.appendChild(s);
    cell.appendChild(st);
    metaGrid.appendChild(cell);
  }

  const itemsWrap = document.createElement('div');
  itemsWrap.style.marginTop = '16px';
  for (const it of order.items || []) {
    const row = document.createElement('div');
    row.className = 'bag-row';
    const img = document.createElement('img');
    img.src = it.image;
    img.alt = it.name;
    const d = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = it.name;
    const p = document.createElement('p');
    p.textContent = `${it.leather} · Size ${it.size} · Quantity ${it.quantity}`;
    d.appendChild(title);
    d.appendChild(p);
    const priceDiv = document.createElement('div');
    priceDiv.style.fontVariantNumeric = 'tabular-nums';
    priceDiv.style.fontSize = '13px';
    priceDiv.textContent = usd.format(it.lineTotal);
    row.appendChild(img);
    row.appendChild(d);
    row.appendChild(priceDiv);
    itemsWrap.appendChild(row);
  }

  const footActions = document.createElement('div');
  footActions.style.display = 'flex';
  footActions.style.gap = '14px';
  footActions.style.marginTop = '28px';
  footActions.style.flexWrap = 'wrap';

  const toExplore = document.createElement('a');
  toExplore.href = '/explore';
  toExplore.setAttribute('data-link', '');
  toExplore.className = 'btn-secondary';
  toExplore.textContent = 'Continue Exploring Leather →';

  const toAbout = document.createElement('a');
  toAbout.href = '/about';
  toAbout.setAttribute('data-link', '');
  toAbout.className = 'btn-secondary';
  toAbout.textContent = 'Read Shoreditch Factory Guide';

  footActions.appendChild(toExplore);
  footActions.appendChild(toAbout);

  checkoutReceipt.appendChild(header);
  checkoutReceipt.appendChild(metaGrid);
  checkoutReceipt.appendChild(itemsWrap);
  checkoutReceipt.appendChild(footActions);
}

async function loadOrderHistory() {
  if (!ordersHistoryEl || !ordersHistoryList) return;
  try {
    const data = await apiFetch('/api/orders');
    const orders = Array.isArray(data.orders) ? data.orders : [];
    if (orders.length === 0) {
      ordersHistoryEl.hidden = true;
      return;
    }

    ordersHistoryEl.hidden = false;
    ordersHistoryList.textContent = '';

    for (const ord of orders.slice(0, 6)) {
      const card = document.createElement('div');
      card.className = 'order-history-card';

      const k = document.createElement('span');
      k.className = 'page-kicker';
      k.style.marginBottom = '2px';
      k.textContent = ord.estimatedDispatch;

      const num = document.createElement('strong');
      num.style.fontSize = '15px';
      num.textContent = ord.orderNumber;

      const meta = document.createElement('span');
      meta.style.fontSize = '12px';
      meta.style.color = '#66625c';
      meta.textContent = `${ord.items.length} piece(s) · ${usd.format(ord.total)}`;

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.textContent = 'Open Receipt →';
      viewBtn.addEventListener('click', () => {
        showOrderReceipt(ord);
        checkoutReceipt?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      card.appendChild(k);
      card.appendChild(num);
      card.appendChild(meta);
      card.appendChild(viewBtn);
      ordersHistoryList.appendChild(card);
    }
  } catch {
    // Keep silent on history fetch errors
  }
}

if (checkoutForm && checkoutSubmit && checkoutError) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    checkoutError.hidden = true;
    const fd = new FormData(checkoutForm);

    const payload = {
      customer: {
        fullName: String(fd.get('fullName') || ''),
        email: String(fd.get('email') || ''),
        phone: String(fd.get('phone') || ''),
        address: String(fd.get('address') || ''),
        city: String(fd.get('city') || ''),
        postalCode: String(fd.get('postalCode') || ''),
        country: String(fd.get('country') || 'United Kingdom'),
      },
      shippingMethod: String(fd.get('shippingMethod') || 'standard'),
      paymentMethod: String(fd.get('paymentMethod') || 'card'),
      notes: String(fd.get('notes') || ''),
    };

    checkoutSubmit.disabled = true;
    checkoutSubmit.textContent = 'Allocating to Workshop…';

    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      bagInstance.setSummary(res.bag);
      showOrderReceipt(res.order);
      await loadOrderHistory();
      bagInstance.showToast(`Order ${res.order.orderNumber} confirmed`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      checkoutError.hidden = false;
      checkoutError.textContent = err instanceof Error ? err.message : 'Unable to place order.';
      renderCheckoutSummary();
    }
  });
}

/* ==========================================================================
   SPA Router (/, /explore, /about, /checkout)
   ========================================================================== */

const pageSections = {
  runway: /** @type {HTMLElement | null} */ (document.querySelector('[data-page="runway"]')),
  explore: /** @type {HTMLElement | null} */ (document.querySelector('[data-page="explore"]')),
  about: /** @type {HTMLElement | null} */ (document.querySelector('[data-page="about"]')),
  checkout: /** @type {HTMLElement | null} */ (document.querySelector('[data-page="checkout"]')),
};
const siteFooter = document.getElementById('site-footer');

function resolveRoute(pathname) {
  if (pathname === '/explore') return 'explore';
  if (pathname === '/about') return 'about';
  if (pathname === '/checkout') return 'checkout';
  return 'runway';
}

function applyRoute(urlStr) {
  const url = new URL(urlStr, window.location.origin);
  const page = resolveRoute(url.pathname);

  Object.entries(pageSections).forEach(([key, sec]) => {
    if (sec) sec.hidden = key !== page;
  });

  if (siteFooter) {
    siteFooter.hidden = page === 'runway';
  }

  document.querySelectorAll('.site-header nav a[data-link]').forEach((a) => {
    const href = a.getAttribute('href') || '/';
    const linkPage = resolveRoute(href);
    a.setAttribute('aria-current', linkPage === page ? 'page' : 'false');
  });

  if (page === 'runway') {
    const rw = document.querySelector('runway-section');
    if (rw && typeof /** @type {any} */ (rw).refreshLayout === 'function') {
      /** @type {any} */ (rw).refreshLayout();
    }
  } else if (page === 'explore') {
    const catParam = url.searchParams.get('category');
    if (catParam && exploreTabs) {
      exploreState.category = catParam;
      exploreTabs.querySelectorAll('.explore-tab').forEach((b) => {
        b.setAttribute('aria-pressed', b.getAttribute('data-category') === catParam ? 'true' : 'false');
      });
    }
    loadExploreProducts();
  } else if (page === 'about') {
    renderFactoryPage();
  } else if (page === 'checkout') {
    if (checkoutWorkspace && checkoutReceipt && checkoutReceipt.hidden === false) {
      // If coming back to checkout with items in bag, show form workspace cleanly
      if (bagInstance.getSummary().items.length > 0) {
        checkoutReceipt.hidden = true;
        checkoutWorkspace.hidden = false;
      }
    }
    bagInstance.refresh().then(() => renderCheckoutSummary());
    loadOrderHistory();
  }
}

/**
 * @param {string} targetUrl
 */
function navigateTo(targetUrl) {
  const url = new URL(targetUrl, window.location.origin);
  if (url.href !== window.location.href) {
    window.history.pushState({}, '', url.pathname + url.search);
  }
  applyRoute(url.href);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

document.addEventListener('click', (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  const link = target.closest('a[data-link]');
  if (!(link instanceof HTMLAnchorElement)) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigateTo(link.getAttribute('href') || '/');
});

window.addEventListener('popstate', () => {
  applyRoute(window.location.href);
});

// Initialize starting route & catalog cache
ensureCatalogLoaded();
applyRoute(window.location.href);
