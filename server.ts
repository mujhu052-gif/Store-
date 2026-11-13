import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import {
  BRAND_INFO,
  FACTORY_IMAGES,
  FACTORY_STAGES,
  LOOKS,
  PRODUCTS,
} from './src/data/catalog.ts';
import type { ProductItem, ProductVariant } from './src/data/catalog.ts';

interface BagEntry {
  id: number;
  quantity: number;
}

interface OrderItemSnapshot {
  variantId: number;
  productId: string;
  name: string;
  category: string;
  leather: string;
  size: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface OrderRecord {
  orderNumber: string;
  sessionId: string;
  createdAt: string;
  status: string;
  factoryStage: string;
  estimatedDispatch: string;
  customer: OrderCustomer;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'card' | 'cod';
  notes: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  bundleDiscount: number;
  matchedLooks: string[];
  shippingFee: number;
  total: number;
}

interface InquiryRecord {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  pieceType: string;
  hidePreference: string;
  measurements: string;
  message: string;
}

interface StoreData {
  sessions: Record<string, { bag: BagEntry[] }>;
  orders: OrderRecord[];
  inquiries: InquiryRecord[];
  productsOverride?: ProductItem[];
  brandOverride?: typeof BRAND_INFO & { logoUrl?: string };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let variantLookup = new Map<number, { item: ProductItem; variant: ProductVariant }>();

function rebuildVariantLookup() {
  variantLookup.clear();
  const prods = getActiveProducts();
  for (const item of prods) {
    for (const variant of item.variants) {
      variantLookup.set(variant.id, { item, variant });
    }
  }
}

function getActiveProducts(): ProductItem[] {
  if (Array.isArray(store.productsOverride) && store.productsOverride.length > 0) {
    return store.productsOverride;
  }
  return PRODUCTS;
}

function getActiveBrand() {
  return {
    ...BRAND_INFO,
    logoUrl: store.brandOverride?.logoUrl || '',
    ...(store.brandOverride || {}),
  };
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : [],
        productsOverride: Array.isArray(parsed.productsOverride) ? parsed.productsOverride : undefined,
        brandOverride: parsed.brandOverride && typeof parsed.brandOverride === 'object' ? parsed.brandOverride : undefined,
      };
    }
  } catch {
    // Fallback to clean store
  }
  return { sessions: {}, orders: [], inquiries: [] };
}

let store: StoreData = loadStore();
rebuildVariantLookup();

function persistStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function getSessionId(req: Request): string {
  const raw = req.header('x-session-id') || 'default-session';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'default-session';
}

function getSessionBag(sessionId: string): BagEntry[] {
  if (!store.sessions[sessionId]) {
    store.sessions[sessionId] = { bag: [] };
  }
  return store.sessions[sessionId].bag;
}

function buildBagSummary(sessionId: string) {
  const prods = getActiveProducts();
  const entries = getSessionBag(sessionId).filter((e) => variantLookup.has(e.id));
  const items: OrderItemSnapshot[] = [];
  const productIdsInBag = new Set<string>();
  let subtotal = 0;
  let totalQuantity = 0;

  for (const entry of entries) {
    const hit = variantLookup.get(entry.id);
    if (!hit) continue;
    const lineTotal = hit.item.price * entry.quantity;
    subtotal += lineTotal;
    totalQuantity += entry.quantity;
    productIdsInBag.add(hit.item.id);
    items.push({
      variantId: entry.id,
      productId: hit.item.id,
      name: hit.item.name,
      category: hit.item.category,
      leather: hit.item.leather,
      size: hit.variant.o.join(' / '),
      image: hit.item.image,
      unitPrice: hit.item.price,
      quantity: entry.quantity,
      lineTotal,
    });
  }

  const matchedLooks: string[] = [];
  let bundleDiscount = 0;
  for (const look of LOOKS) {
    if (look.products.every((pid) => productIdsInBag.has(pid))) {
      matchedLooks.push(look.name);
      const lookSum = look.products.reduce((acc, pid) => {
        const prod = prods.find((p) => p.id === pid);
        return acc + (prod ? prod.price : 0);
      }, 0);
      bundleDiscount = Math.max(bundleDiscount, Math.round(lookSum * 0.1 * 100) / 100);
    }
  }

  const total = Math.max(0, Math.round((subtotal - bundleDiscount) * 100) / 100);

  return {
    sessionId,
    entries,
    items,
    subtotal,
    bundleDiscount,
    matchedLooks,
    total,
    totalQuantity,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/src/assets/images',
    express.static(path.resolve(process.cwd(), 'src/assets/images'), {
      maxAge: '7d',
    })
  );

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, brand: getActiveBrand().name });
  });

  // Full Catalog + Factory + Looks
  app.get('/api/catalog', (_req: Request, res: Response) => {
    res.json({
      brand: getActiveBrand(),
      products: getActiveProducts(),
      looks: LOOKS,
      factory: {
        images: FACTORY_IMAGES,
        stages: FACTORY_STAGES,
      },
    });
  });

  // Filtered Products for Explore All page
  app.get('/api/products', (req: Request, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const leather = typeof req.query.leather === 'string' ? req.query.leather.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'featured';

    let list = getActiveProducts().slice();

    if (category && category !== 'All') {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (leather && leather !== 'All') {
      list = list.filter((p) => p.leather.toLowerCase() === leather.toLowerCase());
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.leather.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.specs.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (sort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    }

    res.json({
      total: list.length,
      products: list,
      categories: ['All', 'Jackets', 'Coats', 'Bags', 'Footwear', 'Small Goods'],
      leathers: ['All', 'Lambskin', 'Calfskin', 'Shearling', 'Bridle'],
    });
  });

  // Bag endpoints
  app.get('/api/bag', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    res.json(buildBagSummary(sessionId));
  });

  app.post('/api/bag/items', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const body = req.body as { items?: Array<{ id: number; quantity?: number }> };

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Please select at least one piece.' });
      return;
    }

    for (const reqItem of body.items) {
      const vid = Number(reqItem?.id);
      const hit = variantLookup.get(vid);
      if (!hit || !hit.variant.a) {
        res.status(400).json({ error: 'Please choose an available size.' });
        return;
      }
    }

    const bag = getSessionBag(sessionId);
    for (const reqItem of body.items) {
      const vid = Number(reqItem.id);
      const qty = Math.max(1, Math.min(20, Math.round(Number(reqItem.quantity) || 1)));
      const existing = bag.find((e) => e.id === vid);
      if (existing) {
        existing.quantity = Math.min(20, existing.quantity + qty);
      } else if (bag.length < 50) {
        bag.push({ id: vid, quantity: qty });
      }
    }

    persistStore();
    res.json(buildBagSummary(sessionId));
  });

  app.patch('/api/bag/items/:variantId', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const variantId = Number(req.params.variantId);
    const qty = Math.round(Number((req.body as { quantity?: number })?.quantity ?? 1));

    const bag = getSessionBag(sessionId);
    const idx = bag.findIndex((e) => e.id === variantId);
    if (idx === -1) {
      res.status(404).json({ error: 'Item not found in bag.' });
      return;
    }

    if (qty <= 0) {
      bag.splice(idx, 1);
    } else {
      bag[idx].quantity = Math.min(20, qty);
    }

    persistStore();
    res.json(buildBagSummary(sessionId));
  });

  app.delete('/api/bag/items/:variantId', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const variantId = Number(req.params.variantId);
    if (!store.sessions[sessionId]) {
      res.json(buildBagSummary(sessionId));
      return;
    }
    store.sessions[sessionId].bag = store.sessions[sessionId].bag.filter(
      (e) => e.id !== variantId
    );
    persistStore();
    res.json(buildBagSummary(sessionId));
  });

  app.delete('/api/bag', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    store.sessions[sessionId] = { bag: [] };
    persistStore();
    res.json(buildBagSummary(sessionId));
  });

  // Orders (Checkout / Final Page)
  app.post('/api/orders', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const summary = buildBagSummary(sessionId);

    if (summary.items.length === 0) {
      res.status(400).json({ error: 'Your styling bag is empty.' });
      return;
    }

    const body = req.body as {
      customer?: Partial<OrderCustomer>;
      shippingMethod?: 'standard' | 'express';
      paymentMethod?: 'card' | 'cod';
      notes?: string;
    };

    const c = body?.customer || {};
    const fullName = String(c.fullName || '').trim();
    const email = String(c.email || '').trim();
    const phone = String(c.phone || '').trim();
    const address = String(c.address || '').trim();
    const city = String(c.city || '').trim();
    const postalCode = String(c.postalCode || '').trim();
    const country = String(c.country || 'United Kingdom').trim();

    if (!fullName || !email || !phone || !address || !city || !postalCode) {
      res.status(400).json({
        error: 'Please complete all required delivery fields (name, email, phone, address, city, postal code).',
      });
      return;
    }

    const shippingMethod = body.shippingMethod === 'express' ? 'express' : 'standard';
    const paymentMethod = body.paymentMethod === 'cod' ? 'cod' : 'card';
    const shippingFee = shippingMethod === 'express' ? 25 : 0;
    const total = Math.round((summary.total + shippingFee) * 100) / 100;

    const seq = 1040 + store.orders.length + 1;
    const year = new Date().getFullYear();
    const orderNumber = `SL-${year}-${seq}`;

    const dispatchDate = new Date(Date.now() + (shippingMethod === 'express' ? 2 : 5) * 86400000)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const order: OrderRecord = {
      orderNumber,
      sessionId,
      createdAt: new Date().toISOString(),
      status: 'Confirmed — Allocated to Shoreditch Workshop',
      factoryStage: 'Beeswax Conditioning & 48-Point Quality Inspection',
      estimatedDispatch: dispatchDate,
      customer: { fullName, email, phone, address, city, postalCode, country },
      shippingMethod,
      paymentMethod,
      notes: String(body.notes || '').trim(),
      items: summary.items,
      subtotal: summary.subtotal,
      bundleDiscount: summary.bundleDiscount,
      matchedLooks: summary.matchedLooks,
      shippingFee,
      total,
    };

    store.orders.unshift(order);
    store.sessions[sessionId] = { bag: [] };
    persistStore();

    res.status(201).json({
      order,
      bag: buildBagSummary(sessionId),
    });
  });

  app.get('/api/orders', (req: Request, res: Response) => {
    const sessionId = getSessionId(req);
    const list = store.orders.filter((o) => o.sessionId === sessionId);
    res.json({ orders: list });
  });

  app.get('/api/orders/:orderNumber', (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const found = store.orders.find((o) => o.orderNumber === orderNumber);
    if (!found) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    res.json({ order: found });
  });

  // Bespoke Leather / Factory Inquiry
  app.post('/api/inquiries', (req: Request, res: Response) => {
    const body = req.body as Partial<InquiryRecord>;
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim();
    const pieceType = String(body?.pieceType || 'Bespoke Leather Jacket').trim();
    const hidePreference = String(body?.hidePreference || 'Full-Grain Lambskin').trim();
    const measurements = String(body?.measurements || '').trim();
    const message = String(body?.message || '').trim();

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Please provide your name, email, and project details.' });
      return;
    }

    const inquiry: InquiryRecord = {
      id: `INQ-${200 + store.inquiries.length + 1}`,
      createdAt: new Date().toISOString(),
      name,
      email,
      pieceType,
      hidePreference,
      measurements,
      message,
    };

    store.inquiries.unshift(inquiry);
    persistStore();
    res.status(201).json({ inquiry });
  });

  // ==========================================
  // Admin Endpoints (/admin)
  // ==========================================
  app.get('/api/admin/data', (_req: Request, res: Response) => {
    res.json({
      brand: getActiveBrand(),
      products: getActiveProducts(),
      orders: store.orders,
      inquiries: store.inquiries,
    });
  });

  app.put('/api/admin/products', (req: Request, res: Response) => {
    const body = req.body as { products?: ProductItem[] };
    if (!body || !Array.isArray(body.products)) {
      res.status(400).json({ error: 'Invalid products payload.' });
      return;
    }
    store.productsOverride = body.products;
    rebuildVariantLookup();
    persistStore();
    res.json({ success: true, products: getActiveProducts() });
  });

  app.patch('/api/admin/orders/:orderNumber', (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    const body = req.body as { status?: string; factoryStage?: string };
    const order = store.orders.find((o) => o.orderNumber === orderNumber);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    if (typeof body.status === 'string') order.status = body.status.trim();
    if (typeof body.factoryStage === 'string') order.factoryStage = body.factoryStage.trim();
    persistStore();
    res.json({ success: true, order });
  });

  app.delete('/api/admin/orders/:orderNumber', (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber || '').trim();
    store.orders = store.orders.filter((o) => o.orderNumber !== orderNumber);
    persistStore();
    res.json({ success: true, orders: store.orders });
  });

  app.delete('/api/admin/inquiries/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    store.inquiries = store.inquiries.filter((i) => i.id !== id);
    persistStore();
    res.json({ success: true, inquiries: store.inquiries });
  });

  app.put('/api/admin/brand', (req: Request, res: Response) => {
    const body = req.body as { name?: string; tagline?: string; email?: string; phone?: string; address?: string; logoUrl?: string };
    store.brandOverride = {
      ...BRAND_INFO,
      name: String(body.name || BRAND_INFO.name),
      tagline: String(body.tagline || BRAND_INFO.tagline),
      email: String(body.email || BRAND_INFO.email),
      phone: String(body.phone || BRAND_INFO.phone),
      address: String(body.address || BRAND_INFO.address),
      logoUrl: String(body.logoUrl || getActiveBrand().logoUrl || ''),
    };
    persistStore();
    res.json({ success: true, brand: getActiveBrand() });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STRIDE LONDON server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
