import express from 'express';
import { afterEach, expect, test, vi } from 'vitest';
import { createDealerMotorRouter } from './dealer-motor.js';

const companyId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const otherBranchId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
let server;

async function startApi({ permissions, pool }) {
  const app = express();
  app.use(express.json());
  const passthrough = (_req, _res, next) => next();
  const authenticate = (req, _res, next) => {
    req.user = {
      id: userId,
      company_id: companyId,
      branch_id: branchId,
      permissions,
    };
    next();
  };
  const requirePermission = (...required) => (req, res, next) => {
    if (!required.some((permission) => req.user.permissions.includes(permission))) {
      return res.status(403).json({ message: 'Akses tidak diizinkan.' });
    }
    next();
  };
  app.use('/api/dealer-motor', createDealerMotorRouter({
    pool,
    authenticate,
    requireTenant: passthrough,
    requireActiveTenant: passthrough,
    requirePermission,
    upload: { single: () => passthrough },
    privateDeliveryDirectory: '',
    fileTypeFromBuffer: vi.fn(),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
});

test('limits reports to the signed-in user branch', async () => {
  const query = vi.fn();
  const baseUrl = await startApi({ permissions: ['reportsView'], pool: { query } });
  const response = await fetch(
    `${baseUrl}/api/dealer-motor/sales-report?from=2026-11-01&to=2026-11-30&branchId=${otherBranchId}`,
  );

  expect(response.status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});

test('saves a branch target with normalized sales identity', async () => {
  const insertQuery = vi.fn(async () => ({ rowCount: 1, rows: [{ id: 'target-id' }] }));
  const pool = {
    query: vi.fn(async (sql, params) => {
      if (sql.includes('SELECT id FROM business_branches')) return { rowCount: 1, rows: [{ id: branchId }] };
      return insertQuery(sql, params);
    }),
  };
  const baseUrl = await startApi({ permissions: ['targetManage'], pool });
  const response = await fetch(`${baseUrl}/api/dealer-motor/sales-targets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      month: '2026-11',
      scopeType: 'branch_salesperson',
      branchId,
      salesName: '  Sari Putri  ',
      unitTarget: 8,
      revenueTarget: 180000000,
    }),
  });
  const result = await response.json();

  expect(response.status).toBe(200);
  expect(result.salesName).toBe('Sari Putri');
  expect(insertQuery.mock.calls[0][1][3]).toBe(`branch:${branchId}:sales:sari putri`);
});

test('returns report totals scoped to the signed-in branch', async () => {
  const pool = {
    query: vi.fn(async (sql) => {
      if (sql.includes('SELECT COUNT(*)::int AS "spkCount"')) {
        return { rows: [{ spkCount: 3, salesCount: 2, revenue: '40000000', deliveredCount: 1, rejectedCount: 0, pendingCount: 1 }] };
      }
      if (sql.includes('SELECT to_char(s.created_at')) return { rows: [] };
      if (sql.includes('SELECT s.branch_id AS')) return { rows: [] };
      if (sql.includes('SELECT s.sales_name AS')) return { rows: [] };
      if (sql.includes('SELECT s.id, s.spk_number')) return { rows: [] };
      throw new Error('Unexpected sales-report query.');
    }),
  };
  const baseUrl = await startApi({ permissions: ['reportsView'], pool });
  const response = await fetch(`${baseUrl}/api/dealer-motor/sales-report?from=2026-11-01&to=2026-11-30`);
  const result = await response.json();

  expect(response.status).toBe(200);
  expect(result.summary.salesCount).toBe(2);
  expect(result.branchId).toBe(branchId);
  expect(pool.query).toHaveBeenCalledTimes(5);
  expect(pool.query.mock.calls.every(([, params]) => params[3] === branchId)).toBe(true);
});

test('requires PDI access before querying unit data', async () => {
  const query = vi.fn();
  const baseUrl = await startApi({ permissions: ['spkViewOwn'], pool: { query } });
  const response = await fetch(`${baseUrl}/api/dealer-motor/units`);

  expect(response.status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});

test('starts a branch-scoped PDI and records the unit event', async () => {
  const client = {
    query: vi.fn(async (sql) => {
      if (sql.includes('SELECT id, branch_id AS "branchId"')) {
        return {
          rowCount: 1,
          rows: [{ id: '55555555-5555-4555-8555-555555555555', branchId, stockStatus: 'reserved', pdiStatus: 'pending' }],
        };
      }
      if (sql.includes('UPDATE dealer_motor_units')) {
        return {
          rowCount: 1,
          rows: [{ id: '55555555-5555-4555-8555-555555555555', branchId, stockStatus: 'reserved', pdiStatus: 'in_progress' }],
        };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  const baseUrl = await startApi({
    permissions: ['pdiManage'],
    pool: { connect: vi.fn(async () => client) },
  });
  const response = await fetch(
    `${baseUrl}/api/dealer-motor/units/55555555-5555-4555-8555-555555555555/pdi`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    },
  );
  const result = await response.json();

  expect(response.status).toBe(200);
  expect(result.unit.pdiStatus).toBe('in_progress');
  expect(client.query.mock.calls.some(([sql, params]) => (
    sql.includes('INSERT INTO dealer_motor_unit_events') && params[3] === 'pdi_started'
  ))).toBe(true);
});

test('does not issue a waybill before PDI is complete', async () => {
  const client = {
    query: vi.fn(async (sql) => {
      if (sql.includes('SELECT s.id, s.spk_number AS "spkNumber"')) {
        return {
          rowCount: 1,
          rows: [{
            id: '66666666-6666-4666-8666-666666666666',
            spkNumber: 'SPK-WAM-20261123-0001',
            status: 'DISETUJUI',
            waybillNumber: null,
            pdiStatus: 'in_progress',
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    }),
    release: vi.fn(),
  };
  const baseUrl = await startApi({
    permissions: ['waybillManage'],
    pool: { connect: vi.fn(async () => client) },
  });
  const response = await fetch(
    `${baseUrl}/api/dealer-motor/spks/66666666-6666-4666-8666-666666666666/waybill`,
    { method: 'POST' },
  );
  const result = await response.json();

  expect(response.status).toBe(409);
  expect(result.message).toMatch(/selesaikan inspeksi PDI/i);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('UPDATE dealer_motor_spks'))).toBe(false);
});

test('creates a waybill for an approved SPK after PDI is complete', async () => {
  const client = {
    query: vi.fn(async (sql) => {
      if (sql.includes('SELECT s.id, s.spk_number AS "spkNumber"')) {
        return {
          rowCount: 1,
          rows: [{
            id: '77777777-7777-4777-8777-777777777777',
            spkNumber: 'SPK-WAM-20261123-0002',
            status: 'DISETUJUI',
            waybillNumber: null,
            pdiStatus: 'completed',
          }],
        };
      }
      if (sql.includes('UPDATE dealer_motor_spks')) {
        return {
          rowCount: 1,
          rows: [{
            id: '77777777-7777-4777-8777-777777777777',
            spkNumber: 'SPK-WAM-20261123-0002',
            status: 'DISETUJUI',
            deliveryStatus: 'ready',
            waybillNumber: 'SJ-WAM-20261123-0002',
            waybillIssuedAt: '2026-11-23T12:00:00.000Z',
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  const baseUrl = await startApi({
    permissions: ['waybillManage'],
    pool: { connect: vi.fn(async () => client) },
  });
  const response = await fetch(
    `${baseUrl}/api/dealer-motor/spks/77777777-7777-4777-8777-777777777777/waybill`,
    { method: 'POST' },
  );
  const result = await response.json();

  expect(response.status).toBe(200);
  expect(result.spk.waybillNumber).toBe('SJ-WAM-20261123-0002');
  expect(result.spk.deliveryStatus).toBe('ready');
});
