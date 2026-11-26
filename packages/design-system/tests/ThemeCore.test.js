import { describe, expect, test } from 'vitest';
import { applyTheme, buildThemeVariables } from '../core/ThemeEngine.js';
import { resolveTheme } from '../core/ThemeResolver.js';
import { validateThemeConfig } from '../core/ThemeValidator.js';
import { loadThemeDraft, removeThemeDraft, saveThemeDraft } from '../core/ThemeStorage.js';

describe('design system core', () => {
  test('builds CSS variables from validated color tokens', () => {
    expect(buildThemeVariables({
      colors: { primary: '#123456', secondary: '#abcdef', accent: '#fedcba' },
    })).toMatchObject({
      '--theme-primary': '#123456',
      '--theme-secondary': '#abcdef',
      '--theme-accent': '#fedcba',
    });
  });

  test('applies theme variables to a target element', () => {
    const values = {};
    const root = {
      style: { setProperty: (name, value) => { values[name] = value; } },
      dataset: {},
    };
    expect(applyTheme({
      appearance: 'dark',
      colors: { primary: '#112233', secondary: '#445566' },
    }, root)).toBe(true);
    expect(values['--theme-primary']).toBe('#112233');
    expect(root.dataset.themeMode).toBe('dark');
  });

  test('resolves app themes and falls back to the legacy theme', () => {
    const legacy = { id: 'red-white' };
    expect(resolveTheme({
      appKey: 'dealer-motor',
      savedTheme: 'dealer-01',
      registry: { 'dealer-motor': [{ id: 'dealer-01' }] },
      legacyTheme: legacy,
    })).toEqual({ id: 'dealer-01' });
    expect(resolveTheme({
      appKey: 'retail',
      savedTheme: 'dealer-01',
      registry: { retail: [{ id: 'retail-01' }] },
      legacyTheme: legacy,
    })).toBe(legacy);
  });

  test('rejects unsafe theme values and accepts appearance modes', () => {
    expect(validateThemeConfig({ colors: { primary: 'red' } }).valid).toBe(false);
    expect(validateThemeConfig({
      colors: { primary: '#123456', secondary: '#abcdef', accent: '#fedcba' },
      appearance: 'light',
    }).valid).toBe(true);
  });

  test('stores and removes theme drafts', () => {
    const values = new Map();
    const storage = {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) || null,
      removeItem: (key) => values.delete(key),
    };
    expect(saveThemeDraft(storage, 'dealer', { primary: '#123456' })).toBe(true);
    expect(loadThemeDraft(storage, 'dealer')).toEqual({ primary: '#123456' });
    expect(removeThemeDraft(storage, 'dealer')).toBe(true);
    expect(loadThemeDraft(storage, 'dealer')).toBeNull();
  });
});
