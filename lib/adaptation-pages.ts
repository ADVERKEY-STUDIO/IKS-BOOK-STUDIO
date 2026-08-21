export const ADAPTATION_PLAN_VERSION = 2;
export const TOTAL_BOOK_PAGE_LIMIT = 100;
export const FIXED_MATTER_PAGES = 8;
export const CHAPTER_PAGE_BUDGET = TOTAL_BOOK_PAGE_LIMIT - FIXED_MATTER_PAGES;

export type AdaptationPageInputs = {
  title: string;
  sourcePageCount?: number;
  sourceWordCount?: number;
  complexityScore?: number;
  keyTerms?: string[];
};

function ageLengthProfile(audience: string) {
  if (/7\s*[–-]\s*9/i.test(audience)) {
    return { minimumPages: 2, maximumPages: 5, fallbackPages: 3, base: 1.2, sourceWordsPerStep: 4500, breadthWeight: 1.3, breadthCap: 2, spanWeight: .25, spanCap: .7, complexityWeight: 1.1, conceptWeight: .75 };
  }
  if (/13\s*[–-]\s*15/i.test(audience)) {
    return { minimumPages: 3, maximumPages: 8, fallbackPages: 5, base: 1.8, sourceWordsPerStep: 3500, breadthWeight: 1.5, breadthCap: 3, spanWeight: .3, spanCap: 1, complexityWeight: 1.7, conceptWeight: 1 };
  }
  return { minimumPages: 2, maximumPages: 6, fallbackPages: 4, base: 1.5, sourceWordsPerStep: 4000, breadthWeight: 1.35, breadthCap: 2.3, spanWeight: .28, spanCap: .8, complexityWeight: 1.4, conceptWeight: .8 };
}

/**
 * Estimates the shortest comfortable treatment of a chapter for the selected
 * child reader. Source length is deliberately logarithmic: a long source gives
 * the planner more evidence to select from, but it does not force the adaptation
 * to reproduce a percentage of every source word.
 */
export function recommendedAdaptationPages(chapter: AdaptationPageInputs, audience = "Ages 10–12") {
  const profile = ageLengthProfile(audience);
  if (!chapter.sourceWordCount || !chapter.sourcePageCount) return profile.fallbackPages;

  const breadth = Math.min(profile.breadthCap, Math.log2(1 + chapter.sourceWordCount / profile.sourceWordsPerStep) * profile.breadthWeight);
  const sourceSpan = Math.min(profile.spanCap, Math.log2(1 + chapter.sourcePageCount / 8) * profile.spanWeight);
  const complexity = Math.max(0, Math.min(1, chapter.complexityScore ?? .4)) * profile.complexityWeight;
  const concepts = Math.min(1, (chapter.keyTerms?.length ?? 3) / 5) * profile.conceptWeight;
  const isReferenceMatter = /^(appendix|references?|bibliography|glossary|index)\b/i.test(chapter.title);
  const isClosingChapter = /^(conclusion|epilogue|upasaṃhāra)\b/i.test(chapter.title);
  const sectionFactor = isReferenceMatter ? .55 : isClosingChapter ? .68 : 1;
  const naturalLength = Math.round((profile.base + breadth + sourceSpan + complexity + concepts) * sectionFactor);

  return Math.max(profile.minimumPages, Math.min(profile.maximumPages, naturalLength));
}

/**
 * The 100-page rule is a ceiling only. Plans below it are returned unchanged;
 * only an oversized plan is reduced to fit the safety limit.
 */
export function allocatePagesWithinBudget(weights: number[], budget = CHAPTER_PAGE_BUDGET) {
  const requested = weights.map((weight) => Math.max(1, Math.round(Number.isFinite(weight) ? weight : 1)));
  const requestedTotal = requested.reduce((sum, value) => sum + value, 0);
  if (!requested.length || requestedTotal <= budget) return requested;

  const minimumPages = requested.length;
  const distributable = Math.max(0, budget - minimumPages);
  const weightTotal = requested.reduce((sum, value) => sum + value, 0) || requested.length;
  const exactExtras = requested.map((weight) => distributable * weight / weightTotal);
  const allocated = exactExtras.map((extra) => 1 + Math.floor(extra));
  let remaining = budget - allocated.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exactExtras
    .map((extra, index) => ({ index, remainder: extra - Math.floor(extra) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let cursor = 0; remaining > 0 && remainderOrder.length; cursor += 1, remaining -= 1) {
    allocated[remainderOrder[cursor % remainderOrder.length].index] += 1;
  }
  return allocated;
}
