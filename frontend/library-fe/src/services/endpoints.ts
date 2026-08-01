export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    me: '/auth/me',
  },
  books: {
    list: '/books',
    byId: (bookId: string) => `/books/${bookId}`,
    archive: (bookId: string) => `/books/${bookId}/archive`,
    unarchive: (bookId: string) => `/books/${bookId}/unarchive`,
  },
  bookCopies: {
    list: '/book-copies',
    byId: (copyId: string) => `/book-copies/${copyId}`,
  },
  members: {
    list: '/members',
    byId: (memberId: string) => `/members/${memberId}`,
  },
  staff: {
    list: '/staff',
    byId: (staffId: string) => `/staff/${staffId}`,
    activate: (staffId: string) => `/staff/${staffId}/activate`,
    deactivate: (staffId: string) => `/staff/${staffId}/deactivate`,
  },
  categories: {
    list: '/categories',
    byId: (categoryId: string) => `/categories/${categoryId}`,
    archive: (categoryId: string) => `/categories/${categoryId}/archive`,
    unarchive: (categoryId: string) => `/categories/${categoryId}/unarchive`,
  },
  loans: {
    list: '/loans',
    overdue: '/loans/overdue',
    byId: (loanId: string) => `/loans/${loanId}`,
    return: (loanId: string) => `/loans/${loanId}/return`,
  },
} as const;
