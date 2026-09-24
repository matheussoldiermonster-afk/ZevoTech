import { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildZevoTheme } from '../theme/theme';

const ThemeModeContext = createContext({ mode: 'light', toggleMode: () => {} });

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('zevo-theme-mode') || 'light');

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('zevo-theme-mode', next);
      return next;
    });
  };

  const theme = useMemo(() => buildZevoTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}