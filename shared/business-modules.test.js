import { describe, expect, test } from 'vitest';
import { businessTypes, filterPermissionsForBusiness, isPermissionAvailableForBusiness } from './business-modules.js';

describe('business access permissions', () => {
  test('limits access options to modules enabled for the selected business', () => {
    expect(filterPermissionsForBusiness([
      'dashboard',
      'customerManage',
      'unitManage',
      'attendanceView',
      'receiptsView',
    ], 'laundry', ['dashboard', 'customers', 'employees'])).toEqual([
      'dashboard',
      'customerManage',
      'attendanceView',
    ]);
  });

  test('does not re-enable permissions when a workspace has no enabled optional modules', () => {
    expect(isPermissionAvailableForBusiness('receiptsView', 'laundry', [])).toBe(false);
    expect(isPermissionAvailableForBusiness('dashboard', 'laundry', [])).toBe(false);
  });

  test.each(Object.keys(businessTypes))('keeps cashier permissions aligned for %s', (businessType) => {
    const enabledModules = businessTypes[businessType].modules.map(([id]) => id);
    const filtered = filterPermissionsForBusiness([
      'dashboard',
      'posAccess',
      'priceManage',
      'transactionsView',
      'receiptsView',
      'attendanceView',
    ], businessType, enabledModules);
    expect(filtered).toContain('dashboard');
    expect(filtered).toContain('attendanceView');
    if (enabledModules.includes('pos')) {
      expect(filtered).toEqual([
        'dashboard',
        'posAccess',
        'priceManage',
        'transactionsView',
        'receiptsView',
        'attendanceView',
      ]);
    } else {
      expect(filtered).not.toContain('posAccess');
      expect(filtered).not.toContain('priceManage');
      expect(filtered).not.toContain('transactionsView');
      expect(filtered).not.toContain('receiptsView');
    }
  });

  test('exposes PDI and delivery permissions for dealer workspaces', () => {
    for (const businessType of ['dealer_motor', 'dealer_vehicle']) {
      const modules = businessTypes[businessType].modules.map(([id]) => id);
      expect(modules).toContain('pdi');
      expect(modules).toContain('delivery');
      expect(filterPermissionsForBusiness(['pdiManage', 'waybillManage'], businessType, modules))
        .toEqual(['pdiManage', 'waybillManage']);
    }
  });
});
