import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the normal path uses one tiny test and normally one request per chapter", () => {
  assert.match(worker, /Reply exactly: READY/);
  assert.match(worker, /max_tokens: 12/);
  assert.match(worker, /request exactly one chapter at a time/);
  assert.match(page, /chapterIds: \[chapterId\]/);
  assert.match(page, /1<\/b> normal draft per chapter/);
  assert.match(page, /\+2<\/b> targeted passes only if needed/);
  assert.match(page, /0<\/b> local validation requests/);
  assert.match(page, /0<\/b> page and export requests/);
});

test("chapter one proves stability before concurrency can increase to two", () => {
  assert.match(page, /const MAX_CONCURRENT_CHAPTERS = 2/);
  assert.match(page, /chapterOneStable/);
  assert.match(page, /canRunPair \? MAX_CONCURRENT_CHAPTERS : 1/);
  assert.match(page, /if \(chapterId === 1\) chapterOneStable = true/);
});

test("temporary failures never create a hidden fourth call and quota never retries", () => {
  assert.doesNotMatch(page, /TEMPORARY_RETRY_DELAY_MS/);
  assert.doesNotMatch(page, /maximumAttempts/);
  assert.match(page, /if \(data\.quota \|\| response\.status === 429 \|\| response\.status === 402\)/);
  assert.match(page, /stopForQuota\(\)/);
  assert.match(page, /No hidden Nemotron retry was made/);
  assert.doesNotMatch(page, /while\s*\([^)]*retry/i);
});

test("formatting stays local and genuine quality feedback is capped at three total requests", () => {
  assert.match(worker, /fitTeachingChapterLocally/);
  assert.match(worker, /for \(const attempt of \[2, 3\] as const\)/);
  assert.match(worker, /feedbackRevisionPrompt/);
  assert.match(worker, /best = \{ draft, localFit, fittedPages, deterministic, scores, rank \}/);
  assert.match(worker, /no fourth request was made/i);
  assert.match(worker, /malformed-output", false/);
  assert.doesNotMatch(worker, /while\s*\([^)]*(?:repair|revision)/i);
});

test("quota pause stops new batches and exposes Resume book", () => {
  assert.match(page, /while \(cursor < chapterIds\.length && !failureReason && !quotaPause\)/);
  assert.match(page, /Daily quota reached\. Generation stopped/);
  assert.match(page, /quotaPaused \? "Resume book"/);
  assert.match(page, /quota errors stop immediately/i);
});
