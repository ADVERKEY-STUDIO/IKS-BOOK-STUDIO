export type PublicationChapter = {
  id: number;
  title: string;
  pages?: number;
  body?: string;
  importedPages?: Array<{ body?: string; imageUrl?: string; imageCaption?: string; imageAlt?: string }>;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
  visualType?: string;
  importValidated?: boolean;
  manualApproved?: boolean;
  pedagogyQuality?: { status?: string };
  generationStatus?: string;
};

export type ContentsEntry = {
  chapterId: number;
  ordinal: number;
  title: string;
  pageCount: number;
  startPage: number;
};

export type PublicationBlocker = {
  code: "chapter-unapproved" | "missing-illustration" | "private-production-text" | "reader-provenance";
  chapterId: number;
  chapterTitle: string;
  message: string;
};

export function pdfRasterSettings(pageCount: number, mode: "draft" | "publication") {
  const pages = Math.max(1, Math.floor(pageCount));
  if (pages >= 60) return mode === "draft"
    ? { scale: 1.45, quality: 0.78 }
    : { scale: 1.7, quality: 0.84 };
  if (pages >= 30) return mode === "draft"
    ? { scale: 1.55, quality: 0.8 }
    : { scale: 2, quality: 0.87 };
  return mode === "draft"
    ? { scale: 1.7, quality: 0.84 }
    : { scale: 2.5, quality: 0.92 };
}

const privateProductionText = /(?:^\s*PRIVATE\s*[—–:-]|[([]\s*PRIVATE(?:\s+(?:PAGE\s+\d+|MATERIAL\s+CONTINUES)|\s*[\]—–:-]))|\b(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|ILLUSTRATION BRIEF|ILLUSTRATION PENDING|SOURCE COVERAGE NOTES?|CHAPTER IN PROGRESS|DESIGNER HANDOFF|RESERVED FOR FINAL HUMAN DEVELOPMENT)\b|\b[\w-]+\.md\s*:\s*\d+\s+words?\b/i;
const privateProductionHeading = /<h[1-6][^>]*>\s*(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|DELIVERY MANIFEST|MANUSCRIPT PACKAGE NOTES?)\s*<\/h[1-6]>/i;
const readerProvenanceText = /\bthe subject\b|\b(?:the|this|your|uploaded|original) (?:source|document|adaptation)\b|\baccording to (?:the|this) source\b/i;

export function chapterRequiresIllustration(chapter: Pick<PublicationChapter, "title">) {
  return !/^(?:glossary|appendix|activities|references|bibliography|index)\b/i.test(chapter.title.trim());
}

export function sanitizeReaderHtml(value: string) {
  const withoutTaggedBlocks = value
    .replace(/<!--\s*(?:internal|manifest):start\s*-->[\s\S]*?<!--\s*(?:internal|manifest):end\s*-->/gi, "")
    .replace(/<([a-z][\w-]*)\b[^>]*\bdata-publication=["'](?:internal|manifest)["'][^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<([a-z][\w-]*)\b[^>]*\bclass=["'][^"']*\b(?:manifest-page|internal-only|production-only)\b[^"']*["'][^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const match = privateProductionHeading.exec(withoutTaggedBlocks);
  return sanitizeReaderImageHtml(match ? withoutTaggedBlocks.slice(0, match.index) : withoutTaggedBlocks).trim();
}

function readerPlainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(lbrack|#0*91|#x0*5b);/gi, "[")
    .replace(/&(rbrack|#0*93|#x0*5d);/gi, "]")
    .replace(/&(?:nbsp|ensp|emsp);/gi, " ")
    .replace(/&(?:mdash|#0*8212|#x0*2014);/gi, "—")
    .replace(/&(?:ndash|#0*8211|#x0*2013);/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/** A scene-generation brief is production data, never a printed caption. */
export function readerSafeImageCaption(value: string | null | undefined, fallback = "") {
  const caption = readerPlainText(value ?? "");
  if (caption && !privateProductionText.test(caption)) return caption;
  const safeFallback = readerPlainText(fallback);
  return safeFallback && !privateProductionText.test(safeFallback) ? safeFallback : "";
}

/** Remove private captions and alt text from old saved page HTML without
 * touching image position, dimensions, wrapping, or any other authored HTML. */
export function sanitizeReaderImageHtml(value: string) {
  if (!value || !/(?:figcaption|\balt\s*=)/i.test(value)) return value;
  return value
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption\s*>/gi, (tag, caption: string) => readerSafeImageCaption(caption) ? tag : "")
    .replace(/\salt=(['"])([\s\S]*?)\1/gi, (attribute, quote: string, alt: string) => readerSafeImageCaption(alt) ? attribute : ` alt=${quote}Book illustration${quote}`);
}

export function paginateContents(
  chapters: Array<Pick<PublicationChapter, "id" | "title" | "pages">>,
  renderedPageCounts: ReadonlyMap<number, number> = new Map(),
  entriesPerPage = 15,
) {
  if (!Number.isInteger(entriesPerPage) || entriesPerPage < 1) throw new RangeError("entriesPerPage must be a positive integer");
  let nextStartPage = 1;
  const entries: ContentsEntry[] = chapters.map((chapter, index) => {
    const pageCount = Math.max(1, renderedPageCounts.get(chapter.id) ?? chapter.pages ?? 1);
    const entry = { chapterId: chapter.id, ordinal: index + 1, title: chapter.title, pageCount, startPage: nextStartPage };
    nextStartPage += pageCount;
    return entry;
  });
  const pages: ContentsEntry[][] = [];
  for (let index = 0; index < entries.length; index += entriesPerPage) pages.push(entries.slice(index, index + entriesPerPage));
  return pages.length ? pages : [[]];
}

export function assessPublication(chapters: PublicationChapter[]) {
  const blockers: PublicationBlocker[] = [];
  for (const chapter of chapters) {
    const approved = Boolean(
      chapter.importValidated
      || chapter.manualApproved
      || chapter.pedagogyQuality?.status === "passed"
      || chapter.generationStatus === "Designer handoff",
    );
    if (!approved) blockers.push({
      code: "chapter-unapproved",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} has not passed editorial review.`,
    });
    const hasIllustration = Boolean(chapter.imageUrl || chapter.importedPages?.some((page) => page.imageUrl));
    if (chapterRequiresIllustration(chapter) && (!hasIllustration || chapter.visualType === "illustration-pending")) blockers.push({
      code: "missing-illustration",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} still needs its required illustration.`,
    });
    const readerText = [
      chapter.body ?? "",
      chapter.imageCaption ?? "",
      chapter.imageAlt ?? "",
      ...(chapter.importedPages ?? []).flatMap((page) => [page.body ?? "", page.imageCaption ?? "", page.imageAlt ?? ""]),
    ].join(" ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
    if (privateProductionText.test(readerText)) blockers.push({
      code: "private-production-text",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} contains private production or placeholder text.`,
    });
    if (readerProvenanceText.test(readerText)) blockers.push({
      code: "reader-provenance",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} still contains source-workflow language that must be rewritten directly.`,
    });
  }
  return { ready: blockers.length === 0, blockers };
}

export function hasPrivateProductionText(value: string) {
  return privateProductionText.test(readerPlainText(value));
}
