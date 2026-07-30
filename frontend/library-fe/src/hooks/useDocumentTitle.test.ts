import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  it('sets the document title with the app name suffix', () => {
    renderHook(() => useDocumentTitle('Books'));

    expect(document.title).toBe('Books · Neighbour Library');
  });

  it('falls back to the bare app name when no title is given', () => {
    renderHook(() => useDocumentTitle());

    expect(document.title).toBe('Neighbour Library');
  });

  it('updates the title when the argument changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Books' },
    });
    expect(document.title).toBe('Books · Neighbour Library');

    rerender({ title: 'Members' });
    expect(document.title).toBe('Members · Neighbour Library');
  });
});
