import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the editor exposes the complete simplified Phase 6 workflow", () => {
  for (const label of [
    "Test Nemotron connection",
    "Improve this chapter",
    "Build remaining chapters",
    "Pause after current chapter",
    "Resume book",
    "Compare original and improved",
    "Accept improvement",
    "Keep original",
    "Repair once",
    "Restore previous version",
  ]) assert.match(page, new RegExp(label));
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
