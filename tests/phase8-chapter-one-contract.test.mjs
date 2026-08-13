import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const { chapterWordBudget, efficientChapterPrompt, evaluateChapterOneGate, fitTeachingChapterLocally, localPedagogyScores } = await import(new URL("../lib/pedagogy.ts", import.meta.url));

test("Phase 8 gives Nemotron a hard, complete one-pass Chapter 1 contract", () => {
  const prompt = efficientChapterPrompt({
    title: "Kauṭilya’s Arthaśāstra: An Introduction",
    audience: "Ages 10–12",
    language: "English",
    targetPages: 5,
    sourceMaterial: "Artha, śāstra, governance, responsibility, welfare, counsel, and learning.",
    strictChapterOneTrial: true,
  });
  assert.match(prompt, /500–945 words/);
  assert.match(prompt, /below 500 words is incomplete/i);
  assert.match(prompt, /Aim for 813–869 words/);
  assert.match(prompt, /exactly four logically ordered teaching sections/i);
  assert.match(prompt, /exactly three essential Sanskrit or specialist terms/i);
  assert.match(prompt, /exactly two concrete examples or analogies/i);
  assert.match(prompt, /Section 1 must contain the first and Section 3 must contain the second/i);
  assert.match(prompt, /exactly three distinct recap points/i);
  assert.match(prompt, /finish and close the JSON object before the token limit/i);
  assert.match(prompt, /empty paragraphs array is invalid/i);
  assert.match(prompt, /do not invent who found it/i);
  assert.match(prompt, /exactly one top-level field named chapter/i);
  assert.match(prompt, /Do not return scores, summary, checks/i);
});

test("Phase 8 Chapter 1 gate rejects both summaries and overlong drafts", () => {
  const quality = { status: "passed", scores: { context: 92, coherence: 92, ageFit: 92, pedagogy: 92, sourceFidelity: 92 } };
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 499, quality }).checks.length, false);
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 946, quality }).checks.length, false);
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 5000 }, durationMs: 60000, wordCount: 700, quality }).checks.length, true);
});

test("the prompt, validator, and Chapter 1 gate share one age-and-page budget", () => {
  assert.deepEqual(chapterWordBudget("Ages 7–9", 4), { minimum: 500, comfortable: 450, aimMinimum: 559, aimMaximum: 598, maximum: 650 });
  const prompt = efficientChapterPrompt({ title: "Rasa", audience: "Ages 7–9", language: "English", targetPages: 4, sourceMaterial: "rasa bhava theatre expression audience", strictChapterOneTrial: true });
  assert.match(prompt, /500–650 words/);
  assert.match(prompt, /Aim for 559–598 words/);
  const quality = { status: "passed", scores: { context: 92, coherence: 94, ageFit: 93, pedagogy: 95, sourceFidelity: 96 } };
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 4735 }, durationMs: 103900, wordCount: 734, quality, audience: "Ages 7–9", targetPages: 4 }).checks.length, false);
  assert.equal(evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 4735 }, durationMs: 103900, wordCount: 600, quality, audience: "Ages 7–9", targetPages: 4 }).checks.length, true);
});

test("local fitting preserves overlong prose and adds layout space without an AI request", () => {
  let serial = 0;
  const sentence = () => `Rasa helps an attentive audience understand how expression, gesture, movement, music, and dramatic context work together in performance example ${++serial}.`;
  const chapter = {
    title: "The Basis of Rasa Theory in Drama",
    chapterPromise: sentence(),
    learningGoals: [sentence(), sentence(), sentence()],
    introduction: `${sentence()} ${sentence()} ${sentence()}`,
    sections: ["Expression", "Gesture", "Performance", "Audience"].map((heading) => ({ heading, paragraphs: [`${sentence()} ${sentence()} ${sentence()} ${sentence()}`], exampleTitle: "A clear example", example: sentence(), vocabulary: [] })),
    quickCheck: [sentence(), sentence()],
    activity: { title: "Notice expression", prompt: sentence(), steps: [sentence(), sentence()] },
    recap: [sentence(), sentence(), sentence()],
  };
  const fitted = fitTeachingChapterLocally(chapter, "Ages 7–9", 4);
  assert.ok(fitted.compactedWords > chapterWordBudget("Ages 7–9", 4).maximum);
  assert.ok(fitted.fittedPages > fitted.requestedPages);
  assert.ok(fitted.fittedPages <= fitted.requestedPages + 2);
  assert.ok(fitted.compactedWords <= chapterWordBudget("Ages 7–9", fitted.fittedPages).maximum);
  assert.equal(fitted.chapter.sections.length, chapter.sections.length);
  assert.equal(fitted.chapter.learningGoals.length, chapter.learningGoals.length);
});

test("the gated Chapter 1 browser flow never performs a hidden retry", () => {
  assert.match(page, /const singleShotChapterOneTrial/);
  assert.match(page, /const maximumAttempts = singleShotChapterOneTrial \? 1 : 2/);
  assert.match(page, /PHASE 8 · CHAPTER 1 GATE/);
  assert.match(worker, /strictChapterOneTrial: !allowAutomaticRepair/);
  assert.match(worker, /allowAutomaticRepair \? 3200 : 2300/);
  assert.match(worker, /finish the JSON before the token limit/);
  assert.match(worker, /openRouterStructured<\{ chapter: TeachingChapter \}>/);
  assert.match(worker, /localPedagogyScores\(deterministic\)/);
});

test("Phase 8 scores are derived locally instead of accepted from the model", () => {
  const strong = localPedagogyScores({ passed: true, failures: [], totalWords: 620, averageSentenceWords: 15, sourceTermOverlap: ["governance", "artha", "treatise", "kauṭilya"] });
  assert.deepEqual(strong, { context: 92, coherence: 94, ageFit: 93, pedagogy: 95, sourceFidelity: 96 });
  const weak = localPedagogyScores({ passed: false, failures: ["Not enough concrete examples or analogies", "The lesson introduces unsupported numeric claims: 2300"], totalWords: 620, averageSentenceWords: 15, sourceTermOverlap: [] });
  assert.equal(weak.pedagogy, 72);
  assert.equal(weak.sourceFidelity, 68);
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
