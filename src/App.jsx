import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import './App.css';
import PublicSite from './PublicSite';
import { plans as activationPlans } from '../shared/plans.js';
import { businessTypes } from '../shared/business-modules.js';
import { dashboardThemes, defaultThemeSettings, getThemeColors, normalizeThemeSettings } from './themes.js';
import IndustryDashboard from './IndustryDashboard.jsx';
import { AttendanceWorkspace, BranchManagement } from './WorkspaceOperations.jsx';
import { DealerMotorWorkspace, DriverDeliveryWorkspace } from './DealerMotorWorkspace.jsx';
import { BusinessProfileSettings } from './BusinessProfileSettings.jsx';

const dealerName = 'Dealer Motor Wijaya Abadi Mulia';

function pageFromHash() {
  if (!window.location.hash.startsWith('#/')) return '';
  try {
    return decodeURIComponent(window.location.hash.slice(2));
  } catch {
    return '';
  }
}

const roleMenus = {
  'SUPER ADMIN': [
    ['Dashboard', '▦'],
    ['Profil Usaha', '⌂'],
    ['Struktur Workspace', '☷'],
    ['Cabang', '⌂'],
    ['Absensi', '◷'],
    ['Kasir', '＋'],
    ['Daftar Harga', 'Rp'],
    ['Transaksi', '▤'],
    ['Nota Digital', '▧'],
    ['Menu Digital', '☷'],
    ['Pesanan', '☷'],
    ['User Management', '♧'],
    ['Pengelolaan Akses', '♙'],
    ['Tampilan Dashboard', '⚙'],
    ['Log Aktivitas', '▤'],
  ],
  OWNER: [
    ['Dashboard', '▦'],
    ['Profil Usaha', '⌂'],
    ['Struktur Workspace', '☷'],
    ['Cabang', '⌂'],
    ['Absensi', '◷'],
    ['Kasir', '＋'],
    ['Pembukuan', 'Rp'],
    ['Aktivasi', '↗'],
    ['Pengelolaan Akses', '♙'],
    ['Daftar Harga', 'Rp'],
    ['Transaksi', '▤'],
    ['Nota Digital', '▧'],
    ['Menu Digital', '☷'],
    ['Pesanan', '☷'],
    ['Semua Unit', '⌂'],
    ['Semua SPK', '▤'],
    ['Laporan Penjualan', '▥'],
    ['Target', '◎'],
    ['User Management', '♙'],
    ['Tampilan Dashboard', '⚙'],
  ],
  SVP: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
    ['Unit Dealer', '⌂'],
    ['Sales', '♙'],
    ['SPK', '▤'],
    ['Approval', '✓'],
    ['Performance', '↗'],
  ],
  ADMIN: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
    ['Kasir', '＋'],
    ['Daftar Harga', 'Rp'],
    ['Transaksi', '▤'],
    ['Nota Digital', '▧'],
    ['Menu Digital', '☷'],
    ['Pesanan', '☷'],
    ['Input SPK', '+'],
    ['Customer', '♙'],
    ['Sales', '♧'],
    ['Motor', '⌂'],
    ['Leasing', '▣'],
    ['Dokumen', '▤'],
    ['Verifikasi SPK', '✓'],
  ],
  SALES: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
    ['Input SPK', '+'],
    ['Customer', '♙'],
    ['Follow Up', '↗'],
    ['Pengajuan', '▤'],
    ['SPK Saya', '▣'],
  ],
  KASIR: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
    ['Kasir', '＋'],
    ['Daftar Harga', 'Rp'],
    ['Transaksi', '▤'],
    ['Nota Digital', '▧'],
    ['Menu Digital', '☷'],
    ['Pesanan', '☷'],
  ],
  DRIVER: [
    ['Dashboard', '▦'],
    ['Pengiriman', '↗'],
    ['Absensi', '◷'],
  ],
  PLATFORM_OWNER: [
    ['Semua Usaha', '▥'],
    ['Pusat Bantuan', '?'],
  ],
  HRD: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
    ['Cabang', '⌂'],
    ['User Management', '♙'],
  ],
  SPV: [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
  ],
  'KEPALA TOKO': [
    ['Dashboard', '▦'],
    ['Absensi', '◷'],
  ],
};

const accessModules = [
  { id: 'dashboard', label: 'Dashboard', group: 'Umum' },
  { id: 'spkCreate', label: 'Input SPK', group: 'Penjualan' },
  { id: 'spkViewAll', label: 'Lihat semua SPK', group: 'Penjualan' },
  { id: 'spkViewOwn', label: 'Lihat SPK sendiri', group: 'Penjualan' },
  { id: 'spkVerify', label: 'Verifikasi SPK', group: 'Penjualan' },
  { id: 'spkApprove', label: 'Approval SPK', group: 'Penjualan' },
  { id: 'customerManage', label: 'Data customer', group: 'Data dealer' },
  { id: 'salesManage', label: 'Data sales', group: 'Data dealer' },
  { id: 'unitManage', label: 'Unit dealer & motor', group: 'Data dealer' },
  { id: 'deliveryManage', label: 'Pengiriman motor', group: 'Operasional' },
  { id: 'leasingManage', label: 'Data leasing & promo', group: 'Data dealer' },
  { id: 'reportsView', label: 'Laporan & performa', group: 'Laporan' },
  { id: 'targetManage', label: 'Target penjualan', group: 'Laporan' },
  { id: 'financeView', label: 'Lihat pembukuan & laba rugi', group: 'Keuangan' },
  { id: 'financeManage', label: 'Kelola pembukuan', group: 'Keuangan' },
  { id: 'posAccess', label: 'Kasir / POS', group: 'Operasional' },
  { id: 'priceManage', label: 'Daftar harga', group: 'Operasional' },
  { id: 'transactionsView', label: 'Transaksi', group: 'Operasional' },
  { id: 'receiptsView', label: 'Nota digital', group: 'Operasional' },
  { id: 'activationManage', label: 'Aktivasi paket', group: 'Administrasi' },
  { id: 'platformBusinesses', label: 'Rekap semua usaha', group: 'Platform' },
  { id: 'platformBilling', label: 'Rekap pembayaran', group: 'Platform' },
  { id: 'supportManage', label: 'Pusat bantuan', group: 'Platform' },
  { id: 'themeManage', label: 'Tampilan dashboard', group: 'Pengaturan' },
  { id: 'userManage', label: 'Manajemen pengguna', group: 'Administrasi' },
  { id: 'accessManage', label: 'Pengelolaan akses', group: 'Administrasi' },
  { id: 'attendanceView', label: 'Lihat absensi cabang', group: 'Karyawan' },
  { id: 'attendanceManage', label: 'Atur jam kerja & pengajuan', group: 'Karyawan' },
  { id: 'branchManage', label: 'Kelola cabang workspace', group: 'Administrasi' },
];

const rolePermissions = {
  'SUPER ADMIN': ['dashboard', 'spkCreate', 'spkViewAll', 'spkViewOwn', 'spkVerify', 'spkApprove', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'accessManage', 'themeManage', 'attendanceView', 'branchManage'],
  OWNER: ['dashboard', 'spkCreate', 'spkViewAll', 'spkViewOwn', 'spkVerify', 'spkApprove', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'reportsView', 'targetManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'userManage', 'accessManage', 'themeManage', 'activationManage', 'financeView', 'financeManage', 'attendanceView', 'attendanceManage', 'branchManage'],
  HRD: ['dashboard', 'userManage', 'attendanceView', 'attendanceManage', 'branchManage'],
  SVP: ['dashboard', 'spkViewAll', 'unitManage', 'salesManage', 'spkApprove', 'reportsView', 'attendanceView'],
  SPV: ['dashboard', 'attendanceView'],
  'KEPALA TOKO': ['dashboard', 'attendanceView'],
  ADMIN: ['dashboard', 'spkCreate', 'spkViewAll', 'spkVerify', 'customerManage', 'salesManage', 'unitManage', 'leasingManage', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView'],
  SALES: ['dashboard', 'spkCreate', 'spkViewOwn', 'customerManage', 'attendanceView'],
  KASIR: ['dashboard', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView'],
  DRIVER: ['dashboard', 'deliveryManage', 'attendanceView'],
  PLATFORM_OWNER: ['platformBusinesses', 'platformBilling', 'supportManage'],
};

const superAdminRestrictedPermissions = [
  'reportsView', 'targetManage', 'financeView', 'financeManage',
  'activationManage',
];

const extraPermissionMenus = [
  ['Input SPK', '+', 'spkCreate'],
  ['Semua SPK', '▤', 'spkViewAll'],
  ['SPK Saya', '▣', 'spkViewOwn'],
  ['Verifikasi SPK', '✓', 'spkVerify'],
  ['Approval', '✓', 'spkApprove'],
  ['Customer', '♙', 'customerManage'],
  ['Sales', '♧', 'salesManage'],
  ['Unit & Motor', '⌂', 'unitManage'],
  ['Pengiriman', '↗', 'deliveryManage'],
  ['Leasing & Promo', '▣', 'leasingManage'],
  ['Laporan Penjualan', '▥', 'reportsView'],
  ['Target', '◎', 'targetManage'],
  ['Pembukuan', 'Rp', 'financeView'],
  ['Kasir', '＋', 'posAccess'],
  ['Daftar Harga', 'Rp', 'priceManage'],
  ['Transaksi', '▤', 'transactionsView'],
  ['Nota Digital', '▧', 'receiptsView'],
  ['Aktivasi', '↗', 'activationManage'],
  ['Tampilan Dashboard', '⚙', 'themeManage'],
  ['User Management', '♙', 'userManage'],
  ['Pengelolaan Akses', '♙', 'accessManage'],
  ['Struktur Workspace', '☷', 'accessManage'],
  ['Absensi', '◷', 'attendanceView'],
  ['Cabang', '⌂', 'branchManage'],
];

function menuPermission(label) {
  if (label === 'Dashboard') return 'dashboard';
  if (label === 'Input SPK') return 'spkCreate';
  if (['Semua SPK', 'SPK'].includes(label)) return 'spkViewAll';
  if (['SPK Saya', 'Pengajuan', 'Follow Up'].includes(label)) return 'spkViewOwn';
  if (['Semua Unit', 'Unit Dealer', 'Motor', 'Unit & Motor'].includes(label)) return 'unitManage';
  if (label === 'Pengiriman') return 'deliveryManage';
  if (['Laporan Penjualan', 'Performance'].includes(label)) return 'reportsView';
  if (label === 'Target') return 'targetManage';
  if (label === 'Pembukuan') return 'financeView';
  if (label === 'User Management') return 'userManage';
  if (['Pengelolaan Akses', 'Struktur Workspace', 'Log Aktivitas'].includes(label)) return 'accessManage';
  if (label === 'Approval') return 'spkApprove';
  if (label === 'Verifikasi SPK' || label === 'Dokumen') return 'spkVerify';
  if (label === 'Customer') return 'customerManage';
  if (label === 'Sales') return 'salesManage';
  if (['Leasing', 'Leasing & Promo'].includes(label)) return 'leasingManage';
  if (label === 'Kasir') return 'posAccess';
  if (label === 'Daftar Harga') return 'priceManage';
  if (label === 'Transaksi') return 'transactionsView';
  if (label === 'Nota Digital') return 'receiptsView';
  if (['Menu Digital', 'Pesanan'].includes(label)) return 'posAccess';
  if (label === 'Aktivasi') return 'activationManage';
  if (label === 'Semua Usaha') return 'platformBusinesses';
  if (label === 'Pusat Bantuan') return 'supportManage';
  if (['Tampilan Dashboard', 'Profil Usaha'].includes(label)) return 'themeManage';
  if (label === 'Absensi') return 'attendanceView';
  if (label === 'Cabang') return 'branchManage';
  return null;
}

function getUserMenus(user) {
  const permissions = (user?.permissions ?? []).filter((permission) => user?.role !== 'SUPER ADMIN'
    || !superAdminRestrictedPermissions.includes(permission));
  const baseMenus = (roleMenus[user?.role] ?? []).filter(([label]) => {
    const permission = menuPermission(label);
    return permission && permissions.includes(permission);
  });
  const representedPermissions = new Set((roleMenus[user?.role] ?? [])
    .map(([label]) => menuPermission(label)).filter(Boolean));
  const additionalMenus = extraPermissionMenus.filter(([, , permission]) => (
    permissions.includes(permission) && !representedPermissions.has(permission)
  ));
  return [...baseMenus, ...additionalMenus];
}

const businessMenuLabels = {
  laundry: { Kasir: 'Kasir Laundry', 'Daftar Harga': 'Layanan & Harga', Transaksi: 'Transaksi Laundry', 'Nota Digital': 'Nota Laundry', Customer: 'Pelanggan' },
  dealer_motor: {},
  retail: { Kasir: 'Kasir Toko', 'Daftar Harga': 'Produk & Harga', Transaksi: 'Transaksi Toko', 'Nota Digital': 'Nota Toko', 'Laporan Penjualan': 'Laporan Usaha', Customer: 'Pelanggan' },
  restaurant: { Kasir: 'Kasir Restoran', 'Daftar Harga': 'Menu & Harga', Transaksi: 'Transaksi Restoran', 'Nota Digital': 'Nota Restoran', Pesanan: 'Antrean Pesanan', 'Laporan Penjualan': 'Laporan Usaha', Customer: 'Pelanggan' },
  services: { Kasir: 'Kasir Layanan', 'Daftar Harga': 'Layanan & Tarif', Transaksi: 'Transaksi Layanan', 'Nota Digital': 'Nota Layanan', 'Laporan Penjualan': 'Laporan Usaha', Customer: 'Pelanggan' },
  workshop: { Kasir: 'Kasir Bengkel', 'Daftar Harga': 'Jasa & Sparepart', Transaksi: 'Transaksi Bengkel', 'Nota Digital': 'Nota Bengkel', Customer: 'Pelanggan' },
  salon: { Kasir: 'Kasir Salon', 'Daftar Harga': 'Layanan & Tarif', Transaksi: 'Transaksi Salon', 'Nota Digital': 'Nota Salon', Customer: 'Pelanggan' },
  printing: { Kasir: 'Kasir Percetakan', 'Daftar Harga': 'Produk & Harga Cetak', Transaksi: 'Transaksi Percetakan', 'Nota Digital': 'Nota Percetakan', Customer: 'Pelanggan' },
  distribution: { Kasir: 'Kasir Grosir', 'Daftar Harga': 'Produk & Harga Grosir', Transaksi: 'Transaksi Grosir', 'Nota Digital': 'Nota Grosir', 'Laporan Penjualan': 'Laporan Usaha', Customer: 'Pelanggan' },
};

const dealerOnlyMenus = new Set([
  'Input SPK', 'Semua SPK', 'SPK', 'SPK Saya', 'Pengajuan', 'Follow Up',
  'Verifikasi SPK', 'Approval', 'Sales', 'Motor', 'Leasing', 'Leasing & Promo',
  'Dokumen', 'Pengiriman', 'Performance', 'Semua Unit', 'Unit Dealer', 'Unit & Motor', 'Target',
]);

const initialUsers = [
  { id: 'user-1', name: 'Aditya Pratama', email: 'aditya@wam.co.id', role: 'SUPER ADMIN', active: true },
  { id: 'user-2', name: 'Rika Wijaya', email: 'rika@wam.co.id', role: 'OWNER', active: true },
  { id: 'user-3', name: 'Dedi Kurniawan', email: 'dedi@wam.co.id', role: 'SVP', active: true },
  { id: 'user-4', name: 'Siti Aminah', email: 'siti@wam.co.id', role: 'ADMIN', active: true },
  { id: 'user-5', name: 'Rizky Pratama', email: 'rizky@wam.co.id', role: 'SALES', active: true },
  { id: 'user-6', name: 'Budi Driver', email: 'driver@wam.co.id', role: 'DRIVER', active: true },
].map((user) => ({ ...user, permissions: [...rolePermissions[user.role]] }));
initialUsers.push({
  id: 'platform-owner-demo',
  name: 'Owner KelolaUsaha.store',
  email: 'owner@kelolausaha.store',
  role: 'PLATFORM_OWNER',
  active: true,
  permissions: [...rolePermissions.PLATFORM_OWNER],
});

const initialSpks = [
  { id: 'SPK-WAM-20261120-0003', customer: 'Nadia Putri', motor: 'Honda Beat Deluxe', sales: 'Rizky Pratama', amount: 19800000, status: 'APPROVAL SVP', date: '20 Nov 2026' },
  { id: 'SPK-WAM-20261120-0002', customer: 'Budi Santoso', motor: 'Honda Vario 160', sales: 'Dewi Anggraini', amount: 28750000, status: 'VERIFIKASI ADMIN', date: '20 Nov 2026' },
  { id: 'SPK-WAM-20261120-0001', customer: 'Siti Rahmawati', motor: 'Honda Scoopy', sales: 'Andi Saputra', amount: 22400000, status: 'SELESAI', date: '20 Nov 2026' },
  { id: 'SPK-WAM-20261119-0008', customer: 'Fajar Maulana', motor: 'Honda PCX 160', sales: 'Rizky Pratama', amount: 33750000, status: 'SUBMITTED', date: '19 Nov 2026' },
];

const previewDealerMotorUnits = [{
  id: 'preview-unit-vario-160',
  branchId: 'preview-branch-primary',
  branchName: 'Cabang Utama',
  brand: 'Honda',
  model: 'Vario 160',
  specification: 'CBS',
  modelYear: 2026,
  color: 'Hitam',
  frameNumber: 'MH1ABC12345678901',
  engineNumber: 'ABC1234567',
  otrPrice: 28750000,
  stockOrigin: 'opening',
  stockStatus: 'available',
  stockEntryDate: '2026-11-20',
}];

const statusClass = (status) => status.toLowerCase().replaceAll(' ', '-');
const formatLedgerEntryDate = (value) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
  .format(new Date(`${String(value).slice(0, 10)}T00:00:00`));

function isTenantWorkspaceHost(hostname = window.location.hostname) {
  const host = String(hostname).toLowerCase();
  return host.endsWith('.kelolausaha.store') && host !== 'www.kelolausaha.store';
}

function initialsFor(value) {
  return String(value || '')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

function terbilangRupiah(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) return '';
  const words = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const belowThousand = (number) => {
    if (number < 12) return words[number];
    if (number < 20) return `${belowThousand(number - 10)} belas`;
    if (number < 100) return `${belowThousand(Math.floor(number / 10))} puluh${number % 10 ? ` ${belowThousand(number % 10)}` : ''}`;
    if (number < 200) return `seratus${number > 100 ? ` ${belowThousand(number - 100)}` : ''}`;
    return `${belowThousand(Math.floor(number / 100))} ratus${number % 100 ? ` ${belowThousand(number % 100)}` : ''}`;
  };
  const spell = (number) => {
    if (number < 1000) return belowThousand(number);
    if (number < 2000) return `seribu${number > 1000 ? ` ${spell(number - 1000)}` : ''}`;
    for (const [size, label] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']]) {
      if (number >= size) {
        const quantity = Math.floor(number / size);
        const remainder = number % size;
        return `${spell(quantity)} ${label}${remainder ? ` ${spell(remainder)}` : ''}`;
      }
    }
    return belowThousand(number);
  };
  return `${spell(amount)} rupiah`;
}

function daysUntil(value) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

function getCountdown(value, now) {
  const remaining = Math.max(0, new Date(value).getTime() - now);
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

function padCountdown(value) {
  return `${value}`.padStart(2, '0');
}

function getNextSpkNumber(dateCode, items) {
  const prefix = `SPK-WAM-${dateCode}-`;
  const highestNumber = items.reduce((highest, item) => {
    const number = item.spkNumber || item.id;
    if (!number.startsWith(prefix)) return highest;
    return Math.max(highest, Number(number.slice(prefix.length)) || 0);
  }, 0);
  return `${highestNumber + 1}`.padStart(4, '0');
}

function getToday() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function RestaurantCustomerMenu({ workspaceKey, tableNumber }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [table, setTable] = useState(tableNumber || '');
  const [specialNotes, setSpecialNotes] = useState('');
  const [paymentTiming, setPaymentTiming] = useState('Nanti di kasir');
  const [message, setMessage] = useState('');

  const addItem = (item) => setCart((current) => {
    const existing = current.find((cartItem) => cartItem.id === item.id);
    return existing
      ? current.map((cartItem) => cartItem.id === item.id
        ? { ...cartItem, quantity: cartItem.quantity + 1 }
        : cartItem)
      : [...current, { ...item, quantity: 1 }];
  });
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const submitOrder = (event) => {
    event.preventDefault();
    if (!cart.length) {
      setMessage('Pilih minimal satu menu.');
      return;
    }
    try {
      const dateCode = getToday().replaceAll('-', '');
      const key = `ku:restaurant-orders:${workspaceKey || 'demo'}`;
      const savedOrders = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(savedOrders) || savedOrders.some((order) => typeof order.receiptNumber !== 'string')) {
        throw new Error('Data pesanan tersimpan tidak valid.');
      }
      const prefix = `RNS-${dateCode}-`;
      const nextNumber = savedOrders.reduce((highest, order) => (
        order.receiptNumber.startsWith(prefix)
          ? Math.max(highest, Number(order.receiptNumber.slice(prefix.length)) || 0)
          : highest
      ), 0) + 1;
      const order = {
        receiptNumber: `${prefix}${`${nextNumber}`.padStart(4, '0')}`,
        customer: customer.trim(),
        whatsapp: phone,
        tableNumber: table.trim(),
        specialNotes: specialNotes.trim(),
        items: cart,
        total,
        paymentTiming,
        paymentStatus: 'BELUM LUNAS',
        orderStatus: 'MENUNGGU APPROVAL KASIR',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify([order, ...savedOrders]));
      setCart([]);
      setMessage(`Pesanan ${order.receiptNumber} sudah dikirim ke kasir. Silakan tunggu konfirmasi.`);
    } catch (error) {
      setMessage(`Pesanan tidak dapat disimpan di browser ini: ${error.message}`);
    }
  };

  return (
    <main className="restaurant-public-menu">
      <header><img src="/kelolausaha-mark.svg" alt="" /><span><strong>Menu Digital</strong><small>KelolaUsaha.store</small></span></header>
      <section className="restaurant-public-content">
        <div className="restaurant-public-heading"><span>MENU RESTORAN / KAFE</span><h1>Pesan dari meja Anda</h1><p>Pilih menu, isi data pemesan, lalu kirim ke kasir.</p></div>
        {message && <div className="notice" role="status">{message}</div>}
        <div className="restaurant-public-layout">
          <section className="restaurant-public-products">
            {priceCatalogs.restaurant.map((item) => <article key={item.id}>
              <div><h2>{item.name}</h2><p>{rupiah(item.price)} / {item.unit}</p></div>
              <button aria-label={`Tambah ${item.name}`} onClick={() => addItem(item)} type="button">＋</button>
            </article>)}
          </section>
          <form className="restaurant-public-form" onSubmit={submitOrder}>
            <h2>Pesanan Anda</h2>
            {cart.map((item) => <div className="restaurant-public-cart-item" key={item.id}><span>{item.name} × {item.quantity}</span><strong>{rupiah(item.price * item.quantity)}</strong></div>)}
            <label className="field"><span>Nama pemesan</span><input autoComplete="name" onChange={(event) => setCustomer(event.target.value)} required value={customer} /></label>
            <label className="field"><span>Nomor HP / WhatsApp</span><input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} /></label>
            <label className="field"><span>Catatan khusus (opsional)</span><textarea maxLength="500" onChange={(event) => setSpecialNotes(event.target.value)} placeholder="Contoh: tanpa bawang, level pedas sedang" rows="3" value={specialNotes} /></label>
            {tableNumber
              ? <p className="restaurant-qr-table">Nomor meja otomatis: <strong>{tableNumber}</strong></p>
              : <label className="field"><span>Nomor meja</span><input onChange={(event) => setTable(event.target.value)} required value={table} /></label>}
            <label className="field"><span>Waktu pembayaran</span><select onChange={(event) => setPaymentTiming(event.target.value)} value={paymentTiming}><option>Bayar di awal</option><option>Nanti di kasir</option></select></label>
            <div className="restaurant-public-total"><span>Total</span><strong>{rupiah(total)}</strong></div>
            <button className="button button-primary" disabled={!cart.length} type="submit">Kirim pesanan ke kasir <span>→</span></button>
            <small>Demo: pesanan akan masuk ke perangkat yang membuka workspace ini di browser yang sama.</small>
          </form>
        </div>
      </section>
    </main>
  );
}

const priceCatalogs = {
  laundry: [
    { id: 'wash-regular', name: 'Cuci komplit reguler', unit: 'kg', price: 7000 },
    { id: 'wash-express', name: 'Cuci komplit express', unit: 'kg', price: 12000 },
    { id: 'dry-clean', name: 'Cuci kering', unit: 'kg', price: 5000 },
    { id: 'ironing', name: 'Setrika saja', unit: 'kg', price: 5000 },
    { id: 'bed-cover', name: 'Bed cover', unit: 'pcs', price: 25000 },
    { id: 'blanket', name: 'Selimut', unit: 'pcs', price: 15000 },
  ],
  dealer_motor: [
    { id: 'beat-deluxe', name: 'Honda Beat Deluxe', unit: 'unit', price: 19800000 },
    { id: 'vario-160', name: 'Honda Vario 160', unit: 'unit', price: 28750000 },
    { id: 'scoopy', name: 'Honda Scoopy', unit: 'unit', price: 22400000 },
  ],
  retail: [
    { id: 'retail-product', name: 'Produk retail', unit: 'pcs', price: 25000 },
    { id: 'retail-bundle', name: 'Paket produk', unit: 'paket', price: 50000 },
  ],
  restaurant: [
    { id: 'food-menu', name: 'Nasi goreng spesial', unit: 'porsi', price: 28000 },
    { id: 'drink-menu', name: 'Es teh manis', unit: 'gelas', price: 8000 },
    { id: 'snack-menu', name: 'Pisang goreng', unit: 'porsi', price: 15000 },
  ],
  services: [
    { id: 'service-basic', name: 'Jasa layanan', unit: 'layanan', price: 50000 },
  ],
  workshop: [
    { id: 'service-tuneup', name: 'Jasa servis ringan', unit: 'jasa', price: 75000 },
    { id: 'oil', name: 'Oli mesin', unit: 'pcs', price: 65000 },
  ],
  salon: [
    { id: 'haircut', name: 'Potong rambut', unit: 'layanan', price: 50000 },
    { id: 'haircare', name: 'Perawatan rambut', unit: 'layanan', price: 100000 },
  ],
  printing: [
    { id: 'print-a4', name: 'Cetak A4', unit: 'lembar', price: 1000 },
    { id: 'print-color', name: 'Cetak warna A4', unit: 'lembar', price: 2500 },
  ],
  distribution: [
    { id: 'wholesale-item', name: 'Produk grosir', unit: 'dus', price: 150000 },
    { id: 'wholesale-unit', name: 'Produk satuan', unit: 'pcs', price: 15000 },
  ],
};

function normalizeWhatsAppNumber(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

async function getApiError(response, fallback) {
  try {
    const body = await response.json();
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

function AuthScreen({ mode, onModeChange, onBack, onAuthenticated }) {
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [otpPayload, setOtpPayload] = useState(null);
  const isRegister = mode === 'register';
  const inviteToken = new URLSearchParams(window.location.search).get('invite') ?? '';
  const isEmployeeInvite = isRegister && Boolean(inviteToken);
  const isTenantWorkspace = isTenantWorkspaceHost();
  const [tenantBrand, setTenantBrand] = useState(null);
  const [tenantBrandError, setTenantBrandError] = useState('');
  const tenantSlugLabel = window.location.hostname.split('.')[0]
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const tenantBrandName = tenantBrand?.name || tenantSlugLabel || 'Workspace usaha';
  const brandName = isTenantWorkspace ? tenantBrandName : 'KELOLAUSAHA.STORE';
  const brandMark = isTenantWorkspace
    ? tenantBrand?.logoUrl
      ? <img className="auth-brand-mark" alt="" src={tenantBrand.logoUrl} />
      : <span className="auth-brand-mark auth-tenant-brand-mark">{initialsFor(tenantBrandName)}</span>
    : <img className="auth-brand-mark" alt="" src="/kelolausaha-mark.svg" />;
  const isTenantRegistration = isTenantWorkspace && isRegister;

  useEffect(() => {
    if (!isTenantWorkspace) return undefined;
    let cancelled = false;
    const loadTenantBrand = async () => {
      try {
        const response = await fetch('/api/public/workspace');
        if (!response.ok) throw new Error(await getApiError(response, 'Identitas workspace tidak dapat dimuat.'));
        const result = await response.json();
        if (!result.workspace?.name) throw new Error('Nama workspace dari server tidak valid.');
        if (!cancelled) setTenantBrand(result.workspace);
      } catch (error) {
        if (!cancelled) setTenantBrandError(error.message);
      }
    };
    loadTenantBrand();
    return () => {
      cancelled = true;
    };
  }, [isTenantWorkspace]);

  const sendOtp = async (event) => {
    event.preventDefault();
    setMessage('');
    setMessageIsError(false);
    setSubmitting(true);
    const formData = otpRequested ? null : new FormData(event.currentTarget.form ?? event.currentTarget);
    const emailAddress = formData?.get('email') || email;
    const payload = otpRequested ? otpPayload : {
      email: emailAddress,
      ...(isRegister ? {
        name: formData.get('name'),
        phone: formData.get('phone'),
        ...(!isEmployeeInvite ? { registerAccount: true } : {}),
      } : {}),
      ...(isEmployeeInvite ? { inviteToken } : {}),
    };
    setEmail(emailAddress);
    setOtpPayload(payload);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMessage(await getApiError(response, 'Kode OTP tidak dapat dikirim. Silakan coba lagi.'));
        setMessageIsError(true);
        return;
      }
      setOtpRequested(true);
      setMessage('Kode OTP telah dikirim ke alamat email Anda.');
    } catch {
      setMessage('Layanan OTP tidak tersedia. Pastikan server aplikasi sudah terhubung.');
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setMessageIsError(false);
    setSubmitting(true);
    const otp = new FormData(event.currentTarget).get('otp');
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, inviteToken: inviteToken || undefined }),
      });
      if (!response.ok) {
        setMessage(await getApiError(response, 'Kode OTP salah atau sudah kedaluwarsa.'));
        setMessageIsError(true);
        return;
      }
      const result = await response.json();
      if (result.pendingApproval) {
        setMessage(result.message || 'Pendaftaran menunggu persetujuan Owner atau Super Admin.');
        setMessageIsError(false);
        setOtpRequested(false);
        setOtpPayload(null);
        return;
      }
      if (!result.user?.id || !result.user?.role) {
        setMessage('Respons autentikasi server tidak lengkap. Silakan hubungi administrator.');
        setMessageIsError(true);
        return;
      }
      onAuthenticated(result, otpPayload);
    } catch {
      setMessage('Layanan verifikasi tidak tersedia. Silakan coba lagi.');
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      {!isTenantWorkspace && <a className="auth-back-link" href="#dashboard" onClick={(event) => {
        event.preventDefault();
        onBack();
      }}>← Kembali</a>}
      <section className="auth-layout">
        <div className="auth-showcase">
          <div className="auth-brand">{brandMark}<span>{brandName}</span></div>
          <div className="auth-showcase-content">
            <span className="auth-kicker"><span /> {isTenantWorkspace ? 'WORKSPACE USAHA' : 'WORKSPACE UNTUK USAHA'}</span>
            <h1>Semua urusan usaha,<br /><em>lebih mudah.</em></h1>
            <p>{isTenantWorkspace ? `Masuk ke ruang kerja ${tenantBrandName} untuk mengelola operasional dan tim usaha.` : 'Atur operasional usaha dan tim Anda dalam satu ruang kerja yang bisa disesuaikan dengan jenis bisnis.'}</p>
            <div className="auth-showcase-art" aria-hidden="true">
              <div className="art-ring art-ring-one" />
              <div className="art-ring art-ring-two" />
              <div className="art-sparkle sparkle-one">✳</div>
              <div className="art-sparkle sparkle-two">✦</div>
              <div className="art-card art-card-back"><span>PROGRESS PENJUALAN</span><strong>68%</strong><i><b /></i></div>
              <div className="art-card art-card-front"><span className="art-check">✓</span><span><strong>Workspace siap</strong><small>Operasional usaha lebih praktis</small></span></div>
              <div className="art-moto"><span>KU</span></div>
            </div>
          </div>
          <div className="auth-showcase-footer"><span>{isTenantWorkspace ? `Ruang kerja ${tenantBrandName}` : 'Satu ruang kerja untuk usaha Anda'}</span><span>{brandName}</span></div>
        </div>

        <div className="auth-form-side">
          <div className="auth-mobile-brand">{brandMark}<strong>{brandName}</strong></div>
          <div className="auth-form-wrap" key={`${mode}-${otpRequested}-${isEmployeeInvite}`}>
            <div className="auth-welcome-icon">{otpRequested ? '✉' : isRegister ? '✳' : '↗'}</div>
            <span className="auth-overline">{otpRequested ? 'VERIFIKASI EMAIL' : isRegister ? 'MULAI KELOLA USAHA' : 'SELAMAT DATANG KEMBALI'}</span>
            <h2>{otpRequested
              ? 'Cek email Anda'
              : isTenantRegistration || isEmployeeInvite
                ? 'Daftar sebagai karyawan'
                : isRegister
                  ? 'Buat workspace usaha'
                  : isTenantWorkspace
                    ? `Masuk ke ${tenantBrandName}`
                    : 'Masuk ke akun'}</h2>
            <p className="auth-description">{otpRequested
              ? <>Masukkan kode OTP 6 digit yang dikirim ke <strong>{email}</strong>.</>
              : isEmployeeInvite || isTenantRegistration
                ? `Lengkapi data diri untuk bergabung ke workspace ${tenantBrandName}. Pendaftaran menunggu persetujuan Owner atau Super Admin.`
                : isRegister
                  ? 'Verifikasi email terlebih dahulu. Setelah itu, Anda dapat mengisi data usaha dan menyiapkan workspace.'
                  : isTenantWorkspace
                    ? `Masuk ke akun workspace ${tenantBrandName}. Kami akan mengirim kode OTP untuk verifikasi.`
                    : 'Masuk dengan email. Kami akan mengirim kode OTP untuk verifikasi.'}</p>
            {tenantBrandError && <div className="auth-message" role="status">{tenantBrandError}</div>}

            {!otpRequested && <div className="auth-tabs" aria-label="Masuk atau daftar">
              <a aria-current={!isRegister ? 'page' : undefined} className={!isRegister ? 'selected' : ''} href="#masuk" onClick={(event) => {
                event.preventDefault();
                onModeChange('login');
              }}>Masuk</a>
              <a aria-current={isRegister ? 'page' : undefined} className={isRegister ? 'selected' : ''} href="#daftar" onClick={(event) => {
                event.preventDefault();
                onModeChange('register');
              }}>Daftar</a>
              <span className={`auth-tab-indicator ${isRegister ? 'to-register' : ''}`} />
            </div>}

            {otpRequested ? (
              <form className="auth-form" onSubmit={handleOtpSubmit}>
                <label className="auth-field"><span>Kode OTP</span><input autoComplete="one-time-code" inputMode="numeric" maxLength="6" name="otp" pattern="[0-9]{6}" placeholder="Masukkan 6 digit kode" required /></label>
                {message && <div className={`auth-message ${messageIsError ? 'error' : ''}`} role={messageIsError ? 'alert' : 'status'}>{message}</div>}
                <button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Memverifikasi…' : 'Verifikasi email'} <span>→</span></button>
                <button className="otp-resend" disabled={submitting} onClick={sendOtp} type="button">Kirim ulang kode</button>
                <button className="otp-change-email" onClick={() => {
                  setOtpRequested(false);
                  setMessage('');
                }} type="button">← Ganti alamat email</button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={sendOtp}>
                {isRegister && <>
                  <label className="auth-field"><span>Nama lengkap</span><input autoComplete="name" name="name" placeholder="Contoh: Aditya Pratama" required /></label>
                  <label className="auth-field"><span>Nomor HP</span><input autoComplete="tel" name="phone" placeholder="08xxxxxxxxxx" required type="tel" /></label>
                </>}
                <label className="auth-field"><span>Email</span><input autoComplete="email" name="email" placeholder="nama@email.com" required type="email" /></label>
                {message && <div className={`auth-message ${messageIsError ? 'error' : ''}`} role={messageIsError ? 'alert' : 'status'}>{message}</div>}
                <button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Mengirim…' : 'Kirim kode OTP'} <span>→</span></button>
              </form>
            )}

            <div className="auth-terms">Kode OTP hanya dikirim melalui server email yang terhubung. Jangan bagikan kode ini kepada siapa pun.</div>
            <div className="auth-secure-note"><span>✓</span> Akses aman untuk {isTenantWorkspace ? tenantBrandName : 'workspace usaha Anda'}</div>
            {isRegister && !inviteToken && isTenantWorkspace
              && <p className="auth-description">Pendaftaran melalui workspace ini akan menunggu persetujuan Owner atau Super Admin.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

function BusinessSetupScreen({ onComplete }) {
  const [businessType, setBusinessType] = useState('dealer_motor');
  const [selectedModules, setSelectedModules] = useState(
    businessTypes.dealer_motor.modules.map(([id]) => id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [setupResult, setSetupResult] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const updateBusinessType = (event) => {
    const nextType = event.target.value;
    setBusinessType(nextType);
    setSelectedModules(businessTypes[nextType].modules.map(([id]) => id));
  };

  const toggleModule = (moduleId) => {
    setSelectedModules((current) => current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId]);
  };

  const submitSetup = async (event) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/setup-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.get('businessName'),
          businessAddress: formData.get('businessAddress'),
          businessType,
          modules: selectedModules,
        }),
      });
      if (!response.ok) {
        setMessage(await getApiError(response, 'Data usaha belum dapat disimpan.'));
        return;
      }
      const result = await response.json();
      if (!result.user?.id || !result.business?.id || !result.business?.workspaceUrl) {
        setMessage('Respons setup usaha dari server tidak lengkap. Silakan hubungi administrator.');
        return;
      }
      setSetupResult(result);
    } catch {
      setMessage('Setup usaha tidak dapat dihubungkan ke server. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-layout">
        <div className="auth-showcase">
          <div className="auth-brand"><img className="auth-brand-mark" src="/kelolausaha-mark.svg" alt="" /><span>KELOLAUSAHA.STORE</span></div>
          <div className="auth-showcase-content">
            <span className="auth-kicker"><span /> EMAIL TERVERIFIKASI</span>
            <h1>Siapkan usaha,<br /><em>mulai bertumbuh.</em></h1>
            <p>Tentukan jenis usaha dan modul awal. Anda dapat menyesuaikan workspace kembali nanti.</p>
          </div>
          <div className="auth-showcase-footer"><span>Satu ruang kerja untuk usaha Anda</span><span>KELOLAUSAHA.STORE</span></div>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <div className="auth-welcome-icon">✳</div>
            {setupResult ? (
              <>
                <span className="auth-overline">WORKSPACE SIAP</span>
                <h2>{setupResult.business.name}</h2>
                <p className="auth-description">Alamat workspace dan tautan pendaftaran karyawan sudah dibuat otomatis.</p>
                <label className="auth-field"><span>Link workspace usaha</span><input aria-label="Link workspace usaha" readOnly value={setupResult.business.workspaceUrl} onFocus={(event) => event.target.select()} /></label>
                <p className="auth-description">Bagikan link ini kepada karyawan. Pendaftaran mereka akan menunggu persetujuan Owner atau Super Admin.</p>
                {message && <div className="auth-message error" role="alert">{message}</div>}
                <button className="auth-submit" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(setupResult.business.workspaceUrl);
                    setLinkCopied(true);
                    setMessage('');
                  } catch {
                    setMessage('Link tidak dapat disalin otomatis. Pilih dan salin link di atas.');
                  }
                }} type="button">{linkCopied ? 'Link berhasil disalin' : 'Salin link workspace'}</button>
                <button className="auth-submit" onClick={() => onComplete(setupResult, { businessType, modules: selectedModules })} type="button">Buka workspace <span>→</span></button>
              </>
            ) : (
              <>
                <span className="auth-overline">LANGKAH TERAKHIR</span>
                <h2>Siapkan usaha Anda</h2>
                <p className="auth-description">Email berhasil diverifikasi. Lengkapi data usaha untuk membuat workspace demo satu bulan.</p>
                <form className="auth-form" onSubmit={submitSetup}>
                  <label className="auth-field"><span>Nama usaha</span><input autoComplete="organization" name="businessName" placeholder="Contoh: Dealer Motor Sejahtera" required /></label>
                  <label className="auth-field"><span>Alamat usaha</span><input autoComplete="street-address" name="businessAddress" placeholder="Jalan, kota, dan provinsi" required /></label>
                  <label className="auth-field"><span>Jenis usaha</span><select className="auth-select" name="businessType" onChange={updateBusinessType} value={businessType}>{Object.entries(businessTypes).map(([id, business]) => <option key={id} value={id}>{business.label}</option>)}</select></label>
                  <fieldset className="structure-picker">
                    <legend>Struktur workspace <small>Pilih modul yang dibutuhkan</small></legend>
                    <div className="structure-list">{businessTypes[businessType].modules.map(([id, label]) => <label className="structure-option" key={id}><input checked={selectedModules.includes(id)} onChange={() => toggleModule(id)} type="checkbox" /><span>{label}</span></label>)}</div>
                  </fieldset>
                  {message && <div className="auth-message error" role="alert">{message}</div>}
                  <button className="auth-submit" disabled={submitting} type="submit">{submitting ? 'Membuat workspace…' : 'Buat workspace usaha'} <span>→</span></button>
                </form>
                <div className="auth-secure-note"><span>✓</span> Demo satu bulan · Tanpa biaya di awal</div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [activeUserId, setActiveUserId] = useState('platform-owner-demo');
  const [activePage, setActivePage] = useState(() => pageFromHash() || 'Semua Usaha');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsBusinessSetup, setNeedsBusinessSetup] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [billingData, setBillingData] = useState(null);
  const [platformData, setPlatformData] = useState(null);
  const [platformBranchLimits, setPlatformBranchLimits] = useState({});
  const [platformBranchLimitSaving, setPlatformBranchLimitSaving] = useState('');
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportSubject, setSupportSubject] = useState('Bagaimana cara mendaftarkan usaha?');
  const [supportDraft, setSupportDraft] = useState('');
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportActiveTicket, setSupportActiveTicket] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportStartNew, setSupportStartNew] = useState(false);
  const [supportOwnerTickets, setSupportOwnerTickets] = useState([]);
  const [supportOwnerTicket, setSupportOwnerTicket] = useState(null);
  const [supportOwnerMessages, setSupportOwnerMessages] = useState([]);
  const [supportOwnerReply, setSupportOwnerReply] = useState('');
  const [supportOwnerStatus, setSupportOwnerStatus] = useState('waiting_user');
  const [supportContactEmail, setSupportContactEmail] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [supportNotice, setSupportNotice] = useState('');
  const [billingError, setBillingError] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('year_1');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [themeSettings, setThemeSettings] = useState(defaultThemeSettings);
  const [themeNotice, setThemeNotice] = useState('');
  const [themeError, setThemeError] = useState('');
  const [themeSaving, setThemeSaving] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountProfileOpen, setAccountProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [businessProfile, setBusinessProfile] = useState({ name: '', address: '', phone: '', logoUrl: '' });
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false);
  const [businessProfileSaving, setBusinessProfileSaving] = useState(false);
  const [businessProfileUploading, setBusinessProfileUploading] = useState(false);
  const [businessProfileError, setBusinessProfileError] = useState('');
  const [businessProfileNotice, setBusinessProfileNotice] = useState('');
  const [businessType, setBusinessType] = useState('dealer_motor');
  const [workspaceModules, setWorkspaceModules] = useState(
    businessTypes.dealer_motor.modules.map(([id]) => id),
  );
  const [workspaceModuleDraft, setWorkspaceModuleDraft] = useState(
    businessTypes.dealer_motor.modules.map(([id]) => id),
  );
  const [workspaceModulesSaving, setWorkspaceModulesSaving] = useState(false);
  const [authView, setAuthView] = useState(() => (
    new URLSearchParams(window.location.search).has('invite')
      ? 'register'
      : isTenantWorkspaceHost() ? 'login' : null
  ));
  const [spks, setSpks] = useState(initialSpks);
  const [users, setUsers] = useState(initialUsers);
  const [workspaceName, setWorkspaceName] = useState('KelolaUsaha.store');
  const [workspaceUrl, setWorkspaceUrl] = useState('');
  const [accessDraft, setAccessDraft] = useState(null);
  const [inviteRole, setInviteRole] = useState('SUPER ADMIN');
  const [inviteBranchId, setInviteBranchId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviting, setInviting] = useState(false);
  const [memberDecisionBusy, setMemberDecisionBusy] = useState('');
  const [paymentType, setPaymentType] = useState('CREDIT');
  const [priceItems, setPriceItems] = useState(priceCatalogs.dealer_motor);
  const [priceDraft, setPriceDraft] = useState({ name: '', unit: '', price: '' });
  const [cart, setCart] = useState([]);
  const [posCustomer, setPosCustomer] = useState('');
  const [posWhatsApp, setPosWhatsApp] = useState('');
  const [posTableNumber, setPosTableNumber] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState('Tunai');
  const [posAmountPaid, setPosAmountPaid] = useState('');
  const [posTransactions, setPosTransactions] = useState([]);
  const [printingReceipt, setPrintingReceipt] = useState('');
  const [motorReceipts, setMotorReceipts] = useState([]);
  const [printingMotorReceipt, setPrintingMotorReceipt] = useState('');
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [restaurantOrderWorkspaceKey, setRestaurantOrderWorkspaceKey] = useState('KelolaUsaha.store');
  const [restaurantQrCodes, setRestaurantQrCodes] = useState([]);
  const [restaurantQrMode, setRestaurantQrMode] = useState('general');
  const [restaurantQrTableCount, setRestaurantQrTableCount] = useState('10');
  const [restaurantQrBusy, setRestaurantQrBusy] = useState(false);
  const [orderPaymentTiming, setOrderPaymentTiming] = useState('Nanti di kasir');
  const [orderSpecialNotes, setOrderSpecialNotes] = useState('');
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [financeEntries, setFinanceEntries] = useState([]);
  const [workspaceBranches, setWorkspaceBranches] = useState([]);
  const [dealerMotorUnits, setDealerMotorUnits] = useState(previewDealerMotorUnits);
  const [dealerMotorMovements, setDealerMotorMovements] = useState([]);
  const [financeBranchId, setFinanceBranchId] = useState('');
  const [financeDraft, setFinanceDraft] = useState({
    type: 'income',
    category: '',
    description: '',
    amount: '',
    entryDate: getToday(),
  });
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    date: getToday(),
    unit: '',
    sales: '',
    nik: '',
    customer: '',
    whatsapp: '',
    address: '',
    motor: '',
    type: '',
    color: '',
    frameNumber: '',
    engineNumber: '',
    year: '',
    unitId: '',
    stnkName: '',
    receiptAmount: '',
    receiptCity: '',
    receiptNote: '',
    otr: '',
    leasing: '',
    dp: '',
    tenor: '',
    installment: '',
    promo: '',
    discount: '',
  });

  const counts = useMemo(() => ({
    total: spks.length,
    submitted: spks.filter((item) => item.status === 'SUBMITTED').length,
    approval: spks.filter((item) => item.status === 'APPROVAL SVP').length,
    complete: spks.filter((item) => item.status === 'SELESAI').length,
  }), [spks]);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const amountPaid = Number(posAmountPaid) || 0;
  const changeDue = Math.max(0, amountPaid - cartTotal);
  const unreadBillingNotifications = billingData?.notifications?.filter((item) => !item.read_at) ?? [];
  const financeSummary = financeEntries.reduce((summary, entry) => {
    summary[entry.type] += Number(entry.amount);
    return summary;
  }, { income: 0, expense: 0 });
  financeSummary.profit = financeSummary.income - financeSummary.expense;

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openPage = (page) => {
    setActivePage(page);
    setNotice('');
    setSupportError('');
    const nextHash = `#/${encodeURIComponent(page)}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  };

  useEffect(() => {
    const syncPageFromUrl = () => {
      const page = pageFromHash();
      if (page) {
        setActivePage(page);
        setNotice('');
      }
    };
    window.addEventListener('popstate', syncPageFromUrl);
    window.addEventListener('hashchange', syncPageFromUrl);
    return () => {
      window.removeEventListener('popstate', syncPageFromUrl);
      window.removeEventListener('hashchange', syncPageFromUrl);
    };
  }, []);

  const createSupportTicket = async (event) => {
    event.preventDefault();
    setSupportBusy(true);
    setSupportError('');
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: supportName, email: supportEmail, subject: supportSubject, message: supportDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Pesan bantuan tidak dapat dikirim.');
      setSupportName(supportName);
      setSupportDraft('');
      setSupportStartNew(false);
      await loadSupportTickets(supportEmail);
      setSupportActiveTicket(result.ticket);
      await loadSupportConversation(result.ticket.id, supportEmail);
      setSupportNotice('Pesan berhasil dikirim ke tim KelolaUsaha.store.');
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportBusy(false);
    }
  };

  const loadSupportTickets = async (email) => {
    if (!email) return;
    const response = await fetch(`/api/support/tickets?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Percakapan bantuan tidak dapat dimuat.');
    setSupportTickets(result.tickets);
  };

  const loadSupportConversation = async (ticketId, email) => {
    const response = await fetch(`/api/support/tickets/${ticketId}?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Percakapan tidak dapat dimuat.');
    setSupportActiveTicket(result.ticket);
    setSupportMessages(result.messages);
  };

  const sendSupportMessage = async (event) => {
    event.preventDefault();
    if (!supportActiveTicket?.id) return;
    setSupportBusy(true);
    setSupportError('');
    try {
      const response = await fetch(`/api/support/tickets/${supportActiveTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supportEmail, message: supportDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Pesan tidak dapat dikirim.');
      setSupportDraft('');
      await loadSupportConversation(supportActiveTicket.id, supportEmail);
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportBusy(false);
    }
  };

  const loadOwnerSupportTickets = async () => {
    const response = await fetch('/api/platform/support/tickets');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Daftar bantuan tidak dapat dimuat.');
    setSupportOwnerTickets(result.tickets);
  };

  const openOwnerSupportTicket = async (ticketId) => {
    const response = await fetch(`/api/platform/support/tickets/${ticketId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Percakapan tidak dapat dimuat.');
    setSupportOwnerTicket(result.ticket);
    setSupportOwnerMessages(result.messages);
    setSupportOwnerStatus(result.ticket.status === 'new' ? 'processing' : result.ticket.status);
  };

  const replyOwnerSupportTicket = async (event) => {
    event.preventDefault();
    if (!supportOwnerTicket?.id) return;
    setSupportBusy(true);
    setSupportError('');
    try {
      const response = await fetch(`/api/platform/support/tickets/${supportOwnerTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: supportOwnerReply, status: supportOwnerStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Balasan tidak dapat dikirim.');
      setSupportOwnerReply('');
      await openOwnerSupportTicket(supportOwnerTicket.id);
      await loadOwnerSupportTickets();
      setSupportNotice('Balasan berhasil dikirim dan disimpan ke percakapan.');
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportBusy(false);
    }
  };

  const persistRestaurantOrders = (nextOrders) => {
    try {
      localStorage.setItem(`ku:restaurant-orders:${restaurantOrderWorkspaceKey}`, JSON.stringify(nextOrders));
      setRestaurantOrders(nextOrders);
      return true;
    } catch (error) {
      setNotice(`Pesanan tidak dapat disimpan di browser ini: ${error.message}`);
      return false;
    }
  };

  useEffect(() => {
    const key = `ku:restaurant-orders:${restaurantOrderWorkspaceKey}`;
    const syncOrders = (event) => {
      if (event.key !== key) return;
      try {
        const nextOrders = JSON.parse(event.newValue || '[]');
        if (!Array.isArray(nextOrders)) throw new Error('Format data pesanan tidak valid.');
        setRestaurantOrders(nextOrders);
      } catch (error) {
        setNotice(`Pesanan tidak dapat dibaca: ${error.message}`);
      }
    };
    window.addEventListener('storage', syncOrders);
    return () => window.removeEventListener('storage', syncOrders);
  }, [restaurantOrderWorkspaceKey]);

  useEffect(() => {
    const clearPrintingReceipt = () => {
      setPrintingReceipt('');
      setPrintingMotorReceipt('');
    };
    window.addEventListener('afterprint', clearPrintingReceipt);
    return () => window.removeEventListener('afterprint', clearPrintingReceipt);
  }, []);

  const generateRestaurantQrCodes = async (event) => {
    event.preventDefault();
    const tableCount = Number(restaurantQrTableCount);
    if (restaurantQrMode === 'tables' && (!Number.isInteger(tableCount) || tableCount < 1 || tableCount > 100)) {
      setNotice('Jumlah QR meja harus antara 1 dan 100.');
      return;
    }
    setRestaurantQrBusy(true);
    setNotice('');
    try {
      const baseUrl = new URL(window.location.href);
      baseUrl.pathname = '/';
      baseUrl.search = '';
      baseUrl.hash = '';
      baseUrl.searchParams.set('menu', 'restaurant');
      baseUrl.searchParams.set('workspace', restaurantOrderWorkspaceKey);
      const tableNumbers = restaurantQrMode === 'tables'
        ? Array.from({ length: tableCount }, (_, index) => `${index + 1}`.padStart(2, '0'))
        : [null];
      const codes = await Promise.all(tableNumbers.map(async (tableNumber) => {
        const url = new URL(baseUrl);
        if (tableNumber) url.searchParams.set('table', tableNumber);
        const svg = await QRCode.toString(url.toString(), {
          type: 'svg',
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#263244', light: '#ffffff' },
        });
        return {
          tableNumber,
          url: url.toString(),
          dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        };
      }));
      setRestaurantQrCodes(codes);
      setNotice(`${codes.length} QR menu berhasil dibuat dan siap diunduh.`);
    } catch (error) {
      setNotice(`QR menu tidak dapat dibuat: ${error.message}`);
    } finally {
      setRestaurantQrBusy(false);
    }
  };

  const addToCart = (priceItem) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === priceItem.id);
      return existing
        ? current.map((item) => item.id === priceItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item)
        : [...current, { ...priceItem, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId, quantity) => {
    setCart((current) => quantity <= 0
      ? current.filter((item) => item.id !== itemId)
      : current.map((item) => item.id === itemId ? { ...item, quantity } : item));
  };

  const addPriceItem = (event) => {
    event.preventDefault();
    const newItem = {
      id: `price-${Date.now()}`,
      name: priceDraft.name.trim(),
      unit: priceDraft.unit.trim(),
      price: Number(priceDraft.price),
    };
    if (!newItem.name || !newItem.unit || newItem.price <= 0) {
      setNotice('Lengkapi nama, satuan, dan harga lebih dari nol.');
      return;
    }
    setPriceItems((current) => [...current, newItem]);
    setPriceDraft({ name: '', unit: '', price: '' });
    setNotice(`${newItem.name} berhasil ditambahkan ke daftar harga.`);
  };

  const savePosTransaction = (event) => {
    event.preventDefault();
    if (cart.length === 0) {
      setNotice('Tambahkan minimal satu produk atau jasa ke transaksi.');
      return;
    }
    const dateCode = getToday().replaceAll('-', '');
    const prefix = `POS-${dateCode}-`;
    const nextNumber = posTransactions.reduce((highest, transaction) => {
      if (!transaction.receiptNumber.startsWith(prefix)) return highest;
      return Math.max(highest, Number(transaction.receiptNumber.slice(prefix.length)) || 0);
    }, 0) + 1;
    const transaction = {
      receiptNumber: `${prefix}${`${nextNumber}`.padStart(4, '0')}`,
      customer: posCustomer.trim() || 'Pelanggan umum',
      whatsapp: posWhatsApp,
      items: cart,
      total: cartTotal,
      amountPaid,
      paymentMethod: posPaymentMethod,
      paymentStatus: amountPaid >= cartTotal ? 'LUNAS' : 'BELUM LUNAS',
      createdAt: new Date().toISOString(),
    };
    setPosTransactions((current) => [transaction, ...current]);
    setCart([]);
    setPosCustomer('');
    setPosWhatsApp('');
    setPosAmountPaid('');
    setNotice(`${transaction.receiptNumber} berhasil disimpan.`);
    setActivePage('Nota Digital');
  };

  const submitRestaurantOrder = (event) => {
    event.preventDefault();
    if (!cart.length) {
      setNotice('Pilih minimal satu menu sebelum mengirim pesanan.');
      return;
    }
    const dateCode = getToday().replaceAll('-', '');
    const prefix = `RNS-${dateCode}-`;
    const nextNumber = restaurantOrders.reduce((highest, order) => {
      if (!order.receiptNumber.startsWith(prefix)) return highest;
      return Math.max(highest, Number(order.receiptNumber.slice(prefix.length)) || 0);
    }, 0) + 1;
    const order = {
      receiptNumber: `${prefix}${`${nextNumber}`.padStart(4, '0')}`,
      customer: posCustomer.trim(),
      whatsapp: posWhatsApp,
      tableNumber: posTableNumber.trim(),
      specialNotes: orderSpecialNotes.trim(),
      items: cart.map((item) => ({ ...item })),
      total: cartTotal,
      paymentTiming: orderPaymentTiming,
      paymentStatus: 'BELUM LUNAS',
      orderStatus: 'MENUNGGU APPROVAL KASIR',
      createdAt: new Date().toISOString(),
    };
    if (!persistRestaurantOrders([order, ...restaurantOrders])) return;
    setCart([]);
    setPosCustomer('');
    setPosWhatsApp('');
    setPosTableNumber('');
    setOrderPaymentTiming('Nanti di kasir');
    setOrderSpecialNotes('');
    setNotice(`${order.receiptNumber} dikirim ke kasir. Silakan tunggu konfirmasi pesanan.`);
    setActivePage('Pesanan');
  };

  const approveRestaurantOrder = (order) => {
    const updatedOrders = restaurantOrders.map((item) => item.receiptNumber === order.receiptNumber
      ? { ...item, orderStatus: 'DIPROSES DAPUR' }
      : item);
    if (!persistRestaurantOrders(updatedOrders)) return;
    setPosTransactions((current) => current.some((item) => item.receiptNumber === order.receiptNumber)
      ? current
      : [{
        ...order,
        paymentMethod: 'Tunai / kasir',
        amountPaid: 0,
      }, ...current]);
    setNotice(`${order.receiptNumber} disetujui dan diteruskan ke dapur.`);
  };

  const updateRestaurantOrderStatus = (receiptNumber, orderStatus) => {
    const updatedOrders = restaurantOrders.map((order) => order.receiptNumber === receiptNumber
      ? { ...order, orderStatus }
      : order);
    if (!persistRestaurantOrders(updatedOrders)) return;
    setNotice(`${receiptNumber}: status diperbarui menjadi ${orderStatus.toLowerCase()}.`);
  };

  const markRestaurantOrderPaid = (receiptNumber) => {
    const updatedOrders = restaurantOrders.map((order) => order.receiptNumber === receiptNumber
      ? { ...order, paymentStatus: 'LUNAS' }
      : order);
    if (!persistRestaurantOrders(updatedOrders)) return;
    setPosTransactions((current) => current.map((transaction) => transaction.receiptNumber === receiptNumber
      ? { ...transaction, amountPaid: transaction.total, paymentStatus: 'LUNAS' }
      : transaction));
    setNotice(`${receiptNumber} telah dikonfirmasi lunas.`);
  };

  const saveFinanceEntry = async (event) => {
    event.preventDefault();
    const entry = {
      ...financeDraft,
      category: financeDraft.category.trim(),
      description: financeDraft.description.trim(),
      amount: Number(financeDraft.amount),
      branchId: financeBranchId || undefined,
    };
    if (!entry.category || !entry.description || !Number.isSafeInteger(entry.amount) || entry.amount <= 0) {
      setNotice('Lengkapi kategori, keterangan, dan nominal yang valid.');
      return;
    }
    if (isAuthenticated) {
      try {
        const response = await fetch('/api/finance/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (!response.ok) throw new Error(await getApiError(response, 'Catatan pembukuan tidak dapat disimpan.'));
        const result = await response.json();
        if (!result.entry || typeof result.entry !== 'object') {
          throw new Error('Server tidak mengembalikan catatan pembukuan yang valid.');
        }
        const branchName = workspaceBranches.find((branch) => branch.id === result.entry.branchId)?.name;
        setFinanceEntries((current) => [{
          ...result.entry,
          branchName: result.entry.branchName || branchName,
        }, ...current]);
      } catch (error) {
        setNotice(error.message);
        return;
      }
    } else {
      setFinanceEntries((current) => [
        { ...entry, id: `demo-finance-${Date.now()}`, createdAt: new Date().toISOString() },
        ...current,
      ]);
    }
    setFinanceDraft({ type: 'income', category: '', description: '', amount: '', entryDate: getToday() });
    setNotice('Catatan pembukuan berhasil disimpan.');
  };

  const savePlatformBranchLimit = async (business) => {
    const branchLimit = Number(platformBranchLimits[business.id] ?? business.branch_limit);
    if (!Number.isInteger(branchLimit) || branchLimit < 3 || branchLimit > 10000) {
      setBillingError('Batas cabang harus berupa angka antara 3 dan 10.000.');
      return;
    }
    setPlatformBranchLimitSaving(business.id);
    setBillingError('');
    try {
      const response = await fetch(`/api/platform/businesses/${business.id}/branch-limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchLimit }),
      });
      if (!response.ok) throw new Error(await getApiError(response, 'Batas cabang tidak dapat disimpan.'));
      setPlatformData((current) => ({
        ...current,
        businesses: current.businesses.map((item) => item.id === business.id
          ? { ...item, branch_limit: branchLimit }
          : item),
      }));
      setNotice(`Batas cabang ${business.name} diperbarui menjadi ${branchLimit}.`);
    } catch (error) {
      setBillingError(error.message);
    } finally {
      setPlatformBranchLimitSaving('');
    }
  };

  const getWhatsAppReceiptUrl = (transaction) => {
    const phone = normalizeWhatsAppNumber(transaction.whatsapp || '');
    if (phone.length < 10 || phone.length > 15) return '';
    const itemLines = transaction.items
      .map((item) => `- ${item.name}: ${item.quantity} ${item.unit} x ${rupiah(item.price)} = ${rupiah(item.quantity * item.price)}`)
      .join('\n');
    const message = [
      `Halo ${transaction.customer}, terima kasih telah bertransaksi di ${workspaceName}.`,
      '',
      `Nota: ${transaction.receiptNumber}`,
      ...(transaction.tableNumber ? [`Meja: ${transaction.tableNumber}`] : []),
      itemLines,
      ...(transaction.specialNotes ? [`Catatan khusus: ${transaction.specialNotes}`] : []),
      `Total: ${rupiah(transaction.total)}`,
      `Pembayaran: ${transaction.paymentStatus} (${transaction.paymentMethod})`,
      '',
      'Terima kasih atas kepercayaan Anda.',
    ].join('\n');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const getMotorReceiptWhatsappUrl = (receipt) => {
    const phone = normalizeWhatsAppNumber(receipt.whatsapp || '');
    if (phone.length < 10 || phone.length > 15) return '';
    const message = [
      `Halo ${receipt.customer}, berikut kwitansi pembelian motor dari ${workspaceName}.`,
      `No. Kwitansi: ${receipt.receiptNumber}`,
      `Tanggal: ${receipt.dateLabel}`,
      `Jumlah: ${rupiah(receipt.amount)} (${terbilangRupiah(receipt.amount)})`,
      `Motor: ${receipt.motor}`,
      `No. Rangka: ${receipt.frameNumber || '-'}`,
      `No. Mesin: ${receipt.engineNumber || '-'}`,
      `Tahun/Warna: ${receipt.year || '-'} / ${receipt.color || '-'}`,
      `Atas nama STNK: ${receipt.stnkName}`,
      `Alamat: ${receipt.address}`,
      `Keterangan: ${receipt.note}`,
    ].join('\n');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const printPosReceipt = (receiptNumber) => {
    flushSync(() => setPrintingReceipt(receiptNumber));
    window.print();
  };

  const printMotorReceipt = (receiptNumber) => {
    flushSync(() => setPrintingMotorReceipt(receiptNumber));
    window.print();
  };

  const beginNewSpk = () => {
    setForm({
      date: getToday(),
      unit: '',
      unitId: '',
      sales: activeUser.role === 'SALES' ? activeUser.name : '',
      nik: '',
      customer: '',
      whatsapp: '',
      address: '',
      motor: '',
      type: '',
      color: '',
      frameNumber: '',
      engineNumber: '',
      year: '',
      stnkName: '',
      receiptAmount: '',
      receiptCity: '',
      receiptNote: '',
      otr: '',
      leasing: '',
      dp: '',
      tenor: '',
      installment: '',
      promo: '',
      discount: '',
    });
    setPaymentType('CREDIT');
    openPage('Input SPK');
  };

  const saveSpk = async (status) => {
    const dateCode = form.date.replaceAll('-', '');
    const number = getNextSpkNumber(dateCode, spks);
    const spkNumber = `SPK-WAM-${dateCode}-${number}`;
    const selectedUnit = dealerMotorUnits.find((unit) => unit.id === form.unitId);
    if (status === 'SUBMITTED' && !selectedUnit) {
      setNotice('Pilih unit motor yang tersedia dari stok sebelum submit SPK.');
      return;
    }
    const dateLabel = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${form.date}T00:00:00`));
    const newSpk = {
      id: spkNumber,
      spkNumber,
      customer: form.customer || 'Customer baru',
      motor: [form.motor, form.type].filter(Boolean).join(' ') || 'Motor belum dipilih',
      sales: activeUser.role === 'SALES' ? activeUser.name : form.sales || 'Belum ditentukan',
      amount: selectedUnit ? Number(selectedUnit.otrPrice) : Number(form.otr) || 0,
      status,
      date: dateLabel,
    };

    if (status === 'SUBMITTED' && isAuthenticated) {
      try {
        const response = await fetch('/api/dealer-motor/spks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: selectedUnit.id,
            customerName: form.customer,
            customerNik: form.nik,
            customerPhone: form.whatsapp,
            customerAddress: form.address,
            salesName: form.sales,
            details: {
              date: form.date,
              paymentType,
              leasing: form.leasing,
              downPayment: form.dp,
              tenor: form.tenor,
              installment: form.installment,
              promo: form.promo,
              discount: form.discount,
              receiptAmount: form.receiptAmount,
              receiptCity: form.receiptCity,
              stnkName: form.stnkName,
              receiptNote: form.receiptNote,
            },
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'SPK tidak dapat disimpan.');
        if (!result.spk?.id || !result.spk?.spkNumber) throw new Error('Data SPK dari server tidak valid.');
        if (!result.unitStatus?.stockStatus || !result.movement?.id) {
          throw new Error('Status stok motor dari server tidak valid.');
        }
        setSpks((current) => [result.spk, ...current]);
        const receipt = {
          receiptNumber: `KWB${dateCode.slice(2, 6)}.${String(motorReceipts.filter((entry) => entry.date === form.date).length + 1).padStart(5, '0')}`,
          spkNumber: result.spk.spkNumber,
          date: form.date,
          dateLabel,
          city: form.receiptCity,
          customer: form.customer,
          whatsapp: form.whatsapp,
          amount: Number(form.receiptAmount),
          motor: result.spk.motor,
          frameNumber: result.spk.frameNumber,
          engineNumber: result.spk.engineNumber,
          year: result.spk.year,
          color: result.spk.color,
          stnkName: form.stnkName.trim() || form.customer,
          address: form.address,
          note: form.receiptNote.trim() || `Pembayaran ${form.customer}`,
        };
        setMotorReceipts((current) => [receipt, ...current]);
        setDealerMotorUnits((current) => current.map((unit) => (
          unit.id === selectedUnit.id ? { ...unit, ...result.unitStatus } : unit
        )));
        setDealerMotorMovements((current) => [result.movement, ...current]);
        openPage(activeUser.permissions.includes('spkViewAll') ? 'Semua SPK' : 'SPK Saya');
        setNotice(`${result.spk.spkNumber} berhasil disimpan dan menunggu verifikasi Admin.`);
        return;
      } catch (error) {
        setNotice(error.message);
        return;
      }
    }

    if (status === 'SUBMITTED') {
      const dateReceipts = motorReceipts.filter((receipt) => receipt.date === form.date).length;
      const receipt = {
        receiptNumber: `KWB${dateCode.slice(2, 6)}.${String(dateReceipts + 1).padStart(5, '0')}`,
        spkNumber: newSpk.id,
        date: form.date,
        dateLabel,
        city: form.receiptCity,
        customer: form.customer,
        whatsapp: form.whatsapp,
        amount: Number(form.receiptAmount),
        motor: [form.motor, form.type].filter(Boolean).join(' '),
        frameNumber: form.frameNumber.trim(),
        engineNumber: form.engineNumber.trim(),
        year: form.year,
        color: form.color,
        stnkName: form.stnkName.trim() || form.customer,
        address: form.address,
        note: form.receiptNote.trim() || `Pembayaran ${form.customer}`,
      };
      setMotorReceipts((current) => [receipt, ...current]);
    }

    setSpks((current) => [newSpk, ...current]);
    openPage(activeUser.permissions.includes('spkViewAll') ? 'Semua SPK' : 'SPK Saya');
    setNotice(`${newSpk.spkNumber} berhasil disimpan sebagai ${status.toLowerCase()}.`);
  };

  const transitionSpk = async (spk, permission, allowedStatuses, nextStatus, actionLabel) => {
    if (!activeUser.permissions.includes(permission)) {
      setNotice('Akun ini tidak memiliki hak akses untuk tindakan tersebut.');
      return;
    }
    if (!allowedStatuses.includes(spk.status)) {
      setNotice(`Status ${spk.spkNumber || spk.id} sudah berubah dan tidak dapat ${actionLabel.toLowerCase()}.`);
      return;
    }
    if (isAuthenticated) {
      try {
        const action = nextStatus === 'APPROVAL SVP' ? 'verify' : 'approve';
        const response = await fetch(`/api/dealer-motor/spks/${spk.id}/${action}`, { method: 'PATCH' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `SPK tidak dapat ${actionLabel.toLowerCase()}.`);
        const changedStatus = result.spk?.status;
        if (!changedStatus) throw new Error('Status SPK dari server tidak valid.');
        setSpks((current) => current.map((item) => (
          item.id === spk.id ? { ...item, status: changedStatus, deliveryStatus: result.spk.deliveryStatus ?? item.deliveryStatus } : item
        )));
        setNotice(`${spk.spkNumber || spk.id} berhasil ${actionLabel.toLowerCase()}.`);
        return;
      } catch (error) {
        setNotice(error.message);
        return;
      }
    }
    setSpks((current) => current.map((item) => (
      item.id === spk.id && allowedStatuses.includes(item.status)
        ? { ...item, status: nextStatus }
        : item
    )));
    setNotice(`${spk.spkNumber || spk.id} berhasil ${actionLabel.toLowerCase()}.`);
  };

  const verifySpk = (spk) => transitionSpk(
    spk,
    'spkVerify',
    ['SUBMITTED', 'VERIFIKASI ADMIN'],
    'APPROVAL SVP',
    'diverifikasi dan dikirim untuk approval SVP',
  );

  const approveSpk = (spk) => transitionSpk(
    spk,
    'spkApprove',
    ['APPROVAL SVP'],
    'SELESAI',
    'disetujui',
  );

  const rejectSpk = async (spk) => {
    const permission = spk.status === 'SUBMITTED' ? 'spkVerify' : 'spkApprove';
    if (!activeUser.permissions.includes(permission)) {
      setNotice('Akun ini tidak memiliki hak akses untuk menolak SPK pada tahap ini.');
      return;
    }
    if (!['SUBMITTED', 'APPROVAL SVP'].includes(spk.status)) {
      setNotice(`Status ${spk.spkNumber || spk.id} sudah berubah dan tidak dapat ditolak.`);
      return;
    }
    if (isAuthenticated) {
      try {
        const response = await fetch(`/api/dealer-motor/spks/${spk.id}/reject`, { method: 'PATCH' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'SPK tidak dapat ditolak.');
        if (result.spk?.status !== 'DITOLAK') throw new Error('Status penolakan SPK dari server tidak valid.');
        setSpks((current) => current.map((item) => (
          item.id === spk.id ? { ...item, status: result.spk.status } : item
        )));
        if (result.spk.unitStatus?.stockStatus) {
          setDealerMotorUnits((current) => current.map((unit) => (
            unit.id === spk.unitId ? { ...unit, ...result.spk.unitStatus } : unit
          )));
        }
        setNotice(`${spk.spkNumber || spk.id} ditolak.`);
        return;
      } catch (error) {
        setNotice(error.message);
        return;
      }
    }
    setSpks((current) => current.map((item) => (
      item.id === spk.id ? { ...item, status: 'DITOLAK' } : item
    )));
    setDealerMotorUnits((current) => current.map((unit) => (
      unit.id === spk.unitId && unit.stockStatus === 'reserved'
        ? { ...unit, stockStatus: 'available', statusUpdatedAt: new Date().toISOString() }
        : unit
    )));
    setNotice(`${spk.spkNumber || spk.id} ditolak.`);
  };

  const editUserAccess = (user) => {
    setAccessDraft({ ...user, permissions: [...user.permissions] });
  };

  const saveUserAccess = () => {
    if (activeUser.role !== 'OWNER' && ['OWNER', 'PLATFORM_OWNER'].includes(accessDraft.role)) {
      setNotice('Hanya Owner yang dapat mengubah akses akun Owner.');
      return;
    }
    if (activeUser.role !== 'OWNER' && accessDraft.role === 'SUPER ADMIN'
      && users.find((user) => user.id === accessDraft.id)?.role !== 'SUPER ADMIN') {
      setNotice('Hanya Owner yang dapat menetapkan peran Super Admin.');
      return;
    }
    const savedAccessDraft = accessDraft.role === 'SUPER ADMIN'
      ? {
        ...accessDraft,
        permissions: accessDraft.permissions.filter((permission) => !superAdminRestrictedPermissions.includes(permission)),
      }
      : accessDraft;
    setUsers((current) => current.map((user) => (
      user.id === accessDraft.id ? savedAccessDraft : user
    )));
    setNotice(`Pengaturan akses ${accessDraft.name} berhasil disimpan.`);
    setAccessDraft(null);
  };

  const createEmployeeInvite = async (event) => {
    event.preventDefault();
    setNotice('');
    setInviting(true);
    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole, branchId: inviteBranchId || undefined }),
      });
      if (!response.ok) {
        setNotice(await getApiError(response, 'Link pendaftaran tidak dapat dibuat.'));
        return;
      }
      const result = await response.json();
      if (!result.inviteUrl) {
        setNotice('Server tidak mengembalikan link pendaftaran karyawan.');
        return;
      }
      setInviteUrl(result.inviteUrl);
      setNotice('Link pendaftaran karyawan berhasil dibuat.');
    } catch {
      setNotice('Layanan undangan tidak tersedia. Pastikan server aplikasi sudah terhubung.');
    } finally {
      setInviting(false);
    }
  };

  const decideTeamMember = async (user, decision) => {
    setMemberDecisionBusy(user.id);
    setNotice('');
    try {
      const response = await fetch(`/api/team/members/${user.id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error(await getApiError(response, 'Status pendaftaran tidak dapat diperbarui.'));
      const result = await response.json();
      setUsers((current) => current.map((member) => (
        member.id === result.user.id ? { ...member, ...result.user } : member
      )));
      setNotice(decision === 'approve'
        ? `Pendaftaran ${user.name} disetujui.`
        : `Pendaftaran ${user.name} ditolak.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setMemberDecisionBusy('');
    }
  };

  const finishAuthentication = (result, registrationPayload) => {
    const user = {
      ...result.user,
      permissions: Array.isArray(result.user.permissions)
        ? result.user.permissions
        : rolePermissions[result.user.role] ?? [],
      active: true,
    };
    const targetWorkspaceUrl = result.business?.workspaceUrl;
    if (targetWorkspaceUrl
      && ['kelolausaha.store', 'www.kelolausaha.store'].includes(window.location.hostname.toLowerCase())) {
      const target = new URL(targetWorkspaceUrl);
      if (target.hostname !== window.location.hostname.toLowerCase()) {
        window.location.assign(`${target.origin}${window.location.pathname}${window.location.search}${window.location.hash}`);
        return;
      }
    }
    setUsers([user]);
    setActiveUserId(user.id);
    setDealerMotorUnits([]);
    setDealerMotorMovements([]);
    setSpks([]);
    setWorkspaceBranches([]);
    const businessName = result.business?.name || (user.role === 'PLATFORM_OWNER' ? 'KelolaUsaha.store' : workspaceName);
    const orderWorkspaceKey = result.business?.id || businessName;
    setWorkspaceName(businessName);
    setBusinessProfile({
      name: businessName,
      address: '',
      phone: '',
      logoUrl: typeof result.business?.themeSettings?.logoUrl === 'string'
        ? result.business.themeSettings.logoUrl
        : '',
    });
    setWorkspaceUrl(targetWorkspaceUrl || '');
    setRestaurantOrderWorkspaceKey(orderWorkspaceKey);
    try {
      const savedOrders = JSON.parse(localStorage.getItem(`ku:restaurant-orders:${orderWorkspaceKey}`) || '[]');
      if (!Array.isArray(savedOrders)) throw new Error('Format data pesanan tidak valid.');
      setRestaurantOrders(savedOrders);
    } catch (error) {
      setNotice(`Pesanan tersimpan tidak dapat dimuat: ${error.message}`);
    }
    setIsAuthenticated(true);
    setNeedsBusinessSetup(user.role === 'OWNER' && !result.business);
    setDemoMode(false);
    setBillingData(user.role === 'OWNER' && result.business?.subscription ? { business: result.business } : null);
    const nextBusinessType = result.business?.type
      || result.business?.businessType
      || registrationPayload?.businessType
      || 'dealer_motor';
    const knownBusinessType = businessTypes[nextBusinessType] ? nextBusinessType : 'dealer_motor';
    const modules = result.business?.modules || registrationPayload?.modules;
    setBusinessType(knownBusinessType);
    const activeModules = Array.isArray(modules) && modules.length
      ? modules
      : businessTypes[knownBusinessType].modules.map(([id]) => id);
    setWorkspaceModules(activeModules);
    setWorkspaceModuleDraft(activeModules);
    setPriceItems(priceCatalogs[knownBusinessType]);
    setAuthView(null);
    const defaultPage = user.role === 'PLATFORM_OWNER' ? 'Semua Usaha' : 'Dashboard';
    const requestedPage = pageFromHash();
    const requestedPageAllowed = requestedPage === 'Dashboard'
      ? user.permissions.includes('dashboard')
      : requestedPage === 'Pusat Bantuan'
        ? true
        : getUserMenus(user).some(([label]) => label === requestedPage);
    const landingPage = requestedPage && requestedPageAllowed ? requestedPage : defaultPage;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${encodeURIComponent(landingPage)}`);
    setActivePage(landingPage);
  };

  const saveWorkspaceStructure = async () => {
    if (!workspaceModuleDraft.includes('dashboard')) {
      setNotice('Dashboard wajib tetap aktif pada workspace.');
      return;
    }
    setWorkspaceModulesSaving(true);
    try {
      if (isAuthenticated) {
        const response = await fetch('/api/operations/modules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modules: workspaceModuleDraft }),
        });
        if (!response.ok) {
          setNotice(await getApiError(response, 'Struktur workspace tidak dapat disimpan.'));
          return;
        }
      }
      setWorkspaceModules([...workspaceModuleDraft]);
      setNotice('Struktur workspace berhasil diperbarui.');
    } catch {
      setNotice('Struktur workspace tidak dapat disimpan. Periksa koneksi server.');
    } finally {
      setWorkspaceModulesSaving(false);
    }
  };

  const togglePermission = (permissionId) => {
    setAccessDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((permission) => permission !== permissionId)
        : [...current.permissions, permissionId],
    }));
  };

  const activeUser = users.find((user) => user.id === activeUserId) ?? users[0];
  const role = activeUser.role;
  const openSupport = () => {
    setSupportName(activeUser.name || '');
    setSupportEmail(activeUser.email || '');
    setSupportActiveTicket(null);
    setSupportMessages([]);
    setSupportStartNew(false);
    setSupportError('');
    setSupportNotice('');
    setHelpOpen(false);
    openPage('Pusat Bantuan');
  };
  const ownerTrialEnd = activeUser.role === 'OWNER'
    && billingData?.business?.subscription?.status === 'trial'
    ? billingData.business.subscription.trialEndsAt
    : null;
  const ownerTrialCountdown = ownerTrialEnd ? getCountdown(ownerTrialEnd, countdownNow) : null;
  const activeThemeColors = getThemeColors(themeSettings);
  const canApproveSpk = businessType === 'dealer_motor'
    && workspaceModules.includes('sales_orders')
    && activeUser.permissions.includes('spkApprove');
  const pendingApprovalCount = spks.filter((item) => item.status === 'APPROVAL SVP').length;
  const enabledMenus = {
    Kasir: 'pos',
    'Daftar Harga': 'prices',
    Transaksi: 'transactions',
    'Nota Digital': 'digital_receipts',
    'Menu Digital': 'menu',
    Pesanan: 'orders',
    Customer: 'customers',
    Sales: 'sales_team',
    Leasing: 'financing',
    'Leasing & Promo': 'financing',
    'Laporan Penjualan': 'sales_reports',
    Performance: 'sales_reports',
    Target: 'targets',
    'Semua Unit': 'vehicles',
    'Unit Dealer': 'vehicles',
    'Unit & Motor': 'vehicles',
    Motor: 'vehicles',
    'Input SPK': 'sales_orders',
    'Semua SPK': 'sales_orders',
    SPK: 'sales_orders',
    'SPK Saya': 'sales_orders',
    Pengajuan: 'sales_orders',
    'Verifikasi SPK': 'sales_orders',
    Approval: 'sales_orders',
    Dokumen: 'sales_orders',
  };
  const menus = getUserMenus(activeUser).filter(([label]) => (
    (!enabledMenus[label] || workspaceModules.includes(enabledMenus[label]))
    && (businessType === 'dealer_motor' || !dealerOnlyMenus.has(label))
    && (label !== 'Pesanan' || businessType === 'restaurant')
    && (label !== 'Pengiriman' || activeUser.role === 'DRIVER')
  )).filter(([label]) => label !== 'Aktivasi' || activeUser.role === 'OWNER')
    .filter(([label]) => !billingData?.business?.subscription
    || billingData.business.subscription.status !== 'expired'
    || ['Aktivasi', 'Dashboard', 'Profil Usaha'].includes(label));
  const menuSections = [
    { title: 'UTAMA', labels: ['Dashboard'] },
    { title: 'OPERASIONAL', labels: ['Kasir', 'Menu Digital', 'Pesanan', 'Daftar Harga', 'Transaksi', 'Nota Digital', 'Aktivasi', 'Input SPK', 'SPK', 'Semua SPK', 'SPK Saya', 'Pengajuan', 'Follow Up', 'Verifikasi SPK', 'Approval', 'Pengiriman'] },
    { title: 'KEUANGAN', labels: ['Pembukuan'] },
    { title: 'ORGANISASI', labels: ['Semua Unit', 'Unit Dealer', 'Unit & Motor', 'Motor', 'Customer', 'Sales', 'Leasing', 'Dokumen', 'User Management', 'Pengelolaan Akses', 'Log Aktivitas', 'Cabang'] },
    { title: 'KARYAWAN', labels: ['Absensi'] },
    { title: 'LAPORAN', labels: ['Laporan Penjualan', 'Performance', 'Target'] },
    { title: 'PLATFORM', labels: ['Semua Usaha', 'Pusat Bantuan'] },
    { title: 'PENGATURAN', labels: ['Profil Usaha', 'Struktur Workspace', 'Tampilan Dashboard'] },
  ].map((section) => ({
    ...section,
    items: menus.filter(([label]) => section.labels.includes(label)),
  })).filter((section) => section.items.length > 0);
  const heading = activePage === 'SPK Saya' || activePage === 'Pengajuan' ? 'Semua SPK' : activePage;
  const visibleSpks = activePage === 'Approval'
    ? spks.filter((item) => item.status === 'APPROVAL SVP')
    : spks;

  useEffect(() => {
    if ((!helpOpen && activePage !== 'Pusat Bantuan') || activeUser.role === 'PLATFORM_OWNER') return undefined;
    let cancelled = false;
    fetch('/api/support/contact')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Email tim support tidak tersedia.');
        if (!result.email) throw new Error('Email tim support belum dikonfigurasi.');
        if (!cancelled) setSupportContactEmail(result.email);
      })
      .catch((error) => {
        if (!cancelled) setSupportError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, activeUser.role, helpOpen]);

  useEffect(() => {
    if (activePage !== 'Pusat Bantuan' || activeUser.role === 'PLATFORM_OWNER'
      || !(supportEmail || activeUser.email)) return undefined;
    let cancelled = false;
    const email = supportEmail || activeUser.email;
    if (!supportEmail) setSupportEmail(email);
    if (!supportName && activeUser.name) setSupportName(activeUser.name);
    const refreshSupportCenter = async () => {
      try {
        const ticketsResponse = await fetch(`/api/support/tickets?email=${encodeURIComponent(email)}`);
        const ticketsResult = await ticketsResponse.json();
        if (!ticketsResponse.ok) throw new Error(ticketsResult.message || 'Daftar percakapan bantuan tidak dapat dimuat.');
        if (cancelled) return;
        setSupportTickets(ticketsResult.tickets);

        const selectedTicket = ticketsResult.tickets.find((ticket) => ticket.id === supportActiveTicket?.id)
          || (!supportStartNew ? ticketsResult.tickets[0] : null);
        if (!selectedTicket) {
          if (!supportStartNew && supportActiveTicket?.id) {
            setSupportActiveTicket(null);
            setSupportMessages([]);
          }
          return;
        }

        const response = await fetch(
          `/api/support/tickets/${selectedTicket.id}?email=${encodeURIComponent(email)}`,
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Percakapan bantuan tidak dapat dimuat.');
        if (!cancelled) {
          setSupportActiveTicket(result.ticket);
          setSupportMessages(result.messages);
        }
      } catch (error) {
        if (!cancelled) setSupportError(error.message);
      }
    };
    refreshSupportCenter();
    const timer = window.setInterval(refreshSupportCenter, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePage, activeUser.email, activeUser.name, activeUser.role, supportActiveTicket?.id, supportEmail, supportStartNew, supportName]);

  useEffect(() => {
    const pageIsAllowed = activePage === 'Dashboard'
      ? activeUser.permissions.includes('dashboard')
      : activePage === 'Pusat Bantuan'
        ? true
        : menus.some(([label]) => label === activePage);
    if (!pageIsAllowed) {
      const fallbackPage = menus[0]?.[0] ?? 'Dashboard';
      setActivePage(fallbackPage);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${encodeURIComponent(fallbackPage)}`);
    }
  }, [activePage, activeUser, menus]);

  useEffect(() => {
    setInviteRole(activeUser.role === 'OWNER' ? 'SUPER ADMIN' : 'ADMIN');
  }, [activeUser.id, activeUser.role]);

  useEffect(() => {
    if (!inviteBranchId) {
      const primaryBranch = workspaceBranches.find((branch) => branch.isPrimary);
      if (primaryBranch) setInviteBranchId(primaryBranch.id);
    }
  }, [inviteBranchId, workspaceBranches]);

  useEffect(() => {
    if (activeUser.role !== 'OWNER' || !ownerTrialEnd) return undefined;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeUser.role, ownerTrialEnd]);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.status === 401) return;
        if (!response.ok) throw new Error(await getApiError(response, 'Sesi akun tidak dapat dipulihkan.'));
        const result = await response.json();
        if (!cancelled) finishAuthentication(result);
      } catch (error) {
        if (!cancelled) setSessionMessage(`Status akun tidak dapat diperiksa: ${error.message}`);
      }
    };
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen && !accountProfileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setAccountMenuOpen(false);
      setAccountProfileOpen(false);
    };
    const closeMenuOutside = (event) => {
      if (event.target instanceof Element && !event.target.closest('.account-menu-shell')) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    if (accountMenuOpen) document.addEventListener('pointerdown', closeMenuOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeMenuOutside);
    };
  }, [accountMenuOpen, accountProfileOpen]);

  useEffect(() => {
    if (!isAuthenticated || demoMode || !['OWNER', 'SUPER ADMIN'].includes(activeUser.role)) return undefined;
    let cancelled = false;
    const loadTeamMembers = async () => {
      try {
        const response = await fetch('/api/team/members');
        if (!response.ok) throw new Error(await getApiError(response, 'Daftar anggota workspace tidak dapat dimuat.'));
        const result = await response.json();
        if (!Array.isArray(result.users)) throw new Error('Daftar anggota dari server tidak valid.');
        if (!cancelled) {
          setUsers(result.users.map((user) => ({
            ...user,
            permissions: Array.isArray(user.permissions)
              ? user.permissions
              : rolePermissions[user.role] ?? [],
          })));
        }
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      }
    };
    loadTeamMembers();
    return () => {
      cancelled = true;
    };
  }, [activeUser.role, isAuthenticated, demoMode]);
  useEffect(() => {
    if (!isAuthenticated || needsBusinessSetup) return undefined;
    let cancelled = false;
    const loadAccountData = async () => {
      try {
        const endpoint = activeUser.role === 'PLATFORM_OWNER'
          ? '/api/platform/businesses'
          : activeUser.role === 'OWNER'
            ? '/api/billing/status'
            : '/api/workspace/theme';
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(await getApiError(response, 'Data aktivasi tidak dapat dimuat.'));
        const data = await response.json();
        if (cancelled) return;
        if (activeUser.role === 'PLATFORM_OWNER') {
          setPlatformData(data);
          setPlatformBranchLimits(Object.fromEntries((data.businesses || [])
            .map((business) => [business.id, business.branch_limit])));
        }
        else if (activeUser.role === 'OWNER') {
          setBillingData(data);
          setThemeSettings(normalizeThemeSettings(data.business.themeSettings));
        } else {
          setThemeSettings(normalizeThemeSettings(data.themeSettings));
        }
        setBillingError('');
      } catch (error) {
        if (!cancelled) setBillingError(error.message);
      }
    };
    loadAccountData();
    const checkingPayment = activeUser.role === 'OWNER'
      && new URLSearchParams(window.location.search).get('payment') === 'check';
    const refreshTimer = window.setInterval(loadAccountData, checkingPayment ? 5000 : 60000);
    const stopPaymentChecks = checkingPayment
      ? window.setTimeout(() => window.clearInterval(refreshTimer), 65000)
      : null;
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      if (stopPaymentChecks) window.clearTimeout(stopPaymentChecks);
    };
  }, [activeUser.id, activeUser.role, isAuthenticated, needsBusinessSetup]);

  useEffect(() => {
    if (activePage !== 'Profil Usaha' || needsBusinessSetup) return undefined;
    let cancelled = false;
    setBusinessProfileError('');
    setBusinessProfileNotice('');

    if (!isAuthenticated) {
      if (demoMode) {
        try {
          const savedProfile = JSON.parse(localStorage.getItem('ku-demo-business-profile') || 'null');
          setBusinessProfile(savedProfile
            && typeof savedProfile.name === 'string'
            && typeof savedProfile.address === 'string'
            && typeof savedProfile.logoUrl === 'string'
            ? {
              ...savedProfile,
              phone: typeof savedProfile.phone === 'string' ? savedProfile.phone : '',
            }
            : { name: dealerName, address: '', phone: '', logoUrl: '' });
        } catch (error) {
          setBusinessProfileError(`Profil demo tidak dapat dimuat: ${error.message}`);
        }
      }
      return undefined;
    }

    setBusinessProfileLoading(true);
    const loadBusinessProfile = async () => {
      try {
        const response = await fetch('/api/workspace/profile');
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Profil usaha tidak dapat dimuat.');
        const profile = result.profile;
        if (!profile || typeof profile.name !== 'string'
          || typeof profile.address !== 'string' || typeof profile.phone !== 'string'
          || typeof profile.logoUrl !== 'string') {
          throw new Error('Data profil usaha dari server tidak valid.');
        }
        if (cancelled) return;
        setBusinessProfile(profile);
        setWorkspaceName(profile.name);
        setThemeSettings((current) => ({ ...current, logoUrl: profile.logoUrl }));
      } catch (error) {
        if (!cancelled) setBusinessProfileError(error.message);
      } finally {
        if (!cancelled) setBusinessProfileLoading(false);
      }
    };
    loadBusinessProfile();
    return () => {
      cancelled = true;
    };
  }, [
    activePage,
    activeUser.id,
    demoMode,
    isAuthenticated,
    needsBusinessSetup,
  ]);

  useEffect(() => {
    if (!isAuthenticated || activeUser.role !== 'PLATFORM_OWNER' || activePage !== 'Pusat Bantuan') return undefined;
    let cancelled = false;
    const loadSupport = async () => {
      try {
        const response = await fetch('/api/platform/support/tickets');
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Daftar bantuan tidak dapat dimuat.');
        if (!cancelled) setSupportOwnerTickets(result.tickets);
        if (supportOwnerTicket?.id) {
          const conversationResponse = await fetch(`/api/platform/support/tickets/${supportOwnerTicket.id}`);
          const conversation = await conversationResponse.json();
          if (!conversationResponse.ok) throw new Error(conversation.message || 'Percakapan bantuan tidak dapat dimuat.');
          if (!cancelled) {
            setSupportOwnerTicket(conversation.ticket);
            setSupportOwnerMessages(conversation.messages);
          }
        }
      } catch (error) {
        if (!cancelled) setSupportError(error.message);
      }
    };
    loadSupport();
    const timer = window.setInterval(loadSupport, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePage, activeUser.id, activeUser.role, isAuthenticated, supportOwnerTicket?.id]);

  useEffect(() => {
    if (!isAuthenticated || activeUser.role !== 'OWNER') return undefined;
    let cancelled = false;
    const loadFinanceEntries = async () => {
      try {
        const [response, branchesResponse] = await Promise.all([
          fetch('/api/finance/entries'),
          fetch('/api/workspace/operations/branches'),
        ]);
        if (!response.ok) throw new Error(await getApiError(response, 'Pembukuan tidak dapat dimuat.'));
        if (!branchesResponse.ok) throw new Error(await getApiError(branchesResponse, 'Data cabang tidak dapat dimuat.'));
        const [result, branchesResult] = await Promise.all([response.json(), branchesResponse.json()]);
        if (!Array.isArray(result.entries) || !Array.isArray(branchesResult.branches)) {
          throw new Error('Data pembukuan atau cabang dari server tidak valid.');
        }
        if (!cancelled) {
          setFinanceEntries(result.entries);
          setWorkspaceBranches(branchesResult.branches);
          setFinanceBranchId((current) => current || branchesResult.branches.find((branch) => branch.isPrimary)?.id || '');
        }
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      }
    };
    loadFinanceEntries();
    return () => {
      cancelled = true;
    };
  }, [activeUser.id, activeUser.role, isAuthenticated]);

  useEffect(() => {
    const canManageBranches = activeUser.permissions.includes('branchManage');
    const canLoadUnits = workspaceModules.includes('vehicles')
      && (activeUser.permissions.includes('unitManage') || activeUser.permissions.includes('spkCreate'));
    const canLoadSpks = workspaceModules.includes('sales_orders');
    if (!isAuthenticated || needsBusinessSetup || (!canManageBranches && !canLoadUnits && !canLoadSpks)) return undefined;
    let cancelled = false;
    const loadDealerMotorData = async () => {
      try {
        const requests = [];
        const unitsIndex = canLoadUnits ? requests.length : -1;
        if (canLoadUnits) requests.push(fetch('/api/dealer-motor/units'));
        const needsBranches = canManageBranches || (canLoadUnits
          && (activeUser.permissions.includes('unitManage') || activeUser.permissions.includes('spkCreate')));
        const branchesIndex = needsBranches ? requests.length : -1;
        if (needsBranches) requests.push(fetch('/api/workspace/operations/branches'));
        const spkPermission = !canLoadSpks
          ? ''
          : activeUser.permissions.includes('spkViewAll')
            ? 'all'
            : activeUser.permissions.includes('spkViewOwn')
              ? 'mine'
              : activeUser.permissions.includes('spkVerify')
                ? 'verify'
                : activeUser.permissions.includes('spkApprove') ? 'approval' : '';
        const spksIndex = spkPermission ? requests.length : -1;
        if (spkPermission) requests.push(fetch(`/api/dealer-motor/spks?scope=${spkPermission}`));
        const responses = await Promise.all(requests);
        for (const response of responses) {
          if (!response.ok) throw new Error(await getApiError(response, 'Data stok atau SPK tidak dapat dimuat.'));
        }
        const unitsResult = unitsIndex >= 0 ? await responses[unitsIndex].json() : null;
        const branchesResult = branchesIndex >= 0 ? await responses[branchesIndex].json() : null;
        const spksResult = spksIndex >= 0 ? await responses[spksIndex].json() : null;
        if ((unitsResult && (!Array.isArray(unitsResult.units) || !Array.isArray(unitsResult.movements)))
          || (branchesResult && !Array.isArray(branchesResult.branches))
          || (spksResult && !Array.isArray(spksResult.spks))) {
          throw new Error('Data stok, cabang, atau SPK dari server tidak valid.');
        }
        if (cancelled) return;
        if (unitsResult) {
          setDealerMotorUnits(unitsResult.units);
          setDealerMotorMovements(unitsResult.movements);
        }
        if (branchesResult) setWorkspaceBranches(branchesResult.branches);
        if (spksResult) setSpks(spksResult.spks);
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      }
    };
    loadDealerMotorData();
    return () => {
      cancelled = true;
    };
  }, [activePage, activeUser.id, activeUser.permissions, isAuthenticated, needsBusinessSetup, workspaceModules]);

  useEffect(() => {
    if (!themeSettings.faviconUrl) return undefined;
    let favicon = document.querySelector('link[rel~="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = themeSettings.faviconUrl;
    return undefined;
  }, [themeSettings.faviconUrl]);

  const beginPackageCheckout = async () => {
    setBillingError('');
    if (activeUser.role !== 'OWNER') {
      setBillingError('Hanya Owner Usaha yang dapat melakukan aktivasi dan pembayaran.');
      return;
    }
    if (!isAuthenticated) {
      setBillingError('Masuk sebagai Owner workspace untuk memulai aktivasi.');
      return;
    }
    setCheckoutBusy(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan }),
      });
      if (!response.ok) throw new Error(await getApiError(response, 'Pembayaran tidak dapat dimulai.'));
      const result = await response.json();
      if (!result.redirectUrl) throw new Error('Server tidak mengembalikan halaman pembayaran Midtrans.');
      window.location.assign(result.redirectUrl);
    } catch (error) {
      setBillingError(error.message);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const changeThemeAsset = async (event, assetType, onUploaded, setUploadError = setThemeError) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    const extension = file.name.split('.').pop().toLowerCase();
    if ((!['image/png', 'image/jpeg', 'image/webp', 'image/x-icon'].includes(file.type)
      && !['png', 'jpg', 'jpeg', 'webp', 'ico'].includes(extension))
      || file.size > 2 * 1024 * 1024) {
      setUploadError('Pilih PNG, JPG, WebP, atau ICO berukuran maksimal 2 MB.');
      event.target.value = '';
      return;
    }
    if (isAuthenticated) {
      const upload = new FormData();
      upload.append('assetType', assetType);
      upload.append('file', file);
      try {
        const response = await fetch('/api/workspace/assets', { method: 'POST', body: upload });
        if (!response.ok) throw new Error(await getApiError(response, 'File tidak dapat diunggah.'));
        const result = await response.json();
        setThemeSettings((current) => ({ ...current, [assetType === 'logo' ? 'logoUrl' : 'faviconUrl']: result.url }));
        onUploaded?.(result.url);
      } catch (error) {
        setUploadError(error.message);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setThemeSettings((current) => ({
        ...current,
        [assetType === 'logo' ? 'logoUrl' : 'faviconUrl']: url,
      }));
      onUploaded?.(url);
    };
    reader.onerror = () => setUploadError('Pratinjau gambar tidak dapat dibaca.');
    reader.readAsDataURL(file);
  };

  const uploadBusinessLogo = async (event) => {
    setBusinessProfileError('');
    setBusinessProfileNotice('');
    setBusinessProfileUploading(true);
    try {
      await changeThemeAsset(
        event,
        'logo',
        (logoUrl) => {
          setBusinessProfile((current) => ({ ...current, logoUrl }));
          setBusinessProfileNotice('Logo diunggah. Simpan profil untuk menerapkan perubahan.');
        },
        setBusinessProfileError,
      );
    } finally {
      setBusinessProfileUploading(false);
    }
  };

  const saveBusinessProfile = async (event) => {
    event.preventDefault();
    setBusinessProfileError('');
    setBusinessProfileNotice('');
    const profile = {
      name: businessProfile.name.trim(),
      address: businessProfile.address.trim(),
      phone: businessProfile.phone.trim(),
      logoUrl: businessProfile.logoUrl,
    };

    if (!isAuthenticated) {
      if (!demoMode) {
        setBusinessProfileError('Masuk ke workspace untuk menyimpan profil usaha.');
        return;
      }
      try {
        localStorage.setItem('ku-demo-business-profile', JSON.stringify(profile));
        setBusinessProfile(profile);
        setWorkspaceName(profile.name);
        setBusinessProfileNotice('Profil demo tersimpan pada browser ini.');
      } catch {
        setBusinessProfileError('Profil demo tidak dapat disimpan di browser ini.');
      }
      return;
    }

    setBusinessProfileSaving(true);
    try {
      const response = await fetch('/api/workspace/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Profil usaha tidak dapat disimpan.');
      if (!result.profile || typeof result.profile.name !== 'string'
        || typeof result.profile.address !== 'string' || typeof result.profile.phone !== 'string'
        || typeof result.profile.logoUrl !== 'string') {
        throw new Error('Data profil usaha dari server tidak valid.');
      }
      setBusinessProfile(result.profile);
      setWorkspaceName(result.profile.name);
      setThemeSettings((current) => ({ ...current, logoUrl: result.profile.logoUrl }));
      setBillingData((current) => (current?.business
        ? {
          ...current,
          business: {
            ...current.business,
            name: result.profile.name,
            phone: result.profile.phone,
            themeSettings: { ...current.business.themeSettings, logoUrl: result.profile.logoUrl },
          },
        }
        : current));
      setBusinessProfileNotice('Profil usaha berhasil disimpan.');
    } catch (error) {
      setBusinessProfileError(error.message);
    } finally {
      setBusinessProfileSaving(false);
    }
  };

  const saveTheme = async () => {
    setThemeError('');
    setThemeNotice('');
    if (!isAuthenticated) {
      if (!demoMode) {
        setThemeError('Masuk ke workspace untuk menyimpan tampilan dashboard.');
        return;
      }
      try {
        localStorage.setItem('ku-demo-theme:dealer_motor', JSON.stringify(themeSettings));
        setThemeNotice('Tema pratinjau tersimpan pada browser ini.');
      } catch {
        setThemeError('Pengaturan pratinjau tidak dapat disimpan di browser ini.');
      }
      return;
    }
    setThemeSaving(true);
    try {
      const response = await fetch('/api/workspace/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themeSettings),
      });
      if (!response.ok) throw new Error(await getApiError(response, 'Pengaturan tema tidak dapat disimpan.'));
      const result = await response.json();
      setThemeSettings(result.themeSettings);
      setThemeNotice('Tampilan dashboard berhasil disimpan untuk perusahaan ini.');
    } catch (error) {
      setThemeError(error.message);
    } finally {
      setThemeSaving(false);
    }
  };

  const logoutAccount = async () => {
    setLogoutError('');
    setLoggingOut(true);
    try {
      if (isAuthenticated) {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (!response.ok && response.status !== 401) {
          throw new Error(await getApiError(response, 'Akun tidak dapat keluar.'));
        }
      }

      setIsAuthenticated(false);
      setNeedsBusinessSetup(false);
      setDemoMode(false);
      setUsers(initialUsers);
      setActiveUserId('platform-owner-demo');
      setActivePage('Semua Usaha');
      setBillingData(null);
      setPlatformData(null);
      setWorkspaceName('KelolaUsaha.store');
      setWorkspaceUrl('');
      setSpks(initialSpks);
      setDealerMotorUnits([]);
      setDealerMotorMovements([]);
      setWorkspaceBranches([]);
      setBusinessProfile({ name: '', address: '', logoUrl: '' });
      setAuthView(isTenantWorkspaceHost() ? 'login' : null);
      setAccountMenuOpen(false);
      setAccountProfileOpen(false);
      setSessionMessage('');
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  };

  const publicMenuParams = new URLSearchParams(window.location.search);
  if (publicMenuParams.get('menu') === 'restaurant') {
    return <RestaurantCustomerMenu
      tableNumber={publicMenuParams.get('table') || ''}
      workspaceKey={publicMenuParams.get('workspace') || 'demo'}
    />;
  }

  if (!isAuthenticated && !demoMode && !authView) {
    return <PublicSite
      onLogin={() => setAuthView('login')}
      onRegister={() => setAuthView('register')}
      statusMessage={sessionMessage}
      onPreview={() => {
        setDemoMode(true);
        setActiveUserId('platform-owner-demo');
        setActivePage('Semua Usaha');
        setWorkspaceBranches([{ id: 'preview-branch-primary', name: 'Cabang Utama', isPrimary: true }]);
        try {
          setThemeSettings(normalizeThemeSettings(
            JSON.parse(localStorage.getItem('ku-demo-theme:dealer_motor') || '{}'),
          ));
        } catch (error) {
          setThemeSettings(defaultThemeSettings);
          setThemeError(`Pengaturan tema demo tidak dapat dibaca: ${error.message}`);
        }
        setPlatformData({
          businesses: [{
            id: 'preview-dealer',
            name: dealerName,
            business_type: 'dealer_motor',
            owner_email: 'owner@dealer-demo.store',
            status: 'trial',
            trial_ends_at: new Date(Date.now() + 20 * 86400000).toISOString(),
            user_count: 5,
            paid_order_count: 0,
            lifetime_revenue: 0,
          }],
          summary: { total: 1, trials: 1, active: 0, paidRevenue: 0 },
          isDemo: true,
        });
      }}
    />;
  }

  if (needsBusinessSetup) {
    return <BusinessSetupScreen onComplete={finishAuthentication} />;
  }

  if (authView) {
    return <AuthScreen mode={authView} onAuthenticated={finishAuthentication} onBack={() => setAuthView(null)} onModeChange={setAuthView} />;
  }

  return (
    <div
      className="app-shell"
      data-dashboard-mode={activeThemeColors.mode}
      data-sidebar={themeSettings.sidebarMode}
      data-theme={themeSettings.themeId}
      style={{ '--theme-primary': activeThemeColors.primary, '--theme-secondary': activeThemeColors.secondary }}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{themeSettings.logoUrl
            ? <img alt={`${workspaceName} logo`} src={themeSettings.logoUrl} />
            : <span className="brand-initials">{initialsFor(workspaceName)}</span>}</div>
          <div className="brand-copy">
            <strong>{workspaceName}</strong>
            <span>Workspace usaha</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="dealer-switch">
          <span className="dealer-icon">{workspaceName.charAt(0).toUpperCase()}</span>
          <span className="dealer-copy"><strong>{workspaceName}</strong><small>Workspace aktif</small></span>
          <span className="switch-chevron">⌄</span>
        </div>

        <div className="nav-label">MENU USAHA</div>
        <nav className="main-nav" aria-label="Menu utama">
          {menuSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <span className="nav-section-label">{section.title}</span>
              {section.items.map(([label, icon]) => (
                <button
                  className={`nav-item ${activePage === label ? 'active' : ''}`}
                  key={label}
                  onClick={() => openPage(label)}
                  type="button"
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
                  <span>{businessMenuLabels[businessType]?.[label] || label}</span>
                  {label === 'Approval' && pendingApprovalCount > 0 && <span className="nav-count">{pendingApprovalCount}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-copyright">© 2026 KelolaUsaha.store · Demo 1 bulan</div>
          <div className="profile">
            <div className="avatar">{initialsFor(activeUser.name)}</div>
            <div className="profile-copy"><strong>{activeUser.name}</strong><span>{role}</span></div>
            <button
              aria-label="Buka profil akun"
              className="profile-menu"
              onClick={() => setAccountProfileOpen(true)}
              type="button"
            >Profil</button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>{activeUser.role === 'PLATFORM_OWNER' ? 'KELOLAUSAHA.STORE' : workspaceName}</span><span className="crumb-divider">/</span><strong>{heading}</strong></div>
          <div className="topbar-actions">
            {!isAuthenticated && demoMode && <button className="preview-exit" onClick={() => setDemoMode(false)} type="button">← Kembali ke website</button>}
            {!isAuthenticated && <div className="auth-nav-links">
              <a href="#masuk" onClick={(event) => {
                event.preventDefault();
                setAuthView('login');
              }}>Masuk</a>
              <a className="auth-nav-register" href="#daftar" onClick={(event) => {
                event.preventDefault();
                setAuthView('register');
              }}>Daftar <span>→</span></a>
            </div>}
            {!isAuthenticated && <label className="role-picker">
              <span>Akun demo</span>
              <select aria-label="Pilih akun demo" onChange={(event) => {
                const nextUser = users.find((user) => user.id === event.target.value);
                setActiveUserId(event.target.value);
                const nextMenus = getUserMenus(nextUser);
                setActivePage(nextMenus.some(([label]) => label === 'Dashboard')
                  ? 'Dashboard'
                  : nextMenus[0]?.[0] ?? 'Dashboard');
              }} value={activeUser.id}>
                {users.map((user) => <option disabled={!user.active} key={user.id} value={user.id}>{user.name} · {user.role}{user.active ? '' : ' (nonaktif)'}</option>)}
              </select>
            </label>}
            <button
              aria-label={canApproveSpk
                ? `Notifikasi persetujuan${pendingApprovalCount ? `, ${pendingApprovalCount} menunggu` : ''}`
                : `Notifikasi${unreadBillingNotifications.length ? `, ${unreadBillingNotifications.length} belum dibaca` : ''}`}
              className="icon-button notification-button"
              onClick={() => openPage(canApproveSpk
                ? 'Approval'
                : activeUser.role === 'PLATFORM_OWNER' ? 'Semua Usaha' : activeUser.role === 'OWNER' ? 'Aktivasi' : 'Dashboard')}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
              {canApproveSpk
                ? pendingApprovalCount > 0 && <span className="notification-count">{pendingApprovalCount}</span>
                : unreadBillingNotifications.length > 0 && <span className="notification-dot" />}
            </button>
            <div className="account-menu-shell">
              <button
                aria-controls="account-menu"
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                aria-label="Menu akun"
                className="account-menu-trigger"
                onClick={() => {
                  setLogoutError('');
                  setAccountMenuOpen((open) => !open);
                }}
                type="button"
              >
                <span className="topbar-avatar">{initialsFor(activeUser.name)}</span>
              </button>
              {accountMenuOpen && <div className="account-menu" id="account-menu">
                <div className="account-menu-summary">
                  <strong>{activeUser.name}</strong>
                  <span>{activeUser.email || role}</span>
                </div>
                <button className="account-menu-item" onClick={() => {
                  setAccountMenuOpen(false);
                  setAccountProfileOpen(true);
                }} type="button">Profil Saya</button>
                <button className="account-menu-item account-menu-logout" disabled={loggingOut} onClick={logoutAccount} type="button">
                  {loggingOut ? 'Memproses…' : isAuthenticated ? 'Keluar' : 'Keluar dari demo'}
                </button>
                {logoutError && <p className="account-menu-error" role="alert">{logoutError}</p>}
              </div>}
            </div>
          </div>
        </header>

        {billingData?.business?.subscription?.status === 'expired' && activePage !== 'Aktivasi' ? (
          <section className="content activation-expired">
            <div className="activation-lock">⌛</div>
            <div className="eyebrow">MASA AKTIF BERAKHIR</div>
            <h1>Aktivasi workspace diperlukan</h1>
            <p>Masa demo atau paket usaha <strong>{workspaceName}</strong> telah berakhir. Aktivasi paket untuk membuka kembali modul operasional.</p>
            {activeUser.role === 'OWNER'
              ? <button className="button button-primary" onClick={() => openPage('Aktivasi')} type="button">Pilih paket aktivasi <span>→</span></button>
              : <p className="activation-contact">Hubungi Owner usaha untuk memperpanjang masa aktif.</p>}
          </section>
        ) : activePage === 'Aktivasi' && activeUser.role === 'OWNER' ? (
          <section className="content activation-page">
            <div className="page-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> LANGGANAN</div><h1>Aktivasi &amp; perpanjangan</h1><p>Pilih paket untuk melanjutkan penggunaan workspace {workspaceName}.</p></div></div>
            {billingError && <div className="notice error-notice" role="alert">{billingError}</div>}
            {!isAuthenticated && <div className="notice">Akun demo hanya untuk pratinjau. Masuk dengan akun Owner usaha untuk aktivasi dan pembayaran.</div>}
            {billingData?.business?.subscription && <section className="activation-status-card">
              <div><span className={`activation-status status-${billingData.business.subscription.status}`}>{billingData.business.subscription.status === 'trial' ? 'DEMO AKTIF' : billingData.business.subscription.status.toUpperCase()}</span><h2>{billingData.business.name}</h2><p>{billingData.business.subscription.status === 'trial'
                ? `Masa demo sampai ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(billingData.business.subscription.trialEndsAt))}`
                : billingData.business.subscription.status === 'lifetime'
                  ? 'Paket Lifetime aktif'
                  : `Aktif sampai ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(billingData.business.subscription.activeUntil))}`}</p></div>
              {billingData.business.subscription.status !== 'lifetime' && <strong className="activation-days">{daysUntil(billingData.business.subscription.activeUntil || billingData.business.subscription.trialEndsAt)}<small>hari tersisa</small></strong>}
            </section>}
            {billingData?.notifications?.filter((item) => !item.read_at).map((item) => <div className="notice renewal-notice" key={item.id} role="status"><strong>{item.title}</strong><span>{item.body}</span></div>)}
            <div className="section-heading activation-plans-heading"><div><h2>Pilih paket aktivasi</h2><p>Pembayaran diproses dengan aman melalui Midtrans.</p></div></div>
            <div className="activation-plan-grid">
              {activationPlans.map((plan) => <button aria-pressed={selectedPlan === plan.id} className={`activation-plan ${selectedPlan === plan.id ? 'selected' : ''} ${plan.featured ? 'featured' : ''}`} key={plan.id} onClick={() => setSelectedPlan(plan.id)} type="button">
                {plan.featured && <span className="plan-tag">{plan.id === 'lifetime' ? 'SEKALI BAYAR' : 'PALING HEMAT'}</span>}
                <span className="plan-label">{plan.label}</span><strong>{rupiah(plan.amount)}</strong><small>{plan.duration}</small>
              </button>)}
            </div>
            <div className="activation-footer">
              <p>Setelah pembayaran dinyatakan berhasil oleh Midtrans, paket aktif otomatis. Demo berlaku satu bulan sejak workspace dibuat.</p>
              <button className="button button-primary" disabled={checkoutBusy || selectedPlan === 'lifetime' && billingData?.business?.subscription?.status === 'lifetime'} onClick={beginPackageCheckout} type="button">{checkoutBusy ? 'Menghubungkan ke Midtrans…' : `Bayar ${rupiah(activationPlans.find((plan) => plan.id === selectedPlan).amount)} via Midtrans`} <span>→</span></button>
            </div>
            <p className="billing-copyright">© 2026 KelolaUsaha.store. Seluruh hak cipta dilindungi.</p>
          </section>
        ) : activePage === 'Pembukuan' && activeUser.role === 'OWNER' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">KEUANGAN <span>/</span> PEMBUKUAN</div><h1>Pembukuan &amp; laba rugi</h1><p>Catatan pemasukan dan pengeluaran usaha hanya dapat dilihat dan dikelola Owner.</p></div></div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="activation-summary-grid finance-summary-grid">
              <article className="stat-card"><div className="stat-top"><span>Total pemasukan</span><span className="stat-icon green">↗</span></div><strong>{rupiah(financeSummary.income)}</strong></article>
              <article className="stat-card"><div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon orange">↘</span></div><strong>{rupiah(financeSummary.expense)}</strong></article>
              <article className="stat-card"><div className="stat-top"><span>Laba / rugi bersih</span><span className={`stat-icon ${financeSummary.profit >= 0 ? 'blue' : 'orange'}`}>Rp</span></div><strong className={financeSummary.profit < 0 ? 'finance-loss' : ''}>{rupiah(financeSummary.profit)}</strong></article>
            </div>
            <form className="finance-entry-form" onSubmit={saveFinanceEntry}>
              <label className="field"><span>Jenis</span><select onChange={(event) => setFinanceDraft((current) => ({ ...current, type: event.target.value }))} value={financeDraft.type}><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></select></label>
              <label className="field"><span>Cabang</span><select onChange={(event) => setFinanceBranchId(event.target.value)} required value={financeBranchId}>{workspaceBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <label className="field"><span>Kategori</span><input onChange={(event) => setFinanceDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Contoh: Penjualan / Sewa" required value={financeDraft.category} /></label>
              <label className="field"><span>Keterangan</span><input onChange={(event) => setFinanceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Rincian transaksi" required value={financeDraft.description} /></label>
              <label className="field"><span>Tanggal</span><input onChange={(event) => setFinanceDraft((current) => ({ ...current, entryDate: event.target.value }))} required type="date" value={financeDraft.entryDate} /></label>
              <label className="field"><span>Nominal</span><div className="input-prefix"><span>Rp</span><input aria-label="Nominal pembukuan" min="1" onChange={(event) => setFinanceDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0" required type="number" value={financeDraft.amount} /></div></label>
              <button className="button button-primary" type="submit">Simpan catatan <span>＋</span></button>
            </form>
            <section className="table-card full-table">
              <div className="table-heading"><div><h2>Catatan usaha</h2><p>{financeEntries.length} catatan pemasukan dan pengeluaran</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>TANGGAL</th><th>CABANG</th><th>JENIS</th><th>KATEGORI</th><th>KETERANGAN</th><th>NOMINAL</th></tr></thead><tbody>
                {financeEntries.map((entry) => <tr key={entry.id}><td>{formatLedgerEntryDate(entry.entryDate)}</td><td>{entry.branchName || '—'}</td><td>{entry.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td><td>{entry.category}</td><td>{entry.description}</td><td className="amount">{entry.type === 'expense' ? '−' : '+'}{rupiah(entry.amount)}</td></tr>)}
                {!financeEntries.length && <tr><td colSpan="6">Belum ada catatan. Tambahkan pemasukan atau pengeluaran usaha.</td></tr>}
              </tbody></table></div>
            </section>
          </section>
        ) : activePage === 'Pusat Bantuan' && activeUser.role === 'PLATFORM_OWNER' ? (
          <section className="content support-page">
            <div className="page-heading"><div><div className="eyebrow">PLATFORM <span>/</span> BANTUAN</div><h1>Pusat Bantuan</h1><p>Kelola percakapan pengguna dan balas melalui aplikasi serta email.</p></div></div>
            {(supportError || supportNotice) && <div className={`notice ${supportError ? 'error-notice' : ''}`} role={supportError ? 'alert' : 'status'}>{supportError || supportNotice}</div>}
            <div className="support-layout">
              <section className="support-inbox">
                <div className="table-heading"><div><h2>Percakapan</h2><p>{supportOwnerTickets.length} tiket bantuan</p></div></div>
                <div className="support-ticket-list">
                  {supportOwnerTickets.map((ticket) => (
                    <button className={`support-ticket ${supportOwnerTicket?.id === ticket.id ? 'active' : ''}`} key={ticket.id} onClick={() => openOwnerSupportTicket(ticket.id).catch((error) => setSupportError(error.message))} type="button">
                      <div><strong>{ticket.requester_name}</strong><span className={`support-status status-${ticket.status}`}>{ticket.status === 'new' ? 'Baru' : ticket.status === 'processing' ? 'Diproses' : ticket.status === 'waiting_user' ? 'Menunggu Pengguna' : 'Selesai'}</span></div>
                      <p>{ticket.subject}</p><small>{ticket.last_message || 'Belum ada pesan'} · {ticket.message_count} pesan</small>
                    </button>
                  ))}
                  {!supportOwnerTickets.length && <div className="support-empty">Belum ada tiket bantuan.</div>}
                </div>
              </section>
              <section className="support-conversation">
                {supportOwnerTicket ? (
                  <>
                    <div className="support-conversation-header"><div><strong>{supportOwnerTicket.ticket_number}</strong><h2>{supportOwnerTicket.subject}</h2><p>{supportOwnerTicket.requester_name} · {supportOwnerTicket.requester_email}</p></div></div>
                    <div className="support-messages">
                      {supportOwnerMessages.map((message) => <article className={`support-message ${message.sender_type}`} key={message.id}><small>{message.sender_type === 'owner' ? 'Tim Support KelolaUsaha.store' : message.sender_name}</small><p>{message.body}</p><time>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.created_at))}</time></article>)}
                    </div>
                    <form className="support-reply" onSubmit={replyOwnerSupportTicket}>
                      <label className="field"><span>Status tiket</span><select value={supportOwnerStatus} onChange={(event) => setSupportOwnerStatus(event.target.value)}><option value="new">Baru</option><option value="processing">Diproses</option><option value="waiting_user">Menunggu Pengguna</option><option value="resolved">Selesai</option></select></label>
                      <label className="field"><span>Balasan</span><textarea maxLength="5000" minLength="3" required value={supportOwnerReply} onChange={(event) => setSupportOwnerReply(event.target.value)} placeholder="Tulis balasan untuk pengguna..." /></label>
                      <button className="button button-primary" disabled={supportBusy} type="submit">{supportBusy ? 'Mengirim...' : 'Kirim balasan'} <span>→</span></button>
                    </form>
                  </>
                ) : <div className="support-empty"><h2>Pilih percakapan</h2><p>Pilih tiket untuk melihat riwayat dan membalas pengguna.</p></div>}
              </section>
            </div>
          </section>
        ) : activePage === 'Pusat Bantuan' ? (
          <section className="content support-page">
            <div className="page-heading"><div><div className="eyebrow">BANTUAN <span>/</span> SUPPORT</div><h1>Pusat Bantuan KelolaUsaha</h1><p>Ajukan pertanyaan dan pantau balasan tim support.</p></div></div>
            {(supportError || supportNotice) && <div className={`notice ${supportError ? 'error-notice' : ''}`} role={supportError ? 'alert' : 'status'}>{supportError || supportNotice}</div>}
            <div className="support-layout user-support-layout">
              <aside className="support-compose">
                {!supportActiveTicket ? (
                  <form onSubmit={createSupportTicket}>
                    <h2>Mulai percakapan</h2>
                    <label className="field"><span>Nama</span><input required value={supportName} onChange={(event) => setSupportName(event.target.value)} placeholder="Nama Anda" /></label>
                    <label className="field"><span>Email</span><input required type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="nama@email.com" /></label>
                    <label className="field"><span>Pertanyaan</span><select value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)}><option>Bagaimana cara mendaftarkan usaha?</option><option>Bagaimana cara mengaktifkan paket?</option><option>Bagaimana cara menambah cabang?</option><option>Bagaimana cara mengelola pengguna?</option><option>Saya mengalami kendala pembayaran.</option><option>Pertanyaan lainnya</option></select></label>
                    <div className="support-prompts">{['Bagaimana cara mendaftarkan usaha?', 'Bagaimana cara mengaktifkan paket?', 'Saya mengalami kendala pembayaran.'].map((prompt) => <button key={prompt} type="button" onClick={() => { setSupportSubject(prompt); setSupportDraft(prompt); }}>{prompt}</button>)}</div>
                    <label className="field"><span>Pesan</span><textarea required minLength="3" maxLength="5000" value={supportDraft} onChange={(event) => setSupportDraft(event.target.value)} placeholder="Tuliskan pesan Anda..." /></label>
                    <button className="button button-primary" disabled={supportBusy} type="submit">{supportBusy ? 'Mengirim...' : 'Kirim pesan'} <span>→</span></button>
                  </form>
                ) : (
                  <>
                    <button className="text-button" type="button" onClick={() => { setSupportActiveTicket(null); setSupportMessages([]); setSupportStartNew(true); }}>← Percakapan baru</button>
                    <div className="support-ticket-summary"><strong>{supportActiveTicket.ticket_number}</strong><span>{supportActiveTicket.status}</span></div>
                  </>
                )}
                <div className="support-history-link">
                  <label className="field"><span>Email untuk riwayat percakapan</span><input type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="Email Anda" /></label>
                  <button className="button button-quiet" type="button" onClick={() => loadSupportTickets(supportEmail).catch((error) => setSupportError(error.message))}>Muat percakapan</button>
                  {supportTickets.map((ticket) => (
                    <button className="support-history-ticket" key={ticket.id} onClick={() => { setSupportStartNew(false); loadSupportConversation(ticket.id, supportEmail).catch((error) => setSupportError(error.message)); }} type="button">
                      {ticket.ticket_number} · {ticket.subject}
                    </button>
                  ))}
                </div>
              </aside>
              <section className="support-conversation">
                {supportActiveTicket ? (
                  <>
                    <div className="support-conversation-header"><div><strong>{supportActiveTicket.ticket_number}</strong><h2>{supportActiveTicket.subject}</h2></div></div>
                    <div className="support-messages">
                      {supportMessages.map((message) => <article className={`support-message ${message.sender_type}`} key={message.id}><small>{message.sender_type === 'owner' ? 'Tim KelolaUsaha.store' : 'Anda'}</small><p>{message.body}</p><time>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.created_at))}</time></article>)}
                    </div>
                    <form className="support-reply" onSubmit={sendSupportMessage}><label className="field"><span>Tuliskan pesan Anda...</span><textarea required minLength="3" maxLength="5000" value={supportDraft} onChange={(event) => setSupportDraft(event.target.value)} placeholder="Pesan lanjutan..." /></label><button className="button button-primary" disabled={supportBusy} type="submit">Kirim pesan <span>→</span></button></form>
                  </>
                ) : (
                  <div className="support-empty"><span className="support-empty-icon">?</span><h2>Halo! Ada yang bisa kami bantu?</h2><p>Riwayat tiket dan balasan terbaru tampil di sini. Silakan mulai percakapan baru atau pilih tiket dari daftar.</p></div>
                )}
              </section>
            </div>
          </section>
        ) : activePage === 'Semua Usaha' && activeUser.role === 'PLATFORM_OWNER' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">PLATFORM <span>/</span> OWNER</div><h1>Rekap semua usaha</h1><p>Pantau workspace, masa demo, aktivasi, dan pembayaran.</p></div></div>
            {platformData?.isDemo && <div className="notice" role="status">Mode pratinjau Owner — data contoh dealer motor, bukan data usaha nyata.</div>}
            {billingError && <div className="notice error-notice" role="alert">{billingError}</div>}
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="activation-summary-grid">
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Total usaha</span><span className="stat-icon blue">▥</span></div><strong>{platformData?.summary?.total ?? '—'}</strong></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Demo aktif</span><span className="stat-icon orange">◷</span></div><strong>{platformData?.summary?.trials ?? '—'}</strong></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Paket aktif</span><span className="stat-icon green">✓</span></div><strong>{platformData?.summary?.active ?? '—'}</strong></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Total pembayaran</span><span className="stat-icon purple">Rp</span></div><strong className="owner-revenue">{rupiah(platformData?.summary?.paidRevenue ?? 0)}</strong></article>
            </div>
            <section className="table-card full-table">
              <div className="table-heading"><div><h2>Semua workspace</h2><p>{platformData?.businesses?.length ?? 0} usaha terdaftar</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>NAMA USAHA</th><th>PEMILIK</th><th>JENIS USAHA</th><th>PAKET / STATUS</th><th>MASA AKTIF</th><th>PEMBAYARAN</th><th>PENDAPATAN</th><th>KUOTA CABANG</th></tr></thead><tbody>
                {(platformData?.businesses ?? []).map((business) => <tr key={business.id}>
                  <td><strong>{business.name}</strong><small>{business.user_count} pengguna</small></td><td>{business.owner_email || '—'}</td><td>{business.business_type}</td>
                  <td><span className={`activation-status status-${business.status}`}>{business.status === 'trial' ? 'DEMO' : business.status.toUpperCase()}</span><small>{activationPlans.find((plan) => plan.id === business.plan_id)?.label || 'Uji coba'}</small></td>
                  <td>{business.status === 'lifetime' ? 'Selamanya' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(business.active_until || business.trial_ends_at))}</td>
                  <td>{business.paid_order_count}</td><td className="amount">{rupiah(business.lifetime_revenue)}</td>
                  <td><div className="platform-branch-limit"><small>Aktif {business.active_branch_count} · kuota dasar {business.branch_limit} · tambahan {business.addon_branch_count}</small><div><input aria-label={`Batas cabang ${business.name}`} min="3" max="10000" onChange={(event) => setPlatformBranchLimits((current) => ({ ...current, [business.id]: event.target.value }))} type="number" value={platformBranchLimits[business.id] ?? business.branch_limit} /><button className="button button-quiet" disabled={platformBranchLimitSaving === business.id || !isAuthenticated} onClick={() => savePlatformBranchLimit(business)} type="button">{platformBranchLimitSaving === business.id ? '…' : 'Atur'}</button></div></div></td>
                </tr>)}
                {!platformData?.businesses?.length && <tr><td colSpan="8">{isAuthenticated ? 'Belum ada usaha terdaftar.' : 'Masuk sebagai Owner KelolaUsaha.store untuk melihat data semua usaha.'}</td></tr>}
              </tbody></table></div>
            </section>
            <div className="support-owner-summary">
              <section className="table-card"><div className="table-heading"><div><h2>Aktivitas workspace terbaru</h2><p>{platformData?.activity?.recentBusinesses?.length ?? 0} workspace terbaru</p></div></div><div className="table-scroll"><table><thead><tr><th>USAHA</th><th>JENIS</th><th>DIBUAT</th></tr></thead><tbody>{(platformData?.activity?.recentBusinesses ?? []).map((business) => <tr key={business.id}><td><strong>{business.name}</strong></td><td>{business.business_type}</td><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(business.created_at))}</td></tr>)}</tbody></table></div></section>
              <section className="table-card"><div className="table-heading"><div><h2>Pembayaran terbaru</h2><p>{platformData?.activity?.recentPayments?.length ?? 0} transaksi terbaru</p></div></div><div className="table-scroll"><table><thead><tr><th>USAHA</th><th>PAKET</th><th>NILAI</th><th>STATUS</th></tr></thead><tbody>{(platformData?.activity?.recentPayments ?? []).map((payment) => <tr key={payment.id}><td><strong>{payment.business_name}</strong></td><td>{payment.plan_id}</td><td className="amount">{rupiah(payment.amount)}</td><td><span className={`activation-status status-${payment.status}`}>{payment.status}</span></td></tr>)}</tbody></table></div></section>
            </div>
            <p className="billing-copyright">© 2026 KelolaUsaha.store. Data rekap hanya tersedia untuk Owner platform.</p>
          </section>
        ) : activePage === 'Profil Usaha' ? (
          <BusinessProfileSettings
            canEdit={['OWNER', 'SUPER ADMIN'].includes(activeUser.role)
              && activeUser.permissions.includes('themeManage')}
            error={businessProfileError}
            loading={businessProfileLoading}
            notice={businessProfileNotice}
            onLogoUpload={uploadBusinessLogo}
            onProfileChange={setBusinessProfile}
            onSave={saveBusinessProfile}
            profile={businessProfile}
            saving={businessProfileSaving}
            uploading={businessProfileUploading}
          />
        ) : activePage === 'Tampilan Dashboard' ? (
          <section className="content theme-settings-page">
            <div className="page-heading"><div><div className="eyebrow">PENGATURAN <span>/</span> IDENTITAS USAHA</div><h1>Tampilan Dashboard</h1><p>Sesuaikan identitas visual workspace {workspaceName}. Tema tidak mengubah data, modul, atau hak akses.</p></div></div>
            {themeNotice && <div className="notice" role="status">{themeNotice}</div>}
            {themeError && <div className="notice error-notice" role="alert">{themeError}</div>}
            {demoMode && <div className="notice">Pratinjau demo — pengaturan disimpan lokal dan tidak mengubah data perusahaan.</div>}
            <section className="theme-settings-card">
              <div className="table-heading"><div><h2>Pilih tema dashboard</h2><p>Merah Putih menjadi tema default.</p></div></div>
              <div className="theme-choice-grid">
                {dashboardThemes.map((theme, index) => <button aria-pressed={themeSettings.themeId === theme.id} className={`theme-choice ${themeSettings.themeId === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => setThemeSettings((current) => ({ ...current, themeId: theme.id, mode: theme.mode }))} type="button">
                  <span className="theme-choice-preview" style={{ '--swatch-primary': theme.primary, '--swatch-support': theme.secondary }}><i /><i /><i /><b /></span>
                  <span className="theme-choice-label"><small>{`${index + 1}`.padStart(2, '0')}</small><strong>{theme.name}</strong></span>
                </button>)}
              </div>
            </section>
            <div className="theme-options-grid">
              <section className="theme-settings-card">
                <div className="table-heading"><div><h2>Warna dashboard</h2><p>Atur warna utama dan pendukung.</p></div></div>
                <div className="theme-color-fields">
                  <label className="theme-color-field"><span>Warna utama</span><input aria-label="Warna utama" onChange={(event) => setThemeSettings((current) => ({ ...current, customPrimary: event.target.value }))} type="color" value={themeSettings.customPrimary || activeThemeColors.primary} /></label>
                  <label className="theme-color-field"><span>Warna pendukung</span><input aria-label="Warna pendukung" onChange={(event) => setThemeSettings((current) => ({ ...current, customSecondary: event.target.value }))} type="color" value={themeSettings.customSecondary || activeThemeColors.secondary} /></label>
                  <label className="field"><span>Mode tampilan</span><select onChange={(event) => setThemeSettings((current) => ({ ...current, mode: event.target.value }))} value={themeSettings.mode}><option value="light">Terang</option><option value="dark">Gelap</option></select></label>
                </div>
              </section>
              <section className="theme-settings-card">
                <div className="table-heading"><div><h2>Komponen dashboard</h2><p>Atur navigasi dan kartu ringkasan.</p></div></div>
                <div className="theme-control-fields">
                  <label className="field"><span>Tampilan sidebar</span><select onChange={(event) => setThemeSettings((current) => ({ ...current, sidebarMode: event.target.value }))} value={themeSettings.sidebarMode}><option value="wide">Lebar</option><option value="mini">Mini</option></select></label>
                  <label className="field"><span>Gaya kartu statistik</span><select onChange={(event) => setThemeSettings((current) => ({ ...current, statCardStyle: event.target.value }))} value={themeSettings.statCardStyle}><option value="shadow">Bayangan lembut</option><option value="border">Garis tegas</option><option value="soft">Latar warna</option></select></label>
                </div>
              </section>
            </div>
            <section className="theme-settings-card theme-assets-card">
              <div className="table-heading"><div><h2>Logo dan favicon</h2><p>Gunakan PNG, JPG, WebP, atau ICO maksimal 2 MB.</p></div></div>
              <div className="theme-assets-grid">
                <label className="theme-upload"><span className="theme-asset-preview">{themeSettings.logoUrl ? <img alt="Pratinjau logo usaha" src={themeSettings.logoUrl} /> : 'KU'}</span><span><strong>Logo perusahaan</strong><small>Ditampilkan di navigasi dashboard.</small></span><input accept="image/png,image/jpeg,image/webp,image/x-icon" aria-label="Unggah logo perusahaan" onChange={(event) => changeThemeAsset(event, 'logo')} type="file" /></label>
                <label className="theme-upload"><span className="theme-asset-preview favicon-preview">{themeSettings.faviconUrl ? <img alt="Pratinjau favicon" src={themeSettings.faviconUrl} /> : 'F'}</span><span><strong>Favicon</strong><small>Ikon tab browser workspace.</small></span><input accept="image/png,image/jpeg,image/webp,image/x-icon" aria-label="Unggah favicon" onChange={(event) => changeThemeAsset(event, 'favicon')} type="file" /></label>
              </div>
            </section>
            <div className="theme-save-row"><span>Pengaturan tersimpan terpisah untuk setiap perusahaan.</span><button className="button button-primary" disabled={themeSaving} onClick={saveTheme} type="button">{themeSaving ? 'Menyimpan…' : 'Simpan tampilan'} <span>→</span></button></div>
          </section>
        ) : activePage === 'Menu Digital' ? (
          <section className="content pos-page">
            <div className="page-heading"><div><div className="eyebrow">RESTORAN / KAFE <span>/</span> MENU</div><h1>Menu Digital</h1><p>Pelanggan memilih menu, mengisi identitas dan nomor meja, lalu pesanan masuk ke antrean kasir.</p></div></div>
            {notice && <div className="notice" role="status">{notice}</div>}
            {['OWNER', 'SUPER ADMIN'].includes(activeUser.role) && <section className="restaurant-qr-panel">
              <div className="table-heading"><div><h2>QR Code Menu Digital</h2><p>Buat satu QR untuk menu umum atau QR per meja dengan nomor meja otomatis.</p></div></div>
              <form className="restaurant-qr-controls" onSubmit={generateRestaurantQrCodes}>
                <label className="field"><span>Pilihan QR</span><select aria-label="Jenis QR menu" onChange={(event) => setRestaurantQrMode(event.target.value)} value={restaurantQrMode}><option value="general">Satu QR menu umum</option><option value="tables">QR untuk setiap meja</option></select></label>
                {restaurantQrMode === 'tables' && <label className="field"><span>Jumlah meja</span><input aria-label="Jumlah meja" max="100" min="1" onChange={(event) => setRestaurantQrTableCount(event.target.value)} required type="number" value={restaurantQrTableCount} /></label>}
                <button className="button button-primary" disabled={restaurantQrBusy} type="submit">{restaurantQrBusy ? 'Membuat QR…' : 'Buat QR Code'} <span>→</span></button>
              </form>
              <p className="restaurant-qr-note">QR membuka tautan menu digital untuk workspace {workspaceName}. QR meja otomatis mengisi nomor meja pada pesanan.</p>
              {restaurantQrCodes.length > 0 && <div className="restaurant-qr-grid">
                {restaurantQrCodes.map((code) => <article className="restaurant-qr-card" key={code.tableNumber || code.url}>
                  <img alt={code.tableNumber ? `QR menu meja ${code.tableNumber}` : 'QR menu umum'} src={code.dataUrl} />
                  <strong>{code.tableNumber ? `Meja ${code.tableNumber}` : 'Menu umum'}</strong>
                  <div><a className="button button-quiet" download={`menu-digital-${code.tableNumber ? `meja-${code.tableNumber}` : 'umum'}.svg`} href={code.dataUrl}>Unduh SVG</a><a href={code.url} rel="noreferrer" target="_blank">Buka menu</a></div>
                </article>)}
              </div>}
              <small className="restaurant-qr-demo-note">Pemesanan QR ini tersimpan lokal di browser demo. Untuk menerima pesanan lintas perangkat, hubungkan menu dan antrean ke penyimpanan server.</small>
            </section>}
            <div className="digital-order-layout">
              <section className="pos-catalog">
                <div className="table-heading"><div><h2>Daftar menu</h2><p>Pilih menu dan atur jumlah pesanan</p></div></div>
                <div className="pos-product-grid">
                  {priceItems.map((item) => (
                    <button className="pos-product" key={item.id} onClick={() => addToCart(item)} type="button">
                      <span className="pos-product-icon">+</span>
                      <strong>{item.name}</strong>
                      <small>{rupiah(item.price)} / {item.unit}</small>
                    </button>
                  ))}
                  {!priceItems.length && <p className="pos-empty">Menu belum tersedia. Tambahkan produk melalui Daftar Harga.</p>}
                </div>
              </section>
              <form className="pos-cart digital-order-form" onSubmit={submitRestaurantOrder}>
                <div className="table-heading"><div><h2>Pesanan Anda</h2><p>{cart.length} jenis menu</p></div><button className="text-button" onClick={() => setCart([])} type="button">Kosongkan</button></div>
                <div className="pos-cart-items">
                  {cart.map((item) => <div className="pos-cart-row" key={item.id}>
                    <div><strong>{item.name}</strong><small>{rupiah(item.price)} / {item.unit}</small></div>
                    <div className="pos-quantity"><button aria-label={`Kurangi ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)} type="button">−</button><span>{item.quantity}</span><button aria-label={`Tambah ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} type="button">+</button></div>
                    <strong className="pos-line-total">{rupiah(item.price * item.quantity)}</strong>
                  </div>)}
                  {!cart.length && <p className="pos-empty">Pilih menu untuk mulai memesan.</p>}
                </div>
                <div className="pos-customer-fields">
                  <label className="field"><span>Nama pemesan</span><input autoComplete="name" onChange={(event) => setPosCustomer(event.target.value)} placeholder="Nama Anda" required value={posCustomer} /></label>
                  <label className="field"><span>Nomor HP / WhatsApp</span><input autoComplete="tel" onChange={(event) => setPosWhatsApp(event.target.value)} placeholder="08xxxxxxxxxx" required type="tel" value={posWhatsApp} /></label>
                  <label className="field"><span>Nomor meja</span><input aria-label="Nomor meja" onChange={(event) => setPosTableNumber(event.target.value)} placeholder="Contoh: 05" required value={posTableNumber} /></label>
                  <label className="field"><span>Waktu pembayaran</span><select onChange={(event) => setOrderPaymentTiming(event.target.value)} value={orderPaymentTiming}><option>Bayar di awal</option><option>Nanti di kasir</option></select></label>
                  <label className="field"><span>Catatan khusus (opsional)</span><textarea maxLength="500" onChange={(event) => setOrderSpecialNotes(event.target.value)} placeholder="Contoh: tanpa bawang" rows="3" value={orderSpecialNotes} /></label>
                </div>
                <div className="pos-total-row"><span>Total pesanan</span><strong>{rupiah(cartTotal)}</strong></div>
                <button className="button button-primary pos-submit" disabled={!cart.length} type="submit">Kirim pesanan ke kasir <span>→</span></button>
                <small className="pos-demo-note">Pembayaran dikonfirmasi oleh kasir. Pesanan demo tersimpan sementara di sesi ini.</small>
              </form>
            </div>
          </section>
        ) : activePage === 'Pesanan' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">RESTORAN / KAFE <span>/</span> OPERASIONAL</div><h1>Pesanan</h1><p>Alur: persetujuan kasir → dapur → siap diantar waiter → selesai.</p></div><button className="button button-primary" onClick={() => openPage('Menu Digital')} type="button">＋ Buat pesanan</button></div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="restaurant-order-list">
              {restaurantOrders.map((order) => <article className="restaurant-order-card" key={order.receiptNumber}>
                <div className="restaurant-order-heading">
                  <div><span className="spk-id">{order.receiptNumber}</span><h2>{order.customer} · Meja {order.tableNumber}</h2><p>{order.whatsapp} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</p></div>
                  <div className="restaurant-order-badges"><span className="order-status-badge">{order.orderStatus}</span><span className={`order-payment-badge ${order.paymentStatus === 'LUNAS' ? 'paid' : ''}`}>{order.paymentStatus}</span></div>
                </div>
                <div className="restaurant-order-items">{order.items.map((item) => <span key={item.id}>{item.name} × {item.quantity}</span>)}</div>
                {order.specialNotes && <p className="restaurant-order-note"><strong>Catatan khusus:</strong> {order.specialNotes}</p>}
                <div className="restaurant-order-footer"><span>{order.paymentTiming} · <strong>{rupiah(order.total)}</strong></span><div className="restaurant-order-actions">
                  {order.orderStatus === 'MENUNGGU APPROVAL KASIR' && <button className="button button-primary" onClick={() => approveRestaurantOrder(order)} type="button">Setujui &amp; kirim ke dapur</button>}
                  {order.orderStatus === 'DIPROSES DAPUR' && <button className="button button-primary" onClick={() => updateRestaurantOrderStatus(order.receiptNumber, 'SIAP DIANTAR')} type="button">Dapur: tandai siap</button>}
                  {order.orderStatus === 'SIAP DIANTAR' && <button className="button button-primary" onClick={() => updateRestaurantOrderStatus(order.receiptNumber, 'SELESAI')} type="button">Waiter: tandai diantar</button>}
                  {order.paymentStatus !== 'LUNAS' && <button className="button button-quiet" onClick={() => markRestaurantOrderPaid(order.receiptNumber)} type="button">Konfirmasi pembayaran lunas</button>}
                </div></div>
              </article>)}
              {!restaurantOrders.length && <section className="table-card receipt-empty"><h2>Belum ada pesanan</h2><p>Pesanan dari Menu Digital akan muncul di antrean ini.</p><button className="button button-primary" onClick={() => openPage('Menu Digital')} type="button">Buka Menu Digital <span>→</span></button></section>}
            </div>
          </section>
        ) : activePage === 'Kasir' ? (
          <section className="content pos-page">
            <div className="page-heading">
              <div><div className="eyebrow">OPERASIONAL <span>/</span> POS</div><h1>Kasir</h1><p>Catat penjualan {businessTypes[businessType].label.toLowerCase()} dan siapkan nota untuk pelanggan.</p></div>
              <span className="pos-cashier">Kasir: {activeUser.name}</span>
            </div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="pos-layout">
              <section className="pos-catalog">
                <div className="table-heading"><div><h2>Produk &amp; jasa</h2><p>Pilih item untuk menambahkannya ke transaksi</p></div></div>
                <div className="pos-product-grid">
                  {priceItems.map((item) => <button className="pos-product" key={item.id} onClick={() => addToCart(item)} type="button">
                    <span className="pos-product-icon">＋</span><strong>{item.name}</strong><small>{rupiah(item.price)} / {item.unit}</small>
                  </button>)}
                  {priceItems.length === 0 && <p className="pos-empty">Belum ada harga. Tambahkan produk atau jasa melalui menu Daftar Harga.</p>}
                </div>
              </section>
              <form className="pos-cart" onSubmit={savePosTransaction}>
                <div className="table-heading"><div><h2>Transaksi baru</h2><p>{cart.length} jenis item</p></div><button className="text-button" onClick={() => setCart([])} type="button">Kosongkan</button></div>
                <div className="pos-cart-items">
                  {cart.map((item) => <div className="pos-cart-row" key={item.id}>
                    <div><strong>{item.name}</strong><small>{rupiah(item.price)} / {item.unit}</small></div>
                    <div className="pos-quantity"><button aria-label={`Kurangi ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)} type="button">−</button><span>{item.quantity}</span><button aria-label={`Tambah ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} type="button">+</button></div>
                    <strong className="pos-line-total">{rupiah(item.price * item.quantity)}</strong>
                  </div>)}
                  {cart.length === 0 && <p className="pos-empty">Pilih produk atau jasa untuk mulai membuat transaksi.</p>}
                </div>
                <div className="pos-customer-fields">
                  <label className="field"><span>Nama pelanggan</span><input onChange={(event) => setPosCustomer(event.target.value)} placeholder="Pelanggan umum" value={posCustomer} /></label>
                  <label className="field"><span>Nomor WhatsApp</span><input autoComplete="tel" onChange={(event) => setPosWhatsApp(event.target.value)} placeholder="08xxxxxxxxxx" required type="tel" value={posWhatsApp} /></label>
                  <div className="form-grid two-columns">
                    <label className="field"><span>Metode pembayaran</span><select onChange={(event) => setPosPaymentMethod(event.target.value)} value={posPaymentMethod}><option>Tunai</option><option>Transfer</option><option>QRIS</option><option>Kartu</option><option>Hutang</option></select></label>
                    <label className="field"><span>Jumlah dibayar</span><div className="input-prefix"><span>Rp</span><input aria-label="Jumlah dibayar" min="0" onChange={(event) => setPosAmountPaid(event.target.value)} placeholder="0" type="number" value={posAmountPaid} /></div></label>
                  </div>
                </div>
                <div className="pos-total-row"><span>Total</span><strong>{rupiah(cartTotal)}</strong></div>
                <div className="pos-total-row pos-change"><span>Kembalian</span><strong>{rupiah(changeDue)}</strong></div>
                <button className="button button-primary pos-submit" disabled={!cart.length} type="submit">Simpan transaksi &amp; buat nota <span>→</span></button>
                <small className="pos-demo-note">Data demo ini tersimpan sementara selama aplikasi dibuka.</small>
              </form>
            </div>
          </section>
        ) : activePage === 'Daftar Harga' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">OPERASIONAL <span>/</span> KATALOG</div><h1>Daftar Harga</h1><p>Atur harga produk atau jasa untuk workspace {workspaceName}.</p></div></div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <form className="price-create-form" onSubmit={addPriceItem}>
              <label className="field"><span>Nama produk / jasa</span><input onChange={(event) => setPriceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Cuci komplit reguler" required value={priceDraft.name} /></label>
              <label className="field"><span>Satuan</span><input onChange={(event) => setPriceDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="kg, pcs, layanan" required value={priceDraft.unit} /></label>
              <label className="field"><span>Harga</span><div className="input-prefix"><span>Rp</span><input aria-label="Harga" min="1" onChange={(event) => setPriceDraft((current) => ({ ...current, price: event.target.value }))} placeholder="0" required type="number" value={priceDraft.price} /></div></label>
              <button className="button button-primary" type="submit">Tambah harga <span>＋</span></button>
            </form>
            <section className="table-card full-table">
              <div className="table-heading"><div><h2>Produk &amp; jasa aktif</h2><p>{priceItems.length} item dalam katalog</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>NAMA</th><th>SATUAN</th><th>HARGA JUAL</th></tr></thead><tbody>
                {priceItems.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.unit}</td><td className="amount">{rupiah(item.price)}</td></tr>)}
                {!priceItems.length && <tr><td colSpan="3">Belum ada produk atau jasa.</td></tr>}
              </tbody></table></div>
            </section>
            <p className="pos-demo-note">Katalog demo ini disimpan sementara di browser dan belum tersinkron ke database.</p>
          </section>
        ) : activePage === 'Transaksi' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">OPERASIONAL <span>/</span> PENJUALAN</div><h1>Transaksi</h1><p>Riwayat transaksi kasir workspace {workspaceName}.</p></div><button className="button button-primary" onClick={() => openPage('Kasir')} type="button">＋ Transaksi baru</button></div>
            <section className="table-card full-table">
              <div className="table-heading"><div><h2>Riwayat transaksi POS</h2><p>{posTransactions.length} transaksi dalam sesi demo</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>NO. NOTA</th><th>PELANGGAN</th><th>TANGGAL</th><th>METODE</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>
                {posTransactions.map((transaction) => <tr key={transaction.receiptNumber}><td><strong className="spk-id">{transaction.receiptNumber}</strong></td><td>{transaction.customer}</td><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(transaction.createdAt))}</td><td>{transaction.paymentMethod}</td><td className="amount">{rupiah(transaction.total)}</td><td><span className={`status-badge ${transaction.paymentStatus === 'LUNAS' ? 'selesai' : 'submitted'}`}><span />{transaction.paymentStatus}</span></td></tr>)}
                {!posTransactions.length && <tr><td colSpan="6">Belum ada transaksi. Buat transaksi pertama melalui menu Kasir.</td></tr>}
              </tbody></table></div>
            </section>
          </section>
        ) : activePage === 'Nota Digital' ? (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">OPERASIONAL <span>/</span> NOTA</div><h1>Nota Digital</h1><p>Cetak atau bagikan nota POS dan kwitansi pembelian motor dari SPK.</p></div></div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="receipt-list">
              {motorReceipts.map((receipt) => <article className="motor-receipt" data-printing={printingMotorReceipt === receipt.receiptNumber} key={receipt.receiptNumber}>
                <header className="motor-receipt-header">
                  <div className="motor-receipt-business">
                    {themeSettings.logoUrl
                      ? <img alt="" src={themeSettings.logoUrl} />
                      : <span className="motor-receipt-mark">KU</span>}
                    <strong>{workspaceName}</strong>
                  </div>
                  <div className="motor-receipt-title"><h2>KWITANSI</h2><strong>{receipt.receiptNumber}</strong><small>SPK {receipt.spkNumber}</small></div>
                  <div className="motor-receipt-date"><strong>Tgl</strong><span>{receipt.dateLabel}</span><small>No. {receipt.receiptNumber}</small></div>
                </header>
                <div className="motor-receipt-row"><strong>Terima dari</strong><span>:</span><span>{receipt.customer}</span></div>
                <div className="motor-receipt-row motor-receipt-words"><strong>Jumlah uang</strong><span>:</span><em>{terbilangRupiah(receipt.amount)}</em></div>
                <div className="motor-receipt-row"><strong>Untuk pembayaran</strong><span>:</span><span>Sepeda motor {receipt.motor}</span></div>
                <div className="motor-receipt-vehicle">
                  {[
                    ['Type / Jenis', receipt.motor],
                    ['No. Rangka', receipt.frameNumber],
                    ['No. Mesin', receipt.engineNumber],
                    ['Tahun', receipt.year],
                    ['Warna', receipt.color],
                    ['Atas nama STNK', receipt.stnkName],
                    ['Alamat', receipt.address],
                  ].map(([label, value]) => <div className="motor-receipt-row" key={label}><span>{label}</span><span>:</span><span>{value || '—'}</span></div>)}
                </div>
                <div className="motor-receipt-row motor-receipt-note"><strong>Keterangan</strong><span>:</span><span>{receipt.note}</span></div>
                <div className="motor-receipt-footer">
                  <strong className="motor-receipt-amount">{rupiah(receipt.amount)}</strong>
                  <span>{receipt.city}, {receipt.dateLabel}</span>
                </div>
                <div className="motor-receipt-validity">Kwitansi dianggap sah apabila pembayaran telah diterima.</div>
                <div className="motor-receipt-signature"><span>Pembeli</span><span>Penerima</span></div>
                <div className="receipt-actions">
                  <button className="button button-quiet receipt-print" onClick={() => printMotorReceipt(receipt.receiptNumber)} type="button">Cetak kwitansi</button>
                  {getMotorReceiptWhatsappUrl(receipt)
                    ? <a className="button button-primary receipt-share" href={getMotorReceiptWhatsappUrl(receipt)} rel="noreferrer" target="_blank">Kirim kwitansi via WhatsApp <span>→</span></a>
                    : <p className="receipt-warning" role="status">Nomor WhatsApp tidak valid; kwitansi belum dapat dibagikan.</p>}
                </div>
              </article>)}
              {posTransactions.map((transaction) => <article className="pos-receipt" data-printing={printingReceipt === transaction.receiptNumber} key={transaction.receiptNumber}>
                <div className="receipt-heading"><div><span className="receipt-status">{transaction.paymentStatus}</span><h2>{workspaceName}</h2><p>No. Nota: {transaction.receiptNumber}</p></div><span className="receipt-mark">KU</span></div>
                <div className="receipt-customer"><span>Pelanggan</span><strong>{transaction.customer}</strong>{transaction.tableNumber && <small>Meja {transaction.tableNumber} · {transaction.paymentTiming}</small>}<small>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(transaction.createdAt))}</small></div>
                <div className="receipt-lines">{transaction.items.map((item) => <div className="receipt-line" key={item.id}><span>{item.name}<small>{item.quantity} {item.unit} × {rupiah(item.price)}</small></span><strong>{rupiah(item.quantity * item.price)}</strong></div>)}</div>
                <div className="receipt-total"><span>Total pembayaran</span><strong>{rupiah(transaction.total)}</strong></div>
                {transaction.specialNotes && <p className="receipt-special-notes"><strong>Catatan:</strong> {transaction.specialNotes}</p>}
                <p className="receipt-thanks">Terima kasih telah mempercayakan kebutuhan Anda kepada kami.</p>
                <div className="receipt-actions">
                  <button className="button button-quiet receipt-print" onClick={() => printPosReceipt(transaction.receiptNumber)} type="button">Cetak nota</button>
                  {getWhatsAppReceiptUrl(transaction)
                    ? <a className="button button-primary receipt-share" href={getWhatsAppReceiptUrl(transaction)} rel="noreferrer" target="_blank">Bagikan nota via WhatsApp <span>→</span></a>
                    : <p className="receipt-warning" role="status">Nomor WhatsApp tidak valid; nota belum dapat dibagikan.</p>}
                </div>
              </article>)}
              {!posTransactions.length && !motorReceipts.length && <section className="table-card receipt-empty"><h2>Belum ada nota</h2><p>Simpan transaksi Kasir atau submit SPK untuk membuat nota digital dan kwitansi pembelian motor.</p><button className="button button-primary" onClick={() => openPage('Kasir')} type="button">Buka kasir <span>→</span></button></section>}
            </div>
            <p className="pos-demo-note">Kwitansi motor dibuat otomatis saat SPK disubmit. Nota dan transaksi pada demo ini hanya tersedia selama sesi browser.</p>
          </section>
        ) : ['Semua Unit', 'Unit Dealer', 'Motor', 'Unit & Motor'].includes(activePage) ? (
          <DealerMotorWorkspace
            branches={workspaceBranches}
            canManage={isAuthenticated && activeUser.permissions.includes('unitManage')}
            movements={dealerMotorMovements}
            notice={notice}
            onCreate={async (unit) => {
              if (!isAuthenticated) throw new Error('Masuk ke workspace untuk menyimpan stok motor.');
              const response = await fetch('/api/dealer-motor/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unit),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.message || 'Unit motor tidak dapat disimpan.');
              if (!result.unit?.id || !result.movement?.id) throw new Error('Data unit motor dari server tidak valid.');
              setDealerMotorUnits((current) => [result.unit, ...current]);
              setDealerMotorMovements((current) => [result.movement, ...current]);
              setNotice('Unit motor berhasil disimpan ke stok cabang.');
            }}
            units={dealerMotorUnits}
          />
        ) : activePage === 'Pengiriman' ? (
          <DriverDeliveryWorkspace isAuthenticated={isAuthenticated} notice={notice} />
        ) : activePage === 'Input SPK' ? (
          <section className="content form-page">
            <div className="page-heading form-heading">
              <div>
                <div className="eyebrow">MANAJEMEN PENJUALAN <span>/</span> SPK BARU</div>
                <h1>Input SPK</h1>
                <p>Lengkapi informasi penjualan untuk membuat surat pemesanan kendaraan.</p>
              </div>
              <button className="button button-quiet" onClick={() => openPage('Dashboard')} type="button">← Kembali</button>
            </div>

            <form className="spk-form" onSubmit={(event) => {
              event.preventDefault();
              saveSpk('SUBMITTED');
            }}>
              <div className="form-section">
                <div className="section-title"><span className="section-number">01</span><div><h2>Informasi SPK</h2><p>Informasi dasar pengajuan penjualan</p></div></div>
                <div className="form-grid four-columns">
                    <label className="field"><span>Nomor SPK</span><input aria-label="Nomor SPK" disabled value="Otomatis saat disimpan" /></label>
                  <label className="field"><span>Tanggal SPK <i>*</i></span><input name="date" onChange={updateForm} required type="date" value={form.date} /></label>
                  <label className="field"><span>Unit motor dari stok <i>*</i></span><select name="unitId" onChange={(event) => {
                    const selected = dealerMotorUnits.find((unit) => unit.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      unitId: event.target.value,
                      unit: selected?.branchName || '',
                      motor: selected ? `${selected.brand} ${selected.model}` : '',
                      type: selected?.specification || '',
                      color: selected?.color || '',
                      frameNumber: selected?.frameNumber || '',
                      engineNumber: selected?.engineNumber || '',
                      year: selected ? String(selected.modelYear) : '',
                      otr: selected ? String(selected.otrPrice) : '',
                    }));
                  }} required value={form.unitId}><option value="">Pilih unit tersedia</option>{dealerMotorUnits.filter((unit) => unit.stockStatus === 'available').map((unit) => <option key={unit.id} value={unit.id}>{unit.branchName} · {unit.brand} {unit.model} {unit.specification} · {unit.color} · {unit.frameNumber}</option>)}</select></label>
                  <label className="field"><span>Sales <i>*</i></span>{activeUser.role === 'SALES'
                    ? <input autoComplete="name" readOnly required value={activeUser.name} />
                    : <input autoComplete="name" maxLength="120" name="sales" onChange={updateForm} placeholder="Nama sales" required value={form.sales} />}</label>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><span className="section-number">02</span><div><h2>Data customer</h2><p>Identitas dan kontak pelanggan</p></div></div>
                <div className="form-grid four-columns">
                  <label className="field"><span>NIK <i>*</i></span><input autoComplete="off" inputMode="numeric" maxLength="16" name="nik" onChange={updateForm} pattern="[0-9]{16}" placeholder="Masukkan 16 digit NIK" required value={form.nik} /></label>
                  <label className="field"><span>Nama lengkap <i>*</i></span><input autoComplete="name" name="customer" onChange={updateForm} placeholder="Nama sesuai KTP" required value={form.customer} /></label>
                  <label className="field"><span>Nomor WhatsApp <i>*</i></span><input autoComplete="tel" name="whatsapp" onChange={updateForm} placeholder="08xxxxxxxxxx" required type="tel" value={form.whatsapp} /></label>
                  <label className="field"><span>Alamat <i>*</i></span><input autoComplete="street-address" name="address" onChange={updateForm} placeholder="Alamat lengkap customer" required value={form.address} /></label>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><span className="section-number">03</span><div><h2>Data kendaraan</h2><p>Pilih motor dan detail unit yang dipesan</p></div></div>
                <div className="form-grid four-columns">
                  <label className="field"><span>Model motor</span><input name="motor" readOnly value={form.motor} /></label>
                  <label className="field"><span>Tipe / spesifikasi</span><input name="type" readOnly value={form.type} /></label>
                  <label className="field"><span>Warna</span><input name="color" readOnly value={form.color} /></label>
                  <label className="field"><span>Harga OTR <i>*</i></span><div className="input-prefix"><span>Rp</span><input min="0" name="otr" readOnly required type="number" value={form.otr} /></div></label>
                  <label className="field"><span>Tahun</span><input name="year" readOnly value={form.year} /></label>
                  <label className="field"><span>No. rangka</span><input name="frameNumber" readOnly value={form.frameNumber} /></label>
                  <label className="field"><span>No. mesin</span><input name="engineNumber" readOnly value={form.engineNumber} /></label>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><span className="section-number">04</span><div><h2>Pembayaran &amp; promo</h2><p>Atur metode pembayaran serta penawaran</p></div></div>
                <div className="payment-toggle" role="group" aria-label="Metode pembayaran">
                  {['CASH', 'CREDIT'].map((type) => <button className={paymentType === type ? 'selected' : ''} key={type} onClick={() => setPaymentType(type)} type="button">{type === 'CASH' ? 'Tunai / Cash' : 'Kredit / Credit'}</button>)}
                </div>
                <div className="form-grid four-columns payment-fields">
                  {paymentType === 'CREDIT' && <>
                    <label className="field"><span>Leasing <i>*</i></span><select name="leasing" onChange={updateForm} required value={form.leasing}><option value="">Pilih leasing</option><option>FIFGROUP</option><option>Adira Finance</option><option>WOM Finance</option><option>OTO Finance</option></select></label>
                    <label className="field"><span>DP <i>*</i></span><div className="input-prefix"><span>Rp</span><input min="0" name="dp" onChange={updateForm} placeholder="0" required type="number" value={form.dp} /></div></label>
                    <label className="field"><span>Tenor</span><select name="tenor" onChange={updateForm} value={form.tenor}><option value="">Pilih tenor</option><option>11 bulan</option><option>23 bulan</option><option>35 bulan</option><option>47 bulan</option></select></label>
                    <label className="field"><span>Angsuran / bulan</span><div className="input-prefix"><span>Rp</span><input min="0" name="installment" onChange={updateForm} placeholder="0" type="number" value={form.installment} /></div></label>
                  </>}
                  <label className="field"><span>Jumlah uang diterima / kwitansi <i>*</i></span><div className="input-prefix"><span>Rp</span><input aria-label="Jumlah uang diterima kwitansi" min="1" name="receiptAmount" onChange={updateForm} placeholder="0" required type="number" value={form.receiptAmount} /></div></label>
                  <label className="field"><span>Promo</span><select name="promo" onChange={updateForm} value={form.promo}><option value="">Tanpa promo</option><option>Promo Akhir Tahun</option><option>Potongan DP</option><option>Gratis servis</option></select></label>
                  <label className="field"><span>Diskon</span><div className="input-prefix"><span>Rp</span><input min="0" name="discount" onChange={updateForm} placeholder="0" type="number" value={form.discount} /></div></label>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><span className="section-number">05</span><div><h2>Data kwitansi pembeli</h2><p>Informasi yang akan tercetak pada bukti pembayaran motor</p></div></div>
                <div className="form-grid four-columns">
                  <label className="field"><span>Kota penerbit kwitansi <i>*</i></span><input autoComplete="address-level2" name="receiptCity" onChange={updateForm} placeholder="Contoh: Bojonegoro" required value={form.receiptCity} /></label>
                  <label className="field"><span>Atas nama STNK</span><input autoComplete="name" name="stnkName" onChange={updateForm} placeholder={form.customer || 'Nama pemilik STNK'} value={form.stnkName} /></label>
                  <label className="field"><span>Tahun kendaraan</span><input name="year" readOnly value={form.year} /></label>
                  <label className="field"><span>No. rangka</span><input autoComplete="off" name="frameNumber" readOnly value={form.frameNumber} /></label>
                  <label className="field"><span>No. mesin</span><input autoComplete="off" name="engineNumber" readOnly value={form.engineNumber} /></label>
                  <label className="field"><span>Keterangan kwitansi</span><input maxLength="200" name="receiptNote" onChange={updateForm} placeholder={`Pembayaran ${form.customer || 'pembeli'}`} value={form.receiptNote} /></label>
                </div>
              </div>

              <div className="form-section documents-section">
                <div className="section-title"><span className="section-number">06</span><div><h2>Dokumen customer</h2><p>Unggah dokumen pendukung pengajuan SPK</p></div></div>
                <div className="upload-grid">
                  {['KTP', 'Kartu Keluarga', 'Dokumen lainnya'].map((label) => <label className="upload-box" key={label}><input accept="image/*,.pdf" type="file" /><span className="upload-symbol">↑</span><span><strong>{label}</strong><small>PDF atau gambar, maks. 5 MB</small></span><span className="upload-action">Pilih file</span></label>)}
                </div>
              </div>

              <div className="form-footer"><span><i>*</i> Wajib diisi untuk submit SPK</span><div><button className="button button-quiet" onClick={() => saveSpk('DRAFT')} type="button">Simpan draft</button><button className="button button-primary" type="submit">Submit SPK <span aria-hidden="true">→</span></button></div></div>
            </form>
          </section>
        ) : activePage === 'Pengelolaan Akses' ? (
          <section className="content">
            <div className="page-heading access-heading">
              <div><div className="eyebrow">ADMINISTRASI <span>/</span> KEAMANAN</div><h1>Pengelolaan Akses</h1><p>Atur hak akses secara individual untuk setiap pengguna Dealer WAM.</p></div>
            </div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <div className="access-summary">
              <div className="access-summary-icon">♙</div>
              <div><strong>Akses per pengguna</strong><p>Hak akses tiap akun dapat disesuaikan satu per satu, terpisah dari peran pengguna.</p></div>
              <span className="access-summary-count">{users.filter((user) => user.active).length} AKTIF</span>
            </div>
            <section className="table-card access-table">
              <div className="table-heading"><div><h2>Pengguna &amp; hak akses</h2><p>{users.length} pengguna terdaftar</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>PENGGUNA</th><th>PERAN</th><th>HAK AKSES</th><th>STATUS</th><th /></tr></thead><tbody>
                {users.map((user) => <tr key={user.id}>
                  <td><div className="user-cell"><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
                  <td><span className={`role-badge role-${user.role.toLowerCase().replaceAll(' ', '-')}`}>{user.role}</span></td>
                  <td><span className="permission-count">{user.permissions.length} modul diizinkan</span></td>
                  <td><span className={`user-status ${user.active ? 'enabled' : 'disabled'}`}><span />{user.approvalStatus === 'pending' ? 'Menunggu persetujuan' : user.active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>{(activeUser.role === 'OWNER' || !['OWNER', 'PLATFORM_OWNER'].includes(user.role)) && <button aria-label={`Atur akses ${user.name}`} className="button button-quiet access-edit-button" onClick={() => editUserAccess(user)} type="button">Atur akses</button>}</td>
                </tr>)}
              </tbody></table></div>
            </section>
            {accessDraft && <div className="access-modal-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setAccessDraft(null);
            }}>
              <section aria-labelledby="access-modal-title" aria-modal="true" className="access-modal" role="dialog">
                <div className="access-modal-header"><div><div className="eyebrow">PENGATURAN PENGGUNA</div><h2 id="access-modal-title">Atur akses pengguna</h2><p>{accessDraft.name} · {accessDraft.email}</p></div><button aria-label="Tutup pengaturan akses" className="modal-close" onClick={() => setAccessDraft(null)} type="button">×</button></div>
                <div className="access-modal-body">
                  <div className="access-user-settings">
                    <label className="field"><span>Peran pengguna</span><select onChange={(event) => setAccessDraft((current) => ({ ...current, role: event.target.value }))} value={accessDraft.role}>{(activeUser.role === 'OWNER' ? ['SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER'] : ['HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER', ...(accessDraft.role === 'SUPER ADMIN' ? ['SUPER ADMIN'] : [])]).map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label className="access-active-control"><span><strong>Akun aktif</strong><small>Pengguna dapat mengakses sistem</small></span><input checked={accessDraft.active} onChange={(event) => setAccessDraft((current) => ({ ...current, active: event.target.checked }))} type="checkbox" /><span className="switch-track" /></label>
                  </div>
                  <div className="permission-heading"><div><h3>Hak akses individual</h3><p>Pilih modul yang boleh diakses pengguna ini.</p></div><button className="reset-permissions" onClick={() => setAccessDraft((current) => ({ ...current, permissions: [...rolePermissions[current.role]] }))} type="button">Gunakan akses standar {accessDraft.role}</button></div>
                  <div className="permission-list">{accessModules.map((module) => <label className="permission-row" key={module.id}>
                    <span><strong>{module.label}</strong><small>{module.group}</small></span>
                    <input checked={accessDraft.permissions.includes(module.id)} disabled={accessDraft.role === 'SUPER ADMIN' && superAdminRestrictedPermissions.includes(module.id)} onChange={() => togglePermission(module.id)} type="checkbox" />
                    <span className="switch-track" />
                  </label>)}</div>
                </div>
                <div className="access-modal-footer"><button className="button button-quiet" onClick={() => setAccessDraft(null)} type="button">Batal</button><button className="button button-primary" onClick={saveUserAccess} type="button">Simpan perubahan</button></div>
              </section>
            </div>}
          </section>
        ) : activePage === 'User Management' ? (
          <section className="content">
            <div className="page-heading access-heading">
              <div><div className="eyebrow">WORKSPACE <span>/</span> TIM USAHA</div><h1>Manajemen karyawan</h1><p>Bagikan link workspace {workspaceName} atau buat link pendaftaran khusus berdasarkan peran.</p></div>
            </div>
            {notice && <div className="notice" role="status">{notice}</div>}
            {workspaceUrl && <label className="invite-link-field"><span>Link workspace untuk karyawan</span><input aria-label="Link workspace untuk karyawan" readOnly value={workspaceUrl} onFocus={(event) => event.target.select()} /></label>}
            {['OWNER', 'SUPER ADMIN'].includes(activeUser.role) && <section className="invite-card">
              <div><span className="invite-card-icon">＋</span><div><h2>{activeUser.role === 'OWNER' ? 'Undang Super Admin atau karyawan' : 'Undang karyawan'}</h2><p>{activeUser.role === 'OWNER' ? 'Pendaftaran melalui link peran diverifikasi dengan OTP dan menunggu persetujuan.' : 'Super Admin hanya dapat membuat undangan tim operasional.'}</p></div></div>
              <form className="invite-form" onSubmit={createEmployeeInvite}>
                <label className="field"><span>Peran undangan</span><select aria-label="Peran karyawan" onChange={(event) => setInviteRole(event.target.value)} value={inviteRole}>{(activeUser.role === 'OWNER' ? ['SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER'] : ['HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR', 'DRIVER']).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="field"><span>Cabang penempatan</span><select aria-label="Cabang karyawan" onChange={(event) => setInviteBranchId(event.target.value)} value={inviteBranchId}><option value="">Cabang utama otomatis</option>{workspaceBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
                <button className="button button-primary" disabled={inviting} type="submit">{inviting ? 'Membuat link…' : 'Buat link pendaftaran'} <span>→</span></button>
              </form>
              {inviteUrl && <label className="invite-link-field"><span>Link pendaftaran karyawan</span><input aria-label="Link pendaftaran karyawan" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /></label>}
            </section>}
            <section className="table-card access-table">
              <div className="table-heading"><div><h2>Pengguna workspace</h2><p>{users.length} pengguna terdaftar</p></div></div>
              <div className="table-scroll"><table><thead><tr><th>PENGGUNA</th><th>EMAIL</th><th>PERAN</th><th>STATUS</th><th /></tr></thead><tbody>
                {users.map((user) => <tr key={user.id}>
                  <td><div className="user-cell"><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{user.name}</strong></div></td>
                  <td>{user.email}</td>
                  <td><span className={`role-badge role-${user.role.toLowerCase().replaceAll(' ', '-')}`}>{user.role}</span></td>
                  <td><span className={`user-status ${user.active ? 'enabled' : 'disabled'}`}><span />{user.approvalStatus === 'pending' ? 'Menunggu persetujuan' : user.active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td>{user.approvalStatus === 'pending' && ['OWNER', 'SUPER ADMIN'].includes(activeUser.role) && <>
                    <button className="button button-primary" disabled={memberDecisionBusy === user.id} onClick={() => decideTeamMember(user, 'approve')} type="button">Setujui</button>
                    <button className="button button-quiet" disabled={memberDecisionBusy === user.id} onClick={() => decideTeamMember(user, 'reject')} type="button">Tolak</button>
                  </>}</td>
                </tr>)}
              </tbody></table></div>
            </section>
          </section>
        ) : activePage === 'Cabang' ? (
          <BranchManagement isAuthenticated={isAuthenticated} role={activeUser.role} />
        ) : activePage === 'Absensi' ? (
          <AttendanceWorkspace isAuthenticated={isAuthenticated} role={activeUser.role} />
        ) : activePage === 'Struktur Workspace' ? (
          <section className="content">
            <div className="page-heading">
              <div><div className="eyebrow">WORKSPACE <span>/</span> PENGATURAN</div><h1>Struktur Workspace</h1><p>Aktifkan hanya modul yang dipakai oleh {businessTypes[businessType]?.label || 'usaha'} Anda. Pengaturan ini berlaku untuk seluruh pengguna workspace.</p></div>
            </div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <section className="table-card workspace-structure-card">
              <div className="table-heading"><div><h2>Modul usaha</h2><p>{workspaceModuleDraft.length} modul aktif</p></div></div>
              <div className="workspace-module-grid">
                {(businessTypes[businessType]?.modules || []).map(([id, label]) => {
                  const checked = workspaceModuleDraft.includes(id);
                  return <label className={`workspace-module-option ${checked ? 'is-selected' : ''}`} key={id}>
                    <input
                      checked={checked}
                      disabled={id === 'dashboard'}
                      onChange={() => setWorkspaceModuleDraft((current) => (
                        current.includes(id) ? current.filter((moduleId) => moduleId !== id) : [...current, id]
                      ))}
                      type="checkbox"
                    />
                    <span><strong>{label}</strong><small>{id === 'dashboard' ? 'Wajib aktif untuk ringkasan workspace.' : 'Tampilkan atau sembunyikan modul ini di navigasi tim.'}</small></span>
                  </label>;
                })}
              </div>
              <div className="workspace-structure-actions">
                <button className="button button-secondary" disabled={workspaceModulesSaving} onClick={() => setWorkspaceModuleDraft([...workspaceModules])} type="button">Batalkan perubahan</button>
                <button className="button button-primary" disabled={workspaceModulesSaving} onClick={saveWorkspaceStructure} type="button">{workspaceModulesSaving ? 'Menyimpan…' : 'Simpan struktur'}</button>
              </div>
            </section>
          </section>
        ) : activePage === 'Dashboard' && isAuthenticated && activeUser.role !== 'PLATFORM_OWNER' ? (
          <IndustryDashboard
            businessType={businessType}
            onActivate={() => openPage('Aktivasi')}
            role={activeUser.role}
            trialCountdown={ownerTrialCountdown}
            trialEndsAt={ownerTrialEnd}
            workspaceName={workspaceName}
          />
        ) : activePage === 'Dashboard' ? (
          <section className="content">
            <div className="page-heading dashboard-heading">
              <div><div className="eyebrow">JUMAT, 20 NOVEMBER 2026 <span>•</span> SELAMAT DATANG KEMBALI</div><h1>Dashboard</h1><p>Pantau aktivitas usaha <strong>{workspaceName}</strong> hari ini.</p></div>
              {activeUser.permissions.includes('spkCreate') && <button className="button button-primary" onClick={beginNewSpk} type="button"><span className="plus">+</span> Buat SPK baru</button>}
            </div>

            {activeUser.role === 'OWNER' && ownerTrialCountdown && <section aria-label="Hitung mundur masa demo" className="owner-trial-countdown" role="status">
              <span className="owner-trial-icon">◷</span>
              <div><strong>Demo gratis tersisa</strong><span>{ownerTrialCountdown.days} hari {padCountdown(ownerTrialCountdown.hours)}:{padCountdown(ownerTrialCountdown.minutes)}:{padCountdown(ownerTrialCountdown.seconds)}</span></div>
              <p>Berakhir {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(ownerTrialEnd))}</p>
              <button className="button button-primary" onClick={() => openPage('Aktivasi')} type="button">Pilih paket <span>→</span></button>
            </section>}

            <div className="overview-banner">
              <div className="banner-emblem">W</div>
              <div className="banner-copy"><span>WORKSPACE USAHA</span><strong>{workspaceName}</strong><small>Satu dashboard untuk mengelola operasional dan performa tim Anda.</small></div>
              <div className="banner-date"><span>PERIODE AKTIF</span><strong>November 2026</strong><small>Hari ini, 20 November 2026</small></div>
              <div className="banner-decoration">WAM</div>
            </div>

            <div className="section-heading"><div><h2>Ringkasan penjualan</h2><p>Ikhtisar performa dealer bulan ini</p></div><button className="filter-button" type="button">November 2026 <span>⌄</span></button></div>
            <div className="stats-grid">
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Total SPK</span><span className="stat-icon blue">▤</span></div><strong>{counts.total}</strong><div className="stat-foot"><span className="trend">↗ 12%</span><span>vs. bulan lalu</span></div></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Menunggu verifikasi</span><span className="stat-icon orange">◷</span></div><strong>{counts.submitted}</strong><div className="stat-foot"><span className="stat-neutral">Perlu ditinjau</span><span>oleh Admin</span></div></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>Menunggu approval</span><span className="stat-icon purple">✓</span></div><strong>{counts.approval}</strong><div className="stat-foot"><span className="stat-neutral">Dalam proses</span><span>oleh SVP</span></div></article>
              <article className={`stat-card stat-${themeSettings.statCardStyle}`}><div className="stat-top"><span>SPK selesai</span><span className="stat-icon green">↗</span></div><strong>{counts.complete}</strong><div className="stat-foot"><span className="trend">↗ 8%</span><span>vs. bulan lalu</span></div></article>
            </div>

            <section className="table-card">
              <div className="table-heading"><div><h2>SPK terbaru</h2><p>Pengajuan penjualan yang terakhir diperbarui</p></div><button className="text-button" onClick={() => openPage('Semua SPK')} type="button">Lihat semua <span>→</span></button></div>
              <div className="table-scroll"><table><thead><tr><th>NOMOR SPK</th><th>CUSTOMER</th><th>KENDARAAN</th><th>SALES</th><th>NILAI OTR</th><th>STATUS</th><th /></tr></thead><tbody>
                {spks.slice(0, 5).map((item) => <tr key={item.id}><td><strong className="spk-id">{item.spkNumber || item.id}</strong><small>{item.date || item.createdDate}</small></td><td><strong>{item.customer}</strong><small>Customer</small></td><td>{item.motor}</td><td>{item.sales}</td><td className="amount">{rupiah(item.amount)}</td><td><span className={`status-badge ${statusClass(item.status)}`}><span />{item.status}</span></td><td><button className="row-menu" aria-label={`Opsi ${item.spkNumber || item.id}`} type="button">···</button></td></tr>)}
              </tbody></table></div>
            </section>

            <div className="dashboard-bottom">
              {activeUser.permissions.includes('spkCreate') && <section className="quick-card"><div><span className="quick-icon">＋</span><div><h3>Buat pengajuan SPK</h3><p>Catat penjualan motor baru dengan cepat.</p></div></div><button onClick={beginNewSpk} type="button">Buat SPK <span>→</span></button></section>}
              <section className="target-card"><div><div><h3>Target penjualan</h3><p>Progress dealer bulan ini</p></div><strong>68%</strong></div><div className="progress-track"><span /></div><small>34 dari 50 unit terjual</small></section>
            </div>
          </section>
        ) : (
          <section className="content">
            <div className="page-heading"><div><div className="eyebrow">MANAJEMEN DEALER <span>/</span> {heading.toUpperCase()}</div><h1>{heading}</h1><p>Kelola data dan aktivitas {heading.toLowerCase()} Dealer WAM.</p></div>{(heading === 'Semua SPK' || heading === 'SPK') && activeUser.permissions.includes('spkCreate') && <button className="button button-primary" onClick={beginNewSpk} type="button"><span className="plus">+</span> Buat SPK baru</button>}</div>
            {notice && <div className="notice" role="status">{notice}</div>}
            <section className="table-card full-table">
              <div className="table-heading"><div><h2>{heading === 'Semua SPK' || heading === 'SPK' ? 'Daftar SPK' : `Data ${heading}`}</h2><p>{visibleSpks.length} pengajuan penjualan terdaftar</p></div><div className="table-tools"><input aria-label="Cari data" placeholder="Cari customer atau nomor SPK..." /><button className="filter-button" type="button">Semua status <span>⌄</span></button></div></div>
              <div className="table-scroll"><table><thead><tr><th>NOMOR SPK</th><th>CUSTOMER</th><th>KENDARAAN</th><th>SALES</th><th>NILAI OTR</th><th>STATUS</th><th /></tr></thead><tbody>
                {visibleSpks.map((item) => <tr key={item.id}><td><strong className="spk-id">{item.spkNumber || item.id}</strong><small>{item.date || item.createdDate}</small></td><td><strong>{item.customer}</strong><small>Customer</small></td><td>{item.motor}</td><td>{item.sales}</td><td className="amount">{rupiah(item.amount)}</td><td><span className={`status-badge ${statusClass(item.status)}`}><span />{item.status}</span></td><td className="spk-actions">
                  {activeUser.permissions.includes('spkVerify') && ['SUBMITTED', 'VERIFIKASI ADMIN'].includes(item.status) && <button aria-label={`Verifikasi SPK ${item.spkNumber || item.id}`} className="button button-quiet" onClick={() => verifySpk(item)} type="button">Verifikasi SPK</button>}
                  {activeUser.permissions.includes('spkVerify') && item.status === 'SUBMITTED' && <button aria-label={`Tolak SPK ${item.spkNumber || item.id}`} className="button button-quiet" onClick={() => rejectSpk(item)} type="button">Tolak SPK</button>}
                  {activeUser.permissions.includes('spkApprove') && item.status === 'APPROVAL SVP' && <button aria-label={`Setujui SPK ${item.spkNumber || item.id}`} className="button button-primary" onClick={() => approveSpk(item)} type="button">Setujui SPK</button>}
                  {activeUser.permissions.includes('spkApprove') && item.status === 'APPROVAL SVP' && <button aria-label={`Tolak SPK ${item.spkNumber || item.id}`} className="button button-quiet" onClick={() => rejectSpk(item)} type="button">Tolak SPK</button>}
                  {!['SUBMITTED', 'VERIFIKASI ADMIN', 'APPROVAL SVP'].includes(item.status)
                    || (item.status === 'SUBMITTED' && !activeUser.permissions.includes('spkVerify'))
                    || (item.status === 'APPROVAL SVP' && !activeUser.permissions.includes('spkApprove'))
                    ? <span aria-label="Tidak ada tindakan SPK">—</span> : null}
                </td></tr>)}
                {visibleSpks.length === 0 && <tr><td colSpan="7">Tidak ada pengajuan yang menunggu approval.</td></tr>}
              </tbody></table></div>
            </section>
          </section>
        )}
      </main>
      <aside aria-label="Operator bantuan" className="support-floating">
        {helpOpen && <div aria-label="Opsi bantuan" className="help-popover" id="help-popover" role="dialog">
          <button aria-label="Tutup bantuan" className="help-popover-close" onClick={() => setHelpOpen(false)} type="button">×</button>
          <strong>Butuh bantuan?</strong>
          <p>Operator kami siap membantu. Pesan dikirim melalui email.</p>
          <button className="help-popover-action" onClick={openSupport} type="button">Pusat bantuan <span aria-hidden="true">→</span></button>
          {supportContactEmail && <a className="help-popover-email" href={`mailto:${supportContactEmail}?subject=${encodeURIComponent('Bantuan KelolaUsaha.store')}`}>Email langsung ↗</a>}
        </div>}
        <button
          aria-controls="help-popover"
          aria-expanded={helpOpen}
          aria-label={helpOpen ? 'Tutup bantuan' : 'Buka bantuan'}
          className="support-floating-pill"
          onClick={() => setHelpOpen((current) => !current)}
          type="button"
        >
          <span aria-hidden="true" className="support-operator-avatar">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" fill="#fff0f2" r="23" />
              <path d="M9 22a15 15 0 0 1 30 0v7h-5v-8a10 10 0 0 0-20 0v8H9z" fill="#bd2635" />
              <path d="M14 21c1-8 5-12 11-12 5 0 9 3 11 9-3-1-6-3-8-6-3 4-7 7-14 9" fill="#51353a" />
              <path d="M14 22c0-6 4-10 10-10s10 4 10 10v5c0 7-4 11-10 11s-10-4-10-11z" fill="#ffd7c7" />
              <path d="M10 22a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4h3V22zm28 0h-3v11h3a4 4 0 0 0 4-4v-3a4 4 0 0 0-4-4" fill="#e24b59" />
              <circle cx="20" cy="25" fill="#4a3435" r="1.2" />
              <circle cx="28" cy="25" fill="#4a3435" r="1.2" />
              <path d="M21 30q3 2 6 0" fill="none" stroke="#a95058" strokeLinecap="round" strokeWidth="1.5" />
              <path d="M39 32c0 4-3 5-6 5" fill="none" stroke="#bd2635" strokeLinecap="round" strokeWidth="2" />
              <circle cx="32" cy="37" fill="#bd2635" r="1.7" />
            </svg>
          </span>
          <span className="support-floating-copy"><strong>Operator bantuan</strong><small>Siap membantu</small></span>
          <span aria-hidden="true" className="support-floating-chevron">{helpOpen ? '×' : '?'}</span>
        </button>
      </aside>
      {accountProfileOpen && <div className="access-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAccountProfileOpen(false);
      }}>
        <section aria-labelledby="account-profile-title" aria-modal="true" className="access-modal account-profile-modal" role="dialog">
          <div className="access-modal-header">
            <div>
              <div className="eyebrow">AKUN</div>
              <h2 id="account-profile-title">Profil Saya</h2>
              <p>Informasi akun yang sedang digunakan.</p>
            </div>
            <button aria-label="Tutup profil" className="modal-close" onClick={() => setAccountProfileOpen(false)} type="button">×</button>
          </div>
          <div className="access-modal-body">
            <div className="account-profile-details">
              <div><span>Nama</span><strong>{activeUser.name}</strong></div>
              <div><span>Email</span><strong>{activeUser.email || 'Belum tersedia'}</strong></div>
              <div><span>Peran</span><strong>{role.replaceAll('_', ' ')}</strong></div>
              <div><span>Workspace</span><strong>{workspaceName}</strong></div>
            </div>
          </div>
          <div className="access-modal-footer">
            {['OWNER', 'SUPER ADMIN'].includes(activeUser.role)
              && activeUser.permissions.includes('themeManage')
              && <button className="button button-quiet" onClick={() => {
                setAccountProfileOpen(false);
                openPage('Profil Usaha');
              }} type="button">Kelola Profil Usaha</button>}
            <button className="button button-primary" onClick={() => setAccountProfileOpen(false)} type="button">Tutup</button>
          </div>
        </section>
      </div>}
    </div>
  );
}

export default App;
