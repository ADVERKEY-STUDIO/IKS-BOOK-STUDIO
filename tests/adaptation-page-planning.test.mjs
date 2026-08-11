import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

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
  assert.match(page, /chapters upgraded with context-aware page recommendations/);
  assert.doesNotMatch(page, /headings\.map\(\(title, index\) => \(\{ id: index \+ 1, title, pages: 6/);
});

test("recommendations change with context and child age instead of repeating one number", () => {
  assert.match(worker, /recommendedAdaptationPages/);
  assert.match(worker, /sourceWordCount \* age\.transformationRatio/);
  assert.match(worker, /complexityAllowance/);
  assert.match(worker, /visualAndActivityPages/);
  assert.match(page, /applyAutomaticAdaptationPlan/);
  assert.match(page, /"audience" in patch && !current\.adaptationPlanConfirmed/);
  assert.match(page, /RECOMMENDED/);
  assert.match(page, /↻ Recalculate/);
});

test("source-aware recommendations are proportionally fitted into a 100-page book", () => {
  assert.match(worker, /TOTAL_BOOK_PAGE_LIMIT = 100/);
  assert.match(worker, /CHAPTER_PAGE_BUDGET = TOTAL_BOOK_PAGE_LIMIT - FIXED_MATTER_PAGES/);
  assert.match(worker, /allocatePagesWithinBudget/);
  assert.match(worker, /rawPlans\.map\(\(plan, index\)/);
  assert.match(worker, /Rebalanced proportionally so the complete book stays within 100 pages/);
  assert.match(page, /92 chapter pages are shared proportionally/);
  assert.match(page, /applyAutomaticAdaptationPlan\(sourceChapters, project\.audience, true\)/);
});

test("the full chapter builder uses the detected source range and the planned adaptation length", () => {
  assert.match(worker, /chapter\.sourceStartPage/);
  assert.match(worker, /chapter\.sourceEndPage/);
  assert.match(worker, /chapter\.pages \* reading\.wordsPerPage \* \.9/);
  assert.doesNotMatch(worker, /Math\.min\(1900/);
  assert.match(page, /sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore/);
});

test("the interface explicitly distinguishes adaptation from summarisation", () => {
  assert.match(page, /This is not a summary plan/);
  assert.match(page, /ADAPTATION, NOT SUMMARY/);
  assert.match(page, /Confirm adaptation plan/);
  assert.doesNotMatch(page, /Chapter and summary-page plan/);
});
