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

test('lets the owner open business profile management', async () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Profil Usaha' }));

  expect(await screen.findByRole('heading', { name: 'Profil Usaha' })).toBeDefined();
  expect(screen.getByRole('textbox', { name: /Nama usaha/ }).value).toBe('Dealer Motor Wijaya Abadi Mulia');
  expect(screen.getByRole('textbox', { name: /Alamat usaha/ })).toBeDefined();
  expect(screen.getByLabelText('Logo usaha')).toBeDefined();
});

test('lets the Super Admin open business profile management', async () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Profil Usaha' }));

  expect(await screen.findByRole('heading', { name: 'Profil Usaha' })).toBeDefined();
  expect(screen.getByRole('textbox', { name: /Nama usaha/ })).toBeDefined();
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
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    role: 'SUPER ADMIN',
    branchId: 'preview-branch-primary',
  });
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

test('opens account profile and logs out from the account menu', async () => {
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'platform-owner',
            name: 'Owner Platform',
            email: 'owner@kelolausaha.store',
            role: 'PLATFORM_OWNER',
          },
        }),
      };
    }
    if (url === '/api/platform/businesses') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          businesses: [],
          summary: { total: 0, trials: 0, active: 0, paidRevenue: 0 },
        }),
      };
    }
    if (url === '/api/platform/support/tickets') {
      return { ok: true, json: async () => ({ tickets: [] }) };
    }
    if (url === '/api/auth/logout') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  await screen.findByRole('heading', { name: 'Rekap semua usaha' });
  fireEvent.click(screen.getByRole('button', { name: 'Menu akun' }));
  fireEvent.click(screen.getByRole('button', { name: 'Profil Saya' }));
  const profile = await screen.findByRole('dialog', { name: 'Profil Saya' });
  expect(profile.textContent).toContain('owner@kelolausaha.store');
  expect(profile.textContent).toContain('PLATFORM OWNER');

  fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Menu akun' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keluar' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' }));
  expect(await screen.findByRole('link', { name: 'Masuk' })).toBeDefined();
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

test('verifies email first, then creates a business with its selected modules', async () => {
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/session') return { ok: false, status: 401, json: async () => ({}) };
    if (url === '/api/auth/request-otp') return { ok: true, json: async () => ({}) };
    if (url === '/api/auth/verify-otp') {
      return {
        ok: true,
        json: async () => ({
          user: { id: 'new-owner', name: 'Rani WAM', email: 'rani@wam.co.id', role: 'OWNER' },
        }),
      };
    }
    if (url === '/api/auth/setup-business') {
      return {
        ok: true,
        json: async () => ({
        user: { id: 'new-owner', name: 'Rani WAM', email: 'rani@wam.co.id', role: 'OWNER' },
        business: {
          id: 'company-retail',
          name: 'Toko Rani',
          slug: 'toko-rani',
          workspaceUrl: 'https://toko-rani.kelolausaha.store',
          type: 'retail',
          modules: ['dashboard', 'pos'],
          subscription: {
            status: 'trial',
            trialEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          },
        },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /daftar/i }));
  expect(screen.getByRole('heading', { name: 'Buat workspace usaha' })).toBeDefined();

  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani WAM' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@wam.co.id' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));

  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  expect(screen.getByText('rani@wam.co.id')).toBeDefined();
  const request = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(request.registerAccount).toBe(true);
  expect(request.businessName).toBeUndefined();
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Siapkan usaha Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Nama usaha'), { target: { value: 'Toko Rani' } });
  fireEvent.change(screen.getByLabelText('Alamat usaha'), { target: { value: 'Jalan Merdeka 10, Bojonegoro' } });
  fireEvent.change(screen.getByLabelText('Jenis usaha'), { target: { value: 'retail' } });
  fireEvent.click(screen.getByLabelText('Data pelanggan'));
  fireEvent.click(screen.getByRole('button', { name: /buat workspace usaha/i }));
  await waitFor(() => expect(screen.getByLabelText('Link workspace usaha').value)
    .toBe('https://toko-rani.kelolausaha.store'));
  fireEvent.click(screen.getByRole('button', { name: /Buka workspace/ }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined());
  expect(screen.getByText('Rani WAM')).toBeDefined();
  expect(screen.getByRole('status', { name: 'Hitung mundur masa demo' })).toBeDefined();
  expect(screen.getByText('Demo gratis tersisa')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Pembukuan' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Pengelolaan Akses' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Kasir Toko' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Semua Unit' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Input SPK' })).toBeNull();
  const verifyCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/verify-otp');
  const setupCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/setup-business');
  expect(verifyCall).toBeDefined();
  expect(setupCall).toBeDefined();
  const setupPayload = JSON.parse(setupCall[1].body);
  expect(setupPayload.businessName).toBe('Toko Rani');
  expect(setupPayload.businessAddress).toBe('Jalan Merdeka 10, Bojonegoro');
  expect(setupPayload.businessType).toBe('retail');
  expect(setupPayload.modules).not.toContain('customers');
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
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    role: 'ADMIN',
    branchId: 'preview-branch-primary',
  });
});

test('menu navigation updates the URL and exposes delivery only to drivers', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  expect(screen.queryByRole('button', { name: 'Pengiriman' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-6' },
  });
  expect(screen.getByRole('button', { name: 'Pengiriman' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Pengiriman' }));
  expect(window.location.hash).toBe('#/Pengiriman');
  expect(screen.getByText(/Masuk dengan akun DRIVER/)).toBeDefined();
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

test('shows pending approval after employee OTP verification without opening a session', async () => {
  window.history.pushState({}, '', '/?invite=abc123');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        pendingApproval: true,
        message: 'Pendaftaran berhasil. Akun Anda dapat digunakan setelah disetujui Owner atau Super Admin.',
      }),
    });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani Karyawan' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@wam.co.id' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  expect((await screen.findByRole('status')).textContent).toContain('Pendaftaran berhasil.');
  expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();
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

test('creates and prints a motorcycle purchase receipt from submitted SPK data', async () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-4' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: /Buat SPK baru/ })[0]);
  await screen.findByRole('heading', { name: 'Input SPK' });
  fireEvent.change(screen.getByLabelText(/Unit motor dari stok/), { target: { value: 'preview-unit-vario-160' } });
  fireEvent.change(screen.getByLabelText(/Sales/), { target: { value: 'Rizky Pratama' } });
  fireEvent.change(screen.getByLabelText(/NIK/), { target: { value: '1234567890123456' } });
  fireEvent.change(screen.getByLabelText(/Nama lengkap/), { target: { value: 'Budi Santoso' } });
  fireEvent.change(screen.getByLabelText(/Nomor WhatsApp/), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText(/Alamat/), { target: { value: 'Jalan Merdeka 10, Bojonegoro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tunai / Cash' }));
  fireEvent.change(screen.getByLabelText('Jumlah uang diterima kwitansi'), { target: { value: '25300000' } });
  fireEvent.change(screen.getByLabelText(/Kota penerbit kwitansi/), { target: { value: 'Bojonegoro' } });
  fireEvent.change(screen.getByLabelText('Atas nama STNK'), { target: { value: 'Budi Santoso' } });
  fireEvent.click(screen.getByRole('button', { name: /submit spk/i }));

  fireEvent.click(await screen.findByRole('button', { name: 'Nota Digital' }));
  expect(screen.getByText('KWITANSI')).toBeDefined();
  expect(screen.getByText('dua puluh lima juta tiga ratus ribu rupiah')).toBeDefined();
  expect(screen.getByText('MH1ABC12345678901')).toBeDefined();
  expect(screen.getByText('ABC1234567')).toBeDefined();
  expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0);
  const shareUrl = new URL(screen.getByRole('link', { name: /kirim kwitansi via whatsapp/i }).href);
  expect(shareUrl.hostname).toBe('wa.me');
  expect(shareUrl.searchParams.get('text')).toContain('No. Rangka: MH1ABC12345678901');

  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Cetak kwitansi' }));
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  print.mockRestore();
});

test('allows SPK verification and approval only for the matching permissions', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-4' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi SPK' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verifikasi SPK SPK-WAM-20261119-0008' }));
  expect(screen.getAllByText('APPROVAL SVP').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /Setujui SPK/ })).toBeNull();

  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-3' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Approval/ }));
  expect(screen.getByRole('button', { name: 'Setujui SPK SPK-WAM-20261120-0003' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /Verifikasi SPK SPK-/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Notifikasi persetujuan/ }));
  expect(screen.getByRole('heading', { name: 'Approval' })).toBeDefined();
});

test('keeps bookkeeping visible after saving a note with a server date timestamp', async () => {
  const branchId = '123e4567-e89b-12d3-a456-426614174000';
  const savedEntry = {
    id: 'entry-1',
    branchId,
    type: 'expense',
    category: 'Operasional',
    description: 'Catatan uji',
    amount: '125000',
    entryDate: '2026-11-22T00:00:00.000Z',
    createdAt: '2026-11-22T10:00:00.000Z',
  };
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'owner-1',
            name: 'Rika Wijaya',
            email: 'rika@example.test',
            role: 'OWNER',
            permissions: ['dashboard', 'financeView', 'financeManage'],
          },
          business: { id: 'company-1', name: 'Usaha Contoh' },
        }),
      };
    }
    if (url === '/api/team/members') {
      return {
        ok: true,
        json: async () => ({
          users: [{
            id: 'owner-1',
            name: 'Rika Wijaya',
            email: 'rika@example.test',
            role: 'OWNER',
            permissions: ['dashboard', 'financeView', 'financeManage'],
            active: true,
          }],
        }),
      };
    }
    if (url === '/api/finance/entries' && options.method === 'POST') {
      return { ok: true, json: async () => ({ entry: savedEntry }) };
    }
    if (url === '/api/finance/entries') {
      return { ok: true, json: async () => ({ entries: [] }) };
    }
    if (url === '/api/workspace/operations/branches') {
      return {
        ok: true,
        json: async () => ({
          branches: [{ id: branchId, name: 'Cabang Utama', isPrimary: true }],
        }),
      };
    }
    if (url === '/api/billing/status') {
      return {
        ok: true,
        json: async () => ({
          business: { subscription: { status: 'trial' }, themeSettings: {} },
          notifications: [],
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pembukuan' }));
  await screen.findByRole('option', { name: 'Cabang Utama' });
  fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'Operasional' } });
  fireEvent.change(screen.getByLabelText('Keterangan'), { target: { value: 'Catatan uji' } });
  fireEvent.change(screen.getByLabelText('Nominal pembukuan'), { target: { value: '125000' } });
  fireEvent.change(screen.getByLabelText('Jenis'), { target: { value: 'expense' } });
  fireEvent.click(screen.getByRole('button', { name: /Simpan catatan/ }));

  expect(await screen.findByText('Catatan uji')).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Pembukuan & laba rugi' })).toBeDefined();
  expect(screen.getAllByText('Cabang Utama').length).toBeGreaterThan(0);
  expect(fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')?.[1].body)
    .toContain(branchId);
});

test('routes a restaurant digital order through cashier, kitchen, waiter, payment, and WhatsApp receipt', async () => {
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/session') return { ok: false, status: 401, json: async () => ({}) };
    if (url === '/api/auth/verify-otp') {
      return {
        ok: true,
        json: async () => ({
          user: { id: 'restaurant-owner', name: 'Rani Cafe', email: 'rani@cafe.test', role: 'OWNER' },
        }),
      };
    }
    if (url === '/api/auth/setup-business') {
      return {
        ok: true,
        json: async () => ({
          user: { id: 'restaurant-owner', name: 'Rani Cafe', email: 'rani@cafe.test', role: 'OWNER' },
          business: {
            id: 'restaurant-company',
            name: 'Kafe Rani',
            slug: 'kafe-rani',
            workspaceUrl: 'https://kafe-rani.kelolausaha.store',
            type: 'restaurant',
            modules: ['dashboard', 'products', 'prices', 'pos', 'transactions', 'digital_receipts', 'menu', 'orders', 'tables', 'suppliers', 'sales_reports', 'employees'],
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /daftar/i }));
  fireEvent.change(screen.getByLabelText('Nama lengkap'), { target: { value: 'Rani Cafe' } });
  fireEvent.change(screen.getByLabelText('Nomor HP'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rani@cafe.test' } });
  fireEvent.click(screen.getByRole('button', { name: /kirim kode otp/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cek email Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Kode OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verifikasi email/i }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Siapkan usaha Anda' })).toBeDefined());
  fireEvent.change(screen.getByLabelText('Nama usaha'), { target: { value: 'Kafe Rani' } });
  fireEvent.change(screen.getByLabelText('Alamat usaha'), { target: { value: 'Jalan Kuliner 5, Jakarta' } });
  fireEvent.change(screen.getByLabelText('Jenis usaha'), { target: { value: 'restaurant' } });
  fireEvent.click(screen.getByRole('button', { name: /buat workspace usaha/i }));
  await waitFor(() => expect(screen.getByLabelText('Link workspace usaha').value)
    .toBe('https://kafe-rani.kelolausaha.store'));
  fireEvent.click(screen.getByRole('button', { name: /Buka workspace/ }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined());
  await waitFor(() => expect(screen.queryByText('Memuat ringkasan operasional…')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: 'Menu Digital' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Menu Digital' })).toBeDefined());
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

  fireEvent.click(screen.getByRole('button', { name: 'Nota Restoran' }));
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
