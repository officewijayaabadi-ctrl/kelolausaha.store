import { resolveTheme as resolveDesignSystemTheme } from '../packages/design-system/core/ThemeResolver.js';

export const dashboardThemes = [
  { id: 'red-white', name: 'Crimson Momentum', primary: '#ef4444', secondary: '#fff1f2', mode: 'light' },
  { id: 'green-fresh', name: 'Emerald Energy', primary: '#10b981', secondary: '#ecfdf5', mode: 'light' },
  { id: 'purple-elegant', name: 'Violet Future', primary: '#8b5cf6', secondary: '#f5f3ff', mode: 'light' },
  { id: 'orange-cheerful', name: 'Sunset Boost', primary: '#f97316', secondary: '#fff7ed', mode: 'light' },
  { id: 'pink-sweet', name: 'Pink Horizon', primary: '#ec4899', secondary: '#fdf2f8', mode: 'light' },
  { id: 'teal-modern', name: 'Aqua Digital', primary: '#06b6d4', secondary: '#ecfeff', mode: 'light' },
  { id: 'navy-elegant', name: 'Midnight Blue', primary: '#3b82f6', secondary: '#172554', mode: 'dark' },
  { id: 'yellow-warm', name: 'Solar Gold', primary: '#eab308', secondary: '#fefce8', mode: 'light' },
  { id: 'gray-minimal', name: 'Graphite Clean', primary: '#64748b', secondary: '#f1f5f9', mode: 'light' },
  { id: 'white-clean', name: 'Arctic Focus', primary: '#2563eb', secondary: '#eff6ff', mode: 'light' },
];

export const defaultThemeSettings = {
  themeId: 'red-white',
  customPrimary: '',
  customSecondary: '',
  mode: 'light',
  sidebarMode: 'wide',
  statCardStyle: 'shadow',
  logoUrl: '',
  faviconUrl: '',
  qrisUrl: '',
  receiptSettings: {
    mode: 'digital',
    accent: 'crimson',
    storeAddress: '',
    footerNote: 'Terima kasih atas kepercayaan Anda.',
  },
};

const receiptAccentByBusinessType = {
  laundry: 'emerald',
  dealer_motor: 'crimson',
  dealer_vehicle: 'crimson',
  retail: 'royal',
  restaurant: 'crimson',
  services: 'royal',
  workshop: 'crimson',
  salon: 'royal',
  printing: 'royal',
  distribution: 'emerald',
};

export function getDefaultReceiptSettings(businessType) {
  return {
    ...defaultThemeSettings.receiptSettings,
    accent: receiptAccentByBusinessType[businessType] || defaultThemeSettings.receiptSettings.accent,
  };
}

export function normalizeThemeSettings(settings = {}, businessType = 'dealer_motor') {
  const { receiptSettings, ...otherSettings } = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings
    : {};
  const normalized = {
    ...defaultThemeSettings,
    ...otherSettings,
    receiptSettings: {
      ...getDefaultReceiptSettings(businessType),
      ...(receiptSettings && typeof receiptSettings === 'object' && !Array.isArray(receiptSettings)
        ? receiptSettings
        : {}),
    },
  };
  if (normalized.themeId === 'blue-professional') normalized.themeId = 'red-white';
  return normalized;
}

export const receiptModes = [
  { id: 'digital', name: 'Modern Digital Card', description: 'Kartu nota digital untuk dibagikan.' },
  { id: 'thermal', name: 'Struk Thermal 58/80mm', description: 'Tampilan ringkas untuk cetak thermal.' },
  { id: 'mobile', name: 'Compact Mobile Share', description: 'Nota ringkas untuk layar ponsel.' },
];

export const receiptAccents = [
  { id: 'emerald', name: 'Emerald Laundry', color: '#059669', background: '#ecfdf5' },
  { id: 'crimson', name: 'Crimson Kelola Usahaku', color: '#dc2626', background: '#fef2f2' },
  { id: 'royal', name: 'Royal Blue', color: '#2563eb', background: '#eff6ff' },
];

export function getThemeColors(settings) {
  const theme = dashboardThemes.find(({ id }) => id === settings.themeId) || dashboardThemes[0];
  return {
    primary: settings.customPrimary || theme.primary,
    secondary: settings.customSecondary || theme.secondary,
    mode: settings.mode || theme.mode,
  };
}

export function resolveDashboardTheme(appKey, savedTheme, registry = {}) {
  const legacyTheme = dashboardThemes.find(({ id }) => id === savedTheme)
    || dashboardThemes[0];
  return resolveDesignSystemTheme({
    appKey,
    savedTheme,
    registry,
    legacyTheme,
  });
}
