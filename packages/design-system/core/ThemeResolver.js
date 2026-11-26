export function resolveTheme({ appKey = '', savedTheme = null, registry = {}, legacyTheme = null } = {}) {
  if (savedTheme && typeof savedTheme === 'object') {
    if (!savedTheme.appKey || savedTheme.appKey === appKey) {
      return savedTheme;
    }
  }

  if (typeof savedTheme === 'string' && registry[appKey]) {
    const match = registry[appKey].find((theme) => theme.id === savedTheme);
    if (match) return match;
  }

  return legacyTheme || null;
}

