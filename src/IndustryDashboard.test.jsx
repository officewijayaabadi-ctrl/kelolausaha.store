import { afterEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import IndustryDashboard from './IndustryDashboard';

afterEach(() => {
  vi.unstubAllGlobals();
});
test('renders weekly sales when PostgreSQL sends a serialized date value', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      summary: {},
      statuses: [],
      weeklySales: [
        { date: '2026-11-22T00:00:00.000Z', total: '1200' },
        { date: 'not-a-date', total: '0' },
      ],
      recentOrders: [],
    }),
  }));

  render(
    <IndustryDashboard
      businessType="dealer_motor"
      workspaceName="Toko Rani"
      role="OWNER"
    />,
  );

  expect(await screen.findByText('Penjualan 7 hari terakhir')).toBeDefined();
  expect(screen.getByTitle(/22 Nov 2026: Rp\s1\.200/)).toBeDefined();
  expect(screen.getByTitle(/Tanggal tidak tersedia: Rp\s0/)).toBeDefined();
});

test('shows dealer stock totals and keeps inventory actions out of the dashboard', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      summary: {},
      statuses: [],
      weeklySales: [],
      recentOrders: [],
      dealerMetrics: { totalUnits: 12, availableUnits: 8, incomingThisMonth: 3 },
    }),
  }));

  render(
    <IndustryDashboard
      businessType="dealer_motor"
      workspaceName="Toko Rani"
      role="OWNER"
    />,
  );

  expect(await screen.findByText('Total stok kendaraan')).toBeDefined();
  expect(screen.getByText('12')).toBeDefined();
  expect(screen.getByText('Stok masuk bulan ini')).toBeDefined();
  expect(screen.getByText('3')).toBeDefined();
  expect(screen.queryByRole('button', { name: /Input stok tambahan/ })).toBeNull();
});
