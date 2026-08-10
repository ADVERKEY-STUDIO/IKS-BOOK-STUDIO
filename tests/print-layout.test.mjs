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

test("chapter drafting tracks evidence across the complete book", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /const usedEvidence = new Set<string>\(\)/);
  assert.match(worker, /if \(usedEvidence\.has\(signature\)\) continue/);
  assert.match(worker, /usedEvidence\.add\(evidenceSignature\(item\.sentence\)\)/);
});

test("chapter labels are paired with their following source titles", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(worker, /const labelledChapterTitles = chapterTitlesFromLabels\(lines\)/);
  assert.match(worker, /labelledChapterTitles\.length \? labelledChapterTitles/);
  assert.match(page, /repairChapterHierarchy\(normalizedChapters\)/);
  assert.match(page, /sourceHeadings: hierarchy\.repaired \? illustratedChapters\.map/);
});
