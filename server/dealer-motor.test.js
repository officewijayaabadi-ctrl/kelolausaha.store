import { describe, expect, test, vi } from 'vitest';
import { allocateSpkNumber } from './dealer-motor.js';

describe('SPK number allocation', () => {
  test('locks allocation for the same company and date and uses the next database number', async () => {
    const calls = [];
    const client = {
      query: vi.fn(async (...args) => {
        calls.push(args);
        return calls.length === 1 ? { rows: [] } : { rows: [{ nextNumber: '5' }] };
      }),
    };

    await expect(allocateSpkNumber(client, 'company-1', '2026-11-20'))
      .resolves.toBe('SPK-WAM-20261120-0005');

    expect(calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(calls[0][1]).toEqual(['company-1', '20261120']);
    expect(calls[1][0]).toContain('MAX(substring(spk_number FROM $2)::bigint)');
    expect(calls[1][1]).toEqual(['company-1', '^SPK-WAM-20261120-([0-9]+)$']);
  });

  test('does not truncate numbers after four digits', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ nextNumber: '10000' }] }),
    };

    await expect(allocateSpkNumber(client, 'company-1', '2026-11-20'))
      .resolves.toBe('SPK-WAM-20261120-10000');
  });
});
