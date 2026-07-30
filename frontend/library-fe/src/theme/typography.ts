import type { TypographyVariantsOptions } from '@mui/material/styles';

const systemFontStack = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',');

// A tight heading scale, not a marketing-page display scale — the largest
// heading here is meant for a page title bar, not a hero section.
export const typography: TypographyVariantsOptions = {
  fontFamily: systemFontStack,
  fontSize: 14,
  h1: { fontSize: '1.75rem', fontWeight: 600 },
  h2: { fontSize: '1.5rem', fontWeight: 600 },
  h3: { fontSize: '1.25rem', fontWeight: 600 },
  h4: { fontSize: '1.125rem', fontWeight: 600 },
  h5: { fontSize: '1rem', fontWeight: 600 },
  h6: { fontSize: '0.9375rem', fontWeight: 600 },
  body1: { fontSize: '0.875rem' },
  body2: { fontSize: '0.8125rem' },
  button: { fontSize: '0.8125rem', fontWeight: 500, textTransform: 'none' },
};
