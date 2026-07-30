import { useEffect } from 'react';

const BASE_TITLE = 'Library Management System';

/** Sets the browser tab title to `"{title} · Library Management System"`. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
  }, [title]);
}
