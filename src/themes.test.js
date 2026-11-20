import { describe, expect, test } from 'vitest';
import { dashboardThemes, defaultThemeSettings, getThemeColors } from './themes.js';

describe('dashboard themes', () => {
  test('provides ten themes with the recommended default and dark theme', () => {
    expect(dashboardThemes).toHaveLength(10);
    expect(defaultThemeSettings.themeId).toBe('blue-professional');
    expect(dashboardThemes.find(({ id }) => id === 'white-clean')).toBeDefined();
    expect(dashboardThemes.find(({ id }) => id === 'navy-elegant').mode).toBe('dark');
  });

  test('allows company colors to override the selected palette', () => {
    expect(getThemeColors({
      themeId: 'green-fresh',
      customPrimary: '#123456',
      customSecondary: '',
      mode: 'dark',
    })).toEqual({ primary: '#123456', secondary: '#e9f5ed', mode: 'dark' });
  });
});
