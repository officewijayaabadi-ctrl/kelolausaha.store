import 'dotenv/config';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import pg from 'pg';
import { fileTypeFromBuffer } from 'file-type';
import { verifyNotificationSignature } from './midtrans.js';
import { getPlan, plans, subscriptionStatus, trialEndsAt } from './plans.js';

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = Number(process.env.API_PORT) || 4000;
const SESSION_DAYS = 30;
const uploadDirectory = resolve(process.env.UPLOAD_DIR || 'uploads');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const otpRateLimits = new Map();
const themeIds = new Set(['blue-professional', 'green-fresh', 'purple-elegant', 'orange-cheerful', 'pink-sweet', 'teal-modern', 'navy-elegant', 'yellow-warm', 'gray-minimal', 'white-clean']);
const imageExtensions = new Set(['png', 'jpg', 'webp', 'ico']);
const businessTypeIds = new Set([
  'laundry', 'dealer_motor', 'retail', 'restaurant', 'services',
  'workshop', 'salon', 'printing', 'distribution',
]);

const permissionSets = {
  'SUPER ADMIN': ['dashboard', 'spkCreate', 'spkViewAll', 'spkViewOwn', 'spkVerify', 'spkApprove', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'reportsView', 'targetManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'accessManage', 'themeManage'],
  OWNER: ['dashboard', 'spkViewAll', 'unitManage', 'salesManage', 'reportsView', 'targetManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'themeManage'],
  SVP: ['dashboard', 'spkViewAll', 'unitManage', 'salesManage', 'spkApprove', 'reportsView'],
  ADMIN: ['dashboard', 'spkCreate', 'spkViewAll', 'spkVerify', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView'],
  SALES: ['dashboard', 'spkCreate', 'spkViewOwn', 'customerManage'],
  KASIR: ['dashboard', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView'],
  PLATFORM_OWNER: ['dashboard', 'platformBusinesses', 'platformBilling'],
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function otpHash(email, otp) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(`${email}:${otp}`).digest('hex');
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ku_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ku_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function cookieValue(req, key) {
  const cookies = req.headers.cookie?.split(';') ?? [];
  const value = cookies.find((cookie) => cookie.trim().startsWith(`${key}=`));
  return value?.trim().slice(key.length + 1);
}

function publicBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.business_type,
    modules: row.modules,
    subscription: {
      status: subscriptionStatus({
        trialEndsAt: row.trial_ends_at,
        activeUntil: row.active_until,
        planId: row.plan_id,
      }),
      trialStartedAt: row.trial_started_at,
      trialEndsAt: row.trial_ends_at,
      activeUntil: row.active_until,
      planId: row.plan_id,
    },
    themeSettings: row.theme_settings || {},
  };
}

async function authenticate(req, res, next) {
  const token = cookieValue(req, 'ku_session');
  if (!token) return res.status(401).json({ message: 'Silakan masuk kembali.' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.permissions, u.company_id,
              c.name AS company_name, c.business_type, c.modules, c.trial_started_at,
              c.trial_ends_at, c.active_until, c.plan_id, c.subscription_status,
              c.theme_settings
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.active = true
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hash(token)],
    );
    if (!result.rowCount) return res.status(401).json({ message: 'Sesi telah berakhir. Silakan masuk kembali.' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Akses tidak diizinkan.' });
    next();
  };
}

function requireTenant(req, res, next) {
  if (!req.user.company_id) return res.status(403).json({ message: 'Akun ini tidak terikat ke workspace usaha.' });
  next();
}

function requireActiveTenant(req, res, next) {
  if (!['SUPER ADMIN', 'OWNER', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Hanya pengelola workspace yang dapat melanjutkan.' });
  }
  const status = subscriptionStatus({
    trialEndsAt: req.user.trial_ends_at,
    activeUntil: req.user.active_until,
    planId: req.user.plan_id,
  });
  if (status === 'expired' || req.user.subscription_status === 'suspended') {
    return res.status(402).json({ message: 'Masa demo atau aktivasi usaha telah berakhir. Perpanjang untuk melanjutkan.' });
  }
  next();
}

function requestOtpLimit(req, res, next) {
  const key = `${req.ip}:${String(req.body.email || '').toLowerCase()}`;
  const now = Date.now();
  const current = otpRateLimits.get(key);
  if (current && current.expiresAt > now && current.count >= 5) {
    return res.status(429).json({ message: 'Terlalu banyak permintaan OTP. Coba lagi dalam satu jam.' });
  }
  otpRateLimits.set(key, current && current.expiresAt > now
    ? { count: current.count + 1, expiresAt: current.expiresAt }
    : { count: 1, expiresAt: now + 60 * 60 * 1000 });
  next();
}

async function sendOtpEmail(email, otp) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP belum dikonfigurasi untuk pengiriman OTP.');
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Kode masuk KelolaUsaha.store',
    text: `Kode OTP Anda: ${otp}. Kode berlaku 10 menit dan jangan dibagikan.`,
  });
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use('/uploads', express.static(uploadDirectory, { dotfiles: 'deny', index: false }));

app.post('/api/auth/request-otp', requestOtpLimit, async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Alamat email tidak valid.' });
  }
  const isPlatformOwner = email === String(process.env.PLATFORM_OWNER_EMAIL || '').toLowerCase();
  const hasRegistration = Boolean(req.body.businessName && req.body.businessType && !req.body.inviteToken);
  if (hasRegistration && !businessTypeIds.has(req.body.businessType)) {
    return res.status(400).json({ message: 'Jenis usaha tidak valid.' });
  }
  if (hasRegistration && (!String(req.body.name || '').trim() || !String(req.body.businessName).trim())) {
    return res.status(400).json({ message: 'Nama pengguna dan nama usaha wajib diisi.' });
  }
  if (req.body.inviteToken) {
    const invite = await pool.query(
      'SELECT 1 FROM team_invites WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()',
      [hash(String(req.body.inviteToken))],
    );
    if (!invite.rowCount) return res.status(400).json({ message: 'Link undangan tidak valid atau sudah kedaluwarsa.' });
  }
  const otp = `${randomInt(0, 1000000)}`.padStart(6, '0');
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    businessName: String(req.body.businessName || '').trim(),
    businessType: String(req.body.businessType || ''),
    modules: Array.isArray(req.body.modules) ? req.body.modules.filter((value) => typeof value === 'string').slice(0, 50) : [],
    inviteToken: String(req.body.inviteToken || ''),
    isPlatformOwner,
  };
  try {
    await pool.query(
      `INSERT INTO otp_challenges (email, otp_hash, payload, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes')`,
      [email, otpHash(email, otp), JSON.stringify(payload)],
    );
    await sendOtpEmail(email, otp);
    return res.json({ message: 'Kode OTP telah dikirim ke alamat email Anda.' });
  } catch (error) {
    await pool.query('DELETE FROM otp_challenges WHERE email = $1 AND consumed_at IS NULL', [email]);
    return next(error);
  }
});

app.post('/api/auth/verify-otp', async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '');
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Kode OTP tidak valid.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const challengeResult = await client.query(
      `SELECT * FROM otp_challenges WHERE email = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email],
    );
    const challenge = challengeResult.rows[0];
    if (!challenge || new Date(challenge.expires_at) <= new Date() || challenge.attempts >= 5) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Kode OTP salah atau sudah kedaluwarsa.' });
    }
    const payload = challenge.payload;
    if (!constantTimeEqual(challenge.otp_hash, otpHash(email, otp))) {
      await client.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
      await client.query('COMMIT');
      return res.status(400).json({ message: 'Kode OTP salah atau sudah kedaluwarsa.' });
    }

    let userResult = await client.query(
      `SELECT id, company_id, name, email, role, permissions
       FROM users WHERE email = $1 AND active = true`,
      [email],
    );
    let user = userResult.rows[0];
    let business;
    if (!user && payload.isPlatformOwner) {
      const result = await client.query(
        `INSERT INTO users (name, email, role, permissions)
         VALUES ($1, $2, 'PLATFORM_OWNER', $3) RETURNING id, company_id, name, email, role, permissions`,
        [payload.name || 'Owner KelolaUsaha.store', email, JSON.stringify(permissionSets.PLATFORM_OWNER)],
      );
      user = result.rows[0];
    } else if (!user && payload.inviteToken) {
      const inviteResult = await client.query(
        `SELECT * FROM team_invites WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [hash(payload.inviteToken)],
      );
      const invite = inviteResult.rows[0];
      if (!invite) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Link undangan tidak valid atau sudah kedaluwarsa.' });
      }
      const result = await client.query(
        `INSERT INTO users (company_id, name, email, phone, role, permissions)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, company_id, name, email, role, permissions`,
        [invite.company_id, payload.name || email, email, payload.phone, invite.role, JSON.stringify(permissionSets[invite.role] || [])],
      );
      user = result.rows[0];
      await client.query('UPDATE team_invites SET consumed_at = now() WHERE token_hash = $1', [invite.token_hash]);
    } else if (!user && payload.businessName) {
      const trialEnd = trialEndsAt(new Date());
      const companyResult = await client.query(
        `INSERT INTO companies (name, business_type, modules, trial_ends_at)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [payload.businessName, payload.businessType, JSON.stringify(payload.modules), trialEnd],
      );
      business = companyResult.rows[0];
      const result = await client.query(
        `INSERT INTO users (company_id, name, email, phone, role, permissions)
         VALUES ($1, $2, $3, $4, 'SUPER ADMIN', $5)
         RETURNING id, company_id, name, email, role, permissions`,
        [business.id, payload.name, email, payload.phone, JSON.stringify(permissionSets['SUPER ADMIN'])],
      );
      user = result.rows[0];
    } else if (!user) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.' });
    }
    if (!business && user.company_id) {
      const companyResult = await client.query('SELECT * FROM companies WHERE id = $1', [user.company_id]);
      business = companyResult.rows[0];
    }
    await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
    const sessionToken = randomBytes(32).toString('base64url');
    await client.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
      [hash(sessionToken), user.id, SESSION_DAYS],
    );
    await client.query('COMMIT');
    setSessionCookie(res, sessionToken);
    return res.json({
      user: { ...user, permissions: user.permissions },
      ...(business ? { business: publicBusiness(business) } : {}),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

app.get('/api/auth/session', authenticate, async (req, res, next) => {
  try {
    const companyResult = req.user.company_id
      ? await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id])
      : { rows: [] };
    const company = companyResult.rows[0];
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
      },
      ...(company ? { business: publicBusiness(company) } : {}),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash(cookieValue(req, 'ku_session'))]);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/invites', authenticate, requireRole('SUPER ADMIN'), requireTenant, requireActiveTenant, async (req, res, next) => {
  const role = String(req.body.role || '');
  if (!['OWNER', 'SVP', 'ADMIN', 'SALES', 'KASIR'].includes(role)) {
    return res.status(400).json({ message: 'Peran undangan tidak valid.' });
  }
  try {
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO team_invites (token_hash, company_id, role, expires_at)
       VALUES ($1, $2, $3, now() + interval '7 days')`,
      [hash(token), req.user.company_id, role],
    );
    const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    res.json({ inviteUrl: `${origin}/?invite=${token}` });
  } catch (error) {
    next(error);
  }
});

app.get('/api/workspace/theme', authenticate, requireTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT theme_settings FROM companies WHERE id = $1',
      [req.user.company_id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({ themeSettings: result.rows[0].theme_settings });
  } catch (error) {
    next(error);
  }
});

app.put('/api/workspace/theme', authenticate, requireRole('SUPER ADMIN', 'OWNER'), requireTenant, async (req, res, next) => {
  const {
    themeId,
    customPrimary,
    customSecondary,
    mode,
    sidebarMode,
    statCardStyle,
    logoUrl,
    faviconUrl,
  } = req.body;
  const validColor = (value) => value === '' || /^#[0-9a-f]{6}$/i.test(value);
  const validAsset = (value) => !value
    || (value.startsWith(`/uploads/${req.user.company_id}/`) && !value.includes('..'));
  if (!themeIds.has(themeId)
    || !validColor(customPrimary)
    || !validColor(customSecondary)
    || !['light', 'dark'].includes(mode)
    || !['mini', 'wide'].includes(sidebarMode)
    || !['shadow', 'border', 'soft'].includes(statCardStyle)
    || !validAsset(logoUrl)
    || !validAsset(faviconUrl)) {
    return res.status(400).json({ message: 'Pengaturan tampilan tidak valid.' });
  }
  const themeSettings = { themeId, customPrimary, customSecondary, mode, sidebarMode, statCardStyle, logoUrl, faviconUrl };
  try {
    const result = await pool.query(
      `UPDATE companies SET theme_settings = $1 WHERE id = $2 RETURNING theme_settings`,
      [JSON.stringify(themeSettings), req.user.company_id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({ themeSettings: result.rows[0].theme_settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/workspace/assets', authenticate, requireRole('SUPER ADMIN', 'OWNER'), requireTenant, upload.single('file'), async (req, res, next) => {
  if (!req.file || !['logo', 'favicon'].includes(req.body.assetType)) {
    return res.status(400).json({ message: 'Pilih file logo atau favicon yang valid.' });
  }
  try {
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !imageExtensions.has(fileType.ext)) {
      return res.status(400).json({ message: 'Format gambar tidak didukung. Gunakan PNG, JPG, WebP, atau ICO.' });
    }
    const companyDirectory = resolve(uploadDirectory, req.user.company_id);
    await mkdir(companyDirectory, { recursive: true });
    const filename = `${randomUUID()}.${fileType.ext}`;
    await writeFile(resolve(companyDirectory, filename), req.file.buffer, { flag: 'wx' });
    res.status(201).json({ url: `/uploads/${req.user.company_id}/${filename}` });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Ukuran file maksimal 2 MB.' });
  next(error);
});

app.get('/api/billing/plans', authenticate, requireTenant, (req, res) => {
  res.json({ plans });
});

app.get('/api/billing/status', authenticate, requireTenant, async (req, res, next) => {
  try {
    const [companyResult, orderResult, notificationResult] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]),
      pool.query(
        `SELECT id, plan_id, amount, status, redirect_url, created_at, paid_at
         FROM billing_orders WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [req.user.company_id],
      ),
      pool.query(
        `SELECT id, title, body, created_at, read_at FROM billing_notifications
         WHERE company_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.user.company_id],
      ),
    ]);
    if (!companyResult.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({
      business: publicBusiness(companyResult.rows[0]),
      orders: orderResult.rows,
      notifications: notificationResult.rows,
      plans,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/checkout', authenticate, requireRole('SUPER ADMIN', 'OWNER'), requireTenant, async (req, res, next) => {
  const plan = getPlan(String(req.body.planId || ''));
  if (!plan) return res.status(400).json({ message: 'Paket aktivasi tidak valid.' });
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return res.status(503).json({ message: 'Pembayaran belum tersedia. Midtrans Server Key belum dikonfigurasi di server.' });
  }
  try {
    const companyResult = await pool.query('SELECT id, name FROM companies WHERE id = $1', [req.user.company_id]);
    const company = companyResult.rows[0];
    if (!company) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    const orderId = `ku-${randomBytes(16).toString('hex')}`;
    await pool.query(
      `INSERT INTO billing_orders (company_id, plan_id, amount, midtrans_order_id)
       VALUES ($1, $2, $3, $4)`,
      [company.id, plan.id, plan.amount, orderId],
    );
    const sandbox = process.env.MIDTRANS_ENV !== 'production';
    const baseUrl = sandbox ? 'https://app.sandbox.midtrans.com' : 'https://app.midtrans.com';
    const authorization = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: plan.amount },
        item_details: [{ id: plan.id, price: plan.amount, quantity: 1, name: `KelolaUsaha ${plan.label}` }],
        customer_details: { first_name: company.name.slice(0, 50), email: req.user.email },
        callbacks: { finish: `${process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`}/?payment=check` },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      await pool.query(`UPDATE billing_orders SET status = 'failed' WHERE midtrans_order_id = $1`, [orderId]);
      console.error(`Midtrans Snap rejected order ${orderId}: ${response.status} ${errorText}`);
      return res.status(502).json({ message: 'Midtrans tidak dapat membuat pembayaran. Silakan coba lagi.' });
    }
    const result = await response.json();
    await pool.query(
      `UPDATE billing_orders SET snap_token = $1, redirect_url = $2 WHERE midtrans_order_id = $3`,
      [result.token, result.redirect_url, orderId],
    );
    res.json({ orderId, redirectUrl: result.redirect_url });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/midtrans-webhook', async (req, res, next) => {
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = req.body;
  if (!process.env.MIDTRANS_SERVER_KEY) return res.status(503).json({ message: 'Webhook belum dikonfigurasi.' });
  if (!orderId || !statusCode || !grossAmount || !signature) {
    return res.status(400).json({ message: 'Notifikasi Midtrans tidak lengkap.' });
  }
  if (!verifyNotificationSignature(req.body, process.env.MIDTRANS_SERVER_KEY)) {
    return res.status(403).json({ message: 'Signature Midtrans tidak valid.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT * FROM billing_orders WHERE midtrans_order_id = $1 FOR UPDATE`,
      [orderId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order pembayaran tidak ditemukan.' });
    }
    if (Number(grossAmount) !== order.amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nominal pembayaran tidak sesuai dengan order.' });
    }
    if (order.status === 'paid') {
      await client.query('COMMIT');
      return res.json({ ok: true });
    }
    const status = String(req.body.transaction_status || '');
    const paid = status === 'settlement'
      || (status === 'capture' && req.body.fraud_status === 'accept');
    if (paid) {
      const plan = getPlan(order.plan_id);
      if (plan.months === null) {
        await client.query(
          `UPDATE companies SET plan_id = $1, subscription_status = 'lifetime',
           active_until = NULL WHERE id = $2`,
          [plan.id, order.company_id],
        );
      } else {
        await client.query(
          `UPDATE companies
           SET plan_id = $1, subscription_status = 'active',
               active_until = GREATEST(COALESCE(active_until, now()), now())
                 + ($2 * interval '1 month')
           WHERE id = $3`,
          [plan.id, plan.months, order.company_id],
        );
      }
      await client.query(
        `UPDATE billing_orders SET status = 'paid', paid_at = now() WHERE id = $1`,
        [order.id],
      );
    } else if (['deny', 'cancel', 'expire', 'failure'].includes(status)) {
      await client.query(
        `UPDATE billing_orders SET status = $1 WHERE id = $2`,
        [status === 'expire' ? 'expired' : status === 'cancel' ? 'cancelled' : 'failed', order.id],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.get('/api/billing/notifications', authenticate, requireTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, body, created_at FROM billing_notifications
       WHERE company_id = $1 AND read_at IS NULL ORDER BY created_at DESC`,
      [req.user.company_id],
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/notifications/:id/read', authenticate, requireTenant, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE billing_notifications SET read_at = now()
       WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/platform/businesses', authenticate, requireRole('PLATFORM_OWNER'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.business_type, c.created_at, c.trial_ends_at,
              c.active_until, c.plan_id, c.subscription_status,
              u.email AS owner_email,
              (SELECT count(*)::int FROM users m WHERE m.company_id = c.id) AS user_count,
              (SELECT count(*)::int FROM billing_orders b WHERE b.company_id = c.id AND b.status = 'paid') AS paid_order_count,
              (SELECT COALESCE(sum(b.amount), 0)::bigint FROM billing_orders b WHERE b.company_id = c.id AND b.status = 'paid') AS lifetime_revenue
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id AND u.role = 'SUPER ADMIN'
       ORDER BY c.created_at DESC`,
    );
    res.json({
      businesses: result.rows.map((row) => ({
        ...row,
        status: subscriptionStatus({ trialEndsAt: row.trial_ends_at, activeUntil: row.active_until, planId: row.plan_id }),
      })),
      summary: {
        total: result.rowCount,
        trials: result.rows.filter((row) => subscriptionStatus({ trialEndsAt: row.trial_ends_at, activeUntil: row.active_until, planId: row.plan_id }) === 'trial').length,
        active: result.rows.filter((row) => ['active', 'lifetime'].includes(subscriptionStatus({ trialEndsAt: row.trial_ends_at, activeUntil: row.active_until, planId: row.plan_id }))).length,
        paidRevenue: result.rows.reduce((total, row) => total + Number(row.lifetime_revenue), 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ message: 'Terjadi kesalahan server. Silakan coba lagi.' });
});

async function sendRenewalReminders() {
  const result = await pool.query(
    `SELECT id, name, active_until, trial_ends_at, plan_id
     FROM companies
     WHERE plan_id IS DISTINCT FROM 'lifetime' AND subscription_status != 'suspended'`,
  );
  const now = new Date();
  for (const company of result.rows) {
    const expiresAt = company.active_until || company.trial_ends_at;
    const status = subscriptionStatus({
      trialEndsAt: company.trial_ends_at,
      activeUntil: company.active_until,
      planId: company.plan_id,
    }, now);
    const cycle = new Date(expiresAt).toISOString();
    if (status === 'expired') {
      await pool.query(
        `INSERT INTO billing_notifications (company_id, dedupe_key, title, body)
         VALUES ($1, $2, 'Masa aktif telah berakhir', $3)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [company.id, `${company.id}:${cycle}:expired`, `Masa aktif ${company.name} telah berakhir. Aktivasi paket diperlukan untuk membuka workspace.`],
      );
      continue;
    }
    const remaining = new Date(expiresAt).getTime() - now.getTime();
    if (remaining > 3 * 24 * 60 * 60 * 1000 || remaining <= 0) continue;
    await pool.query(
      `INSERT INTO billing_notifications (company_id, dedupe_key, title, body)
       VALUES ($1, $2, 'Masa aktif segera berakhir', $3)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [company.id, `${company.id}:${cycle}:3-days`, `Masa aktif ${company.name} berakhir dalam 3 hari. Pilih paket untuk memperpanjang layanan.`],
    );
  }
}

async function start() {
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
    throw new Error('DATABASE_URL dan SESSION_SECRET harus diatur sebelum server berjalan.');
  }
  const migration = await readFile(
    fileURLToPath(new URL('./migrations/001_billing.sql', import.meta.url)),
    'utf8',
  );
  await pool.query(migration);
  app.listen(PORT, () => console.log(`KelolaUsaha API listening on ${PORT}`));
  const reminderTimer = setInterval(() => {
    sendRenewalReminders().catch((error) => console.error('Reminder job failed:', error));
  }, 60 * 60 * 1000);
  reminderTimer.unref();
  sendRenewalReminders().catch((error) => console.error('Initial reminder job failed:', error));
}

start().catch((error) => {
  console.error('API startup failed:', error);
  process.exitCode = 1;
});
