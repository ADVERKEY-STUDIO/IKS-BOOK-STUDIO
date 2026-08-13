import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the Chapter 1 pilot is measured without blocking later chapters", () => {
  assert.match(page, /phase7ChapterOneOnly: chapterId === 1/);
  assert.match(page, /chapterOneStable/);
  assert.match(page, /const chapterIds = requestedChapterIds/);
  assert.match(worker, /phase7ChapterOneOnly && \(requested\.size !== 1 \|\| !requested\.has\(1\)\)/);
  assert.match(worker, /code: "chapter-one-gate"/);
  assert.match(worker, /if \(project\.phase7ChapterOneOnly\)/);
  assert.match(page, /The best candidate was preserved; the remaining book can continue/);
  assert.match(worker, /usage: error\.usage/);
});

test("the live response measures speed, requests, tokens, length, accuracy and age fit", () => {
  assert.match(worker, /const startedAt = Date\.now\(\)/);
  assert.match(worker, /const durationMs = Date\.now\(\) - startedAt/);
  assert.match(worker, /evaluateChapterOneGate/);
  for (const metric of ["requests", "totalTokens", "durationMs", "words", "accuracyScore", "ageFitScore", "qualityAverage"]) assert.match(page, new RegExp(metric));
  assert.match(page, /continue automatically/);
  assert.doesNotMatch(page, /remain locked/);
});
