import { createTheme } from '@mui/material/styles';

// Paleta baseada na logo Zevo Tech:
// teal escuro (anel externo) + verde suave (o "Z")
const zevoColors = {
  tealDark: '#0C5A63',
  teal: '#0F6B72',
  tealLight: '#4FA8AC',
  green: '#8FC97A',
  greenLight: '#A3D68C',
  greenDark: '#6FAE58',
};

export function buildZevoTheme(mode = 'light') {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: zevoColors.teal,
        dark: zevoColors.tealDark,
        light: zevoColors.tealLight,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: zevoColors.green,
        dark: zevoColors.greenDark,
        light: zevoColors.greenLight,
        contrastText: '#0C3B1F',
      },
      success: { main: '#5FA85A' },
      warning: { main: '#E0A93E' },
      error: { main: '#D9534F' },
      background: {
        default: isDark ? '#0E1A1C' : '#F5F8F7',
        paper: isDark ? '#142B2E' : '#FFFFFF',
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { transition: 'transform 0.15s ease, background-color 0.15s ease' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: `linear-gradient(90deg, ${zevoColors.tealDark} 0%, ${zevoColors.teal} 100%)`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { transition: 'background-color 0.15s ease, transform 0.15s ease' },
        },
      },
    },
  });
}

export default zevoColors;