import { useMemo, useState } from 'react';
import {
  dashboardThemes,
  defaultDashboardThemeSettings,
  getThemeColors,
} from './themes.js';
import './DashboardThemeSettings.css';

const categories = [
  ['gallery', 'Galeri Tema'],
  ['colors', 'Warna & Identitas'],
  ['type', 'Tipografi'],
  ['layout', 'Layout Dashboard'],
  ['sidebar', 'Sidebar & Navigasi'],
  ['header', 'Header Dashboard'],
  ['cards', 'Kartu & Komponen'],
  ['buttons', 'Tombol & Bentuk'],
  ['mode', 'Mode Tampilan'],
  ['advanced', 'Pengaturan Lanjutan'],
];

const fontOptions = ['Inter', 'Poppins', 'Roboto', 'Nunito', 'Plus Jakarta Sans', 'Lato'];
const colorOptions = [
  ['customPrimary', 'Warna utama', 'primary'],
  ['customSecondary', 'Warna sekunder', 'secondary'],
  ['customAccent', 'Warna aksen', 'accent'],
  ['customBackground', 'Background dashboard', 'background'],
  ['customSurface', 'Warna kartu', 'surface'],
  ['customSidebar', 'Warna sidebar', 'sidebar'],
  ['customHeader', 'Warna header', 'header'],
  ['customText', 'Teks utama', 'text'],
  ['customTextMuted', 'Teks sekunder', 'textMuted'],
  ['customBorder', 'Warna border', 'border'],
];

const isValidHex = (value) => value === '' || /^#[0-9a-f]{6}$/i.test(value);

function SelectField({ label, value, options, onChange }) {
  return <label className="theme-field">
    <span>{label}</span>
    <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
  </label>;
}

function RangeField({ label, value, min, max, unit = '', onChange }) {
  return <label className="theme-range-field">
    <span>{label}<strong>{value}{unit}</strong></span>
    <input aria-label={label} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="range" value={value} />
  </label>;
}

function ToggleField({ label, checked, onChange }) {
  return <label className="theme-toggle-field">
    <span>{label}</span>
    <input aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
  </label>;
}

function ThemePreview({ settings, expanded = false }) {
  const systemDarkMode = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const colors = getThemeColors(settings, systemDarkMode);
  const style = {
    '--theme-primary': colors.primary,
    '--theme-secondary': colors.secondary,
    '--theme-accent': colors.accent,
    '--theme-background': colors.background,
    '--theme-surface': colors.surface,
    '--theme-sidebar': colors.sidebar,
    '--theme-header': colors.header,
    '--theme-text': colors.text,
    '--theme-text-muted': colors.textMuted,
    '--theme-border': colors.border,
    '--theme-font-family': settings.fontFamily,
    '--theme-card-radius': `${settings.cardRadius}px`,
    '--theme-button-radius': `${settings.buttonRadius}px`,
    '--theme-card-gap': `${settings.componentGap * 0.6}px`,
    '--theme-card-padding': `${settings.cardPadding * 0.55}px`,
    '--theme-font-size': `${settings.fontSize * 0.55}px`,
    '--theme-font-weight': settings.fontWeight,
    '--theme-title-size': `${settings.titleSize * 0.5}px`,
    '--theme-menu-size': `${settings.menuTextSize * 0.55}px`,
    '--theme-header-height': `${settings.headerHeight * 0.6}px`,
    '--theme-sidebar-icon-size': `${settings.sidebarIconSize}px`,
    '--theme-sidebar-gap': `${settings.sidebarMenuGap}px`,
    '--theme-sidebar-active-radius': `${settings.sidebarActiveRadius}px`,
    '--theme-stat-card-columns': settings.statCardColumns,
    '--theme-button-height': `${settings.buttonHeight * 0.6}px`,
    '--theme-button-text-size': `${settings.buttonTextSize * 0.5}px`,
    '--theme-content-padding': `${settings.contentPadding * 0.5}px`,
    '--theme-card-shadow': settings.cardShadow,
  };
  return <div
    className={`theme-preview-frame${expanded ? ' is-expanded' : ''}`}
    data-density={settings.density}
    data-header={settings.headerStyle}
    data-header-shadow={settings.headerShadow}
    data-layout={settings.layout}
    data-mode={settings.mode}
    data-sidebar={settings.sidebarMode}
    data-sidebar-content={settings.sidebarContent}
    data-sidebar-icons={settings.sidebarIcons}
    data-card-style={settings.cardStyle}
    data-card-shadow={settings.cardShadow}
    data-card-border={settings.cardBorder}
    data-button-style={settings.buttonStyle}
    data-button-outline={settings.buttonOutline}
    data-notifications={settings.showNotifications}
    data-logo-position={settings.logoPosition}
    style={style}
  >
    <aside className="theme-preview-sidebar">
      <div className="theme-preview-brand"><span>{settings.dashboardLogoUrl ? <img alt="" src={settings.dashboardLogoUrl} /> : 'KU'}</span><strong>KelolaUsaha</strong></div>
      {['Dashboard', 'Penjualan', 'Pelanggan', 'Laporan'].map((item, index) => <div className={`theme-preview-nav${index === 0 ? ' active' : ''}`} key={item}><i /><span>{item}</span></div>)}
    </aside>
    <div className="theme-preview-main">
      <header className="theme-preview-header">
        {settings.logoPosition === 'header' && <span className="theme-preview-header-brand">{settings.dashboardLogoUrl ? <img alt="" src={settings.dashboardLogoUrl} /> : 'KU'}</span>}
        <span>Workspace / Dashboard</span>
        {settings.showNotifications && <b>●</b>}
        {settings.showUserProfile && <i className="theme-preview-profile">KU</i>}
      </header>
      <div className="theme-preview-content">
        <div className="theme-preview-title"><div><small>RINGKASAN USAHA</small><h3>Dashboard preview</h3></div><button type="button">+ Buat baru</button></div>
        <div className="theme-preview-stats">
          {[
            ['Penjualan', '128', '↗ 12%'],
            ['Pelanggan', '86', '+8'],
            ['Transaksi', '245', 'Bulan ini'],
            ['Laporan', '92%', 'Tercapai'],
          ].map(([label, amount, hint]) => <article className="theme-preview-card" key={label}><span>{label}</span><strong>{amount}</strong><small>{hint}</small></article>)}
        </div>
        <div className="theme-preview-lower">
          <section className="theme-preview-card theme-preview-chart"><strong>Aktivitas usaha</strong><div><i /><i /><i /><i /><i /><i /><i /></div></section>
          <section className="theme-preview-card theme-preview-table"><strong>Transaksi terbaru</strong><p><span>INV-1048</span><b>Selesai</b></p><p><span>INV-1047</span><b>Diproses</b></p><p><span>INV-1046</span><b>Selesai</b></p></section>
        </div>
        <div className="theme-preview-controls"><button type="button">Simpan</button><input aria-label="Contoh formulir preview" placeholder="Cari data..." /></div>
      </div>
    </div>
  </div>;
}

export default function DashboardThemeSettings({
  activeSettings,
  draftSettings,
  previousSettings,
  history = [],
  draftDirty = false,
  businessName,
  canManage,
  saving,
  notice,
  error,
  onChange,
  onSaveDraft,
  onApply,
  onDiscard,
  onRestore,
  onReset,
  onAssetUpload,
}) {
  const [activeCategory, setActiveCategory] = useState('gallery');
  const [previewOpen, setPreviewOpen] = useState(false);
  const systemDarkMode = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const colors = getThemeColors(draftSettings, systemDarkMode);
  const activeTheme = dashboardThemes.find(({ id }) => id === activeSettings.themeId) || dashboardThemes[0];
  const draftTheme = dashboardThemes.find(({ id }) => id === draftSettings.themeId) || dashboardThemes[0];
  const hasInvalidColor = useMemo(() => (
    colorOptions.some(([key]) => !isValidHex(draftSettings[key]))
    || !isValidHex(draftSettings.buttonSecondaryColor)
    || !isValidHex(draftSettings.buttonHoverColor)
  ), [draftSettings]);

  const update = (key, value) => onChange({ ...draftSettings, [key]: value });
  const goToCategory = (id) => {
    setActiveCategory(id);
    document.getElementById(`theme-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <section className="content dashboard-theme-page">
    <header className="dashboard-theme-heading">
      <div>
        <div className="eyebrow">PENGATURAN <span>/</span> TAMPILAN DASHBOARD</div>
        <h1>Pengaturan Tampilan Dashboard</h1>
        <p>Personalisasikan tampilan dashboard {businessName ? `untuk ${businessName}` : 'sesuai karakter bisnis Anda'}.</p>
        <div className="theme-status-line"><span className="theme-status-dot" />Tema aktif: <strong>{activeTheme.name}</strong><span className="theme-draft-label">Draft: {draftTheme.name}</span>{draftDirty && <span className="theme-unsaved-label">Perubahan belum disimpan</span>}</div>
      </div>
      <div className="dashboard-theme-actions">
        <button className="theme-action-secondary" onClick={() => setPreviewOpen(true)} type="button">Preview</button>
        <button className="theme-action-secondary" disabled={!canManage || saving} onClick={onDiscard} type="button">Batalkan Perubahan</button>
        <button className="theme-action-secondary" disabled={!canManage || saving || !previousSettings} onClick={onRestore} type="button">Pulihkan Tema Sebelumnya</button>
        <button className="theme-action-secondary" disabled={!canManage || saving || hasInvalidColor} onClick={onSaveDraft} type="button">{saving ? 'Menyimpan…' : 'Simpan Draft'}</button>
        <button className="theme-action-primary" disabled={!canManage || saving || hasInvalidColor} onClick={onApply} type="button">{saving ? 'Menerapkan…' : 'Terapkan Tema'}</button>
      </div>
    </header>

    {notice && <div className="notice theme-feedback" role="status">{notice}</div>}
    {error && <div className="notice error-notice theme-feedback" role="alert">{error}</div>}
    {!canManage && <div className="notice theme-feedback">Anda dapat melihat tema aktif, tetapi tidak memiliki izin untuk mengubah tampilan perusahaan.</div>}

    <nav aria-label="Kategori pengaturan tema" className="theme-category-nav">
      {categories.map(([id, label]) => <button
        aria-current={activeCategory === id ? 'location' : undefined}
        className={activeCategory === id ? 'active' : ''}
        key={id}
        onClick={() => goToCategory(id)}
        type="button"
      >{label}</button>)}
    </nav>

    <div className="theme-editor-layout">
      <fieldset className="theme-editor-fieldset" disabled={!canManage}>
        <div className="theme-editor-sections">
        <section className="theme-editor-card" id="theme-section-gallery">
          <div className="theme-section-heading"><div><span>01</span><div><h2>Galeri tema</h2><p>Pilih tema untuk memulai. Perubahan hanya tampil di preview hingga diterapkan.</p></div></div></div>
          <div className="theme-gallery-grid">
            {dashboardThemes.map((theme) => <article className={`theme-gallery-card${draftSettings.themeId === theme.id ? ' selected' : ''}`} key={theme.id} style={{ '--swatch-primary': theme.primary, '--swatch-secondary': theme.secondary, '--swatch-background': theme.background, '--swatch-surface': theme.surface }}>
              <div className="theme-mini-preview">
                <aside><i /><i /><i /></aside><div><header /><section><i /><i /><i /></section><button type="button">Action</button></div>
              </div>
              <div className="theme-gallery-info"><div><strong>{theme.name}</strong><small>{theme.description}</small></div><span className="theme-color-dot" style={{ background: theme.primary }} /></div>
              <button aria-pressed={draftSettings.themeId === theme.id} className="theme-select-button" disabled={!canManage} onClick={() => onChange({ ...draftSettings, themeId: theme.id, mode: theme.mode, customPrimary: '', customSecondary: '', customAccent: '', customBackground: '', customSurface: '', customSidebar: '', customHeader: '', customText: '', customTextMuted: '', customBorder: '' })} type="button">
                {draftSettings.themeId === theme.id ? 'Tema dipilih' : 'Pilih tema'}
              </button>
              {activeSettings.themeId === theme.id && <span className="theme-active-badge">Aktif</span>}
            </article>)}
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-colors">
          <div className="theme-section-heading"><div><span>02</span><div><h2>Warna & identitas</h2><p>Gunakan preset tema atau sesuaikan token warna. HEX yang tidak valid tidak dapat disimpan.</p></div></div><button className="theme-text-button" disabled={!canManage} onClick={() => onChange({ ...draftSettings, customPrimary: '', customSecondary: '', customAccent: '', customBackground: '', customSurface: '', customSidebar: '', customHeader: '', customText: '', customTextMuted: '', customBorder: '' })} type="button">Reset warna</button></div>
          <div className="theme-color-grid">
            {colorOptions.map(([key, label, token]) => {
              const value = draftSettings[key] || colors[token];
              const valid = isValidHex(value);
              return <label className="theme-color-input" key={key}>
                <span>{label}</span>
                <div><input aria-label={`${label} color picker`} disabled={!canManage} onChange={(event) => update(key, event.target.value)} type="color" value={valid && value ? value : colors[token]} /><input aria-label={`${label} HEX`} disabled={!canManage} maxLength={7} onChange={(event) => update(key, event.target.value)} placeholder={colors[token]} value={draftSettings[key] || ''} /></div>
                {!valid && <small className="theme-validation-error">Masukkan kode HEX valid, contoh #2563EB.</small>}
              </label>;
            })}
          </div>
          <div className="theme-preset-row"><span>Kombinasi siap pakai</span>{dashboardThemes.slice(0, 5).map((theme) => <button aria-label={`Pakai kombinasi ${theme.name}`} disabled={!canManage} key={theme.id} onClick={() => onChange({ ...draftSettings, themeId: theme.id, mode: theme.mode, customPrimary: '', customSecondary: '', customAccent: '', customBackground: '', customSurface: '', customSidebar: '', customHeader: '', customText: '', customTextMuted: '', customBorder: '' })} style={{ '--preset-color': theme.primary }} type="button"><i />{theme.name}</button>)}</div>
          <div className="theme-brand-assets">
            <label><span>Logo dashboard <small>Logo untuk dashboard perusahaan.</small></span><input accept="image/png,image/jpeg,image/webp,image/x-icon" aria-label="Unggah logo dashboard" onChange={(event) => onAssetUpload(event, 'dashboardLogo')} type="file" />{draftSettings.dashboardLogoUrl && <img alt="Pratinjau logo dashboard" src={draftSettings.dashboardLogoUrl} />}</label>
            <label><span>Favicon dashboard <small>Ikon tab browser dashboard.</small></span><input accept="image/png,image/jpeg,image/webp,image/x-icon" aria-label="Unggah favicon dashboard" onChange={(event) => onAssetUpload(event, 'dashboardFavicon')} type="file" />{draftSettings.dashboardFaviconUrl && <img alt="Pratinjau favicon dashboard" src={draftSettings.dashboardFaviconUrl} />}</label>
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-type">
          <div className="theme-section-heading"><div><span>03</span><div><h2>Tipografi</h2><p>Atur karakter dan keterbacaan teks dashboard.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Font dashboard" options={fontOptions.map((font) => [font, font])} onChange={(value) => update('fontFamily', value)} value={draftSettings.fontFamily} />
            <SelectField label="Ketebalan font" options={[[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']]} onChange={(value) => update('fontWeight', Number(value))} value={draftSettings.fontWeight} />
            <RangeField label="Ukuran teks dasar" min={12} max={18} onChange={(value) => update('fontSize', value)} unit=" px" value={draftSettings.fontSize} />
            <RangeField label="Ukuran judul" min={20} max={36} onChange={(value) => update('titleSize', value)} unit=" px" value={draftSettings.titleSize} />
            <RangeField label="Ukuran teks menu" min={11} max={16} onChange={(value) => update('menuTextSize', value)} unit=" px" value={draftSettings.menuTextSize} />
            <RangeField label="Jarak antarbaris" min={1.2} max={2} onChange={(value) => update('lineHeight', value)} unit=" em" value={draftSettings.lineHeight} />
          </div>
          <p className="theme-type-sample" style={{ fontFamily: draftSettings.fontFamily, fontSize: `${draftSettings.fontSize}px`, fontWeight: draftSettings.fontWeight, lineHeight: draftSettings.lineHeight }}>Dashboard usaha Anda <span>Ringkasan bisnis terlihat jelas dan nyaman dibaca.</span></p>
        </section>

        <section className="theme-editor-card" id="theme-section-layout">
          <div className="theme-section-heading"><div><span>04</span><div><h2>Layout dashboard</h2><p>Atur susunan konten tanpa mengubah fungsi modul usaha.</p></div></div></div>
          <div className="theme-layout-options">
            {[
              ['classic', 'Classic Layout'], ['modern-grid', 'Modern Grid'], ['spacious', 'Spacious Layout'], ['compact', 'Compact Layout'], ['minimal', 'Minimal Layout'],
            ].map(([id, label]) => <button aria-pressed={draftSettings.layout === id} className={draftSettings.layout === id ? 'selected' : ''} disabled={!canManage} key={id} onClick={() => update('layout', id)} type="button"><span className={`theme-layout-glyph layout-${id}`}><i /><i /><i /><i /></span>{label}</button>)}
          </div>
          <div className="theme-controls-grid">
            <RangeField label="Lebar konten" min={960} max={1800} onChange={(value) => update('contentWidth', value)} unit=" px" value={draftSettings.contentWidth} />
            <RangeField label="Jarak komponen" min={8} max={32} onChange={(value) => update('componentGap', value)} unit=" px" value={draftSettings.componentGap} />
            <SelectField label="Kolom kartu statistik" options={[[2, '2 kolom'], [3, '3 kolom'], [4, '4 kolom'], [5, '5 kolom']]} onChange={(value) => update('statCardColumns', Number(value))} value={draftSettings.statCardColumns} />
            <SelectField label="Ukuran kartu" options={[['compact', 'Compact'], ['normal', 'Normal'], ['large', 'Large']]} onChange={(value) => update('cardSize', value)} value={draftSettings.cardSize} />
            <RangeField label="Padding konten" min={12} max={40} onChange={(value) => update('contentPadding', value)} unit=" px" value={draftSettings.contentPadding} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-sidebar">
          <div className="theme-section-heading"><div><span>05</span><div><h2>Sidebar & navigasi</h2><p>Pengaturan visual ini tidak mengubah menu atau hak akses pengguna.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Mode sidebar" options={[[ 'compact', 'Compact'], ['normal', 'Normal'], ['expanded', 'Expanded'], ['collapsible', 'Collapsible']]} onChange={(value) => update('sidebarMode', value)} value={draftSettings.sidebarMode} />
            <SelectField label="Isi menu" options={[['icons-labels', 'Ikon dan teks'], ['icons', 'Ikon saja']]} onChange={(value) => update('sidebarContent', value)} value={draftSettings.sidebarContent} />
            <RangeField label="Ukuran ikon" min={14} max={24} onChange={(value) => update('sidebarIconSize', value)} unit=" px" value={draftSettings.sidebarIconSize} />
            <RangeField label="Jarak antar menu" min={2} max={16} onChange={(value) => update('sidebarMenuGap', value)} unit=" px" value={draftSettings.sidebarMenuGap} />
            <RangeField label="Radius menu aktif" min={0} max={18} onChange={(value) => update('sidebarActiveRadius', value)} unit=" px" value={draftSettings.sidebarActiveRadius} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-header">
          <div className="theme-section-heading"><div><span>06</span><div><h2>Header dashboard</h2><p>Sesuaikan tinggi dan nuansa header.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Gaya header" options={[['minimal', 'Minimalis'], ['standard', 'Standar'], ['modern', 'Modern']]} onChange={(value) => update('headerStyle', value)} value={draftSettings.headerStyle} />
            <RangeField label="Tinggi header" min={48} max={84} onChange={(value) => update('headerHeight', value)} unit=" px" value={draftSettings.headerHeight} />
            <ToggleField checked={draftSettings.headerShadow} label="Bayangan header" onChange={(value) => update('headerShadow', value)} />
            <ToggleField checked={draftSettings.headerSticky} label="Header sticky" onChange={(value) => update('headerSticky', value)} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-cards">
          <div className="theme-section-heading"><div><span>07</span><div><h2>Kartu & komponen</h2><p>Gunakan bentuk kartu yang tetap nyaman untuk tabel, grafik, dan formulir.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Gaya kartu" options={[['flat', 'Flat'], ['rounded', 'Rounded'], ['elevated', 'Elevated']]} onChange={(value) => {
              onChange({
                ...draftSettings,
                cardStyle: value,
                statCardStyle: value === 'flat' ? 'border' : value === 'elevated' ? 'shadow' : 'soft',
              });
            }} value={draftSettings.cardStyle} />
            <RangeField label="Radius kartu" min={0} max={24} onChange={(value) => update('cardRadius', value)} unit=" px" value={draftSettings.cardRadius} />
            <SelectField label="Bayangan kartu" options={[['none', 'Tanpa bayangan'], ['soft', 'Lembut'], ['strong', 'Tegas']]} onChange={(value) => update('cardShadow', value)} value={draftSettings.cardShadow} />
            <ToggleField checked={draftSettings.cardBorder} label="Tampilkan border kartu" onChange={(value) => update('cardBorder', value)} />
            <RangeField label="Padding kartu" min={10} max={32} onChange={(value) => update('cardPadding', value)} unit=" px" value={draftSettings.cardPadding} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-buttons">
          <div className="theme-section-heading"><div><span>08</span><div><h2>Tombol & bentuk</h2><p>Atur bentuk tombol tanpa mengubah aksi tombol yang sudah ada.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Bentuk tombol" options={[['standard', 'Standard'], ['rounded', 'Rounded'], ['pill', 'Pill']]} onChange={(value) => update('buttonStyle', value)} value={draftSettings.buttonStyle} />
            <RangeField label="Radius tombol" min={0} max={28} onChange={(value) => update('buttonRadius', value)} unit=" px" value={draftSettings.buttonRadius} />
            <RangeField label="Tinggi tombol" min={32} max={52} onChange={(value) => update('buttonHeight', value)} unit=" px" value={draftSettings.buttonHeight} />
            <RangeField label="Ukuran teks tombol" min={11} max={16} onChange={(value) => update('buttonTextSize', value)} unit=" px" value={draftSettings.buttonTextSize} />
            <label className="theme-color-input"><span>Warna tombol sekunder</span><div><input aria-label="Warna tombol sekunder color picker" disabled={!canManage} onChange={(event) => update('buttonSecondaryColor', event.target.value)} type="color" value={draftSettings.buttonSecondaryColor} /><input aria-label="Warna tombol sekunder HEX" disabled={!canManage} maxLength={7} onChange={(event) => update('buttonSecondaryColor', event.target.value)} value={draftSettings.buttonSecondaryColor} /></div></label>
            <label className="theme-color-input"><span>Warna hover</span><div><input aria-label="Warna hover color picker" disabled={!canManage} onChange={(event) => update('buttonHoverColor', event.target.value)} type="color" value={draftSettings.buttonHoverColor || colors.primary} /><input aria-label="Warna hover HEX" disabled={!canManage} maxLength={7} onChange={(event) => update('buttonHoverColor', event.target.value)} value={draftSettings.buttonHoverColor} /></div></label>
            <ToggleField checked={draftSettings.buttonOutline} label="Tombol outline" onChange={(value) => update('buttonOutline', value)} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-mode">
          <div className="theme-section-heading"><div><span>09</span><div><h2>Mode tampilan</h2><p>Pilih mode warna dan kepadatan informasi.</p></div></div></div>
          <div className="theme-controls-grid">
            <SelectField label="Mode warna" options={[['light', 'Light Mode'], ['dark', 'Dark Mode'], ['system', 'System / Auto']]} onChange={(value) => update('mode', value)} value={draftSettings.mode} />
            <SelectField label="Kepadatan tampilan" options={[['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']]} onChange={(value) => update('density', value)} value={draftSettings.density} />
          </div>
        </section>

        <section className="theme-editor-card" id="theme-section-advanced">
          <div className="theme-section-heading"><div><span>10</span><div><h2>Pengaturan lanjutan</h2><p>Atur pilihan layout tambahan. Semua perubahan tetap berupa draft sampai diterapkan.</p></div></div><button className="theme-text-button" disabled={!canManage} onClick={onReset} type="button">Reset ke default</button></div>
          <div className="theme-controls-grid">
            <SelectField label="Posisi logo" options={[['top', 'Atas sidebar'], ['header', 'Header dashboard']]} onChange={(value) => update('logoPosition', value)} value={draftSettings.logoPosition} />
            <ToggleField checked={draftSettings.sidebarIcons !== false} label="Tampilkan ikon navigasi" onChange={(value) => update('sidebarIcons', value)} />
            <ToggleField checked={draftSettings.showNotifications !== false} label="Tampilkan notifikasi" onChange={(value) => update('showNotifications', value)} />
            <ToggleField checked={draftSettings.showUserProfile !== false} label="Tampilkan profil pengguna" onChange={(value) => update('showUserProfile', value)} />
          </div>
          <div className="theme-history">
            <strong>Riwayat tema diterapkan</strong>
            {!history.length && <span>Belum ada riwayat perubahan tema.</span>}
            {history.map((item, index) => <span key={`${item.appliedAt}-${index}`}>{dashboardThemes.find(({ id }) => id === item.settings?.themeId)?.name || 'Tema kustom'} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.appliedAt))}</span>)}
          </div>
        </section>
        </div>
      </fieldset>

      <aside className="theme-preview-panel" id="theme-preview-panel">
        <div className="theme-preview-panel-heading"><div><span>PREVIEW LANGSUNG</span><strong>{draftTheme.name}</strong></div><span className="theme-preview-live-dot">Live</span></div>
        <ThemePreview settings={draftSettings} />
        {previousSettings && <p className="theme-previous-hint">Tema sebelumnya: {dashboardThemes.find(({ id }) => id === previousSettings.themeId)?.name || 'Tema kustom'}</p>}
      </aside>
    </div>

    {previewOpen && <div className="theme-preview-modal" role="dialog" aria-modal="true" aria-label="Preview tema dashboard">
      <div className="theme-preview-modal-header"><strong>Preview tema · {draftTheme.name}</strong><button aria-label="Tutup preview" onClick={() => setPreviewOpen(false)} type="button">×</button></div>
      <ThemePreview expanded settings={draftSettings} />
    </div>}
  </section>;
}

export { isValidHex };
