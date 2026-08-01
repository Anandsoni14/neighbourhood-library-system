import type { Components, Theme } from '@mui/material/styles';

// Shared defaults so every feature gets the same look (no ripple, flat 1px
// borders instead of drop shadows, dense padding) without re-declaring it.
export const components: Components<Theme> = {
  MuiButtonBase: {
    defaultProps: {
      disableRipple: true,
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
      size: 'small',
    },
    styleOverrides: {
      root: {
        borderRadius: 4,
      },
    },
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundImage: 'none',
        border: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiCard: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        border: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiAppBar: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        padding: '8px 16px',
      },
      head: {
        fontWeight: 600,
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiDialog: {
    defaultProps: {
      slotProps: { paper: { elevation: 0 } },
    },
    styleOverrides: {
      paper: ({ theme }) => ({
        border: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        fontWeight: 500,
      },
    },
  },
};
