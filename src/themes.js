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
};

export function normalizeThemeSettings(settings = {}) {
  const normalized = { ...defaultThemeSettings, ...settings };
  if (normalized.themeId === 'blue-professional') normalized.themeId = 'red-white';
  return normalized;
}

export function getThemeColors(settings) {
  const theme = dashboardThemes.find(({ id }) => id === settings.themeId) || dashboardThemes[0];
  return {
    primary: settings.customPrimary || theme.primary,
    secondary: settings.customSecondary || theme.secondary,
    mode: settings.mode || theme.mode,
  };
}
