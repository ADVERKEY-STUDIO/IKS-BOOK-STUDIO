export const BOOK_PACKAGE_FORMAT = "iks-book-package-v1";

export type BookPackageImage = {
  fileName: string;
  caption?: string;
  alt?: string;
};

export type BookPackagePage = {
  pageId: string;
  pageNumber: number;
  purpose: string;
  text: string;
  image?: BookPackageImage;
};

export type BookPackageChapter = {
  chapterId: string;
  chapterNumber: number;
  title: string;
  contextKey: string;
  pages: BookPackagePage[];
};

export type BookPackage = {
  format: typeof BOOK_PACKAGE_FORMAT;
  bookTitle: string;
  audience: string;
  chapters: BookPackageChapter[];
};

export type PlannedChapter = { id: number; title: string };

export type BookPackageValidation = {
  package: BookPackage | null;
  errors: string[];
  warnings: string[];
  chapterCount: number;
  pageCount: number;
  imageNames: string[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function expectedChapterId(chapterNumber: number) {
  return `chapter-${String(chapterNumber).padStart(2, "0")}`;
}

export function expectedPageId(chapterNumber: number, pageNumber: number) {
  return `${expectedChapterId(chapterNumber)}-page-${String(pageNumber).padStart(2, "0")}`;
}

export function expectedContextKey(chapterNumber: number, title: string) {
  return `${expectedChapterId(chapterNumber)}|${normalized(title).replace(/\s+/g, "-")}`;
}

export function validateBookPackage(input: unknown, plannedChapters: PlannedChapter[], audience: string): BookPackageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (raw.format !== BOOK_PACKAGE_FORMAT) errors.push(`Package format must be ${BOOK_PACKAGE_FORMAT}.`);
  if (typeof raw.bookTitle !== "string" || !raw.bookTitle.trim()) errors.push("The package needs a bookTitle.");
  if (raw.audience !== audience) errors.push(`The package audience must exactly match ${audience}.`);
  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) errors.push("The package needs at least one chapter.");

  const chapters = Array.isArray(raw.chapters) ? raw.chapters as Array<Record<string, unknown>> : [];
  if (plannedChapters.length && chapters.length !== plannedChapters.length) {
    errors.push(`The package has ${chapters.length} chapters, but this book plan has ${plannedChapters.length}.`);
  }

  const imageNames: string[] = [];
  const seenChapterIds = new Set<string>();
  const seenPageIds = new Set<string>();
  const seenText = new Map<string, string>();
  let pageCount = 0;

  chapters.forEach((chapter, chapterIndex) => {
    const number = Number(chapter.chapterNumber);
    const planned = plannedChapters[chapterIndex];
    const chapterId = String(chapter.chapterId || "");
    const title = String(chapter.title || "").trim();
    const contextKey = String(chapter.contextKey || "");
    if (number !== chapterIndex + 1) errors.push(`Chapter ${chapterIndex + 1} is out of order.`);
    if (chapterId !== expectedChapterId(number)) errors.push(`Chapter ${number || chapterIndex + 1} must use ID ${expectedChapterId(number || chapterIndex + 1)}.`);
    if (seenChapterIds.has(chapterId)) errors.push(`Duplicate chapter ID: ${chapterId}.`);
    seenChapterIds.add(chapterId);
    if (planned && (planned.id !== number || normalized(planned.title) !== normalized(title))) {
      errors.push(`Chapter ${number || chapterIndex + 1} does not match the approved plan title “${planned.title}”.`);
    }
    const correctContextKey = expectedContextKey(number, title);
    if (contextKey !== correctContextKey) errors.push(`Chapter ${number || chapterIndex + 1} has an invalid contextKey.`);

    const pages = Array.isArray(chapter.pages) ? chapter.pages as Array<Record<string, unknown>> : [];
    if (!pages.length) errors.push(`Chapter ${number || chapterIndex + 1} has no pages.`);
    pages.forEach((page, pageIndex) => {
      pageCount += 1;
      const pageNumber = Number(page.pageNumber);
      const pageId = String(page.pageId || "");
      const expectedId = expectedPageId(number, pageIndex + 1);
      const text = String(page.text || "").trim();
      if (pageNumber !== pageIndex + 1 || pageId !== expectedId) errors.push(`${chapterId || `Chapter ${number}`}, page ${pageIndex + 1} must use ID ${expectedId}.`);
      if (seenPageIds.has(pageId)) errors.push(`Duplicate page ID: ${pageId}.`);
      seenPageIds.add(pageId);
      if (!String(page.purpose || "").trim()) errors.push(`${expectedId} needs a clear page purpose.`);
      if (!text) errors.push(`${expectedId} has no text.`);
      if (/\b(?:replace this|placeholder|lorem ipsum|state this page|final reader-facing text)\b/i.test(text)) {
        errors.push(`${expectedId} still contains template or placeholder text.`);
      }
      const signature = normalized(text).split(/\s+/).slice(0, 45).join(" ");
      if (signature.length > 120) {
        const previous = seenText.get(signature);
        if (previous) errors.push(`${expectedId} repeats substantial text already used in ${previous}.`);
        else seenText.set(signature, expectedId);
      }
      const image = page.image && typeof page.image === "object" ? page.image as Record<string, unknown> : null;
      if (image) {
        const fileName = String(image.fileName || "").trim();
        if (!fileName) errors.push(`${expectedId} has an image without a fileName.`);
        else {
          if (!normalized(fileName).startsWith(normalized(chapterId))) errors.push(`${fileName} is not named for ${chapterId}; the image could be attached to the wrong chapter.`);
          if (imageNames.includes(fileName)) errors.push(`Image file ${fileName} is used more than once.`);
          imageNames.push(fileName);
        }
      }
    });
  });

  if (pageCount + 8 > 100) errors.push(`The package has ${pageCount + 8} total pages including front/back matter, above the 100-page ceiling.`);
  if (!imageNames.length) warnings.push("No page images are listed in the package.");

  return {
    package: errors.length ? null : raw as unknown as BookPackage,
    errors,
    warnings,
    chapterCount: chapters.length,
    pageCount,
    imageNames,
  };
}
