import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { applyTheme } from './ThemeEngine.js';

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ appKey = 'platform', theme = null, registry = {}, children }) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ appKey, theme, registry }), [appKey, theme, registry]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

