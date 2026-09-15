import type { CloudBook, Draft } from './template-storage';
export type LibraryBook = { draft: Draft; local: true } | { draft: CloudBook; local: false };

/** Browser work takes precedence over an account copy of the same book. */
export function templateLibrary(local: Draft[], cloud: CloudBook[]): LibraryBook[] {
  const localIds = new Set(local.map(book => book.id));
  return [
    ...local.map(draft => ({ draft, local: true as const })),
    ...cloud.filter(book => !localIds.has(book.id)).map(draft => ({ draft, local: false as const })),
  ].sort((a, b) => b.draft.updated - a.draft.updated);
}
