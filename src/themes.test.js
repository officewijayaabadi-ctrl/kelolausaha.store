import { describe, expect, test } from 'vitest';
import { dashboardThemes, defaultThemeSettings, getThemeColors, normalizeThemeSettings } from './themes.js';

describe('dashboard themes', () => {
  test('provides ten themes with the red-white default and dark theme', () => {
    expect(dashboardThemes).toHaveLength(10);
    expect(defaultThemeSettings.themeId).toBe('red-white');
    expect(dashboardThemes[0]).toMatchObject({
      name: 'Merah Putih',
      primary: '#d93645',
      secondary: '#fff1f2',
    });
    expect(dashboardThemes.find(({ id }) => id === 'white-clean')).toBeDefined();
    expect(dashboardThemes.find(({ id }) => id === 'navy-elegant').mode).toBe('dark');
  });

  test('migrates saved blue defaults to red-white without dropping company options', () => {
    expect(normalizeThemeSettings({ themeId: 'blue-professional', sidebarMode: 'mini' })).toMatchObject({
      themeId: 'red-white',
      sidebarMode: 'mini',
    });
  });

  test('allows company colors to override the selected palette', () => {
    expect(getThemeColors({
      themeId: 'green-fresh',
      customPrimary: '#123456',
      customSecondary: '',
      mode: 'dark',
    })).toEqual({ primary: '#123456', secondary: '#e9f5ed', mode: 'dark' });
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
