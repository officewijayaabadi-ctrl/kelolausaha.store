export function BusinessProfileSettings({
  profile,
  loading,
  saving,
  uploading,
  canEdit,
  error,
  notice,
  onProfileChange,
  onLogoUpload,
  onSave,
}) {
  const update = (event) => {
    onProfileChange({ ...profile, [event.target.name]: event.target.value });
  };

  return (
    <section className="content theme-settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PENGATURAN <span>/</span> PROFIL USAHA</div>
          <h1>Profil Usaha</h1>
          <p>Kelola nama, alamat, dan logo yang digunakan di workspace {profile.name || 'usaha Anda'}.</p>
        </div>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {!canEdit && <div className="notice">Hanya Owner dan Super Admin yang dapat mengubah profil usaha.</div>}
      {loading
        ? <p role="status">Memuat profil usaha…</p>
        : <form className="spk-form" onSubmit={onSave}>
          <section className="theme-settings-card">
            <div className="table-heading">
              <div><h2>Identitas usaha</h2><p>Perubahan nama tidak mengubah alamat subdomain usaha.</p></div>
            </div>
            <div className="form-grid two-columns">
              <label className="field">
                <span>Nama usaha <i>*</i></span>
                <input
                  autoComplete="organization"
                  disabled={!canEdit || saving}
                  maxLength="160"
                  name="name"
                  onChange={update}
                  required
                  value={profile.name}
                />
              </label>
              <label className="field">
                <span>Alamat usaha <i>*</i></span>
                <input
                  autoComplete="street-address"
                  disabled={!canEdit || saving}
                  maxLength="500"
                  name="address"
                  onChange={update}
                  required
                  value={profile.address}
                />
              </label>
            </div>
          </section>
          <section className="theme-settings-card theme-assets-card">
            <div className="table-heading">
              <div><h2>Logo usaha</h2><p>Gunakan PNG, JPG, WebP, atau ICO maksimal 2 MB.</p></div>
            </div>
            <div className="theme-assets-grid">
              <label className="theme-upload">
                <span className="theme-asset-preview">
                  {profile.logoUrl ? <img alt="Pratinjau logo usaha" src={profile.logoUrl} /> : 'KU'}
                </span>
                <span><strong>Unggah logo</strong><small>Logo akan ditampilkan di navigasi workspace.</small></span>
                <input
                  accept="image/png,image/jpeg,image/webp,image/x-icon"
                  aria-label="Logo usaha"
                  disabled={!canEdit || uploading || saving}
                  onChange={onLogoUpload}
                  type="file"
                />
              </label>
            </div>
          </section>
          <div className="theme-save-row">
            <span>Nama, alamat, dan logo disimpan untuk usaha ini.</span>
            <button className="button button-primary" disabled={!canEdit || saving || uploading} type="submit">
              {saving ? 'Menyimpan…' : 'Simpan profil'} <span>→</span>
            </button>
          </div>
        </form>}
    </section>
  );
}
