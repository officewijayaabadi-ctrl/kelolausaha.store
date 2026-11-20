import { afterEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

const openOwnerPreview = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Pratinjau dashboard Owner' }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

test('shows a public product site with platform features and activation prices', () => {
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { name: /Kelola usaha lebih terarah/ })).toBeDefined();
  expect(screen.getByText('POS & kasir')).toBeDefined();
  expect(screen.getByText('Nota digital WhatsApp')).toBeDefined();
  expect(screen.getByText('Dealer motor')).toBeDefined();
  expect(screen.getByText(/demo selama satu bulan.*Owner Usaha/i)).toBeDefined();
  expect(screen.getByText(/Owner Usaha dapat memilih paket/)).toBeDefined();
  expect(screen.getByText(/15\.000\.000/)).toBeDefined();
  expect(container.querySelector('.public-brand-logo').getAttribute('src')).toBe('/kelolausaha-logo.svg');
});

test('previews the platform-owner console with clearly marked dealer-motor sample data', () => {
  render(<App />);
  openOwnerPreview();
  expect(screen.getByRole('heading', { name: 'Rekap semua usaha' })).toBeDefined();
  expect(screen.getByText(/Mode pratinjau Owner/)).toBeDefined();
  expect(screen.getByText('Dealer Motor Wijaya Abadi Mulia')).toBeDefined();
});

test('keeps company bookkeeping and Owner invitations unavailable to Super Admin', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  expect(screen.queryByRole('button', { name: 'Pembukuan' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Aktivasi' })).toBeNull();
  expect(screen.queryByRole('status', { name: 'Hitung mundur masa demo' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Pengelolaan Akses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Atur akses Rizky Pratama' }));
  const accessRoles = Array.from(screen.getByLabelText('Peran pengguna').options)
    .map((option) => option.value);
  expect(accessRoles).not.toContain('SUPER ADMIN');
  expect(accessRoles).not.toContain('OWNER');
  fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
  fireEvent.click(screen.getByRole('button', { name: 'User Management' }));
  const roleOptions = Array.from(screen.getByRole('combobox', { name: 'Peran karyawan' }).options)
    .map((option) => option.value);
  expect(roleOptions).not.toContain('SUPER ADMIN');
  expect(roleOptions).not.toContain('OWNER');
});

test('allows an Owner to invite a Super Admin but limits Super Admin invites to operations roles', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ inviteUrl: 'https://kelolausaha.store/?invite=owner-created' }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'User Management' }));
  const inviteRole = screen.getByRole('combobox', { name: 'Peran karyawan' });
  expect(inviteRole.value).toBe('SUPER ADMIN');
  fireEvent.click(screen.getByRole('button', { name: /buat link pendaftaran/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ role: 'SUPER ADMIN' });
});

test('customizes and saves a company dashboard theme in the demo browser', () => {
  const { container } = render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tampilan Dashboard' }));
  fireEvent.click(screen.getByRole('button', { name: /Navy Elegan/ }));
  fireEvent.change(screen.getByLabelText('Tampilan sidebar'), { target: { value: 'mini' } });
  fireEvent.change(screen.getByLabelText('Gaya kartu statistik'), { target: { value: 'soft' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan tampilan/i }));

  const appShell = container.querySelector('.app-shell');
  expect(appShell.dataset.theme).toBe('navy-elegant');
  expect(appShell.dataset.dashboardMode).toBe('dark');
  expect(appShell.dataset.sidebar).toBe('mini');
  expect(JSON.parse(localStorage.getItem('ku-demo-theme:dealer_motor')).statCardStyle).toBe('soft');
  expect(screen.getByRole('status').textContent).toContain('Tema pratinjau tersimpan');
});

test('shows tenant summaries only after platform-owner authentication', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Silakan masuk kembali.' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'platform-owner', name: 'Owner Platform', email: 'owner@kelolausaha.store', role: 'PLATFORM_OWNER' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        businesses: [{
          id: 'company-1',
          name: 'Dealer Motor Nusantara',
          business_type: 'dealer_motor',
          owner_email: 'admin@dealer.co.id',
          status: 'trial',
          trial_ends_at: '2026-12-20T00:00:00Z',
          user_count: 2,
          paid_order_count: 0,
          lifetime_revenue: 0,
        }],
        summary: { total: 1, trials: 1, active: 0, paidRevenue: 0 },
      }),
    });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /masuk/i }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@kelolausaha.store' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  await waitFor(() => expect(screen.getByText('Dealer Motor Nusantara')).toBeDefined());
  expect(fetchMock.mock.calls[3][0]).toBe('/api/platform/businesses');
  expect(screen.queryByRole('combobox', { name: 'Pilih akun demo' })).toBeNull();
});

test('restores a signed-in platform-owner session after returning from checkout', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'platform-owner', name: 'Owner Platform', email: 'owner@kelolausaha.store', role: 'PLATFORM_OWNER' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        businesses: [],
        summary: { total: 0, trials: 0, active: 0, paidRevenue: 0 },
      }),
    });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Rekap semua usaha' })).toBeDefined());
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/session');
  expect(fetchMock.mock.calls[1][0]).toBe('/api/platform/businesses');
  expect(screen.queryByRole('link', { name: 'Masuk' })).toBeNull();
});

test('creates a sequential SPK draft for the selected date', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-5' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: /buat spk baru/i })[0]);
  fireEvent.change(screen.getByLabelText(/tanggal spk/i), { target: { value: '2026-11-20' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan draft/i }));
  expect(screen.getByRole('status').textContent).toContain('SPK-WAM-20261120-0004');
  expect(screen.getByRole('status').textContent).toContain('draft');
});

test('allows Super Admin to set permissions for an individual user', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Pengelolaan Akses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Atur akses Rizky Pratama' }));

  const reportPermission = screen.getByLabelText(/Laporan & performa/);
  expect(reportPermission.checked).toBe(false);
  fireEvent.click(reportPermission);
  fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

  const salesRow = screen.getByText('Rizky Pratama').closest('tr');
  expect(salesRow.textContent).toContain('6 modul diizinkan');

  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-5' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Laporan Penjualan' }));
  expect(screen.getByRole('heading', { name: 'Laporan Penjualan' })).toBeDefined();
});

test('registers a business with a customizable industry structure and verifies by email OTP', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'new-owner', name: 'Rani WAM', email: 'rani@wam.co.id', role: 'OWNER' },
        business: {
          name: 'Toko Rani',
          subscription: {
            status: 'trial',
            trialEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        },
      }),
    });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /daftar/i }));
  expect(screen.getByRole('heading', { name: 'Buat workspace usaha' })).toBeDefined();

  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani WAM' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@wam.co.id' } });
  fireEvent.change(screen.getByLabelText('Nama usaha'), { target: { value: 'Toko Rani' } });
  fireEvent.change(screen.getByLabelText('Jenis usaha'), { target: { value: 'retail' } });
  fireEvent.click(screen.getByLabelText('Data pelanggan'));
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));

  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  expect(screen.getByText('rani@wam.co.id')).toBeDefined();
  const request = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(request.businessType).toBe('retail');
  expect(request.businessName).toBe('Toko Rani');
  expect(request.modules).not.toContain('customers');
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined());
  expect(screen.getByText('Rani WAM')).toBeDefined();
  expect(screen.getByRole('status', { name: 'Hitung mundur masa demo' })).toBeDefined();
  expect(screen.getByText('Demo gratis tersisa')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Pembukuan' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Pengelolaan Akses' })).toBeDefined();
  expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/verify-otp');
});

test('creates an employee registration link through the server', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ inviteUrl: 'https://kelolausaha.store/?invite=abc123' }),
    }));
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'User Management' }));
  fireEvent.click(screen.getByRole('button', { name: /buat link pendaftaran/i }));

  await waitFor(() => expect(screen.getByLabelText('Link pendaftaran karyawan').value)
    .toBe('https://kelolausaha.store/?invite=abc123'));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ role: 'ADMIN' });
});

test('does not show the OTP step when the email service rejects a request', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Email tidak dapat dikirim.' }),
    }));
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /daftar/i }));
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani WAM' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@wam.co.id' } });
  fireEvent.change(screen.getByLabelText('Nama usaha'), { target: { value: 'Toko Rani' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));

  expect((await screen.findByRole('alert')).textContent).toContain('Email tidak dapat dikirim.');
  expect(screen.queryByRole('heading', { name: 'Cek email Anda' })).toBeNull();
});

test('opens the employee registration form from an invite link', async () => {
  window.history.pushState({}, '', '/?invite=abc123');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Daftar sebagai karyawan' })).toBeDefined();
  expect(screen.queryByLabelText('Nama usaha')).toBeNull();
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani Karyawan' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@wam.co.id' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).inviteToken).toBe('abc123');
});

test('creates a POS receipt and prepares its WhatsApp share message', async () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Daftar Harga' }));
  fireEvent.change(screen.getByLabelText('Nama produk / jasa'), { target: { value: 'Cuci reguler' } });
  fireEvent.change(screen.getByLabelText('Satuan'), { target: { value: 'kg' } });
  fireEvent.change(screen.getByLabelText('Harga'), { target: { value: '7000' } });
  fireEvent.click(screen.getByRole('button', { name: /tambah harga/i }));

  fireEvent.click(screen.getByRole('button', { name: 'Kasir' }));
  fireEvent.click(screen.getByRole('button', { name: /cuci reguler/i }));
  fireEvent.change(screen.getByLabelText('Nama pelanggan'), { target: { value: 'Budi Santoso' } });
  fireEvent.change(screen.getByLabelText('Nomor WhatsApp'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Jumlah dibayar'), { target: { value: '10000' } });
  fireEvent.click(screen.getByRole('button', { name: /simpan transaksi & buat nota/i }));

  expect(screen.getByRole('heading', { name: 'Nota Digital' })).toBeDefined();
  expect(screen.getAllByText(/POS-\d{8}-0001/).length).toBeGreaterThan(0);
  const shareLink = screen.getByRole('link', { name: /bagikan nota via whatsapp/i });
  const shareUrl = new URL(shareLink.href);
  expect(shareUrl.hostname).toBe('wa.me');
  expect(shareUrl.pathname).toBe('/6281234567890');
  expect(shareUrl.searchParams.get('text')).toContain('Budi Santoso');
  expect(shareUrl.searchParams.get('text')).toContain('Cuci reguler');
  expect(shareUrl.searchParams.get('text')).toContain('7.000');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Cetak nota' }));
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  window.dispatchEvent(new Event('afterprint'));
  print.mockRestore();
});

test('routes a restaurant digital order through cashier, kitchen, waiter, payment, and WhatsApp receipt', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'restaurant-owner', name: 'Rani Cafe', email: 'rani@cafe.test', role: 'OWNER' },
        business: { name: 'Kafe Rani', type: 'restaurant' },
      }),
    })
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /daftar/i }));
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani Cafe' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@cafe.test' } });
  fireEvent.change(screen.getByLabelText('Nama usaha'), { target: { value: 'Kafe Rani' } });
  fireEvent.change(screen.getByLabelText('Jenis usaha'), { target: { value: 'restaurant' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: 'Menu Digital' }));
  fireEvent.click(screen.getByRole('button', { name: /Buat QR Code/ }));
  const generalQr = await screen.findByAltText('QR menu umum');
  expect(generalQr.getAttribute('src')).toContain('data:image/svg+xml');
  expect(new URL(screen.getByRole('link', { name: 'Buka menu' }).href).searchParams.get('menu')).toBe('restaurant');
  fireEvent.change(screen.getByRole('combobox', { name: 'Jenis QR menu' }), { target: { value: 'tables' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Jumlah meja' }), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: /Buat QR Code/ }));
  expect(await screen.findByAltText('QR menu meja 01')).toBeDefined();
  expect(await screen.findByAltText('QR menu meja 02')).toBeDefined();
  const tableQrLink = screen.getAllByRole('link', { name: 'Buka menu' })[0];
  expect(new URL(tableQrLink.href).searchParams.get('table')).toBe('01');
  fireEvent.click(screen.getByRole('button', { name: /Nasi goreng spesial/ }));
  fireEvent.change(screen.getByLabelText('Nama pemesan'), { target: { value: 'Budi Santoso' } });
  fireEvent.change(screen.getByLabelText('Nomor HP / WhatsApp'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Nomor meja'), { target: { value: '05' } });
  fireEvent.change(screen.getByLabelText('Waktu pembayaran'), { target: { value: 'Bayar di awal' } });
  fireEvent.change(screen.getByLabelText('Catatan khusus (opsional)'), { target: { value: 'Tanpa bawang' } });
  fireEvent.click(screen.getByRole('button', { name: /Kirim pesanan ke kasir/i }));

  expect(screen.getByText('Budi Santoso · Meja 05')).toBeDefined();
  expect(screen.getByText('Tanpa bawang')).toBeDefined();
  expect(screen.getByText('MENUNGGU APPROVAL KASIR')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Setujui & kirim ke dapur/i }));
  fireEvent.click(screen.getByRole('button', { name: /Dapur: tandai siap/i }));
  fireEvent.click(screen.getByRole('button', { name: /Waiter: tandai diantar/i }));
  fireEvent.click(screen.getByRole('button', { name: /Konfirmasi pembayaran lunas/i }));
  expect(screen.getByText('SELESAI')).toBeDefined();
  expect(screen.getByText('LUNAS')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Nota Digital' }));
  const shareUrl = new URL(screen.getByRole('link', { name: /Bagikan nota via WhatsApp/i }).href);
  expect(shareUrl.hostname).toBe('wa.me');
  expect(shareUrl.searchParams.get('text')).toContain('Meja: 05');
  expect(shareUrl.searchParams.get('text')).toContain('Budi Santoso');
  expect(shareUrl.searchParams.get('text')).toContain('Catatan khusus: Tanpa bawang');
});

test('opens a table QR as a public menu and stores the order with its automatic table number', () => {
  window.history.pushState({}, '', '/?menu=restaurant&workspace=company-123&table=05');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Silakan masuk.' }),
  }));
  render(<App />);

  expect(screen.getByText('Nomor meja otomatis:')).toBeDefined();
  expect(screen.getByText('05')).toBeDefined();
  expect(screen.queryByLabelText('Nomor meja')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tambah Nasi goreng spesial' }));
  fireEvent.change(screen.getByLabelText('Nama pemesan'), { target: { value: 'Budi Santoso' } });
  fireEvent.change(screen.getByLabelText('Nomor HP / WhatsApp'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Catatan khusus (opsional)'), { target: { value: 'Saus dipisah' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim pesanan ke kasir/i }));

  expect(screen.getByRole('status').textContent).toContain('sudah dikirim ke kasir');
  const orders = JSON.parse(localStorage.getItem('ku:restaurant-orders:company-123'));
  expect(orders[0].tableNumber).toBe('05');
  expect(orders[0].customer).toBe('Budi Santoso');
  expect(orders[0].specialNotes).toBe('Saus dipisah');
  expect(orders[0].paymentStatus).toBe('BELUM LUNAS');
});
