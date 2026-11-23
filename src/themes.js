export const dashboardThemes = [
  { id: 'red-white', name: 'Merah Putih', primary: '#d93645', secondary: '#fff1f2', mode: 'light' },
  { id: 'green-fresh', name: 'Hijau Segar', primary: '#21845a', secondary: '#e9f5ed', mode: 'light' },
  { id: 'purple-elegant', name: 'Ungu Elegan', primary: '#7556c4', secondary: '#f0ebfb', mode: 'light' },
  { id: 'orange-cheerful', name: 'Oranye Ceria', primary: '#d97928', secondary: '#fff1e5', mode: 'light' },
  { id: 'pink-sweet', name: 'Merah Muda Manis', primary: '#d45191', secondary: '#fcecf4', mode: 'light' },
  { id: 'teal-modern', name: 'Tosca Modern', primary: '#168c91', secondary: '#e5f5f4', mode: 'light' },
  { id: 'navy-elegant', name: 'Navy Elegan', primary: '#4185ef', secondary: '#203b5a', mode: 'dark' },
  { id: 'yellow-warm', name: 'Kuning Hangat', primary: '#b98313', secondary: '#fff6dc', mode: 'light' },
  { id: 'gray-minimal', name: 'Abu Minimalis', primary: '#687386', secondary: '#eef0f3', mode: 'light' },
  { id: 'white-clean', name: 'Putih Bersih', primary: '#3675dc', secondary: '#f4f7fb', mode: 'light' },
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
