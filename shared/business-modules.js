const sharedPosModules = [
  ['products', 'Produk & jasa'],
  ['prices', 'Daftar harga'],
  ['pos', 'POS / kasir'],
  ['transactions', 'Transaksi'],
  ['digital_receipts', 'Nota digital & WhatsApp'],
];

export const businessTypes = {
  laundry: {
    label: 'Laundry',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['customers', 'Data pelanggan'],
      ['laundry_orders', 'Status cucian & pengambilan'],
      ['inventory', 'Persediaan bahan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  dealer_motor: {
    label: 'Dealer motor',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['customers', 'Data pelanggan'],
      ['vehicles', 'Data motor & stok unit'],
      ['sales_orders', 'Penjualan & SPK'],
      ['sales_team', 'Data sales'],
      ['financing', 'Leasing & promo'],
      ['sales_reports', 'Laporan penjualan'],
      ['targets', 'Target penjualan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  dealer_vehicle: {
    label: 'Dealer Kendaraan',
    modules: [
      ['dashboard', 'Dashboard Dealer'],
      ...sharedPosModules,
      ['customers', 'Manajemen konsumen'],
      ['vehicles', 'Gudang & stok kendaraan'],
      ['scratch_verification', 'Gesek rangka & mesin'],
      ['pdi', 'Persiapan kendaraan (PDI)'],
      ['sales_orders', 'Penjualan & SPK'],
      ['handover', 'Serah terima konsumen'],
      ['sales_team', 'Data sales'],
      ['financing', 'Pembayaran & leasing'],
      ['sales_reports', 'Laporan dealer'],
      ['targets', 'Target penjualan'],
      ['employees', 'Pengguna & RBAC'],
    ],
  },
  retail: {
    label: 'Toko / Retail',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['inventory', 'Stok & inventori'],
      ['customers', 'Data pelanggan'],
      ['suppliers', 'Pemasok'],
      ['sales_reports', 'Laporan penjualan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  restaurant: {
    label: 'Restoran / Kafe',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['menu', 'Menu & bahan baku'],
      ['orders', 'Pesanan'],
      ['tables', 'Meja & reservasi'],
      ['suppliers', 'Pemasok'],
      ['sales_reports', 'Laporan penjualan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  services: {
    label: 'Jasa / Layanan',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['service_catalog', 'Daftar layanan'],
      ['appointments', 'Jadwal & pemesanan'],
      ['customers', 'Data pelanggan'],
      ['invoices', 'Tagihan & pembayaran'],
      ['sales_reports', 'Laporan usaha'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  workshop: {
    label: 'Bengkel',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['customers', 'Data pelanggan'],
      ['work_orders', 'Servis & riwayat kendaraan'],
      ['inventory', 'Stok sparepart'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  salon: {
    label: 'Salon / Barbershop',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['customers', 'Data pelanggan'],
      ['appointments', 'Booking & antrean'],
      ['commissions', 'Komisi stylist'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  printing: {
    label: 'Percetakan',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['customers', 'Data pelanggan'],
      ['print_orders', 'Pesanan & spesifikasi cetak'],
      ['inventory', 'Persediaan bahan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  distribution: {
    label: 'Grosir / Distribusi',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['inventory', 'Stok & inventori'],
      ['purchasing', 'Pembelian & pemasok'],
      ['orders', 'Pesanan penjualan'],
      ['customers', 'Data pelanggan'],
      ['delivery', 'Pengiriman'],
      ['sales_reports', 'Laporan usaha'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  fashion: {
    label: 'Fashion',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['collections', 'Koleksi & produk'],
      ['variants', 'Ukuran & warna'],
      ['inventory', 'Stok fashion'],
      ['suppliers', 'Pemasok'],
      ['customers', 'Pelanggan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  manufacturing: {
    label: 'Manufaktur',
    modules: [
      ['dashboard', 'Dashboard'],
      ['raw_materials', 'Bahan baku'],
      ['bom', 'Bill of Materials'],
      ['production', 'Produksi'],
      ['machines', 'Mesin & work center'],
      ['work_orders', 'Work order produksi'],
      ['qc', 'Quality control'],
      ['finished_goods', 'Barang jadi'],
      ['warehouses', 'Gudang'],
      ['employees', 'Manajemen karyawan'],
      ['sales_reports', 'Laporan produksi'],
    ],
  },
  property: {
    label: 'Properti',
    modules: [
      ['dashboard', 'Dashboard'],
      ['listings', 'Listing properti'],
      ['units', 'Unit & status'],
      ['prospects', 'Prospek'],
      ['agents', 'Agen'],
      ['viewings', 'Penjadwalan kunjungan'],
      ['bookings', 'Booking'],
      ['contracts', 'Kontrak'],
      ['payments', 'Pembayaran'],
      ['commissions', 'Komisi'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  pharmacy: {
    label: 'Apotek',
    modules: [
      ['dashboard', 'Dashboard'],
      ...sharedPosModules,
      ['medicines', 'Obat'],
      ['batches', 'Batch obat'],
      ['expiry', 'Kedaluwarsa'],
      ['prescriptions', 'Resep'],
      ['inventory', 'Stok & inventori'],
      ['suppliers', 'Pemasok'],
      ['customers', 'Pelanggan'],
      ['employees', 'Manajemen karyawan'],
    ],
  },
  travel: {
    label: 'Travel / Pariwisata',
    modules: [
      ['dashboard', 'Dashboard'],
      ['packages', 'Paket wisata'],
      ['itinerary', 'Itinerary'],
      ['schedule', 'Jadwal keberangkatan'],
      ['reservations', 'Reservasi'],
      ['participants', 'Peserta'],
      ['tickets', 'Tiket'],
      ['hotels', 'Hotel'],
      ['payments', 'Pembayaran'],
      ['partners', 'Partner perjalanan'],
      ['employees', 'Manajemen karyawan'],
      ['sales_reports', 'Laporan penjualan'],
    ],
  },
};

export const businessTypeIds = new Set(Object.keys(businessTypes));

const permissionBusinessModules = {
  dashboard: 'dashboard',
  spkCreate: 'sales_orders',
  spkViewAll: 'sales_orders',
  spkViewOwn: 'sales_orders',
  spkVerify: 'sales_orders',
  spkApprove: 'sales_orders',
  customerManage: 'customers',
  salesManage: 'sales_team',
  unitManage: 'vehicles',
  deliveryManage: 'delivery',
  leasingManage: 'financing',
  reportsView: 'sales_reports',
  targetManage: 'targets',
  posAccess: 'pos',
  priceManage: 'prices',
  transactionsView: 'transactions',
  receiptsView: 'digital_receipts',
  userManage: 'employees',
  attendanceView: 'employees',
  attendanceManage: 'employees',
};

export function isPermissionAvailableForBusiness(permission, businessType, enabledModules) {
  const moduleId = permissionBusinessModules[permission];
  if (!moduleId) return true;
  const business = businessTypes[businessType];
  if (!business) return false;
  const businessModuleIds = new Set(business.modules.map(([id]) => id));
  const requestedModules = Array.isArray(enabledModules)
    ? new Set(enabledModules)
    : businessModuleIds;
  return businessModuleIds.has(moduleId) && requestedModules.has(moduleId);
}

export function filterPermissionsForBusiness(permissions, businessType, enabledModules) {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter((permission) => (
    isPermissionAvailableForBusiness(permission, businessType, enabledModules)
  ));
}
