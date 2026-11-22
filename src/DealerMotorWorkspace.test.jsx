import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DealerMotorWorkspace } from './DealerMotorWorkspace.jsx';

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
