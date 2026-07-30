import { createTheme } from '@mui/material/styles';

import { components } from './components';
import { palette } from './palette';
import { typography } from './typography';

export const theme = createTheme({
  palette,
  typography,
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
  components,
});
