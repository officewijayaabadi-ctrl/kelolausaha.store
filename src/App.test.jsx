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
  expect(screen.getByText(/5\.900\.000/)).toBeDefined();
  expect(container.querySelector('.public-brand-logo').getAttribute('src')).toBe('/kelolausaha-logo.svg');
});

test('previews the platform-owner console with clearly marked dealer-motor sample data', () => {
  render(<App />);
  openOwnerPreview();
  expect(screen.getByRole('heading', { name: 'Rekap semua usaha' })).toBeDefined();
  expect(screen.getByText(/Mode pratinjau Owner/)).toBeDefined();
  expect(screen.getByText('Dealer Motor Wijaya Abadi Mulia')).toBeDefined();
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
  expect(salesRow.textContent).toContain('5 modul diizinkan');

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
        user: { id: 'new-owner', name: 'Rani WAM', email: 'rani@wam.co.id', role: 'SUPER ADMIN' },
        business: { name: 'Toko Rani' },
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
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ role: 'SALES' });
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

test('creates a POS receipt and prepares its WhatsApp share message', () => {
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
});
