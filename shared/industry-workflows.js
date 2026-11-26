export const industryWorkflows = {
  laundry: {
    label: 'Laundry',
    orderLabel: 'Order cucian',
    initialStatus: 'received',
    statuses: [
      ['received', 'Diterima'],
      ['washing', 'Proses cuci'],
      ['drying', 'Proses pengeringan'],
      ['ironing', 'Proses setrika'],
      ['ready', 'Siap diambil'],
      ['picked_up', 'Sudah diambil'],
    ],
    fields: [
      { id: 'serviceName', label: 'Layanan', type: 'text', required: true },
      { id: 'pricingUnit', label: 'Jenis satuan', type: 'select', required: true, options: ['kg', 'pcs'] },
      { id: 'weight', label: 'Berat / jumlah', type: 'number', required: true },
      { id: 'dueAt', label: 'Estimasi selesai', type: 'date', required: true },
      { id: 'pickupCode', label: 'Kode pengambilan', type: 'text' },
    ],
  },
  dealer_motor: {
    label: 'Dealer motor',
    orderLabel: 'SPK / penjualan unit',
    initialStatus: 'draft',
    statuses: [
      ['draft', 'Draft'],
      ['submitted', 'Diajukan'],
      ['verified', 'Dokumen diverifikasi'],
      ['approved', 'Disetujui'],
      ['delivered', 'Unit diserahkan'],
    ],
    fields: [
      { id: 'vehicleModel', label: 'Tipe motor', type: 'text', required: true },
      { id: 'frameNumber', label: 'Nomor rangka', type: 'text' },
      { id: 'paymentType', label: 'Pembayaran', type: 'select', required: true, options: ['Tunai', 'Kredit'] },
      { id: 'downPayment', label: 'Uang muka (Rp)', type: 'number' },
      { id: 'leasing', label: 'Leasing', type: 'text' },
      { id: 'tenorMonths', label: 'Tenor (bulan)', type: 'number' },
      { id: 'salesName', label: 'Nama sales', type: 'text', required: true },
    ],
  },
  dealer_vehicle: {
    label: 'Dealer Kendaraan',
    orderLabel: 'SPK / penjualan kendaraan',
    initialStatus: 'draft',
    statuses: [
      ['draft', 'Draft'],
      ['submitted', 'Menunggu persetujuan'],
      ['allocated', 'Unit dialokasikan'],
      ['awaiting_scratch', 'Menunggu gesek'],
      ['scratch_completed', 'Gesek selesai'],
      ['awaiting_pdi', 'Menunggu PDI'],
      ['ready_for_handover', 'Siap serah terima'],
      ['delivered', 'Sudah diserahkan'],
      ['cancelled', 'Dibatalkan / retur'],
    ],
    fields: [
      { id: 'vehicleCategory', label: 'Jenis kendaraan', type: 'select', required: true, options: ['Sepeda motor', 'Mobil'] },
      { id: 'vehicleModel', label: 'Tipe kendaraan', type: 'text', required: true },
      { id: 'frameNumber', label: 'Nomor rangka', type: 'text', required: true },
      { id: 'engineNumber', label: 'Nomor mesin', type: 'text', required: true },
      { id: 'paymentType', label: 'Pembayaran', type: 'select', required: true, options: ['Tunai', 'Kredit'] },
      { id: 'downPayment', label: 'Uang muka (Rp)', type: 'number' },
      { id: 'leasing', label: 'Leasing', type: 'text' },
      { id: 'tenorMonths', label: 'Tenor (bulan)', type: 'number' },
      { id: 'salesName', label: 'Nama sales', type: 'text', required: true },
    ],
  },
  retail: {
    label: 'Toko / Retail',
    orderLabel: 'Penjualan retail',
    initialStatus: 'open',
    statuses: [
      ['open', 'Transaksi dibuka'],
      ['completed', 'Selesai'],
      ['cancelled', 'Dibatalkan'],
      ['returned', 'Diretur'],
    ],
    fields: [
      { id: 'salesChannel', label: 'Kanal penjualan', type: 'select', options: ['Toko', 'Online', 'Marketplace'] },
      { id: 'discount', label: 'Diskon (Rp)', type: 'number' },
      { id: 'cashierName', label: 'Kasir', type: 'text' },
    ],
  },
  restaurant: {
    label: 'Restoran / Kafe',
    orderLabel: 'Pesanan meja / menu',
    initialStatus: 'awaiting_cashier',
    statuses: [
      ['awaiting_cashier', 'Menunggu persetujuan kasir'],
      ['in_kitchen', 'Diproses dapur'],
      ['ready', 'Siap diantar'],
      ['served', 'Diantar waiter'],
      ['completed', 'Selesai'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'tableNumber', label: 'Nomor meja', type: 'text', required: true },
      { id: 'orderChannel', label: 'Kanal pesanan', type: 'select', required: true, options: ['Meja', 'Menu QR', 'Bungkus', 'Pesan antar'] },
      { id: 'paymentTiming', label: 'Waktu pembayaran', type: 'select', required: true, options: ['Bayar di awal', 'Bayar di kasir'] },
      { id: 'specialNotes', label: 'Catatan dapur', type: 'textarea' },
    ],
  },
  services: {
    label: 'Jasa / Layanan',
    orderLabel: 'Pekerjaan layanan',
    initialStatus: 'booked',
    statuses: [
      ['booked', 'Terjadwal'],
      ['in_progress', 'Sedang dikerjakan'],
      ['completed', 'Selesai'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'serviceName', label: 'Jenis layanan', type: 'text', required: true },
      { id: 'assignedStaff', label: 'Petugas', type: 'text' },
      { id: 'appointmentAt', label: 'Jadwal layanan', type: 'date', required: true },
      { id: 'durationMinutes', label: 'Durasi (menit)', type: 'number' },
    ],
  },
  workshop: {
    label: 'Bengkel',
    orderLabel: 'Perintah kerja bengkel',
    initialStatus: 'received',
    statuses: [
      ['received', 'Kendaraan diterima'],
      ['diagnosing', 'Pemeriksaan'],
      ['awaiting_approval', 'Menunggu persetujuan biaya'],
      ['repairing', 'Dalam perbaikan'],
      ['quality_check', 'Pemeriksaan akhir'],
      ['ready', 'Siap diambil'],
      ['delivered', 'Kendaraan diserahkan'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'plateNumber', label: 'Nomor polisi', type: 'text', required: true },
      { id: 'vehicleModel', label: 'Tipe kendaraan', type: 'text', required: true },
      { id: 'odometer', label: 'Kilometer', type: 'number' },
      { id: 'mechanic', label: 'Mekanik', type: 'text' },
      { id: 'complaint', label: 'Keluhan pelanggan', type: 'textarea', required: true },
      { id: 'estimatedFinish', label: 'Estimasi selesai', type: 'date' },
    ],
  },
  salon: {
    label: 'Salon / Barbershop',
    orderLabel: 'Booking / layanan salon',
    initialStatus: 'booked',
    statuses: [
      ['booked', 'Booking'],
      ['waiting', 'Menunggu giliran'],
      ['in_service', 'Sedang dilayani'],
      ['completed', 'Selesai'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'serviceName', label: 'Layanan', type: 'text', required: true },
      { id: 'stylist', label: 'Stylist / barber', type: 'text', required: true },
      { id: 'appointmentAt', label: 'Jadwal booking', type: 'date', required: true },
      { id: 'queueNumber', label: 'Nomor antrean', type: 'text' },
    ],
  },
  printing: {
    label: 'Percetakan',
    orderLabel: 'Pesanan cetak',
    initialStatus: 'quoted',
    statuses: [
      ['quoted', 'Penawaran dibuat'],
      ['approved', 'Disetujui pelanggan'],
      ['printing', 'Proses cetak'],
      ['finishing', 'Proses finishing'],
      ['ready', 'Siap diambil'],
      ['delivered', 'Diserahkan'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'printSize', label: 'Ukuran', type: 'text', required: true },
      { id: 'material', label: 'Bahan', type: 'text', required: true },
      { id: 'finishing', label: 'Finishing', type: 'text' },
      { id: 'copies', label: 'Jumlah cetak', type: 'number', required: true },
      { id: 'deadline', label: 'Tenggat selesai', type: 'date', required: true },
    ],
  },
  distribution: {
    label: 'Grosir / Distribusi',
    orderLabel: 'Order penjualan / pengiriman',
    initialStatus: 'draft',
    statuses: [
      ['draft', 'Draft order'],
      ['confirmed', 'Order dikonfirmasi'],
      ['picking', 'Barang disiapkan'],
      ['shipped', 'Dalam pengiriman'],
      ['delivered', 'Terkirim'],
      ['cancelled', 'Dibatalkan'],
    ],
    fields: [
      { id: 'warehouse', label: 'Gudang asal', type: 'text', required: true },
      { id: 'deliveryAddress', label: 'Alamat pengiriman', type: 'textarea', required: true },
      { id: 'shippingMethod', label: 'Metode pengiriman', type: 'text', required: true },
      { id: 'deliveryDate', label: 'Tanggal kirim', type: 'date' },
    ],
  },
};

export function getIndustryWorkflow(businessType) {
  return industryWorkflows[businessType] || null;
}

export function nextIndustryStatus(businessType, currentStatus) {
  const workflow = getIndustryWorkflow(businessType);
  if (!workflow) return null;
  const index = workflow.statuses.findIndex(([status]) => status === currentStatus);
  return workflow.statuses[index + 1]?.[0] || null;
}
