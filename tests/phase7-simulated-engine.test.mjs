import assert from "node:assert/strict";
import test from "node:test";

const { evaluateChapterOneGate, evaluateTeachingChapter } = await import(new URL("../lib/pedagogy.ts", import.meta.url));

const source = `Kauṭilya Arthaśāstra governance rājā rājya artha śāstra knowledge statecraft welfare resources responsibility counsel ministers conduct learning history tradition framework commentaries treatise books chapters interpretation language manuscript ancient India.`.repeat(18);
const paragraph = "Kauṭilya explains governance as careful responsibility for rājya, welfare, resources, learning, counsel, and good conduct. Artha includes purpose and material conditions, while śāstra is an organized field of knowledge. The Arthaśāstra therefore studies statecraft through ideas about leadership, ministers, people, territory, security, and public well-being.";
const simulatedChapter = {
  title: "Kauṭilya’s Arthaśāstra: An Introduction",
  chapterPromise: "Understand why this ancient Indian work studies governance, responsibility, and collective well-being.",
  learningGoals: ["Explain artha and śāstra", "Distinguish rājā from rājya", "Describe the treatise framework"],
  introduction: `${paragraph} ${paragraph}`,
  sections: ["Meaning and purpose", "Rājā and rājya", "A structured treatise"].map((heading) => ({
    heading,
    paragraphs: [paragraph, paragraph],
    exampleTitle: "A council decision",
    example: "Imagine a council comparing two plans for water, food, and safety. The example shows why knowledge, advice, resources, and responsibility must work together before a leader decides.",
    vocabulary: [{ term: "Artha", meaning: "Purpose, resources, and material well-being in context" }],
  })),
  quickCheck: ["How are rājā and rājya different?", "Why does careful counsel matter?"],
  activity: { title: "Map a responsible decision", prompt: "Connect knowledge, welfare, resources, and counsel.", steps: ["Name the decision", "Explain each connection"] },
  recap: ["Artha has several related meanings", "Śāstra is organized knowledge", "Governance joins leadership with welfare"],
};

const passedQuality = {
  status: "passed",
  engine: "simulated-nemotron",
  scores: { context: 92, coherence: 93, ageFit: 91, pedagogy: 92, sourceFidelity: 94 },
  revisionPasses: 0,
  summary: "Simulated response passed.",
  checks: ["grounded", "age-fit", "coherent"],
  learningGoals: simulatedChapter.learningGoals,
};

test("simulated Chapter 1 success passes deterministic teaching and Phase 7 gates", () => {
  const teaching = evaluateTeachingChapter(simulatedChapter, "Ages 10–12", source, 9);
  assert.equal(teaching.passed, true, teaching.failures.join("; "));
  const gate = evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 4200 }, durationMs: 48000, wordCount: teaching.totalWords, quality: passedQuality });
  assert.equal(gate.passed, true);
  assert.ok(Object.values(gate.checks).every(Boolean));
});

test("simulated requests or tokens beyond the three-pass budget fail the pilot", () => {
  const gate = evaluateChapterOneGate({ usage: { requests: 4, totalTokens: 19000 }, durationMs: 50000, wordCount: 780, quality: passedQuality });
  assert.equal(gate.passed, false);
  assert.equal(gate.checks.requests, false);
  assert.equal(gate.checks.tokenBudget, false);
});

test("simulated weak accuracy and age-fit response requires human review", () => {
  const gate = evaluateChapterOneGate({ usage: { requests: 1, totalTokens: 3900 }, durationMs: 41000, wordCount: 760, quality: { ...passedQuality, status: "needs-review", scores: { ...passedQuality.scores, ageFit: 72, sourceFidelity: 68 } } });
  assert.equal(gate.passed, false);
  assert.equal(gate.checks.accuracy, false);
  assert.equal(gate.checks.ageSuitability, false);
  assert.equal(gate.checks.overallQuality, false);
});
