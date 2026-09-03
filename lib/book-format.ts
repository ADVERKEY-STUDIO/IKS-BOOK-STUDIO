export type BookFormatId = "7x10" | "a4" | "a5" | "6x9";

export type BookFormatDefinition = {
  id: BookFormatId;
  label: string;
  sizeLabel: string;
  description: string;
  widthMm: number;
  heightMm: number;
  screenWidthPx: number;
  screenHeightPx: number;
  marginMm: number;
};

export const DEFAULT_NEW_BOOK_FORMAT: BookFormatId = "7x10";
export const LEGACY_BOOK_FORMAT: BookFormatId = "a4";
export const BOOK_SCREEN_PX_PER_MM = 794 / 210;

const formatSeed: Array<Omit<BookFormatDefinition, "screenWidthPx" | "screenHeightPx">> = [
  { id: "7x10", label: "7 × 10 in", sizeLabel: "177.8 × 254 mm", description: "Best all-round size for this illustrated educational book.", widthMm: 177.8, heightMm: 254, marginMm: 15.5 },
  { id: "a4", label: "A4", sizeLabel: "210 × 297 mm", description: "Large workbook and classroom handout format.", widthMm: 210, heightMm: 297, marginMm: 16 },
  { id: "a5", label: "A5", sizeLabel: "148 × 210 mm", description: "Compact reader; creates more pages and needs careful image review.", widthMm: 148, heightMm: 210, marginMm: 14 },
  { id: "6x9", label: "6 × 9 in", sizeLabel: "152.4 × 228.6 mm", description: "Traditional trade-book size for text-led editions.", widthMm: 152.4, heightMm: 228.6, marginMm: 14.5 },
];

export const BOOK_FORMATS: readonly BookFormatDefinition[] = formatSeed.map((format) => ({
  ...format,
  screenWidthPx: Math.round(format.widthMm * BOOK_SCREEN_PX_PER_MM),
  screenHeightPx: Math.round(format.heightMm * BOOK_SCREEN_PX_PER_MM),
}));

export function isBookFormatId(value: unknown): value is BookFormatId {
  return BOOK_FORMATS.some((format) => format.id === value);
}

export function bookFormat(value: unknown, fallback: BookFormatId = LEGACY_BOOK_FORMAT) {
  const id = isBookFormatId(value) ? value : fallback;
  return BOOK_FORMATS.find((format) => format.id === id)!;
}

export function bookFormatCssVariables(value: unknown) {
  const format = bookFormat(value);
  return {
    "--book-page-width": `${format.screenWidthPx}px`,
    "--book-page-height": `${format.screenHeightPx}px`,
    "--book-page-ratio": `${format.widthMm} / ${format.heightMm}`,
  } as const;
}

export function bookFormatCapacityRatio(value: unknown) {
  const selected = bookFormat(value);
  const legacy = bookFormat(LEGACY_BOOK_FORMAT);
  const printableArea = (format: BookFormatDefinition) =>
    Math.max(1, format.widthMm - format.marginMm * 2) * Math.max(1, format.heightMm - format.marginMm * 2);
  return printableArea(selected) / printableArea(legacy);
}

export type BookImageMetric = {
  id: string;
  effectiveDpi: number;
  alt: string;
};

export type BookPageMetric = {
  slotId: string;
  label: string;
  kind: "cover" | "contents" | "chapter" | "back" | "custom";
  chapterId?: number;
  pageIndex?: number;
  chapterPageCount?: number;
  fillRatio: number;
  overflowX: boolean;
  overflowY: boolean;
  intentionalBlank?: boolean;
  layoutLocked?: boolean;
  illustrationOnly?: boolean;
  images?: BookImageMetric[];
};

export type BookFormatIssue = {
  slotId: string;
  label: string;
  message: string;
};

export type BookFormatPreviewResult = {
  format: BookFormatDefinition;
  pageCount: number;
  pages: BookPageMetric[];
  overflowIssues: BookFormatIssue[];
  underflowIssues: BookFormatIssue[];
  imageIssues: BookFormatIssue[];
  contentsEntries: number;
  publicationReady: boolean;
};

export function assessBookFormatPreview(
  formatId: unknown,
  pages: BookPageMetric[],
  contentsEntries: number,
): BookFormatPreviewResult {
  const overflowIssues = pages
    .filter((page) => page.overflowX || page.overflowY)
    .map((page) => ({ slotId: page.slotId, label: page.label, message: `${page.label} crosses the printable page boundary.` }));
  const underflowIssues = pages
    .filter((page) => {
      if (page.kind !== "chapter" || page.intentionalBlank || page.layoutLocked || page.illustrationOnly) return false;
      const index = page.pageIndex ?? 0;
      const count = page.chapterPageCount ?? 1;
      return count > 2 && index > 0 && index < count - 1 && page.fillRatio < .55;
    })
    .map((page) => ({ slotId: page.slotId, label: page.label, message: `${page.label} is unusually sparse for a middle chapter page.` }));
  const imageIssues = pages.flatMap((page) => (page.images ?? []).flatMap((image) => {
    const issues: BookFormatIssue[] = [];
    if (!image.alt.trim()) issues.push({ slotId: page.slotId, label: page.label, message: `${page.label} has an image without alternative text.` });
    if (image.effectiveDpi > 0 && image.effectiveDpi < 240) issues.push({ slotId: page.slotId, label: page.label, message: `${page.label} has an image below 240 DPI at this print size.` });
    return issues;
  }));
  return {
    format: bookFormat(formatId),
    pageCount: pages.length,
    pages,
    overflowIssues,
    underflowIssues,
    imageIssues,
    contentsEntries,
    // Layout defects remain visible quality warnings, but must not trap the
    // author in the editor. The publication PDF remains available for review.
    publicationReady: true,
  };
}
