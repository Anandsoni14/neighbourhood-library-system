import type { PaletteOptions } from '@mui/material/styles';

// Restrained enterprise palette: neutral greys for structure, one desaturated
// blue as the only accent, and semantic colors reserved for status meaning
// (never used decoratively).
export const palette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#2454a6',
    light: '#4c74b8',
    dark: '#1a3d7c',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#475569',
  },
  success: {
    main: '#1e7d3a',
  },
  warning: {
    main: '#b5720a',
  },
  error: {
    main: '#c62828',
  },
  background: {
    default: '#f5f6f8',
    paper: '#ffffff',
  },
  text: {
    primary: '#1a1f27',
    secondary: '#5c6673',
  },
  divider: '#e0e3e8',
};
