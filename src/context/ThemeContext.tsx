'use client';

/**
 * Theme context — selects between the "Red" and "Teal" visual
 * themes. The active theme is written to the data-theme attribute on
 * <html>, which re-resolves every --th-* custom property in
 * globals.css, so switching is instant. The choice persists in
 * localStorage; an inline script in layout.tsx applies it before
 * first paint to avoid a flash of the wrong theme.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

export type Theme = 'red' | 'teal';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'red', label: 'Red' },
  { id: 'teal', label: 'Teal' },
];

const STORAGE_KEY = 'provenance-theme';
const DEFAULT_THEME: Theme = 'red';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

function isTheme(value: unknown): value is Theme {
  return value === 'red' || value === 'teal';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Adopt whatever the pre-paint script already applied (or stored).
  useEffect(() => {
    const fromAttr = document.documentElement.dataset.theme;
    if (isTheme(fromAttr)) {
      setThemeState(fromAttr);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isTheme(stored)) setThemeState(stored);
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  // Keep <html data-theme> and storage in sync with state.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
