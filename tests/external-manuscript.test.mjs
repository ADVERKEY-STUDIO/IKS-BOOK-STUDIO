import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildExternalAiPrompt, parseExternalManuscript } from "../lib/external-manuscript.ts";

const settings = {
  title: "A Child's Rasa Reader",
  sourceName: "source.pdf",
  audience: "Ages 7–9",
  readingLevel: "Clear reader",
  language: "English",
  bookType: "Illustrated educational book",
  aesthetic: "Storybook India",
  illustrationStyle: "Warm narrative watercolour",
  learningFeatures: ["Key terms", "Reflection"],
};

test("external prompt asks a provider to read the source and return structured Markdown", () => {
  const prompt = buildExternalAiPrompt(settings);
  assert.match(prompt, /Read the entire uploaded source before writing/);
  assert.match(prompt, /# INTRODUCTION/);
  assert.match(prompt, /# CHAPTER 01:/);
  assert.match(prompt, /# CONCLUSION/);
  assert.match(prompt, /# GLOSSARY/);
  assert.match(prompt, /Do not return JSON/);
  assert.match(prompt, /No map, Venn diagram or generic infographic/);
});

test("external manuscript parser preserves order and separates private illustration briefs", () => {
  const chapterWords = Array.from({ length: 280 }, (_, index) => `word${index}`).join(" ");
  const manuscript = `# A Child's Rasa Reader

# INTRODUCTION
${Array.from({ length: 100 }, () => "welcome").join(" ")}

# CHAPTER 01: Seeing Rasa
## IN THIS CHAPTER
Learn how rasa is experienced.
## A meaningful scene
${chapterWords}
## KEY TERMS
**Rasa** means aesthetic experience.
## CHECK YOUR UNDERSTANDING
1. What did you notice?
## CHAPTER RECAP
Rasa connects art and feeling.
## ILLUSTRATION BRIEF
A child watches a classical dancer express wonder in a warm theatre.

# CONCLUSION
${Array.from({ length: 100 }, () => "together").join(" ")}

# GLOSSARY
${Array.from({ length: 100 }, () => "meaning").join(" ")}`;
  const result = parseExternalManuscript(manuscript, settings.audience);
  assert.equal(result.title, settings.title);
  assert.deepEqual(result.sections.map((section) => section.kind), ["introduction", "chapter", "conclusion", "glossary"]);
  assert.match(result.sections[1].illustrationBrief, /classical dancer/);
  assert.doesNotMatch(result.sections[1].html, /ILLUSTRATION BRIEF/);
  assert.equal(result.issues.length, 0);
  assert.equal(result.sections[1].issues.length, 0);
});

test("external manuscript parser reports missing publishing sections", () => {
  const result = parseExternalManuscript("# Book\n\n# CHAPTER 01: Only chapter\nA short draft.", settings.audience);
  assert.ok(result.issues.includes("Introduction is missing."));
  assert.ok(result.issues.includes("Conclusion is missing."));
  assert.ok(result.sections[0].issues.length >= 4);
});

test("site exposes the external workflow, supported imports and DOCX extraction route", () => {
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(page, /Use ChatGPT, Claude or DeepSeek/);
  assert.match(page, /accept="\.md,\.markdown,\.txt,\.docx,\.zip"/);
  assert.match(page, /Use the simple external-AI workflow/);
  assert.match(page, /Accept manuscript & open studio/);
  assert.match(worker, /\/api\/manuscript\/extract/);
  assert.match(worker, /mammoth\.extractRawText/);
});
