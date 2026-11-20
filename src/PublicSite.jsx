import './PublicSite.css';
import { plans } from '../shared/plans.js';

const industries = [
  ['Laundry', 'Harga per kg atau pcs, status cucian, dan jadwal pengambilan.'],
  ['Dealer motor', 'Stok unit, data sales, SPK, leasing, dan laporan penjualan.'],
  ['Toko & retail', 'Produk, harga, stok, transaksi kasir, dan riwayat pelanggan.'],
  ['Restoran & kafe', 'Menu, pesanan, meja, pembayaran, dan struk digital.'],
  ['Bengkel', 'Jasa servis, sparepart, mekanik, dan riwayat kendaraan.'],
  ['Salon & jasa', 'Daftar layanan, booking, antrean, dan catatan pelanggan.'],
];

const capabilities = [
  ['POS & kasir', 'Catat penjualan, hitung total dan kembalian, serta simpan riwayat transaksi.'],
  ['Produk, jasa & harga', 'Atur katalog dan satuan harga sesuai kebutuhan usaha.'],
  ['Nota digital WhatsApp', 'Bagikan rincian pembayaran dengan pesan WhatsApp siap dikirim.'],
  ['Tim & hak akses', 'Kelola anggota workspace dan atur akses per peran.'],
  ['Operasional usaha', 'Susun modul produk, pelanggan, inventori, pembelian, dan cabang.'],
  ['Keuangan & laporan', 'Siapkan pencatatan kas, pemasukan, pengeluaran, dan ringkasan usaha.'],
];

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function PublicSite({ onLogin, onRegister, onPreview, statusMessage }) {
  return (
    <main className="public-site">
      <header className="public-header">
        <a className="public-brand" href="#beranda" aria-label="KelolaUsaha.store beranda">
          <img className="public-brand-logo" src="/kelolausaha-logo.svg" alt="KelolaUsaha.store — operasional usaha terpadu" />
        </a>
        <nav className="public-nav" aria-label="Navigasi website">
          <a href="#fitur">Fitur</a>
          <a href="#jenis-usaha">Jenis usaha</a>
          <a href="#paket">Paket</a>
        </nav>
        <div className="public-header-actions">
          <a href="#masuk" onClick={(event) => { event.preventDefault(); onLogin(); }}>Masuk</a>
          <a className="public-button public-button-small" href="#daftar" onClick={(event) => { event.preventDefault(); onRegister(); }}>Daftar</a>
        </div>
      </header>
      {statusMessage && <div className="public-service-notice" role="status">{statusMessage}</div>}

      <section className="public-hero" id="beranda">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><i /> PLATFORM OPERASIONAL UNTUK USAHA</span>
          <h1>Kelola usaha lebih <em>terarah.</em></h1>
          <p>Satukan penjualan, kasir, tim, pelanggan, dan aktivitas usaha dalam satu workspace yang dapat disesuaikan dengan kebutuhan bisnis Anda.</p>
          <div className="public-hero-actions">
            <button className="public-button" onClick={onRegister} type="button">Mulai demo gratis <span>→</span></button>
            <a className="public-secondary-link" href="#fitur">Jelajahi fitur <span>↓</span></a>
          </div>
          <div className="public-trial-note"><span>✓</span> Demo 1 bulan · Tanpa biaya di awal</div>
        </div>
        <div className="public-hero-visual" aria-label="Pratinjau dashboard KelolaUsaha.store">
          <div className="public-window">
            <div className="public-window-top"><span /><span /><span /><small>KELOLAUSAHA.STORE</small></div>
            <div className="public-window-content">
              <div className="public-window-sidebar"><b>KU</b><i /><i /><i /><i /></div>
              <div className="public-window-main">
                <small>RINGKASAN USAHA</small><strong>Selamat datang 👋</strong>
                <div className="public-mini-stats"><span><i>TRANSAKSI</i><b>POS</b></span><span><i>WORKSPACE</i><b>Terpadu</b></span></div>
                <div className="public-mini-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
                <div className="public-mini-receipt"><span>Nota digital</span><b>Siap dibagikan <em>✓</em></b></div>
              </div>
            </div>
          </div>
          <div className="public-float-card"><span>✦</span><div><strong>Usaha dalam kendali</strong><small>Operasional lebih tertata</small></div></div>
        </div>
        <div className="public-hero-glow" />
      </section>

      <section className="public-trust-strip" id="keuntungan">
        <span>DIRANCANG UNTUK MENDUKUNG</span>
        <strong>Operasional</strong><i /> <strong>Tim</strong><i /> <strong>Transaksi</strong><i /> <strong>Pertumbuhan usaha</strong>
      </section>

      <section className="public-section public-features" id="fitur">
        <div className="public-section-heading">
          <span className="public-eyebrow">FITUR PLATFORM</span>
          <h2>Hal penting untuk usaha,<br /><em>tersedia dalam satu workspace.</em></h2>
          <p>Mulai dari pencatatan penjualan hingga pengelolaan tim. Aktifkan modul yang relevan untuk alur kerja usaha Anda.</p>
        </div>
        <div className="public-feature-grid">
          {capabilities.map(([title, description], index) => <article className="public-feature-card" key={title}>
            <span className={`public-feature-icon icon-${index}`}>{['＋', 'Rp', '▧', '♙', '▦', '↗'][index]}</span>
            <h3>{title}</h3><p>{description}</p>
            <span className="public-feature-arrow">↗</span>
          </article>)}
        </div>
      </section>

      <section className="public-industry-section" id="jenis-usaha">
        <div className="public-section public-industries">
          <div className="public-section-heading">
            <span className="public-eyebrow">SATU PLATFORM, BANYAK JENIS USAHA</span>
            <h2>Alur kerja yang mengikuti<br /><em>jenis bisnis Anda.</em></h2>
            <p>Struktur workspace awal tersedia untuk dealer motor dan dapat dikembangkan sesuai kebutuhan usaha lainnya.</p>
          </div>
          <div className="public-industry-grid">
            {industries.map(([title, description], index) => <article className={`public-industry-card ${index === 1 ? 'industry-highlight' : ''}`} key={title}>
              <span>{['◌', '⌂', '▦', '◉', '⚙', '✦'][index]}</span><h3>{title}</h3><p>{description}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="public-section public-benefits">
        <div className="public-benefits-copy">
          <span className="public-eyebrow">KENAPA KELOLAUSAHA.STORE?</span>
          <h2>Lebih jelas mengelola,<br /><em>lebih siap berkembang.</em></h2>
          <p>Kurangi pekerjaan yang tersebar di banyak catatan. Beri tim ruang kerja yang jelas, dan pantau aktivitas usaha dari satu tempat.</p>
          <button className="public-text-button" onClick={onRegister} type="button">Buat workspace usaha <span>→</span></button>
        </div>
        <div className="public-benefit-list">
          {[
            ['01', 'Satu workspace untuk aktivitas usaha', 'Simpan proses dan informasi kerja secara lebih teratur.'],
            ['02', 'Akses sesuai peran tim', 'Berikan tanggung jawab dan hak akses yang sesuai kebutuhan.'],
            ['03', 'Modul mengikuti kebutuhan', 'Mulai dari alur dealer motor, lalu aktifkan modul yang diperlukan.'],
            ['04', 'Siap melayani pelanggan', 'Catat transaksi dan bagikan nota digital melalui WhatsApp.'],
          ].map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><b>↗</b></article>)}
        </div>
      </section>

      <section className="public-pricing-section" id="paket">
        <div className="public-section public-pricing">
          <div className="public-section-heading">
            <span className="public-eyebrow">PAKET AKTIVASI</span>
            <h2>Mulai gratis, pilih paket<br /><em>saat siap melanjutkan.</em></h2>
            <p>Setiap workspace baru mendapat demo selama satu bulan. Aktivasi dan pembayaran dilakukan oleh Super Admin.</p>
          </div>
          <div className="public-price-grid">
            {plans.map((plan) => <article className={`public-price-card ${plan.featured ? 'price-featured' : ''}`} key={plan.id}>
              {plan.id === 'year_1' && <span className="public-price-tag">PALING HEMAT</span>}
              <h3>{plan.label}</h3><strong>{rupiah(plan.amount)}</strong><small>{plan.duration}</small>
              <button onClick={onRegister} type="button">Mulai demo <span>→</span></button>
            </article>)}
          </div>
          <p className="public-payment-note">Pembayaran paket diproses melalui Midtrans setelah masuk ke akun Super Admin.</p>
        </div>
      </section>

      <section className="public-final-cta">
        <span className="public-eyebrow">LANGKAH PERTAMA DIMULAI DI SINI</span>
        <h2>Siapkan workspace usaha Anda.</h2>
        <p>Daftar dan mulai gunakan demo KelolaUsaha.store selama satu bulan.</p>
        <button className="public-button" onClick={onRegister} type="button">Daftar gratis <span>→</span></button>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="#beranda"><img className="public-brand-logo" src="/kelolausaha-logo.svg" alt="KelolaUsaha.store — operasional usaha terpadu" /></a>
        <span>© 2026 KelolaUsaha.store. Hak cipta dilindungi.</span>
        <button onClick={onPreview} type="button">Pratinjau dashboard Owner</button>
      </footer>
    </main>
  );
}

export default PublicSite;
