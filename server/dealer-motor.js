import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const hondaCatalogCache = { products: [], fetchedAt: 0, specifications: new Map() };
const hondaCatalogUrl = 'https://www.astra-honda.com/api/v1';
const hondaCatalogCacheDuration = 24 * 60 * 60 * 1000;

async function fetchHondaJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Katalog Honda merespons HTTP ${response.status}.`);
  return response.json();
}

function normalizeHondaProduct(product) {
  if (!product || !['string', 'number'].includes(typeof product.id)
    || typeof product.slug !== 'string' || typeof product.title !== 'string') return null;
  const modelYear = Array.isArray(product.years)
    ? Number(product.years.find((year) => /^\d{4}$/.test(String(year))))
    : NaN;
  return {
    id: String(product.id),
    slug: product.slug,
    name: product.title.trim(),
    category: typeof product.category?.title === 'string' ? product.category.title.trim() : 'Honda',
    modelYear: Number.isInteger(modelYear) ? modelYear : new Date().getFullYear(),
    price: Number.isSafeInteger(Number(product.prices?.value)) ? Number(product.prices.value) : 0,
    colors: Array.isArray(product.colors)
      ? product.colors
        .map((color) => typeof color?.title === 'string' ? color.title.trim() : '')
        .filter(Boolean)
      : [],
  };
}

function getHondaSpecification(detail) {
  const sections = detail?.spesifications || detail?.specifications;
  if (!Array.isArray(sections)) return '';
  const entries = sections.flatMap((section) => (
    Array.isArray(section?.details) ? section.details : [section]
  ));
  const entry = entries.find((item) => {
    const label = String(item?.title || item?.name || '').toLowerCase();
    return /volume|langkah|kapasitas|mesin|cc/.test(label);
  });
  const value = entry?.summary || entry?.value || entry?.description;
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

async function loadHondaCatalog() {
  if (hondaCatalogCache.products.length
    && Date.now() - hondaCatalogCache.fetchedAt < hondaCatalogCacheDuration) {
    return { products: hondaCatalogCache.products, stale: false };
  }

  try {
    const categories = await fetchHondaJson(`${hondaCatalogUrl}/product/category`);
    if (!Array.isArray(categories)) throw new Error('Daftar kategori katalog Honda tidak valid.');
    const activeCategories = categories.filter((category) => (
      ['string', 'number'].includes(typeof category?.id) && category.redirectUrl == null
    ));
    const productLists = await Promise.all(activeCategories.map(async (category) => {
      const products = await fetchHondaJson(
        `${hondaCatalogUrl}/product?category=${encodeURIComponent(category.id)}`,
      );
      if (!Array.isArray(products)) throw new Error('Daftar model katalog Honda tidak valid.');
      return products.map(normalizeHondaProduct).filter(Boolean);
    }));
    const products = productLists.flat();
    if (!products.length) throw new Error('Katalog Honda tidak memiliki model yang dapat dipilih.');
    hondaCatalogCache.products = products;
    hondaCatalogCache.fetchedAt = Date.now();
    hondaCatalogCache.specifications.clear();
    return { products, stale: false };
  } catch (error) {
    if (hondaCatalogCache.products.length) {
      return { products: hondaCatalogCache.products, stale: true };
    }
    throw error;
  }
}

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validDate(value) {
  return typeof value === 'string'
    && datePattern.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function allocateSpkNumber(client, companyId, spkDate) {
  const dateCode = spkDate.replaceAll('-', '');
  const numberPattern = `^SPK-WAM-${dateCode}-([0-9]+)$`;
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))',
    [companyId, dateCode],
  );
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(spk_number FROM $2)::bigint), 0) + 1 AS "nextNumber"
     FROM dealer_motor_spks
     WHERE company_id = $1 AND spk_number ~ $2`,
    [companyId, numberPattern],
  );
  return `SPK-WAM-${dateCode}-${String(result.rows[0].nextNumber).padStart(4, '0')}`;
}

function normalizeUnit(body) {
  const brand = typeof body.brand === 'string' ? body.brand.trim() : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const specification = typeof body.specification === 'string' ? body.specification.trim() : '';
  const color = typeof body.color === 'string' ? body.color.trim() : '';
  const vehicleCategory = body.vehicleCategory === 'mobil' ? 'mobil' : 'motor';
  const receivingInvoice = typeof body.receivingInvoice === 'string'
    ? body.receivingInvoice.trim().slice(0, 100) : '';
  const supplierName = typeof body.supplierName === 'string'
    ? body.supplierName.trim().slice(0, 160) : '';
  const frameNumber = typeof body.frameNumber === 'string' ? body.frameNumber.trim().toUpperCase() : '';
  const engineNumber = typeof body.engineNumber === 'string' ? body.engineNumber.trim().toUpperCase() : '';
  const modelYear = Number(body.modelYear);
  const otrPrice = Number(body.otrPrice);
  const quantity = Number(body.quantity ?? 1);
  const identifiersPending = body.identifiersPending === true;
  if (!brand || brand.length > 80 || !model || model.length > 120
    || !specification || specification.length > 120 || !color || color.length > 80
    || (!identifiersPending && (!frameNumber || frameNumber.length > 80 || !engineNumber || engineNumber.length > 80))
    || (identifiersPending && (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000))
    || !Number.isInteger(modelYear) || modelYear < 1980 || modelYear > 2100
    || !Number.isSafeInteger(otrPrice) || otrPrice < 0
    || !uuidPattern.test(String(body.branchId || ''))
    || !['opening', 'incoming'].includes(body.stockOrigin)
    || !validDate(body.stockEntryDate)) {
    throw invalid('Lengkapi nama, spesifikasi, warna, cabang, tanggal masuk, harga, dan jumlah unit dengan benar.');
  }
  return {
    brand,
    model,
    specification,
    modelYear,
    color,
    frameNumber,
    engineNumber,
    otrPrice,
    branchId: body.branchId,
    stockOrigin: body.stockOrigin,
    stockEntryDate: body.stockEntryDate,
    quantity: identifiersPending ? quantity : 1,
    identifiersPending,
    vehicleCategory,
    receivingInvoice: receivingInvoice || null,
    supplierName: supplierName || null,
  };
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

function shapeSpk(row) {
  return {
    id: row.id,
    spkNumber: row.spkNumber,
    spkNumber: row.spkNumber,
    customer: row.customerName,
    sales: row.salesName,
    amount: Number(row.amount),
    status: row.status,
    date: row.createdDate,
    unitId: row.unitId,
    branchName: row.branchName,
    brand: row.brand,
    model: row.model,
    specification: row.specification,
    motor: [row.brand, row.model, row.specification].filter(Boolean).join(' '),
    type: row.specification,
    color: row.color,
    year: row.modelYear,
    frameNumber: row.frameNumber,
    engineNumber: row.engineNumber,
    otrPrice: Number(row.otrPrice),
    customerNik: row.customerNik,
    branchId: row.branchId,
    customerPhone: row.customerPhone,
    customerAddress: row.customerAddress,
    details: row.details,
    waybillNumber: row.waybillNumber,
    waybillIssuedAt: row.waybillIssuedAt,
    deliveryScheduledAt: row.deliveryScheduledAt,
    deliveryScheduleHistory: row.deliveryScheduleHistory || [],
    deliveryStatus: row.deliveryStatus,
    pdiStatus: row.pdiStatus,
    driverId: row.driverId,
    driverName: row.driverName,
    deliveryLatitude: row.deliveryLatitude,
    deliveryLongitude: row.deliveryLongitude,
    deliveredAt: row.deliveredAt,
  };
}

export function createDealerMotorRouter({
  pool,
  authenticate,
  requireTenant,
  requireActiveTenant,
  requirePermission,
  upload,
  privateDeliveryDirectory,
  fileTypeFromBuffer,
}) {
  const router = express.Router();
  const photoUpload = upload.single('photo');

  router.get('/catalog', authenticate, requireTenant, requireActiveTenant,
    requirePermission('unitManage'), async (req, res) => {
      try {
        const catalog = await loadHondaCatalog();
        res.json(catalog);
      } catch (error) {
        console.error('Dealer Honda catalog unavailable:', error.message);
        res.status(502).json({ message: 'Katalog Honda belum dapat dimuat. Coba lagi atau ketik nama motor secara manual.' });
      }
    });

  router.get('/catalog/:slug', authenticate, requireTenant, requireActiveTenant,
    requirePermission('unitManage'), async (req, res) => {
      try {
        const catalog = await loadHondaCatalog();
        const product = catalog.products.find((item) => item.slug === req.params.slug);
        if (!product) return res.status(404).json({ message: 'Model tidak ditemukan di katalog Honda.' });
        let specification = hondaCatalogCache.specifications.get(product.slug);
        if (!specification) {
          const detail = await fetchHondaJson(
            `${hondaCatalogUrl}/product/${encodeURIComponent(product.slug)}`,
          );
          specification = getHondaSpecification(detail) || product.category;
          hondaCatalogCache.specifications.set(product.slug, specification);
        }
        res.json({ product: { ...product, specification } });
      } catch (error) {
        console.error('Dealer Honda model specification unavailable:', error.message);
        res.status(502).json({ message: 'Spesifikasi model belum dapat dimuat dari katalog Honda.' });
      }
    });

  router.get('/units', authenticate, requireTenant, requireActiveTenant,
    requirePermission('unitManage', 'spkCreate', 'pdiManage'), async (req, res, next) => {
      try {
        const canViewAllBranches = req.user.permissions.includes('unitManage');
        const result = await pool.query(
          `SELECT u.id, u.branch_id AS "branchId", b.name AS "branchName",
                  u.brand, u.model, u.specification, u.model_year AS "modelYear",
                  u.color, u.frame_number AS "frameNumber", u.engine_number AS "engineNumber",
                  u.otr_price AS "otrPrice", u.stock_origin AS "stockOrigin",
                  u.stock_status AS "stockStatus",
                  u.vehicle_category AS "vehicleCategory",
                  u.receiving_invoice AS "receivingInvoice",
                  u.supplier_name AS "supplierName",
                  u.stock_intake_id AS "stockIntakeId",
                  u.inspection_status AS "inspectionStatus",
                  u.scratch_status AS "scratchStatus",
                  u.pdi_status AS "pdiStatus",
                  u.handover_status AS "handoverStatus",
                  active_spk.spk_number AS "spkNumber",
                  active_spk.status AS "spkStatus",
                  to_char(u.stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                  u.status_updated_at AS "statusUpdatedAt", u.created_at AS "createdAt"
           FROM dealer_motor_units u
           JOIN business_branches b ON b.id = u.branch_id AND b.company_id = u.company_id
           LEFT JOIN LATERAL (
             SELECT s.spk_number, s.status
             FROM dealer_motor_spks s
             WHERE s.company_id = u.company_id AND s.unit_id = u.id
               AND s.status IN ('SUBMITTED', 'APPROVAL SVP', 'DISETUJUI')
             ORDER BY s.created_at DESC
             LIMIT 1
           ) active_spk ON true
           WHERE u.company_id = $1 AND ($2::boolean OR u.branch_id = $3)
           ORDER BY u.created_at DESC LIMIT 1000`,
          [req.user.company_id, canViewAllBranches, req.user.branch_id],
        );
        const summary = await pool.query(
          `SELECT (COUNT(*) FILTER (WHERE stock_origin = 'opening')
                    + COALESCE((SELECT SUM(quantity_remaining) FROM dealer_motor_stock_intakes
                                WHERE company_id = $1 AND ($2::boolean OR branch_id = $3)
                                  AND stock_origin = 'opening'), 0))::int AS "openingStock",
                  (COUNT(*) FILTER (WHERE stock_origin = 'incoming')
                    + COALESCE((SELECT SUM(quantity_remaining) FROM dealer_motor_stock_intakes
                                WHERE company_id = $1 AND ($2::boolean OR branch_id = $3)
                                  AND stock_origin = 'incoming'), 0))::int AS "incomingStock",
                  (COUNT(*) FILTER (WHERE stock_status = 'in_inspection')
                    + COALESCE((SELECT SUM(quantity_remaining) FROM dealer_motor_stock_intakes
                                WHERE company_id = $1 AND ($2::boolean OR branch_id = $3)), 0))::int AS "awaitingInspection",
                  COUNT(*) FILTER (WHERE stock_status = 'reserved')::int AS "reservedStock",
                  COUNT(*) FILTER (WHERE stock_status = 'available')::int AS "availableStock",
                  COUNT(*) FILTER (WHERE stock_status = 'approved_for_delivery')::int AS "readyForDelivery",
                  COUNT(*) FILTER (WHERE stock_status = 'in_delivery')::int AS "inDelivery",
                  COUNT(*) FILTER (WHERE stock_status = 'delivered')::int AS "deliveredStock"
           FROM dealer_motor_units
           WHERE company_id = $1 AND ($2::boolean OR branch_id = $3)`,
          [req.user.company_id, canViewAllBranches, req.user.branch_id],
        );
        const intakes = await pool.query(
          `SELECT i.id, i.branch_id AS "branchId", b.name AS "branchName",
                  i.brand, i.model, i.specification, i.model_year AS "modelYear", i.color,
                  i.otr_price AS "otrPrice", i.stock_origin AS "stockOrigin",
                  i.vehicle_category AS "vehicleCategory",
                  i.receiving_invoice AS "receivingInvoice", i.supplier_name AS "supplierName",
                  i.quantity_received AS "quantityReceived",
                  i.quantity_remaining AS "quantityRemaining", i.status,
                  to_char(i.stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                  i.created_at AS "createdAt", actor.name AS "createdByName"
           FROM dealer_motor_stock_intakes i
           JOIN business_branches b ON b.id = i.branch_id AND b.company_id = i.company_id
           LEFT JOIN users actor ON actor.id = i.created_by AND actor.company_id = i.company_id
           WHERE i.company_id = $1 AND ($2::boolean OR i.branch_id = $3)
           ORDER BY i.created_at DESC LIMIT 1000`,
          [req.user.company_id, canViewAllBranches, req.user.branch_id],
        );
        const movements = await pool.query(
          `SELECT e.id, e.event_type AS "eventType", e.note, e.details,
                  e.created_at AS "createdAt", u.brand, u.model, u.specification,
                  u.frame_number AS "frameNumber", u.engine_number AS "engineNumber",
                  b.name AS "branchName", actor.name AS "createdByName",
                  s.spk_number AS "spkNumber"
           FROM dealer_motor_unit_events e
           JOIN dealer_motor_units u ON u.id = e.unit_id AND u.company_id = e.company_id
           JOIN business_branches b ON b.id = u.branch_id AND b.company_id = u.company_id
           LEFT JOIN users actor ON actor.id = e.created_by AND actor.company_id = e.company_id
           LEFT JOIN dealer_motor_spks s ON s.id = e.spk_id AND s.company_id = e.company_id
           WHERE e.company_id = $1 AND ($2::boolean OR u.branch_id = $3)
           ORDER BY e.created_at DESC, e.id DESC LIMIT 500`,
          [req.user.company_id, canViewAllBranches, req.user.branch_id],
        );
        const intakeMovements = intakes.rows.map((intake) => ({
          id: `intake-${intake.id}`,
          eventType: 'received',
          note: `Penerimaan ${intake.quantityReceived} unit; ${intake.quantityRemaining} menunggu inspeksi.`,
          details: { quantityReceived: intake.quantityReceived, quantityRemaining: intake.quantityRemaining },
          quantity: intake.quantityReceived,
          createdAt: intake.createdAt,
          brand: intake.brand,
          model: intake.model,
          specification: intake.specification,
          frameNumber: null,
          branchName: intake.branchName,
          createdByName: intake.createdByName,
          spkNumber: null,
        }));
        const movementRows = [...movements.rows, ...intakeMovements]
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
          .slice(0, 500);
        res.json({
          units: result.rows,
          intakes: intakes.rows,
          summary: summary.rows[0],
          movements: movementRows,
        });
      } catch (error) {
        next(error);
      }
    });

  router.patch('/units/:id/pdi', authenticate, requireTenant, requireActiveTenant,
    requirePermission('pdiManage'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Unit tidak valid.' });
      const { action } = req.body || {};
      if (!['start', 'complete'].includes(action)) {
        return res.status(400).json({ message: 'Tindakan PDI tidak valid.' });
      }
      const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      if (note.length > 500) return res.status(400).json({ message: 'Catatan PDI maksimal 500 karakter.' });
      try {
        const unit = await withTransaction(pool, async (client) => {
          const canViewAllBranches = req.user.permissions.includes('unitManage')
            || req.user.permissions.includes('branchManage');
          const current = await client.query(
            `SELECT id, branch_id AS "branchId", stock_status AS "stockStatus",
                    pdi_status AS "pdiStatus"
             FROM dealer_motor_units
             WHERE id = $1 AND company_id = $2 AND ($3::boolean OR branch_id = $4)
             FOR UPDATE`,
            [req.params.id, req.user.company_id, canViewAllBranches, req.user.branch_id],
          );
          if (!current.rowCount) throw invalid('Unit tidak ditemukan atau di luar cabang Anda.', 404);
          const existing = current.rows[0];
          const allowedStockStatuses = ['available', 'reserved', 'approved_for_delivery'];
          if (!allowedStockStatuses.includes(existing.stockStatus)) {
            throw invalid('PDI hanya dapat dilakukan pada unit stok yang belum dikirim.', 409);
          }
          if (action === 'start' && existing.pdiStatus !== 'pending') {
            throw invalid('PDI hanya dapat dimulai dari status menunggu.', 409);
          }
          if (action === 'complete' && existing.pdiStatus !== 'in_progress') {
            throw invalid('Mulai PDI sebelum menyelesaikan inspeksi.', 409);
          }
          const nextStatus = action === 'start' ? 'in_progress' : 'completed';
          const updated = await client.query(
            `UPDATE dealer_motor_units
             SET pdi_status = $1, status_updated_at = now(), updated_at = now()
             WHERE id = $2 AND company_id = $3
             RETURNING id, branch_id AS "branchId", stock_status AS "stockStatus",
                       pdi_status AS "pdiStatus"`,
            [nextStatus, req.params.id, req.user.company_id],
          );
          await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, created_by, event_type, note, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.user.company_id,
              req.params.id,
              req.user.id,
              action === 'start' ? 'pdi_started' : 'pdi_completed',
              action === 'start' ? 'PDI dimulai' : (note || 'PDI selesai'),
              JSON.stringify(note ? { note } : {}),
            ],
          );
          return updated.rows[0];
        });
        res.json({ unit });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.post('/units', authenticate, requireTenant, requireActiveTenant,
    requirePermission('unitManage'), async (req, res, next) => {
      try {
        const unit = normalizeUnit(req.body);
        const branch = await pool.query(
          'SELECT id, name FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
          [unit.branchId, req.user.company_id],
        );
        if (!branch.rowCount) return res.status(400).json({ message: 'Cabang unit motor tidak valid.' });
        if (unit.identifiersPending) {
          const intake = await pool.query(
            `INSERT INTO dealer_motor_stock_intakes
               (company_id, branch_id, created_by, brand, model, specification, model_year,
                color, otr_price, stock_origin, stock_entry_date, vehicle_category,
                receiving_invoice, supplier_name, quantity_received, quantity_remaining)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
             RETURNING id, branch_id AS "branchId", brand, model, specification,
                       model_year AS "modelYear", color, otr_price AS "otrPrice",
                       stock_origin AS "stockOrigin",
                       to_char(stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                       vehicle_category AS "vehicleCategory",
                       receiving_invoice AS "receivingInvoice", supplier_name AS "supplierName",
                       quantity_received AS "quantityReceived",
                       quantity_remaining AS "quantityRemaining", status,
                       created_at AS "createdAt"`,
            [req.user.company_id, unit.branchId, req.user.id, unit.brand, unit.model,
              unit.specification, unit.modelYear, unit.color, unit.otrPrice, unit.stockOrigin,
              unit.stockEntryDate, unit.vehicleCategory, unit.receivingInvoice,
              unit.supplierName, unit.quantity],
          );
          const savedIntake = {
            ...intake.rows[0],
            branchName: branch.rows[0].name,
            createdByName: req.user.name,
          };
          res.status(201).json({
            intake: savedIntake,
            movement: {
              ...savedIntake,
              id: `intake-${savedIntake.id}`,
              eventType: 'received',
              note: `Penerimaan ${savedIntake.quantityReceived} unit; menunggu inspeksi.`,
              details: { quantityReceived: savedIntake.quantityReceived },
              quantity: savedIntake.quantityReceived,
              createdAt: savedIntake.createdAt,
              spkNumber: null,
            },
          });
          return;
        }
        const result = await withTransaction(pool, async (client) => {
          const inserted = await client.query(
            `INSERT INTO dealer_motor_units
               (company_id, branch_id, created_by, brand, model, specification, model_year,
                color, frame_number, engine_number, otr_price, stock_origin, stock_entry_date,
                vehicle_category, receiving_invoice, supplier_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id, branch_id AS "branchId", brand, model, specification,
                       model_year AS "modelYear", color, frame_number AS "frameNumber",
                       engine_number AS "engineNumber", otr_price AS "otrPrice",
                       stock_origin AS "stockOrigin", stock_status AS "stockStatus",
                       vehicle_category AS "vehicleCategory",
                       receiving_invoice AS "receivingInvoice",
                       supplier_name AS "supplierName",
                       to_char(stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                       status_updated_at AS "statusUpdatedAt", created_at AS "createdAt"`,
            [req.user.company_id, unit.branchId, req.user.id, unit.brand, unit.model,
              unit.specification, unit.modelYear, unit.color, unit.frameNumber,
              unit.engineNumber, unit.otrPrice, unit.stockOrigin, unit.stockEntryDate,
              unit.vehicleCategory, unit.receivingInvoice, unit.supplierName],
          );
          const event = await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, created_by, event_type, note)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, unit_id AS "unitId", event_type AS "eventType",
                       note, details, created_at AS "createdAt"`,
            [req.user.company_id, inserted.rows[0].id, req.user.id, unit.stockOrigin,
              unit.stockOrigin === 'opening' ? 'Saldo stok awal' : 'Motor masuk'],
          );
          return { ...inserted.rows[0], movement: event.rows[0] };
        });
        const { movement, ...insertedUnit } = result;
        res.status(201).json({
          unit: { ...insertedUnit, branchName: branch.rows[0].name },
          movement: {
            ...movement,
            ...insertedUnit,
            branchName: branch.rows[0].name,
            createdByName: req.user.name,
            spkNumber: null,
          },
        });
      } catch (error) {
        if (error.code === '23505') {
          return res.status(409).json({ message: 'Nomor rangka atau nomor mesin sudah tercatat di workspace ini.' });
        }
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.post('/intakes/:id/units', authenticate, requireTenant, requireActiveTenant,
    requirePermission('unitManage'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'Penerimaan stok tidak valid.' });
      const frameNumber = typeof req.body.frameNumber === 'string'
        ? req.body.frameNumber.trim().toUpperCase() : '';
      const engineNumber = typeof req.body.engineNumber === 'string'
        ? req.body.engineNumber.trim().toUpperCase() : '';
      if (!frameNumber || frameNumber.length > 80 || !engineNumber || engineNumber.length > 80) {
        return res.status(400).json({ message: 'Nomor rangka dan nomor mesin wajib diisi.' });
      }
      try {
        const result = await withTransaction(pool, async (client) => {
          const intakeResult = await client.query(
            `SELECT id, branch_id AS "branchId", brand, model, specification,
                    model_year AS "modelYear", color, otr_price AS "otrPrice",
                    stock_origin AS "stockOrigin",
                    to_char(stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                    vehicle_category AS "vehicleCategory",
                    receiving_invoice AS "receivingInvoice", supplier_name AS "supplierName",
                    quantity_remaining AS "quantityRemaining"
             FROM dealer_motor_stock_intakes
             WHERE id = $1 AND company_id = $2 AND status = 'pending'
             FOR UPDATE`,
            [req.params.id, req.user.company_id],
          );
          if (!intakeResult.rowCount || intakeResult.rows[0].quantityRemaining < 1) {
            throw invalid('Penerimaan ini tidak memiliki unit yang menunggu inspeksi.', 409);
          }
          const intake = intakeResult.rows[0];
          const inserted = await client.query(
            `INSERT INTO dealer_motor_units
               (company_id, branch_id, created_by, brand, model, specification, model_year,
                color, frame_number, engine_number, otr_price, stock_origin, stock_entry_date,
                vehicle_category, receiving_invoice, supplier_name, stock_intake_id, inspection_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'inspected')
             RETURNING id, branch_id AS "branchId", brand, model, specification,
                       model_year AS "modelYear", color, frame_number AS "frameNumber",
                       engine_number AS "engineNumber", otr_price AS "otrPrice",
                       stock_origin AS "stockOrigin", stock_status AS "stockStatus",
                       inspection_status AS "inspectionStatus", vehicle_category AS "vehicleCategory",
                       stock_intake_id AS "stockIntakeId",
                       receiving_invoice AS "receivingInvoice", supplier_name AS "supplierName",
                       to_char(stock_entry_date, 'YYYY-MM-DD') AS "stockEntryDate",
                       status_updated_at AS "statusUpdatedAt", created_at AS "createdAt"`,
            [req.user.company_id, intake.branchId, req.user.id, intake.brand, intake.model,
              intake.specification, intake.modelYear, intake.color, frameNumber, engineNumber,
              intake.otrPrice, intake.stockOrigin, intake.stockEntryDate, intake.vehicleCategory,
              intake.receivingInvoice, intake.supplierName, intake.id],
          );
          const remaining = intake.quantityRemaining - 1;
          const updatedIntake = await client.query(
            `UPDATE dealer_motor_stock_intakes
             SET quantity_remaining = $1, status = $2, updated_at = now()
             WHERE id = $3 AND company_id = $4
             RETURNING id, quantity_received AS "quantityReceived",
                       quantity_remaining AS "quantityRemaining", status`,
            [remaining, remaining === 0 ? 'completed' : 'pending', req.params.id, req.user.company_id],
          );
          const event = await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, created_by, event_type, note)
             VALUES ($1, $2, $3, 'inspection_completed', 'Inspeksi selesai; nomor rangka dan mesin telah dicatat.')
             RETURNING id, event_type AS "eventType", note, details, created_at AS "createdAt"`,
            [req.user.company_id, inserted.rows[0].id, req.user.id],
          );
          const branch = await client.query(
            'SELECT name FROM business_branches WHERE id = $1 AND company_id = $2',
            [intake.branchId, req.user.company_id],
          );
          const unit = { ...inserted.rows[0], branchName: branch.rows[0].name };
          return {
            unit,
            intake: { id: req.params.id, ...updatedIntake.rows[0] },
            movement: {
              ...event.rows[0],
              ...unit,
              createdByName: req.user.name,
              spkNumber: null,
            },
          };
        });
        res.status(201).json(result);
      } catch (error) {
        if (error.code === '23505') {
          return res.status(409).json({ message: 'Nomor rangka atau nomor mesin sudah tercatat di workspace ini.' });
        }
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.get('/spks', authenticate, requireTenant, requireActiveTenant, async (req, res, next) => {
    const scope = String(req.query.scope || 'all');
    const requiredPermission = {
      all: 'spkViewAll',
      mine: 'spkViewOwn',
      verify: 'spkVerify',
      approval: 'spkApprove',
    }[scope];
    if (!requiredPermission) return res.status(400).json({ message: 'Filter SPK tidak valid.' });
    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({ message: 'Akses daftar SPK tidak diizinkan.' });
    }
    const scopeClause = {
      all: 'true',
      mine: 's.submitted_by = $2',
      verify: "s.status = 'SUBMITTED'",
      approval: "s.status = 'APPROVAL SVP'",
    }[scope];
    try {
      const result = await pool.query(
        `SELECT s.id, s.spk_number AS "spkNumber", s.customer_name AS "customerName",
                s.customer_nik AS "customerNik",
                s.customer_phone AS "customerPhone", s.customer_address AS "customerAddress",
                s.sales_name AS "salesName", s.amount, s.status,
                to_char(s.created_at, 'DD Mon YYYY') AS "createdDate",
                s.unit_id AS "unitId", s.branch_id AS "branchId", b.name AS "branchName", s.details,
                s.delivery_status AS "deliveryStatus", s.driver_id AS "driverId",
                s.waybill_number AS "waybillNumber", s.waybill_issued_at AS "waybillIssuedAt",
                s.delivery_scheduled_at AS "deliveryScheduledAt",
                u.pdi_status AS "pdiStatus",
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'previousScheduledAt', h.previous_scheduled_at,
                    'scheduledAt', h.scheduled_at,
                    'createdAt', h.created_at,
                    'changedByName', actor.name
                  ) ORDER BY h.created_at DESC)
                  FROM dealer_motor_delivery_schedule_history h
                  LEFT JOIN users actor
                    ON actor.id = h.changed_by AND actor.company_id = h.company_id
                  WHERE h.company_id = s.company_id AND h.spk_id = s.id
                ), '[]'::jsonb) AS "deliveryScheduleHistory",
                driver.name AS "driverName", s.delivery_latitude AS "deliveryLatitude",
                s.delivery_longitude AS "deliveryLongitude", s.delivered_at AS "deliveredAt",
                u.brand, u.model, u.specification, u.model_year AS "modelYear",
                u.color, u.frame_number AS "frameNumber", u.engine_number AS "engineNumber",
                u.otr_price AS "otrPrice"
         FROM dealer_motor_spks s
         JOIN dealer_motor_units u ON u.id = s.unit_id AND u.company_id = s.company_id
         JOIN business_branches b ON b.id = s.branch_id AND b.company_id = s.company_id
         LEFT JOIN users driver ON driver.id = s.driver_id AND driver.company_id = s.company_id
         WHERE s.company_id = $1 AND ${scopeClause}
         ORDER BY s.created_at DESC LIMIT 1000`,
        scope === 'mine' ? [req.user.company_id, req.user.id] : [req.user.company_id],
      );
      res.json({ spks: result.rows.map(shapeSpk) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/sales-targets', authenticate, requireTenant, requireActiveTenant,
    requirePermission('targetManage'), async (req, res, next) => {
      const month = String(req.query.month || '');
      const periodStart = `${month}-01`;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validDate(periodStart)) {
        return res.status(400).json({ message: 'Periode target tidak valid.' });
      }
      const canViewAllBranches = req.user.permissions.includes('branchManage');
      try {
        const [targets, salespeople] = await Promise.all([
          pool.query(
            `SELECT t.id, to_char(t.period_start, 'YYYY-MM') AS month,
                    t.scope_type AS "scopeType", t.branch_id AS "branchId",
                    b.name AS "branchName", t.sales_name AS "salesName",
                    t.unit_target AS "unitTarget", t.revenue_target AS "revenueTarget",
                    COALESCE(actual.unit_count, 0)::int AS "actualUnitCount",
                    COALESCE(actual.revenue, 0)::text AS "actualRevenue"
             FROM dealer_motor_sales_targets t
             LEFT JOIN business_branches b
               ON b.id = t.branch_id AND b.company_id = t.company_id
             LEFT JOIN LATERAL (
               SELECT COUNT(*)::int AS unit_count, COALESCE(SUM(s.amount), 0) AS revenue
               FROM dealer_motor_spks s
               WHERE s.company_id = t.company_id
                 AND s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')
                 AND s.created_at >= (t.period_start::timestamp AT TIME ZONE 'Asia/Jakarta')
                 AND s.created_at < ((t.period_start + interval '1 month')::timestamp
                                     AT TIME ZONE 'Asia/Jakarta')
                 AND (t.branch_id IS NULL OR s.branch_id = t.branch_id)
                 AND ($3::boolean OR s.branch_id = $4)
                 AND (t.sales_name IS NULL OR lower(btrim(s.sales_name)) = lower(btrim(t.sales_name)))
             ) actual ON true
             WHERE t.company_id = $1 AND t.period_start = $2::date
               AND ($3::boolean OR t.branch_id IS NULL OR t.branch_id = $4)
             ORDER BY t.scope_type, b.name NULLS FIRST, t.sales_name NULLS FIRST`,
            [req.user.company_id, periodStart, canViewAllBranches, req.user.branch_id],
          ),
          pool.query(
            `SELECT DISTINCT s.sales_name AS name
             FROM dealer_motor_spks s
             WHERE s.company_id = $1 AND ($2::boolean OR s.branch_id = $3)
             ORDER BY s.sales_name`,
            [req.user.company_id, canViewAllBranches, req.user.branch_id],
          ),
        ]);
        res.json({ month, targets: targets.rows, salespeople: salespeople.rows.map((row) => row.name) });
      } catch (error) {
        next(error);
      }
    });

  router.put('/sales-targets', authenticate, requireTenant, requireActiveTenant,
    requirePermission('targetManage'), async (req, res, next) => {
      const {
        month,
        scopeType,
        branchId: requestedBranchId,
        salesName: requestedSalesName,
        unitTarget: rawUnitTarget,
        revenueTarget: rawRevenueTarget,
      } = req.body || {};
      const periodStart = `${String(month || '')}-01`;
      const validScopeTypes = ['company', 'branch', 'salesperson', 'branch_salesperson'];
      const needsBranch = ['branch', 'branch_salesperson'].includes(scopeType);
      const needsSalesperson = ['salesperson', 'branch_salesperson'].includes(scopeType);
      const branchId = needsBranch ? String(requestedBranchId || '') : null;
      const salesName = needsSalesperson
        ? (typeof requestedSalesName === 'string' ? requestedSalesName.trim() : '')
        : null;
      const unitTarget = Number(rawUnitTarget);
      const revenueTarget = Number(rawRevenueTarget);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))
        || !validDate(periodStart)
        || !validScopeTypes.includes(scopeType)
        || (needsBranch && !uuidPattern.test(branchId))
        || (needsSalesperson && (!salesName || salesName.length > 160))
        || !Number.isSafeInteger(unitTarget) || unitTarget < 0
        || !Number.isSafeInteger(revenueTarget) || revenueTarget < 0) {
        return res.status(400).json({ message: 'Data target penjualan tidak valid.' });
      }
      const canManageAllBranches = req.user.permissions.includes('branchManage');
      if (!canManageAllBranches && ['company', 'salesperson'].includes(scopeType)) {
        return res.status(403).json({ message: 'Cakupan target seluruh perusahaan hanya dapat diatur pengelola workspace.' });
      }
      if (branchId && !canManageAllBranches && branchId !== req.user.branch_id) {
        return res.status(403).json({ message: 'Anda hanya dapat mengatur target cabang sendiri.' });
      }
      try {
        if (branchId) {
          const branch = await pool.query(
            'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2',
            [branchId, req.user.company_id],
          );
          if (!branch.rowCount) return res.status(404).json({ message: 'Cabang tidak ditemukan di workspace ini.' });
        }
        const scopeKey = scopeType === 'company'
          ? 'company'
          : scopeType === 'branch'
            ? `branch:${branchId}`
            : scopeType === 'salesperson'
              ? `sales:${salesName.toLowerCase()}`
              : `branch:${branchId}:sales:${salesName.toLowerCase()}`;
        const result = await pool.query(
          `INSERT INTO dealer_motor_sales_targets
             (company_id, period_start, scope_type, scope_key, branch_id, sales_name,
              unit_target, revenue_target, created_by, updated_by)
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $9)
           ON CONFLICT (company_id, period_start, scope_key)
           DO UPDATE SET scope_type = EXCLUDED.scope_type,
                         branch_id = EXCLUDED.branch_id,
                         sales_name = EXCLUDED.sales_name,
                         unit_target = EXCLUDED.unit_target,
                         revenue_target = EXCLUDED.revenue_target,
                         updated_by = EXCLUDED.updated_by,
                         updated_at = now()
           RETURNING id`,
          [
            req.user.company_id, periodStart, scopeType, scopeKey, branchId, salesName,
            unitTarget, revenueTarget, req.user.id,
          ],
        );
        res.json({ id: result.rows[0].id, month, scopeType, branchId, salesName, unitTarget, revenueTarget });
      } catch (error) {
        next(error);
      }
    });

  router.get('/sales-report', authenticate, requireTenant, requireActiveTenant,
    requirePermission('reportsView'), async (req, res, next) => {
      const from = String(req.query.from || '');
      const to = String(req.query.to || '');
      const requestedBranchId = String(req.query.branchId || '');
      if (!validDate(from) || !validDate(to) || from > to) {
        return res.status(400).json({ message: 'Rentang tanggal laporan tidak valid.' });
      }
      if (requestedBranchId && !uuidPattern.test(requestedBranchId)) {
        return res.status(400).json({ message: 'Filter cabang tidak valid.' });
      }
      const canViewAllBranches = req.user.permissions.includes('branchManage');
      if (!canViewAllBranches && !req.user.branch_id) {
        return res.status(403).json({ message: 'Akun ini belum memiliki cabang untuk melihat laporan.' });
      }
      if (!canViewAllBranches && requestedBranchId && requestedBranchId !== req.user.branch_id) {
        return res.status(403).json({ message: 'Anda hanya dapat melihat laporan cabang sendiri.' });
      }
      const branchId = canViewAllBranches ? (requestedBranchId || null) : req.user.branch_id;
      try {
        if (requestedBranchId) {
          const branch = await pool.query(
            'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2',
            [requestedBranchId, req.user.company_id],
          );
          if (!branch.rowCount) return res.status(404).json({ message: 'Cabang tidak ditemukan di workspace ini.' });
        }
        const params = [req.user.company_id, from, to, branchId];
        const dateBounds = `s.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Jakarta')
          AND s.created_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
          AND ($4::uuid IS NULL OR s.branch_id = $4)`;
        const [summary, daily, branches, salespeople, records] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS "spkCount",
                    COUNT(*) FILTER (WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI'))::int
                      AS "salesCount",
                    COALESCE(SUM(s.amount) FILTER (
                      WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0)::text AS revenue,
                    COUNT(*) FILTER (WHERE s.status = 'SELESAI')::int AS "deliveredCount",
                    COUNT(*) FILTER (WHERE s.status = 'DITOLAK')::int AS "rejectedCount",
                    COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED', 'APPROVAL SVP'))::int AS "pendingCount"
             FROM dealer_motor_spks s
             WHERE s.company_id = $1 AND ${dateBounds}`,
            params,
          ),
          pool.query(
            `SELECT to_char(s.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
                    COUNT(*)::int AS "spkCount",
                    COUNT(*) FILTER (WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI'))::int
                      AS "salesCount",
                    COALESCE(SUM(s.amount) FILTER (
                      WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0)::text AS revenue
             FROM dealer_motor_spks s
             WHERE s.company_id = $1 AND ${dateBounds}
             GROUP BY date ORDER BY date`,
            params,
          ),
          pool.query(
            `SELECT s.branch_id AS "branchId", b.name AS "branchName",
                    COUNT(*)::int AS "spkCount",
                    COUNT(*) FILTER (WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI'))::int
                      AS "salesCount",
                    COALESCE(SUM(s.amount) FILTER (
                      WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0)::text AS revenue
             FROM dealer_motor_spks s
             JOIN business_branches b ON b.id = s.branch_id AND b.company_id = s.company_id
             WHERE s.company_id = $1 AND ${dateBounds}
             GROUP BY s.branch_id, b.name
             ORDER BY COALESCE(SUM(s.amount) FILTER (
               WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0) DESC, b.name`,
            params,
          ),
          pool.query(
            `SELECT s.sales_name AS "salesName", s.branch_id AS "branchId", b.name AS "branchName",
                    COUNT(*)::int AS "spkCount",
                    COUNT(*) FILTER (WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI'))::int
                      AS "salesCount",
                    COALESCE(SUM(s.amount) FILTER (
                      WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0)::text AS revenue
             FROM dealer_motor_spks s
             JOIN business_branches b ON b.id = s.branch_id AND b.company_id = s.company_id
             WHERE s.company_id = $1 AND ${dateBounds}
             GROUP BY s.sales_name, s.branch_id, b.name
             ORDER BY COALESCE(SUM(s.amount) FILTER (
               WHERE s.status IN ('DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI')), 0) DESC, s.sales_name`,
            params,
          ),
          pool.query(
            `SELECT s.id, s.spk_number AS "spkNumber", s.customer_name AS "customerName",
                    s.sales_name AS "salesName", s.status, s.amount,
                    to_char(s.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
                    b.name AS "branchName", u.brand, u.model, u.specification
             FROM dealer_motor_spks s
             JOIN business_branches b ON b.id = s.branch_id AND b.company_id = s.company_id
             JOIN dealer_motor_units u ON u.id = s.unit_id AND u.company_id = s.company_id
             WHERE s.company_id = $1 AND ${dateBounds}
             ORDER BY s.created_at DESC, s.id DESC LIMIT 1000`,
            params,
          ),
        ]);
        res.json({
          from,
          to,
          branchId,
          summary: summary.rows[0],
          daily: daily.rows,
          branches: branches.rows,
          salespeople: salespeople.rows,
          records: records.rows,
        });
      } catch (error) {
        next(error);
      }
    });

  router.post('/spks', authenticate, requireTenant, requireActiveTenant,
    requirePermission('spkCreate'), async (req, res, next) => {
      const { unitId, customerName, customerNik, customerPhone, customerAddress, details = {} } = req.body;
      if (!uuidPattern.test(String(unitId || ''))
        || typeof customerName !== 'string' || !customerName.trim() || customerName.trim().length > 160
        || typeof customerNik !== 'string' || !/^\d{16}$/.test(customerNik)
        || typeof customerPhone !== 'string' || !customerPhone.trim() || customerPhone.trim().length > 30
        || typeof customerAddress !== 'string' || !customerAddress.trim() || customerAddress.trim().length > 500
        || !details || typeof details !== 'object' || Array.isArray(details)
        || !validDate(details.date)) {
        return res.status(400).json({ message: 'Data SPK tidak valid.' });
      }
      try {
        const result = await withTransaction(pool, async (client) => {
          const unitResult = await client.query(
            `SELECT u.id, u.branch_id AS "branchId", b.name AS "branchName",
                    u.brand, u.model, u.specification, u.model_year AS "modelYear",
                    u.color, u.frame_number AS "frameNumber", u.engine_number AS "engineNumber",
                    u.otr_price AS "otrPrice", u.stock_status AS "stockStatus"
             FROM dealer_motor_units u
             JOIN business_branches b ON b.id = u.branch_id AND b.company_id = u.company_id
             WHERE u.id = $1 AND u.company_id = $2
               AND ($3::boolean OR u.branch_id = $4)
             FOR UPDATE OF u`,
            [unitId, req.user.company_id, req.user.permissions.includes('unitManage'), req.user.branch_id],
          );
          if (!unitResult.rowCount || unitResult.rows[0].stockStatus !== 'available') {
            throw invalid('Unit motor tidak tersedia untuk SPK.', 409);
          }
          const unit = unitResult.rows[0];
          const salesName = req.user.role === 'SALES'
            ? req.user.name
            : typeof req.body.salesName === 'string' && req.body.salesName.trim()
              ? req.body.salesName.trim().slice(0, 120)
              : req.user.name;
          const spkNumber = await allocateSpkNumber(client, req.user.company_id, details.date);
          const inserted = await client.query(
            `INSERT INTO dealer_motor_spks
               (company_id, branch_id, unit_id, spk_number, submitted_by, sales_name,
                customer_name, customer_nik, customer_phone, customer_address, amount, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, spk_number AS "spkNumber", customer_name AS "customerName",
                       customer_phone AS "customerPhone", customer_address AS "customerAddress",
                       sales_name AS "salesName", amount, status,
                       to_char(created_at, 'DD Mon YYYY') AS "createdDate",
                       unit_id AS "unitId", branch_id AS "branchId", details,
                       delivery_status AS "deliveryStatus", driver_id AS "driverId",
                       delivery_latitude AS "deliveryLatitude",
                       delivery_longitude AS "deliveryLongitude", delivered_at AS "deliveredAt"`,
            [req.user.company_id, unit.branchId, unit.id, spkNumber, req.user.id, salesName,
              customerName.trim(), customerNik, customerPhone.trim(), customerAddress.trim(),
              unit.otrPrice, JSON.stringify(details)],
          );
          const reserved = await client.query(
            `UPDATE dealer_motor_units
             SET stock_status = 'reserved', status_updated_at = now(), updated_at = now()
             WHERE id = $1 AND company_id = $2 AND stock_status = 'available'
             RETURNING stock_status AS "stockStatus", status_updated_at AS "statusUpdatedAt"`,
            [unit.id, req.user.company_id],
          );
          if (!reserved.rowCount) throw invalid('Unit motor sudah dipakai pada SPK lain.', 409);
          const movement = await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, spk_id, created_by, event_type, note)
             VALUES ($1, $2, $3, $4, 'reserved_for_spk', 'Unit direservasi untuk SPK menunggu verifikasi')
             RETURNING id, event_type AS "eventType", note, details, created_at AS "createdAt"`,
            [req.user.company_id, unit.id, inserted.rows[0].id, req.user.id],
          );
          return {
            spk: shapeSpk({ ...unit, ...inserted.rows[0], unitId: unit.id }),
            unitStatus: reserved.rows[0],
            movement: {
              ...movement.rows[0],
              ...unit,
              branchName: unit.branchName,
              createdByName: req.user.name,
              spkNumber,
            },
          };
        });
        res.status(201).json(result);
      } catch (error) {
        if (error.code === '23505') return res.status(409).json({ message: 'Nomor SPK sudah digunakan.' });
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.patch('/spks/:id/verify', authenticate, requireTenant, requireActiveTenant,
    requirePermission('spkVerify'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      try {
        const result = await pool.query(
          `UPDATE dealer_motor_spks
           SET status = 'APPROVAL SVP', verified_by = $1, updated_at = now()
           WHERE id = $2 AND company_id = $3 AND status = 'SUBMITTED'
           RETURNING spk_number AS "spkNumber", status`,
          [req.user.id, req.params.id, req.user.company_id],
        );
        if (!result.rowCount) return res.status(409).json({ message: 'SPK sudah diproses atau tidak ditemukan.' });
        res.json({ spk: result.rows[0] });
      } catch (error) {
        next(error);
      }
    });

  router.patch('/spks/:id/reject', authenticate, requireTenant, requireActiveTenant,
    requirePermission('spkVerify', 'spkApprove'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      if (reason.length > 300) return res.status(400).json({ message: 'Alasan penolakan terlalu panjang.' });
      try {
        const rejected = await withTransaction(pool, async (client) => {
          const result = await client.query(
            `SELECT id, unit_id AS "unitId", status
             FROM dealer_motor_spks
             WHERE id = $1 AND company_id = $2
             FOR UPDATE`,
            [req.params.id, req.user.company_id],
          );
          if (!result.rowCount) throw invalid('SPK tidak ditemukan.', 404);
          const spk = result.rows[0];
          const canReject = (spk.status === 'SUBMITTED' && req.user.permissions.includes('spkVerify'))
            || (spk.status === 'APPROVAL SVP' && req.user.permissions.includes('spkApprove'));
          if (!canReject) throw invalid('SPK tidak dapat ditolak pada tahap ini.', 403);

          const updated = await client.query(
            `UPDATE dealer_motor_spks
             SET status = 'DITOLAK', updated_at = now()
             WHERE id = $1 AND company_id = $2 AND status = $3
             RETURNING id, spk_number AS "spkNumber", status`,
            [spk.id, req.user.company_id, spk.status],
          );
          if (!updated.rowCount) throw invalid('Status SPK sudah berubah.', 409);

          let unitStatus = null;
          const unit = await client.query(
            `SELECT id, stock_status AS "stockStatus"
             FROM dealer_motor_units
             WHERE id = $1 AND company_id = $2
             FOR UPDATE`,
            [spk.unitId, req.user.company_id],
          );
          if (!unit.rowCount) throw invalid('Unit motor tidak ditemukan.', 404);
          const otherPendingSpk = await client.query(
            `SELECT 1 FROM dealer_motor_spks
             WHERE company_id = $1 AND unit_id = $2 AND id <> $3
               AND status IN ('SUBMITTED', 'APPROVAL SVP')
             LIMIT 1`,
            [req.user.company_id, spk.unitId, spk.id],
          );
          if (!otherPendingSpk.rowCount && unit.rows[0].stockStatus === 'reserved') {
            const released = await client.query(
              `UPDATE dealer_motor_units
               SET stock_status = 'available', status_updated_at = now(), updated_at = now()
               WHERE id = $1 AND company_id = $2 AND stock_status = 'reserved'
               RETURNING stock_status AS "stockStatus", status_updated_at AS "statusUpdatedAt"`,
              [spk.unitId, req.user.company_id],
            );
            if (released.rowCount) {
              unitStatus = released.rows[0];
              await client.query(
                `INSERT INTO dealer_motor_unit_events
                   (company_id, unit_id, spk_id, created_by, event_type, note, details)
                 VALUES ($1, $2, $3, $4, 'reservation_released',
                         'Unit dikembalikan ke stok setelah SPK ditolak', $5)`,
                [req.user.company_id, spk.unitId, spk.id, req.user.id, JSON.stringify({ reason })],
              );
            }
          }
          return { ...updated.rows[0], unitStatus };
        });
        res.json({ spk: rejected });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.patch('/spks/:id/approve', authenticate, requireTenant, requireActiveTenant,
    requirePermission('spkApprove'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      try {
        const result = await withTransaction(pool, async (client) => {
          const spkResult = await client.query(
            `SELECT id, spk_number AS "spkNumber", unit_id FROM dealer_motor_spks
             WHERE id = $1 AND company_id = $2 AND status = 'APPROVAL SVP'
             FOR UPDATE`,
            [req.params.id, req.user.company_id],
          );
          if (!spkResult.rowCount) throw invalid('SPK sudah diproses atau tidak ditemukan.', 409);
          const unitResult = await client.query(
            `SELECT id FROM dealer_motor_units
             WHERE id = $1 AND company_id = $2 AND stock_status = 'reserved'
             FOR UPDATE`,
            [spkResult.rows[0].unit_id, req.user.company_id],
          );
          if (!unitResult.rowCount) throw invalid('Unit sudah digunakan oleh SPK lain.', 409);
          const updatedUnit = await client.query(
            `UPDATE dealer_motor_units
             SET stock_status = 'approved_for_delivery', status_updated_at = now(), updated_at = now()
             WHERE id = $1 AND company_id = $2 AND stock_status = 'reserved'
             RETURNING id`,
            [unitResult.rows[0].id, req.user.company_id],
          );
          if (!updatedUnit.rowCount) throw invalid('Unit motor sudah berubah status.', 409);
          const waybill = await client.query(
            `UPDATE dealer_motor_spks
             SET status = 'DISETUJUI', approved_by = $1, updated_at = now()
             WHERE id = $2 AND company_id = $3
             RETURNING waybill_number AS "waybillNumber",
                       waybill_issued_at AS "waybillIssuedAt",
                       delivery_status AS "deliveryStatus"`,
            [req.user.id, req.params.id, req.user.company_id],
          );
          await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, spk_id, created_by, event_type, note)
             VALUES ($1, $2, $3, $4, 'approved_for_delivery', 'SPK disetujui; menunggu driver')`,
            [req.user.company_id, unitResult.rows[0].id, req.params.id, req.user.id],
          );
          return {
            id: spkResult.rows[0].id,
            spkNumber: spkResult.rows[0].spkNumber,
            waybillNumber: waybill.rows[0].waybillNumber,
            waybillIssuedAt: waybill.rows[0].waybillIssuedAt,
            status: 'DISETUJUI',
            deliveryStatus: waybill.rows[0].deliveryStatus,
          };
        });
        res.json({ spk: result });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.post('/spks/:id/waybill', authenticate, requireTenant, requireActiveTenant,
    requirePermission('waybillManage'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      try {
        const spk = await withTransaction(pool, async (client) => {
          const canViewAllBranches = req.user.permissions.includes('unitManage')
            || req.user.permissions.includes('branchManage');
          const current = await client.query(
            `SELECT s.id, s.spk_number AS "spkNumber", s.status, s.waybill_number AS "waybillNumber",
                    u.pdi_status AS "pdiStatus"
             FROM dealer_motor_spks s
             JOIN dealer_motor_units u ON u.id = s.unit_id AND u.company_id = s.company_id
             WHERE s.id = $1 AND s.company_id = $2
               AND ($3::boolean OR s.branch_id = $4)
             FOR UPDATE OF s, u`,
            [req.params.id, req.user.company_id, canViewAllBranches, req.user.branch_id],
          );
          if (!current.rowCount) throw invalid('SPK tidak ditemukan atau di luar cabang Anda.', 404);
          const row = current.rows[0];
          if (row.status !== 'DISETUJUI') {
            throw invalid('Surat jalan hanya dapat dibuat setelah SPK disetujui.', 409);
          }
          if (row.pdiStatus !== 'completed') {
            throw invalid('Selesaikan inspeksi PDI unit sebelum membuat surat jalan.', 409);
          }
          if (row.waybillNumber) throw invalid('Surat jalan untuk SPK ini sudah dibuat.', 409);
          const updated = await client.query(
            `UPDATE dealer_motor_spks
             SET delivery_status = 'ready',
                 waybill_number = 'SJ-' || substring(spk_number FROM 5),
                 waybill_issued_at = now(), waybill_issued_by = $1, updated_at = now()
             WHERE id = $2 AND company_id = $3
               AND status = 'DISETUJUI' AND waybill_number IS NULL
             RETURNING id, spk_number AS "spkNumber", status,
                       delivery_status AS "deliveryStatus",
                       waybill_number AS "waybillNumber",
                       waybill_issued_at AS "waybillIssuedAt"`,
            [req.user.id, req.params.id, req.user.company_id],
          );
          if (!updated.rowCount) throw invalid('SPK sudah berubah atau surat jalan telah dibuat.', 409);
          return { ...updated.rows[0], pdiStatus: row.pdiStatus };
        });
        res.json({ spk });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.patch('/spks/:id/delivery-schedule', authenticate, requireTenant, requireActiveTenant,
    requirePermission('deliveryScheduleManage'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      const scheduledAt = typeof req.body?.scheduledAt === 'string'
        ? new Date(req.body.scheduledAt) : null;
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        return res.status(400).json({ message: 'Jadwal pengiriman harus berupa tanggal dan waktu mendatang yang valid.' });
      }
      try {
        const result = await withTransaction(pool, async (client) => {
          const current = await client.query(
            `SELECT delivery_scheduled_at AS "previousScheduledAt"
             FROM dealer_motor_spks
             WHERE id = $1 AND company_id = $2 AND status = 'DISETUJUI'
               AND delivery_status = 'ready' AND driver_id IS NULL
               AND waybill_number IS NOT NULL
             FOR UPDATE`,
            [req.params.id, req.user.company_id],
          );
          if (!current.rowCount) {
            throw invalid('Jadwal hanya dapat diubah saat pengiriman berstatus pending dan surat jalan tersedia.', 409);
          }
          const updated = await client.query(
            `UPDATE dealer_motor_spks
             SET delivery_scheduled_at = $1, updated_at = now()
             WHERE id = $2 AND company_id = $3
             RETURNING id, spk_number AS "spkNumber",
                       delivery_scheduled_at AS "deliveryScheduledAt"`,
            [scheduledAt, req.params.id, req.user.company_id],
          );
          await client.query(
            `INSERT INTO dealer_motor_delivery_schedule_history
               (company_id, spk_id, changed_by, previous_scheduled_at, scheduled_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.company_id, req.params.id, req.user.id,
              current.rows[0].previousScheduledAt, scheduledAt],
          );
          return updated.rows[0];
        });
        res.json({ spk: result });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.get('/deliveries', authenticate, requireTenant, requireActiveTenant,
    requirePermission('deliveryManage'), async (req, res, next) => {
      try {
        const canViewAllBranches = req.user.permissions.includes('branchManage')
          || req.user.permissions.includes('unitManage');
        const result = await pool.query(
          `SELECT s.id, s.spk_number AS "spkNumber", s.customer_name AS "customerName",
                  s.customer_phone AS "customerPhone", s.customer_address AS "customerAddress",
                  s.delivery_status AS "deliveryStatus", s.driver_id AS "driverId",
                  s.waybill_number AS "waybillNumber",
                  s.waybill_issued_at AS "waybillIssuedAt",
                  s.delivery_scheduled_at AS "deliveryScheduledAt",
                  s.created_at AS "createdAt", u.brand, u.model, u.specification,
                  u.model_year AS "modelYear", u.color,
                  u.frame_number AS "frameNumber", u.engine_number AS "engineNumber",
                  driver.name AS "driverName"
           FROM dealer_motor_spks s
           JOIN dealer_motor_units u ON u.id = s.unit_id AND u.company_id = s.company_id
           LEFT JOIN users driver ON driver.id = s.driver_id AND driver.company_id = s.company_id
           WHERE s.company_id = $1 AND s.waybill_number IS NOT NULL
             AND s.delivery_status IN ('ready', 'in_delivery')
             AND (s.driver_id IS NULL OR s.driver_id = $2)
             AND ($3::boolean OR s.branch_id = $4)
           ORDER BY s.created_at`,
          [req.user.company_id, req.user.id, canViewAllBranches, req.user.branch_id],
        );
        res.json({ deliveries: result.rows });
      } catch (error) {
        next(error);
      }
    });

  router.patch('/spks/:id/claim-delivery', authenticate, requireTenant, requireActiveTenant,
    requirePermission('deliveryManage'), async (req, res, next) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
      try {
        const canViewAllBranches = req.user.permissions.includes('branchManage')
          || req.user.permissions.includes('unitManage');
        const delivery = await withTransaction(pool, async (client) => {
          const result = await client.query(
            `SELECT id, unit_id FROM dealer_motor_spks
             WHERE id = $1 AND company_id = $2 AND delivery_status = 'ready'
               AND waybill_number IS NOT NULL AND driver_id IS NULL
               AND ($3::boolean OR branch_id = $4)
             FOR UPDATE`,
            [req.params.id, req.user.company_id, canViewAllBranches, req.user.branch_id],
          );
          if (!result.rowCount) throw invalid('Pengiriman sudah diambil atau tidak tersedia.', 409);
          const activeTask = await client.query(
            `SELECT id FROM dealer_motor_spks
             WHERE company_id = $1 AND driver_id = $2 AND delivery_status = 'in_delivery'
             LIMIT 1`,
            [req.user.company_id, req.user.id],
          );
          if (activeTask.rowCount) throw invalid('Selesaikan tugas pengiriman yang sedang Anda tangani sebelum mengambil tugas baru.', 409);
          await client.query(
            `UPDATE dealer_motor_spks
             SET delivery_status = 'in_delivery', status = 'DALAM PENGIRIMAN',
                 driver_id = $1, updated_at = now()
             WHERE id = $2 AND company_id = $3`,
            [req.user.id, req.params.id, req.user.company_id],
          );
          const updatedUnit = await client.query(
            `UPDATE dealer_motor_units
             SET stock_status = 'in_delivery', status_updated_at = now(), updated_at = now()
             WHERE id = $1 AND company_id = $2 AND stock_status = 'approved_for_delivery'`,
            [result.rows[0].unit_id, req.user.company_id],
          );
          if (!updatedUnit.rowCount) throw invalid('Status stok unit tidak sesuai dengan pengiriman.', 409);
          await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, spk_id, created_by, event_type, note)
             VALUES ($1, $2, $3, $4, 'in_delivery', 'Driver mengambil pengiriman')`,
            [req.user.company_id, result.rows[0].unit_id, req.params.id, req.user.id],
          );
          return { id: req.params.id, status: 'DALAM PENGIRIMAN', deliveryStatus: 'in_delivery' };
        });
        res.json({ delivery });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.post('/spks/:id/delivery-proof', authenticate, requireTenant, requireActiveTenant,
    requirePermission('deliveryManage'), photoUpload, async (req, res, next) => {
      let storedPath = '';
      try {
        if (!uuidPattern.test(req.params.id)) throw invalid('SPK tidak valid.');
        if (!req.file || req.file.size > 2 * 1024 * 1024) {
          throw invalid('Foto serah-terima wajib diunggah dan maksimal 2 MB.');
        }
        const fileType = await fileTypeFromBuffer(req.file.buffer);
        const extensions = new Map([
          ['image/jpeg', 'jpg'],
          ['image/png', 'png'],
          ['image/webp', 'webp'],
        ]);
        const extension = extensions.get(fileType?.mime);
        if (!extension) throw invalid('Gunakan foto JPG, PNG, atau WebP yang valid.');
        const latitude = Number(req.body.latitude);
        const longitude = Number(req.body.longitude);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
          || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          throw invalid('Lokasi GPS tidak valid. Izinkan akses lokasi lalu coba lagi.');
        }
        const current = await pool.query(
          `SELECT unit_id AS "unitId" FROM dealer_motor_spks
           WHERE id = $1 AND company_id = $2 AND delivery_status = 'in_delivery'
             AND driver_id = $3`,
          [req.params.id, req.user.company_id, req.user.id],
        );
        if (!current.rowCount) throw invalid('Pengiriman ini tidak sedang ditangani akun Anda.', 403);
        const directory = resolve(privateDeliveryDirectory, req.user.company_id);
        await mkdir(directory, { recursive: true });
        const fileName = `${randomUUID()}.${extension}`;
        storedPath = resolve(directory, fileName);
        await writeFile(storedPath, req.file.buffer, { flag: 'wx', mode: 0o640 });
        await withTransaction(pool, async (client) => {
          const result = await client.query(
            `UPDATE dealer_motor_spks
             SET status = 'SELESAI', delivery_status = 'delivered',
                 delivery_photo_path = $1, delivery_latitude = $2,
                 delivery_longitude = $3, delivered_at = now(), updated_at = now()
             WHERE id = $4 AND company_id = $5 AND delivery_status = 'in_delivery'
               AND driver_id = $6
             RETURNING unit_id AS "unitId"`,
            [fileName, latitude, longitude, req.params.id, req.user.company_id, req.user.id],
          );
          if (!result.rowCount) throw invalid('Status pengiriman sudah berubah.', 409);
          const updatedUnit = await client.query(
            `UPDATE dealer_motor_units
             SET stock_status = 'delivered', status_updated_at = now(), updated_at = now()
             WHERE id = $1 AND company_id = $2 AND stock_status = 'in_delivery'`,
            [result.rows[0].unitId, req.user.company_id],
          );
          if (!updatedUnit.rowCount) throw invalid('Status stok unit tidak sesuai dengan serah-terima.', 409);
          await client.query(
            `INSERT INTO dealer_motor_unit_events
               (company_id, unit_id, spk_id, created_by, event_type, note, details)
             VALUES ($1, $2, $3, $4, 'delivered', 'Foto serah-terima dan lokasi GPS tersimpan',
                     jsonb_build_object('latitude', $5::numeric, 'longitude', $6::numeric))`,
            [req.user.company_id, result.rows[0].unitId, req.params.id, req.user.id, latitude, longitude],
          );
        });
        res.json({ status: 'SELESAI', deliveryStatus: 'delivered' });
      } catch (error) {
        if (storedPath) {
          try {
            await unlink(storedPath);
          } catch (unlinkError) {
            return next(unlinkError);
          }
        }
        if (error.status) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    });

  router.get('/spks/:id/delivery-photo', authenticate, requireTenant, requireActiveTenant,
    requirePermission('deliveryManage', 'spkViewAll'), async (req, res, next) => {
      try {
        if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'SPK tidak valid.' });
        const canViewAll = req.user.permissions.includes('spkViewAll');
        const result = await pool.query(
          `SELECT delivery_photo_path AS "photoPath" FROM dealer_motor_spks
           WHERE id = $1 AND company_id = $2 AND ($3::boolean OR driver_id = $4)`,
          [req.params.id, req.user.company_id, canViewAll, req.user.id],
        );
        if (!result.rowCount || !result.rows[0].photoPath) {
          return res.status(404).json({ message: 'Foto serah-terima tidak ditemukan.' });
        }
        const filePath = resolve(privateDeliveryDirectory, req.user.company_id, result.rows[0].photoPath);
        res.setHeader('Cache-Control', 'private, no-store');
        res.sendFile(filePath, (error) => {
          if (error) next(error);
        });
      } catch (error) {
        next(error);
      }
    });

  return router;
}
