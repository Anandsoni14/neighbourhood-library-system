import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { attachAuthInterceptors, httpClient } from '@/services/httpClient';

import authReducer, { logout } from './slices/authSlice';
import booksReducer from './slices/booksSlice';
import categoriesReducer from './slices/categoriesSlice';
import copiesReducer from './slices/copiesSlice';
import dashboardReducer from './slices/dashboardSlice';
import loansReducer from './slices/loansSlice';
import membersReducer from './slices/membersSlice';
import staffReducer from './slices/staffSlice';

const rootReducer = combineSlices({
  auth: authReducer,
  books: booksReducer,
  categories: categoriesReducer,
  members: membersReducer,
  copies: copiesReducer,
  loans: loansReducer,
  dashboard: dashboardReducer,
  staff: staffReducer,
});

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
