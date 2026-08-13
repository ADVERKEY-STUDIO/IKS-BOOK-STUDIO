import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the editor keeps the complete Phase 6 actions without crowding the main workflow", () => {
  for (const label of [
    "Generate chapter by chapter",
    "Testing…",
    "Pause after this chapter",
    "Resume book",
    "Compare versions",
    "Accept improvement",
    "Keep original",
    "Repair once",
    "Restore previous version",
  ]) assert.match(page, new RegExp(label));
  assert.match(page, /<summary>More actions<\/summary>/);
});

test("the ChatGPT ZIP workflow is tucked under Advanced tools", () => {
  assert.match(page, /<details className="advanced-tools">/);
  assert.match(page, /ChatGPT ZIP workflow/);
  assert.doesNotMatch(page, />✦ <span>ChatGPT Book<\/span>/);
});

test("pause, compare, restore, and one-shot repair are durable explicit actions", () => {
  assert.match(page, /pauseAfterCurrentRef\.current = true/);
  assert.match(page, /setComparison\(\{ chapterId: active\.id, original: structuredClone\(active\) \}\)/);
  assert.match(page, /Before restoring previous version/);
  assert.match(page, /repairAttempts: options\.repairOnly/);
  assert.match(worker, /project\.repairOnly\s*\?\s*await buildTargetedRepair/);
  assert.match(worker, /one targeted repair to an existing children’s textbook chapter/);
});

test("Nemotron connection testing only runs on an explicit button action", () => {
  assert.match(page, /async function testNemotronConnection\(\)/);
  assert.match(page, /fetch\("\/api\/ai\/status"/);
  assert.match(page, /onTest=\{\(\) => void testNemotronConnection\(\)\}/);
});

test("the main workflow is chapter-wise instead of a wall of global buttons", () => {
  assert.match(page, /Generate chapter by chapter/);
  assert.match(page, /project\.chapters\.map\(\(chapter\) =>/);
  assert.match(page, /onGenerateChapter\(chapter\.id\)/);
  assert.match(page, /chapter\.id > 1 && !chapterOnePassed/);
  assert.match(page, /status === "Completed" \? "View"/);
  assert.match(page, /<summary>More actions<\/summary>/);
  assert.match(page, /prepareDraft\("active", \{ chapterId \}\)/);
});
