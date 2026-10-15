import type { CatalogueBook } from './iks-catalogue';

export type CatalogueSource = { id: string; title: string; sourceUrl: string; pdfUrl: string; startPage: number; endPage: number };
export function selectedCategoryGroups(books: CatalogueBook[], selected: string[]) {
  const groups = new Map<string, CatalogueBook[]>();
  for (const book of books.filter(b => selected.includes(b.id))) {
    for (const category of new Set(book.categories.filter(Boolean))) {
      groups.set(category, [...(groups.get(category) || []), book]);
    }
  }
  return [...groups].map(([category, books]) => ({ category, books }));
}
export async function prepareCataloguePdf(books: CatalogueBook[], category: string, progress: (message: string) => void, fetcher: typeof fetch = fetch) {
  if (!books.length) throw new Error('Select at least one source book.');
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  const sources: CatalogueSource[] = [];
  let totalBytes = 0;
  for (const [index, book] of books.entries()) {
    progress(`Reading PDF ${index + 1} of ${books.length}: ${book.title}`);
    let blob = book.pdf;
    if (!blob) {
      const response = await fetcher(`/api/catalogue/pdf?id=${encodeURIComponent(book.id)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(`${book.title}: ${error.error || 'PDF download failed. Retry, or attach a downloaded PDF in the catalogue.'}`);
      }
      blob = await response.blob();
    }
    totalBytes += blob.size;
    if (totalBytes > 200 * 1024 * 1024) throw new Error('This group exceeds 200 MB. Select fewer books and prepare another project.');
    if (new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error(`${book.title}: the source is not a PDF. Attach a valid PDF in the catalogue.`);
    const pdf = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
    if (merged.getPageCount() + pdf.getPageCount() > 2500) throw new Error('This group exceeds 2,500 pages. Select fewer books.');
    const startPage = merged.getPageCount() + 1;
    for (const page of await merged.copyPages(pdf, pdf.getPageIndices())) merged.addPage(page);
    sources.push({ id: book.id, title: book.title, sourceUrl: book.sourceUrl, pdfUrl: book.pdfUrl, startPage, endPage: merged.getPageCount() });
  }
  merged.setTitle(category);
  const bytes = await merged.save();
  return { file: new File([bytes.slice().buffer], `${category.replace(/[^\p{L}\p{N} -]/gu, '').slice(0,80)}.pdf`, { type: 'application/pdf' }), sources };
}
