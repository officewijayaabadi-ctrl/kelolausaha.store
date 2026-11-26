import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);
const emptyUnit = () => ({
  branchId: '',
  vehicleCategory: 'motor',
  receivingInvoice: '',
  supplierName: '',
  brand: '',
  model: '',
  specification: '',
  modelYear: String(new Date().getFullYear()),
  color: '',
  frameNumber: '',
  engineNumber: '',
  otrPrice: '',
  stockOrigin: 'opening',
  stockEntryDate: today(),
});

const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const dateTime = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const movementLabels = {
  opening: 'Masuk · Stok awal',
  incoming: 'Masuk · Motor masuk',
  reserved_for_spk: 'Reservasi · SPK disubmit',
  reservation_released: 'Masuk kembali · SPK ditolak',
  approved_for_delivery: 'Proses keluar · SPK disetujui',
  in_delivery: 'Proses keluar · Driver mengambil',
  delivered: 'Keluar · Terkirim/terjual',
};

function StockSummary({ units }) {
  const count = (predicate) => units.filter(predicate).length;
  const cards = [
    ['Stok awal', count((unit) => unit.stockOrigin === 'opening')],
    ['Motor masuk', count((unit) => unit.stockOrigin === 'incoming')],
    ['SPK diproses', count((unit) => unit.stockStatus === 'reserved')],
    ['Menunggu driver', count((unit) => unit.stockStatus === 'approved_for_delivery')],
    ['Dalam proses kirim', count((unit) => unit.stockStatus === 'in_delivery')],
    ['Motor keluar', count((unit) => unit.stockStatus === 'delivered')],
    ['Stok akhir', count((unit) => unit.stockStatus === 'available')],
  ];
  return <div className="activation-summary-grid finance-summary-grid">
    {cards.map(([label, total]) => <article className="stat-card" key={label}>
      <div className="stat-top"><span>{label}</span></div>
      <strong>{total}</strong>
    </article>)}
  </div>;
}

export function DealerMotorWorkspace({
  units,
  branches,
  canManage,
  movements = [],
  notice,
  onCreate,
}) {
  const [draft, setDraft] = useState(emptyUnit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const update = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await onCreate({ ...draft, modelYear: Number(draft.modelYear), otrPrice: Number(draft.otrPrice) });
      setDraft(emptyUnit());
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return <section className="content">
    <div className="page-heading">
      <div><div className="eyebrow">INVENTARIS <span>/</span> UNIT MOTOR</div><h1>Stok unit motor</h1>
        <p>Catat spesifikasi setiap unit sampai nomor rangka dan nomor mesin. Harga unit menjadi sumber harga pada SPK.</p></div>
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {formError && <div className="notice error-notice" role="alert">{formError}</div>}
    <StockSummary units={units} />
    {canManage && <form className="spk-form" onSubmit={submit}>
      <div className="form-section">
        <div className="section-title"><span className="section-number">01</span><div><h2>Tambah unit motor</h2><p>Masukkan unit stok awal atau motor yang baru masuk.</p></div></div>
        <div className="form-grid four-columns">
          <label className="field"><span>Cabang <i>*</i></span><select name="branchId" onChange={update} required value={draft.branchId}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="field"><span>Jenis kendaraan <i>*</i></span><select name="vehicleCategory" onChange={update} value={draft.vehicleCategory}><option value="motor">Sepeda motor</option><option value="mobil">Mobil</option></select></label>
          <label className="field"><span>No. faktur penerimaan</span><input maxLength="100" name="receivingInvoice" onChange={update} value={draft.receivingInvoice} /></label>
          <label className="field"><span>Supplier / main dealer</span><input maxLength="160" name="supplierName" onChange={update} value={draft.supplierName} /></label>
          <label className="field"><span>Jenis pencatatan <i>*</i></span><select name="stockOrigin" onChange={update} value={draft.stockOrigin}><option value="opening">Stok awal</option><option value="incoming">Kendaraan masuk</option></select></label>
          <label className="field"><span>Tanggal masuk <i>*</i></span><input name="stockEntryDate" onChange={update} required type="date" value={draft.stockEntryDate} /></label>
          <label className="field"><span>Merek <i>*</i></span><input maxLength="80" name="brand" onChange={update} required value={draft.brand} /></label>
          <label className="field"><span>Model motor <i>*</i></span><input maxLength="120" name="model" onChange={update} required value={draft.model} /></label>
          <label className="field"><span>Tipe / spesifikasi <i>*</i></span><input maxLength="120" name="specification" onChange={update} required value={draft.specification} /></label>
          <label className="field"><span>Tahun <i>*</i></span><input max="2100" min="1980" name="modelYear" onChange={update} required type="number" value={draft.modelYear} /></label>
          <label className="field"><span>Warna <i>*</i></span><input maxLength="80" name="color" onChange={update} required value={draft.color} /></label>
          <label className="field"><span>No. rangka <i>*</i></span><input autoComplete="off" maxLength="80" name="frameNumber" onChange={update} required value={draft.frameNumber} /></label>
          <label className="field"><span>No. mesin <i>*</i></span><input autoComplete="off" maxLength="80" name="engineNumber" onChange={update} required value={draft.engineNumber} /></label>
          <label className="field"><span>Harga OTR <i>*</i></span><div className="input-prefix"><span>Rp</span><input min="0" name="otrPrice" onChange={update} required type="number" value={draft.otrPrice} /></div></label>
        </div>
        <div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan…' : 'Simpan unit motor'} <span>＋</span></button></div>
      </div>
    </form>}
    <section className="table-card full-table">
      <div className="table-heading"><div><h2>Daftar unit</h2><p>{units.length} unit tercatat</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>TANGGAL MASUK</th><th>CABANG</th><th>JENIS</th><th>KENDARAAN</th><th>TAHUN / WARNA</th><th>NO. RANGKA</th><th>NO. MESIN</th><th>FAKTUR</th><th>SUPPLIER</th><th>HARGA OTR</th><th>STATUS</th><th>MUTASI TERAKHIR</th></tr></thead><tbody>
        {units.map((unit) => <tr key={unit.id}>
          <td>{unit.stockEntryDate}</td><td>{unit.branchName || '—'}</td>
          <td>{unit.vehicleCategory === 'mobil' ? 'Mobil' : 'Sepeda motor'}</td>
          <td>{unit.brand} {unit.model} {unit.specification}</td>
          <td>{unit.modelYear} / {unit.color}</td><td>{unit.frameNumber}</td><td>{unit.engineNumber}</td>
          <td>{unit.receivingInvoice || '—'}</td><td>{unit.supplierName || '—'}</td>
          <td className="amount">{rupiah(unit.otrPrice)}</td>
          <td>{unit.stockStatus === 'available' ? 'Tersedia'
            : unit.stockStatus === 'reserved' ? 'SPK diproses'
            : unit.stockStatus === 'approved_for_delivery' ? 'Menunggu driver'
              : unit.stockStatus === 'in_delivery' ? 'Dalam proses kirim' : 'Terkirim'}</td>
          <td>{dateTime(unit.statusUpdatedAt)}</td>
        </tr>)}
        {!units.length && <tr><td colSpan="12">Belum ada unit. Tambahkan stok awal atau kendaraan masuk.</td></tr>}
      </tbody></table></div>
    </section>
    <section className="table-card full-table">
      <div className="table-heading"><div><h2>Riwayat stok masuk/keluar</h2><p>{movements.length} mutasi terakhir</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>TANGGAL</th><th>ARUS STOK</th><th>CABANG</th><th>MOTOR</th><th>NO. RANGKA</th><th>SPK</th><th>PETUGAS</th><th>KETERANGAN</th></tr></thead><tbody>
        {movements.map((movement) => <tr key={movement.id}>
          <td>{dateTime(movement.createdAt)}</td>
          <td>{movementLabels[movement.eventType] || movement.eventType}</td>
          <td>{movement.branchName || '—'}</td>
          <td>{movement.brand} {movement.model} {movement.specification}</td>
          <td>{movement.frameNumber}</td>
          <td>{movement.spkNumber || '—'}</td>
          <td>{movement.createdByName || '—'}</td>
          <td>{movement.note}</td>
        </tr>)}
        {!movements.length && <tr><td colSpan="8">Belum ada mutasi stok.</td></tr>}
      </tbody></table></div>
    </section>
  </section>;
}

export function DriverDeliveryWorkspace({ isAuthenticated, notice }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [proofFiles, setProofFiles] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/dealer-motor/deliveries');
      if (!response.ok) throw new Error(await response.json().then((result) => result.message || 'Daftar pengiriman tidak dapat dimuat.'));
      const result = await response.json();
      if (!Array.isArray(result.deliveries)) throw new Error('Data pengiriman dari server tidak valid.');
      setDeliveries(result.deliveries);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAuthenticated]);

  const claim = async (delivery) => {
    setBusyId(delivery.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/dealer-motor/spks/${delivery.id}/claim-delivery`, { method: 'PATCH' });
      if (!response.ok) throw new Error(await response.json().then((result) => result.message || 'Pengiriman tidak dapat diambil.'));
      setMessage(`${delivery.spkNumber} berhasil diambil untuk dikirim.`);
      await load();
    } catch (claimError) {
      setError(claimError.message);
    } finally {
      setBusyId('');
    }
  };

  const submitProof = async (event, delivery) => {
    event.preventDefault();
    const photo = proofFiles[delivery.id];
    if (!photo) {
      setError('Pilih foto bukti serah-terima terlebih dahulu.');
      return;
    }
    if (!navigator.geolocation) {
      setError('Perangkat ini tidak menyediakan lokasi GPS.');
      return;
    }
    setBusyId(delivery.id);
    setError('');
    setMessage('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const body = new FormData();
        body.append('photo', photo);
        body.append('latitude', String(coords.latitude));
        body.append('longitude', String(coords.longitude));
        const response = await fetch(`/api/dealer-motor/spks/${delivery.id}/delivery-proof`, {
          method: 'POST',
          body,
        });
        if (!response.ok) throw new Error(await response.json().then((result) => result.message || 'Bukti serah-terima tidak dapat disimpan.'));
        setMessage(`${delivery.spkNumber} terkirim. Foto dan lokasi GPS tersimpan.`);
        setProofFiles((current) => ({ ...current, [delivery.id]: null }));
        await load();
      } catch (proofError) {
        setError(proofError.message);
      } finally {
        setBusyId('');
      }
    }, (locationError) => {
      setBusyId('');
      setError(`Lokasi tidak dapat diambil: ${locationError.message}`);
    }, { enableHighAccuracy: true, timeout: 15000 });
  };

  return <section className="content">
    <div className="page-heading"><div><div className="eyebrow">PENJUALAN <span>/</span> PENGIRIMAN</div><h1>Pengiriman kendaraan</h1><p>Pilih sendiri tugas dari Surat Jalan yang sudah diterbitkan, lalu unggah foto serah-terima dan lokasi GPS pembeli.</p></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {message && <div className="notice" role="status">{message}</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    {!isAuthenticated && <div className="notice">Masuk dengan akun DRIVER untuk mengambil tugas pengiriman.</div>}
    {loading && <p role="status">Memuat daftar pengiriman…</p>}
    <div className="delivery-list">
      {deliveries.map((delivery) => <article className="table-card delivery-card" key={delivery.id}>
        <div className="section-heading"><div><h2>{delivery.spkNumber} · {delivery.customerName}</h2><p>{delivery.brand} {delivery.model} {delivery.specification} · {delivery.color}</p></div>
          <strong>{delivery.deliveryStatus === 'ready' ? 'Tersedia untuk diambil' : 'Tugas Anda'}</strong></div>
        <p>{delivery.customerPhone} · {delivery.customerAddress}</p>
        <p><strong>Surat Jalan:</strong> {delivery.waybillNumber || '—'} · <strong>SPK:</strong> {delivery.spkNumber}</p>
        {delivery.deliveryStatus === 'ready'
          ? <button className="button button-primary" disabled={busyId === delivery.id} onClick={() => claim(delivery)} type="button">Ambil tugas sendiri <span>→</span></button>
          : <form onSubmit={(event) => submitProof(event, delivery)}>
            <label className="field"><span>Foto serah-terima pembeli <i>*</i></span><input accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setProofFiles((current) => ({ ...current, [delivery.id]: event.target.files?.[0] || null }))} required type="file" /></label>
            <button className="button button-primary" disabled={busyId === delivery.id} type="submit">{busyId === delivery.id ? 'Menyimpan…' : 'Kirim bukti & lokasi GPS'}</button>
          </form>}
      </article>)}
      {!loading && deliveries.length === 0 && <section className="table-card receipt-empty"><h2>Tidak ada pengiriman</h2><p>SPK yang sudah disetujui akan muncul di sini dan dapat diambil oleh driver.</p></section>}
    </div>
  </section>;
}
