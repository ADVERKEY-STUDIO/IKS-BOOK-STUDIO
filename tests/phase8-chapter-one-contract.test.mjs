import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const { efficientChapterPrompt, evaluateChapterOneGate } = await import(new URL("../lib/pedagogy.ts", import.meta.url));

test("Phase 8 gives Nemotron a hard, complete one-pass Chapter 1 contract", () => {
  const prompt = efficientChapterPrompt({
    title: "Kauṭilya’s Arthaśāstra: An Introduction",
    audience: "Ages 10–12",
    language: "English",
    targetPages: 5,
    sourceMaterial: "Artha, śāstra, governance, responsibility, welfare, counsel, and learning.",
    strictChapterOneTrial: true,
  });
  assert.match(prompt, /500–900 words/);
  assert.match(prompt, /below 500 words is incomplete/i);
  assert.match(prompt, /exactly four logically ordered teaching sections/i);
  assert.match(prompt, /exactly three essential Sanskrit or specialist terms/i);
  assert.match(prompt, /exactly two concrete examples or analogies/i);
  assert.match(prompt, /exactly three distinct recap points/i);
  assert.match(prompt, /finish and close the JSON object before the token limit/i);
  assert.match(prompt, /empty paragraphs array is invalid/i);
  assert.match(prompt, /do not invent who found it/i);
});

test("Phase 8 Chapter 1 gate rejects both summaries and overlong drafts", () => {
  const quality = { status: "passed", scores: { context: 92, coherence: 92, ageFit: 92, pedagogy: 92, sourceFidelity: 92 } };
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 499, quality }).checks.length, false);
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 901, quality }).checks.length, false);
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 700, quality }).checks.length, true);
});

test("the gated Chapter 1 browser flow never performs a hidden retry", () => {
  assert.match(page, /const singleShotChapterOneTrial/);
  assert.match(page, /const maximumAttempts = singleShotChapterOneTrial \? 1 : 2/);
  assert.match(page, /PHASE 8 · CHAPTER 1 GATE/);
  assert.match(worker, /strictChapterOneTrial: !allowAutomaticRepair/);
  assert.match(worker, /allowAutomaticRepair \? 3600 : 2900/);
  assert.match(worker, /finish the JSON before the token limit/);
});

test("local teaching validation rejects sections without explanatory prose", async () => {
  const { evaluateTeachingChapter } = await import(new URL("../lib/pedagogy.ts", import.meta.url));
  const result = evaluateTeachingChapter({
    title: "Introduction",
    chapterPromise: "Learn how governance connects responsibility, welfare, knowledge, and careful decisions.",
    learningGoals: ["Explain governance", "Describe counsel", "Connect welfare and responsibility"],
    introduction: "Kauṭilya's Arthaśāstra examines governance, resources, counsel, learning, responsibility, and welfare in an organized treatise. Its ideas invite readers to ask how leaders can make careful decisions for a whole rājya while understanding the duties of the rājā and the needs of people.",
    sections: ["Artha", "Śāstra", "Rājya", "Counsel"].map((heading) => ({ heading, paragraphs: [], exampleTitle: "Example", example: "Imagine a council comparing choices for public welfare, resources, learning, safety, and responsibility before making a careful decision for everyone.", vocabulary: [{ term: heading, meaning: "A chapter-specific idea explained clearly for the reader" }] })),
    quickCheck: ["What is governance?", "Why does counsel matter?"],
    activity: { title: "Decide carefully", prompt: "Compare two choices.", steps: ["List effects", "Choose fairly"] },
    recap: ["Governance carries responsibility", "Counsel supports decisions", "Welfare concerns the whole state"],
  }, "Ages 10–12", "Kauṭilya Arthaśāstra governance rājya rājā artha śāstra knowledge statecraft welfare resources responsibility counsel ministers conduct learning history tradition framework treatise".repeat(20), 5);
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("A teaching section is incomplete"));
});
