import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const pedagogy = await import(new URL("../lib/pedagogy.ts", import.meta.url));

test("chapter generation uses token-capped Nemotron requests, immediate progress saving, and a hard quality gate", () => {
  assert.match(worker, /nvidia\/nemotron-3-ultra-550b-a55b:free/);
  assert.match(worker, /openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.match(worker, /efficientChapterPrompt/);
  assert.match(worker, /response_format: \{ type: "json_object" \}/);
  assert.match(worker, /max_completion_tokens: maxCompletionTokens/);
  assert.match(worker, /reasoning: \{ effort: "none", exclude: true \}/);
  assert.match(worker, /material\.length <= 24000/);
  assert.match(worker, /requested\.size > 1/);
  assert.match(worker, /response\.status === 429/);
  assert.match(page, /while \(cursor < chapterIds\.length/);
  assert.match(page, /batch\.map\(async \(chapterId\)/);
  assert.match(page, /chapterIds: \[chapterId\]/);
  assert.match(page, /await persistProject\(workingProject\)/);
  assert.match(worker, /Object\.values\(scores\).*score < 80/s);
  assert.match(worker, /fitTeachingChapterLocally\(draft, audience, chapter\.pages\)/);
  assert.match(worker, /evaluateTeachingChapter\(draft, audience, sourceMaterial, fittedPages\)/);
  assert.match(worker, /previous chapter was kept unchanged/i);
  assert.doesNotMatch(worker, /GEMINI_API_KEY|generativelanguage\.googleapis\.com/);
});

test("the efficient prompt plans, writes, and reviews one complete lesson in one pass", () => {
  const prompt = pedagogy.efficientChapterPrompt({
    title: "The Council",
    audience: "Ages 10–12",
    language: "English",
    targetPages: 5,
    sourceMaterial: "The council considers duties, advice, shared responsibility, welfare, resources, and careful judgement.",
  });
  assert.match(prompt, /one pass/i);
  assert.match(prompt, /4–6 essential ideas/);
  assert.match(prompt, /verify every factual claim/i);
  assert.match(prompt, /never exceed 945 words/i);
  assert.match(prompt, /Return one JSON object/i);
  assert.match(prompt, /Never mention a source/i);
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

test("the final review is bounded by the planned comfortable page count", () => {
  const prompt = pedagogy.reviewPrompt({
    title: "Introduction",
    audience: "Ages 10–12",
    language: "English",
    targetPages: 5,
    sourceMaterial: "Governance requires learning, welfare, resources, and careful judgement.",
    blueprint: { centralQuestion: "How should leaders learn?", readerHook: "Choices matter.", essentialIdeas: [], conceptOrder: [], requiredVocabulary: [], historicalContext: "Ancient India", sensitiveContext: "None", avoidRepeating: [] },
    draft: { title: "Introduction", chapterPromise: "Learn", learningGoals: [], introduction: "Begin", sections: [], quickCheck: [], activity: { title: "Try", prompt: "Think", steps: [] }, recap: [] },
  });
  assert.match(prompt, /never exceed 945 words/i);
  assert.match(prompt, /5 comfortable book pages/i);
});

test("a source-grounded blueprint is created before prose", () => {
  const prompt = pedagogy.blueprintPrompt({
    title: "The Council",
    audience: "Ages 7–9",
    language: "English",
    targetPages: 3,
    sourceMaterial: "The council considers duties, advice, and shared responsibility.",
  });
  assert.match(prompt, /chapter blueprint, not prose/i);
  assert.match(prompt, /3 comfortable illustrated pages/i);
  assert.match(prompt, /only 4–6 essential ideas/i);
  assert.match(prompt, /central question/i);
  assert.match(prompt, /factual anchor/i);
  assert.match(prompt, /Do not invent facts/i);
});

test("normalized chapter fields deterministically remove private source-workflow language", () => {
  const chapter = pedagogy.normalizeTeachingChapter({
    title: "Introduction",
    chapterPromise: "The private source material explains wise government.",
    learningGoals: ["Use evidence from the source"],
    introduction: "According to the original source, leaders must learn.",
    sections: [{ heading: "Ideas", paragraphs: ["This source shows why learning matters."], exampleTitle: "Example", example: "A council listens.", vocabulary: [] }],
    quickCheck: ["What does the source say?"],
    activity: { title: "Try it", prompt: "Review the source workflow.", steps: ["Discuss the idea."] },
    recap: ["The source's main argument values learning."],
  }, "Introduction");
  assert.doesNotMatch(JSON.stringify(chapter), /(?:private|uploaded|original) source|the source|source workflow|source material/i);
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
