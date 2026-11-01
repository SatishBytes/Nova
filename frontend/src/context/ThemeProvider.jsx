import { useEffect, useMemo, useState } from 'react';
import ThemeContext from './themeContext';

const getSystemTheme = () => (
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

const getPreference = () => {
  const preference = localStorage.getItem('nova-theme');
  return ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
};

const applyTheme = (preference) => {
  const resolvedTheme = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getPreference);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('nova-theme', theme);

    if (theme !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => applyTheme('system');
    mediaQuery.addEventListener('change', updateSystemTheme);

    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    cycleTheme: () => setTheme((current) => (
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'
    )),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
