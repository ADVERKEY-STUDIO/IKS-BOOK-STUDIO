import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("complete adaptations stay within 100 pages", () => {
  assert.doesNotMatch(page, /Maximum book length/);
  assert.doesNotMatch(page, /OUTPUT LIMIT/);
  assert.doesNotMatch(page, /project\.maxPages/);
  assert.match(page, /TOTAL_BOOK_PAGE_LIMIT = 100/);
  assert.match(page, /FIXED_MATTER_PAGES = 8/);
  assert.match(page, /CHAPTER_PAGE_BUDGET = TOTAL_BOOK_PAGE_LIMIT - FIXED_MATTER_PAGES/);
  assert.match(page, /UP TO 100 PAGES/);
  assert.match(page, /fitChaptersToBookLimit/);
  assert.match(page, /100-PAGE BOOK LIMIT/);
});

test("chapter edits cannot push the total above the book limit", () => {
  assert.match(page, /maximumChapterPages/);
  assert.match(page, /setChapterPagesWithinLimit/);
  assert.match(page, /max=\{maximumChapterPages\(project\.chapters, index\)\}/);
  assert.match(page, /plannedPages > TOTAL_BOOK_PAGE_LIMIT/);
});
