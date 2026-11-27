import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App, {
  createPosReceiptSvg,
  getDefaultRolePermissions,
  getUserMenus,
  getWorkspaceModulesForBusiness,
} from './App';

const { mockIo, mockSocket, mockSocketHandlers } = vi.hoisted(() => {
  const handlers = new Map();
  const socket = {
    on: vi.fn((event, handler) => {
      handlers.set(event, handler);
      return socket;
    }),
    emit: vi.fn((event, _payload, acknowledge) => {
      if (event === 'support:join') acknowledge?.({ ok: true });
    }),
    disconnect: vi.fn(),
  };
  return {
    mockIo: vi.fn(() => socket),
    mockSocket: socket,
    mockSocketHandlers: handlers,
  };
});

vi.mock('socket.io-client', () => ({ io: mockIo }));

const openOwnerPreview = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Pratinjau dashboard Owner' }));
};

afterEach(() => {
  mockIo.mockClear();
  mockSocket.on.mockClear();
  mockSocket.emit.mockClear();
  mockSocket.disconnect.mockClear();
  mockSocketHandlers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

test('shows a public product site with platform features and activation prices', () => {
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { name: /Kelola bisnis lebih cerdas.*Tumbuh lebih cepat/i })).toBeDefined();
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

test('uses the updated business logo across workspace and dashboard branding', async () => {
  localStorage.setItem('ku-demo-theme:dealer_motor', JSON.stringify({
    logoUrl: '/uploads/company/business-logo-new.png',
    dashboardLogoUrl: '/uploads/company/dashboard-logo-old.png',
  }));
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });

  await waitFor(() => {
    expect(document.querySelector('.brand-mark img')?.getAttribute('src'))
      .toBe('/uploads/company/business-logo-new.png');
    expect(document.querySelector('.dealer-switch .dealer-icon img')?.getAttribute('src'))
      .toBe('/uploads/company/business-logo-new.png');
    expect(document.querySelector('.overview-banner .banner-emblem img')?.getAttribute('src'))
      .toBe('/uploads/company/business-logo-new.png');
  });
});

test('opens distinct dealer target and sales report pages instead of the SPK fallback', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Target' }));
  expect(screen.getByRole('heading', { name: 'Target Penjualan' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Atur target' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Daftar SPK' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Laporan Penjualan' }));
  expect(screen.getByRole('heading', { name: 'Laporan Penjualan' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Rekap per cabang' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Rekap per sales' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Daftar SPK' })).toBeNull();
});

test('opens distinct dealer Sales and Customer pages instead of the SPK fallback', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Sales' }));
  expect(screen.getByRole('heading', { name: 'Tim Sales' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Performa per sales' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Daftar SPK' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
  expect(screen.getByRole('heading', { name: 'Data Pelanggan' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Tambah pelanggan' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'Daftar SPK' })).toBeNull();
});

test('opens workspace settings from the active workspace and keeps dealer inventory enabled', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  expect(screen.getByRole('button', { name: 'Stok' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Stok' }));
  expect(screen.getByRole('heading', { name: 'Stok unit motor' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Buka pengaturan workspace' }));
  expect(screen.getByRole('menu', { name: 'Menu pengaturan workspace' })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: /Pengaturan Usaha/ })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: /Pengaturan POS/ })).toBeDefined();
  expect(screen.getByRole('menuitem', { name: /Stok Unit/ })).toBeDefined();
  fireEvent.click(screen.getByRole('menuitem', { name: /Struktur Workspace/ }));

  expect(screen.getByRole('heading', { name: 'Struktur Workspace' })).toBeDefined();
  const vehiclesModule = screen.getByRole('checkbox', { name: /Data motor & stok unit/ });
  expect(vehiclesModule.checked).toBe(true);
  expect(vehiclesModule.disabled).toBe(true);
  expect(vehiclesModule.checked).toBe(true);
  expect(vehiclesModule.parentElement.textContent)
    .toContain('Aktif dan wajib untuk alur stok, PDI, dan pengiriman dealer.');
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan tema usaha' }));
  expect(screen.getByRole('heading', { name: 'Pengaturan Tampilan Dashboard' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Terapkan Tema' }).disabled).toBe(false);
  expect(getWorkspaceModulesForBusiness('dealer_motor', ['dashboard'])).toContain('vehicles');
  expect(getWorkspaceModulesForBusiness('retail', ['dashboard'])).not.toContain('vehicles');
});

test('grants SPV stock access and gives administrators delivery schedule permission', () => {
  const spvPermissions = getDefaultRolePermissions('SPV');
  const spvMenus = getUserMenus({ role: 'SPV', permissions: spvPermissions });

  expect(spvPermissions).toContain('unitManage');
  expect(spvMenus.some(([label]) => label === 'Stok')).toBe(true);
  expect(getDefaultRolePermissions('ADMIN')).toContain('deliveryScheduleManage');
  expect(getDefaultRolePermissions('ADMIN')).toContain('pdiManage');
  expect(getDefaultRolePermissions('ADMIN')).toContain('waybillManage');
  expect(getWorkspaceModulesForBusiness('dealer_motor', ['dashboard'])).toContain('pdi');
});

test('opens the PDI inspection queue from the notification bell', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Prioritas inspeksi PDI' }));

  expect(screen.getByRole('heading', { name: 'Inspeksi unit (PDI)' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Antrean inspeksi PDI' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Mulai inspeksi' })).toBeDefined();
});

test('shows the read-only employee directory to HRD', async () => {
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'hrd-user',
            name: 'HRD Dealer',
            email: 'hrd@dealer.test',
            role: 'HRD',
            permissions: getDefaultRolePermissions('HRD'),
          },
          business: {
            id: 'dealer-company',
            name: 'Dealer Contoh',
            type: 'dealer_motor',
            modules: ['dashboard', 'employees', 'vehicles', 'pdi', 'delivery'],
            subscription: { status: 'active' },
          },
        }),
      };
    }
    if (url === '/api/team/members') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          users: [{
            id: 'employee-1',
            name: 'Sari Karyawan',
            email: 'sari@dealer.test',
            role: 'ADMIN',
            active: true,
            approvalStatus: 'approved',
            branchName: 'Cabang Utama',
          }],
        }),
      };
    }
    if (url === '/api/workspace/operations/branches') {
      return { ok: true, status: 200, json: async () => ({ branches: [] }) };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/team/members'));
  fireEvent.click(await screen.findByRole('button', { name: 'User Management' }));

  expect(await screen.findByRole('heading', { name: 'Manajemen karyawan' })).toBeDefined();
  expect(screen.getByText('Sari Karyawan')).toBeDefined();
  expect(screen.getByText('Cabang Utama')).toBeDefined();
  expect(screen.queryByRole('button', { name: /Buat link pendaftaran/ })).toBeNull();
  expect(screen.getByText(/Pengelolaan akses tetap dilakukan Owner/)).toBeDefined();
});

test('opens POS settings from the workspace quick menu', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buka pengaturan workspace' }));
  fireEvent.click(screen.getByRole('menuitem', { name: /Pengaturan POS/ }));

  expect(screen.getByRole('heading', { name: 'Studio Nota' })).toBeDefined();
});

test('shows the business QRIS in the cashier when QRIS is selected', async () => {
  localStorage.setItem('ku-demo-theme:dealer_motor', JSON.stringify({
    qrisUrl: '/uploads/company/qris.png',
  }));
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kasir' }));
  fireEvent.change(screen.getByLabelText('Metode pembayaran'), { target: { value: 'QRIS' } });

  const qrisImage = await screen.findByRole('img', { name: 'QRIS pembayaran KelolaUsaha.store' });
  expect(qrisImage.getAttribute('src'))
    .toBe('/uploads/company/qris.png');
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

test('previews dashboard changes without applying them, then applies them for the demo company', () => {
  const { container } = render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tampilan Dashboard' }));
  const midnightTheme = Array.from(container.querySelectorAll('.theme-gallery-card'))
    .find((card) => card.textContent.includes('Midnight Dark'));
  fireEvent.click(within(midnightTheme).getByRole('button', { name: 'Pilih tema' }));
  fireEvent.change(screen.getByLabelText('Mode sidebar'), { target: { value: 'compact' } });
  fireEvent.change(screen.getByLabelText('Gaya kartu'), { target: { value: 'flat' } });

  const appShell = container.querySelector('.app-shell');
  expect(appShell.dataset.theme).toBe('ocean-blue');
  fireEvent.click(screen.getByRole('button', { name: 'Simpan Draft' }));
  expect(appShell.dataset.theme).toBe('ocean-blue');
  expect(JSON.parse(localStorage.getItem('ku-demo-theme-state:dealer_motor')).draft.themeId)
    .toBe('midnight-dark');
  fireEvent.click(screen.getByRole('button', { name: 'Terapkan Tema' }));

  expect(appShell.dataset.theme).toBe('midnight-dark');
  expect(appShell.dataset.dashboardMode).toBe('dark');
  expect(appShell.dataset.sidebar).toBe('compact');
  expect(JSON.parse(localStorage.getItem('ku-demo-theme:dealer_motor')).statCardStyle).toBe('border');
  expect(screen.getByRole('status').textContent).toContain('Tema berhasil diterapkan');
}, 30000);

test('shows enabled dashboard theme choices to the business Owner', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tampilan Dashboard' }));

  const applyButton = screen.getByRole('button', { name: 'Terapkan Tema' });
  expect(applyButton.disabled).toBe(false);
  expect(screen.queryByText(/tidak memiliki izin untuk mengubah tampilan perusahaan/)).toBeNull();
});

test('opens the receipt studio for Owner and Super Admin and saves workspace preferences', async () => {
  render(<App />);
  openOwnerPreview();
  const accountSelector = screen.getByRole('combobox', { name: 'Pilih akun demo' });

  fireEvent.change(accountSelector, { target: { value: 'user-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Nota' }));
  expect(screen.getByRole('heading', { name: 'Studio Nota' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Struk Thermal 58\/80mm/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Alamat usaha pada nota' }), {
    target: { value: 'Jl. Melati No. 18' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Kontak / WhatsApp pada nota' }), {
    target: { value: '081234567890' },
  });
  fireEvent.click(screen.getByRole('button', { name: /simpan pengaturan nota/i }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Pengaturan nota pratinjau tersimpan'));

  expect(JSON.parse(localStorage.getItem('ku-demo-theme:dealer_motor')).receiptSettings).toMatchObject({
    mode: 'thermal',
    storeAddress: 'Jl. Melati No. 18',
    storePhone: '081234567890',
  });

  fireEvent.change(accountSelector, { target: { value: 'user-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Nota' }));
  expect(await screen.findByRole('heading', { name: 'Studio Nota' })).toBeDefined();
});

test('loads the Owner receipt settings in a cashier workspace without giving the cashier setup access', async () => {
  let sessionRole = 'SALES';
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 'laundry-cashier',
            name: 'Ayu Kasir',
            email: 'kasir@laundry.test',
            role: sessionRole,
            permissions: sessionRole === 'KASIR'
              ? ['dashboard', 'posAccess', 'priceManage', 'transactionsView', 'receiptsView', 'attendanceView']
              : ['dashboard', 'customerManage', 'attendanceView'],
          },
          business: {
            id: 'laundry-business',
            name: 'LONDRI BERKAH ABADI',
            type: 'laundry',
            modules: ['dashboard', 'products', 'prices', 'pos', 'transactions', 'digital_receipts', 'customers', 'employees'],
          },
        }),
      };
    }
    if (url === '/api/operations/dashboard') {
      return { ok: true, json: async () => ({}) };
    }
    if (url === '/api/workspace/theme') {
      return {
        ok: true,
        json: async () => ({
          businessType: 'laundry',
          themeSettings: {
            receiptSettings: {
              mode: 'thermal',
              accent: 'emerald',
              storeAddress: 'Jl. Melati No. 18',
              footerNote: 'Terima kasih sudah mencuci di sini.',
            },
          },
        }),
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  expect(await screen.findByText('SALES')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Kasir' })).toBeNull();
  sessionRole = 'KASIR';
  fireEvent.focus(window);
  expect(await screen.findByText('KASIR')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Kasir Laundry/ }));
  expect(await screen.findByRole('heading', { name: 'Kasir' })).toBeDefined();
  expect(await screen.findByRole('region', { name: 'Pengaturan nota aktif' })).toBeDefined();
  expect(screen.getByText('Struk Thermal 58/80mm')).toBeDefined();
  expect(screen.getByText('Jl. Melati No. 18')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Pengaturan Nota' })).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith('/api/workspace/theme');
});

test('persists an Owner role change from Sales to Cashier with the Cashier default permissions', async () => {
  const ownerId = '123e4567-e89b-12d3-a456-426614174001';
  const employeeId = '123e4567-e89b-12d3-a456-426614174002';
  const laundryModules = [
    'dashboard', 'products', 'prices', 'pos', 'transactions', 'digital_receipts',
    'customers', 'laundry_orders', 'inventory', 'employees',
  ];
  const employee = {
    id: employeeId,
    name: 'Aditia',
    email: 'aditia@laundry.test',
    role: 'SALES',
    permissions: ['dashboard', 'spkCreate', 'spkViewOwn', 'customerManage', 'attendanceView'],
    active: true,
    approvalStatus: 'approved',
  };
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: ownerId,
            name: 'Owner Laundry',
            email: 'owner@laundry.test',
            role: 'OWNER',
            permissions: ['dashboard', 'accessManage', 'themeManage', 'userManage'],
          },
          business: {
            id: '123e4567-e89b-12d3-a456-426614174003',
            name: 'LONDRI BERKAH ABADI',
            type: 'laundry',
            modules: laundryModules,
          },
        }),
      };
    }
    if (url === '/api/operations/dashboard') {
      return { ok: true, json: async () => ({}) };
    }
    if (url === '/api/team/members' && options.method !== 'PATCH') {
      return {
        ok: true,
        json: async () => ({
          users: [{
            id: ownerId,
            name: 'Owner Laundry',
            email: 'owner@laundry.test',
            role: 'OWNER',
            permissions: ['dashboard', 'accessManage', 'themeManage', 'userManage'],
            active: true,
          }, employee],
        }),
      };
    }
    if (url === '/api/billing/status') {
      return {
        ok: true,
        json: async () => ({
          business: {
            name: 'LONDRI BERKAH ABADI',
            type: 'laundry',
            modules: laundryModules,
            themeSettings: {},
            subscription: { status: 'active' },
          },
          notifications: [],
        }),
      };
    }
    if (url === '/api/finance/entries') {
      return { ok: true, json: async () => ({ entries: [] }) };
    }
    if (url === '/api/workspace/operations/branches') {
      return { ok: true, json: async () => ({ branches: [] }) };
    }
    if (url === `/api/team/members/${employeeId}/access` && options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ user: { ...employee, ...body } }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pengelolaan Akses' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Atur akses Aditia' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Peran pengguna' }), {
    target: { value: 'KASIR' },
  });
  expect(screen.getByRole('checkbox', { name: /Kasir \/ POS/ }).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Simpan perubahan/ }));

  await waitFor(() => expect(screen.getByText('KASIR')).toBeDefined());
  const updateCall = fetchMock.mock.calls.find(([url, options]) => (
    url === `/api/team/members/${employeeId}/access` && options?.method === 'PATCH'
  ));
  expect(updateCall).toBeDefined();
  expect(JSON.parse(updateCall[1].body)).toMatchObject({
    role: 'KASIR',
    active: true,
    permissions: expect.arrayContaining(['posAccess', 'priceManage', 'transactionsView', 'receiptsView']),
  });
  expect(JSON.parse(updateCall[1].body).permissions).not.toContain('spkCreate');
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

test('shows activation dates and lets only the platform owner activate a workspace manually', async () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const fetchMock = vi.fn(async (url, options) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 'platform-owner', name: 'Owner Platform', email: 'owner@kelolausaha.store', role: 'PLATFORM_OWNER' },
        }),
      };
    }
    if (url === '/api/platform/businesses') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          businesses: [{
            id: companyId,
            name: 'Dealer Contoh',
            business_type: 'dealer_motor',
            status: 'trial',
            plan_id: null,
            trial_ends_at: '2026-12-20T00:00:00Z',
            user_count: 2,
            active_branch_count: 1,
            branch_limit: 3,
            addon_branch_count: 0,
            paid_order_count: 0,
            lifetime_revenue: 0,
          }],
          summary: { total: 1, trials: 1, active: 0, paidRevenue: 0 },
          activity: {
            recentBusinesses: [{
              id: companyId,
              name: 'Dealer Contoh',
              business_type: 'dealer_motor',
              created_at: '2026-11-20T08:00:00Z',
              activated_at: '2026-11-20T08:00:00Z',
              active_until: null,
              trial_ends_at: '2026-12-20T00:00:00Z',
              plan_id: null,
              subscription_status: 'trial',
            }],
            recentPayments: [],
          },
        }),
      };
    }
    if (url === `/api/platform/businesses/${companyId}/manual-activation`) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          business: {
            id: companyId,
            planId: 'month_1',
            status: 'active',
            activatedAt: '2026-11-23T12:00:00Z',
            activeUntil: '2026-12-23T12:00:00Z',
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Rekap semua usaha' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Aktivitas workspace terbaru' })).toBeDefined();
  expect(screen.getByText('WAKTU AKTIVASI')).toBeDefined();
  expect(screen.getByText('AKTIF SAMPAI')).toBeDefined();
  expect(screen.getByText(/Pembayaran Midtrans tetap mengaktifkan paket otomatis sesuai pembayaran/)).toBeDefined();

  fireEvent.change(await screen.findByRole('combobox', { name: 'Paket aktivasi manual Dealer Contoh' }), {
    target: { value: 'month_1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Aktifkan' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    `/api/platform/businesses/${companyId}/manual-activation`,
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ planId: 'month_1' }),
    }),
  ));
  expect(await screen.findByRole('status')).toBeDefined();
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
  expect(screen.queryByRole('button', { name: 'Stok' })).toBeNull();
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

test('creates a POS receipt and sends its original image through WhatsApp Web', async () => {
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
  const nativeUrl = URL;
  class TestUrl extends nativeUrl {}
  TestUrl.createObjectURL = vi.fn(() => 'blob:receipt');
  TestUrl.revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', TestUrl);
  vi.stubGlobal('Image', class {
    set src(value) {
      this.onload();
    }
  });
  vi.stubGlobal('ClipboardItem', class {
    constructor(items) {
      this.items = items;
    }
  });
  const clipboardWrite = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { write: clipboardWrite } });
  const context = { drawImage: vi.fn() };
  const originalGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
  const originalToBlob = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => context),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((callback) => callback(new Blob(['receipt image'], { type: 'image/png' }))),
  });
  const openWhatsApp = vi.spyOn(window, 'open').mockReturnValue({});
  fireEvent.click(screen.getByRole('button', { name: /kirim nota asli via whatsapp/i }));
  expect(await screen.findByText(/Nota asli disalin sebagai gambar/)).toBeDefined();
  expect(openWhatsApp.mock.calls[0][0]).toContain(
    'https://web.whatsapp.com/send?phone=6281234567890',
  );
  expect((await clipboardWrite.mock.calls[0][0][0].items['image/png']).type).toBe('image/png');
  if (originalGetContext) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalGetContext);
  else delete HTMLCanvasElement.prototype.getContext;
  if (originalToBlob) Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', originalToBlob);
  else delete HTMLCanvasElement.prototype.toBlob;
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Cetak nota' }));
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  window.dispatchEvent(new Event('afterprint'));
  print.mockRestore();
});

test('renders original POS receipt details into its shareable image', () => {
  const { svg } = createPosReceiptSvg({
    receiptNumber: 'POS-20261123-0001',
    customer: 'Ani',
    createdAt: '2026-11-23T09:44:00.000Z',
    items: [{ name: 'Cuci komplit express', quantity: 2, unit: 'kg', price: 12000 }],
    total: 24000,
    paymentStatus: 'LUNAS',
    paymentMethod: 'Tunai',
  }, 'LONDRI BERKAH ABADI');

  expect(svg).toContain('LONDRI BERKAH ABADI');
  expect(svg).toContain('POS-20261123-0001');
  expect(svg).toContain('Cuci komplit express');
  expect(svg).toContain('24.000');
  expect(svg).toContain('LUNAS (Tunai)');
});

test('applies the workspace receipt settings to its shareable image', () => {
  const { svg } = createPosReceiptSvg({
    receiptNumber: 'POS-20261123-0002',
    customer: 'Budi',
    createdAt: '2026-11-23T09:44:00.000Z',
    items: [{ name: 'Cuci kiloan', quantity: 3, unit: 'kg', price: 8000 }],
    total: 24000,
    paymentStatus: 'LUNAS',
    paymentMethod: 'Tunai',
  }, 'LONDRI BERKAH ABADI', {
    mode: 'thermal',
    accent: 'royal',
    storeAddress: 'Jl. Melati No. 18',
    storePhone: '081234567890',
    footerNote: 'Simpan nota ini.',
    logoUrl: '/uploads/company/logo.png',
  });

  expect(svg).toContain('STRUK PEMBAYARAN');
  expect(svg).toContain('fill="#2563eb"');
  expect(svg).toContain('Jl. Melati No. 18');
  expect(svg).toContain('081234567890');
  expect(svg).toContain('<image href="');
  expect(svg).toContain('/uploads/company/logo.png');
  expect(svg).toContain('Simpan nota ini.');
});

test('lets business Owners configure their own receipts without legacy theme permission', () => {
  const ownerMenus = getUserMenus({ role: 'OWNER', permissions: ['dashboard'] });
  const superAdminMenus = getUserMenus({ role: 'SUPER ADMIN', permissions: ['dashboard'] });

  expect(ownerMenus.some(([label]) => label === 'Pengaturan Nota')).toBe(true);
  expect(superAdminMenus.some(([label]) => label === 'Pengaturan Nota')).toBe(true);
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

test('prints and shares SPK and issued waybill documents', () => {
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Semua SPK' }));

  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Cetak SPK SPK-WAM-20261120-0001' }));
  expect(print).toHaveBeenCalledOnce();
  expect(document.querySelector('.spk-print-document[data-printing="true"]').textContent).toContain('Siti Rahmawati');
  expect(screen.getByRole('link', { name: 'Bagikan SPK SPK-WAM-20261120-0001 via WhatsApp' }).href)
    .toContain('https://wa.me/6281234567890');

  fireEvent.click(screen.getByRole('button', { name: 'Cetak surat jalan SJ-WAM-20261120-0001' }));
  expect(print).toHaveBeenCalledTimes(2);
  expect(document.querySelector('.waybill-print-document[data-printing="true"]').textContent)
    .toContain('SJ-WAM-20261120-0001');
  expect(screen.getByRole('link', { name: 'Bagikan surat jalan SJ-WAM-20261120-0001 via WhatsApp' }).href)
    .toContain('https://wa.me/6281234567890');
  window.dispatchEvent(new Event('afterprint'));
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
  expect(screen.getByRole('button', { name: /Kirim nota asli via WhatsApp/i })).toBeDefined();
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

test('opens the floating support form and sends the signed-in user email to support', async () => {
  const ticket = {
    id: 'ticket-1',
    ticket_number: 'KU-1234ABCD',
    requester_name: 'Rika Wijaya',
    requester_email: 'rika@wam.co.id',
    subject: 'Pertanyaan lainnya',
    status: 'new',
  };
  let ticketCreated = false;
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === '/api/support/contact') {
      return { ok: true, json: async () => ({ email: 'kelolausaha.store@gmail.com' }) };
    }
    if (url === '/api/support/tickets' && options.method === 'POST') {
      ticketCreated = true;
      return { ok: true, json: async () => ({ ticket: { id: ticket.id } }) };
    }
    if (url.startsWith('/api/support/tickets?email=')) {
      return { ok: true, json: async () => ({ tickets: ticketCreated ? [ticket] : [] }) };
    }
    if (url.startsWith(`/api/support/tickets/${ticket.id}?email=`)) {
      return {
        ok: true,
        json: async () => ({
          ticket,
          messages: [{
            id: 'message-1',
            sender_type: 'user',
            sender_name: ticket.requester_name,
            body: 'Email bantuan belum masuk.',
            created_at: '2026-11-23T00:00:00.000Z',
          }],
        }),
      };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Buka bantuan' }));
  const directEmailLink = await screen.findByRole('link', { name: 'Email langsung ↗' });
  expect(directEmailLink.getAttribute('href')).toBe('mailto:kelolausaha.store@gmail.com?subject=Bantuan%20KelolaUsaha.store');
  fireEvent.click(screen.getByRole('button', { name: 'Pusat bantuan' }));

  expect(await screen.findByRole('heading', { name: 'Pusat Bantuan KelolaUsaha' })).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Nama' }).value).toBe('Rika Wijaya');
  expect(screen.getByRole('textbox', { name: 'Email' }).value).toBe('rika@wam.co.id');
  fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), {
    target: { value: 'Email bantuan belum masuk.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Kirim pesan/ }));

  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => (
    url === '/api/support/tickets'
      && options.method === 'POST'
      && JSON.parse(options.body).email === 'rika@wam.co.id'
  ))).toBe(true));
  expect(await screen.findByRole('status')).toBeDefined();
});

test('shows the latest support reply automatically in the help center', async () => {
  const ticket = {
    id: 'ticket-replied',
    ticket_number: 'KU-ABCD1234',
    requester_name: 'Rika Wijaya',
    requester_email: 'rika@wam.co.id',
    subject: 'Pertanyaan lainnya',
    status: 'waiting_user',
  };
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/support/contact') {
      return { ok: true, json: async () => ({ email: 'kelolausaha.store@gmail.com' }) };
    }
    if (url.startsWith('/api/support/tickets?email=')) {
      return { ok: true, json: async () => ({ tickets: [ticket] }) };
    }
    if (url.startsWith(`/api/support/tickets/${ticket.id}?email=`)) {
      return {
        ok: true,
        json: async () => ({
          ticket,
          messages: [{
            id: 'reply-1',
            sender_type: 'owner',
            sender_name: 'Tim Support KelolaUsaha.store',
            body: 'Balasan email dari tim support.',
            created_at: '2026-11-23T00:00:00.000Z',
          }],
        }),
      };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  openOwnerPreview();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pilih akun demo' }), {
    target: { value: 'user-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buka bantuan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Pusat bantuan' }));

  expect(await screen.findByText('Balasan email dari tim support.')).toBeDefined();
  expect(screen.getByRole('button', { name: /KU-ABCD1234.*Pertanyaan lainnya/ })).toBeDefined();
});

test('notifies signed-in users about support replies in the floating operator widget', async () => {
  const ticket = {
    id: 'ticket-replied',
    ticket_number: 'KU-ABCD1234',
    requester_name: 'Rika Wijaya',
    requester_email: 'rika@wam.co.id',
    subject: 'Pertanyaan lainnya',
    status: 'waiting_user',
    unread_owner_count: 1,
    latest_owner_message: 'Balasan sudah kami kirim.',
  };
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/session') {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 'owner-1',
            name: 'Rika Wijaya',
            email: ticket.requester_email,
            role: 'OWNER',
            permissions: ['dashboard'],
          },
          business: { id: 'company-1', name: 'Usaha Contoh' },
        }),
      };
    }
    if (url.startsWith('/api/support/tickets?email=')) {
      return { ok: true, json: async () => ({ tickets: [ticket] }) };
    }
    if (url === `/api/support/tickets/${ticket.id}/read` && options.method === 'POST') {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (url.startsWith(`/api/support/tickets/${ticket.id}?email=`)) {
      return {
        ok: true,
        json: async () => ({
          ticket,
          messages: [{
            id: 'reply-1',
            sender_type: 'owner',
            sender_name: 'Tim Support KelolaUsaha.store',
            body: ticket.latest_owner_message,
            created_at: '2026-11-23T00:00:00.000Z',
          }],
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  const operatorButton = await screen.findByRole('button', { name: 'Buka bantuan, 1 balasan baru' });
  fireEvent.click(operatorButton);
  fireEvent.click(await screen.findByRole('button', { name: /KU-ABCD1234.*Pertanyaan lainnya/ }));

  expect(await screen.findByText(ticket.latest_owner_message)).toBeDefined();
  await act(async () => mockSocketHandlers.get('connect')?.());
  expect(screen.getByText('● Chat real-time aktif')).toBeDefined();
  expect(mockSocket.emit).toHaveBeenCalledWith(
    'support:join',
    { email: ticket.requester_email },
    expect.any(Function),
  );
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => (
    url === `/api/support/tickets/${ticket.id}/read` && options.method === 'POST'
  ))).toBe(true));
});
