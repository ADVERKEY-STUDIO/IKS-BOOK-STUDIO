import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the normal six-chapter path uses one tiny test and one request per chapter", () => {
  assert.match(worker, /Reply exactly: READY/);
  assert.match(worker, /max_tokens: 12/);
  assert.match(worker, /request exactly one chapter at a time/);
  assert.match(page, /chapterIds: \[chapterId\]/);
  assert.match(page, /Six chapters normally use six requests/);
  assert.match(page, /0<\/b> local validation requests/);
  assert.match(page, /0<\/b> page and export requests/);
});

test("chapter one proves stability before concurrency can increase to two", () => {
  assert.match(page, /const MAX_CONCURRENT_CHAPTERS = 2/);
  assert.match(page, /chapterOneStable/);
  assert.match(page, /canRunPair \? MAX_CONCURRENT_CHAPTERS : 1/);
  assert.match(page, /if \(chapterId === 1\) chapterOneStable = true/);
});

test("temporary failures get one delayed retry and quota never enters a retry loop", () => {
  assert.match(page, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(page, /TEMPORARY_RETRY_DELAY_MS = 1800/);
  assert.match(page, /if \(data\.quota \|\| response\.status === 429 \|\| response\.status === 402\)/);
  assert.match(page, /stopForQuota\(\)/);
  assert.match(page, /if \(!data\.retryable \|\| attempt === 1 \|\| quotaStopped\(\)\)/);
  assert.doesNotMatch(page, /while\s*\([^)]*retry/i);
});

test("formatting stays local and genuine quality repair is capped at one request", () => {
  assert.match(worker, /Formatting cleanup happens locally in normalizeTeachingChapter/);
  assert.match(worker, /if \(!deterministic\.passed \|\| Object\.values\(scores\)\.some\(\(score\) => score < 80\)\)/);
  assert.match(worker, /revisionPasses = 1/);
  assert.match(worker, /malformed-output", false/);
  assert.doesNotMatch(worker, /while\s*\([^)]*(?:repair|revision)/i);
});

test("quota pause stops new batches and exposes Resume book", () => {
  assert.match(page, /while \(cursor < chapterIds\.length && !failureReason && !quotaPause\)/);
  assert.match(page, /Daily quota reached\. Generation stopped/);
  assert.match(page, /quotaPaused \? "Resume book"/);
  assert.match(page, /Quota errors never retry/);
});
