import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { attachAuthInterceptors, httpClient } from '@/services/httpClient';

import authReducer, { logout } from './slices/authSlice';
import booksReducer from './slices/booksSlice';
import membersReducer from './slices/membersSlice';

const rootReducer = combineSlices({ auth: authReducer, books: booksReducer, members: membersReducer });

export type RootState = ReturnType<typeof rootReducer>;

/**
 * A factory rather than only a singleton so tests can create an isolated
 * store per test (optionally preloaded), instead of sharing app-wide state.
 */
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];

export const store = setupStore();

attachAuthInterceptors(httpClient, {
  getToken: () => store.getState().auth.token,
  onUnauthorized: () => store.dispatch(logout()),
});
