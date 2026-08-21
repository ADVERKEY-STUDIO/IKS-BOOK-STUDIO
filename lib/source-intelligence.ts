export type SourceKind = "searchable" | "scanned" | "mixed" | "damaged";
export type SourceIntelligenceStatus = "uploaded" | "classifying" | "ocr-required" | "reading-contents" | "outline-review" | "ready" | "paused" | "failed";
export type OutlineMode = "parts" | "chapters";

export type SourceOutlineItem = {
  id: string;
  type: "part" | "chapter" | "section";
  title: string;
  sourceStartPage: number;
  sourceEndPage: number;
  confidence: number;
  included: boolean;
  parentId?: string;
};

export type SourceIntelligence = {
  version: 1;
  status: SourceIntelligenceStatus;
  sourceKind: SourceKind;
  totalPages: number;
  fileSizeBytes: number;
  searchablePageRatio: number;
  pagesProcessed: number;
  progress: number;
  message: string;
  structureMode: OutlineMode;
  outline: SourceOutlineItem[];
  ocrEngine?: "cloudflare-ai" | "mistral-ocr";
  ocrCostEstimateUsd?: number;
  cacheKey?: string;
  lastError?: string;
  ocrBatchesTotal?: number;
  ocrBatchesCompleted?: number;
  ocrPagesCached?: number;
  structureRequestCount?: number;
  estimatedNemotronRequests?: number;
  currentBatchLabel?: string;
};

export const SAFE_OCR_CHUNK_BYTES = 3_250_000;
export const SAFE_OCR_CHUNK_PAGES = 4;

function balancedTextSegments(value: string, expectedPages: number) {
  const paragraphs = value.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length < expectedPages) return [];
  const totalLength = paragraphs.reduce((sum, part) => sum + part.length, 0);
  const segments: string[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let remainingLength = totalLength;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const pagesLeft = expectedPages - segments.length;
    const paragraphsLeft = paragraphs.length - index;
    const target = remainingLength / Math.max(1, pagesLeft);
    if (current.length && currentLength + paragraph.length > target && paragraphsLeft >= pagesLeft) {
      segments.push(current.join("\n\n"));
      remainingLength -= currentLength;
      current = [];
      currentLength = 0;
    }
    current.push(paragraph);
    currentLength += paragraph.length;
  }
  if (current.length) segments.push(current.join("\n\n"));
  return segments.length === expectedPages ? segments : [];
}

/** Recover page text from provider output without depending on fragile JSON. */
export function recoverOcrPageTexts(value: string, expectedPages: number) {
  const cleaned = value.trim().replace(/^```(?:text|json)?\s*/i, "").replace(/\s*```$/i, "");
  if (!cleaned || expectedPages < 1) return [];

  const marked = [...cleaned.matchAll(/<<<\s*(?:PDF_?)?PAGE[_\s-]*(\d+)\s*>>>\s*([\s\S]*?)(?=<<<\s*(?:END[_\s-]*)?(?:PDF_?)?PAGE|$)/gi)]
    .map((match) => match[2].replace(/<<<\s*END[_\s-]*(?:PDF_?)?PAGE[^>]*>>>/gi, "").trim())
    .filter(Boolean);
  if (marked.length === expectedPages) return marked;

  const formFeedPages = cleaned.split(/\f+/).map((part) => part.trim()).filter(Boolean);
  if (formFeedPages.length === expectedPages) return formFeedPages;

  const jsonTexts = [...cleaned.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/g)].flatMap((match) => {
    try { return [JSON.parse(`"${match[1]}"`) as string]; } catch { return []; }
  });
  if (jsonTexts.length === expectedPages) return jsonTexts;

  const labelled = cleaned.split(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:PDF\s+)?PAGE\s+\d+\s*[:.-]?\s*/gim).map((part) => part.trim()).filter(Boolean);
  if (labelled.length === expectedPages) return labelled;

  // Last-resort recovery is only used for genuine plain OCR text. It preserves
  // paragraph order and never applies to a visibly truncated JSON response.
  if (!/^\s*[\[{]/.test(cleaned)) return balancedTextSegments(cleaned, expectedPages);
  return [];
}

export function classifySource(pageTexts: string[], totalPages = pageTexts.length): { sourceKind: SourceKind; searchablePageRatio: number } {
  if (!totalPages) return { sourceKind: "damaged", searchablePageRatio: 0 };
  const sampled = pageTexts.filter((_, index) => index < 12 || index % Math.max(1, Math.floor(totalPages / 12)) === 0);
  const readable = sampled.filter((page) => (page.match(/[\p{L}\p{N}]/gu) ?? []).length >= 80).length;
  const ratio = sampled.length ? readable / sampled.length : 0;
  if (ratio >= .8) return { sourceKind: "searchable", searchablePageRatio: ratio };
  if (ratio <= .08) return { sourceKind: "scanned", searchablePageRatio: ratio };
  if (ratio >= .2) return { sourceKind: "mixed", searchablePageRatio: ratio };
  return { sourceKind: "damaged", searchablePageRatio: ratio };
}

export function pdfChunkRanges(totalPages: number, pagesPerChunk = 16) {
  const ranges: Array<{ startPage: number; endPage: number; index: number }> = [];
  for (let startPage = 1, index = 0; startPage <= totalPages; startPage += pagesPerChunk, index += 1) {
    ranges.push({ startPage, endPage: Math.min(totalPages, startPage + pagesPerChunk - 1), index });
  }
  return ranges;
}

export function validateOutline(items: SourceOutlineItem[], totalPages: number) {
  const cleaned = items
    .map((item, index) => ({
      ...item,
      id: item.id || `outline-${index + 1}`,
      title: String(item.title || "").replace(/\s+/g, " ").trim(),
      sourceStartPage: Math.round(Number(item.sourceStartPage)),
      sourceEndPage: Math.round(Number(item.sourceEndPage)),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      included: item.included !== false,
    }))
    .filter((item) => item.title.length >= 2 && item.sourceStartPage >= 1 && item.sourceEndPage >= item.sourceStartPage && item.sourceEndPage <= totalPages)
    .sort((a, b) => a.sourceStartPage - b.sourceStartPage || a.sourceEndPage - b.sourceEndPage);
  const errors: string[] = [];
  if (!cleaned.length) errors.push("No valid Parts or chapters were found.");
  if (cleaned.some((item, index) => index > 0 && item.sourceStartPage < cleaned[index - 1].sourceStartPage)) errors.push("Source ranges are not in reading order.");
  if (cleaned.some((item) => /^(opening chapter|core ideas|applications and examples|closing reflections)$/i.test(item.title))) errors.push("Generic fallback headings are not accepted as a source outline.");
  return { outline: cleaned, errors };
}

export function outlineForMode(items: SourceOutlineItem[], mode: OutlineMode) {
  if (mode === "parts") {
    const parts = items.filter((item) => item.type === "part");
    return parts.length ? parts : items.filter((item) => !item.parentId);
  }
  const chapters = items.filter((item) => item.type === "chapter");
  return chapters.length ? chapters : items.filter((item) => item.type !== "section");
}

export function ocrEstimate(totalPages: number) {
  return Math.round(totalPages * .002 * 100) / 100;
}
