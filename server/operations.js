import { randomBytes } from 'node:crypto';
import express from 'express';
import { businessTypes } from '../shared/business-modules.js';
import { getIndustryWorkflow, nextIndustryStatus } from '../shared/industry-workflows.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paymentMethods = new Set(['Tunai', 'Transfer', 'QRIS', 'Kartu', 'Hutang', 'Midtrans']);
const purchaseMovements = new Set(['purchase', 'return']);
const publicOrderLimits = new Map();

function respondError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  return res.status(400).json({ message: error.message || 'Data operasional tidak valid.' });
}

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function normalizeDetails(businessType, details) {
  const workflow = getIndustryWorkflow(businessType);
  if (!workflow || !details || typeof details !== 'object' || Array.isArray(details)) {
    throw invalid('Detail alur usaha tidak valid.');
  }
  const normalized = {};
  for (const field of workflow.fields) {
    const raw = details[field.id];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) throw invalid(`${field.label} wajib diisi.`);
      continue;
    }
    if (field.type === 'text' || field.type === 'textarea') {
      if (typeof raw !== 'string' || raw.trim().length > (field.type === 'textarea' ? 1000 : 200)) {
        throw invalid(`${field.label} tidak valid.`);
      }
      normalized[field.id] = raw.trim();
    } else if (field.type === 'select') {
      if (typeof raw !== 'string' || !field.options.includes(raw)) throw invalid(`${field.label} tidak valid.`);
      normalized[field.id] = raw;
    } else if (field.type === 'date') {
      if (!validDate(raw)) throw invalid(`${field.label} tidak valid.`);
      normalized[field.id] = raw;
    } else if (field.type === 'number') {
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0 || number > 1000000000) {
        throw invalid(`${field.label} harus berupa angka yang valid.`);
      }
      normalized[field.id] = number;
    }
  }
  for (const key of Object.keys(details)) {
    if (!workflow.fields.some((field) => field.id === key)) throw invalid('Detail usaha berisi kolom yang tidak dikenal.');
  }
  return normalized;
}

function normalizeProduct(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const sku = typeof body.sku === 'string' ? body.sku.trim() : '';
  const itemType = body.itemType === 'service' ? 'service' : 'product';
  const costPrice = Number(body.costPrice);
  const sellingPrice = Number(body.sellingPrice);
  const stock = Number(body.stock ?? 0);
  const minimumStock = Number(body.minimumStock ?? 0);
  if (!name || name.length > 160 || !unit || unit.length > 30
    || sku.length > 80
    || !Number.isSafeInteger(costPrice) || costPrice < 0
    || !Number.isSafeInteger(sellingPrice) || sellingPrice < 0
    || !Number.isFinite(stock) || stock < 0
    || !Number.isFinite(minimumStock) || minimumStock < 0) {
    throw invalid('Nama, satuan, harga, dan stok produk tidak valid.');
  }
  return {
    name,
    unit,
    sku: sku || null,
    category: typeof body.category === 'string' ? body.category.trim().slice(0, 80) : null,
    itemType,
    costPrice,
    sellingPrice,
    stock,
    minimumStock,
    stockTracked: itemType === 'product' && body.stockTracked !== false,
    details: body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details : {},
  };
}

function orderNumber(type) {
  const prefix = type.toUpperCase().replaceAll('_', '').slice(0, 3);
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function insertCustomer(client, companyId, name, phone) {
  if (!phone) return null;
  const result = await client.query(
    `INSERT INTO business_customers (company_id, name, phone)
     VALUES ($1, $2, $3)
     ON CONFLICT (company_id, phone) WHERE phone IS NOT NULL AND phone <> ''
     DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [companyId, name, phone],
  );
  return result.rows[0].id;
}

async function loadOrderItems(client, companyId, requestedItems) {
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 100) {
    throw invalid('Pilih antara 1 sampai 100 produk atau layanan.');
  }
  const combined = new Map();
  for (const item of requestedItems) {
    if (!uuidPattern.test(String(item.productId || ''))) throw invalid('Produk yang dipilih tidak valid.');
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw invalid('Jumlah produk tidak valid.');
    combined.set(item.productId, (combined.get(item.productId) || 0) + quantity);
  }
  const products = [];
  for (const [productId, quantity] of combined) {
    const result = await client.query(
      `SELECT id, name, unit, selling_price, stock, stock_tracked, item_type
       FROM business_products
       WHERE id = $1 AND company_id = $2 AND active = true
       FOR UPDATE`,
      [productId, companyId],
    );
    if (!result.rowCount) throw invalid('Produk tidak ditemukan atau sudah dinonaktifkan.', 404);
    const product = result.rows[0];
    if (product.stock_tracked && Number(product.stock) < quantity) {
      throw invalid(`Stok ${product.name} tidak mencukupi.`);
    }
    const unitPrice = Number(product.selling_price);
    products.push({
      product,
      quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * quantity),
    });
  }
  return products;
}

async function adjustProductStock(client, companyId, userId, product, quantity, type, reference, note) {
  const result = await client.query(
    `UPDATE business_products
     SET stock = stock + $1, updated_at = now()
     WHERE id = $2 AND company_id = $3 AND stock + $1 >= 0
     RETURNING id`,
    [quantity, product.id, companyId],
  );
  if (!result.rowCount) throw invalid(`Stok ${product.name} tidak mencukupi.`);
  await client.query(
    `INSERT INTO inventory_movements
       (company_id, product_id, created_by, movement_type, quantity, reference, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [companyId, product.id, userId, type, quantity, reference || null, note || null],
  );
}

async function createOrder(client, { companyId, branchId, userId, businessType, body, defaultDetails = {} }) {
  const workflow = getIndustryWorkflow(businessType);
  if (!workflow) throw invalid('Jenis usaha workspace tidak didukung.', 403);
  if (!uuidPattern.test(String(branchId || ''))) throw invalid('Akun belum ditetapkan ke cabang.', 403);
  const activeBranch = await client.query(
    'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
    [branchId, companyId],
  );
  if (!activeBranch.rowCount) throw invalid('Cabang tidak ditemukan atau sudah dinonaktifkan.', 403);
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  if (!customerName || customerName.length > 160 || customerPhone.length > 30) {
    throw invalid('Nama pelanggan wajib diisi dan nomor kontak harus valid.');
  }
  const details = normalizeDetails(businessType, { ...defaultDetails, ...(body.details || {}) });
  const lineItems = await loadOrderItems(client, companyId, body.items);
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = Number(body.discount || 0);
  const tax = Number(body.tax || 0);
  const serviceCharge = Number(body.serviceCharge || 0);
  if (![discount, tax, serviceCharge].every((amount) => Number.isSafeInteger(amount) && amount >= 0)
    || discount > subtotal) throw invalid('Diskon, pajak, atau service charge tidak valid.');
  const total = subtotal - discount + tax + serviceCharge;
  if (!Number.isSafeInteger(total)) throw invalid('Total transaksi di luar batas yang diizinkan.');
  const customerId = await insertCustomer(client, companyId, customerName, customerPhone);
  const reference = orderNumber(businessType);
  const status = workflow.initialStatus;
  const paymentTiming = typeof body.paymentTiming === 'string' ? body.paymentTiming.slice(0, 40) : null;
  const orderResult = await client.query(
    `INSERT INTO business_orders
       (company_id, branch_id, created_by, business_type, order_number, order_type, status,
        payment_timing, customer_id, customer_name, customer_phone, subtotal,
        discount, tax, service_charge, total, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id, order_number, status, payment_status, total, created_at`,
    [companyId, branchId, userId, businessType, reference, workflow.orderLabel, status,
      paymentTiming, customerId, customerName, customerPhone, subtotal,
      discount, tax, serviceCharge, total, JSON.stringify(details)],
  );
  const order = orderResult.rows[0];
  let stockReserved = false;
  for (const item of lineItems) {
    await client.query(
      `INSERT INTO business_order_items
         (company_id, order_id, product_id, item_name, unit, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [companyId, order.id, item.product.id, item.product.name, item.product.unit,
        item.quantity, item.unitPrice, item.lineTotal],
    );
    if (item.product.stock_tracked) {
      await adjustProductStock(client, companyId, userId, item.product, -item.quantity, 'sale', reference, 'Order dibuat.');
      stockReserved = true;
    }
  }
  if (stockReserved) {
    await client.query('UPDATE business_orders SET stock_reserved = true WHERE id = $1 AND company_id = $2', [order.id, companyId]);
  }
  const initialPayment = Number(body.initialPayment || 0);
  if (!Number.isSafeInteger(initialPayment) || initialPayment < 0 || initialPayment > total) {
    throw invalid('Jumlah pembayaran awal tidak valid.');
  }
  if (initialPayment > 0) {
    if (!paymentMethods.has(body.paymentMethod)) throw invalid('Metode pembayaran tidak valid.');
    await client.query(
      `INSERT INTO business_payments (company_id, order_id, created_by, payment_method, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, order.id, userId, body.paymentMethod, initialPayment],
    );
    await client.query(
      `UPDATE business_orders SET payment_status = $1 WHERE id = $2 AND company_id = $3`,
      [initialPayment === total ? 'paid' : 'partial', order.id, companyId],
    );
  }
  return { ...order, payment_status: initialPayment === 0 ? order.payment_status : initialPayment === total ? 'paid' : 'partial', subtotal, discount, tax, serviceCharge, details, items: lineItems.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    unit: item.product.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.lineTotal,
  })) };
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function rateLimitPublicOrder(req) {
  const key = `${req.ip}:${req.params.companyId}`;
  const now = Date.now();
  const previous = publicOrderLimits.get(key);
  if (previous && previous.resetAt > now && previous.count >= 8) return false;
  publicOrderLimits.set(key, previous && previous.resetAt > now
    ? { count: previous.count + 1, resetAt: previous.resetAt }
    : { count: 1, resetAt: now + 5 * 60 * 1000 });
  return true;
}

function operationalBranchScope(req) {
  if (['OWNER', 'SUPER ADMIN', 'HRD'].includes(req.user.role)) return null;
  if (!req.user.branch_id) throw invalid('Akun belum ditetapkan ke cabang.', 403);
  return req.user.branch_id;
}

export function createOperationsRouter({ pool, authenticate, requireTenant, requireActiveTenant, requireRole }) {
  const router = express.Router();
  const staffRoles = ['OWNER', 'SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'KASIR', 'SALES'];
  const managerRoles = ['OWNER', 'SUPER ADMIN', 'HRD', 'ADMIN'];
  const workspaceStructureRoles = ['OWNER', 'SUPER ADMIN'];

  router.get('/modules', authenticate, requireTenant, requireActiveTenant, requireRole(...workspaceStructureRoles), async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT business_type AS "businessType", modules FROM companies WHERE id = $1',
        [req.user.company_id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.put('/modules', authenticate, requireTenant, requireActiveTenant, requireRole(...workspaceStructureRoles), async (req, res, next) => {
    const type = req.user.business_type;
    const submittedModules = req.body?.modules;
    const allowedModules = businessTypes[type]?.modules.map(([id]) => id);
    if (!Array.isArray(submittedModules)
      || submittedModules.length > 50
      || !allowedModules
      || !submittedModules.includes('dashboard')
      || submittedModules.some((id) => typeof id !== 'string' || !allowedModules.includes(id))
      || new Set(submittedModules).size !== submittedModules.length) {
      return res.status(400).json({ message: 'Pilih modul yang valid dan tetap aktifkan Dashboard.' });
    }
    try {
      const result = await pool.query(
        `UPDATE companies SET modules = $1
         WHERE id = $2 AND business_type = $3
         RETURNING business_type AS "businessType", modules`,
        [JSON.stringify(submittedModules), req.user.company_id, type],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard', authenticate, requireTenant, requireActiveTenant, requireRole(...staffRoles), async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      const branchId = operationalBranchScope(req);
      const terminalStatuses = ['completed', 'cancelled', 'returned', 'picked_up', 'delivered'];
      const [summary, statuses, weeklySales, recentOrders, ledgerTotals, branchReport, dealerMetrics] = await Promise.all([
        pool.query(
          `WITH paid AS (
             SELECT order_id, company_id, SUM(amount) AS amount
             FROM business_payments WHERE company_id = $1 GROUP BY company_id, order_id
           )
           SELECT
             COUNT(*) FILTER (WHERE o.created_at >= date_trunc('day', now()))::int AS "ordersToday",
             COALESCE(SUM(o.total) FILTER (
               WHERE o.created_at >= date_trunc('day', now())
                 AND NOT (o.status = ANY($2::text[]))
             ), 0) AS "salesToday",
             COALESCE(SUM(o.total) FILTER (
               WHERE o.created_at >= date_trunc('month', now())
                 AND NOT (o.status = ANY($2::text[]))
             ), 0) AS "salesMonth",
             COUNT(*) FILTER (
               WHERE o.payment_status IN ('unpaid', 'partial') AND o.status <> 'cancelled'
             )::int AS "unpaidOrders",
             COALESCE(SUM(GREATEST(o.total - COALESCE(paid.amount, 0), 0)) FILTER (
               WHERE o.status <> 'cancelled'
             ), 0) AS receivables,
             COUNT(*) FILTER (
               WHERE NOT (o.status = ANY($2::text[]))
             )::int AS "activeOrders",
             (SELECT COUNT(*)::int FROM business_products
               WHERE company_id = $1 AND active = true AND stock_tracked = true
                 AND stock <= minimum_stock) AS "lowStockProducts"
           FROM business_orders o
           LEFT JOIN paid ON paid.company_id = o.company_id AND paid.order_id = o.id
           WHERE o.company_id = $1 AND ($3::uuid IS NULL OR o.branch_id = $3)`,
          [companyId, terminalStatuses, branchId],
        ),
        pool.query(
          `SELECT status, COUNT(*)::int AS count
           FROM business_orders WHERE company_id = $1
             AND ($2::uuid IS NULL OR branch_id = $2)
           GROUP BY status ORDER BY count DESC, status`,
          [companyId, branchId],
        ),
        pool.query(
          `SELECT to_char(dates.day::date, 'YYYY-MM-DD') AS date, COALESCE(SUM(o.total), 0) AS total,
             COUNT(o.id)::int AS "orderCount"
           FROM generate_series(current_date - 6, current_date, interval '1 day') AS dates(day)
           LEFT JOIN business_orders o ON o.company_id = $1
             AND o.created_at >= dates.day AND o.created_at < dates.day + interval '1 day'
             AND ($3::uuid IS NULL OR o.branch_id = $3)
             AND NOT (o.status = ANY($2::text[]))
           GROUP BY dates.day ORDER BY dates.day`,
          [companyId, terminalStatuses, branchId],
        ),
        pool.query(
          `SELECT o.id, o.order_number AS "orderNumber", o.order_type AS "orderType",
                  customer_name AS "customerName", status,
                  payment_status AS "paymentStatus", total, o.created_at AS "createdAt",
                  b.name AS "branchName"
           FROM business_orders o JOIN business_branches b
             ON b.id = o.branch_id AND b.company_id = o.company_id
           WHERE o.company_id = $1 AND ($2::uuid IS NULL OR o.branch_id = $2)
           ORDER BY o.created_at DESC LIMIT 8`,
          [companyId, branchId],
        ),
        req.user.role === 'OWNER'
          ? pool.query(
            `SELECT
               COALESCE(SUM(amount) FILTER (WHERE entry_type = 'income'), 0) AS income,
               COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expense'), 0) AS expense
             FROM company_ledger_entries
             WHERE company_id = $1 AND entry_date >= date_trunc('month', now())::date`,
            [companyId],
          )
          : Promise.resolve({ rows: [{ income: 0, expense: 0 }] }),
        req.user.role === 'OWNER'
          ? pool.query(
            `WITH sales AS (
               SELECT branch_id, COUNT(*)::int AS order_count,
                 COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'returned')), 0) AS total
               FROM business_orders
               WHERE company_id = $1 AND created_at >= date_trunc('month', now())
               GROUP BY branch_id
             ), ledger AS (
               SELECT branch_id,
                 COALESCE(SUM(amount) FILTER (WHERE entry_type = 'income'), 0) AS income,
                 COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expense'), 0) AS expense
               FROM company_ledger_entries
               WHERE company_id = $1 AND entry_date >= date_trunc('month', now())::date
               GROUP BY branch_id
             )
             SELECT b.id AS "branchId", b.name AS "branchName",
               COALESCE(s.order_count, 0) AS "orderCount", COALESCE(s.total, 0) AS "salesTotal",
               COALESCE(l.income, 0) AS "ledgerIncome", COALESCE(l.expense, 0) AS "ledgerExpense"
             FROM business_branches b
             LEFT JOIN sales s ON s.branch_id = b.id
             LEFT JOIN ledger l ON l.branch_id = b.id
             WHERE b.company_id = $1 AND b.active = true
             ORDER BY b.is_primary DESC, b.name`,
            [companyId],
          )
          : Promise.resolve({ rows: [] }),
        ['dealer_motor', 'dealer_vehicle'].includes(req.user.business_type)
          ? pool.query(
            `WITH unit_metrics AS (
               SELECT
                   COUNT(*) FILTER (
                     WHERE stock_status NOT IN ('delivered', 'cancelled', 'returned')
                   )::int AS "totalUnits",
                 COUNT(*) FILTER (WHERE stock_status = 'available')::int AS "availableUnits",
                 COUNT(*) FILTER (WHERE stock_status = 'reserved')::int AS "reservedUnits",
                 COUNT(*) FILTER (WHERE stock_status = 'approved_for_delivery')::int AS "readyDeliveryUnits",
                 COUNT(*) FILTER (WHERE stock_status = 'in_delivery')::int AS "inDeliveryUnits",
                 COUNT(*) FILTER (WHERE stock_status = 'delivered')::int AS "deliveredUnits",
                 COUNT(*) FILTER (WHERE stock_status IN ('waiting_receipt', 'in_inspection'))::int AS "incomingUnits",
                 COUNT(*) FILTER (
                   WHERE stock_origin = 'incoming'
                     AND stock_entry_date >= date_trunc('month', current_date)::date
                 )::int AS "incomingThisMonth"
               FROM dealer_motor_units
               WHERE company_id = $1 AND ($2::uuid IS NULL OR branch_id = $2)
             ), spk_metrics AS (
               SELECT
                 COUNT(*) FILTER (WHERE status NOT IN ('SELESAI', 'DITOLAK'))::int AS "activeSpks",
                 COUNT(*) FILTER (WHERE status = 'APPROVAL SVP')::int AS "spksAwaitingApproval",
                 COUNT(*) FILTER (WHERE status = 'DISETUJUI')::int AS "approvedSpks",
                 COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())
                   AND status NOT IN ('DITOLAK'))::int AS "spksMonth",
                 COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())
                   AND status NOT IN ('DITOLAK')
                   AND upper(COALESCE(details ->> 'paymentType', '')) IN ('CASH', 'TUNAI'))::int AS "cashSpks",
                 COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())
                   AND status NOT IN ('DITOLAK')
                   AND upper(COALESCE(details ->> 'paymentType', '')) IN ('CREDIT', 'KREDIT'))::int AS "creditSpks"
               FROM dealer_motor_spks
               WHERE company_id = $1 AND ($2::uuid IS NULL OR branch_id = $2)
             )
             SELECT unit_metrics.*, spk_metrics.*
             FROM unit_metrics, spk_metrics`,
            [companyId, branchId],
          )
          : Promise.resolve({ rows: [{}] }),
      ]);
      const {
        salesToday, salesMonth, receivables, ...safeSummary
      } = summary.rows[0];
      const ownerView = req.user.role === 'OWNER';
      res.json({
        businessType: req.user.business_type,
        summary: safeSummary,
        dealerMetrics: ['dealer_motor', 'dealer_vehicle'].includes(req.user.business_type)
          ? dealerMetrics.rows[0]
          : null,
        ...(ownerView ? {
          financials: {
            salesToday,
            salesMonth,
            receivables,
            ledgerIncome: ledgerTotals.rows[0].income,
            ledgerExpense: ledgerTotals.rows[0].expense,
            netProfit: Number(ledgerTotals.rows[0].income) - Number(ledgerTotals.rows[0].expense),
          },
          branchReport: branchReport.rows,
        } : {}),
        statuses: statuses.rows,
        weeklySales: weeklySales.rows.map((day) => ({
          date: day.date,
          total: ownerView ? day.total : day.orderCount,
        })),
        recentOrders: recentOrders.rows.map(({ total, ...order }) => (
          ownerView ? { ...order, total } : order
        )),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', authenticate, requireTenant, requireActiveTenant, requireRole(...staffRoles), async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      const branchId = operationalBranchScope(req);
      const [products, customers, suppliers, orders, purchases, inventoryMovements] = await Promise.all([
        pool.query(
          `SELECT id, name, sku, category, unit, item_type AS "itemType",
                  cost_price AS "costPrice", selling_price AS "sellingPrice",
                  stock, minimum_stock AS "minimumStock", stock_tracked AS "stockTracked",
                  active, details, updated_at AS "updatedAt"
           FROM business_products WHERE company_id = $1 AND active = true
           ORDER BY name LIMIT 500`,
          [companyId],
        ),
        pool.query(
          `SELECT id, name, phone, email, address, details, created_at AS "createdAt"
           FROM business_customers WHERE company_id = $1
           ORDER BY updated_at DESC LIMIT 200`,
          [companyId],
        ),
        pool.query(
          `SELECT id, name, phone, email, address, details
           FROM business_suppliers WHERE company_id = $1 AND active = true
           ORDER BY name LIMIT 200`,
          [companyId],
        ),
        pool.query(
          `SELECT o.id, o.order_number AS "orderNumber", o.order_type AS "orderType",
                  o.business_type AS "businessType", o.status, o.payment_status AS "paymentStatus",
                  o.payment_timing AS "paymentTiming", o.customer_name AS "customerName",
                  o.customer_phone AS "customerPhone", o.subtotal, o.discount, o.tax,
                  o.service_charge AS "serviceCharge", o.total, o.details,
                  o.created_at AS "createdAt",
                  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'productId', i.product_id, 'name', i.item_name, 'unit', i.unit,
                    'quantity', i.quantity, 'unitPrice', i.unit_price, 'total', i.line_total
                  ) ORDER BY i.id) FROM business_order_items i
                    WHERE i.company_id = o.company_id AND i.order_id = o.id), '[]'::jsonb) AS items,
                  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'method', p.payment_method, 'amount', p.amount, 'paidAt', p.paid_at
                  ) ORDER BY p.paid_at) FROM business_payments p
                    WHERE p.company_id = o.company_id AND p.order_id = o.id), '[]'::jsonb) AS payments
           FROM business_orders o WHERE o.company_id = $1
             AND ($2::uuid IS NULL OR o.branch_id = $2)
           ORDER BY o.created_at DESC LIMIT 200`,
          [companyId, branchId],
        ),
        pool.query(
          `SELECT p.id, p.purchase_number AS "purchaseNumber", p.status, p.total,
                  p.note, p.purchased_at AS "purchasedAt", s.name AS "supplierName"
           FROM business_purchases p LEFT JOIN business_suppliers s
             ON s.id = p.supplier_id AND s.company_id = p.company_id
           WHERE p.company_id = $1
             AND ($2::uuid IS NULL OR p.branch_id = $2)
           ORDER BY p.purchased_at DESC LIMIT 100`,
          [companyId, branchId],
        ),
        pool.query(
          `SELECT im.id, im.product_id AS "productId", p.name AS "productName",
                  im.movement_type AS "movementType", im.quantity,
                  im.reference, im.note, im.created_at AS "createdAt",
                  u.name AS "createdByName"
           FROM inventory_movements im
           JOIN business_products p ON p.id = im.product_id AND p.company_id = im.company_id
           JOIN users u ON u.id = im.created_by
           WHERE im.company_id = $1
           ORDER BY im.created_at DESC LIMIT 1000`,
          [companyId],
        ),
      ]);
      res.json({
        businessType: req.user.business_type,
        products: products.rows,
        customers: customers.rows,
        suppliers: suppliers.rows,
        orders: orders.rows,
        purchases: purchases.rows,
        inventoryMovements: inventoryMovements.rows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/products', authenticate, requireTenant, requireActiveTenant, requireRole(...managerRoles), async (req, res, next) => {
    try {
      const product = normalizeProduct(req.body);
      const result = await withTransaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO business_products
             (company_id, name, sku, category, unit, item_type, cost_price,
              selling_price, stock, minimum_stock, stock_tracked, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id, name, sku, category, unit, item_type AS "itemType",
                     cost_price AS "costPrice", selling_price AS "sellingPrice",
                     stock, minimum_stock AS "minimumStock", stock_tracked AS "stockTracked",
                     active, details`,
          [req.user.company_id, product.name, product.sku, product.category, product.unit,
            product.itemType, product.costPrice, product.sellingPrice, product.stock,
            product.minimumStock, product.stockTracked, JSON.stringify(product.details)],
        );
        if (product.stock > 0 && product.stockTracked) {
          await client.query(
            `INSERT INTO inventory_movements
               (company_id, product_id, created_by, movement_type, quantity, note)
             VALUES ($1, $2, $3, 'opening', $4, 'Saldo awal')`,
            [req.user.company_id, inserted.rows[0].id, req.user.id, product.stock],
          );
        }
        return inserted.rows[0];
      });
      res.status(201).json({ product: result });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'SKU sudah digunakan di workspace ini.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.patch('/products/:id/stock', authenticate, requireTenant, requireActiveTenant, requireRole(...managerRoles), async (req, res, next) => {
    try {
      const { movementType, quantity, note, reference } = req.body;
      const amount = Number(quantity);
      if (!uuidPattern.test(req.params.id)
        || !['purchase', 'return', 'adjustment', 'waste'].includes(movementType)
        || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000000
        || typeof note !== 'string' || !note.trim() || note.trim().length > 300) {
        return res.status(400).json({ message: 'Jenis mutasi, jumlah, dan keterangan stok tidak valid.' });
      }
      const stockDelta = movementType === 'waste' ? -Math.abs(amount)
        : movementType === 'adjustment' ? amount : Math.abs(amount);
      const product = await withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT id, name, stock, stock_tracked FROM business_products
           WHERE id = $1 AND company_id = $2 AND active = true FOR UPDATE`,
          [req.params.id, req.user.company_id],
        );
        if (!result.rowCount) throw invalid('Produk tidak ditemukan.', 404);
        if (!result.rows[0].stock_tracked) throw invalid('Stok produk ini tidak dilacak.');
        await adjustProductStock(client, req.user.company_id, req.user.id, result.rows[0],
          stockDelta, movementType, reference, note.trim());
        const updated = await client.query(
          `SELECT id, name, stock, minimum_stock AS "minimumStock"
           FROM business_products WHERE id = $1 AND company_id = $2`,
          [req.params.id, req.user.company_id],
        );
        return updated.rows[0];
      });
      res.json({ product });
    } catch (error) {
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.post('/customers', authenticate, requireTenant, requireActiveTenant, requireRole(...staffRoles), async (req, res, next) => {
    const { name, phone, email, address, details = {} } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 160
      || (phone != null && (typeof phone !== 'string' || phone.length > 30))
      || (email != null && (typeof email !== 'string' || email.length > 254))
      || (address != null && (typeof address !== 'string' || address.length > 500))
      || !details || typeof details !== 'object' || Array.isArray(details)) {
      return res.status(400).json({ message: 'Data pelanggan tidak valid.' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO business_customers (company_id, name, phone, email, address, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, phone) WHERE phone IS NOT NULL AND phone <> ''
         DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                       address = EXCLUDED.address, details = EXCLUDED.details, updated_at = now()
         RETURNING id, name, phone, email, address, details`,
        [req.user.company_id, name.trim(), phone?.trim() || null, email?.trim() || null,
          address?.trim() || null, JSON.stringify(details)],
      );
      res.status(201).json({ customer: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.post('/suppliers', authenticate, requireTenant, requireActiveTenant, requireRole(...managerRoles), async (req, res, next) => {
    const { name, phone, email, address, details = {} } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 160
      || (phone != null && (typeof phone !== 'string' || phone.length > 30))
      || (email != null && (typeof email !== 'string' || email.length > 254))
      || (address != null && (typeof address !== 'string' || address.length > 500))
      || !details || typeof details !== 'object' || Array.isArray(details)) {
      return res.status(400).json({ message: 'Data pemasok tidak valid.' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO business_suppliers (company_id, name, phone, email, address, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, phone, email, address, details`,
        [req.user.company_id, name.trim(), phone?.trim() || null, email?.trim() || null,
          address?.trim() || null, JSON.stringify(details)],
      );
      res.status(201).json({ supplier: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.post('/purchases', authenticate, requireTenant, requireActiveTenant, requireRole(...managerRoles), async (req, res, next) => {
    try {
      const { supplierId, note, items } = req.body;
      if (supplierId && !uuidPattern.test(supplierId)) throw invalid('Pemasok tidak valid.');
      if (note != null && (typeof note !== 'string' || note.length > 300)) throw invalid('Keterangan pembelian tidak valid.');
      if (!Array.isArray(items) || items.length < 1 || items.length > 100) throw invalid('Pilih item pembelian.');
      const purchase = await withTransaction(pool, async (client) => {
        const branch = await client.query(
          'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
          [req.user.branch_id, req.user.company_id],
        );
        if (!branch.rowCount) throw invalid('Akun belum ditetapkan ke cabang aktif.', 403);
        if (supplierId) {
          const supplier = await client.query(
            'SELECT id FROM business_suppliers WHERE id = $1 AND company_id = $2 AND active = true',
            [supplierId, req.user.company_id],
          );
          if (!supplier.rowCount) throw invalid('Pemasok tidak ditemukan di workspace ini.', 404);
        }
        let total = 0;
        const purchaseItems = [];
        for (const item of items) {
          if (!uuidPattern.test(String(item.productId || ''))) throw invalid('Produk pembelian tidak valid.');
          const quantity = Number(item.quantity);
          const unitCost = Number(item.unitCost);
          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000
            || !Number.isSafeInteger(unitCost) || unitCost < 0) throw invalid('Jumlah atau harga beli tidak valid.');
          const productResult = await client.query(
            `SELECT id, name, stock_tracked FROM business_products
             WHERE id = $1 AND company_id = $2 AND active = true FOR UPDATE`,
            [item.productId, req.user.company_id],
          );
          if (!productResult.rowCount) throw invalid('Produk pembelian tidak ditemukan.', 404);
          if (!productResult.rows[0].stock_tracked) throw invalid(`Stok ${productResult.rows[0].name} tidak dilacak.`);
          const lineTotal = Math.round(quantity * unitCost);
          if (!Number.isSafeInteger(lineTotal)) throw invalid('Nilai pembelian tidak valid.');
          total += lineTotal;
          purchaseItems.push({ ...productResult.rows[0], quantity, unitCost, lineTotal });
        }
        if (!Number.isSafeInteger(total)) throw invalid('Total pembelian terlalu besar.');
        const purchaseNumber = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
        const created = await client.query(
          `INSERT INTO business_purchases (company_id, branch_id, created_by, supplier_id, purchase_number, total, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, purchase_number AS "purchaseNumber", total, purchased_at AS "purchasedAt"`,
          [req.user.company_id, req.user.branch_id, req.user.id, supplierId || null, purchaseNumber, total, note?.trim() || null],
        );
        for (const item of purchaseItems) {
          await client.query(
            `INSERT INTO business_purchase_items (company_id, purchase_id, product_id, quantity, unit_cost, line_total)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.company_id, created.rows[0].id, item.id, item.quantity, item.unitCost, item.lineTotal],
          );
          await adjustProductStock(client, req.user.company_id, req.user.id, item,
            item.quantity, 'purchase', purchaseNumber, note || 'Barang diterima.');
          await client.query(
            'UPDATE business_products SET cost_price = $1, updated_at = now() WHERE id = $2 AND company_id = $3',
            [item.unitCost, item.id, req.user.company_id],
          );
        }
        return created.rows[0];
      });
      res.status(201).json({ purchase });
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ message: 'Pemasok atau produk tidak valid untuk workspace ini.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.post('/orders', authenticate, requireTenant, requireActiveTenant, requireRole(...staffRoles), async (req, res, next) => {
    try {
      const order = await withTransaction(pool, (client) => createOrder(client, {
        companyId: req.user.company_id,
        branchId: req.user.branch_id,
        userId: req.user.id,
        businessType: req.user.business_type,
        body: req.body,
      }));
      res.status(201).json({ order });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Nomor transaksi berbenturan. Silakan coba kembali.' });
      if (error.code === '23503') return res.status(400).json({ message: 'Pelanggan atau produk tidak valid untuk workspace ini.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.patch('/orders/:id/status', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN', 'ADMIN', 'KASIR', 'SVP'), async (req, res, next) => {
    try {
      if (!uuidPattern.test(req.params.id) || typeof req.body.status !== 'string') throw invalid('Status transaksi tidak valid.');
      const branchId = operationalBranchScope(req);
      const order = await withTransaction(pool, async (client) => {
        const currentResult = await client.query(
          `SELECT id, business_type, status, stock_reserved
           FROM business_orders WHERE id = $1 AND company_id = $2
             AND ($3::uuid IS NULL OR branch_id = $3) FOR UPDATE`,
          [req.params.id, req.user.company_id, branchId],
        );
        if (!currentResult.rowCount) throw invalid('Transaksi tidak ditemukan.', 404);
        const current = currentResult.rows[0];
        const nextStatus = nextIndustryStatus(current.business_type, current.status);
        const workflow = getIndustryWorkflow(current.business_type);
        const terminal = ['delivered', 'picked_up', 'served', 'completed', 'returned', 'cancelled'];
        const isCancellation = req.body.status === 'cancelled' && !terminal.includes(current.status);
        const isReturn = req.body.status === 'returned'
          && workflow.statuses.some(([status]) => status === 'returned')
          && !['returned', 'cancelled'].includes(current.status);
        if (req.body.status !== nextStatus && !isCancellation && !isReturn) throw invalid('Status tidak mengikuti alur usaha.');
        if (['approved', 'verified'].includes(req.body.status)
          && !['OWNER', 'SUPER ADMIN', 'ADMIN', 'SVP'].includes(req.user.role)) {
          throw invalid('Peran Anda tidak dapat menyetujui transaksi ini.', 403);
        }
        if (!workflow.statuses.some(([status]) => status === req.body.status)
          && !['cancelled', 'returned'].includes(req.body.status)) throw invalid('Status usaha tidak dikenal.');
        if ((isCancellation || isReturn) && current.stock_reserved) {
          const items = await client.query(
            `SELECT i.product_id AS id, i.item_name AS name, i.quantity
             FROM business_order_items i
             JOIN business_products p ON p.id = i.product_id AND p.company_id = i.company_id
             WHERE i.order_id = $1 AND i.company_id = $2
               AND p.stock_tracked = true`,
            [current.id, req.user.company_id],
          );
          for (const item of items.rows) {
            await adjustProductStock(client, req.user.company_id, req.user.id,
              item, Number(item.quantity), 'return', current.id, 'Stok dikembalikan dari transaksi yang dibatalkan.');
          }
        }
        const updated = await client.query(
          `UPDATE business_orders
           SET status = $1, stock_reserved = CASE WHEN $2 THEN false ELSE stock_reserved END, updated_at = now()
           WHERE id = $3 AND company_id = $4
           RETURNING id, order_number AS "orderNumber", status, payment_status AS "paymentStatus", total`,
          [req.body.status, isCancellation || isReturn, current.id, req.user.company_id],
        );
        return updated.rows[0];
      });
      res.json({ order });
    } catch (error) {
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.post('/orders/:id/payments', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN', 'ADMIN', 'KASIR'), async (req, res, next) => {
    try {
      const { amount, method, reference } = req.body;
      const paymentAmount = Number(amount);
      const branchId = operationalBranchScope(req);
      if (!uuidPattern.test(req.params.id) || !Number.isSafeInteger(paymentAmount) || paymentAmount <= 0
        || !paymentMethods.has(method)
        || (reference != null && (typeof reference !== 'string' || reference.length > 120))) {
        throw invalid('Data pembayaran tidak valid.');
      }
      const result = await withTransaction(pool, async (client) => {
        const orderResult = await client.query(
          `SELECT id, total, payment_status, status FROM business_orders
           WHERE id = $1 AND company_id = $2
             AND ($3::uuid IS NULL OR branch_id = $3) FOR UPDATE`,
          [req.params.id, req.user.company_id, branchId],
        );
        if (!orderResult.rowCount) throw invalid('Transaksi tidak ditemukan.', 404);
        const order = orderResult.rows[0];
        if (['cancelled', 'returned'].includes(order.status) || order.payment_status === 'refunded') {
          throw invalid('Pembayaran tidak dapat ditambahkan pada transaksi ini.');
        }
        const paidResult = await client.query(
          'SELECT COALESCE(sum(amount), 0)::bigint AS paid FROM business_payments WHERE order_id = $1 AND company_id = $2',
          [order.id, req.user.company_id],
        );
        const paid = Number(paidResult.rows[0].paid);
        if (paid + paymentAmount > Number(order.total)) throw invalid('Pembayaran melebihi sisa tagihan.');
        await client.query(
          `INSERT INTO business_payments (company_id, order_id, created_by, payment_method, amount, reference)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.company_id, order.id, req.user.id, method, paymentAmount, reference?.trim() || null],
        );
        const paymentStatus = paid + paymentAmount === Number(order.total) ? 'paid' : 'partial';
        const updated = await client.query(
          `UPDATE business_orders SET payment_status = $1, updated_at = now()
           WHERE id = $2 AND company_id = $3
           RETURNING id, order_number AS "orderNumber", total, payment_status AS "paymentStatus"`,
          [paymentStatus, order.id, req.user.company_id],
        );
        return updated.rows[0];
      });
      res.status(201).json({ order: result });
    } catch (error) {
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  return router;
}

export function createPublicOperationsRouter({ pool }) {
  const router = express.Router();

  router.get('/restaurant/:companyId/menu', async (req, res, next) => {
    if (!uuidPattern.test(req.params.companyId)) return res.status(404).json({ message: 'Menu tidak ditemukan.' });
    if (req.query.branchId && !uuidPattern.test(req.query.branchId)) return res.status(404).json({ message: 'Menu tidak ditemukan.' });
    try {
      const company = await pool.query(
        `SELECT c.id, c.name, c.business_type, c.trial_ends_at, c.active_until, c.plan_id, c.subscription_status,
           (SELECT b.id FROM business_branches b WHERE b.company_id = c.id AND b.active = true
             AND ($2::uuid IS NULL OR b.id = $2)
             ORDER BY b.is_primary DESC LIMIT 1) AS branch_id
         FROM companies c WHERE c.id = $1`,
        [req.params.companyId, req.query.branchId || null],
      );
      if (!company.rowCount || company.rows[0].business_type !== 'restaurant' || !company.rows[0].branch_id) {
        return res.status(404).json({ message: 'Menu tidak ditemukan.' });
      }
      const status = company.rows[0].plan_id === 'lifetime'
        ? 'lifetime'
        : (company.rows[0].active_until && new Date(company.rows[0].active_until) > new Date())
          ? 'active'
          : (company.rows[0].trial_ends_at && new Date(company.rows[0].trial_ends_at) > new Date())
            ? 'trial'
            : 'expired';
      if (status === 'expired' || company.rows[0].subscription_status === 'suspended') {
        return res.status(410).json({ message: 'Menu sedang tidak tersedia.' });
      }
      const products = await pool.query(
        `SELECT id, name, category, unit, selling_price AS price
         FROM business_products
         WHERE company_id = $1 AND active = true
         ORDER BY category NULLS FIRST, name LIMIT 500`,
        [req.params.companyId],
      );
      res.json({
        company: { id: company.rows[0].id, name: company.rows[0].name, branchId: company.rows[0].branch_id },
        products: products.rows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/restaurant/:companyId/orders', async (req, res, next) => {
    if (!uuidPattern.test(req.params.companyId)) return res.status(404).json({ message: 'Menu tidak ditemukan.' });
    const requestedBranchId = req.body.branchId || req.query.branchId || null;
    if (requestedBranchId && !uuidPattern.test(requestedBranchId)) return res.status(404).json({ message: 'Menu tidak ditemukan.' });
    if (!rateLimitPublicOrder(req)) return res.status(429).json({ message: 'Terlalu banyak pesanan. Coba kembali beberapa menit lagi.' });
    try {
      const company = await pool.query(
        `SELECT c.id, c.business_type, c.trial_ends_at, c.active_until, c.plan_id,
                c.subscription_status, u.id AS owner_id,
                (SELECT b.id FROM business_branches b
                 WHERE b.company_id = c.id AND b.active = true
                   AND ($2::uuid IS NULL OR b.id = $2)
                 ORDER BY b.is_primary DESC LIMIT 1) AS primary_branch_id
         FROM companies c JOIN users u ON u.company_id = c.id AND u.role = 'OWNER'
         WHERE c.id = $1 ORDER BY u.created_at LIMIT 1`,
        [req.params.companyId, requestedBranchId],
      );
      if (!company.rowCount || company.rows[0].business_type !== 'restaurant') {
        return res.status(404).json({ message: 'Menu tidak ditemukan.' });
      }
      const business = company.rows[0];
      const status = business.plan_id === 'lifetime'
        ? 'lifetime'
        : (business.active_until && new Date(business.active_until) > new Date())
          ? 'active'
          : (business.trial_ends_at && new Date(business.trial_ends_at) > new Date())
            ? 'trial'
            : 'expired';
      if (status === 'expired' || business.subscription_status === 'suspended') {
        return res.status(410).json({ message: 'Menu sedang tidak menerima pesanan.' });
      }
      const details = {
        tableNumber: typeof req.body.tableNumber === 'string' ? req.body.tableNumber : '',
        orderChannel: typeof req.body.orderChannel === 'string' ? req.body.orderChannel : 'Menu QR',
        paymentTiming: typeof req.body.paymentTiming === 'string' ? req.body.paymentTiming : 'Bayar di kasir',
        specialNotes: typeof req.body.specialNotes === 'string' ? req.body.specialNotes : '',
      };
      const order = await withTransaction(pool, (client) => createOrder(client, {
        companyId: business.id,
        userId: business.owner_id,
        businessType: business.business_type,
        body: {
          customerName: req.body.customerName,
          customerPhone: req.body.customerPhone,
          items: req.body.items,
          details,
          paymentTiming: details.paymentTiming,
        },
        branchId: business.primary_branch_id,
        defaultDetails: { ...details },
      }));
      res.status(201).json({ order });
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ message: 'Produk menu tidak valid.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  return router;
}
