import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("contents-page chapter names take priority and every top-level entry is retained", () => {
  assert.match(worker, /function chapterTitlesFromContents/);
  assert.match(worker, /contentsHeadings\.length >= 2 \? contentsHeadings/);
  assert.match(worker, /\.slice\(0, 60\)/);
  assert.match(worker, /\/api\/source\/reanalyse/);
});

test("chapter adaptation pages are planned automatically after context detection", () => {
  assert.match(page, /Your adaptation page plan is ready/);
  assert.match(page, /AUTOMATIC ADAPTATION PLAN/);
  assert.match(page, /Adaptation pages for \$\{heading\}/);
  assert.match(page, /adaptationPlanConfirmed/);
  assert.doesNotMatch(page, /How long should each chapter summary be\?/);
  assert.match(page, /ORIGINAL TITLE/);
});

test("generated source-location metadata sentence is removed", () => {
  assert.doesNotMatch(worker, /source-grounded chapter for/);
  assert.match(page, /removeGeneratedChapterMetadata/);
  assert.match(page, /referenced source locations\?/);
});
