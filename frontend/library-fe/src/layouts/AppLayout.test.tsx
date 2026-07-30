import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { render, screen } from '@/tests/test-utils';

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('renders the header, sidebar, and the routed page content together', () => {
    render(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByRole('heading', { name: 'Neighbour Library' })).toBeVisible();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeVisible();
    expect(screen.getByText('Page content')).toBeVisible();
  });
});
