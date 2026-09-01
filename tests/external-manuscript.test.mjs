import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildExternalAiPrompt, buildExternalIllustrationPrompt, buildExternalIllustrationSlotPrompt, createExternalIllustrationSlots, matchExternalIllustrationArchive, parseExternalManuscript } from "../lib/external-manuscript.ts";

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
  assert.match(prompt, /manuscript text only/);
  assert.match(prompt, /Do not generate, embed or describe images/);
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

test("approved manuscript creates one cover and one stable image slot per real chapter", () => {
  const result = parseExternalManuscript(`# Book\n\n# INTRODUCTION\n${"welcome ".repeat(100)}\n\n# CHAPTER 01: First light\n## IN THIS CHAPTER\nA promise.\n## STORY\n${"A child watches a craftsperson prepare pigments in a sunlit courtyard. ".repeat(45)}\n## KEY TERMS\nPigment means colour material.\n## CHECK YOUR UNDERSTANDING\nWhat did you notice?\n## CHAPTER RECAP\nColour begins with careful work.\n\n# CONCLUSION\n${"together ".repeat(100)}`, settings.audience);
  const slots = createExternalIllustrationSlots(result, settings.title);
  assert.deepEqual(slots.map((slot) => slot.id), ["COVER", "CH-01-IMG-01"]);
  assert.equal(slots[1].chapterId, 2);
  assert.match(slots[1].sceneBrief, /craftsperson prepare pigments/);
  assert.equal(slots[1].filename, "images/CH-01-IMG-01.jpg");
});

test("second-stage prompt requests one complete, quality-checked illustration ZIP", () => {
  const slots = [{ id: "COVER", role: "cover", chapterTitle: "Front cover", filename: "images/cover.jpg", sceneBrief: "Cover", altText: "Cover", caption: "Cover", status: "pending" }, { id: "CH-01-IMG-01", role: "chapter", chapterId: 1, chapterTitle: "Seeing Rasa", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "A dancer performs for attentive children", altText: "Children watching a dancer", caption: "Expression and attention", status: "pending" }];
  const project = { ...settings, chapters: [{ id: 1, title: "Seeing Rasa", body: "A chapter about expression, gesture and an attentive audience." }], slots };
  const prompt = buildExternalIllustrationPrompt(project);
  assert.match(prompt, /COMPLETE ILLUSTRATION ZIP REQUEST/);
  assert.match(prompt, /Do NOT produce SVG/);
  assert.match(prompt, /Do NOT imitate the simple diagram-like placeholder artwork/);
  assert.match(prompt, /Do not ask the designer to type NEXT/);
  assert.match(prompt, /return one downloadable ZIP/);
  assert.match(prompt, /Exact ZIP path: images\/CH-01-IMG-01\.jpg/);
  assert.match(prompt, /The ZIP root must contain the `images` folder directly/);
  assert.match(prompt, /visually inspect all generated files/);
  assert.match(prompt, /A dancer performs for attentive children/);
  assert.match(prompt, /Do not create substitute files, thumbnails, icons, diagrams, contact sheets, SVGs/);
  const slotPrompt = buildExternalIllustrationSlotPrompt(project, slots[1]);
  assert.match(slotPrompt, /Generate exactly ONE finished illustration/);
  assert.match(slotPrompt, /A dancer performs for attentive children/);
  assert.match(slotPrompt, /simple mountain-and-shape placeholder style/);
  assert.match(slotPrompt, /Generate only CH-01-IMG-01 now/);
});

test("illustration archive matching verifies exact slots, safe paths and real raster signatures", () => {
  const slots = [{ id: "COVER", role: "cover", chapterTitle: "Front cover", filename: "images/cover.jpg", sceneBrief: "Cover", altText: "Cover", caption: "Cover", status: "pending" }, { id: "CH-01-IMG-01", role: "chapter", chapterId: 1, chapterTitle: "Chapter", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "Scene", altText: "Scene", caption: "Scene", status: "pending" }];
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 1, 2]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const result = matchExternalIllustrationArchive([{ path: "images/cover.jpg", bytes: jpeg }, { path: "images/CH-01-IMG-01.png", bytes: png }, { path: "images/unused.svg", bytes: new Uint8Array([60, 115, 118, 103]) }, { path: "../unsafe.png", bytes: png }], slots);
  assert.deepEqual(result.matches.map((match) => match.mimeType), ["image/jpeg", "image/png"]);
  assert.ok(result.issues.some((issue) => /SVG rejected/.test(issue)));
  assert.ok(result.issues.some((issue) => /Unsafe/.test(issue)));
});

test("illustration archive matching leaves missing and disguised files unresolved", () => {
  const slots = [{ id: "COVER", role: "cover", chapterTitle: "Front cover", filename: "images/cover.jpg", sceneBrief: "Cover", altText: "Cover", caption: "Cover", status: "pending" }, { id: "CH-01-IMG-01", role: "chapter", chapterId: 1, chapterTitle: "Chapter", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "Scene", altText: "Scene", caption: "Scene", status: "pending" }];
  const result = matchExternalIllustrationArchive([{ path: "images/cover.jpg", bytes: new TextEncoder().encode("not really a jpeg") }], slots);
  assert.match(result.matches[0].error, /contents are not a supported/);
  assert.match(result.matches[1].error, /Missing images\/CH-01-IMG-01\.jpg/);
});

test("site exposes the external workflow, supported imports and DOCX extraction route", () => {
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const worker = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(page, /Use ChatGPT, Claude or DeepSeek/);
  assert.match(page, /accept="\.md,\.markdown,\.txt,\.docx,\.zip"/);
  assert.match(page, /Use the simple external-AI workflow/);
  assert.match(page, /Accept manuscript & create image prompt/);
  assert.match(page, /One prompt\. One ZIP\. Automatic placement/);
  assert.match(page, /Copy complete ZIP prompt/);
  assert.match(page, /Upload the completed illustration ZIP/);
  assert.match(page, /accept="\.zip,application\/zip,application\/x-zip-compressed"/);
  assert.doesNotMatch(page, /Type NEXT/);
  assert.match(page, /Continue with pending images/);
  assert.match(worker, /\/api\/manuscript\/extract/);
  assert.match(worker, /mammoth\.extractRawText/);
});
