const hexColor = /^#[0-9a-f]{6}$/i;
const appearanceModes = new Set(['light', 'dark']);

export function isValidThemeColor(value) {
  return typeof value === 'string' && hexColor.test(value);
}

export function validateThemeConfig(config = {}) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['Theme configuration must be an object.'] };
  }

  if (config.colors && typeof config.colors === 'object') {
    Object.entries(config.colors).forEach(([key, value]) => {
      if (key === 'primary' || key === 'secondary' || key === 'accent') {
        if (!isValidThemeColor(value)) errors.push(`Invalid ${key} color.`);
      }
    });
  }

  if (config.appearance && !appearanceModes.has(config.appearance)) {
    errors.push('Appearance must be light or dark.');
  }

  return { valid: errors.length === 0, errors };
}

