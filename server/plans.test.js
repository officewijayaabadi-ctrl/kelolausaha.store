import { describe, expect, test } from 'vitest';
import { addCalendarMonths, getBranchAddon, getPlan, plans, branchAddons, subscriptionStatus, trialEndsAt } from './plans.js';

describe('subscription plans', () => {
  test('uses the configured package prices', () => {
    expect(plans.map(({ id, amount }) => [id, amount])).toEqual([
      ['month_1', 299000],
      ['month_3', 749000],
      ['month_6', 1399000],
      ['year_1', 2499000],
      ['lifetime', 15000000],
    ]);
    expect(getPlan('unknown')).toBeUndefined();
  });

  test('calculates the configured per-branch add-on prices', () => {
    expect(branchAddons.map(({ months, pricePerBranch }) => [months, pricePerBranch])).toEqual([
      [1, 100000],
      [3, 150000],
      [6, 250000],
      [12, 500000],
      [0, 2000000],
    ]);
    expect(getBranchAddon(3)?.pricePerBranch).toBe(150000);
    expect(getBranchAddon(2)).toBeNull();
  });

  test('adds calendar months without overflowing short months', () => {
    expect(addCalendarMonths(new Date('2026-01-31T12:00:00Z'), 1).toISOString())
      .toBe('2026-02-28T12:00:00.000Z');
    expect(trialEndsAt(new Date('2026-11-20T00:00:00Z')).toISOString())
      .toBe('2026-12-20T00:00:00.000Z');
  });

  test('resolves trial, active, expired, and lifetime states', () => {
    const now = new Date('2026-11-20T00:00:00Z');
    expect(subscriptionStatus({ trialEndsAt: '2026-12-20T00:00:00Z' }, now)).toBe('trial');
    expect(subscriptionStatus({ activeUntil: '2026-12-20T00:00:00Z' }, now)).toBe('active');
    expect(subscriptionStatus({ trialEndsAt: '2026-11-19T00:00:00Z' }, now)).toBe('expired');
    expect(subscriptionStatus({ planId: 'lifetime' }, now)).toBe('lifetime');
  });
});
