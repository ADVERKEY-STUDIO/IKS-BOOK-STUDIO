import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const planner = await readFile(new URL("../lib/adaptation-pages.ts", import.meta.url), "utf8");
const { allocatePagesWithinBudget, recommendedAdaptationPages } = await import(new URL("../lib/adaptation-pages.ts", import.meta.url));

test("source upload analyses every chapter before assigning adaptation pages", () => {
  assert.match(worker, /function chapterContextPlans/);
  assert.match(worker, /sourceStartPage/);
  assert.match(worker, /sourceEndPage/);
  assert.match(worker, /sourceWordCount/);
  assert.match(worker, /complexityScore/);
  assert.match(worker, /keyTerms/);
  assert.match(worker, /chapterPlans/);
  assert.match(page, /chapterFromContextPlan/);
  assert.match(page, /const needsContextPlan = Boolean\(next\.sourceObjectKey\)/);
  assert.match(page, /chapters replanned at their shortest clear length/);
  assert.doesNotMatch(page, /headings\.map\(\(title, index\) => \(\{ id: index \+ 1, title, pages: 6/);
});

test("recommendations change with context and child age instead of repeating one number", () => {
  assert.match(worker, /recommendedAdaptationPages/);
  assert.match(planner, /Math\.log2\(1 \+ chapter\.sourceWordCount/);
  assert.match(planner, /complexityWeight/);
  assert.match(planner, /conceptWeight/);
  assert.match(page, /applyAutomaticAdaptationPlan/);
  assert.match(page, /"audience" in patch && !current\.adaptationPlanConfirmed/);
  assert.match(page, /RECOMMENDED/);
  assert.match(page, /↻ Recalculate/);

  const chapter = { title: "Living systems", sourcePageCount: 32, sourceWordCount: 11000, complexityScore: .72, keyTerms: ["system", "parts", "change", "balance", "evidence"] };
  const early = recommendedAdaptationPages(chapter, "Ages 7–9");
  const middle = recommendedAdaptationPages(chapter, "Ages 10–12");
  const teen = recommendedAdaptationPages(chapter, "Ages 13–15");
  assert.ok(early >= 2 && early <= 5);
  assert.ok(middle >= 2 && middle <= 6);
  assert.ok(teen >= 3 && teen <= 8);
  assert.ok(new Set([early, middle, teen]).size > 1);
});

test("100 pages is a ceiling and natural plans are never padded to fill it", () => {
  assert.match(planner, /TOTAL_BOOK_PAGE_LIMIT = 100/);
  assert.match(planner, /CHAPTER_PAGE_BUDGET = TOTAL_BOOK_PAGE_LIMIT - FIXED_MATTER_PAGES/);
  assert.match(planner, /requestedTotal <= budget\) return requested/);
  assert.match(worker, /rawPlans\.map\(\(plan, index\)/);
  assert.match(worker, /Reduced only because the combined plan exceeded the 100-page safety ceiling/);
  assert.match(page, /Pages are not distributed to fill 100/);
  assert.match(page, /applyAutomaticAdaptationPlan\(sourceChapters, project\.audience, true\)/);
  assert.deepEqual(allocatePagesWithinBudget([2, 5, 3]), [2, 5, 3]);
  assert.equal(allocatePagesWithinBudget([50, 50, 50]).reduce((sum, pages) => sum + pages, 0), 92);
});

test("the full chapter builder uses the detected source range and the planned adaptation length", () => {
  assert.match(worker, /chapter\.sourceStartPage/);
  assert.match(worker, /chapter\.sourceEndPage/);
  assert.match(worker, /targetPages: chapter\.pages/);
  assert.match(worker, /chapterSourceMaterial/);
  assert.doesNotMatch(worker, /Math\.max\(520/);
  assert.match(page, /sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore/);
});

test("the interface explicitly distinguishes adaptation from summarisation", () => {
  assert.match(page, /ADAPTATION, NOT SUMMARY/);
  assert.match(page, /shortest clear, age-appropriate adaptation/);
  assert.match(page, /Confirm adaptation plan/);
  assert.doesNotMatch(page, /Chapter and summary-page plan/);
});

test("saved projects are reanalysed when the concise planner version changes", () => {
  assert.match(page, /adaptationPlanVersion/);
  assert.match(page, /next\.adaptationPlanVersion !== ADAPTATION_PLAN_VERSION/);
  assert.match(page, /chapters replanned at their shortest clear length/);
});
