import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import {
  resetBooks,
  resetCategories,
  resetCopies,
  resetLoans,
  resetMembers,
  resetStaff,
} from './handlers';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetBooks();
  resetCategories();
  resetMembers();
  resetCopies();
  resetLoans();
  resetStaff();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});
