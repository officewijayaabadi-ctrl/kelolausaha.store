const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 15) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

const valueOrDash = (value) => value === undefined || value === null || value === '' ? '—' : value;

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatRupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

export function getSpkWhatsAppUrl(spk, workspaceName) {
  const phone = normalizePhone(spk.customerPhone);
  if (!phone) return '';
  const message = [
    `Dokumen SPK dari ${workspaceName}.`,
    `Nomor SPK: ${spk.spkNumber || spk.id}`,
    `Tanggal: ${spk.date || '—'}`,
    `Pelanggan: ${spk.customer || '—'}`,
    `Kendaraan: ${spk.motor || '—'}`,
    `Nilai OTR: ${formatRupiah(spk.otrPrice ?? spk.amount)}`,
    `Status: ${spk.status || '—'}`,
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function getWaybillWhatsAppUrl(delivery, workspaceName) {
  const phone = normalizePhone(delivery.customerPhone);
  if (!phone || !delivery.waybillNumber) return '';
  const message = [
    `Surat Jalan dari ${workspaceName}.`,
    `Nomor Surat Jalan: ${delivery.waybillNumber}`,
    `Nomor SPK: ${delivery.spkNumber || '—'}`,
    `Pelanggan: ${delivery.customerName || delivery.customer || '—'}`,
    `Kendaraan: ${[delivery.brand, delivery.model, delivery.specification].filter(Boolean).join(' ') || '—'}`,
    `Jadwal pengiriman: ${formatDateTime(delivery.deliveryScheduledAt)}`,
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function SpkPrintDocument({ spk, workspaceName, printing = false }) {
  const details = spk.details && typeof spk.details === 'object' && !Array.isArray(spk.details)
    ? spk.details : {};
  const rows = [
    ['Nomor SPK', spk.spkNumber || spk.id],
    ['Tanggal', spk.date || details.date],
    ['Status', spk.status],
    ['Nama pelanggan', spk.customer],
    ['NIK', spk.customerNik],
    ['Nomor telepon', spk.customerPhone],
    ['Alamat', spk.customerAddress],
    ['Nama sales', spk.sales],
    ['Kendaraan', spk.motor],
    ['Tahun', spk.year],
    ['Warna', spk.color],
    ['Nomor rangka', spk.frameNumber],
    ['Nomor mesin', spk.engineNumber],
    ['Harga OTR', formatRupiah(spk.otrPrice ?? spk.amount)],
    ['Jenis pembayaran', details.paymentType],
    ['Leasing', details.leasing],
    ['DP', details.downPayment ? formatRupiah(details.downPayment) : ''],
    ['Tenor', details.tenor ? `${details.tenor} bulan` : ''],
    ['Angsuran/bulan', details.installment ? formatRupiah(details.installment) : ''],
  ];

  return <article
    aria-hidden="true"
    className="dealer-print-document spk-print-document"
    data-printing={printing ? 'true' : 'false'}
  >
    <header className="dealer-document-header">
      <strong>{workspaceName}</strong>
      <h1>SURAT PEMESANAN KENDARAAN</h1>
      <p>Nomor {spk.spkNumber || spk.id}</p>
    </header>
    <dl className="dealer-document-fields">
      {rows.map(([label, value]) => <div key={label}>
        <dt>{label}</dt><dd>{valueOrDash(value)}</dd>
      </div>)}
    </dl>
    <p className="dealer-document-note">Dokumen ini mencatat pemesanan kendaraan sesuai data yang tersimpan pada workspace.</p>
    <footer className="dealer-document-signatures">
      <div><span>Pelanggan</span><strong>{valueOrDash(spk.customer)}</strong></div>
      <div><span>Sales</span><strong>{valueOrDash(spk.sales)}</strong></div>
      <div><span>Dealer</span><strong>{workspaceName}</strong></div>
    </footer>
  </article>;
}

export function WaybillPrintDocument({ delivery, workspaceName, printing = false }) {
  const vehicle = [delivery.brand, delivery.model, delivery.specification].filter(Boolean).join(' ');
  const rows = [
    ['Nomor Surat Jalan', delivery.waybillNumber],
    ['Nomor SPK', delivery.spkNumber],
    ['Tanggal terbit', formatDateTime(delivery.waybillIssuedAt)],
    ['Jadwal pengiriman', formatDateTime(delivery.deliveryScheduledAt)],
    ['Penerima', delivery.customerName || delivery.customer],
    ['Nomor telepon', delivery.customerPhone],
    ['Alamat tujuan', delivery.customerAddress],
    ['Kendaraan', vehicle],
    ['Tahun / warna', [delivery.modelYear, delivery.color].filter(Boolean).join(' / ')],
    ['Nomor rangka', delivery.frameNumber],
    ['Nomor mesin', delivery.engineNumber],
  ];

  return <article
    aria-hidden="true"
    className="dealer-print-document waybill-print-document"
    data-printing={printing ? 'true' : 'false'}
  >
    <header className="dealer-document-header">
      <strong>{workspaceName}</strong>
      <h1>SURAT JALAN</h1>
      <p>{delivery.waybillNumber}</p>
    </header>
    <dl className="dealer-document-fields">
      {rows.map(([label, value]) => <div key={label}>
        <dt>{label}</dt><dd>{valueOrDash(value)}</dd>
      </div>)}
    </dl>
    <p className="dealer-document-note">Mohon periksa kondisi kendaraan dan kelengkapan dokumen saat serah terima.</p>
    <footer className="dealer-document-signatures">
      <div><span>Pengirim</span><strong>{workspaceName}</strong></div>
      <div><span>Driver</span><strong>{valueOrDash(delivery.driverName)}</strong></div>
      <div><span>Penerima</span><strong>{valueOrDash(delivery.customerName || delivery.customer)}</strong></div>
    </footer>
  </article>;
}
