const cssVariableMap = {
  primary: '--theme-primary',
  secondary: '--theme-secondary',
  accent: '--theme-accent',
  background: '--theme-background',
  surface: '--theme-surface',
  text: '--theme-text',
  textMuted: '--theme-text-muted',
  border: '--theme-border',
  success: '--theme-success',
  warning: '--theme-warning',
  danger: '--theme-danger',
};

export function buildThemeVariables(theme = {}) {
  const colors = theme.colors && typeof theme.colors === 'object' ? theme.colors : {};
  return Object.fromEntries(
    Object.entries(cssVariableMap)
      .filter(([token]) => typeof colors[token] === 'string')
      .map(([token, cssVariable]) => [cssVariable, colors[token]]),
  );
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root) return false;
  const variables = buildThemeVariables(theme);
  Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
  if (typeof theme.appearance === 'string') {
    root.dataset.themeMode = theme.appearance;
  }
  return true;
}

