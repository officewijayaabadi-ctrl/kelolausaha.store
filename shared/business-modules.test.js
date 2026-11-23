import { describe, expect, test } from 'vitest';
import { filterPermissionsForBusiness, isPermissionAvailableForBusiness } from './business-modules.js';

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
});
