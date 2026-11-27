import { normalizeDashboardThemeSettings } from '../src/themes.js';

export const dashboardThemeIds = new Set([
  'ocean-blue', 'emerald-fresh', 'royal-purple', 'sunset-orange', 'rose-premium',
  'sky-minimal', 'indigo-pro', 'teal-modern', 'gold-luxury', 'midnight-dark',
  'red-white', 'blue-professional', 'green-fresh', 'purple-elegant',
  'orange-cheerful', 'pink-sweet', 'navy-elegant', 'yellow-warm',
  'gray-minimal', 'white-clean',
]);

export const dashboardThemeKeys = [
  'themeId', 'customPrimary', 'customSecondary', 'customAccent', 'customBackground',
  'customSurface', 'customSidebar', 'customHeader', 'customText', 'customTextMuted',
  'dashboardLogoUrl', 'dashboardFaviconUrl',
  'customBorder', 'fontFamily', 'fontSize', 'fontWeight', 'titleSize', 'menuTextSize',
  'lineHeight', 'layout', 'contentWidth', 'componentGap', 'statCardColumns', 'cardSize',
  'contentPadding', 'sidebarMode', 'sidebarContent', 'sidebarIcons', 'sidebarIconSize',
  'sidebarMenuGap', 'sidebarActiveRadius', 'logoPosition', 'showNotifications',
  'showUserProfile', 'headerStyle', 'headerHeight', 'headerShadow', 'headerSticky',
  'cardStyle', 'statCardStyle', 'cardRadius', 'cardShadow', 'cardBorder', 'cardPadding',
  'buttonStyle', 'buttonRadius', 'buttonHeight', 'buttonTextSize', 'buttonSecondaryColor',
  'buttonHoverColor', 'buttonOutline', 'density', 'mode',
];

const enumValues = {
  fontFamily: new Set(['Inter', 'Poppins', 'Roboto', 'Nunito', 'Plus Jakarta Sans', 'Lato']),
  layout: new Set(['classic', 'modern-grid', 'spacious', 'compact', 'minimal']),
  cardSize: new Set(['compact', 'normal', 'large']),
  sidebarMode: new Set(['compact', 'normal', 'expanded', 'collapsible', 'mini', 'wide']),
  sidebarContent: new Set(['icons-labels', 'icons']),
  logoPosition: new Set(['top', 'header']),
  headerStyle: new Set(['minimal', 'standard', 'modern']),
  cardStyle: new Set(['flat', 'rounded', 'elevated']),
  statCardStyle: new Set(['shadow', 'border', 'soft']),
  cardShadow: new Set(['none', 'soft', 'strong']),
  buttonStyle: new Set(['standard', 'rounded', 'pill']),
  density: new Set(['compact', 'comfortable', 'spacious']),
  mode: new Set(['light', 'dark', 'system']),
};

const numericRanges = {
  fontSize: [12, 18],
  fontWeight: [300, 700],
  titleSize: [20, 36],
  menuTextSize: [11, 16],
  lineHeight: [1.2, 2],
  contentWidth: [960, 1800],
  componentGap: [8, 32],
  statCardColumns: [2, 5],
  contentPadding: [12, 40],
  sidebarIconSize: [14, 24],
  sidebarMenuGap: [2, 16],
  sidebarActiveRadius: [0, 18],
  headerHeight: [48, 84],
  cardRadius: [0, 24],
  cardPadding: [10, 32],
  buttonRadius: [0, 28],
  buttonHeight: [32, 52],
  buttonTextSize: [11, 16],
};

const colorKeys = [
  'customPrimary', 'customSecondary', 'customAccent', 'customBackground',
  'customSurface', 'customSidebar', 'customHeader', 'customText', 'customTextMuted',
  'customBorder', 'buttonSecondaryColor', 'buttonHoverColor',
];

const booleanKeys = [
  'sidebarIcons', 'showNotifications', 'showUserProfile', 'headerShadow',
  'headerSticky', 'cardBorder', 'buttonOutline',
];

export function pickDashboardThemeSettings(settings = {}) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  return Object.fromEntries(dashboardThemeKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, source[key]]));
}

export function validateDashboardThemeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  if (!dashboardThemeIds.has(settings.themeId)) return false;
  if (!['dashboardLogoUrl', 'dashboardFaviconUrl'].every((key) => typeof settings[key] === 'string')) return false;
  if (!Object.entries(enumValues).every(([key, values]) => values.has(settings[key]))) return false;
  if (!colorKeys.every((key) => typeof settings[key] === 'string'
    && (settings[key] === '' || /^#[0-9a-f]{6}$/i.test(settings[key])))) return false;
  if (!booleanKeys.every((key) => typeof settings[key] === 'boolean')) return false;
  if (!Object.entries(numericRanges).every(([key, [minimum, maximum]]) => (
    Number.isFinite(settings[key]) && settings[key] >= minimum && settings[key] <= maximum
  ))) return false;
  return true;
}

export function validateDashboardThemeAssets(settings, companyId) {
  if (!settings || typeof settings !== 'object' || !companyId) return false;
  return ['dashboardLogoUrl', 'dashboardFaviconUrl'].every((key) => {
    const url = settings[key];
    if (typeof url !== 'string' || !url) return typeof url === 'string';
    const prefix = `/uploads/${companyId}/`;
    if (!url.startsWith(prefix)) return false;
    const filename = url.slice(prefix.length);
    return /^[0-9a-f-]+\.(png|jpg|webp|ico)$/i.test(filename);
  });
}

export function applyDashboardTheme(currentSettings, draft, appliedAt = new Date().toISOString()) {
  const rawActive = pickDashboardThemeSettings(currentSettings);
  const active = normalizeDashboardThemeSettings(currentSettings);
  const history = Array.isArray(currentSettings.dashboardThemeHistory)
    ? currentSettings.dashboardThemeHistory
    : [];
  return {
    ...currentSettings,
    ...draft,
    dashboardDraft: draft,
    previousDashboardTheme: Object.keys(rawActive).length ? active : null,
    dashboardThemeHistory: [
      ...(Object.keys(rawActive).length ? [{ settings: active, appliedAt }] : []),
      ...history,
    ].slice(0, 10),
  };
}

export function restorePreviousDashboardTheme(currentSettings, appliedAt = new Date().toISOString()) {
  const previous = currentSettings.previousDashboardTheme
    ? normalizeDashboardThemeSettings(currentSettings.previousDashboardTheme)
    : null;
  if (!validateDashboardThemeSettings(previous)) return null;
  const rawActive = pickDashboardThemeSettings(currentSettings);
  const active = normalizeDashboardThemeSettings(currentSettings);
  const history = Array.isArray(currentSettings.dashboardThemeHistory)
    ? currentSettings.dashboardThemeHistory
    : [];
  return {
    ...currentSettings,
    ...previous,
    dashboardDraft: previous,
    previousDashboardTheme: Object.keys(rawActive).length ? active : null,
    dashboardThemeHistory: [
      ...(Object.keys(rawActive).length ? [{ settings: active, appliedAt }] : []),
      ...history,
    ].slice(0, 10),
  };
}
