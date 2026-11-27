import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { DealerMotorWorkspace, DriverDeliveryWorkspace } from './DealerMotorWorkspace.jsx';

test('shows reserved units and incoming/outgoing movement records', () => {
  render(
    <DealerMotorWorkspace
      branches={[]}
      canManage={false}
      movements={[
        {
          id: 'movement-in',
          eventType: 'incoming',
          createdAt: '2026-11-23T01:00:00.000Z',
          brand: 'Honda',
          model: 'Beat',
          specification: 'CBS',
          frameNumber: 'FRAME-IN',
          branchName: 'Cabang Utama',
          createdByName: 'Owner',
          note: 'Motor masuk',
        },
        {
          id: 'movement-out',
          eventType: 'delivered',
          createdAt: '2026-11-23T02:00:00.000Z',
          brand: 'Honda',
          model: 'Beat',
          specification: 'CBS',
          frameNumber: 'FRAME-OUT',
          branchName: 'Cabang Utama',
          createdByName: 'Driver',
          spkNumber: 'SPK-WAM-20261123-0001',
          note: 'Terkirim dan terjual',
        },
      ]}
      notice=""
      onCreate={async () => {}}
      units={[
        {
          id: 'reserved-unit',
          stockStatus: 'reserved',
          stockOrigin: 'incoming',
          stockEntryDate: '2026-11-22',
          statusUpdatedAt: '2026-11-23T01:00:00.000Z',
          branchName: 'Cabang Utama',
          brand: 'Honda',
          model: 'Beat',
          specification: 'CBS',
          modelYear: 2026,
          color: 'Hitam',
          frameNumber: 'FRAME-IN',
          engineNumber: 'ENGINE-IN',
          otrPrice: 19000000,
        },
      ]}
    />,
  );

  expect(screen.getByText('Motor keluar')).toBeDefined();
  expect(screen.getAllByText('SPK diproses')).toHaveLength(2);
  expect(screen.getByText('Masuk · Motor masuk')).toBeDefined();
  expect(screen.getByText('Keluar · Terkirim/terjual')).toBeDefined();
  expect(screen.getByText('SPK-WAM-20261123-0001')).toBeDefined();
});

test('opens the stock intake form from the inventory menu', () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ products: [] }),
  })));
  render(
    <DealerMotorWorkspace
      branches={[]}
      canManage
      movements={[]}
      notice=""
      onCreate={vi.fn()}
      units={[]}
    />,
  );

  expect(screen.queryByRole('heading', { name: 'Tambah unit motor' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Input stok tambahan/ }));
  expect(screen.getByRole('heading', { name: 'Tambah unit motor' })).toBeDefined();
  expect(document.querySelector('#dealer-stock-entry-form')).not.toBeNull();
  expect(Array.from(document.querySelector('select[name="stockOrigin"]').options).map((option) => option.value))
    .toEqual(['opening', 'incoming']);
  vi.unstubAllGlobals();
});

test('allows a manually entered model and groups Rupiah digits in the stock form', () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ products: [] }),
  })));
  render(
    <DealerMotorWorkspace
      branches={[{ id: 'branch-1', name: 'Cabang Utama' }]}
      canManage
      intakes={[]}
      movements={[]}
      notice=""
      onCreate={vi.fn()}
      onCompleteInspection={vi.fn()}
      units={[]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Input stok tambahan/ }));
  fireEvent.change(document.querySelector('input[name="model"]'), { target: { value: 'Model manual' } });
  fireEvent.change(document.querySelector('input[name="otrPrice"]'), { target: { value: '19000000' } });
  fireEvent.change(document.querySelector('input[name="quantity"]'), { target: { value: '3' } });

  expect(document.querySelector('input[name="model"]').value).toBe('Model manual');
  expect(document.querySelector('input[name="otrPrice"]').value).toBe('19.000.000');
  expect(document.querySelector('input[name="quantity"]').value).toBe('3');
  vi.unstubAllGlobals();
});

test('fills vehicle details when a Honda model is selected from the catalog', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (url.endsWith('/catalog')
      ? {
        products: [{
          id: 'beat',
          slug: 'beat',
          name: 'Honda Beat',
          category: 'Matic',
          modelYear: 2026,
          price: 19000000,
          colors: ['Hitam'],
        }],
      }
      : { product: { specification: '109 cc' } }),
  })));
  render(
    <DealerMotorWorkspace
      branches={[{ id: 'branch-1', name: 'Cabang Utama' }]}
      canManage
      intakes={[]}
      movements={[]}
      notice=""
      onCreate={vi.fn()}
      onCompleteInspection={vi.fn()}
      units={[]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Input stok tambahan/ }));
  await waitFor(() => expect(document.querySelector('datalist option[value="Honda Beat"]')).not.toBeNull());
  fireEvent.change(document.querySelector('input[name="model"]'), { target: { value: 'Honda Beat' } });

  await waitFor(() => expect(document.querySelector('input[name="specification"]').value).toBe('109 cc'));
  expect(document.querySelector('input[name="brand"]').value).toBe('Honda');
  expect(document.querySelector('input[name="modelYear"]').value).toBe('2026');
  expect(document.querySelector('select[name="color"]').value).toBe('Hitam');
  expect(document.querySelector('input[name="otrPrice"]').value).toBe('19.000.000');
  vi.unstubAllGlobals();
});

test('hides stock intake action from users without inventory access', () => {
  render(
    <DealerMotorWorkspace
      branches={[]}
      canManage={false}
      movements={[]}
      notice=""
      onCreate={vi.fn()}
      units={[]}
    />,
  );

  expect(screen.queryByRole('button', { name: /Input stok tambahan/ })).toBeNull();
  expect(document.querySelector('#dealer-stock-entry-form')).toBeNull();
});

test('lets drivers print and share a waybill before claiming its delivery', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      deliveries: [{
        id: 'spk-1',
        spkNumber: 'SPK-WAM-20261123-0001',
        waybillNumber: 'SJ-WAM-20261123-0001',
        waybillIssuedAt: '2026-11-23T01:00:00.000Z',
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        customerAddress: 'Jl. Merdeka',
        brand: 'Honda',
        model: 'Beat',
        specification: 'CBS',
        deliveryStatus: 'ready',
      }],
    }),
  })));
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<DriverDeliveryWorkspace isAuthenticated notice="" workspaceName="Dealer WAM" />);

  expect(await screen.findByRole('heading', {
    name: 'SPK-WAM-20261123-0001 · Budi Santoso',
  })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Cetak surat jalan' }));
  expect(print).toHaveBeenCalledOnce();
  expect(document.querySelector('.waybill-print-document[data-printing="true"]').textContent)
    .toContain('Budi Santoso');
  expect(screen.getByRole('link', { name: 'Bagikan surat jalan via WhatsApp' }).href)
    .toContain('https://wa.me/6281234567890');

  print.mockRestore();
  vi.unstubAllGlobals();
});
