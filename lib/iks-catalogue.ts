export const kidsCategories = ["Animal tales & everyday choices", "Art, buildings & patterns", "Big questions & thoughtful choices", "Community, fairness & leadership", "Epics, stories & traditions", "Materials, tools & inventions", "Music, movement & theatre", "Nature, the body & wellbeing history", "Numbers, shapes & puzzles", "Plants, farms, water & crafts", "Sky traditions & historical beliefs", "Sky, calendars & time", "Words, languages & thinking"] as const;
export const readerAges = ['6–10', '7–12', '8–12', '10–15', '12–16'] as const;
export type CatalogueBook = { id: string; title: string; creator: string; year: string; language: string | string[]; sourceUrl: string; pdfUrl: string; categories: string[]; idea: string; age: string; checked: string; review: string; verification?: string; dateEvidenceUrl?: string; volume?: string; publisher?: string; pdf?: Blob; pdfName?: string };
export type ContentCard = { id: string; bookId: string; title: string; pages: string; category: string; age: string; notes: string };
export type CatalogueState = { books: CatalogueBook[]; cards: ContentCard[]; selected: string[] };
export function webUrl(value: string) { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : ''; } catch { return ''; } }
export function selectionPack(state: CatalogueState) {
  const books = state.books.filter(book => state.selected.includes(book.id));
  return { format: 'iks-source-selection-v1', books: books.map(({pdf, ...book}) => ({...book, attachedPdf: Boolean(pdf)})), content: state.cards.filter(card => books.some(book => book.id === card.bookId)) };
}

// Merge on every load so already-saved browser catalogues receive new bundled books.
// Saved records win: importing a collection must not discard attachments or edits.
export function mergeCatalogue(saved: CatalogueState | undefined, bundled: CatalogueBook[]): CatalogueState {
  if (!saved) return { books: bundled, cards: [], selected: [] };
  const ids = new Set(saved.books.map(book => book.id));
  return { ...saved, books: [...saved.books, ...bundled.filter(book => !ids.has(book.id))] };
}
export function filterBooks(books: CatalogueBook[], cards: ContentCard[], query: string, category: string, age: string) {
  const search = query.trim().toLowerCase();
  return books.filter(b => (!search || `${b.title} ${b.creator} ${b.idea} ${b.language} ${b.year} ${b.categories.join(' ')}`.toLowerCase().includes(search)) && (!category || b.categories.includes(category) || cards.some(c => c.bookId === b.id && c.category === category)) && (!age || b.age === age || cards.some(c => c.bookId === b.id && c.age === age)));
}
