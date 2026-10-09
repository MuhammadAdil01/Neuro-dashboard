'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'LIGHT' | 'DARK' | 'SYSTEM';
const STORAGE_KEY = 'nt-theme';

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'SYSTEM';var d=p==='DARK'||(p==='SYSTEM'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

function resolve(pref: ThemePref) {
  if (pref === 'SYSTEM') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return pref === 'DARK' ? 'dark' : 'light';
}

const ThemeContext = createContext<{ theme: ThemePref; resolved: 'light' | 'dark'; setTheme: (t: ThemePref) => void }>({
  theme: 'SYSTEM',
  resolved: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>('SYSTEM');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let stored: ThemePref = 'SYSTEM';
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as ThemePref) || 'SYSTEM';
    } catch {}
    setThemeState(stored);
  }, []);

  useEffect(() => {
    const apply = () => {
      const r = resolve(theme);
      document.documentElement.dataset.theme = r;
      setResolved(r);
    };
    apply();
    if (theme !== 'SYSTEM') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
