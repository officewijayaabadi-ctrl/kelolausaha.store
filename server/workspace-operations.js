import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const attendanceRoles = ['OWNER', 'SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER'];
const globalBranchRoles = ['OWNER', 'SUPER ADMIN', 'HRD'];
const attendanceRequestTypes = new Set(['permission', 'leave', 'sick', 'business_trip']);

function isValidDate(value) {
  return typeof value === 'string'
    && datePattern.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isValidTimezone(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function mapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function branchScope(req, requestedBranchId) {
  if (globalBranchRoles.includes(req.user.role)) return requestedBranchId || null;
  if (!req.user.branch_id) return null;
  return req.user.branch_id;
}

function normalizeBranchName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}

function normalizeBranchCode(value) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return compact || randomBytes(3).toString('hex').toUpperCase();
}

async function storeAttendancePhoto({ req, privateAttendanceDirectory, fileTypeFromBuffer, kind }) {
  if (!req.file || req.file.size > 2 * 1024 * 1024) {
    const error = new Error('Foto wajib diunggah dan ukurannya maksimal 2 MB.');
    error.status = 400;
    throw error;
  }
  const fileType = await fileTypeFromBuffer(req.file.buffer);
  const supportedTypes = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);
  const extension = supportedTypes.get(fileType?.mime);
  if (!extension) {
    const error = new Error('Gunakan foto JPG, PNG, atau WebP yang valid.');
    error.status = 400;
    throw error;
  }
  const directory = resolve(privateAttendanceDirectory, req.user.company_id);
  await mkdir(directory, { recursive: true });
  const fileName = `${kind}-${randomUUID()}.${extension}`;
  await writeFile(resolve(directory, fileName), req.file.buffer, { flag: 'wx', mode: 0o640 });
  return `/api/workspace/operations/attendance/photos/${encodeURIComponent(fileName)}`;
}

function validateLocation(body) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    const error = new Error('Lokasi GPS tidak valid. Izinkan akses lokasi lalu coba lagi.');
    error.status = 400;
    throw error;
  }
  return { latitude, longitude, mapsUrl: mapsUrl(latitude, longitude) };
}

function respondError(res, error) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.code === '23505') return res.status(409).json({ message: 'Data sudah tercatat.' });
  return res.status(400).json({ message: error.message || 'Permintaan tidak valid.' });
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

export function createWorkspaceOperationsRouter({
  pool,
  authenticate,
  requireTenant,
  requireActiveTenant,
  requireRole,
  upload,
  privateAttendanceDirectory,
  fileTypeFromBuffer,
}) {
  const router = express.Router();
  const photoUpload = upload.single('photo');

  router.get('/branches', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    try {
      if (req.query.branchId && !uuidPattern.test(req.query.branchId)) {
        return res.status(400).json({ message: 'Cabang tidak valid.' });
      }
      const branchId = branchScope(req, req.query.branchId);
      if (!globalBranchRoles.includes(req.user.role) && !branchId) {
        return res.status(403).json({ message: 'Akun belum ditetapkan ke cabang.' });
      }
      const [branches, limits] = await Promise.all([
        pool.query(
          `SELECT id, name, code, address, active, is_primary AS "isPrimary", created_at AS "createdAt"
           FROM business_branches WHERE company_id = $1
             AND ($2::uuid IS NULL OR id = $2)
           ORDER BY is_primary DESC, name`,
          [req.user.company_id, branchId],
        ),
        pool.query(
          `SELECT c.branch_limit + COALESCE(SUM(e.branch_count) FILTER (
             WHERE e.active_until IS NULL OR e.active_until > now()
           ), 0)::int AS "branchLimit",
           (SELECT COUNT(*)::int FROM business_branches b
             WHERE b.company_id = c.id AND b.active = true) AS "activeBranches"
           FROM companies c
           LEFT JOIN branch_addon_entitlements e ON e.company_id = c.id
           WHERE c.id = $1
           GROUP BY c.id`,
          [req.user.company_id],
        ),
      ]);
      res.json({
        branches: branches.rows,
        ...limits.rows[0],
        canManage: ['OWNER', 'SUPER ADMIN'].includes(req.user.role),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/branches', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN'), async (req, res, next) => {
    const name = normalizeBranchName(req.body?.name);
    const address = typeof req.body?.address === 'string' ? req.body.address.trim().slice(0, 500) : null;
    if (!name) return res.status(400).json({ message: 'Nama cabang wajib diisi.' });
    try {
      const branch = await withTransaction(pool, async (client) => {
        const company = await client.query(
          'SELECT branch_limit FROM companies WHERE id = $1 FOR UPDATE',
          [req.user.company_id],
        );
        if (!company.rowCount) {
          const error = new Error('Workspace tidak ditemukan.');
          error.status = 404;
          throw error;
        }
        const [addons, count] = await Promise.all([
          client.query(
            `SELECT COALESCE(SUM(branch_count), 0)::int AS amount
             FROM branch_addon_entitlements
             WHERE company_id = $1 AND (active_until IS NULL OR active_until > now())`,
            [req.user.company_id],
          ),
          client.query(
            'SELECT COUNT(*)::int AS amount FROM business_branches WHERE company_id = $1 AND active = true',
            [req.user.company_id],
          ),
        ]);
        if (count.rows[0].amount >= company.rows[0].branch_limit + addons.rows[0].amount) {
          const error = new Error('Kuota cabang tercapai. Hubungi vendor atau beli tambahan kuota cabang.');
          error.status = 409;
          throw error;
        }
        const inserted = await client.query(
          `INSERT INTO business_branches (company_id, name, code, address)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, code, address, active, is_primary AS "isPrimary"`,
          [req.user.company_id, name, normalizeBranchCode(name), address],
        );
        return inserted.rows[0];
      });
      res.status(201).json({ branch });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Nama atau kode cabang sudah digunakan.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.patch('/branches/:branchId', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN'), async (req, res, next) => {
    if (!uuidPattern.test(req.params.branchId)) return res.status(400).json({ message: 'Cabang tidak valid.' });
    const name = normalizeBranchName(req.body?.name);
    const address = typeof req.body?.address === 'string' ? req.body.address.trim().slice(0, 500) : null;
    const active = req.body?.active !== false;
    if (!name) return res.status(400).json({ message: 'Nama cabang wajib diisi.' });
    try {
      const branch = await withTransaction(pool, async (client) => {
        const current = await client.query(
          'SELECT id, is_primary, active FROM business_branches WHERE id = $1 AND company_id = $2 FOR UPDATE',
          [req.params.branchId, req.user.company_id],
        );
        if (!current.rowCount) {
          const error = new Error('Cabang tidak ditemukan.');
          error.status = 404;
          throw error;
        }
        if (!active && current.rows[0].is_primary) {
          const error = new Error('Cabang utama tidak dapat dinonaktifkan.');
          error.status = 400;
          throw error;
        }
        if (active && !current.rows[0].active) {
          await client.query('SELECT id FROM companies WHERE id = $1 FOR UPDATE', [req.user.company_id]);
          const [limitResult, addonResult, countResult] = await Promise.all([
            client.query('SELECT branch_limit FROM companies WHERE id = $1', [req.user.company_id]),
            client.query(
              `SELECT COALESCE(SUM(branch_count), 0)::int AS amount
               FROM branch_addon_entitlements
               WHERE company_id = $1 AND (active_until IS NULL OR active_until > now())`,
              [req.user.company_id],
            ),
            client.query(
              'SELECT COUNT(*)::int AS amount FROM business_branches WHERE company_id = $1 AND active = true',
              [req.user.company_id],
            ),
          ]);
          if (countResult.rows[0].amount >= limitResult.rows[0].branch_limit + addonResult.rows[0].amount) {
            const error = new Error('Kuota cabang tercapai. Beli tambahan kuota sebelum mengaktifkan cabang.');
            error.status = 409;
            throw error;
          }
        }
        if (!active) {
          await client.query(
            `UPDATE users SET branch_id = (
               SELECT id FROM business_branches
               WHERE company_id = $1 AND is_primary = true AND active = true
             ) WHERE company_id = $1 AND branch_id = $2`,
            [req.user.company_id, req.params.branchId],
          );
        }
        const result = await client.query(
          `UPDATE business_branches SET name = $1, address = $2, active = $3
           WHERE id = $4 AND company_id = $5
           RETURNING id, name, code, address, active, is_primary AS "isPrimary"`,
          [name, address, active, req.params.branchId, req.user.company_id],
        );
        return result.rows[0];
      });
      res.json({ branch });
    } catch (error) {
      next(error);
    }
  });

  router.post('/branches/:branchId/invites', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN'), async (req, res, next) => {
    const allowedRoles = req.user.role === 'OWNER'
      ? ['SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR']
      : ['HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR'];
    const invitedRole = req.body?.role;
    if (!uuidPattern.test(req.params.branchId) || !allowedRoles.includes(invitedRole)) {
      return res.status(400).json({ message: 'Cabang atau peran undangan tidak valid.' });
    }
    try {
      const branch = await pool.query(
        'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
        [req.params.branchId, req.user.company_id],
      );
      if (!branch.rowCount) return res.status(404).json({ message: 'Cabang tidak ditemukan.' });
      const token = randomBytes(32).toString('base64url');
      await pool.query(
        `INSERT INTO team_invites (token_hash, company_id, branch_id, role, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
        [createHash('sha256').update(token).digest('hex'), req.user.company_id, req.params.branchId, invitedRole],
      );
      const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
      res.status(201).json({ inviteUrl: `${origin}/?invite=${encodeURIComponent(token)}` });
    } catch (error) {
      next(error);
    }
  });

  router.get('/branches/report', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER'), async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT b.id AS "branchId", b.name AS "branchName",
           COUNT(o.id)::int AS "orderCount",
           COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'returned')), 0) AS "salesTotal",
           COUNT(o.id) FILTER (WHERE o.payment_status IN ('unpaid', 'partial'))::int AS "unpaidOrders"
         FROM business_branches b
         LEFT JOIN business_orders o ON o.company_id = b.company_id
           AND o.branch_id = b.id
           AND o.created_at >= date_trunc('month', now())
         WHERE b.company_id = $1 AND b.active = true
         GROUP BY b.id, b.name
         ORDER BY b.is_primary DESC, b.name`,
        [req.user.company_id],
      );
      res.json({ branches: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/attendance/settings', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT timezone, to_char(work_start, 'HH24:MI') AS "workStart",
                to_char(work_end, 'HH24:MI') AS "workEnd", work_days AS "workDays",
                grace_minutes AS "graceMinutes"
         FROM attendance_settings WHERE company_id = $1`,
        [req.user.company_id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pengaturan jam kerja belum tersedia.' });
      res.json({ settings: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.put('/attendance/settings', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'HRD'), async (req, res, next) => {
    const { timezone, workStart, workEnd, workDays, graceMinutes } = req.body || {};
    const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const days = Array.isArray(workDays) ? workDays.map(Number) : [];
    const grace = Number(graceMinutes);
    if (!isValidTimezone(timezone)
      || !validTime(workStart) || !validTime(workEnd) || workEnd <= workStart
      || !days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
      || new Set(days).size !== days.length
      || !Number.isInteger(grace) || grace < 0 || grace > 240) {
      return res.status(400).json({ message: 'Jadwal kerja tidak valid.' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO attendance_settings
           (company_id, timezone, work_start, work_end, work_days, grace_minutes, updated_by, updated_at)
         VALUES ($1, $2, $3::time, $4::time, $5::smallint[], $6, $7, now())
         ON CONFLICT (company_id) DO UPDATE SET timezone = EXCLUDED.timezone,
           work_start = EXCLUDED.work_start, work_end = EXCLUDED.work_end,
           work_days = EXCLUDED.work_days, grace_minutes = EXCLUDED.grace_minutes,
           updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING timezone, to_char(work_start, 'HH24:MI') AS "workStart",
           to_char(work_end, 'HH24:MI') AS "workEnd", work_days AS "workDays",
           grace_minutes AS "graceMinutes"`,
        [req.user.company_id, timezone, workStart, workEnd, days, grace, req.user.id],
      );
      res.json({ settings: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.get('/attendance/today', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT (now() AT TIME ZONE s.timezone)::date AS "workDate",
           a.id, a.check_in_at AS "checkInAt", a.check_in_photo_url AS "checkInPhotoUrl",
           a.check_in_latitude AS "checkInLatitude", a.check_in_longitude AS "checkInLongitude",
           a.check_in_maps_url AS "checkInMapsUrl", a.check_out_at AS "checkOutAt",
           a.check_out_photo_url AS "checkOutPhotoUrl", a.check_out_maps_url AS "checkOutMapsUrl"
         FROM attendance_settings s
         LEFT JOIN attendance_records a ON a.company_id = s.company_id
           AND a.user_id = $2 AND a.work_date = (now() AT TIME ZONE s.timezone)::date
         WHERE s.company_id = $1`,
        [req.user.company_id, req.user.id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pengaturan absensi belum tersedia.' });
      res.json({ attendance: result.rows[0], branchId: req.user.branch_id });
    } catch (error) {
      next(error);
    }
  });

  router.post('/attendance/check-in', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), photoUpload, async (req, res, next) => {
    let photoUrl;
    try {
      const location = validateLocation(req.body);
      if (!req.user.branch_id) return res.status(400).json({ message: 'Akun belum ditetapkan ke cabang.' });
      const branch = await pool.query(
        'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
        [req.user.branch_id, req.user.company_id],
      );
      if (!branch.rowCount) return res.status(403).json({ message: 'Cabang akun ini sedang tidak aktif.' });
      photoUrl = await storeAttendancePhoto({ req, privateAttendanceDirectory, fileTypeFromBuffer, kind: 'masuk' });
      const result = await pool.query(
        `INSERT INTO attendance_records
           (company_id, branch_id, user_id, work_date, check_in_photo_url,
            check_in_latitude, check_in_longitude, check_in_maps_url)
         SELECT $1, $2, $3, (now() AT TIME ZONE s.timezone)::date, $4, $5, $6, $7
         FROM attendance_settings s WHERE s.company_id = $1
         RETURNING id, work_date AS "workDate", check_in_at AS "checkInAt",
           check_in_photo_url AS "photoUrl", check_in_latitude AS latitude,
           check_in_longitude AS longitude, check_in_maps_url AS "mapsUrl"`,
        [req.user.company_id, req.user.branch_id, req.user.id, photoUrl,
          location.latitude, location.longitude, location.mapsUrl],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pengaturan absensi belum tersedia.' });
      res.status(201).json({ attendance: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Absensi masuk hari ini sudah tercatat.' });
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.post('/attendance/check-out', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), photoUpload, async (req, res, next) => {
    try {
      const location = validateLocation(req.body);
      if (!req.user.branch_id) return res.status(400).json({ message: 'Akun belum ditetapkan ke cabang.' });
      const branch = await pool.query(
        'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
        [req.user.branch_id, req.user.company_id],
      );
      if (!branch.rowCount) return res.status(403).json({ message: 'Cabang akun ini sedang tidak aktif.' });
      const result = await pool.query(
        `UPDATE attendance_records a
         SET check_out_at = now(), check_out_photo_url = $1,
             check_out_latitude = $2, check_out_longitude = $3, check_out_maps_url = $4
         FROM attendance_settings s
         WHERE a.company_id = $5 AND a.user_id = $6 AND a.branch_id = $7
           AND a.company_id = s.company_id
           AND a.work_date = (now() AT TIME ZONE s.timezone)::date
           AND a.check_out_at IS NULL
         RETURNING a.id, a.check_out_at AS "checkOutAt",
           a.check_out_photo_url AS "photoUrl", a.check_out_latitude AS latitude,
           a.check_out_longitude AS longitude, a.check_out_maps_url AS "mapsUrl"`,
        [await storeAttendancePhoto({ req, privateAttendanceDirectory, fileTypeFromBuffer, kind: 'pulang' }),
          location.latitude, location.longitude, location.mapsUrl,
          req.user.company_id, req.user.id, req.user.branch_id],
      );
      if (!result.rowCount) return res.status(409).json({ message: 'Absensi masuk belum ada atau absensi pulang sudah tercatat.' });
      res.json({ attendance: result.rows[0] });
    } catch (error) {
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.post('/attendance/requests', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), photoUpload, async (req, res, next) => {
    const { requestType, startDate, endDate, reason } = req.body || {};
    if (!attendanceRequestTypes.has(requestType)
      || !isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate
      || new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`) > 31 * 86400000
      || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ message: 'Jenis, tanggal, dan alasan pengajuan tidak valid.' });
    }
    if (!req.user.branch_id) return res.status(400).json({ message: 'Akun belum ditetapkan ke cabang.' });
    try {
      const evidenceUrl = await storeAttendancePhoto({ req, privateAttendanceDirectory, fileTypeFromBuffer, kind: 'izin' });
      const result = await pool.query(
        `INSERT INTO attendance_requests
           (company_id, branch_id, user_id, request_type, start_date, end_date, reason, evidence_photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, request_type AS "requestType", start_date AS "startDate",
           end_date AS "endDate", reason, evidence_photo_url AS "evidencePhotoUrl",
           status, created_at AS "createdAt"`,
        [req.user.company_id, req.user.branch_id, req.user.id, requestType,
          startDate, endDate, reason.trim(), evidenceUrl],
      );
      res.status(201).json({ request: result.rows[0] });
    } catch (error) {
      if (error.status) return respondError(res, error);
      next(error);
    }
  });

  router.get('/attendance/requests', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    try {
      if (req.query.branchId && !uuidPattern.test(req.query.branchId)) {
        return res.status(400).json({ message: 'Cabang tidak valid.' });
      }
      const branchId = branchScope(req, req.query.branchId);
      if (!globalBranchRoles.includes(req.user.role) && !branchId) {
        return res.status(403).json({ message: 'Akun belum ditetapkan ke cabang.' });
      }
      const isManager = ['OWNER', 'SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN'].includes(req.user.role);
      const result = await pool.query(
        `SELECT r.id, r.request_type AS "requestType", r.start_date AS "startDate",
           r.end_date AS "endDate", r.reason, r.evidence_photo_url AS "evidencePhotoUrl",
           r.status, r.review_note AS "reviewNote", r.created_at AS "createdAt",
           u.id AS "userId", u.name AS "userName", b.id AS "branchId", b.name AS "branchName"
         FROM attendance_requests r
         JOIN users u ON u.id = r.user_id AND u.company_id = r.company_id
         JOIN business_branches b ON b.id = r.branch_id AND b.company_id = r.company_id
         WHERE r.company_id = $1
           AND ($2::uuid IS NULL OR r.branch_id = $2)
           AND ($3::boolean OR r.user_id = $4)
         ORDER BY r.created_at DESC LIMIT 200`,
        [req.user.company_id, branchId, isManager, req.user.id],
      );
      res.json({ requests: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/attendance/photos/:photoName', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    const photoName = req.params.photoName;
    if (!/^(masuk|pulang|izin)-[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(photoName)) {
      return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    }
    try {
      const photo = await pool.query(
        `SELECT user_id AS "userId", branch_id AS "branchId"
         FROM attendance_records
         WHERE company_id = $1 AND (
           check_in_photo_url = $2 OR check_out_photo_url = $2
         )
         UNION ALL
         SELECT user_id AS "userId", branch_id AS "branchId"
         FROM attendance_requests WHERE company_id = $1 AND evidence_photo_url = $2
         LIMIT 1`,
        [req.user.company_id, `/api/workspace/operations/attendance/photos/${photoName}`],
      );
      if (!photo.rowCount) return res.status(404).json({ message: 'Foto tidak ditemukan.' });
      const canViewBranch = ['SVP', 'SPV', 'KEPALA TOKO', 'ADMIN'].includes(req.user.role)
        && photo.rows[0].branchId === req.user.branch_id;
      if (!globalBranchRoles.includes(req.user.role) && !canViewBranch
        && photo.rows[0].userId !== req.user.id) {
        return res.status(404).json({ message: 'Foto tidak ditemukan.' });
      }
      const image = await readFile(resolve(privateAttendanceDirectory, req.user.company_id, photoName));
      const mimeType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[photoName.split('.').pop().toLowerCase()];
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.type(mimeType).send(image);
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ message: 'Foto tidak ditemukan.' });
      next(error);
    }
  });

  router.patch('/attendance/requests/:requestId', authenticate, requireTenant, requireActiveTenant, requireRole('OWNER', 'SUPER ADMIN', 'HRD'), async (req, res, next) => {
    const { status, reviewNote = '' } = req.body || {};
    if (!uuidPattern.test(req.params.requestId) || !['approved', 'rejected'].includes(status)
      || typeof reviewNote !== 'string' || reviewNote.length > 500) {
      return res.status(400).json({ message: 'Keputusan atau catatan tinjauan tidak valid.' });
    }
    try {
      const result = await pool.query(
        `UPDATE attendance_requests SET status = $1, reviewed_by = $2,
           reviewed_at = now(), review_note = $3
         WHERE id = $4 AND company_id = $5 AND status = 'pending'
         RETURNING id, status, reviewed_at AS "reviewedAt", review_note AS "reviewNote"`,
        [status, req.user.id, reviewNote.trim() || null, req.params.requestId, req.user.company_id],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pengajuan tidak ditemukan atau sudah ditinjau.' });
      res.json({ request: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.get('/attendance/report', authenticate, requireTenant, requireActiveTenant, requireRole(...attendanceRoles), async (req, res, next) => {
    const date = req.query.date;
    if (!isValidDate(date)) return res.status(400).json({ message: 'Tanggal laporan tidak valid.' });
    if (req.query.branchId && !uuidPattern.test(req.query.branchId)) {
      return res.status(400).json({ message: 'Cabang laporan tidak valid.' });
    }
    const branchId = branchScope(req, req.query.branchId);
    if (!globalBranchRoles.includes(req.user.role) && !branchId) {
      return res.status(403).json({ message: 'Akun belum ditetapkan ke cabang.' });
    }
    try {
      const result = await pool.query(
        `SELECT u.id AS "userId", u.name AS "userName", u.role,
           b.id AS "branchId", b.name AS "branchName",
           a.check_in_at AS "checkInAt", a.check_in_photo_url AS "checkInPhotoUrl",
           a.check_in_latitude AS "checkInLatitude", a.check_in_longitude AS "checkInLongitude",
           a.check_in_maps_url AS "checkInMapsUrl", a.check_out_at AS "checkOutAt",
           a.check_out_photo_url AS "checkOutPhotoUrl",
           CASE
             WHEN a.id IS NOT NULL THEN 'present'
             WHEN EXISTS (
               SELECT 1 FROM attendance_requests r
               WHERE r.company_id = u.company_id AND r.user_id = u.id
                 AND r.status = 'approved' AND $2::date BETWEEN r.start_date AND r.end_date
             ) THEN 'excused'
             WHEN NOT (EXTRACT(ISODOW FROM $2::date)::smallint = ANY(s.work_days)) THEN 'day_off'
             WHEN $2::date > (now() AT TIME ZONE s.timezone)::date THEN 'upcoming'
             WHEN $2::date = (now() AT TIME ZONE s.timezone)::date
               AND (now() AT TIME ZONE s.timezone)::time
                 < s.work_start + make_interval(mins => s.grace_minutes) THEN 'not_due'
             ELSE 'absent'
           END AS status
         FROM users u
         JOIN business_branches b ON b.id = u.branch_id AND b.company_id = u.company_id
         CROSS JOIN attendance_settings s
         LEFT JOIN attendance_records a ON a.company_id = u.company_id
           AND a.user_id = u.id AND a.work_date = $2::date
         WHERE u.company_id = $1 AND u.active = true
           AND u.role <> 'OWNER' AND u.role <> 'PLATFORM_OWNER'
           AND s.company_id = u.company_id
           AND ($3::uuid IS NULL OR u.branch_id = $3)
         ORDER BY b.name, u.name`,
        [req.user.company_id, date, branchId],
      );
      res.json({ date, records: result.rows });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
