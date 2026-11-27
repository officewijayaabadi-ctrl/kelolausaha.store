import { describe, expect, test } from 'vitest';
import { dashboardThemes, defaultThemeSettings, getThemeColors, normalizeThemeSettings, resolveDashboardTheme } from './themes.js';

describe('dashboard themes', () => {
  test('provides ten modern themes with the Ocean Blue default and Midnight Dark theme', () => {
    expect(dashboardThemes).toHaveLength(10);
    expect(defaultThemeSettings.themeId).toBe('ocean-blue');
    expect(dashboardThemes[0]).toMatchObject({
      name: 'Ocean Blue',
      primary: '#2563eb',
      secondary: '#eff6ff',
    });
    expect(dashboardThemes.find(({ id }) => id === 'emerald-fresh')).toBeDefined();
    expect(dashboardThemes.find(({ id }) => id === 'midnight-dark').mode).toBe('dark');
  });

  test('migrates legacy saved themes without dropping company options', () => {
    expect(normalizeThemeSettings({ themeId: 'blue-professional', sidebarMode: 'mini' })).toMatchObject({
      themeId: 'ocean-blue',
      sidebarMode: 'compact',
    });
  });

  test('allows company colors to override the selected palette', () => {
    expect(getThemeColors({
      themeId: 'emerald-fresh',
      customPrimary: '#123456',
      customSecondary: '',
      mode: 'dark',
    })).toMatchObject({
      primary: '#123456',
      secondary: '#ecfdf5',
      accent: '#10b981',
      background: '#111827',
      surface: '#1f2937',
      text: '#f1f5f9',
      mode: 'dark',
    });
  });

  test('uses the legacy adapter for saved themes outside the new registry', () => {
    expect(resolveDashboardTheme('dealer-motor', 'emerald-fresh', {
      'dealer-motor': [{ id: 'dealer-01' }],
    }).id).toBe('emerald-fresh');
    expect(resolveDashboardTheme('retail', 'dealer-01', {
      retail: [{ id: 'retail-01' }],
    }).id).toBe('ocean-blue');
  });

  test('resolves dark and system modes to readable theme tokens', () => {
    expect(getThemeColors({ themeId: 'ocean-blue', mode: 'dark' })).toMatchObject({
      background: '#111827',
      surface: '#1f2937',
      text: '#f1f5f9',
      mode: 'dark',
    });
    expect(getThemeColors({ themeId: 'ocean-blue', mode: 'system' }, true)).toMatchObject({
      background: '#111827',
      mode: 'dark',
    });
    expect(getThemeColors({ themeId: 'ocean-blue', mode: 'system' }, false).mode).toBe('light');
  });

  test('uses the business type accent for new receipt settings and preserves saved choices', () => {
    expect(normalizeThemeSettings({}, 'laundry').receiptSettings).toMatchObject({
      mode: 'digital',
      accent: 'emerald',
    });
    expect(normalizeThemeSettings({
      receiptSettings: { mode: 'thermal', accent: 'royal', storeAddress: 'Jl. Melati' },
    }, 'laundry').receiptSettings).toMatchObject({
      mode: 'thermal',
      accent: 'royal',
      storeAddress: 'Jl. Melati',
      footerNote: 'Terima kasih atas kepercayaan Anda.',
    });
  });
});
