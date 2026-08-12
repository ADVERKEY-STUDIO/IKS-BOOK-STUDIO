import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("printed chapters start on clean A4 pages", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.preview-scroll>article\{[^}]*break-before:page[^}]*page-break-before:always/);
  assert.match(css, /\.preview-scroll>article\{[^}]*break-after:auto[^}]*page-break-after:auto/);
  assert.doesNotMatch(css, /\.preview-scroll>article\{[^}]*break-after:page[^}]*page-break-after:always/);
  assert.match(css, /\.preview-body p[^}]*orphans:3;widows:3/);
  assert.match(css, /\.source-draft-notice[^}]*break-inside:avoid-page/);
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
