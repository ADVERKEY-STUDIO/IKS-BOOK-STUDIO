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
  assert.match(page, /splitBlockToFit\(block, available\)/);
  assert.match(page, /pending\.unshift\(remainder\)/);
  assert.match(page, /const trailingHeading/);
});

test("format-aware pagination fills continuation sheets without crowding paragraphs", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const baseCapacity = age === "7-9" \? 2550/);
  assert.match(page, /baseCapacity \* bookFormatCapacityRatio\(formatId\)/);
  assert.match(page, /firstPageCapacity = Math\.round\(pageCapacity \* \.78\)/);
  assert.match(page, /activeCapacity = pages\.length === 0 \? firstPageCapacity : pageCapacity/);
  assert.match(page, /availableText < 260/);
  assert.match(css, /\.preview-body p\{margin:0 0 2\.4mm\}/);
  assert.match(css, /\.preview-body h2\{[^}]*margin:5mm 0 2mm/);
  assert.match(css, /\.preview-v2 \.preview-body p\{margin:0 0 \.68em;line-height:1\.56\}/);
});

test("a sparse final text page shares its unused space with the chapter illustration", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const shareIllustration = Boolean\(chapter\.imageUrl\).*readerTextLength/);
  assert.match(page, /chapter-text-visual-sheet/);
  assert.match(page, /chapter\.imageUrl && !shareIllustration/);
  assert.match(css, /\.chapter-text-visual-sheet \.chapter-image img\{[^}]*max-height:315px;object-fit:cover/);
});

test("multi-page PDF export avoids base64 canvas accumulation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /pdfRasterSettings\(sheets\.length, mode\)/);
  assert.match(page, /canvasToJpegBytes\(canvas, raster\.quality\)/);
  assert.match(page, /canvas\.width = 1/);
  assert.doesNotMatch(page, /pdf\.addImage\(canvas\.toDataURL/);
  assert.match(page, /PDF export stopped at page \$\{index \+ 1\}/);
  assert.match(page, /renderedBlockers\.slice\(0, 3\)\.join/);
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
