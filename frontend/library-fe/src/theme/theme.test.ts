import { describe, expect, it } from 'vitest';

import { theme } from '@/theme';

describe('theme', () => {
  it('exposes the expected enterprise palette', () => {
    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.primary.main).toBe('#2454a6');
    expect(theme.palette.background.default).not.toBe(theme.palette.background.paper);
  });

  it('uses an 8px spacing unit', () => {
    expect(theme.spacing(2)).toBe('16px');
  });

  it('disables ripple globally to avoid a decorative interaction pattern', () => {
    expect(theme.components?.MuiButtonBase?.defaultProps?.disableRipple).toBe(true);
  });

  it('disables button elevation and keeps a flat, non-pill radius', () => {
    const buttonDefaults = theme.components?.MuiButton?.defaultProps;
    expect(buttonDefaults?.disableElevation).toBe(true);

    const buttonStyles = theme.components?.MuiButton?.styleOverrides?.root;
    expect(buttonStyles).toMatchObject({ borderRadius: 4 });
  });

  it('never uppercases button text', () => {
    expect(theme.typography.button.textTransform).toBe('none');
  });

  it('uses dense table cell padding rather than default spacious rows', () => {
    const cellStyles = theme.components?.MuiTableCell?.styleOverrides?.root;
    expect(cellStyles).toMatchObject({ padding: '8px 16px' });
  });

  it('gives Paper a flat border instead of a drop shadow', () => {
    expect(theme.components?.MuiPaper?.defaultProps?.elevation).toBe(0);
  });
});
