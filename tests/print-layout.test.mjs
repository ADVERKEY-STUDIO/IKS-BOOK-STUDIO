import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("printed chapters start on clean A4 pages", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.preview-scroll>article\{[^}]*break-before:auto[^}]*page-break-before:auto[^}]*break-after:page[^}]*page-break-after:always/);
  assert.match(css, /\.preview-scroll>article:last-child\{[^}]*break-after:auto[^}]*page-break-after:auto/);
  assert.doesNotMatch(css, /\.preview-scroll>article\.book-sheet\{[^}]*break-before:page/);
  assert.doesNotMatch(css, /\.preview-scroll>article\.book-sheet\{[^}]*break-after:page/);
  assert.match(css, /\.preview-scroll>article\.book-sheet\{[^}]*display:block!important[^}]*height:auto!important[^}]*min-height:252mm!important[^}]*max-height:none!important[^}]*overflow:visible!important/);
  assert.match(css, /\.preview-body p[^}]*orphans:3;widows:3/);
  assert.match(css, /\.source-draft-notice[^}]*break-inside:avoid-page/);
});

test("local pagination preserves nested subsection content and splits oversized blocks", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const flattened = clean\.replace/);
  assert.match(page, /rawBlocks\.flatMap\(splitLongBlock\)/);
  assert.match(page, /const items = listMatch\[2\]\.match/);
  assert.match(page, /const trailingHeading/);
});

test("A4 pagination fills continuation sheets without crowding paragraphs", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /pageCapacity = age === "7-9" \? 2050/);
  assert.match(page, /firstPageCapacity = Math\.round\(pageCapacity \* \.78\)/);
  assert.match(page, /activeCapacity = pages\.length === 0 \? firstPageCapacity : pageCapacity/);
  assert.match(css, /\.preview-body p\{margin:0 0 2\.4mm\}/);
  assert.match(css, /\.preview-body h2\{[^}]*margin:5mm 0 2mm/);
});

test("chapter drafting keeps private fact-check references inside each detected range", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(worker, /function privateChapterRefs/);
  assert.match(worker, /selectChapterPages\(pageTexts, chapter/);
  assert.match(worker, /page: entry\.pageIndex \+ 1/);
  assert.match(page, /Private fact check/);
});

test("chapter labels are paired with their following source titles", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(worker, /const labelledChapterTitles = chapterTitlesFromLabels\(lines\)/);
  assert.match(worker, /labelledChapterTitles\.length \? labelledChapterTitles/);
  assert.match(page, /repairChapterHierarchy\(normalizedChapters\)/);
  assert.match(page, /sourceHeadings: hierarchy\.repaired \? illustratedChapters\.map/);
});
