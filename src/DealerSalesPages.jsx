import { useEffect, useMemo, useState } from 'react';
import './DealerSalesPages.css';

const approvedStatuses = new Set(['DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI']);
const scopeLabels = {
  company: 'Seluruh perusahaan',
  branch: 'Per cabang',
  salesperson: 'Per sales',
  branch_salesperson: 'Per cabang & sales',
};

const formatRupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthDates(month) {
  const [year, value] = month.split('-').map(Number);
  const lastDay = new Date(year, value, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function getTargetKey(target) {
  const sales = String(target.salesName || '').trim().toLowerCase();
  if (target.scopeType === 'company') return 'company';
  if (target.scopeType === 'branch') return `branch:${target.branchId}`;
  if (target.scopeType === 'salesperson') return `sales:${sales}`;
  return `branch:${target.branchId}:sales:${sales}`;
}

async function readJson(response, fallback) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || fallback);
  return result;
}

function demoTargetActual(target, spks) {
  const matchingSpks = spks.filter((spk) => approvedStatuses.has(spk.status)
    && (!['branch', 'branch_salesperson'].includes(target.scopeType)
      || target.branchId === 'demo-branch' && (!spk.branchId || spk.branchName === 'Cabang Utama')
      || spk.branchId === target.branchId)
    && (target.scopeType !== 'salesperson'
      && target.scopeType !== 'branch_salesperson'
      || String(spk.sales || spk.salesName || '').toLowerCase()
        === String(target.salesName || '').toLowerCase()));
  return {
    units: matchingSpks.length,
    revenue: matchingSpks.reduce((total, spk) => total + Number(spk.amount || 0), 0),
  };
}

function makeDemoReport(spks) {
  const rows = spks.map((spk) => ({
    id: spk.id,
    spkNumber: spk.spkNumber || spk.id,
    customerName: spk.customer || spk.customerName || '—',
    salesName: spk.sales || spk.salesName || '—',
    status: spk.status,
    amount: spk.amount,
    date: spk.date || spk.createdDate || '',
    branchName: spk.branchName || 'Cabang Utama',
    brand: spk.brand || '',
    model: spk.motor || spk.model || '',
    specification: spk.specification || '',
  }));
  const saleRows = rows.filter((row) => approvedStatuses.has(row.status));
  const dailyGroups = new Map();
  for (const row of rows) {
    const parsedDate = new Date(row.date);
    if (Number.isNaN(parsedDate.getTime())) continue;
    const date = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
    const item = dailyGroups.get(date) || { date, spkCount: 0, salesCount: 0, revenue: 0 };
    item.spkCount += 1;
    if (approvedStatuses.has(row.status)) {
      item.salesCount += 1;
      item.revenue += Number(row.amount || 0);
    }
    dailyGroups.set(date, item);
  }
  const groupBy = (key) => {
    const groups = new Map();
    for (const row of rows) {
      const name = key === 'sales' ? row.salesName : row.branchName;
      const item = groups.get(name) || { name, spkCount: 0, salesCount: 0, revenue: 0 };
      item.spkCount += 1;
      if (approvedStatuses.has(row.status)) {
        item.salesCount += 1;
        item.revenue += Number(row.amount || 0);
      }
      groups.set(name, item);
    }
    return [...groups.values()];
  };
  return {
    summary: {
      spkCount: rows.length,
      salesCount: saleRows.length,
      revenue: saleRows.reduce((total, row) => total + Number(row.amount || 0), 0),
      deliveredCount: rows.filter((row) => row.status === 'SELESAI').length,
      rejectedCount: rows.filter((row) => row.status === 'DITOLAK').length,
      pendingCount: rows.filter((row) => ['SUBMITTED', 'APPROVAL SVP'].includes(row.status)).length,
    },
    daily: [...dailyGroups.values()].sort((left, right) => left.date.localeCompare(right.date)),
    branches: groupBy('branch'),
    salespeople: groupBy('sales'),
    records: rows,
  };
}

export function DealerTargetsPage({
  isAuthenticated,
  canManage,
  branches = [],
  spks = [],
}) {
  const [month, setMonth] = useState(currentMonth);
  const [targets, setTargets] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [scopeType, setScopeType] = useState('company');
  const [branchId, setBranchId] = useState('');
  const [salesName, setSalesName] = useState('');
  const [unitTarget, setUnitTarget] = useState('');
  const [revenueTarget, setRevenueTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const availableBranches = branches.length
    ? branches
    : isAuthenticated ? [] : [{ id: 'demo-branch', name: 'Cabang Utama' }];

  const loadTargets = async (period = month) => {
    setError('');
    if (!isAuthenticated) {
      try {
        const saved = JSON.parse(localStorage.getItem('kelolausaha.demo.sales-targets') || '[]');
        setTargets(Array.isArray(saved) ? saved.filter((target) => target.month === period) : []);
        setSalespeople([...new Set(spks.map((spk) => spk.sales || spk.salesName).filter(Boolean))]);
      } catch {
        setError('Target demo tersimpan tidak dapat dibaca dari penyimpanan browser.');
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const result = await readJson(
        await fetch(`/api/dealer-motor/sales-targets?month=${encodeURIComponent(period)}`),
        'Data target penjualan tidak dapat dimuat.',
      );
      if (!Array.isArray(result.targets) || !Array.isArray(result.salespeople)) {
        throw new Error('Data target penjualan dari server tidak valid.');
      }
      setTargets(result.targets);
      setSalespeople(result.salespeople);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargets(month);
  }, [month, isAuthenticated, spks]);

  const saveTarget = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const needsBranch = ['branch', 'branch_salesperson'].includes(scopeType);
    const needsSalesperson = ['salesperson', 'branch_salesperson'].includes(scopeType);
    const payload = {
      month,
      scopeType,
      branchId: needsBranch ? branchId : null,
      salesName: needsSalesperson ? salesName.trim() : null,
      unitTarget: Number(unitTarget),
      revenueTarget: Number(revenueTarget),
    };
    if ((needsBranch && !payload.branchId) || (needsSalesperson && !payload.salesName)) {
      setError('Pilih cabang dan isi nama sales sesuai cakupan target.');
      return;
    }
    setSaving(true);
    try {
      if (!isAuthenticated) {
        const saved = JSON.parse(localStorage.getItem('kelolausaha.demo.sales-targets') || '[]');
        if (!Array.isArray(saved)) throw new Error('Data target demo di browser tidak valid.');
        const target = { ...payload, month, id: getTargetKey(payload) };
        const allTargets = saved.filter((item) => !(item.month === month && getTargetKey(item) === getTargetKey(target)));
        allTargets.push(target);
        localStorage.setItem('kelolausaha.demo.sales-targets', JSON.stringify(allTargets));
        setNotice('Target demo disimpan di browser ini saja.');
      } else {
        await readJson(
          await fetch('/api/dealer-motor/sales-targets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          'Target penjualan tidak dapat disimpan.',
        );
        setNotice('Target penjualan berhasil disimpan.');
      }
      await loadTargets(month);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const editTarget = (target) => {
    setScopeType(target.scopeType);
    setBranchId(target.branchId || '');
    setSalesName(target.salesName || '');
    setUnitTarget(String(target.unitTarget ?? 0));
    setRevenueTarget(String(target.revenueTarget ?? 0));
  };

  return (
    <section className="content dealer-sales-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENJUALAN <span>/</span> TARGET</div>
          <h1>Target Penjualan</h1>
          <p>Atur sasaran unit/SPK dan omzet untuk perusahaan, cabang, atau sales.</p>
        </div>
        <label className="dealer-period-field"><span>Periode target</span><input aria-label="Periode target" onChange={(event) => setMonth(event.target.value)} type="month" value={month} /></label>
      </div>
      {!isAuthenticated && <div className="notice">Mode demo: perubahan target hanya disimpan di browser ini dan tidak mengubah data perusahaan.</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      {canManage && <form className="dealer-target-form" onSubmit={saveTarget}>
        <div className="dealer-sales-section-heading"><div><h2>Atur target</h2><p>Target disimpan per periode dan cakupan.</p></div></div>
        <div className="dealer-target-fields">
          <label className="field"><span>Cakupan target</span><select onChange={(event) => setScopeType(event.target.value)} value={scopeType}>
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {['branch', 'branch_salesperson'].includes(scopeType) && <label className="field"><span>Cabang</span><select onChange={(event) => setBranchId(event.target.value)} required value={branchId}>
            <option value="">Pilih cabang</option>
            {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select></label>}
          {['salesperson', 'branch_salesperson'].includes(scopeType) && <label className="field"><span>Nama sales</span><input list="dealer-target-salespeople" onChange={(event) => setSalesName(event.target.value)} placeholder="Pilih atau masukkan nama sales" required value={salesName} />
            <datalist id="dealer-target-salespeople">{salespeople.map((name) => <option key={name} value={name} />)}</datalist>
          </label>}
          <label className="field"><span>Target unit / SPK</span><input min="0" onChange={(event) => setUnitTarget(event.target.value)} required type="number" value={unitTarget} /></label>
          <label className="field"><span>Target omzet (Rp)</span><input min="0" onChange={(event) => setRevenueTarget(event.target.value)} required type="number" value={revenueTarget} /></label>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan…' : 'Simpan target'} <span>→</span></button>
        </div>
      </form>}

      <section className="table-card dealer-targets-card">
        <div className="table-heading"><div><h2>Target periode ini</h2><p>Realisasi menghitung SPK yang sudah disetujui, sedang dikirim, atau selesai.</p></div></div>
        {loading ? <p className="dealer-empty-state">Memuat target…</p> : targets.length === 0
          ? <p className="dealer-empty-state">Belum ada target untuk periode ini.</p>
          : <div className="table-scroll"><table><thead><tr><th>CAKUPAN</th><th>TARGET UNIT</th><th>REALISASI UNIT</th><th>TARGET OMZET</th><th>REALISASI OMZET</th><th>PROGRES</th>{canManage && <th />}</tr></thead><tbody>
            {targets.map((target) => {
              const actual = isAuthenticated
                ? { units: Number(target.actualUnitCount || 0), revenue: Number(target.actualRevenue || 0) }
                : demoTargetActual(target, spks);
              const unitProgress = Number(target.unitTarget) > 0 ? Math.round(actual.units / Number(target.unitTarget) * 100) : null;
              const revenueProgress = Number(target.revenueTarget) > 0 ? Math.round(actual.revenue / Number(target.revenueTarget) * 100) : null;
              const progress = [unitProgress, revenueProgress].filter((value) => value !== null);
              return <tr key={target.id || getTargetKey(target)}>
                <td><strong>{scopeLabels[target.scopeType]}</strong><small>{[target.branchName, target.salesName].filter(Boolean).join(' · ') || 'Semua cabang dan sales'}</small></td>
                <td>{Number(target.unitTarget || 0)} unit</td><td>{actual.units} unit</td>
                <td>{formatRupiah(target.revenueTarget)}</td><td>{formatRupiah(actual.revenue)}</td>
                <td>{progress.length ? `${Math.min(...progress)}%` : '—'}</td>
                {canManage && <td><button className="text-button" onClick={() => editTarget(target)} type="button">Ubah</button></td>}
              </tr>;
            })}
          </tbody></table></div>}
      </section>
    </section>
  );
}

export function DealerSalesReportPage({
  isAuthenticated,
  canViewAllBranches,
  currentBranchId,
  branches = [],
  spks = [],
}) {
  const defaults = useMemo(() => monthDates(currentMonth()), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [branchId, setBranchId] = useState(canViewAllBranches ? '' : currentBranchId || '');
  const [report, setReport] = useState(() => makeDemoReport(spks));
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');
  const demoReport = useMemo(() => makeDemoReport(spks), [spks]);
  const visibleBranches = canViewAllBranches
    ? branches
    : branches.filter((branch) => branch.id === currentBranchId);

  useEffect(() => {
    if (!canViewAllBranches && currentBranchId) setBranchId(currentBranchId);
  }, [canViewAllBranches, currentBranchId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReport(demoReport);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const loadReport = async () => {
      setError('');
      setLoading(true);
      try {
        const query = new URLSearchParams({ from, to });
        if (branchId) query.set('branchId', branchId);
        const result = await readJson(
          await fetch(`/api/dealer-motor/sales-report?${query}`),
          'Laporan penjualan tidak dapat dimuat.',
        );
        if (!result.summary || !Array.isArray(result.branches)
          || !Array.isArray(result.salespeople) || !Array.isArray(result.records)) {
          throw new Error('Data laporan penjualan dari server tidak valid.');
        }
        if (!cancelled) setReport(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadReport();
    return () => { cancelled = true; };
  }, [isAuthenticated, from, to, branchId, demoReport]);

  const summary = report?.summary || {};
  const records = report?.records || [];
  return (
    <section className="content dealer-sales-page">
      <div className="page-heading">
        <div><div className="eyebrow">PENJUALAN <span>/</span> LAPORAN</div><h1>Laporan Penjualan</h1><p>Ringkasan SPK, omzet, cabang, dan performa sales pada periode pilihan.</p></div>
      </div>
      {!isAuthenticated && <div className="notice">Mode demo: laporan menggunakan data contoh SPK dan tidak terhubung ke transaksi workspace.</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <form className="dealer-report-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="field"><span>Dari tanggal</span><input aria-label="Dari tanggal" disabled={!isAuthenticated} onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
        <label className="field"><span>Sampai tanggal</span><input aria-label="Sampai tanggal" disabled={!isAuthenticated} onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
        {canViewAllBranches && <label className="field"><span>Cabang</span><select aria-label="Filter cabang" onChange={(event) => setBranchId(event.target.value)} value={branchId}>
          <option value="">Semua cabang</option>
          {visibleBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select></label>}
      </form>

      <div className="dealer-report-stats">
        <article className="stat-card"><div className="stat-top"><span>Total SPK</span><span className="stat-icon blue">▤</span></div><strong>{Number(summary.spkCount || 0)}</strong><div className="stat-foot"><span>Semua status</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>SPK disetujui</span><span className="stat-icon green">✓</span></div><strong>{Number(summary.salesCount || 0)}</strong><div className="stat-foot"><span>Termasuk proses kirim dan selesai</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Total omzet</span><span className="stat-icon purple">Rp</span></div><strong>{formatRupiah(summary.revenue)}</strong><div className="stat-foot"><span>Hanya SPK yang disetujui</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Pengiriman selesai</span><span className="stat-icon orange">↗</span></div><strong>{Number(summary.deliveredCount || 0)}</strong><div className="stat-foot"><span>{Number(summary.pendingCount || 0)} SPK menunggu proses</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Menunggu proses</span><span className="stat-icon orange">◷</span></div><strong>{Number(summary.pendingCount || 0)}</strong><div className="stat-foot"><span>Belum disetujui</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>SPK ditolak</span><span className="stat-icon purple">×</span></div><strong>{Number(summary.rejectedCount || 0)}</strong><div className="stat-foot"><span>Tidak masuk perhitungan omzet</span></div></article>
      </div>
      {loading && <p className="dealer-empty-state">Memuat laporan…</p>}
      {!loading && <div className="dealer-report-breakdowns">
        <section className="table-card">
          <div className="table-heading"><div><h2>Tren harian</h2><p>Jumlah SPK dan omzet penjualan yang disetujui per tanggal.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>TANGGAL</th><th>TOTAL SPK</th><th>DISETUJUI</th><th>OMZET</th></tr></thead><tbody>
            {report.daily?.length ? report.daily.map((item) => <tr key={item.date}><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${item.date}T00:00:00`))}</td><td>{Number(item.spkCount || 0)}</td><td>{Number(item.salesCount || 0)}</td><td>{formatRupiah(item.revenue)}</td></tr>) : <tr><td colSpan="4">Belum ada data pada periode ini.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="table-card">
          <div className="table-heading"><div><h2>Rekap per cabang</h2><p>Jumlah SPK dan omzet yang disetujui.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>CABANG</th><th>TOTAL SPK</th><th>DISETUJUI</th><th>OMZET</th></tr></thead><tbody>
            {report.branches.length ? report.branches.map((item) => <tr key={item.branchId || item.name}><td>{item.branchName || item.name}</td><td>{Number(item.spkCount || 0)}</td><td>{Number(item.salesCount || 0)}</td><td>{formatRupiah(item.revenue)}</td></tr>) : <tr><td colSpan="4">Belum ada data pada periode ini.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="table-card">
          <div className="table-heading"><div><h2>Rekap per sales</h2><p>Performa setiap sales, termasuk cabang penugasannya.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>SALES</th><th>CABANG</th><th>TOTAL SPK</th><th>DISETUJUI</th><th>OMZET</th></tr></thead><tbody>
            {report.salespeople.length ? report.salespeople.map((item) => <tr key={`${item.branchId || ''}-${item.salesName || item.name}`}><td>{item.salesName || item.name}</td><td>{item.branchName || '—'}</td><td>{Number(item.spkCount || 0)}</td><td>{Number(item.salesCount || 0)}</td><td>{formatRupiah(item.revenue)}</td></tr>) : <tr><td colSpan="5">Belum ada data pada periode ini.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="table-card">
          <div className="table-heading"><div><h2>Rincian SPK</h2><p>{records.length} data terbaru sesuai periode{records.length === 1000 ? ' (dibatasi 1.000 baris)' : ''}.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>TANGGAL / SPK</th><th>PELANGGAN</th><th>KENDARAAN</th><th>SALES / CABANG</th><th>NILAI OTR</th><th>STATUS</th></tr></thead><tbody>
            {records.length ? records.map((item) => <tr key={item.id}>
              <td><strong>{item.spkNumber || item.id}</strong><small>{item.date}</small></td>
              <td>{item.customerName || item.customer || '—'}</td>
              <td>{[item.brand, item.model, item.specification].filter(Boolean).join(' ') || item.motor || '—'}</td>
              <td>{item.salesName || item.sales || '—'}<small>{item.branchName || ''}</small></td>
              <td>{formatRupiah(item.amount)}</td>
              <td><span className={`status-badge ${(item.status || '').toLowerCase().replaceAll(' ', '-')}`}><span />{item.status}</span></td>
            </tr>) : <tr><td colSpan="6">Belum ada SPK pada periode ini.</td></tr>}
          </tbody></table></div>
        </section>
      </div>}
    </section>
  );
}

export function DealerSalesTeamPage({ spks = [] }) {
  const [query, setQuery] = useState('');
  const salespeople = useMemo(() => {
    const groups = new Map();
    for (const spk of spks) {
      const name = String(spk.sales || spk.salesName || '').trim() || 'Belum ditentukan';
      const person = groups.get(name) || {
        name,
        branchNames: new Set(),
        spkCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        revenue: 0,
      };
      person.spkCount += 1;
      if (approvedStatuses.has(spk.status)) {
        person.approvedCount += 1;
        person.revenue += Number(spk.amount) || 0;
      } else if (['SUBMITTED', 'APPROVAL SVP', 'VERIFIKASI ADMIN'].includes(spk.status)) {
        person.pendingCount += 1;
      } else if (spk.status === 'DITOLAK') {
        person.rejectedCount += 1;
      }
      if (spk.branchName) person.branchNames.add(spk.branchName);
      groups.set(name, person);
    }
    return [...groups.values()].map((person) => ({
      ...person,
      branchNames: [...person.branchNames],
    })).sort((left, right) => right.approvedCount - left.approvedCount || left.name.localeCompare(right.name));
  }, [spks]);
  const visibleSalespeople = salespeople.filter((person) => (
    `${person.name} ${person.branchNames.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const approvedCount = salespeople.reduce((total, person) => total + person.approvedCount, 0);
  const pendingCount = salespeople.reduce((total, person) => total + person.pendingCount, 0);
  const revenue = salespeople.reduce((total, person) => total + person.revenue, 0);

  return (
    <section className="content dealer-sales-page">
      <div className="page-heading">
        <div><div className="eyebrow">ORGANISASI <span>/</span> SALES</div><h1>Tim Sales</h1><p>Pantau pengajuan SPK, penjualan yang disetujui, dan omzet per sales.</p></div>
      </div>
      <div className="dealer-report-stats">
        <article className="stat-card"><div className="stat-top"><span>Sales aktif</span><span className="stat-icon blue">♙</span></div><strong>{salespeople.length}</strong><div className="stat-foot"><span>Memiliki data SPK</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Total SPK</span><span className="stat-icon purple">▤</span></div><strong>{spks.length}</strong><div className="stat-foot"><span>Semua status</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Disetujui</span><span className="stat-icon green">✓</span></div><strong>{approvedCount}</strong><div className="stat-foot"><span>{pendingCount} menunggu proses</span></div></article>
        <article className="stat-card"><div className="stat-top"><span>Omzet disetujui</span><span className="stat-icon orange">Rp</span></div><strong>{formatRupiah(revenue)}</strong><div className="stat-foot"><span>SPK disetujui, dikirim, atau selesai</span></div></article>
      </div>
      <section className="table-card">
        <div className="table-heading">
          <div><h2>Performa per sales</h2><p>Ringkasan dari SPK yang dapat diakses akun Anda.</p></div>
          <input aria-label="Cari sales" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama sales atau cabang..." value={query} />
        </div>
        <div className="table-scroll"><table><thead><tr><th>NAMA SALES</th><th>CABANG</th><th>TOTAL SPK</th><th>DISETUJUI</th><th>MENUNGGU</th><th>DITOLAK</th><th>OMZET DISETUJUI</th></tr></thead><tbody>
          {visibleSalespeople.map((person) => <tr key={person.name}>
            <td><strong>{person.name}</strong></td><td>{person.branchNames.join(', ') || '—'}</td>
            <td>{person.spkCount}</td><td>{person.approvedCount}</td><td>{person.pendingCount}</td>
            <td>{person.rejectedCount}</td><td>{formatRupiah(person.revenue)}</td>
          </tr>)}
          {!visibleSalespeople.length && <tr><td colSpan="7">{query ? 'Sales tidak ditemukan.' : 'Belum ada data SPK untuk sales.'}</td></tr>}
        </tbody></table></div>
      </section>
    </section>
  );
}

function customerIdentity(customer) {
  const phone = String(customer.phone || customer.customerPhone || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;
  const name = String(customer.name || customer.customer || customer.customerName || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
}

export function DealerCustomersPage({
  customers = [],
  isAuthenticated,
  onCustomerCreated,
  spks = [],
}) {
  const [demoCustomers, setDemoCustomers] = useState([]);
  const [createdCustomers, setCreatedCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isAuthenticated) return;
    try {
      const saved = JSON.parse(localStorage.getItem('kelolausaha.demo.dealer-customers') || '[]');
      if (!Array.isArray(saved)) throw new Error('Data pelanggan demo tidak valid.');
      setDemoCustomers(saved);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [isAuthenticated]);

  const customerRows = useMemo(() => {
    const records = new Map();
    for (const customer of [...(isAuthenticated ? customers : demoCustomers), ...createdCustomers]) {
      const key = customerIdentity(customer);
      if (!key) continue;
      records.set(key, {
        ...customer,
        name: customer.name || 'Pelanggan',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        spkCount: 0,
        lastSpkDate: '',
      });
    }
    for (const spk of spks) {
      const key = customerIdentity(spk);
      if (!key) continue;
      const existing = records.get(key) || {
        name: spk.customer || spk.customerName || 'Pelanggan',
        phone: spk.customerPhone || '',
        email: '',
        address: spk.customerAddress || '',
        spkCount: 0,
        lastSpkDate: '',
      };
      existing.spkCount += 1;
      const spkDate = spk.date || spk.createdDate || '';
      if (spkDate && (!existing.lastSpkDate || spkDate > existing.lastSpkDate)) existing.lastSpkDate = spkDate;
      if (!existing.address && spk.customerAddress) existing.address = spk.customerAddress;
      records.set(key, existing);
    }
    return [...records.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [customers, createdCustomers, demoCustomers, isAuthenticated, spks]);
  const visibleCustomers = customerRows.filter((customer) => (
    `${customer.name} ${customer.phone} ${customer.email} ${customer.address}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ));

  const saveCustomer = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };
      let customer;
      if (isAuthenticated) {
        const result = await readJson(await fetch('/api/operations/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }), 'Pelanggan tidak dapat disimpan.');
        if (!result.customer?.id || !result.customer.name) {
          throw new Error('Data pelanggan dari server tidak valid.');
        }
        customer = result.customer;
        setCreatedCustomers((current) => [
          ...current.filter((item) => customerIdentity(item) !== customerIdentity(customer)),
          customer,
        ]);
        onCustomerCreated?.(customer);
      } else {
        customer = { ...payload, id: `demo-customer-${Date.now()}` };
        const identity = customerIdentity(customer);
        const nextCustomers = [
          ...demoCustomers.filter((item) => customerIdentity(item) !== identity),
          customer,
        ];
        localStorage.setItem('kelolausaha.demo.dealer-customers', JSON.stringify(nextCustomers));
        setDemoCustomers(nextCustomers);
        setCreatedCustomers((current) => [
          ...current.filter((item) => customerIdentity(item) !== identity),
          customer,
        ]);
      }
      setForm({ name: '', phone: '', email: '', address: '' });
      setNotice(`${customer.name} berhasil ditambahkan ke daftar pelanggan.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="content dealer-sales-page">
      <div className="page-heading">
        <div><div className="eyebrow">ORGANISASI <span>/</span> CUSTOMER</div><h1>Data Pelanggan</h1><p>Kelola kontak pelanggan dan lihat riwayat pengajuan SPK mereka.</p></div>
      </div>
      {!isAuthenticated && <div className="notice">Mode demo: pelanggan baru hanya disimpan di browser ini.</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <form className="dealer-customer-form" onSubmit={saveCustomer}>
        <div className="dealer-sales-section-heading"><div><h2>Tambah pelanggan</h2><p>Kontak pelanggan disimpan pada workspace ini.</p></div></div>
        <div className="dealer-customer-fields">
          <label className="field"><span>Nama pelanggan</span><input autoComplete="name" maxLength="160" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></label>
          <label className="field"><span>Nomor telepon</span><input autoComplete="tel" maxLength="30" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} /></label>
          <label className="field"><span>Email</span><input autoComplete="email" maxLength="254" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" value={form.email} /></label>
          <label className="field"><span>Alamat</span><input autoComplete="street-address" maxLength="500" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} value={form.address} /></label>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan…' : 'Simpan pelanggan'}</button>
        </div>
      </form>
      <section className="table-card">
        <div className="table-heading">
          <div><h2>Daftar pelanggan</h2><p>{customerRows.length} pelanggan terdaftar atau tercatat pada SPK.</p></div>
          <input aria-label="Cari pelanggan" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, telepon, atau email..." value={query} />
        </div>
        <div className="table-scroll"><table><thead><tr><th>NAMA PELANGGAN</th><th>TELEPON</th><th>EMAIL</th><th>ALAMAT</th><th>TOTAL SPK</th><th>SPK TERAKHIR</th></tr></thead><tbody>
          {visibleCustomers.map((customer) => <tr key={customer.id || customerIdentity(customer)}>
            <td><strong>{customer.name}</strong></td><td>{customer.phone || '—'}</td><td>{customer.email || '—'}</td>
            <td>{customer.address || '—'}</td><td>{customer.spkCount}</td><td>{customer.lastSpkDate || '—'}</td>
          </tr>)}
          {!visibleCustomers.length && <tr><td colSpan="6">{query ? 'Pelanggan tidak ditemukan.' : 'Belum ada pelanggan atau SPK.'}</td></tr>}
        </tbody></table></div>
      </section>
    </section>
  );
}
