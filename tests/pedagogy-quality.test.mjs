import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const pedagogy = await import(new URL("../lib/pedagogy.ts", import.meta.url));

test("chapter generation uses a draft, independent review, and hard quality gate", () => {
  assert.match(worker, /gemini-3\.6-flash/);
  assert.match(worker, /blueprintPrompt/);
  assert.match(worker, /chapterBlueprintSchema/);
  assert.match(worker, /thinkingLevel: "high"/);
  assert.match(worker, /retryDelays = \[900, 2200, 4800\]/);
  assert.match(worker, /response\.status === 503/);
  assert.match(worker, /temporarily busy after several automatic retries/i);
  assert.match(worker, /teachingChapterSchema/);
  assert.match(worker, /reviewedTeachingChapterSchema/);
  assert.match(worker, /Object\.values\(scores\).*score < 85/s);
  assert.match(worker, /previous chapter was kept unchanged/i);
  assert.doesNotMatch(worker, /buildSourceDraft/);
});

test("the teaching prompt requires context, ordered concepts, examples, vocabulary, checks and recap", () => {
  const prompt = pedagogy.teachingPrompt({
    title: "Kauṭilya’s Arthaśāstra: An Introduction",
    audience: "Ages 10–12",
    language: "English",
    targetPages: 5,
    sourceMaterial: "Artha can refer to resources, purpose, and the conditions that support collective life.",
    blueprint: {
      centralQuestion: "What helps a society flourish?",
      readerHook: "Every community makes choices.",
      essentialIdeas: [{ concept: "Artha", childExplanation: "Resources and purpose", factualAnchor: "Artha has several related meanings", commonMisunderstanding: "It means only money" }],
      conceptOrder: ["Artha"],
      requiredVocabulary: [{ term: "Artha", meaning: "purpose and resources" }],
      historicalContext: "Ancient Indian thought",
      sensitiveContext: "None",
      avoidRepeating: ["connected", "important"],
    },
  });
  for (const requirement of ["reason to care", "learning goals", "prerequisite order", "specialist term", "examples or analogies", "comprehension questions", "recap"]) {
    assert.match(prompt, new RegExp(requirement, "i"));
  }
  assert.match(prompt, /Never mention a source/);
  assert.match(prompt, /Do not pad/);
});

test("a source-grounded blueprint is created before prose", () => {
  const prompt = pedagogy.blueprintPrompt({
    title: "The Council",
    audience: "Ages 7–9",
    language: "English",
    sourceMaterial: "The council considers duties, advice, and shared responsibility.",
  });
  assert.match(prompt, /chapter blueprint, not prose/i);
  assert.match(prompt, /central question/i);
  assert.match(prompt, /factual anchor/i);
  assert.match(prompt, /Do not invent facts/i);
});

test("meaningless keyword filler is rejected before it can enter the book", () => {
  const result = pedagogy.evaluateTeachingChapter({
    title: "Introduction",
    chapterPromise: "Learn two words.",
    learningGoals: ["Name Artha", "Name Śāstra", "Connect them"],
    introduction: "Artha is a word. Śāstra is a word. This means Artha and Śāstra are connected.",
    sections: [],
    quickCheck: [],
    activity: { title: "Think", prompt: "Think.", steps: [] },
    recap: [],
  }, "Ages 10–12", "Artha Śāstra governance resources knowledge discipline learning statecraft public welfare administration");
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => /filler/i.test(failure)));
  assert.ok(result.failures.some((failure) => /context/i.test(failure)));
});

test("designers see the five quality scores and export waits for reviewed lessons", () => {
  for (const label of ["Context", "Coherence", "Age fit", "Teaching", "Accuracy"]) assert.match(page, new RegExp(label));
  assert.match(page, /READY FOR CHILDREN/);
  assert.match(page, /pedagogyQuality/);
  assert.match(page, /disabled=\{unreviewedChapters\.length > 0\}/);
  assert.match(page, /Export is paused until every lesson passes/);
});
