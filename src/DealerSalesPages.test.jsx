import { afterEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  DealerCustomersPage,
  DealerSalesReportPage,
  DealerSalesTeamPage,
  DealerTargetsPage,
} from './DealerSalesPages.jsx';

afterEach(() => {
  window.localStorage.clear();
});

test('saves demo targets locally and shows their progress', async () => {
  render(<DealerTargetsPage canManage isAuthenticated={false} spks={[]} />);
  fireEvent.change(screen.getByLabelText('Target unit / SPK'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Target omzet (Rp)'), { target: { value: '240000000' } });
  fireEvent.click(screen.getByRole('button', { name: /Simpan target/ }));

  await waitFor(() => {
    const savedTargets = JSON.parse(window.localStorage.getItem('kelolausaha.demo.sales-targets'));
    expect(savedTargets[0].unitTarget).toBe(12);
    expect(savedTargets[0].revenueTarget).toBe(240000000);
  });
  expect((await screen.findByRole('status')).textContent).toContain('Target demo disimpan di browser ini saja.');
  expect(screen.getByText('12 unit')).toBeDefined();
});

test('summarizes approved SPKs separately from pending ones in the sales report', () => {
  render(<DealerSalesReportPage
    canViewAllBranches={false}
    isAuthenticated={false}
    spks={[
      { id: 'approved', customer: 'Pelanggan A', sales: 'Sales A', amount: 20000000, status: 'DISETUJUI', date: '20 Nov 2026' },
      { id: 'pending', customer: 'Pelanggan B', sales: 'Sales B', amount: 25000000, status: 'APPROVAL SVP', date: '20 Nov 2026' },
    ]}
  />);

  expect(screen.getByText('2', { selector: '.dealer-report-stats article:nth-child(1) strong' })).toBeDefined();
  expect(screen.getByText('1', { selector: '.dealer-report-stats article:nth-child(2) strong' })).toBeDefined();
  expect(document.querySelector('.dealer-report-stats article:nth-child(3) strong').textContent)
    .toContain('20.000.000');
  expect(screen.getByRole('heading', { name: 'Tren harian' })).toBeDefined();
});

test('shows sales performance aggregated from SPK statuses', () => {
  render(<DealerSalesTeamPage spks={[
    { id: 'one', sales: 'Sales A', branchName: 'Cabang Utama', amount: 20000000, status: 'DISETUJUI' },
    { id: 'two', sales: 'Sales A', branchName: 'Cabang Utama', amount: 25000000, status: 'APPROVAL SVP' },
    { id: 'three', sales: 'Sales B', amount: 30000000, status: 'DITOLAK' },
  ]} />);

  expect(screen.getByRole('heading', { name: 'Tim Sales' })).toBeDefined();
  expect(screen.getByText('Sales A')).toBeDefined();
  expect(screen.getByText('Sales B')).toBeDefined();
  expect(screen.getByText(/20\.000\.000/, { selector: 'td' })).toBeDefined();
});

test('creates an authenticated customer through the workspace API', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      customer: {
        id: 'customer-1',
        name: 'Budi Santoso',
        phone: '081234567890',
        email: 'budi@example.test',
        address: 'Bojonegoro',
      },
    }),
  });
  const onCustomerCreated = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<DealerCustomersPage customers={[]} isAuthenticated onCustomerCreated={onCustomerCreated} spks={[]} />);

  fireEvent.change(screen.getByLabelText('Nama pelanggan'), { target: { value: 'Budi Santoso' } });
  fireEvent.change(screen.getByLabelText('Nomor telepon'), { target: { value: '081234567890' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'budi@example.test' } });
  fireEvent.change(screen.getByLabelText('Alamat'), { target: { value: 'Bojonegoro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Simpan pelanggan' }));

  await screen.findByRole('status');
  expect(fetchMock).toHaveBeenCalledWith('/api/operations/customers', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      name: 'Budi Santoso',
      phone: '081234567890',
      email: 'budi@example.test',
      address: 'Bojonegoro',
    }),
  }));
  expect(onCustomerCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-1' }));
  expect(screen.getByText('Budi Santoso')).toBeDefined();
});
