export type PublicationChapter = {
  id: number;
  title: string;
  pages?: number;
  body?: string;
  importedPages?: Array<{ body?: string }>;
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
};

export type PublicationBlocker = {
  code: "chapter-unapproved" | "missing-illustration" | "private-production-text";
  chapterId: number;
  chapterTitle: string;
  message: string;
};

const privateProductionText = /\b(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|ILLUSTRATION PENDING|CHAPTER IN PROGRESS|DESIGNER HANDOFF|RESERVED FOR FINAL HUMAN DEVELOPMENT)\b|\b[\w-]+\.md\s*:\s*\d+\s+words?\b/i;
const privateProductionHeading = /<h[1-6][^>]*>\s*(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|DELIVERY MANIFEST|MANUSCRIPT PACKAGE NOTES?)\s*<\/h[1-6]>/i;

export function sanitizeReaderHtml(value: string) {
  const match = privateProductionHeading.exec(value);
  return (match ? value.slice(0, match.index) : value).trim();
}

export function paginateContents(
  chapters: Array<Pick<PublicationChapter, "id" | "title" | "pages">>,
  renderedPageCounts: ReadonlyMap<number, number> = new Map(),
  entriesPerPage = 15,
) {
  if (!Number.isInteger(entriesPerPage) || entriesPerPage < 1) throw new RangeError("entriesPerPage must be a positive integer");
  const entries: ContentsEntry[] = chapters.map((chapter, index) => ({
    chapterId: chapter.id,
    ordinal: index + 1,
    title: chapter.title,
    pageCount: Math.max(1, renderedPageCounts.get(chapter.id) ?? chapter.pages ?? 1),
  }));
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
    if (chapter.visualType === "illustration-pending" && !chapter.imageUrl) blockers.push({
      code: "missing-illustration",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} still needs its illustration or an explicit skip decision.`,
    });
    const readerText = [chapter.body ?? "", ...(chapter.importedPages ?? []).map((page) => page.body ?? "")].join(" ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
    if (privateProductionText.test(readerText)) blockers.push({
      code: "private-production-text",
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      message: `${chapter.title} contains private production or placeholder text.`,
    });
  }
  return { ready: blockers.length === 0, blockers };
}

export function hasPrivateProductionText(value: string) {
  return privateProductionText.test(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}
