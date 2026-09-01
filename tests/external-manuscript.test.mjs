import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assignIllustrationsToReaderPages, buildExternalAiPrompt, buildExternalIllustrationPrompt, buildExternalIllustrationPromptPack, buildExternalIllustrationSlotPrompt, createExternalIllustrationSlots, matchExternalIllustrationArchive, parseExternalManuscript, upgradeExternalIllustrationSlots } from "../lib/external-manuscript.ts";

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
  assert.match(prompt, /complete reader manuscript plus a private scene brief/i);
  assert.match(prompt, /Do not generate or embed images/);
  assert.match(prompt, /Use only two recurring learning blocks/);
  assert.match(prompt, /Anaya, Kabir, and Acharya Mira/);
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

test("external manuscript parser removes private file-manifest tails", () => {
  const result = parseExternalManuscript(`# Test Book
# INTRODUCTION
${"Introductory reader text ".repeat(100)}
# CHAPTER 01: A real chapter
## IN THIS CHAPTER
${"Substantial connected chapter text ".repeat(360)}
## KEY TERMS
Dharma means responsible conduct.
## CHECK YOUR UNDERSTANDING
What did this chapter explain?
# CONCLUSION
${"Concluding reader text ".repeat(100)}
# GLOSSARY
Dharma — responsible conduct.
## MANUSCRIPT FILE MANIFEST
01-a-real-chapter.md: 720 words`, "Ages 10–12");

  const glossary = result.sections.find((section) => section.kind === "glossary");
  assert.ok(glossary);
  assert.doesNotMatch(glossary.raw, /MANUSCRIPT FILE MANIFEST/i);
  assert.doesNotMatch(glossary.html, /\.md:\s*\d+\s+words/i);
  assert.ok(result.issues.some((issue) => /private production metadata/i.test(issue)));
});

test("approved manuscript creates one cover and one stable image slot per narrative section", () => {
  const result = parseExternalManuscript(`# Book\n\n# INTRODUCTION\n${"welcome ".repeat(100)}\n\n# CHAPTER 01: First light\n## IN THIS CHAPTER\nA promise.\n## STORY\n${"A child watches a craftsperson prepare pigments in a sunlit courtyard. ".repeat(45)}\n## KEY TERMS\nPigment means colour material.\n## CHECK YOUR UNDERSTANDING\nWhat did you notice?\n## CHAPTER RECAP\nColour begins with careful work.\n\n# CONCLUSION\n${"together ".repeat(100)}`, settings.audience);
  const slots = createExternalIllustrationSlots(result, settings.title);
  assert.deepEqual(slots.map((slot) => slot.id), ["COVER", "CH-01-IMG-01", "CH-02-IMG-01", "CH-03-IMG-01"]);
  assert.deepEqual(slots.slice(1).map((slot) => slot.chapterId), [1, 2, 3]);
  assert.match(slots[2].sceneBrief, /craftsperson prepare pigments/);
  assert.equal(slots[2].filename, "images/CH-02-IMG-01.jpg");
});

test("long chapters still receive one dependable illustration slot", () => {
  const longChapter = {
    title: "Book",
    issues: [],
    words: 1300,
    sections: [{ kind: "chapter", title: "A long journey", raw: "Opening scene. " + "Distinct source-grounded action. ".repeat(220), html: "", wordCount: 1300, issues: [] }],
  };
  const slots = createExternalIllustrationSlots(longChapter, "Book");
  assert.deepEqual(slots.map((slot) => slot.id), ["COVER", "CH-01-IMG-01"]);
  assert.deepEqual(slots.slice(1).map((slot) => slot.placement), ["chapter-middle"]);
});

test("sequential prompt pack creates one independently runnable prompt per exact destination", () => {
  const slots = createExternalIllustrationSlots(parseExternalManuscript(`# Book\n# INTRODUCTION\n${"Welcome ".repeat(100)}\n# CHAPTER 01: First light\n${"A child observes a lamp being prepared carefully. ".repeat(160)}\n## KEY TERMS\nLight means illumination.\n## THINK IT THROUGH\nWhat changed?\n# CONCLUSION\n${"Together ".repeat(100)}`, settings.audience), settings.title);
  const project = { ...settings, chapters: [{ id: 2, title: "First light", body: "A child observes a lamp being prepared carefully." }], slots };
  const pack = buildExternalIllustrationPromptPack(project);
  assert.equal(pack.prompts.length, slots.length);
  assert.deepEqual(pack.prompts.map((item) => item.slotId), slots.map((slot) => slot.id));
  assert.ok(pack.prompts.every((item) => /Generate exactly ONE finished illustration/.test(item.content)));
  assert.match(pack.manifest, /Generate each prompt as a separate image operation/i);
  assert.match(pack.manifest, /automatic placement/i);
  assert.doesNotMatch(pack.manifest, /generate (?:all|every) images? in one (?:generation|response)/i);
});

test("ready illustrations are assigned to their requested chapter positions without dropping prose", () => {
  const pages = assignIllustrationsToReaderPages(["<p>Opening prose.</p>", "<p>Middle prose.</p>", "<p>Reflection prose.</p>"], [
    { id: "CH-01-IMG-01", role: "chapter", chapterTitle: "Chapter", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "Opening", altText: "Opening image", caption: "Opening caption", imageIndex: 1, placement: "after-opening", status: "ready", imageUrl: "/opening.jpg", imageKey: "opening" },
    { id: "CH-01-IMG-02", role: "chapter", chapterTitle: "Chapter", filename: "images/CH-01-IMG-02.jpg", sceneBrief: "Reflection", altText: "Reflection image", caption: "Reflection caption", imageIndex: 2, placement: "before-reflection", status: "ready", imageUrl: "/reflection.jpg", imageKey: "reflection" },
  ]);
  assert.deepEqual(pages.map((page) => page.body), ["<p>Opening prose.</p>", "<p>Middle prose.</p>", "<p>Reflection prose.</p>"]);
  assert.equal(pages[0].imageUrl, "/opening.jpg");
  assert.equal(pages[2].imageUrl, "/reflection.jpg");
});

test("older one-image chapter plans upgrade without losing an approved image", () => {
  const existing = [{ id: "COVER", role: "cover", chapterTitle: "Front cover", filename: "images/cover.jpg", sceneBrief: "Cover", altText: "Cover", caption: "Cover", status: "pending" }, { id: "CH-01-IMG-01", role: "chapter", chapterId: 2, chapterTitle: "Long chapter", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "Opening scene", altText: "Opening", caption: "Opening", status: "ready", imageUrl: "/approved.jpg", imageKey: "approved" }];
  const upgraded = upgradeExternalIllustrationSlots([{ id: 2, title: "Long chapter", body: "<p>" + "Substantial narrative explanation. ".repeat(250) + "</p>", wordCount: 1000 }], existing);
  assert.deepEqual(upgraded.map((slot) => slot.id), ["COVER", "CH-01-IMG-01"]);
  assert.equal(upgraded[1].imageUrl, "/approved.jpg");
});

test("second-stage manifest requires sequential, quality-checked image operations", () => {
  const slots = [{ id: "COVER", role: "cover", chapterTitle: "Front cover", filename: "images/cover.jpg", sceneBrief: "Cover", altText: "Cover", caption: "Cover", status: "pending" }, { id: "CH-01-IMG-01", role: "chapter", chapterId: 1, chapterTitle: "Seeing Rasa", filename: "images/CH-01-IMG-01.jpg", sceneBrief: "A dancer performs for attentive children", altText: "Children watching a dancer", caption: "Expression and attention", status: "pending" }];
  const project = { ...settings, chapters: [{ id: 1, title: "Seeing Rasa", body: "A chapter about expression, gesture and an attentive audience." }], slots };
  const prompt = buildExternalIllustrationPrompt(project);
  assert.match(prompt, /SEQUENTIAL ILLUSTRATION MANIFEST/);
  assert.match(prompt, /Do NOT produce SVG/);
  assert.match(prompt, /Do NOT imitate the simple diagram-like placeholder artwork/);
  assert.match(prompt, /separate image operation/i);
  assert.match(prompt, /ZIP that folder for automatic placement/i);
  assert.match(prompt, /Exact ZIP path: images\/CH-01-IMG-01\.jpg/);
  assert.match(prompt, /The ZIP root must contain the `images` folder directly/);
  assert.match(prompt, /visually inspect each result/);
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
  assert.match(page, /One image at a time\. One final ZIP\. Automatic placement/);
  assert.match(page, /Download sequential prompt pack/);
  assert.match(page, /Upload the completed illustration ZIP/);
  assert.match(page, /accept="\.zip,application\/zip,application\/x-zip-compressed"/);
  assert.doesNotMatch(page, /Type NEXT/);
  assert.match(page, /Continue with pending images/);
  assert.match(worker, /\/api\/manuscript\/extract/);
  assert.match(worker, /mammoth\.extractRawText/);
});
