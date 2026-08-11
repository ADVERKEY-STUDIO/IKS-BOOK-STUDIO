import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const planner = await readFile(new URL("../lib/adaptation-pages.ts", import.meta.url), "utf8");

test("complete adaptations use 100 pages as a ceiling, not a target", () => {
  assert.doesNotMatch(page, /Maximum book length/);
  assert.doesNotMatch(page, /OUTPUT LIMIT/);
  assert.doesNotMatch(page, /project\.maxPages/);
  assert.match(planner, /TOTAL_BOOK_PAGE_LIMIT = 100/);
  assert.match(planner, /FIXED_MATTER_PAGES = 8/);
  assert.match(planner, /CHAPTER_PAGE_BUDGET = TOTAL_BOOK_PAGE_LIMIT - FIXED_MATTER_PAGES/);
  assert.match(page, /NATURAL LENGTH · 100-PAGE CEILING/);
  assert.match(page, /fitChaptersToBookLimit/);
  assert.match(page, /LENGTH GUARDRAIL/);
  assert.match(page, /never treats 100 as a target/);
});

test("chapter edits cannot push the total above the book limit", () => {
  assert.match(page, /maximumChapterPages/);
  assert.match(page, /setChapterPagesWithinLimit/);
  assert.match(page, /max=\{maximumChapterPages\(project\.chapters, index\)\}/);
  assert.match(page, /plannedPages > TOTAL_BOOK_PAGE_LIMIT/);
});
