export type PublicationChapter = {
  id: number;
  title: string;
  pages?: number;
  body?: string;
  importedPages?: Array<{ body?: string; imageUrl?: string }>;
  imageUrl?: string;
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

const privateProductionText = /\b(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|ILLUSTRATION PENDING|CHAPTER IN PROGRESS|DESIGNER HANDOFF|RESERVED FOR FINAL HUMAN DEVELOPMENT)\b|\b[\w-]+\.md\s*:\s*\d+\s+words?\b/i;
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
  return (match ? withoutTaggedBlocks.slice(0, match.index) : withoutTaggedBlocks).trim();
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
    const readerText = [chapter.body ?? "", ...(chapter.importedPages ?? []).map((page) => page.body ?? "")].join(" ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
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
  return privateProductionText.test(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}
