import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetBooks, resetMembers } from './handlers';
import { server } from './server';

// Node 22+'s own experimental `localStorage` global shadows jsdom's working
// implementation, leaving `localStorage` undefined here and in app code
// under test. The `test`/`test:watch`/`test:coverage` npm scripts set
// NODE_OPTIONS=--no-experimental-webstorage to disable it — if you invoke
// `vitest` directly instead of via npm, set that flag yourself or every
// localStorage-touching test will fail with "Cannot read properties of
// undefined".

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetBooks();
  resetMembers();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});
