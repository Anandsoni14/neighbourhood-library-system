import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

import type { AppStore, RootState } from '@/redux/store';
import { setupStore } from '@/redux/store';
import { theme } from '@/theme';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  initialEntries?: MemoryRouterProps['initialEntries'];
}

// Every test renders through the real theme, a real (isolated) Redux store,
// and a MemoryRouter so component tests exercise actual behavior — routing,
// dispatched state changes, theme overrides — rather than a bare DOM tree.
function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = setupStore(preloadedState),
    initialEntries = ['/'],
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from '@testing-library/react';
export { renderWithProviders as render };
