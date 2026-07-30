import { useEffect } from 'react';

const BASE_TITLE = 'Neighbour Library';

/** Sets the browser tab title to `"{title} · Neighbour Library"`. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
  }, [title]);
}
