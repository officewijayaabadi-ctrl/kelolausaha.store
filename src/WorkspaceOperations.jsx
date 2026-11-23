import { useEffect, useMemo, useRef, useState } from 'react';
import { branchAddons } from '../shared/plans.js';

const operationsUrl = '/api/workspace/operations';
const weekdays = [
  [1, 'Sen'], [2, 'Sel'], [3, 'Rab'], [4, 'Kam'], [5, 'Jum'], [6, 'Sab'], [7, 'Min'],
];
const inviteRoles = ['HRD', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR'];

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let result = {};
  try {
    result = await response.json();
  } catch {
    if (response.ok) throw new Error('Server mengirim data yang tidak dapat dibaca.');
  }
  if (!response.ok) throw new Error(result.message || 'Permintaan tidak dapat diproses.');
  return result;
}

function getLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error('Perangkat ini tidak menyediakan GPS.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk mencatat absensi.'
        : 'Lokasi GPS tidak dapat dibaca. Coba lagi di area dengan sinyal yang lebih baik.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

async function addPhotoWatermark(file, { latitude, longitude }) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Foto tidak dapat diproses pada perangkat ini.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const bandHeight = Math.max(82, Math.round(canvas.width * 0.075));
  context.fillStyle = 'rgba(20, 32, 29, 0.82)';
  context.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);
  context.fillStyle = '#ffffff';
  context.font = `600 ${Math.max(14, Math.round(canvas.width * 0.022))}px sans-serif`;
  context.textBaseline = 'top';
  const stamp = new Date().toLocaleString('id-ID');
  const locationLine = `Google Maps · ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  context.fillText(`KelolaUsaha.store · ${stamp}`, 18, canvas.height - bandHeight + 12);
  context.fillText(locationLine, 18, canvas.height - bandHeight + Math.max(38, bandHeight * 0.52));
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Foto bertanda lokasi gagal disiapkan.'));
        return;
      }
      resolve(new File([blob], `absensi-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.86);
  });
}

function money(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function statusLabel(status) {
  return ({
    present: 'Hadir',
    absent: 'Alfa',
    excused: 'Izin disetujui',
    day_off: 'Hari libur',
    upcoming: 'Belum berlangsung',
    not_due: 'Belum waktunya',
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  })[status] || status;
}

function csvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function buildAttendanceCsv(report, reportDate) {
  const rows = [
    ['Tanggal', 'Nama karyawan', 'Peran', 'Cabang', 'Status', 'Jam masuk', 'Jam pulang', 'Lokasi masuk'],
    ...report.map((item) => [
      reportDate,
      item.userName,
      item.role,
      item.branchName,
      statusLabel(item.status),
      item.checkInAt ? new Date(item.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
      item.checkOutAt ? new Date(item.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
      item.checkInMapsUrl,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

function downloadAttendanceReport(report, reportDate, branchName) {
  const csv = buildAttendanceCsv(report, reportDate);
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const downloadLink = document.createElement('a');
  const filePart = (branchName || 'semua-cabang').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadLink.href = blobUrl;
  downloadLink.download = `laporan-kehadiran-${reportDate}-${filePart || 'cabang'}.csv`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function PhotoField({ label, onChange, required = true }) {
  return <label className="field attendance-photo-field">
    <span>{label} {required && <b>*</b>}</span>
    <input accept="image/*" onChange={(event) => onChange(event.target.files?.[0] || null)} required={required} type="file" />
    <small>Ambil foto langsung atau pilih dari galeri. Foto diberi watermark waktu dan koordinat Google Maps sebelum disimpan.</small>
  </label>;
}

function LiveCameraField({ label, onChange, photo }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!stream) return undefined;
    const video = videoRef.current;
    if (video) video.srcObject = stream;
    return () => {
      stream.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const startCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak tersedia. Buka halaman melalui HTTPS dan izinkan akses kamera.');
      return;
    }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      }));
    } catch (error) {
      const message = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
        ? 'Izin kamera ditolak. Izinkan akses kamera untuk mengambil foto absensi.'
        : error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError'
          ? 'Kamera tidak ditemukan pada perangkat ini.'
          : error.name === 'NotReadableError' || error.name === 'TrackStartError'
            ? 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
            : 'Kamera tidak dapat dibuka. Pastikan izin kamera aktif dan halaman menggunakan HTTPS.';
      setCameraError(message);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('Kamera belum siap. Tunggu sebentar lalu ambil foto kembali.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Foto tidak dapat diproses pada perangkat ini.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Foto gagal diambil. Silakan coba kembali.');
        return;
      }
      onChange(new File([blob], `absensi-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setStream(null);
      setCameraError('');
    }, 'image/jpeg', 0.9);
  };

  const retakePhoto = () => {
    onChange(null);
    setCameraError('');
    startCamera();
  };

  return <div className="field attendance-photo-field">
    <span>{label} <b>*</b></span>
    {photo && previewUrl
      ? <div className="attendance-camera-preview">
        <img alt={`${label} yang diambil`} src={previewUrl} />
        <button className="button button-quiet" onClick={retakePhoto} type="button">Ambil ulang foto</button>
      </div>
      : stream
        ? <div className="attendance-camera-preview">
          <video autoPlay muted onCanPlay={() => setCameraReady(true)} playsInline ref={videoRef} />
          <button className="button button-primary" disabled={!cameraReady} onClick={capturePhoto} type="button">Ambil foto</button>
        </div>
        : <button className="button button-quiet" onClick={startCamera} type="button">Buka kamera</button>}
    {cameraError && <small className="attendance-camera-error" role="alert">{cameraError}</small>}
    <small>Foto harus diambil langsung dari kamera. Foto diberi watermark waktu dan koordinat Google Maps sebelum disimpan.</small>
  </div>;
}

export function BranchManagement({ role, isAuthenticated }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState([]);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [inviteRole, setInviteRole] = useState('ADMIN');
  const [inviteLink, setInviteLink] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [months, setMonths] = useState('1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const owner = role === 'OWNER';
  const canManage = ['OWNER', 'SUPER ADMIN'].includes(role);
  const selectedAddon = branchAddons.find((item) => item.months === Number(months));
  const total = (selectedAddon?.pricePerBranch || 0) * (Number(quantity) || 0);
  const branches = data?.branches || [];

  const load = async () => {
    try {
      const result = await requestJson(`${operationsUrl}/branches`);
      setData(result);
      setError('');
      if (role === 'OWNER') {
        const branchReport = await requestJson(`${operationsUrl}/branches/report`);
        setReport(branchReport.branches || []);
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) load();
  }, [role, isAuthenticated]);

  const createBranch = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await requestJson(`${operationsUrl}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: branchName, address: branchAddress }),
      });
      setBranchName('');
      setBranchAddress('');
      setMessage(`Cabang ${result.branch.name} berhasil dibuat.`);
      await load();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (branchId) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await requestJson(`${operationsUrl}/branches/${branchId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      });
      setInviteLink(result.inviteUrl);
      setMessage('Link undangan cabang berhasil dibuat dan berlaku selama 7 hari.');
    } catch (inviteError) {
      setError(inviteError.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBranch = async (branch) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestJson(`${operationsUrl}/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branch.name,
          address: branch.address || '',
          active: !branch.active,
        }),
      });
      setMessage(`Cabang ${branch.name} berhasil ${branch.active ? 'dinonaktifkan' : 'diaktifkan'}.`);
      await load();
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusy(false);
    }
  };

  const purchaseBranchSlots = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await requestJson('/api/billing/branch-addon/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(quantity), months: Number(months) }),
      });
      if (!result.redirectUrl) throw new Error('Midtrans tidak mengembalikan tautan pembayaran.');
      window.location.assign(result.redirectUrl);
    } catch (paymentError) {
      setError(paymentError.message);
      setBusy(false);
    }
  };

  if (!isAuthenticated) return <section className="content"><div className="page-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> ORGANISASI</div><h1>Cabang usaha</h1></div></div><div className="notice">Pratinjau saja. Masuk sebagai Owner atau Super Admin workspace untuk mengelola cabang dan pembayaran.</div></section>;

  return <section className="content workspace-branches">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> ORGANISASI</div><h1>Cabang usaha</h1><p>Kelola cabang dalam satu workspace. Laporan setiap cabang tetap terpisah dan Owner dapat melihat rekap gabungan.</p></div></div>
    {message && <div className="notice" role="status">{message}</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    {data && <div className="branch-summary-grid">
      <article className="stat-card stat-shadow"><div className="stat-top"><span>Cabang aktif</span><span className="stat-icon blue">⌂</span></div><strong>{data.activeBranches || 0}</strong><div className="stat-foot"><span>Batas saat ini: {data.branchLimit}</span></div></article>
      <article className="stat-card stat-shadow"><div className="stat-top"><span>Sisa kuota</span><span className="stat-icon green">＋</span></div><strong>{Math.max(0, (data.branchLimit || 0) - (data.activeBranches || 0))}</strong><div className="stat-foot"><span>Termasuk tambahan aktif</span></div></article>
    </div>}

    {canManage && <section className="table-card branch-create-card">
      <div className="table-heading"><div><h2>Tambah cabang</h2><p>{data?.activeBranches >= data?.branchLimit ? 'Kuota saat ini sudah maksimal.' : 'Buat cabang dan bagikan link undangan khusus untuk timnya.'}</p></div></div>
      <form className="branch-create-form" onSubmit={createBranch}>
        <label className="field"><span>Nama cabang</span><input onChange={(event) => setBranchName(event.target.value)} placeholder="Contoh: Cabang Bandung" required value={branchName} /></label>
        <label className="field"><span>Alamat (opsional)</span><input onChange={(event) => setBranchAddress(event.target.value)} placeholder="Alamat cabang" value={branchAddress} /></label>
        <button className="button button-primary" disabled={busy || (data && data.activeBranches >= data.branchLimit)} type="submit">Buat cabang</button>
      </form>
      {data && data.activeBranches >= data.branchLimit && <p className="branch-quota-note">Kuota cabang tercapai. Owner dapat membeli tambahan cabang atau menghubungi vendor untuk pengaturan khusus.</p>}
    </section>}

    {branches.length > 0 && <section className="table-card">
      <div className="table-heading"><div><h2>Daftar cabang</h2><p>Cabang dalam workspace ini</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>NAMA CABANG</th><th>KODE</th><th>ALAMAT</th><th>STATUS</th>{canManage && <><th>LINK TIM CABANG</th><th>AKSI</th></>}</tr></thead><tbody>
        {branches.map((branch) => <tr key={branch.id}><td><strong>{branch.name}</strong>{branch.isPrimary && <small>Cabang utama</small>}</td><td>{branch.code}</td><td>{branch.address || '—'}</td><td>{branch.active ? 'Aktif' : 'Nonaktif'}</td>{canManage && <><td><div className="branch-invite-actions"><select aria-label={`Peran undangan ${branch.name}`} onChange={(event) => setInviteRole(event.target.value)} value={inviteRole}>{(owner ? ['SUPER ADMIN', ...inviteRoles] : inviteRoles).map((item) => <option key={item}>{item}</option>)}</select><button className="text-button" disabled={busy || !branch.active} onClick={() => createInvite(branch.id)} type="button">Buat link</button></div></td><td>{!branch.isPrimary && <button className="text-button" disabled={busy} onClick={() => toggleBranch(branch)} type="button">{branch.active ? 'Nonaktifkan' : 'Aktifkan'}</button>}</td></>}</tr>)}
      </tbody></table></div>
      {inviteLink && <label className="invite-link-field"><span>Link pendaftaran anggota cabang</span><input readOnly value={inviteLink} onFocus={(event) => event.target.select()} /></label>}
    </section>}

    {owner && <section className="table-card">
      <div className="table-heading"><div><h2>Rekap terpisah per cabang</h2><p>Ringkasan transaksi bulan berjalan</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>CABANG</th><th>JUMLAH PESANAN</th><th>PENJUALAN</th></tr></thead><tbody>{report.map((branch) => <tr key={branch.branchId}><td>{branch.branchName}</td><td>{branch.orderCount}</td><td className="amount">{money(branch.salesTotal)}</td></tr>)}</tbody></table></div>
    </section>}

    {owner && <section className="table-card branch-addon-card">
      <div className="table-heading"><div><h2>Tambah kuota cabang</h2><p>Pilih jumlah cabang tambahan dan masa aktifnya. Pembayaran diproses langsung melalui Midtrans.</p></div></div>
      <div className="branch-addon-form">
        <label className="field"><span>Jumlah cabang tambahan</span><input min="1" max="100" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></label>
        <label className="field"><span>Masa aktif per cabang</span><select onChange={(event) => setMonths(event.target.value)} value={months}>{branchAddons.map((addon) => <option key={addon.months} value={addon.months}>{addon.label} — {money(addon.pricePerBranch)} / cabang</option>)}</select></label>
        <div className="branch-addon-total"><span>Total pembayaran</span><strong>{money(total)}</strong><small>{quantity || 0} cabang × {money(selectedAddon?.pricePerBranch)}</small></div>
        <button className="button button-primary" disabled={busy || !Number(quantity) || Number(quantity) > 100} onClick={purchaseBranchSlots} type="button">{busy ? 'Membuka Midtrans…' : 'Bayar dengan Midtrans'}</button>
      </div>
      <p className="branch-quota-note">Kuota tambahan aktif otomatis setelah Midtrans mengonfirmasi pembayaran. Jika perlu kuota khusus di luar pembelian ini, hubungi vendor aplikasi.</p>
    </section>}
  </section>;
}

export function AttendanceWorkspace({ role, isAuthenticated }) {
  const [today, setToday] = useState(null);
  const [branches, setBranches] = useState([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState('');
  const [report, setReport] = useState([]);
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({
    timezone: 'Asia/Jakarta', workStart: '08:00', workEnd: '17:00',
    workDays: [1, 2, 3, 4, 5, 6], graceMinutes: 15,
  });
  const [requestDraft, setRequestDraft] = useState({
    requestType: 'permission', startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10), reason: '',
  });
  const [checkInPhoto, setCheckInPhoto] = useState(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState(null);
  const [requestPhoto, setRequestPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canViewReport = ['OWNER', 'SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN'].includes(role);
  const canManageSchedule = ['OWNER', 'HRD'].includes(role);
  const canReview = ['OWNER', 'SUPER ADMIN', 'HRD'].includes(role);
  const canSeeAllBranches = ['OWNER', 'SUPER ADMIN', 'HRD'].includes(role);
  const isClockedIn = Boolean(today?.attendance?.checkInAt);
  const isClockedOut = Boolean(today?.attendance?.checkOutAt);

  const loadToday = async () => {
    try {
      const result = await requestJson(`${operationsUrl}/attendance/today`);
      setToday(result);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  const loadBranches = async () => {
    try {
      const result = await requestJson(`${operationsUrl}/branches`);
      setBranches(result.branches || []);
      if (!branchId && !canSeeAllBranches && result.branches?.length) setBranchId(result.branches[0].id);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  const loadReport = async () => {
    try {
      const params = new URLSearchParams({ date: reportDate });
      if (branchId) params.set('branchId', branchId);
      const requestData = await requestJson(`${operationsUrl}/attendance/requests${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`);
      if (canViewReport) {
        const reportData = await requestJson(`${operationsUrl}/attendance/report?${params}`);
        setReport(reportData.records || []);
      }
      setRequests(requestData.requests || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadToday();
    loadBranches();
    requestJson(`${operationsUrl}/attendance/settings`)
      .then((result) => setSettings(result.settings))
      .catch((loadError) => setError(loadError.message));
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadReport();
  }, [canViewReport, isAuthenticated, reportDate, branchId]);

  const submitAttendance = async (event, endpoint, photo, setPhoto) => {
    event.preventDefault();
    if (!photo) {
      setError('Ambil foto langsung sebelum mengirim absensi.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const location = await getLocation();
      const watermarkedPhoto = await addPhotoWatermark(photo, location);
      const formData = new FormData();
      formData.append('photo', watermarkedPhoto);
      formData.append('latitude', String(location.latitude));
      formData.append('longitude', String(location.longitude));
      await requestJson(`${operationsUrl}/attendance/${endpoint}`, { method: 'POST', body: formData });
      setPhoto(null);
      event.currentTarget.reset();
      setMessage(endpoint === 'check-in' ? 'Absensi masuk berhasil tersimpan.' : 'Absensi pulang berhasil tersimpan.');
      await loadToday();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!requestPhoto) {
      setError('Foto bukti wajib diunggah untuk pengajuan.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const location = await getLocation();
      const watermarkedPhoto = await addPhotoWatermark(requestPhoto, location);
      const formData = new FormData();
      formData.append('photo', watermarkedPhoto);
      formData.append('latitude', String(location.latitude));
      formData.append('longitude', String(location.longitude));
      Object.entries(requestDraft).forEach(([key, value]) => formData.append(key, value));
      await requestJson(`${operationsUrl}/attendance/requests`, { method: 'POST', body: formData });
      setRequestPhoto(null);
      setRequestDraft((current) => ({ ...current, reason: '' }));
      event.currentTarget.reset();
      setMessage('Pengajuan berhasil dikirim dan menunggu persetujuan.');
      await loadReport();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await requestJson(`${operationsUrl}/attendance/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSettings(result.settings);
      setMessage('Pengaturan jam kerja berhasil disimpan.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (request, status) => {
    setBusy(true);
    setError('');
    try {
      await requestJson(`${operationsUrl}/attendance/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setMessage(`Pengajuan ${status === 'approved' ? 'disetujui' : 'ditolak'}.`);
      await loadReport();
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setBusy(false);
    }
  };

  const reportCounts = useMemo(() => report.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {}), [report]);
  const selectedBranchName = branches.find((branch) => branch.id === branchId)?.name || 'Semua cabang';

  if (!isAuthenticated) return <section className="content"><div className="page-heading"><div><div className="eyebrow">KARYAWAN <span>/</span> KEHADIRAN</div><h1>Absensi & perizinan</h1></div></div><div className="notice">Pratinjau saja. Masuk ke workspace untuk mencatat absensi dan melihat laporan yang tersimpan.</div></section>;

  return <section className="content attendance-workspace">
    <div className="page-heading"><div><div className="eyebrow">KARYAWAN <span>/</span> KEHADIRAN</div><h1>Absensi & perizinan</h1><p>Foto dan lokasi hanya direkam saat Anda mengirim absensi atau pengajuan. Data tersimpan pada workspace dan cabang terkait.</p></div></div>
    {message && <div className="notice" role="status">{message}</div>}
    {error && <div className="notice error-notice" role="alert">{error}</div>}

    <section className="attendance-clock-grid">
      <form className="table-card attendance-action-card" onSubmit={(event) => submitAttendance(event, 'check-in', checkInPhoto, setCheckInPhoto)}>
        <div className="table-heading"><div><h2>Absensi masuk</h2><p>{today?.attendance?.workDate || 'Hari ini'} · {settings.workStart}–{settings.workEnd}</p></div><span className={`attendance-status ${isClockedIn ? 'is-done' : ''}`}>{isClockedIn ? 'Tercatat' : 'Belum absen'}</span></div>
        {isClockedIn ? <div className="attendance-record-preview"><strong>{new Date(today.attendance.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong><a href={today.attendance.checkInMapsUrl} rel="noreferrer" target="_blank">Lihat lokasi di Google Maps ↗</a></div> : <><LiveCameraField label="Foto selfie masuk" onChange={setCheckInPhoto} photo={checkInPhoto} /><button className="button button-primary" disabled={busy || !checkInPhoto} type="submit">{busy ? 'Menyimpan…' : 'Absen masuk dengan foto & lokasi'}</button></>}
      </form>
      <form className="table-card attendance-action-card" onSubmit={(event) => submitAttendance(event, 'check-out', checkOutPhoto, setCheckOutPhoto)}>
        <div className="table-heading"><div><h2>Absensi pulang</h2><p>Ambil foto dan tandai lokasi saat pulang.</p></div><span className={`attendance-status ${isClockedOut ? 'is-done' : ''}`}>{isClockedOut ? 'Tercatat' : 'Belum absen'}</span></div>
        {isClockedOut ? <div className="attendance-record-preview"><strong>{new Date(today.attendance.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong><a href={today.attendance.checkOutMapsUrl} rel="noreferrer" target="_blank">Lihat lokasi di Google Maps ↗</a></div> : <><LiveCameraField label="Foto selfie pulang" onChange={setCheckOutPhoto} photo={checkOutPhoto} /><button className="button button-primary" disabled={busy || !isClockedIn || !checkOutPhoto} type="submit">{busy ? 'Menyimpan…' : 'Absen pulang dengan foto & lokasi'}</button></>}
      </form>
    </section>

    <form className="table-card attendance-request-card" onSubmit={submitRequest}>
      <div className="table-heading"><div><h2>Izin, cuti, sakit, atau perjalanan dinas</h2><p>Semua pengajuan wajib menyertakan foto bukti dan lokasi saat pengajuan.</p></div></div>
      <div className="attendance-request-fields">
        <label className="field"><span>Jenis pengajuan</span><select onChange={(event) => setRequestDraft({ ...requestDraft, requestType: event.target.value })} value={requestDraft.requestType}><option value="permission">Izin</option><option value="leave">Cuti</option><option value="sick">Sakit</option><option value="business_trip">Perjalanan dinas</option></select></label>
        <label className="field"><span>Tanggal mulai</span><input onChange={(event) => setRequestDraft({ ...requestDraft, startDate: event.target.value })} required type="date" value={requestDraft.startDate} /></label>
        <label className="field"><span>Tanggal selesai</span><input min={requestDraft.startDate} onChange={(event) => setRequestDraft({ ...requestDraft, endDate: event.target.value })} required type="date" value={requestDraft.endDate} /></label>
        <label className="field"><span>Alasan</span><input maxLength="1000" onChange={(event) => setRequestDraft({ ...requestDraft, reason: event.target.value })} required value={requestDraft.reason} /></label>
      </div>
      <div className="attendance-request-submit"><PhotoField label="Foto bukti pengajuan" onChange={setRequestPhoto} /><button className="button button-primary" disabled={busy} type="submit">{busy ? 'Mengirim…' : 'Kirim pengajuan'}</button></div>
    </form>

    {canManageSchedule && <form className="table-card attendance-settings-card" onSubmit={saveSettings}>
      <div className="table-heading"><div><h2>Pengaturan jam kerja</h2><p>Atur jadwal workspace. Karyawan yang tidak mencatat absensi pada hari kerja otomatis tercatat Alfa setelah toleransi.</p></div></div>
      <div className="attendance-request-fields">
        <label className="field"><span>Zona waktu</span><select onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} value={settings.timezone}><option value="Asia/Jakarta">WIB — Asia/Jakarta</option><option value="Asia/Makassar">WITA — Asia/Makassar</option><option value="Asia/Jayapura">WIT — Asia/Jayapura</option></select></label>
        <label className="field"><span>Jam mulai</span><input onChange={(event) => setSettings({ ...settings, workStart: event.target.value })} required type="time" value={settings.workStart} /></label>
        <label className="field"><span>Jam selesai</span><input onChange={(event) => setSettings({ ...settings, workEnd: event.target.value })} required type="time" value={settings.workEnd} /></label>
        <label className="field"><span>Toleransi keterlambatan (menit)</span><input max="240" min="0" onChange={(event) => setSettings({ ...settings, graceMinutes: Number(event.target.value) })} required type="number" value={settings.graceMinutes} /></label>
      </div>
      <div className="weekday-picker">{weekdays.map(([day, label]) => <label key={day}><input checked={settings.workDays.includes(day)} onChange={() => setSettings((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((item) => item !== day) : [...current.workDays, day] }))} type="checkbox" />{label}</label>)}</div>
      <button className="button button-primary" disabled={busy} type="submit">Simpan jam kerja</button>
    </form>}

    {canViewReport && <section className="table-card attendance-report-card">
      <div className="table-heading"><div><h2>Laporan kehadiran</h2><p>Data alfa dihitung dari jadwal dan toleransi jam kerja yang ditetapkan.</p></div><div className="attendance-report-filters">
        <label className="field"><span>Tanggal</span><input onChange={(event) => setReportDate(event.target.value)} type="date" value={reportDate} /></label>
        <label className="field"><span>Cabang</span><select onChange={(event) => setBranchId(event.target.value)} value={branchId}>{canSeeAllBranches && <option value="">Semua cabang</option>}{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <button className="button button-quiet" onClick={() => downloadAttendanceReport(report, reportDate, selectedBranchName)} type="button">Ekspor CSV</button>
      </div></div>
      <div className="attendance-counts">{[['present', 'Hadir'], ['absent', 'Alfa'], ['excused', 'Izin disetujui']].map(([key, label]) => <span key={key}>{label}: <strong>{reportCounts[key] || 0}</strong></span>)}</div>
      <div className="table-scroll"><table><thead><tr><th>NAMA</th><th>CABANG</th><th>STATUS</th><th>MASUK</th><th>BUKTI & LOKASI</th></tr></thead><tbody>
        {report.map((item) => <tr key={item.userId}><td><strong>{item.userName}</strong><small>{item.role}</small></td><td>{item.branchName}</td><td><span className={`attendance-status status-${item.status}`}>{statusLabel(item.status)}</span></td><td>{item.checkInAt ? new Date(item.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>{item.checkInPhotoUrl ? <div className="attendance-proof"><a href={item.checkInPhotoUrl} rel="noreferrer" target="_blank"><img alt={`Bukti absensi ${item.userName}`} src={item.checkInPhotoUrl} /></a><a href={item.checkInMapsUrl} rel="noreferrer" target="_blank">Google Maps ↗</a></div> : '—'}</td></tr>)}
      </tbody></table></div>
      {report.length === 0 && <p className="empty-state">Tidak ada anggota tim pada cabang/tanggal ini.</p>}
    </section>}

    <section className="table-card attendance-requests-table">
      <div className="table-heading"><div><h2>Pengajuan</h2><p>Persetujuan Owner, Super Admin, atau HRD.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>PEMOHON</th><th>JENIS</th><th>PERIODE</th><th>ALASAN</th><th>BUKTI</th><th>STATUS</th>{canReview && <th>TINDAKAN</th>}</tr></thead><tbody>
        {requests.map((item) => <tr key={item.id}><td>{item.userName || 'Anda'}<small>{item.branchName}</small></td><td>{item.requestType.replace('_', ' ')}</td><td>{item.startDate} – {item.endDate}</td><td>{item.reason}</td><td><a href={item.evidencePhotoUrl} rel="noreferrer" target="_blank">Lihat foto ↗</a></td><td>{statusLabel(item.status)}</td>{canReview && <td>{item.status === 'pending' && <div className="attendance-review-actions"><button className="text-button" disabled={busy} onClick={() => reviewRequest(item, 'approved')} type="button">Setujui</button><button className="text-button danger-text" disabled={busy} onClick={() => reviewRequest(item, 'rejected')} type="button">Tolak</button></div>}</td>}</tr>)}
      </tbody></table></div>
      {requests.length === 0 && <p className="empty-state">Belum ada pengajuan.</p>}
    </section>
  </section>;
}
