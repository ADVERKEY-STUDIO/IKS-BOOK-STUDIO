import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BOOK_FORMATS,
  DEFAULT_NEW_BOOK_FORMAT,
  LEGACY_BOOK_FORMAT,
  assessBookFormatPreview,
  bookFormat,
  bookFormatCapacityRatio,
} from "../lib/book-format.ts";

test("publishing formats use exact physical dimensions and safe defaults", () => {
  assert.equal(DEFAULT_NEW_BOOK_FORMAT, "7x10");
  assert.equal(LEGACY_BOOK_FORMAT, "a4");
  assert.deepEqual(BOOK_FORMATS.map(({ id }) => id), ["7x10", "a4", "a5", "6x9"]);
  assert.deepEqual([bookFormat("7x10").widthMm, bookFormat("7x10").heightMm], [177.8, 254]);
  assert.deepEqual([bookFormat("6x9").widthMm, bookFormat("6x9").heightMm], [152.4, 228.6]);
  assert.equal(bookFormat(undefined).id, "a4");
  assert.equal(bookFormatCapacityRatio("a4"), 1);
  assert.ok(bookFormatCapacityRatio("7x10") < 1);
  assert.ok(bookFormatCapacityRatio("a5") < bookFormatCapacityRatio("7x10"));
});

test("quality assessment reports layout issues without blocking export", () => {
  const report = assessBookFormatPreview("7x10", [
    { slotId: "cover", label: "Cover", kind: "cover", fillRatio: .2, overflowX: false, overflowY: false },
    { slotId: "chapter-1-page-1", label: "Opening", kind: "chapter", chapterId: 1, pageIndex: 0, chapterPageCount: 4, fillRatio: .3, overflowX: false, overflowY: false },
    { slotId: "chapter-1-page-2", label: "Middle", kind: "chapter", chapterId: 1, pageIndex: 1, chapterPageCount: 4, fillRatio: .4, overflowX: false, overflowY: false, images: [{ id: "image-1", effectiveDpi: 180, alt: "" }] },
    { slotId: "chapter-1-page-3", label: "Overflow", kind: "chapter", chapterId: 1, pageIndex: 2, chapterPageCount: 4, fillRatio: 1.1, overflowX: false, overflowY: true },
    { slotId: "chapter-1-page-4", label: "Ending", kind: "chapter", chapterId: 1, pageIndex: 3, chapterPageCount: 4, fillRatio: .2, overflowX: false, overflowY: false },
  ], 1);
  assert.equal(report.pageCount, 5);
  assert.equal(report.underflowIssues.length, 1);
  assert.equal(report.overflowIssues.length, 1);
  assert.equal(report.imageIssues.length, 2);
  assert.equal(report.publicationReady, true);
});

test("Designer, Preview and PDF share the selected format while legacy books remain A4", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /bookFormat: DEFAULT_NEW_BOOK_FORMAT/);
  assert.match(page, /isBookFormatId\(cleanSaved\.bookFormat\) \? cleanSaved\.bookFormat : LEGACY_BOOK_FORMAT/);
  assert.match(page, /designerBasePages\(candidate\)/);
  assert.match(page, /readerPagesForFormat\(chapter, project\.audience, project\.bookFormat\)/);
  assert.match(page, /format: physicalPage/);
  assert.match(page, /pdf\.addImage\(jpeg, "JPEG", 0, 0, exportFormat\.widthMm, exportFormat\.heightMm/);
  assert.match(css, /\.preview-v2 \.book-sheet,.designer-canvas-page\{width:var\(--book-page-width/);
  assert.match(css, /\.designer-render-canvas\{width:var\(--book-page-width/);
});
