import { describe, expect, test } from 'vitest';
import { defaultDashboardThemeSettings } from '../src/themes.js';
import {
  applyDashboardTheme,
  restorePreviousDashboardTheme,
  validateDashboardThemeAssets,
  validateDashboardThemeSettings,
} from './workspace-theme.js';

describe('workspace dashboard theme persistence', () => {
  test('validates complete dashboard settings and rejects invalid colors or modes', () => {
    expect(validateDashboardThemeSettings(defaultDashboardThemeSettings)).toBe(true);
    expect(validateDashboardThemeSettings({
      ...defaultDashboardThemeSettings,
      customPrimary: '#12zz56',
    })).toBe(false);
    expect(validateDashboardThemeSettings({
      ...defaultDashboardThemeSettings,
      mode: 'auto',
    })).toBe(false);
  });

  test('applies a draft and restores the previous active theme without losing workspace settings', () => {
    const active = {
      ...defaultDashboardThemeSettings,
      themeId: 'emerald-fresh',
      receiptSettings: { mode: 'digital' },
      dashboardThemeHistory: [],
    };
    const draft = { ...defaultDashboardThemeSettings, themeId: 'ocean-blue' };
    const applied = applyDashboardTheme(active, draft, '2026-11-27T00:00:00.000Z');

    expect(applied.themeId).toBe('ocean-blue');
    expect(applied.receiptSettings).toEqual({ mode: 'digital' });
    expect(applied.previousDashboardTheme.themeId).toBe('emerald-fresh');
    expect(applied.dashboardDraft.themeId).toBe('ocean-blue');
    expect(applied.dashboardThemeHistory).toHaveLength(1);

    const restored = restorePreviousDashboardTheme(applied, '2026-11-27T00:01:00.000Z');
    expect(restored.themeId).toBe('emerald-fresh');
    expect(restored.previousDashboardTheme.themeId).toBe('ocean-blue');
    expect(restored.dashboardThemeHistory).toHaveLength(2);
  });

  test('keeps only the ten most recent theme applications', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
      appliedAt: `2026-11-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      settings: { ...defaultDashboardThemeSettings },
    }));
    const applied = applyDashboardTheme({
      ...defaultDashboardThemeSettings,
      dashboardThemeHistory: history,
    }, defaultDashboardThemeSettings);

    expect(applied.dashboardThemeHistory).toHaveLength(10);
  });

  test('allows dashboard assets only from the current company upload directory', () => {
    expect(validateDashboardThemeAssets({
      ...defaultDashboardThemeSettings,
      dashboardLogoUrl: '/uploads/company-a/123e4567-e89b-12d3-a456-426614174000.png',
      dashboardFaviconUrl: '',
    }, 'company-a')).toBe(true);
    expect(validateDashboardThemeAssets({
      ...defaultDashboardThemeSettings,
      dashboardLogoUrl: '/uploads/company-b/123e4567-e89b-12d3-a456-426614174000.png',
    }, 'company-a')).toBe(false);
    expect(validateDashboardThemeAssets({
      ...defaultDashboardThemeSettings,
      dashboardFaviconUrl: '/uploads/company-a/../123e4567-e89b-12d3-a456-426614174000.ico',
    }, 'company-a')).toBe(false);
    expect(validateDashboardThemeAssets({
      ...defaultDashboardThemeSettings,
      dashboardFaviconUrl: '/uploads/company-a/%2e%2e/123e4567-e89b-12d3-a456-426614174000.ico',
    }, 'company-a')).toBe(false);
  });
});
