import { Fragment, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { getWaybillWhatsAppUrl, WaybillPrintDocument } from './DealerDocuments.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const emptyUnit = () => ({
  branchId: '',
  vehicleCategory: 'motor',
  receivingInvoice: '',
  supplierName: '',
  quantity: '1',
  brand: '',
  model: '',
  specification: '',
  modelYear: String(new Date().getFullYear()),
  color: '',
  frameNumber: '',
  engineNumber: '',
  otrPrice: '',
  stockOrigin: 'incoming',
  stockEntryDate: today(),
});

const numberInput = (value) => String(value || '').replace(/\D/g, '');
const formatNumberInput = (value) => value
  ? new Intl.NumberFormat('id-ID').format(Number(value) || 0)
  : '';

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
  received: 'Masuk · Menunggu inspeksi',
  inspection_completed: 'Inspeksi · Identitas unit dicatat',
  reserved_for_spk: 'Reservasi · SPK disubmit',
  reservation_released: 'Masuk kembali · SPK ditolak',
  approved_for_delivery: 'Proses keluar · SPK disetujui',
  in_delivery: 'Proses keluar · Driver mengambil',
  delivered: 'Keluar · Terkirim/terjual',
};

function StockSummary({ units, intakes }) {
  const count = (predicate) => units.filter(predicate).length;
  const intakeQuantity = (predicate) => intakes
    .filter((intake) => intake.stockOrigin === predicate)
    .reduce((total, intake) => total + Number(intake.quantityRemaining || 0), 0);
  const pendingIntakeQuantity = intakes
    .reduce((total, intake) => total + Number(intake.quantityRemaining || 0), 0);
  const cards = [
    ['Stok awal', count((unit) => unit.stockOrigin === 'opening') + intakeQuantity('opening')],
    ['Motor masuk', count((unit) => unit.stockOrigin === 'incoming') + intakeQuantity('incoming')],
    ['Menunggu inspeksi', count((unit) => unit.stockStatus === 'in_inspection') + pendingIntakeQuantity],
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
  canInspectPdi = false,
  pdiOnly = false,
  spks = [],
  intakes = [],
  movements = [],
  notice,
  onCreate,
  onCompleteInspection,
  onUpdatePdi,
}) {
  const [draft, setDraft] = useState(emptyUnit);
  const priceInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [stockFormOpen, setStockFormOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [inspectionUnitId, setInspectionUnitId] = useState('');
  const [inspectionDraft, setInspectionDraft] = useState({ frameNumber: '', engineNumber: '' });
  const [inspectionError, setInspectionError] = useState('');
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [pdiNotes, setPdiNotes] = useState({});
  const [pdiError, setPdiError] = useState('');
  const [pdiSavingId, setPdiSavingId] = useState('');

  useEffect(() => {
    if (branches.length === 1) {
      setDraft((current) => current.branchId
        ? current
        : { ...current, branchId: branches[0].id });
    }
  }, [branches]);

  useEffect(() => {
    if (!canManage || !stockFormOpen) return undefined;
    let cancelled = false;
    fetch('/api/dealer-motor/catalog')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Katalog Honda tidak dapat dimuat.');
        if (!Array.isArray(result.products)) throw new Error('Data katalog Honda tidak valid.');
        if (!cancelled) {
          setCatalogProducts(result.products);
          setCatalogError(result.stale ? 'Katalog sedang offline; menampilkan data tersimpan.' : '');
        }
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, stockFormOpen]);

  const update = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: name === 'otrPrice' ? numberInput(value) : value }));
  };
  const updatePrice = (event) => {
    const raw = event.target.value;
    const digitCountBeforeCursor = numberInput(raw.slice(0, event.target.selectionStart || 0)).length;
    const value = numberInput(raw);
    setDraft((current) => ({ ...current, otrPrice: value }));
    requestAnimationFrame(() => {
      const input = priceInputRef.current;
      if (!input) return;
      const formatted = formatNumberInput(value);
      let cursor = 0;
      let digits = 0;
      while (cursor < formatted.length && digits < digitCountBeforeCursor) {
        if (/\d/.test(formatted[cursor])) digits += 1;
        cursor += 1;
      }
      input.setSelectionRange(cursor, cursor);
    });
  };
  const selectModel = (value) => {
    const product = catalogProducts.find((item) => item.name === value);
    if (!product) {
      setDraft((current) => ({
        ...current,
        model: value,
        specification: '',
        color: '',
        otrPrice: '',
        brand: current.brand || 'Honda',
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      brand: 'Honda',
      model: product.name,
      specification: product.category || 'Honda',
      modelYear: String(product.modelYear),
      color: product.colors?.[0] || '',
      otrPrice: product.price ? String(product.price) : '',
      vehicleCategory: 'motor',
    }));
    if (product.slug) {
      fetch(`/api/dealer-motor/catalog/${encodeURIComponent(product.slug)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Spesifikasi Honda tidak dapat dimuat.');
          if (typeof result.product?.specification !== 'string') {
            throw new Error('Spesifikasi Honda dari server tidak valid.');
          }
          setDraft((current) => current.model === product.name
            ? { ...current, specification: result.product.specification }
            : current);
        })
        .catch((error) => setCatalogError(error.message));
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await onCreate({
        ...draft,
        modelYear: Number(draft.modelYear),
        otrPrice: Number(draft.otrPrice),
        quantity: Number(draft.quantity),
        identifiersPending: true,
      });
      setDraft({ ...emptyUnit(), branchId: branches.length === 1 ? branches[0].id : '' });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };
  const completeInspection = async (event, intake) => {
    event.preventDefault();
    setInspectionSaving(true);
    setInspectionError('');
    try {
      const updatedIntake = await onCompleteInspection(intake.id, inspectionDraft);
      if (updatedIntake.quantityRemaining < 1) setInspectionUnitId('');
      setInspectionDraft({ frameNumber: '', engineNumber: '' });
    } catch (error) {
      setInspectionError(error.message);
    } finally {
      setInspectionSaving(false);
    }
  };
  const selectedCatalogProduct = catalogProducts.find((product) => product.name === draft.model);
  const eligiblePdiStatuses = ['available', 'reserved', 'approved_for_delivery'];
  const pdiUnits = units.filter((unit) => eligiblePdiStatuses.includes(unit.stockStatus));
  const prioritizedUnits = pdiOnly
    ? [...pdiUnits].sort((left, right) => {
      const leftSpk = left.spkNumber || spks.find((spk) => spk.unitId === left.id)?.spkNumber;
      const rightSpk = right.spkNumber || spks.find((spk) => spk.unitId === right.id)?.spkNumber;
      return Number(Boolean(rightSpk && right.pdiStatus !== 'completed'))
        - Number(Boolean(leftSpk && left.pdiStatus !== 'completed'));
    })
    : units;
  const unitColumnCount = (pdiOnly ? 10 : 12) + (canInspectPdi ? 1 : 0);

  const updatePdiStatus = async (event, unit, action) => {
    event?.preventDefault();
    setPdiError('');
    setPdiSavingId(unit.id);
    try {
      await onUpdatePdi(unit.id, action, pdiNotes[unit.id] || '');
      if (action === 'complete') {
        setPdiNotes((current) => ({ ...current, [unit.id]: '' }));
      }
    } catch (error) {
      setPdiError(error.message);
    } finally {
      setPdiSavingId('');
    }
  };

  return <section className="content">
    <div className="page-heading">
      <div><div className="eyebrow">{pdiOnly ? 'PERSIAPAN KENDARAAN' : 'INVENTARIS'} <span>/</span> {pdiOnly ? 'PDI' : 'UNIT MOTOR'}</div><h1>{pdiOnly ? 'Inspeksi unit (PDI)' : 'Stok unit motor'}</h1>
        <p>{pdiOnly
          ? 'Unit yang sudah masuk SPK diprioritaskan; Anda tetap dapat memilih unit stok lain untuk diperiksa.'
          : 'Catat penerimaan dalam jumlah unit. Nomor rangka dan mesin dilengkapi saat inspeksi sebelum unit dapat dipilih untuk SPK.'}</p></div>
      {!pdiOnly && canManage && <button
        aria-controls="dealer-stock-entry-form"
        aria-expanded={stockFormOpen}
        className="button button-primary"
        onClick={() => setStockFormOpen((open) => !open)}
        type="button"
      >
        {stockFormOpen ? 'Tutup formulir stok' : '＋ Input stok tambahan'}
      </button>}
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {formError && <div className="notice error-notice" role="alert">{formError}</div>}
    {pdiOnly
      ? <div className="activation-summary-grid finance-summary-grid">
        <article className="stat-card"><div className="stat-top"><span>Prioritas SPK</span></div>
          <strong>{pdiUnits.filter((unit) => (unit.spkNumber
            || spks.some((spk) => spk.unitId === unit.id)) && unit.pdiStatus !== 'completed').length}</strong></article>
        <article className="stat-card"><div className="stat-top"><span>PDI berjalan</span></div>
          <strong>{pdiUnits.filter((unit) => unit.pdiStatus === 'in_progress').length}</strong></article>
        <article className="stat-card"><div className="stat-top"><span>Unit stok lainnya</span></div>
          <strong>{pdiUnits.filter((unit) => !(unit.spkNumber
            || spks.some((spk) => spk.unitId === unit.id))).length}</strong></article>
      </div>
      : <StockSummary intakes={intakes} units={units} />}
    {!pdiOnly && canManage && stockFormOpen && <form className="spk-form" id="dealer-stock-entry-form" onSubmit={submit}>
      <div className="form-section">
        <div className="section-title"><span className="section-number">01</span><div><h2>Tambah unit motor</h2><p>Pilih model Honda atau ketik nama secara manual, lalu catat jumlah penerimaan.</p></div></div>
        {catalogError && <p className="notice" role="status">{catalogError}</p>}
        <div className="form-grid four-columns">
          <label className="field"><span>Cabang <i>*</i></span><select name="branchId" onChange={update} required value={draft.branchId}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="field"><span>Jenis kendaraan <i>*</i></span><select name="vehicleCategory" onChange={update} value={draft.vehicleCategory}><option value="motor">Sepeda motor</option><option value="mobil">Mobil</option></select></label>
          <label className="field"><span>No. faktur penerimaan</span><input maxLength="100" name="receivingInvoice" onChange={update} value={draft.receivingInvoice} /></label>
          <label className="field"><span>Supplier / main dealer</span><input maxLength="160" name="supplierName" onChange={update} value={draft.supplierName} /></label>
          <label className="field"><span>Jenis pencatatan <i>*</i></span><select name="stockOrigin" onChange={update} value={draft.stockOrigin}><option value="opening">Stok awal</option><option value="incoming">Kendaraan masuk</option></select></label>
          <label className="field"><span>Tanggal masuk <i>*</i></span><input name="stockEntryDate" onChange={update} required type="date" value={draft.stockEntryDate} /></label>
          <label className="field"><span>Nama unit motor <i>*</i></span><input autoComplete="off" list="dealer-honda-models" maxLength="120" name="model" onChange={(event) => selectModel(event.target.value)} placeholder="Pilih katalog atau ketik manual" required value={draft.model} /><datalist id="dealer-honda-models">{catalogProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist></label>
          <label className="field"><span>Merek <i>*</i></span><input maxLength="80" name="brand" onChange={update} required value={draft.brand} /></label>
          <label className="field"><span>Tipe / spesifikasi <i>*</i></span><input maxLength="120" name="specification" onChange={update} required value={draft.specification} /></label>
          <label className="field"><span>Tahun <i>*</i></span><input max="2100" min="1980" name="modelYear" onChange={update} required type="number" value={draft.modelYear} /></label>
          <label className="field"><span>Warna <i>*</i></span>
            {selectedCatalogProduct?.colors?.length
              ? <select name="color" onChange={update} required value={draft.color}>{selectedCatalogProduct.colors.map((color) => <option key={color} value={color}>{color}</option>)}</select>
              : <input maxLength="80" name="color" onChange={update} required value={draft.color} />}
          </label>
          <label className="field"><span>Harga OTR <i>*</i></span><div className="input-prefix"><span>Rp</span><input inputMode="numeric" name="otrPrice" onChange={updatePrice} ref={priceInputRef} required type="text" value={formatNumberInput(draft.otrPrice)} /></div></label>
          <label className="field"><span>Jumlah unit masuk <i>*</i></span><input max="1000" min="1" name="quantity" onChange={update} required type="number" value={draft.quantity || '1'} /></label>
        </div>
        <div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan…' : 'Simpan penerimaan stok'} <span>＋</span></button></div>
      </div>
    </form>}
    <section className="table-card full-table">
      <div className="table-heading"><div><h2>{pdiOnly ? 'Antrean inspeksi PDI' : 'Daftar unit'}</h2><p>{pdiOnly
        ? `${pdiUnits.length} unit stok tersedia untuk inspeksi; unit ber-SPK yang belum PDI berada di prioritas teratas.`
        : `${units.length} unit dengan nomor rangka dan mesin; hanya unit terverifikasi yang dapat dipilih untuk SPK.`}</p></div></div>
      {pdiError && <p className="notice error-notice" role="alert">{pdiError}</p>}
      <div className="table-scroll"><table><thead><tr><th>TANGGAL MASUK</th><th>CABANG</th><th>JENIS</th><th>KENDARAAN</th><th>TAHUN / WARNA</th><th>NO. RANGKA</th><th>NO. MESIN</th><th>FAKTUR</th><th>SUPPLIER</th><th>HARGA OTR</th>{!pdiOnly && <><th>STATUS</th><th>MUTASI TERAKHIR</th></>}{canInspectPdi && <th>PDI / PRIORITAS</th>}</tr></thead><tbody>
        {prioritizedUnits.map((unit) => <tr key={unit.id}>
          <td>{unit.stockEntryDate}</td><td>{unit.branchName || '—'}</td>
          <td>{unit.vehicleCategory === 'mobil' ? 'Mobil' : 'Sepeda motor'}</td>
          <td>{unit.brand} {unit.model} {unit.specification}</td>
          <td>{unit.modelYear} / {unit.color}</td><td>{unit.frameNumber}</td><td>{unit.engineNumber}</td>
          <td>{unit.receivingInvoice || '—'}</td><td>{unit.supplierName || '—'}</td>
          <td className="amount">{rupiah(unit.otrPrice)}</td>
          {!pdiOnly && <><td>{unit.stockStatus === 'available' ? 'Tersedia'
            : unit.stockStatus === 'reserved' ? 'SPK diproses'
            : unit.stockStatus === 'approved_for_delivery' ? 'Menunggu driver'
              : unit.stockStatus === 'in_delivery' ? 'Dalam proses kirim' : 'Terkirim'}</td>
          <td>{dateTime(unit.statusUpdatedAt)}</td></>}
          {canInspectPdi && <td className="pdi-status-cell">
            {(unit.spkNumber || spks.find((spk) => spk.unitId === unit.id)?.spkNumber)
              && unit.pdiStatus !== 'completed'
              && <span className="pdi-priority">Prioritas SPK {unit.spkNumber || spks.find((spk) => spk.unitId === unit.id)?.spkNumber}</span>}
            <strong>{unit.pdiStatus === 'completed' ? 'PDI selesai'
              : unit.pdiStatus === 'in_progress' ? 'PDI berjalan' : 'Menunggu PDI'}</strong>
            {unit.pdiStatus === 'in_progress'
              ? <form className="pdi-action" onSubmit={(event) => updatePdiStatus(event, unit, 'complete')}>
                <input
                  aria-label={`Catatan PDI ${unit.model}`}
                  maxLength="500"
                  onChange={(event) => setPdiNotes((current) => ({ ...current, [unit.id]: event.target.value }))}
                  placeholder="Catatan inspeksi (opsional)"
                  value={pdiNotes[unit.id] || ''}
                />
                <button className="button button-primary" disabled={pdiSavingId === unit.id} type="submit">
                  {pdiSavingId === unit.id ? 'Menyimpan…' : 'Selesaikan PDI'}
                </button>
              </form>
              : unit.pdiStatus !== 'completed' && <button
                className="button button-quiet"
                disabled={pdiSavingId === unit.id}
                onClick={() => updatePdiStatus(null, unit, 'start')}
                type="button"
              >{pdiSavingId === unit.id ? 'Menyimpan…' : 'Mulai inspeksi'}</button>}
          </td>}
        </tr>
        )}
        {!prioritizedUnits.length && <tr><td colSpan={unitColumnCount}>{pdiOnly
          ? 'Belum ada unit stok yang dapat diperiksa.'
          : 'Belum ada unit terverifikasi. Penerimaan dengan jumlah tercatat pada daftar inspeksi di bawah.'}</td></tr>}
      </tbody></table></div>
    </section>
    {!pdiOnly && <section className="table-card full-table">
      <div className="table-heading"><div><h2>Penerimaan menunggu inspeksi</h2><p>Lengkapi nomor rangka dan mesin per unit; stok masuk belum dapat dipakai untuk SPK.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>TANGGAL</th><th>CABANG</th><th>KENDARAAN</th><th>TAHUN / WARNA</th><th>JUMLAH MASUK</th><th>TERSISA</th><th>FAKTUR</th><th>SUPPLIER</th><th>HARGA OTR</th><th>AKSI</th></tr></thead><tbody>
        {intakes.filter((intake) => intake.quantityRemaining > 0).map((intake) => <Fragment key={intake.id}>
          <tr>
            <td>{intake.stockEntryDate}</td><td>{intake.branchName || '—'}</td>
            <td>{intake.brand} {intake.model} {intake.specification}</td><td>{intake.modelYear} / {intake.color}</td>
            <td>{intake.quantityReceived}</td><td>{intake.quantityRemaining}</td>
            <td>{intake.receivingInvoice || '—'}</td><td>{intake.supplierName || '—'}</td>
            <td className="amount">{rupiah(intake.otrPrice)}</td>
            <td>{canManage && <button className="button button-quiet" onClick={() => { setInspectionUnitId(intake.id); setInspectionError(''); }} type="button">Inspeksi unit</button>}</td>
          </tr>
          {inspectionUnitId === intake.id && <tr><td colSpan="10"><form className="form-grid four-columns" onSubmit={(event) => completeInspection(event, intake)}>
            <label className="field"><span>Nomor rangka <i>*</i></span><input autoComplete="off" maxLength="80" onChange={(event) => setInspectionDraft((current) => ({ ...current, frameNumber: event.target.value }))} required value={inspectionDraft.frameNumber} /></label>
            <label className="field"><span>Nomor mesin <i>*</i></span><input autoComplete="off" maxLength="80" onChange={(event) => setInspectionDraft((current) => ({ ...current, engineNumber: event.target.value }))} required value={inspectionDraft.engineNumber} /></label>
            <div className="form-actions"><button className="button button-primary" disabled={inspectionSaving} type="submit">{inspectionSaving ? 'Menyimpan…' : 'Selesaikan inspeksi 1 unit'}</button><button className="button button-quiet" onClick={() => setInspectionUnitId('')} type="button">Batal</button></div>
            {inspectionError && <p className="notice error-notice" role="alert">{inspectionError}</p>}
          </form></td></tr>}
        </Fragment>)}
        {!intakes.some((intake) => intake.quantityRemaining > 0) && <tr><td colSpan="10">Tidak ada penerimaan yang menunggu inspeksi.</td></tr>}
      </tbody></table></div>
    </section>}
    {!pdiOnly && <section className="table-card full-table">
      <div className="table-heading"><div><h2>Riwayat stok masuk/keluar</h2><p>{movements.length} mutasi terakhir</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>TANGGAL</th><th>ARUS STOK</th><th>CABANG</th><th>MOTOR</th><th>JUMLAH</th><th>NO. RANGKA</th><th>SPK</th><th>PETUGAS</th><th>KETERANGAN</th></tr></thead><tbody>
        {movements.map((movement) => <tr key={movement.id}>
          <td>{dateTime(movement.createdAt)}</td>
          <td>{movementLabels[movement.eventType] || movement.eventType}</td>
          <td>{movement.branchName || '—'}</td>
          <td>{movement.brand} {movement.model} {movement.specification}</td>
          <td>{movement.quantity || 1}</td>
          <td>{movement.frameNumber || '—'}</td>
          <td>{movement.spkNumber || '—'}</td>
          <td>{movement.createdByName || '—'}</td>
          <td>{movement.note}</td>
        </tr>)}
        {!movements.length && <tr><td colSpan="9">Belum ada mutasi stok.</td></tr>}
      </tbody></table></div>
    </section>}
  </section>;
}

export function DriverDeliveryWorkspace({ isAuthenticated, notice, workspaceName }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [proofFiles, setProofFiles] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [printingWaybillId, setPrintingWaybillId] = useState('');

  useEffect(() => {
    const clearPrintingWaybill = () => setPrintingWaybillId('');
    window.addEventListener('afterprint', clearPrintingWaybill);
    return () => window.removeEventListener('afterprint', clearPrintingWaybill);
  }, []);

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

  const printWaybill = (delivery) => {
    flushSync(() => setPrintingWaybillId(delivery.id));
    window.print();
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
        {delivery.deliveryScheduledAt && <p><strong>Jadwal pengiriman:</strong> {dateTime(delivery.deliveryScheduledAt)}</p>}
        <div className="delivery-document-actions">
          <button className="button button-quiet" onClick={() => printWaybill(delivery)} type="button">Cetak surat jalan</button>
          {getWaybillWhatsAppUrl(delivery, workspaceName)
            ? <a className="button button-primary" href={getWaybillWhatsAppUrl(delivery, workspaceName)} rel="noreferrer" target="_blank">Bagikan surat jalan via WhatsApp</a>
            : <span className="document-share-unavailable">WhatsApp pelanggan belum tersedia</span>}
        </div>
        <WaybillPrintDocument
          delivery={delivery}
          printing={printingWaybillId === delivery.id}
          workspaceName={workspaceName}
        />
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
