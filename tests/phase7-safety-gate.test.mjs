import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("Phase 7 sends and accepts only Chapter 1 before the measured gate passes", () => {
  assert.match(page, /phase7ChapterOneOnly: !repairOnly/);
  assert.match(page, /chapterOnePassed/);
  assert.match(page, /chapterOne && !chapterOne\.locked \? \[1\] : \[\]/);
  assert.match(worker, /phase7ChapterOneOnly && \(requested\.size !== 1 \|\| !requested\.has\(1\)\)/);
  assert.match(worker, /code: "chapter-one-gate"/);
});

test("the live response measures speed, requests, tokens, length, accuracy and age fit", () => {
  assert.match(worker, /const startedAt = Date\.now\(\)/);
  assert.match(worker, /const durationMs = Date\.now\(\) - startedAt/);
  assert.match(worker, /evaluateChapterOneGate/);
  for (const metric of ["requests", "totalTokens", "durationMs", "words", "accuracyScore", "ageFitScore", "qualityAverage"]) assert.match(page, new RegExp(metric));
  assert.match(page, /Chapters 2–6 remain locked/);
});
