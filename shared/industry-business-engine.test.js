import { describe, expect, test } from 'vitest';
import {
  industryBusinessRegistry,
  canRolePerform,
  createIndustryAuditEvent,
  getIndustryDefinition,
  getIndustryRoles,
  getRolePermissions,
  flattenRolePermissions,
  normalizeIndustryKey,
} from './industry-business-engine.js';

describe('industry business engine', () => {
  test('provides a separate registry for all twelve industries', () => {
    expect(Object.keys(industryBusinessRegistry)).toHaveLength(12);
  });

  test('uses retail-specific role permissions', () => {
    expect(getIndustryRoles('retail')).toContain('WarehouseStaff');
    expect(flattenRolePermissions('retail', 'Cashier')).toContain('pos.create');
    expect(canRolePerform('retail', 'Cashier', 'pos', 'create')).toBe(true);
    expect(canRolePerform('retail', 'Cashier', 'inventory', 'update')).toBe(false);
  });

  test('uses workshop-specific role permissions', () => {
    expect(getIndustryRoles('bengkel')).toContain('ServiceAdvisor');
    expect(canRolePerform('bengkel', 'Mechanic', 'work_orders', 'update')).toBe(true);
    expect(canRolePerform('bengkel', 'Mechanic', 'work_orders', 'approve')).toBe(false);
  });

  test('normalizes aliases and returns no role outside the industry', () => {
    expect(normalizeIndustryKey('bengkel')).toBe('workshop');
    expect(getIndustryRoles('apotek')).toContain('Pharmacist');
    expect(getRolePermissions('travel', 'Guide')).not.toBeNull();
    expect(getRolePermissions('retail', 'Mechanic')).toBeNull();
  });

  test('creates a branch-aware audit event', () => {
    const event = createIndustryAuditEvent({
      companyId: 'company-1',
      branchId: 'branch-1',
      userId: 'user-1',
      role: 'Manager',
      industry: 'retail',
      module: 'inventory',
      action: 'update',
      resourceType: 'product',
      resourceId: 'product-1',
      before: { stock: 10 },
      after: { stock: 8 },
    });
    expect(event).toMatchObject({
      companyId: 'company-1',
      branchId: 'branch-1',
      industry: 'retail',
      module: 'inventory',
      action: 'update',
      resourceType: 'product',
    });
    expect(event.occurredAt).toBeDefined();
  });

  test('keeps tenant branch access enforceable by the caller', () => {
    expect(canRolePerform('retail', 'Manager', 'inventory', 'update', { allowed: true })).toBe(true);
    expect(canRolePerform('retail', 'Manager', 'inventory', 'update', { allowed: false })).toBe(false);
  });

  test('returns industry definition only for registered industries', () => {
    expect(getIndustryDefinition('property')?.label).toBe('Properti');
    expect(getIndustryDefinition('unknown')).toBeNull();
  });
});
