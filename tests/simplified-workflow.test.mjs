import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the editor exposes one automated publishing action without a manual repair button", () => {
  for (const label of [
    "Automated publishing workflow",
    "Build this book",
    "Testing…",
    "Pause after this chapter",
    "Resume book",
    "Compare versions",
    "Accept improvement",
    "Keep original",
    "Restore previous version",
  ]) assert.match(page, new RegExp(label));
  assert.doesNotMatch(page, /Repair once/);
  assert.doesNotMatch(page, /Build and review this lesson/);
  assert.match(page, /<summary>More actions<\/summary>/);
});

test("the ChatGPT ZIP workflow is tucked under Advanced tools", () => {
  assert.match(page, /<details className="advanced-tools">/);
  assert.match(page, /ChatGPT ZIP workflow/);
  assert.doesNotMatch(page, />✦ <span>ChatGPT Book<\/span>/);
});

test("pause, restore, and the bounded feedback loop are durable", () => {
  assert.match(page, /pauseAfterCurrentRef\.current = true/);
  assert.match(page, /Before restoring previous version/);
  assert.match(worker, /feedbackRevisionPrompt/);
  assert.match(worker, /for \(const attempt of \[2, 3\] as const\)/);
  assert.doesNotMatch(worker, /project\.repairOnly/);
});

test("Nemotron connection testing only runs on an explicit button action", () => {
  assert.match(page, /async function testNemotronConnection\(\)/);
  assert.match(page, /fetch\("\/api\/ai\/status"/);
  assert.match(page, /onTest=\{\(\) => void testNemotronConnection\(\)\}/);
});

test("the main workflow is chapter-wise instead of a wall of global buttons", () => {
  assert.match(page, /Automated publishing workflow/);
  assert.match(page, /project\.chapters\.map\(\(chapter\) =>/);
  assert.match(page, /onGenerateChapter\(chapter\.id\)/);
  assert.doesNotMatch(page, /chapter\.id > 1 && !chapterOnePassed/);
  assert.match(page, /status === "Completed" \|\| status === "Designer handoff" \? "View"/);
  assert.match(page, /<summary>More actions<\/summary>/);
  assert.match(page, /prepareDraft\("active", \{ chapterId \}\)/);
});

test("failed chapters can be handed to a designer without blocking PDF export", () => {
  assert.match(page, /\| "Designer handoff"/);
  assert.match(page, /async function leaveChapterForDesigner\(chapterId = active\?\.id\)/);
  assert.match(page, /Send Chapter \{active\.id\} to designer/);
  assert.match(page, /chapterGenerationState\(chapter\) !== "Designer handoff"/);
  assert.match(page, /async function downloadPdf\(mode: "proof" \| "final"\)/);
  assert.match(page, /pdf\.save\(`/);
  assert.match(page, /Download proof PDF/);
});

test("preview opens even when export is quality-gated", () => {
  assert.match(page, /function openPreview\(mode: "proof" \| "final" = "proof"\)/);
  assert.match(page, /Proof ready/);
  assert.match(page, /openPreview\("proof"\)/);
  assert.match(page, /disabled=\{exportBusy \|\| Boolean\(unresolved\.length\)\}/);
});

test("publishing workflow exposes review, operations and real PDF controls", () => {
  for (const label of ["Source uploaded", "Chapters generated", "Quality review", "Illustrations", "Export ready", "Review Queue", "Request History", "Proof mode", "Final-book mode"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /generationRuns\?: GenerationRun\[\]/);
  assert.match(page, /Current generation run|current run/i);
  assert.match(page, /html2canvas/);
  assert.match(page, /jsPDF/);
});
