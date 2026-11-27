import { resolveTheme as resolveDesignSystemTheme } from '../packages/design-system/core/ThemeResolver.js';

export const dashboardThemes = [
  { id: 'ocean-blue', name: 'Ocean Blue', description: 'Cerah dan profesional', primary: '#2563eb', secondary: '#eff6ff', accent: '#0ea5e9', background: '#f8fafc', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#1e293b', textMuted: '#64748b', border: '#e2e8f0', mode: 'light' },
  { id: 'emerald-fresh', name: 'Emerald Fresh', description: 'Segar dan natural', primary: '#059669', secondary: '#ecfdf5', accent: '#10b981', background: '#f7fbf9', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#16352b', textMuted: '#648075', border: '#dcebe3', mode: 'light' },
  { id: 'royal-purple', name: 'Royal Purple', description: 'Elegan dan modern', primary: '#7c3aed', secondary: '#f5f3ff', accent: '#a78bfa', background: '#faf9ff', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#2e2445', textMuted: '#766b89', border: '#e9e3f4', mode: 'light' },
  { id: 'sunset-orange', name: 'Sunset Orange', description: 'Hangat dan energik', primary: '#ea580c', secondary: '#fff7ed', accent: '#fb923c', background: '#fffbf7', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#3d2c20', textMuted: '#867466', border: '#f1e4d8', mode: 'light' },
  { id: 'rose-premium', name: 'Rose Premium', description: 'Lembut dan eksklusif', primary: '#be3455', secondary: '#fff1f4', accent: '#ec4899', background: '#fff9fa', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#3b2530', textMuted: '#856d78', border: '#f1dfe5', mode: 'light' },
  { id: 'sky-minimal', name: 'Sky Minimal', description: 'Minimalis dan ringan', primary: '#0284c7', secondary: '#f0f9ff', accent: '#38bdf8', background: '#f7fbfe', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#1f3443', textMuted: '#6b8291', border: '#deebf2', mode: 'light' },
  { id: 'indigo-pro', name: 'Indigo Pro', description: 'Profesional korporat', primary: '#4f46e5', secondary: '#eef2ff', accent: '#818cf8', background: '#f8f9ff', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#25294a', textMuted: '#6c7191', border: '#e2e5f2', mode: 'light' },
  { id: 'teal-modern', name: 'Teal Modern', description: 'Modern dan seimbang', primary: '#0f766e', secondary: '#f0fdfa', accent: '#2dd4bf', background: '#f6fbfa', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#1c3533', textMuted: '#68817e', border: '#dcebe8', mode: 'light' },
  { id: 'gold-luxury', name: 'Gold Luxury', description: 'Premium dan mewah', primary: '#a16207', secondary: '#fefce8', accent: '#eab308', background: '#fcfbf7', surface: '#ffffff', sidebar: '#ffffff', header: '#ffffff', text: '#352e1b', textMuted: '#81775e', border: '#eee8d8', mode: 'light' },
  { id: 'midnight-dark', name: 'Midnight Dark', description: 'Gelap dan fokus', primary: '#818cf8', secondary: '#1e293b', accent: '#38bdf8', background: '#111827', surface: '#1f2937', sidebar: '#172033', header: '#1f2937', text: '#f1f5f9', textMuted: '#a8b4c5', border: '#374151', mode: 'dark' },
];

export const defaultDashboardThemeSettings = {
  themeId: 'ocean-blue',
  customPrimary: '',
  customSecondary: '',
  customAccent: '',
  customBackground: '',
  customSurface: '',
  customSidebar: '',
  customHeader: '',
  customText: '',
  customTextMuted: '',
  customBorder: '',
  dashboardLogoUrl: '',
  dashboardFaviconUrl: '',
  fontFamily: 'Inter',
  fontSize: 14,
  fontWeight: 400,
  titleSize: 24,
  menuTextSize: 13,
  lineHeight: 1.5,
  layout: 'modern-grid',
  contentWidth: 1400,
  componentGap: 16,
  statCardColumns: 4,
  cardSize: 'normal',
  contentPadding: 24,
  sidebarMode: 'normal',
  sidebarContent: 'icons-labels',
  sidebarIcons: true,
  sidebarIconSize: 18,
  sidebarMenuGap: 8,
  sidebarActiveRadius: 10,
  logoPosition: 'top',
  showNotifications: true,
  showUserProfile: true,
  headerStyle: 'modern',
  headerHeight: 64,
  headerShadow: true,
  headerSticky: true,
  cardStyle: 'rounded',
  statCardStyle: 'shadow',
  cardRadius: 16,
  cardShadow: 'soft',
  cardBorder: false,
  cardPadding: 18,
  buttonStyle: 'rounded',
  buttonRadius: 10,
  buttonHeight: 40,
  buttonTextSize: 14,
  buttonSecondaryColor: '#eef2f7',
  buttonHoverColor: '',
  buttonOutline: false,
  density: 'comfortable',
  mode: 'light',
};

export const defaultThemeSettings = {
  ...defaultDashboardThemeSettings,
  logoUrl: '',
  faviconUrl: '',
  qrisUrl: '',
  receiptSettings: {
    mode: 'digital',
    accent: 'crimson',
    storeAddress: '',
    storePhone: '',
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
  const legacyThemeIds = {
    'red-white': 'ocean-blue',
    'blue-professional': 'ocean-blue',
    'green-fresh': 'emerald-fresh',
    'purple-elegant': 'royal-purple',
    'orange-cheerful': 'sunset-orange',
    'pink-sweet': 'rose-premium',
    'navy-elegant': 'midnight-dark',
    'yellow-warm': 'gold-luxury',
    'gray-minimal': 'sky-minimal',
    'white-clean': 'sky-minimal',
  };
  const themeId = legacyThemeIds[otherSettings.themeId] || otherSettings.themeId;
  const normalized = {
    ...defaultThemeSettings,
    ...otherSettings,
    themeId: dashboardThemes.some((theme) => theme.id === themeId)
      ? themeId
      : defaultDashboardThemeSettings.themeId,
    sidebarMode: otherSettings.sidebarMode === 'mini'
      ? 'compact'
      : otherSettings.sidebarMode === 'wide'
        ? 'expanded'
        : otherSettings.sidebarMode || defaultDashboardThemeSettings.sidebarMode,
    receiptSettings: {
      ...getDefaultReceiptSettings(businessType),
      ...(receiptSettings && typeof receiptSettings === 'object' && !Array.isArray(receiptSettings)
        ? receiptSettings
        : {}),
    },
  };
  return normalized;
}

export function normalizeDashboardThemeSettings(settings = {}) {
  const normalized = normalizeThemeSettings(settings);
  return Object.fromEntries(Object.keys(defaultDashboardThemeSettings)
    .map((key) => [key, normalized[key]]));
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

export function getThemeColors(settings, systemDarkMode = false) {
  const theme = dashboardThemes.find(({ id }) => id === settings.themeId) || dashboardThemes[0];
  const settingMode = settings.mode || theme.mode;
  const isDark = settingMode === 'dark' || (settingMode === 'system' && systemDarkMode);
  const darkPalette = theme.mode === 'dark';
  return {
    primary: settings.customPrimary || theme.primary,
    secondary: settings.customSecondary || theme.secondary,
    accent: settings.customAccent || theme.accent,
    background: settings.customBackground || (isDark
      ? darkPalette ? theme.background : '#111827'
      : darkPalette ? '#f8fafc' : theme.background),
    surface: settings.customSurface || (isDark
      ? darkPalette ? theme.surface : '#1f2937'
      : darkPalette ? '#ffffff' : theme.surface),
    sidebar: settings.customSidebar || (isDark
      ? darkPalette ? theme.sidebar : '#172033'
      : darkPalette ? '#ffffff' : theme.sidebar),
    header: settings.customHeader || (isDark
      ? darkPalette ? theme.header : '#1f2937'
      : darkPalette ? '#ffffff' : theme.header),
    text: settings.customText || (isDark
      ? darkPalette ? theme.text : '#f1f5f9'
      : darkPalette ? '#1e293b' : theme.text),
    textMuted: settings.customTextMuted || (isDark
      ? darkPalette ? theme.textMuted : '#a8b4c5'
      : darkPalette ? '#64748b' : theme.textMuted),
    border: settings.customBorder || (isDark
      ? darkPalette ? theme.border : '#374151'
      : darkPalette ? '#e2e8f0' : theme.border),
    mode: settingMode === 'system' ? (systemDarkMode ? 'dark' : 'light') : settingMode,
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
