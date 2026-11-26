import 'dotenv/config';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { Server as SocketIOServer } from 'socket.io';
import { simpleParser } from 'mailparser';
import pg from 'pg';
import { fileTypeFromBuffer } from 'file-type';
import {
  businessTypes,
  businessTypeIds,
  filterPermissionsForBusiness,
} from '../shared/business-modules.js';
import {
  getIndustryRoles,
  getRolePermissions,
  flattenRolePermissions,
  createIndustryAuditEvent,
} from '../shared/industry-business-engine.js';
import { createDealerMotorRouter } from './dealer-motor.js';
import { midtransFailureMessage, resolveMidtransEnvironment, verifyNotificationSignature } from './midtrans.js';
import { createOperationsRouter, createPublicOperationsRouter } from './operations.js';
import { addCalendarMonths, getBranchAddon, getPlan, plans, branchAddons, subscriptionStatus, trialEndsAt } from './plans.js';
import { resolveTenantSlug, slugifyBusinessName, workspaceUrlFor } from './tenant-domain.js';
import { createWorkspaceOperationsRouter } from './workspace-operations.js';
import { processInboundSupportEmail } from './support-email.js';
import {
  notifySupportTicketCreated,
  notifySupportTicketUpdated,
  registerSupportSockets,
} from './support-chat.js';

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = Number(process.env.API_PORT) || 4000;
const SESSION_DAYS = 30;
const uploadDirectory = resolve(process.env.UPLOAD_DIR || 'uploads');
const privateAttendanceDirectory = process.env.PRIVATE_ATTENDANCE_DIR
  ? resolve(process.env.PRIVATE_ATTENDANCE_DIR)
  : resolve(uploadDirectory, '..', 'attendance-private');
const privateDeliveryDirectory = process.env.PRIVATE_DELIVERY_DIR
  ? resolve(process.env.PRIVATE_DELIVERY_DIR)
  : resolve(uploadDirectory, '..', 'delivery-private');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const otpRateLimits = new Map();
const sentSupportMailboxCursors = new Map();
let gmailSyncInProgress = false;
let supportIo = null;
const themeIds = new Set(['blue-professional', 'green-fresh', 'purple-elegant', 'orange-cheerful', 'pink-sweet', 'teal-modern', 'navy-elegant', 'yellow-warm', 'gray-minimal', 'white-clean']);
const imageExtensions = new Set(['png', 'jpg', 'webp', 'ico']);
const permissionSets = {
  'SUPER ADMIN': ['dashboard', 'spkCreate', 'spkViewAll', 'spkViewOwn', 'spkVerify', 'spkApprove', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'accessManage', 'themeManage', 'attendanceView', 'branchManage'],
  OWNER: ['dashboard', 'spkCreate', 'spkViewAll', 'spkViewOwn', 'spkVerify', 'spkApprove', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'reportsView', 'targetManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'accessManage', 'themeManage', 'activationManage', 'financeView', 'financeManage', 'attendanceView', 'attendanceManage', 'branchManage'],
  HRD: ['dashboard', 'userManage', 'attendanceView', 'attendanceManage'],
  SVP: ['dashboard', 'spkViewAll', 'unitManage', 'salesManage', 'spkApprove', 'reportsView', 'attendanceView'],
  SPV: ['dashboard', 'attendanceView'],
  'KEPALA TOKO': ['dashboard', 'attendanceView'],
  ADMIN: ['dashboard', 'spkCreate', 'spkViewAll', 'spkVerify', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView'],
  SALES: ['dashboard', 'spkCreate', 'spkViewOwn', 'customerManage', 'attendanceView'],
  KASIR: ['dashboard', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView'],
  DRIVER: ['dashboard', 'deliveryManage', 'attendanceView'],
  PLATFORM_OWNER: ['dashboard', 'platformBusinesses', 'platformBilling'],
  'Customer': ['dashboard', 'spkCreate', 'spkViewAll', 'spkVerify', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView']
};
const operationalTeamRoles = ['HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER'];
const platformPermissionIds = new Set(['platformBusinesses', 'platformBilling', 'supportManage']);
const superAdminRestrictedPermissions = new Set([
  'reportsView', 'targetManage', 'financeView', 'financeManage', 'activationManage',
]);
const editablePermissionIds = new Set(Object.values(permissionSets)
  .flat()
  .filter((permission) => !platformPermissionIds.has(permission)));

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function otpHash(email, otp) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(`${email}:${otp}`).digest('hex');
}

function configuredMidtransServerKey() {
  return String(process.env.MIDTRANS_SERVER_KEY || '').trim();
}

function appRootOrigin(req) {
  const configuredOrigin = String(process.env.APP_ORIGIN || '').trim();
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    const hostname = url.hostname.replace(/^www\./, '');
    return `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ''}`;
  }
  const requestHost = String(req.hostname || req.get('host') || '').toLowerCase();
  const rootDomain = requestHost === 'kelolausaha.store' || requestHost.endsWith('.kelolausaha.store')
    ? 'kelolausaha.store'
    : requestHost;
  return `${req.protocol}://${rootDomain}`;
}

function appRootDomain(req) {
  return new URL(appRootOrigin(req)).hostname;
}

async function requestTenantSlug(req) {
  return resolveTenantSlug(
    req.hostname || req.get('host'),
    appRootDomain(req),
    async (hostSlug) => {
      const result = await pool.query(
        `SELECT c.slug
         FROM companies c
         LEFT JOIN company_slug_aliases a ON a.company_id = c.id
         WHERE c.slug = $1 OR a.alias_slug = $1
         ORDER BY (c.slug = $1) DESC
         LIMIT 1`,
        [hostSlug],
      );
      return result.rows[0]?.slug;
    },
  );
}

function sessionCookieDomain() {
  const configuredDomain = String(process.env.APP_ROOT_DOMAIN || '').trim();
  const origin = configuredDomain
    ? `https://${configuredDomain.replace(/^\./, '')}`
    : String(process.env.APP_ORIGIN || 'https://kelolausaha.store').trim();
  const hostname = new URL(origin).hostname.replace(/^www\./, '');
  return hostname.includes('.') ? `; Domain=.${hostname}` : '';
}

async function uniqueBusinessSlug(client, businessName) {
  const baseSlug = slugifyBusinessName(businessName);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [baseSlug]);
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const result = await client.query(
      `SELECT 1 FROM companies WHERE slug = $1
       UNION ALL
       SELECT 1 FROM company_slug_aliases WHERE alias_slug = $1
       LIMIT 1`,
      [slug],
    );
    if (!result.rowCount) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function paymentOrigin(req) {
  return String(process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`).trim().replace(/\/+$/, '');
}

function configuredSmtpUser() {
  return String(process.env.SMTP_USER || process.env.IMAP_USER || process.env.SMTP_FROM || '').trim();
}

function configuredSupportEmail() {
  return String(process.env.SUPPORT_EMAIL || 'kelolausaha.store@gmail.com').trim();
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const domain = process.env.NODE_ENV === 'production' ? sessionCookieDomain() : '';
  res.setHeader('Set-Cookie', `ku_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}${domain}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const domain = process.env.NODE_ENV === 'production' ? sessionCookieDomain() : '';
  res.setHeader('Set-Cookie', `ku_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}${domain}`);
}

function cookieValue(req, key) {
  const cookies = req.headers.cookie?.split(';') ?? [];
  const value = cookies.find((cookie) => cookie.trim().startsWith(`${key}=`));
  return value?.trim().slice(key.length + 1);
}

function publicBusiness(row, req) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    workspaceUrl: row.slug ? workspaceUrlFor(row.slug, appRootOrigin(req)) : null,
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
      `SELECT u.id, u.name, u.email, u.role, u.permissions, u.industry_role,
              u.industry_permissions, u.company_id, u.branch_id,
              c.name AS company_name, c.slug AS company_slug, c.business_type, c.modules, c.trial_started_at,
              c.trial_ends_at, c.active_until, c.plan_id, c.subscription_status,
              c.theme_settings
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.active = true
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hash(token)],
    );
    if (!result.rowCount) return res.status(401).json({ message: 'Sesi telah berakhir. Silakan masuk kembali.' });
    req.user = {
      ...result.rows[0],
      permissions: filterPermissionsForBusiness(
        result.rows[0].permissions,
        result.rows[0].business_type,
        result.rows[0].modules,
      ),
    };
    const tenantSlug = await requestTenantSlug(req);
    if (tenantSlug && req.user.company_slug !== tenantSlug) {
      return res.status(403).json({ message: 'Akun ini tidak terdaftar pada workspace usaha tersebut.' });
    }
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

function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!Array.isArray(req.user.permissions)
      || !permissions.some((permission) => req.user.permissions.includes(permission))) {
      return res.status(403).json({ message: 'Akses tidak diizinkan.' });
    }
    next();
  };
}

function requireTenant(req, res, next) {
  if (!req.user.company_id) return res.status(403).json({ message: 'Akun ini tidak terikat ke workspace usaha.' });
  next();
}

function requireActiveTenant(req, res, next) {
  if (!['SUPER ADMIN', 'OWNER', 'ADMIN', 'SVP', 'SPV', 'KEPALA TOKO', 'HRD', 'SALES', 'KASIR', 'DRIVER'].includes(req.user.role)) {
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
  const smtpUser = configuredSmtpUser();
  if (!process.env.SMTP_HOST || !smtpUser || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP belum dikonfigurasi untuk pengiriman OTP.');
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || smtpUser,
    to: email,
    subject: `Kode Verifikasi Keamanan Anda: ${otp}`,
    text: `Yth. Pengguna,

Kami menerima permintaan verifikasi keamanan untuk akun Anda. Silakan masukkan kode One-Time Password (OTP) di bawah ini pada halaman verifikasi untuk melanjutkan:

${otp}

Informasi Penting:
- Masa Berlaku: Kode ini hanya berlaku selama 10 menit sejak pesan ini dikirimkan.
- Kerahasiaan: Kode OTP bersifat pribadi dan rahasia. Jangan berikan kode ini kepada siapa pun, termasuk staf atau pihak yang mengaku sebagai perwakilan resmi kami.
- Keamanan Akun: Apabila Anda tidak merasa mengajukan permintaan verifikasi ini, segera abaikan email ini dan disarankan untuk mengganti kata sandi akun Anda demi keamanan.

Hormat kami,
Tim Keamanan & Layanan Pelanggan`,
    html: `<div style="font-family:Arial,sans-serif;color:#26352e;line-height:1.6;max-width:600px;margin:0 auto">
      <p>Yth. Pengguna,</p>
      <p>Kami menerima permintaan verifikasi keamanan untuk akun Anda. Silakan masukkan kode <em>One-Time Password</em> (OTP) di bawah ini pada halaman verifikasi untuk melanjutkan:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#b42332">${otp}</p>
      <p><strong>Informasi Penting:</strong></p>
      <ul>
        <li><strong>Masa Berlaku:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong> sejak pesan ini dikirimkan.</li>
        <li><strong>Kerahasiaan:</strong> Kode OTP bersifat pribadi dan rahasia. Jangan berikan kode ini kepada siapa pun, termasuk staf atau pihak yang mengaku sebagai perwakilan resmi kami.</li>
        <li><strong>Keamanan Akun:</strong> Apabila Anda tidak merasa mengajukan permintaan verifikasi ini, segera abaikan email ini dan disarankan untuk mengganti kata sandi akun Anda demi keamanan.</li>
      </ul>
      <p>Hormat kami,<br><strong>Tim Keamanan &amp; Layanan Pelanggan</strong></p>
    </div>`,
  });
}

async function sendSupportEmail({ to, subject, text, ticketNumber }) {
  const smtpUser = configuredSmtpUser();
  if (!process.env.SMTP_HOST || !smtpUser || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP belum dikonfigurasi untuk notifikasi bantuan.');
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: process.env.SMTP_PASSWORD },
  });
  return transport.sendMail({
    from: configuredSupportEmail(),
    replyTo: configuredSupportEmail(),
    to,
    subject: `[${ticketNumber}] ${subject}`,
    text,
  });
}

function queueSupportEmailNotification(options, context, messageId = null) {
  void sendSupportEmail(options)
    .then(async (sentEmail) => {
      if (messageId && sentEmail.messageId) {
        await pool.query(
          'UPDATE support_messages SET email_message_id = $1 WHERE id = $2',
          [sentEmail.messageId, messageId],
        );
      }
    })
    .catch((error) => {
      console.error(`Support email notification failed (${context}):`, error.message);
    });
}

async function ingestGmailReplies() {
  const user = process.env.IMAP_USER || configuredSmtpUser() || configuredSupportEmail();
  const password = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
  if (gmailSyncInProgress) return;
  if (!user || !password) {
    throw new Error('IMAP belum dikonfigurasi. Atur IMAP_USER dan IMAP_PASSWORD.');
  }
  gmailSyncInProgress = true;

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_SECURE !== 'false',
    auth: { user, pass: password },
    logger: false,
  });

  let connected = false;
  try {
    await client.connect();
    connected = true;
    const supportEmail = configuredSupportEmail();
    const mailboxes = await client.list();
    const sentMailbox = mailboxes.find(({ path, specialUse }) => (
      specialUse?.toLowerCase() === '\\sent' || /\bsent\b/i.test(path)
    ));

    const syncMailbox = async (mailboxPath, mailboxKind) => {
      const lock = await client.getMailboxLock(mailboxPath);
      try {
        let searchQuery;
        let highestUid = null;
        if (mailboxKind === 'inbox') {
          searchQuery = { seen: false };
        } else {
          highestUid = Math.max(0, Number(client.mailbox?.uidNext || 1) - 1);
          const previousUid = sentSupportMailboxCursors.get(mailboxPath);
          if (previousUid !== undefined && previousUid >= highestUid) return;
          searchQuery = previousUid === undefined
            ? { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            : { uid: `${previousUid + 1}:${highestUid}` };
        }

        const uids = await client.search(searchQuery, { uid: true });
        if (uids === false || uids === undefined) {
          throw new Error(`Mailbox ${mailboxPath} tidak dapat dicari.`);
        }
        if (uids.length) {
          for await (const message of client.fetch(
            uids,
            { source: true, envelope: true },
            { uid: true },
          )) {
            const parsed = await simpleParser(message.source);
            await processInboundSupportEmail({
              mailboxUser: user,
              mailboxKind,
              mailboxPath,
              message: parsed,
              pool,
              sendEmail: sendSupportEmail,
              onMessage: (ticketId) => notifySupportTicketUpdated(supportIo, ticketId),
              supportEmail,
              uid: message.uid,
            });
            if (mailboxKind === 'inbox') {
              await client.messageFlagsAdd(message.uid, ['Seen'], { uid: true });
            }
          }
        }
        if (mailboxKind === 'sent') sentSupportMailboxCursors.set(mailboxPath, highestUid);
      } finally {
        lock.release();
      }
    };

    await syncMailbox('INBOX', 'inbox');
    if (sentMailbox && sentMailbox.path !== 'INBOX') {
      await syncMailbox(sentMailbox.path, 'sent');
    }
  } finally {
    try {
      if (connected) await client.logout();
    } finally {
      gmailSyncInProgress = false;
    }
  }
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.get('/api/system/status', (req, res) => {
  const serverKey = configuredMidtransServerKey();
  res.json({
    otp: Boolean(process.env.SESSION_SECRET && process.env.SMTP_HOST && configuredSmtpUser() && process.env.SMTP_PASSWORD),
    midtrans: Boolean(serverKey),
    ...(serverKey
      ? { midtransEnvironment: resolveMidtransEnvironment(serverKey, process.env.MIDTRANS_ENV) }
      : {}),
  });
});
app.get('/api/public/workspace', async (req, res, next) => {
  const slug = await requestTenantSlug(req);
  if (!slug) return res.status(404).json({ message: 'Workspace usaha tidak ditemukan.' });
  try {
    const result = await pool.query(
      'SELECT name, theme_settings FROM companies WHERE slug = $1',
      [slug],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace usaha tidak ditemukan.' });
    const themeSettings = result.rows[0].theme_settings || {};
    return res.json({
      workspace: {
        name: result.rows[0].name,
        logoUrl: typeof themeSettings.logoUrl === 'string' ? themeSettings.logoUrl : '',
      },
    });
  } catch (error) {
    return next(error);
  }
});
app.use('/uploads', express.static(uploadDirectory, { dotfiles: 'deny', index: false }));
app.use('/api/dealer-motor', createDealerMotorRouter({
  pool, authenticate, requireTenant, requireActiveTenant, requirePermission,
  upload, privateDeliveryDirectory, fileTypeFromBuffer,
}));
app.use('/api/operations', createOperationsRouter({
  pool, authenticate, requireTenant, requireActiveTenant, requireRole,
}));
app.use('/api/public', createPublicOperationsRouter({ pool }));
app.use('/api/workspace/operations', createWorkspaceOperationsRouter({
  pool, authenticate, requireTenant, requireActiveTenant, requireRole, upload,
  privateAttendanceDirectory, fileTypeFromBuffer,
}));

app.post('/api/auth/request-otp', requestOtpLimit, async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Alamat email tidak valid.' });
  }
  if (!process.env.SESSION_SECRET) {
    return res.status(503).json({ message: 'Layanan OTP belum dikonfigurasi. SESSION_SECRET server belum disetel.' });
  }
  if (!process.env.SMTP_HOST || !configuredSmtpUser() || !process.env.SMTP_PASSWORD) {
    return res.status(503).json({ message: 'Layanan OTP belum dikonfigurasi. Pengaturan SMTP server belum lengkap.' });
  }
  const isPlatformOwner = email === String(process.env.PLATFORM_OWNER_EMAIL || '').toLowerCase();
  const hasRegistration = Boolean(
    (req.body.registerAccount || (req.body.businessName && req.body.businessType))
      && !req.body.inviteToken,
  );
  const hasBusinessSetup = Boolean(req.body.businessName && req.body.businessType);
  if (hasBusinessSetup && !businessTypeIds.has(req.body.businessType)) {
    return res.status(400).json({ message: 'Jenis usaha tidak valid.' });
  }
  const requestedModules = Array.isArray(req.body.modules)
    ? req.body.modules
    : (hasBusinessSetup ? businessTypes[req.body.businessType].modules.map(([id]) => id) : []);
  const allowedModules = new Set(
    hasBusinessSetup ? businessTypes[req.body.businessType].modules.map(([id]) => id) : [],
  );
  if (hasBusinessSetup
    && (!requestedModules.includes('dashboard')
      || requestedModules.some((moduleId) => typeof moduleId !== 'string' || !allowedModules.has(moduleId))
      || new Set(requestedModules).size !== requestedModules.length)) {
    return res.status(400).json({ message: 'Struktur modul workspace tidak valid.' });
  }
  if (hasRegistration && !String(req.body.name || '').trim()) {
    return res.status(400).json({ message: 'Nama pengguna wajib diisi.' });
  }
  if (hasBusinessSetup && !String(req.body.businessName).trim()) {
    return res.status(400).json({ message: 'Nama usaha wajib diisi.' });
  }
  const tenantSlug = await requestTenantSlug(req);
  let invitedCompany = null;
  const existingUserResult = await pool.query(
    `SELECT u.company_id, u.active, u.approval_status, c.slug AS company_slug
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.email = $1`,
    [email],
  );
  const existingUser = existingUserResult.rows[0];
  if (tenantSlug) {
    const tenantResult = await pool.query('SELECT id FROM companies WHERE slug = $1', [tenantSlug]);
    if (!tenantResult.rowCount) return res.status(404).json({ message: 'Workspace usaha tidak ditemukan.' });
    if (existingUser && existingUser.company_slug !== tenantSlug) {
      return res.status(403).json({ message: 'Email ini sudah terhubung ke workspace usaha lain.' });
    }
  }
  if (existingUser && !existingUser.active) {
    return res.status(403).json({
      message: existingUser.approval_status === 'pending'
        ? 'Pendaftaran Anda masih menunggu persetujuan Owner atau Super Admin.'
        : 'Akun ini tidak aktif. Hubungi Owner atau Super Admin workspace.',
    });
  }
  if (req.body.inviteToken) {
    const invite = await pool.query(
      `SELECT c.id, c.slug FROM team_invites ti
       JOIN companies c ON c.id = ti.company_id
       WHERE ti.token_hash = $1 AND ti.consumed_at IS NULL AND ti.expires_at > now()`,
      [hash(String(req.body.inviteToken))],
    );
    if (!invite.rowCount) return res.status(400).json({ message: 'Link undangan tidak valid atau sudah kedaluwarsa.' });
    invitedCompany = invite.rows[0];
    if ((tenantSlug && invitedCompany.slug !== tenantSlug)
      || (existingUser && existingUser.company_id !== invitedCompany.id)) {
      return res.status(403).json({ message: 'Email atau link undangan tidak sesuai dengan workspace usaha ini.' });
    }
  }
  const otp = `${randomInt(0, 1000000)}`.padStart(6, '0');
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    businessName: String(req.body.businessName || '').trim(),
    businessType: String(req.body.businessType || ''),
    modules: requestedModules,
    registration: hasRegistration,
    inviteToken: String(req.body.inviteToken || ''),
    tenantSlug,
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
    const tenantSlug = await requestTenantSlug(req);
    if (String(payload.tenantSlug || '') !== String(tenantSlug || '')) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proses OTP harus diselesaikan pada workspace tempat pendaftaran dimulai.' });
    }
    if (tenantSlug && payload.isPlatformOwner) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Akun platform harus masuk dari halaman utama KelolaUsaha.store.' });
    }
    if (!constantTimeEqual(challenge.otp_hash, otpHash(email, otp))) {
      await client.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
      await client.query('COMMIT');
      return res.status(400).json({ message: 'Kode OTP salah atau sudah kedaluwarsa.' });
    }

    let userResult = await client.query(
      `SELECT id, company_id, name, email, role, permissions, active, approval_status
       FROM users WHERE email = $1 FOR UPDATE`,
      [email],
    );
    let user = userResult.rows[0];
    let business;
    let pendingApproval = false;
    let invite;
    if (payload.inviteToken) {
      const inviteResult = await client.query(
        `SELECT ti.*, c.slug AS company_slug FROM team_invites ti
         JOIN companies c ON c.id = ti.company_id
         WHERE ti.token_hash = $1 AND ti.consumed_at IS NULL AND ti.expires_at > now()
         FOR UPDATE OF ti`,
        [hash(payload.inviteToken)],
      );
      invite = inviteResult.rows[0];
      if (!invite) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Link undangan tidak valid atau sudah kedaluwarsa.' });
      }
      if (tenantSlug && invite.company_slug !== tenantSlug) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Link undangan tidak sesuai dengan workspace usaha ini.' });
      }
      if (user && user.company_id !== invite.company_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Email ini sudah terhubung ke workspace usaha lain.' });
      }
    }
    if (user && user.company_id) {
      const companyResult = await client.query('SELECT * FROM companies WHERE id = $1', [user.company_id]);
      business = companyResult.rows[0];
      if (tenantSlug && business?.slug !== tenantSlug) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Akun ini tidak terdaftar pada workspace usaha tersebut.' });
      }
    }
    if (user && !user.active) {
      await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);
      await client.query('COMMIT');
      if (user.approval_status === 'pending') {
        return res.status(202).json({
          pendingApproval: true,
          message: 'Pendaftaran Anda masih menunggu persetujuan Owner atau Super Admin.',
        });
      }
      return res.status(403).json({ message: 'Akun ini tidak aktif. Hubungi Owner atau Super Admin workspace.' });
    }
    if (!user && payload.isPlatformOwner) {
      const result = await client.query(
        `INSERT INTO users (name, email, role, permissions)
         VALUES ($1, $2, 'PLATFORM_OWNER', $3) RETURNING id, company_id, name, email, role, permissions`,
        [payload.name || 'Owner KelolaUsaha.store', email, JSON.stringify(permissionSets.PLATFORM_OWNER)],
      );
      user = result.rows[0];
    } else if (!user && payload.inviteToken) {
      const branchResult = invite.branch_id
        ? { rows: [{ id: invite.branch_id }] }
        : await client.query(
          'SELECT id FROM business_branches WHERE company_id = $1 AND is_primary = true',
          [invite.company_id],
        );
      const result = await client.query(
        `INSERT INTO users (
           company_id, branch_id, name, email, phone, role, permissions,
           industry_role, industry_permissions, active, approval_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'pending')
         RETURNING id, company_id, name, email, role, permissions, industry_role, industry_permissions`,
        [
          invite.company_id,
          branchResult.rows[0]?.id,
          payload.name || email,
          email,
          payload.phone,
          invite.role,
          JSON.stringify(
            permissionSets[invite.role] || [],
          ),
          invite.industry_role,
          JSON.stringify(invite.industry_permissions || []),
        ],
      );
      user = result.rows[0];
      await client.query('UPDATE team_invites SET consumed_at = now() WHERE token_hash = $1', [invite.token_hash]);
      pendingApproval = true;
    } else if (!user && payload.tenantSlug && payload.registration) {
      const companyResult = await client.query(
        'SELECT id FROM companies WHERE slug = $1 FOR UPDATE',
        [payload.tenantSlug],
      );
      if (!companyResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Workspace usaha tidak ditemukan.' });
      }
      const branchResult = await client.query(
        'SELECT id FROM business_branches WHERE company_id = $1 AND is_primary = true',
        [companyResult.rows[0].id],
      );
      const result = await client.query(
        `INSERT INTO users (
           company_id, branch_id, name, email, phone, role, permissions, active, approval_status
         ) VALUES ($1, $2, $3, $4, $5, 'SALES', $6, false, 'pending')
         RETURNING id, company_id, name, email, role, permissions`,
        [
          companyResult.rows[0].id,
          branchResult.rows[0]?.id,
          payload.name || email,
          email,
          payload.phone,
          JSON.stringify(permissionSets.SALES),
        ],
      );
      user = result.rows[0];
      pendingApproval = true;
    } else if (!user && payload.registration && !payload.businessName) {
      const result = await client.query(
        `INSERT INTO users (name, email, phone, role, permissions)
         VALUES ($1, $2, $3, 'OWNER', $4)
         RETURNING id, company_id, name, email, role, permissions`,
        [payload.name, email, payload.phone, JSON.stringify(permissionSets.OWNER)],
      );
      user = result.rows[0];
    } else if (!user && payload.businessName) {
      const trialEnd = trialEndsAt(new Date());
      const slug = await uniqueBusinessSlug(client, payload.businessName);
      const companyResult = await client.query(
        `INSERT INTO companies (name, slug, business_type, modules, trial_ends_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [payload.businessName, slug, payload.businessType, JSON.stringify(payload.modules), trialEnd],
      );
      business = companyResult.rows[0];
      const branchResult = await client.query(
        `INSERT INTO business_branches (company_id, name, code, is_primary)
         VALUES ($1, 'Cabang Utama', 'PUSAT', true)
         RETURNING id`,
        [business.id],
      );
      await client.query(
        'INSERT INTO attendance_settings (company_id) VALUES ($1)',
        [business.id],
      );
      const result = await client.query(
        `INSERT INTO users (company_id, branch_id, name, email, phone, role, permissions)
         VALUES ($1, $2, $3, $4, $5, 'OWNER', $6)
         RETURNING id, company_id, name, email, role, permissions`,
          [business.id, branchResult.rows[0].id, payload.name, email, payload.phone, JSON.stringify(permissionSets.OWNER)],
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
    if (pendingApproval) {
      await client.query('COMMIT');
      return res.status(202).json({
        pendingApproval: true,
        message: 'Pendaftaran berhasil. Akun Anda dapat digunakan setelah disetujui Owner atau Super Admin.',
      });
    }
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
      ...(business ? { business: publicBusiness(business, req) } : {}),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/setup-business', authenticate, requireRole('OWNER'), async (req, res, next) => {
  const businessName = String(req.body?.businessName || '').trim();
  const businessAddress = String(req.body?.businessAddress || '').trim();
  const businessType = String(req.body?.businessType || '');
  const modules = req.body?.modules;
  if (!businessName || businessName.length > 160
    || !businessAddress || businessAddress.length > 500
    || !businessTypeIds.has(businessType)) {
    return res.status(400).json({ message: 'Nama, alamat, atau jenis usaha tidak valid.' });
  }
  const allowedModules = new Set(businessTypes[businessType].modules.map(([id]) => id));
  if (!Array.isArray(modules)
    || !modules.includes('dashboard')
    || modules.some((moduleId) => typeof moduleId !== 'string' || !allowedModules.has(moduleId))
    || new Set(modules).size !== modules.length) {
    return res.status(400).json({ message: 'Struktur modul workspace tidak valid.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT id, company_id, name, email, phone, role, permissions FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id],
    );
    const user = userResult.rows[0];
    if (!user || user.role !== 'OWNER') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Hanya Owner yang dapat menyiapkan workspace.' });
    }
    if (user.company_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Akun ini sudah memiliki workspace usaha.' });
    }

    const companyResult = await client.query(
      `INSERT INTO companies (name, slug, business_type, modules, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        businessName,
        await uniqueBusinessSlug(client, businessName),
        businessType,
        JSON.stringify(modules),
        trialEndsAt(new Date()),
      ],
    );
    const business = companyResult.rows[0];
    const branchResult = await client.query(
      `INSERT INTO business_branches (company_id, name, code, address, is_primary)
       VALUES ($1, 'Cabang Utama', 'PUSAT', $2, true)
       RETURNING id`,
      [business.id, businessAddress],
    );
    await client.query('INSERT INTO attendance_settings (company_id) VALUES ($1)', [business.id]);
    const updatedUserResult = await client.query(
      `UPDATE users SET company_id = $1, branch_id = $2
       WHERE id = $3
       RETURNING id, company_id, branch_id, name, email, role, permissions`,
      [business.id, branchResult.rows[0].id, user.id],
    );
    await client.query('COMMIT');
    return res.status(201).json({
      user: updatedUserResult.rows[0],
      business: publicBusiness(business, req),
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
      ...(company ? { business: publicBusiness(company, req) } : {}),
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

app.post('/api/team/invites', authenticate, requireRole('OWNER', 'SUPER ADMIN'), requireTenant, requireActiveTenant, async (req, res, next) => {
  const role = String(req.body.role || '');
  const industryRole = String(req.body.industryRole || '').trim();
  const industryRoles = getIndustryRoles(req.user.business_type);
  const legacyRoles = req.user.role === 'OWNER'
    ? ['SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER']
    : ['HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER'];
  const allowedRoles = [...new Set([...legacyRoles, ...industryRoles])];
  const industryPermissions = industryRole
    ? flattenRolePermissions(req.user.business_type, industryRole)
    : [];
  if (industryRole && !industryRoles.includes(industryRole)) {
    return res.status(400).json({ message: 'Peran industri tidak valid untuk jenis usaha ini.' });
  }
  if (industryRole && !role) {
    return res.status(400).json({ message: 'Peran operasional wajib dipilih.' });
  }
  let branchId = req.body.branchId ? String(req.body.branchId) : null;
  if (!allowedRoles.includes(role) || (branchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId))) {
    return res.status(400).json({ message: 'Peran undangan tidak valid.' });
  }
  try {
    if (branchId) {
      const branch = await pool.query(
        'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
        [branchId, req.user.company_id],
      );
      if (!branch.rowCount) return res.status(404).json({ message: 'Cabang tidak ditemukan.' });
    } else {
      const primaryBranch = await pool.query(
        'SELECT id FROM business_branches WHERE company_id = $1 AND is_primary = true AND active = true',
        [req.user.company_id],
      );
      branchId = primaryBranch.rows[0]?.id || null;
    }
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO team_invites (
         token_hash, company_id, branch_id, role, industry_role,
         industry_permissions, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, now() + interval '7 days')`,
      [
        hash(token),
        req.user.company_id,
        branchId,
        role,
        industryRole || null,
        JSON.stringify(industryPermissions),
      ],
    );
    const origin = workspaceUrlFor(req.user.company_slug, appRootOrigin(req));
    res.json({ inviteUrl: `${origin}/?invite=${token}`, workspaceUrl: origin });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/members', authenticate, requireRole('OWNER', 'SUPER ADMIN'), requireTenant, requireActiveTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, permissions,
              industry_role AS "industryRole",
              industry_permissions AS "industryPermissions",
              active,
              approval_status AS "approvalStatus", created_at AS "createdAt"
       FROM users WHERE company_id = $1
       ORDER BY CASE WHEN approval_status = 'pending' THEN 0 ELSE 1 END, created_at DESC`,
      [req.user.company_id],
    );
    res.json({
      users: result.rows.map((user) => ({
        ...user,
        permissions: filterPermissionsForBusiness(
          user.permissions,
          req.user.business_type,
          req.user.modules,
        ),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/team/members/:id/access', authenticate, requireRole('OWNER', 'SUPER ADMIN'), requireTenant, requireActiveTenant, async (req, res, next) => {
  const { role, permissions, active } = req.body || {};
  const allowedRoles = ['SUPER ADMIN', ...operationalTeamRoles];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)
    || !allowedRoles.includes(role)
    || !Array.isArray(permissions)
    || permissions.length > editablePermissionIds.size
    || permissions.some((permission) => typeof permission !== 'string' || !editablePermissionIds.has(permission))
    || new Set(permissions).size !== permissions.length
    || typeof active !== 'boolean') {
    return res.status(400).json({ message: 'Pengaturan peran atau hak akses tidak valid.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const targetResult = await client.query(
      'SELECT id, role FROM users WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [req.params.id, req.user.company_id],
    );
    const target = targetResult.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Pengguna tidak ditemukan pada workspace ini.' });
    }
    if (target.id === req.user.id || ['OWNER', 'PLATFORM_OWNER'].includes(target.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Akun Owner dan akun Anda sendiri tidak dapat diubah dari pengaturan ini.' });
    }
    if (req.user.role === 'SUPER ADMIN' && role === 'SUPER ADMIN' && target.role !== 'SUPER ADMIN') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Hanya Owner yang dapat menetapkan peran Super Admin.' });
    }

    const businessPermissions = filterPermissionsForBusiness(
      permissions,
      req.user.business_type,
      req.user.modules,
    );
    const savedPermissions = role === 'SUPER ADMIN'
      ? businessPermissions.filter((permission) => !superAdminRestrictedPermissions.has(permission))
      : businessPermissions;
    const result = await client.query(
      `UPDATE users
       SET role = $1, permissions = $2::jsonb, active = $3
       WHERE id = $4 AND company_id = $5
       RETURNING id, name, email, role, permissions, active,
                 approval_status AS "approvalStatus", created_at AS "createdAt"`,
      [role, JSON.stringify(savedPermissions), active, target.id, req.user.company_id],
    );
    await client.query('COMMIT');
    return res.json({
      user: {
        ...result.rows[0],
        permissions: filterPermissionsForBusiness(
          result.rows[0].permissions,
          req.user.business_type,
          req.user.modules,
        ),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

app.patch('/api/team/members/:id/approval', authenticate, requireRole('OWNER', 'SUPER ADMIN'), requireTenant, requireActiveTenant, async (req, res, next) => {
  const decision = req.body?.decision;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)
    || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ message: 'Keputusan persetujuan tidak valid.' });
  }
  try {
    const result = await pool.query(
      `UPDATE users
       SET approval_status = $1, active = $2
       WHERE id = $3 AND company_id = $4 AND role NOT IN ('OWNER', 'PLATFORM_OWNER')
         AND approval_status = 'pending'
       RETURNING id, name, email, role, permissions, active,
                 approval_status AS "approvalStatus", created_at AS "createdAt"`,
      [decision === 'approve' ? 'approved' : 'rejected', decision === 'approve', req.params.id, req.user.company_id],
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Pendaftaran menunggu persetujuan tidak ditemukan di workspace ini.' });
    }
    return res.json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/workspace/theme', authenticate, requireTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT theme_settings, business_type, modules FROM companies WHERE id = $1',
      [req.user.company_id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({
      themeSettings: result.rows[0].theme_settings,
      businessType: result.rows[0].business_type,
      modules: result.rows[0].modules,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/workspace/profile', authenticate, requireTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.name,
              COALESCE(c.phone, '') AS phone,
              COALESCE((
                SELECT b.address
                FROM business_branches b
                WHERE b.company_id = c.id AND b.is_primary = true
                LIMIT 1
              ), '') AS address,
              COALESCE(c.theme_settings ->> 'logoUrl', '') AS "logoUrl",
              COALESCE(c.theme_settings ->> 'qrisUrl', '') AS "qrisUrl"
       FROM companies c
       WHERE c.id = $1`,
      [req.user.company_id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.put('/api/workspace/profile', authenticate, requireRole('SUPER ADMIN', 'OWNER'), requireTenant, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const logoUrl = typeof req.body?.logoUrl === 'string' ? req.body.logoUrl.trim() : '';
  const qrisUrl = typeof req.body?.qrisUrl === 'string' ? req.body.qrisUrl.trim() : null;
  const validAsset = (value) => !value
    || (value.length <= 500
      && value.startsWith(`/uploads/${req.user.company_id}/`)
      && !value.includes('..'));
  if (!name || name.length > 160 || !address || address.length > 500
    || !/^[+()\d\s.-]{8,30}$/.test(phone) || !validAsset(logoUrl)
    || (req.body?.qrisUrl !== undefined && qrisUrl === null)
    || !validAsset(qrisUrl)) {
    return res.status(400).json({ message: 'Nama, alamat, nomor HP, logo, atau QRIS usaha tidak valid.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const company = await client.query(
      `UPDATE companies
       SET name = $1,
           phone = $2,
           theme_settings = jsonb_set(
             jsonb_set(COALESCE(theme_settings, '{}'::jsonb), '{logoUrl}', to_jsonb($3::text), true),
             '{qrisUrl}',
             to_jsonb(COALESCE($4::text, COALESCE(theme_settings ->> 'qrisUrl', ''))),
             true
           )
       WHERE id = $5
       RETURNING name, phone, theme_settings ->> 'logoUrl' AS "logoUrl",
                 theme_settings ->> 'qrisUrl' AS "qrisUrl"`,
      [name, phone, logoUrl, qrisUrl, req.user.company_id],
    );
    if (!company.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    }

    const branch = await client.query(
      `UPDATE business_branches
       SET address = $1
       WHERE company_id = $2 AND is_primary = true
       RETURNING address`,
      [address, req.user.company_id],
    );
    if (!branch.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Cabang utama usaha tidak ditemukan.' });
    }

    await client.query('COMMIT');
    res.json({
      profile: {
        name: company.rows[0].name,
        address: branch.rows[0].address,
        logoUrl: company.rows[0].logoUrl || '',
        qrisUrl: company.rows[0].qrisUrl || '',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
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
  const qrisUrl = typeof req.body?.qrisUrl === 'string' ? req.body.qrisUrl.trim() : undefined;
  const hasQrisUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'qrisUrl');
  const hasReceiptSettings = Object.prototype.hasOwnProperty.call(req.body || {}, 'receiptSettings');
  const receiptSettings = req.body?.receiptSettings;
  const validColor = (value) => value === '' || /^#[0-9a-f]{6}$/i.test(value);
  const validAsset = (value) => !value
    || (value.startsWith(`/uploads/${req.user.company_id}/`) && !value.includes('..'));
  const themeSettings = { themeId, customPrimary, customSecondary, mode, sidebarMode, statCardStyle, logoUrl, faviconUrl };
  if (qrisUrl !== undefined) themeSettings.qrisUrl = qrisUrl;
  if (hasReceiptSettings) {
    themeSettings.receiptSettings = {
      mode: receiptSettings?.mode,
      accent: receiptSettings?.accent,
      storeAddress: typeof receiptSettings?.storeAddress === 'string' ? receiptSettings.storeAddress.trim() : '',
      footerNote: typeof receiptSettings?.footerNote === 'string' ? receiptSettings.footerNote.trim() : '',
    };
  }
  const validReceiptSettings = !hasReceiptSettings || (
    receiptSettings
    && typeof receiptSettings === 'object'
    && !Array.isArray(receiptSettings)
    && ['digital', 'thermal', 'mobile'].includes(receiptSettings.mode)
    && ['emerald', 'crimson', 'royal'].includes(receiptSettings.accent)
    && typeof receiptSettings.storeAddress === 'string'
    && receiptSettings.storeAddress.length <= 240
    && typeof receiptSettings.footerNote === 'string'
    && receiptSettings.footerNote.length <= 240
  );
  if (!themeIds.has(themeId)
    || !validColor(customPrimary)
    || !validColor(customSecondary)
    || !['light', 'dark'].includes(mode)
    || !['mini', 'wide'].includes(sidebarMode)
    || !['shadow', 'border', 'soft'].includes(statCardStyle)
    || !validAsset(logoUrl)
    || !validAsset(faviconUrl)
    || !validReceiptSettings
    || (hasQrisUrl && qrisUrl === undefined)
    || !validAsset(qrisUrl)) {
    return res.status(400).json({ message: 'Pengaturan tampilan tidak valid.' });
  }
  try {
    const result = await pool.query(
      `UPDATE companies
       SET theme_settings = COALESCE(theme_settings, '{}'::jsonb) || $1::jsonb
       WHERE id = $2
       RETURNING theme_settings`,
      [JSON.stringify(themeSettings), req.user.company_id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({ themeSettings: result.rows[0].theme_settings });
  } catch (error) {
    next(error);
  }
});

app.post('/api/workspace/assets', authenticate, requireRole('SUPER ADMIN', 'OWNER'), requireTenant, upload.single('file'), async (req, res, next) => {
  if (!req.file || !['logo', 'favicon', 'qris'].includes(req.body.assetType)) {
    return res.status(400).json({ message: 'Pilih file logo, favicon, atau QRIS yang valid.' });
  }
  try {
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    const allowedExtensions = req.body.assetType === 'qris'
      ? new Set(['png', 'jpg', 'webp'])
      : imageExtensions;
    if (!fileType || !allowedExtensions.has(fileType.ext)) {
      return res.status(400).json({
        message: req.body.assetType === 'qris'
          ? 'Format QRIS tidak didukung. Gunakan PNG, JPG, atau WebP.'
          : 'Format gambar tidak didukung. Gunakan PNG, JPG, WebP, atau ICO.',
      });
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

app.get('/api/finance/entries', authenticate, requireRole('OWNER'), requireTenant, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.branch_id AS "branchId", b.name AS "branchName",
              e.entry_type AS type, e.category, e.description, e.amount,
              to_char(e.entry_date, 'YYYY-MM-DD') AS "entryDate", e.created_at AS "createdAt"
       FROM company_ledger_entries e
       JOIN business_branches b ON b.id = e.branch_id AND b.company_id = e.company_id
       WHERE e.company_id = $1
       ORDER BY e.entry_date DESC, e.created_at DESC`,
      [req.user.company_id],
    );
    res.json({ entries: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/finance/entries', authenticate, requireRole('OWNER'), requireTenant, async (req, res, next) => {
  const { type, category, description, amount, entryDate } = req.body;
  const branchId = req.body.branchId || req.user.branch_id;
  const validDate = typeof entryDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)
    && !Number.isNaN(Date.parse(`${entryDate}T00:00:00Z`))
    && new Date(`${entryDate}T00:00:00Z`).toISOString().slice(0, 10) === entryDate;
  if (!['income', 'expense'].includes(type)
    || typeof category !== 'string'
    || !category.trim()
    || category.trim().length > 80
    || typeof description !== 'string'
    || !description.trim()
    || description.trim().length > 300
    || !Number.isSafeInteger(amount)
    || amount <= 0
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(branchId || ''))
    || !validDate) {
    return res.status(400).json({ message: 'Data pembukuan tidak valid.' });
  }
  try {
    const branch = await pool.query(
      'SELECT id FROM business_branches WHERE id = $1 AND company_id = $2 AND active = true',
      [branchId, req.user.company_id],
    );
    if (!branch.rowCount) return res.status(400).json({ message: 'Cabang pembukuan tidak valid.' });
    const result = await pool.query(
      `INSERT INTO company_ledger_entries (company_id, branch_id, created_by, entry_type, category, description, amount, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, branch_id AS "branchId", entry_type AS type, category, description, amount,
                 to_char(entry_date, 'YYYY-MM-DD') AS "entryDate", created_at AS "createdAt"`,
      [req.user.company_id, branchId, req.user.id, type, category.trim(), description.trim(), amount, entryDate],
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/billing/status', authenticate, requireRole('OWNER'), requireTenant, async (req, res, next) => {
  try {
    const [companyResult, orderResult, notificationResult] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]),
      pool.query(
        `SELECT id, plan_id, order_type AS "orderType", branch_count AS "branchCount",
                duration_months AS "durationMonths", amount, status, redirect_url,
                created_at, paid_at
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
      business: publicBusiness(companyResult.rows[0], req),
      orders: orderResult.rows,
      notifications: notificationResult.rows,
      plans,
      branchAddons,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/branch-addon/checkout', authenticate, requireRole('OWNER'), requireTenant, async (req, res, next) => {
  const addon = getBranchAddon(req.body?.months);
  const quantity = Number(req.body?.quantity);
  if (!addon || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ message: 'Jumlah cabang atau masa tambahan tidak valid.' });
  }
  if (!configuredMidtransServerKey()) {
    return res.status(503).json({ message: 'Pembayaran belum tersedia. Midtrans Server Key belum dikonfigurasi di server.' });
  }
  const amount = addon.pricePerBranch * quantity;
  try {
    const companyResult = await pool.query('SELECT id, name FROM companies WHERE id = $1', [req.user.company_id]);
    const company = companyResult.rows[0];
    if (!company) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    const orderId = `ku-br-${randomBytes(16).toString('hex')}`;
    await pool.query(
      `INSERT INTO billing_orders
         (company_id, plan_id, amount, midtrans_order_id, order_type, branch_count, duration_months)
       VALUES ($1, $2, $3, $4, 'branch_addon', $5, $6)`,
      [company.id, `branch_${addon.months || 'lifetime'}`, amount, orderId, quantity, addon.months],
    );
    const sandbox = resolveMidtransEnvironment(
      configuredMidtransServerKey(),
      process.env.MIDTRANS_ENV,
    ) === 'sandbox';
    const baseUrl = sandbox ? 'https://app.sandbox.midtrans.com' : 'https://app.midtrans.com';
    const authorization = Buffer.from(`${configuredMidtransServerKey()}:`).toString('base64');
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{
          id: `branch_${addon.months || 'lifetime'}`,
          price: addon.pricePerBranch,
          quantity,
          name: `Tambahan ${quantity} cabang (${addon.label})`.slice(0, 50),
        }],
        customer_details: { first_name: company.name.slice(0, 50), email: req.user.email },
        callbacks: { finish: `${paymentOrigin(req)}/?payment=check&branchAddon=1` },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      await pool.query(`UPDATE billing_orders SET status = 'failed' WHERE midtrans_order_id = $1`, [orderId]);
      console.error(`Midtrans Snap rejected branch add-on ${orderId}: ${response.status} ${errorText}`);
      return res.status(502).json({ message: midtransFailureMessage(response.status, errorText) });
    }
    const result = await response.json();
    await pool.query(
      `UPDATE billing_orders SET snap_token = $1, redirect_url = $2 WHERE midtrans_order_id = $3`,
      [result.token, result.redirect_url, orderId],
    );
    res.json({ orderId, redirectUrl: result.redirect_url, amount });
  } catch (error) {
    next(error);
  }
});

app.post('/api/billing/checkout', authenticate, requireRole('OWNER'), requireTenant, async (req, res, next) => {
  const plan = getPlan(String(req.body.planId || ''));
  if (!plan) return res.status(400).json({ message: 'Paket aktivasi tidak valid.' });
  if (!configuredMidtransServerKey()) {
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
    const sandbox = resolveMidtransEnvironment(
      configuredMidtransServerKey(),
      process.env.MIDTRANS_ENV,
    ) === 'sandbox';
    const baseUrl = sandbox ? 'https://app.sandbox.midtrans.com' : 'https://app.midtrans.com';
    const authorization = Buffer.from(`${configuredMidtransServerKey()}:`).toString('base64');
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: plan.amount },
        item_details: [{ id: plan.id, price: plan.amount, quantity: 1, name: `KelolaUsaha ${plan.label}` }],
        customer_details: { first_name: company.name.slice(0, 50), email: req.user.email },
        callbacks: { finish: `${paymentOrigin(req)}/?payment=check` },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      await pool.query(`UPDATE billing_orders SET status = 'failed' WHERE midtrans_order_id = $1`, [orderId]);
      console.error(`Midtrans Snap rejected order ${orderId}: ${response.status} ${errorText}`);
      return res.status(502).json({ message: midtransFailureMessage(response.status, errorText) });
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
  if (!configuredMidtransServerKey()) return res.status(503).json({ message: 'Webhook belum dikonfigurasi.' });
  if (!orderId || !statusCode || !grossAmount || !signature) {
    return res.status(400).json({ message: 'Notifikasi Midtrans tidak lengkap.' });
  }
  if (!verifyNotificationSignature(req.body, configuredMidtransServerKey())) {
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
      if (order.order_type === 'branch_addon') {
        const durationMonths = Number(order.duration_months);
        const activeUntil = durationMonths === 0
          ? null
          : addCalendarMonths(new Date(), durationMonths);
        await client.query(
          `INSERT INTO branch_addon_entitlements
             (company_id, billing_order_id, branch_count, duration_months, active_from, active_until)
           VALUES ($1, $2, $3, $4, now(), $5)
           ON CONFLICT (billing_order_id) DO NOTHING`,
          [order.company_id, order.id, order.branch_count, durationMonths, activeUntil],
        );
      } else {
        const plan = getPlan(order.plan_id);
        if (!plan) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Paket pembayaran tidak valid.' });
        }
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

app.get('/api/support/contact', (_req, res) => {
  const email = configuredSupportEmail();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(503).json({ message: 'Email tim support belum dikonfigurasi.' });
  }
  res.json({ email });
});

app.post('/api/support/tickets', async (req, res, next) => {
  const requesterName = String(req.body?.name || '').trim();
  const requesterEmail = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!requesterName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)
    || !subject || message.length < 3 || message.length > 5000) {
    return res.status(400).json({ message: 'Lengkapi nama, email, kategori, dan pesan bantuan.' });
  }
  try {
    const ticketNumber = `KU-${randomBytes(4).toString('hex').toUpperCase()}`;
    const ticketResult = await pool.query(
      `INSERT INTO support_tickets (ticket_number, requester_name, requester_email, subject)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [ticketNumber, requesterName, requesterEmail, subject],
    );
    const ticket = ticketResult.rows[0];
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_type, sender_name, sender_email, body)
       VALUES ($1, 'user', $2, $3, $4)`,
      [ticket.id, requesterName, requesterEmail, message],
    );
    notifySupportTicketCreated(supportIo, ticket.id);
    queueSupportEmailNotification({
      to: configuredSupportEmail(),
      subject,
      ticketNumber,
      text: `Pesan baru dari ${requesterName} (${requesterEmail})\n\n${message}\n\nNomor tiket: ${ticketNumber}`,
    }, `new ticket ${ticketNumber}`);
    res.status(201).json({ ticket: { id: ticket.id, ticketNumber: ticket.ticket_number, status: ticket.status } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/support/tickets', async (req, res, next) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email pengguna wajib diisi.' });
  try {
    const result = await pool.query(
      `SELECT t.id, t.ticket_number, t.requester_name, t.requester_email, t.subject, t.status, t.created_at, t.updated_at,
              latest.id AS latest_owner_message_id, latest.body AS latest_owner_message,
              latest.created_at AS latest_owner_message_at, unread.message_count AS unread_owner_count
       FROM support_tickets t
       LEFT JOIN LATERAL (
         SELECT m.id, m.body, m.created_at FROM support_messages m
         WHERE m.ticket_id = t.id AND m.sender_type = 'owner'
         ORDER BY m.created_at DESC LIMIT 1
       ) latest ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS message_count FROM support_messages m
         WHERE m.ticket_id = t.id AND m.sender_type = 'owner' AND m.user_read_at IS NULL
       ) unread ON true
       WHERE t.requester_email = $1
       ORDER BY t.updated_at DESC LIMIT 50`,
      [email],
    );
    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/support/tickets/:ticketId', async (req, res, next) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  try {
    const ticketResult = await pool.query(
      `SELECT * FROM support_tickets WHERE id = $1 AND requester_email = $2`,
      [req.params.ticketId, email],
    );
    if (!ticketResult.rowCount) return res.status(404).json({ message: 'Percakapan tidak ditemukan.' });
    const messageResult = await pool.query(
      `SELECT id, sender_type, sender_name, sender_email, body, created_at
       FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [req.params.ticketId],
    );
    res.json({ ticket: ticketResult.rows[0], messages: messageResult.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/support/tickets/:ticketId/read', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email pengguna wajib diisi.' });
  try {
    const ticketResult = await pool.query(
      'SELECT id FROM support_tickets WHERE id = $1 AND requester_email = $2',
      [req.params.ticketId, email],
    );
    if (!ticketResult.rowCount) return res.status(404).json({ message: 'Percakapan tidak ditemukan.' });
    await pool.query(
      `UPDATE support_messages SET user_read_at = now()
       WHERE ticket_id = $1 AND sender_type = 'owner' AND user_read_at IS NULL`,
      [ticketResult.rows[0].id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/support/tickets/:ticketId/messages', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const body = String(req.body?.message || '').trim();
  if (!email || body.length < 3 || body.length > 5000) {
    return res.status(400).json({ message: 'Email dan pesan bantuan wajib diisi.' });
  }
  try {
    const ticketResult = await pool.query(
      `SELECT * FROM support_tickets WHERE id = $1 AND requester_email = $2`,
      [req.params.ticketId, email],
    );
    if (!ticketResult.rowCount) return res.status(404).json({ message: 'Percakapan tidak ditemukan.' });
    const ticket = ticketResult.rows[0];
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_type, sender_name, sender_email, body)
       VALUES ($1, 'user', $2, $3, $4)`,
      [ticket.id, ticket.requester_name, email, body],
    );
    await pool.query(
      `UPDATE support_tickets SET status = 'new', updated_at = now() WHERE id = $1`,
      [ticket.id],
    );
    notifySupportTicketUpdated(supportIo, ticket.id);
    queueSupportEmailNotification({
      to: configuredSupportEmail(),
      subject: ticket.subject,
      ticketNumber: ticket.ticket_number,
      text: `Pesan lanjutan dari ${ticket.requester_name} (${email})\n\n${body}\n\nNomor tiket: ${ticket.ticket_number}`,
    }, `user reply ${ticket.ticket_number}`);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/platform/support/tickets', authenticate, requireRole('PLATFORM_OWNER'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT t.*, COALESCE((SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id), 0) AS message_count,
             (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
      FROM support_tickets t ORDER BY t.updated_at DESC
    `);
    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get('/api/platform/support/tickets/:ticketId', authenticate, requireRole('PLATFORM_OWNER'), async (req, res, next) => {
  try {
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.ticketId]);
    if (!ticketResult.rowCount) return res.status(404).json({ message: 'Percakapan tidak ditemukan.' });
    const messageResult = await pool.query(
      `SELECT id, sender_type, sender_name, sender_email, body, created_at
       FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [req.params.ticketId],
    );
    res.json({ ticket: ticketResult.rows[0], messages: messageResult.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/platform/support/tickets/:ticketId/reply', authenticate, requireRole('PLATFORM_OWNER'), async (req, res, next) => {
  const body = String(req.body?.message || '').trim();
  const status = String(req.body?.status || 'waiting_user');
  if (body.length < 3 || body.length > 5000) {
    return res.status(400).json({ message: 'Balasan minimal 3 karakter.' });
  }
  if (!['new', 'processing', 'waiting_user', 'resolved'].includes(status)) {
    return res.status(400).json({ message: 'Status tiket tidak valid.' });
  }
  try {
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.ticketId]);
    if (!ticketResult.rowCount) return res.status(404).json({ message: 'Percakapan tidak ditemukan.' });
    const ticket = ticketResult.rows[0];
    const savedMessage = await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_type, sender_name, sender_email, body, email_direction)
       VALUES ($1, 'owner', 'Owner KelolaUsaha.store', $2, $3, 'outbound')
       RETURNING id`,
      [ticket.id, configuredSmtpUser(), body],
    );
    await pool.query(
      `UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2`,
      [status, ticket.id],
    );
    notifySupportTicketUpdated(supportIo, ticket.id);
    queueSupportEmailNotification({
      to: ticket.requester_email,
      subject: `Balasan: ${ticket.subject}`,
      ticketNumber: ticket.ticket_number,
      text: `Halo ${ticket.requester_name},\n\n${body}\n\nTim KelolaUsaha.store\n\nNomor tiket: ${ticket.ticket_number}`,
    }, `owner reply ${ticket.ticket_number}`, savedMessage.rows[0].id);
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
              c.branch_limit,
              u.email AS owner_email,
              (SELECT count(*)::int FROM users m WHERE m.company_id = c.id) AS user_count,
              (SELECT count(*)::int FROM business_branches b WHERE b.company_id = c.id AND b.active = true) AS active_branch_count,
              (SELECT COALESCE(sum(e.branch_count), 0)::int FROM branch_addon_entitlements e
                 WHERE e.company_id = c.id AND (e.active_until IS NULL OR e.active_until > now())) AS addon_branch_count,
              (SELECT count(*)::int FROM billing_orders b WHERE b.company_id = c.id AND b.status = 'paid') AS paid_order_count,
              (SELECT COALESCE(sum(b.amount), 0)::bigint FROM billing_orders b WHERE b.company_id = c.id AND b.status = 'paid') AS lifetime_revenue
       FROM companies c
       LEFT JOIN users u ON u.company_id = c.id AND u.role = 'OWNER'
       ORDER BY c.created_at DESC`,
    );
    const supportResult = await pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'new')::int AS new_count,
        count(*) FILTER (WHERE status IN ('processing', 'waiting_user'))::int AS active_count
      FROM support_tickets
    `);
    const recentBusinessResult = await pool.query(`
      SELECT id, name, business_type, created_at
      FROM companies ORDER BY created_at DESC LIMIT 5
    `);
    const recentPaymentResult = await pool.query(`
      SELECT b.id, b.plan_id, b.amount, b.status, b.paid_at, b.created_at, c.name AS business_name
      FROM billing_orders b JOIN companies c ON c.id = b.company_id
      ORDER BY COALESCE(b.paid_at, b.created_at) DESC LIMIT 5
    `);
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
        support: supportResult.rows[0],
      },
      activity: {
        recentBusinesses: recentBusinessResult.rows,
        recentPayments: recentPaymentResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/platform/businesses/:companyId/branch-limit', authenticate, requireRole('PLATFORM_OWNER'), async (req, res, next) => {
  const limit = Number(req.body?.branchLimit);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.companyId)
    || !Number.isInteger(limit) || limit < 3 || limit > 10000) {
    return res.status(400).json({ message: 'Batas cabang harus berupa angka antara 3 dan 10.000.' });
  }
  try {
    const result = await pool.query(
      `UPDATE companies SET branch_limit = $1 WHERE id = $2
       RETURNING id, name, branch_limit AS "branchLimit"`,
      [limit, req.params.companyId],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Workspace tidak ditemukan.' });
    res.json({ business: result.rows[0] });
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
  const migrationDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(resolve(migrationDirectory, migrationFile), 'utf8');
    await pool.query(migration);
  }
  const httpServer = createServer(app);
  supportIo = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    serveClient: false,
  });
  registerSupportSockets(supportIo, { pool, hash });
  httpServer.listen(PORT, () => console.log(`KelolaUsaha API listening on ${PORT}`));
  const reminderTimer = setInterval(() => {
    sendRenewalReminders().catch((error) => console.error('Reminder job failed:', error));
  }, 60 * 60 * 1000);
  reminderTimer.unref();
  sendRenewalReminders().catch((error) => console.error('Initial reminder job failed:', error));

  const supportEmailTimer = setInterval(() => {
    ingestGmailReplies().catch((error) => console.error('Gmail inbox sync failed:', error.message));
  }, 60 * 1000);
  supportEmailTimer.unref();
  ingestGmailReplies().catch((error) => console.error('Gmail inbox sync failed:', error.message));
}

start().catch((error) => {
  console.error('API startup failed:', error);
  process.exitCode = 1;
});
