import { useEffect, useMemo, useState } from 'react';
import { industryWorkflows } from '../shared/industry-workflows.js';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currency.format(Number(value) || 0);
}

function formatDate(value, options = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat('id-ID', options).format(new Date(value));
}

function parseChartDate(value) {
  const dateOnly = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (dateOnly && (date.getFullYear() !== Number(dateOnly[1])
    || date.getMonth() !== Number(dateOnly[2]) - 1
    || date.getDate() !== Number(dateOnly[3]))) return null;
  return date;
}

export default function IndustryDashboard({
  businessType,
  workspaceName,
  role,
  trialCountdown,
  trialEndsAt,
  onActivate,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const workflow = industryWorkflows[businessType] || industryWorkflows.dealer_motor;
  const weeklyMaximum = useMemo(
    () => Math.max(0, ...(data?.weeklySales || []).map((day) => Number(day.total) || 0)),
    [data],
  );
  const isOwner = role === 'OWNER';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/operations/dashboard');
        if (!response.ok) {
          let message = 'Ringkasan usaha tidak dapat dimuat.';
          try {
            message = (await response.json()).message || message;
          } catch {
            // Use the explicit fallback message when the server response is not JSON.
          }
          throw new Error(message);
        }
        const dashboard = await response.json();
        if (!cancelled) {
          setData(dashboard);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Ringkasan usaha tidak dapat dimuat.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const summary = data?.summary || {};
  const statuses = new Map((data?.statuses || []).map((item) => [item.status, item.count]));
  const statusLabels = new Map(workflow.statuses);
  const visibleStatuses = workflow.statuses.filter(([status]) => statuses.has(status));
  const maximumStatusCount = Math.max(1, ...visibleStatuses.map(([status]) => statuses.get(status)));

  return (
    <section className="content industry-dashboard">
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">{workflow.label.toUpperCase()} <span>/</span> RINGKASAN USAHA</div>
          <h1>Dashboard</h1>
          <p>Pantau operasional <strong>{workspaceName}</strong> berdasarkan data workspace Anda.</p>
        </div>
      </div>

      {isOwner && trialCountdown && <section aria-label="Hitung mundur masa demo" className="owner-trial-countdown" role="status">
        <span className="owner-trial-icon">◷</span>
        <div><strong>Demo gratis tersisa</strong><span>{trialCountdown.days} hari {`${trialCountdown.hours}`.padStart(2, '0')}:{`${trialCountdown.minutes}`.padStart(2, '0')}:{`${trialCountdown.seconds}`.padStart(2, '0')}</span></div>
        <p>Berakhir {formatDate(trialEndsAt, { dateStyle: 'long', timeStyle: 'short' })}</p>
        <button className="button button-primary" onClick={onActivate} type="button">Pilih paket <span>→</span></button>
      </section>}

      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {loading && !data && <div className="table-card dashboard-loading" role="status">Memuat ringkasan operasional…</div>}
      {!loading && !data && !error && <div className="table-card dashboard-loading">Belum ada data operasional.</div>}

      {data && <>
        <div className="overview-banner">
          <div className="banner-emblem">W</div>
          <div className="banner-copy"><span>WORKSPACE USAHA</span><strong>{workspaceName}</strong><small>Ringkasan khusus {workflow.label}.</small></div>
          <div className="banner-date"><span>HARI INI</span><strong>{formatDate(new Date(), { dateStyle: 'long' })}</strong><small>Data diperbarui otomatis setiap menit.</small></div>
          <div className="banner-decoration">KU</div>
        </div>

        <div className="section-heading"><div><h2>Ringkasan usaha</h2><p>Angka dari transaksi dan stok workspace</p></div></div>
        <div className="stats-grid">
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Penjualan hari ini</span><span className="stat-icon blue">Rp</span></div><strong>{formatCurrency(data.financials?.salesToday)}</strong><div className="stat-foot"><span>Transaksi dibuat hari ini</span></div></article>}
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Penjualan bulan ini</span><span className="stat-icon green">↗</span></div><strong>{formatCurrency(data.financials?.salesMonth)}</strong><div className="stat-foot"><span>Bulan berjalan</span></div></article>}
          <article className="stat-card stat-shadow"><div className="stat-top"><span>Pesanan hari ini</span><span className="stat-icon blue">▤</span></div><strong>{summary.ordersToday || 0}</strong><div className="stat-foot"><span>Pesanan baru</span></div></article>
          <article className="stat-card stat-shadow"><div className="stat-top"><span>Pesanan aktif</span><span className="stat-icon orange">◷</span></div><strong>{summary.activeOrders || 0}</strong><div className="stat-foot"><span>Masih dalam proses</span></div></article>
          <article className="stat-card stat-shadow"><div className="stat-top"><span>Stok perlu diperiksa</span><span className="stat-icon purple">!</span></div><strong>{summary.lowStockProducts || 0}</strong><div className="stat-foot"><span>Produk mencapai batas minimum</span></div></article>
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Piutang berjalan</span><span className="stat-icon orange">Rp</span></div><strong>{formatCurrency(data.financials?.receivables)}</strong><div className="stat-foot"><span>{summary.unpaidOrders || 0} transaksi belum lunas</span></div></article>}
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Pemasukan tercatat</span><span className="stat-icon green">＋</span></div><strong>{formatCurrency(data.financials?.ledgerIncome)}</strong><div className="stat-foot"><span>Pembukuan bulan ini</span></div></article>}
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Pengeluaran tercatat</span><span className="stat-icon orange">−</span></div><strong>{formatCurrency(data.financials?.ledgerExpense)}</strong><div className="stat-foot"><span>Pembukuan bulan ini</span></div></article>}
          {isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Laba / rugi pembukuan</span><span className="stat-icon purple">Rp</span></div><strong>{formatCurrency(data.financials?.netProfit)}</strong><div className="stat-foot"><span>Pemasukan dikurangi pengeluaran</span></div></article>}
          {!isOwner && <article className="stat-card stat-shadow"><div className="stat-top"><span>Transaksi belum lunas</span><span className="stat-icon orange">◷</span></div><strong>{summary.unpaidOrders || 0}</strong><div className="stat-foot"><span>Perlu tindak lanjut kasir</span></div></article>}
        </div>

        <div className="dashboard-insights">
          <section className="table-card dashboard-chart">
            <div className="table-heading"><div><h2>{isOwner ? 'Penjualan 7 hari terakhir' : 'Pesanan 7 hari terakhir'}</h2><p>Ringkasan harian workspace</p></div></div>
            <div className="weekly-sales-chart">
              {(data.weeklySales || []).map((day, index) => {
                const amount = Number(day.total) || 0;
                const date = parseChartDate(day.date);
                const dayLabel = date
                  ? new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date)
                  : '—';
                return <div className="weekly-sales-day" key={day.date || index} title={`${date ? formatDate(date) : 'Tanggal tidak tersedia'}: ${isOwner ? formatCurrency(amount) : `${amount} pesanan`}`}>
                  <strong>{isOwner ? formatCurrency(amount) : ''}</strong>
                  <span className="weekly-sales-track"><i style={{ height: `${weeklyMaximum ? Math.max(4, (amount / weeklyMaximum) * 100) : 4}%` }} /></span>
                  <small>{dayLabel}</small>
                </div>;
              })}
            </div>
          </section>
          <section className="table-card dashboard-statuses">
            <div className="table-heading"><div><h2>Tahapan {workflow.orderLabel.toLowerCase()}</h2><p>Status operasional saat ini</p></div></div>
            {visibleStatuses.length === 0 && <p className="empty-state">Belum ada pesanan untuk ditampilkan.</p>}
            {visibleStatuses.map(([status]) => <div className="workflow-status-row" key={status}>
              <span>{statusLabels.get(status)}</span><strong>{statuses.get(status)}</strong>
              <i><span style={{ width: `${(statuses.get(status) / maximumStatusCount) * 100}%` }} /></i>
            </div>)}
          </section>
        </div>

        {isOwner && data.branchReport?.length > 0 && <section className="table-card owner-branch-dashboard">
          <div className="table-heading"><div><h2>Performa setiap cabang</h2><p>Laporan bulan berjalan, terpisah per cabang</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>CABANG</th><th>PESANAN</th><th>PENJUALAN</th><th>PEMASUKAN PEMBUKUAN</th><th>PENGELUARAN</th></tr></thead><tbody>
            {data.branchReport.map((branch) => <tr key={branch.branchId}><td>{branch.branchName}</td><td>{branch.orderCount}</td><td className="amount">{formatCurrency(branch.salesTotal)}</td><td className="amount">{formatCurrency(branch.ledgerIncome)}</td><td className="amount">{formatCurrency(branch.ledgerExpense)}</td></tr>)}
          </tbody></table></div>
        </section>}

        <section className="table-card">
          <div className="table-heading"><div><h2>Aktivitas terbaru</h2><p>Pesanan yang terakhir dibuat pada workspace</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>NO. PESANAN</th><th>PELANGGAN</th><th>JENIS PESANAN</th><th>STATUS</th><th>PEMBAYARAN</th>{isOwner && <th>NILAI</th>}<th>WAKTU</th></tr></thead><tbody>
            {(data.recentOrders || []).map((order) => <tr key={order.id}>
              <td><strong>{order.orderNumber}</strong></td><td>{order.customerName}</td><td>{order.orderType}</td>
              <td><span className={`status-badge status-${order.status}`}>{statusLabels.get(order.status) || order.status}</span></td>
              <td>{order.paymentStatus === 'paid' ? 'Lunas' : order.paymentStatus === 'partial' ? 'Sebagian' : 'Belum lunas'}</td>
              {isOwner && <td className="amount">{formatCurrency(order.total)}</td>}
              <td>{formatDate(order.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
            </tr>)}
          </tbody></table></div>
          {!data.recentOrders?.length && <p className="empty-state">Belum ada transaksi. Data akan muncul setelah pesanan pertama dibuat.</p>}
        </section>
      </>}
    </section>
  );
}
