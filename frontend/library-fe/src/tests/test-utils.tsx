import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { theme } from '@/theme';

// Every test renders through the real theme so component tests exercise the
// actual palette/typography/component overrides, not MUI's defaults.
function AllProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
