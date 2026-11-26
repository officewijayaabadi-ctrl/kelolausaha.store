export function saveThemeDraft(storage, key, value) {
  if (!storage) return false;
  storage.setItem(key, JSON.stringify(value));
  return true;
}

export function loadThemeDraft(storage, key) {
  if (!storage) return null;
  const value = storage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function removeThemeDraft(storage, key) {
  if (!storage) return false;
  storage.removeItem(key);
  return true;
}

