import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("curated chapter illustrations are packaged and assigned", async () => {
  const images = [
    "concept-indian-aesthetics.webp",
    "origin-and-concept.webp",
    "structure-and-design.webp",
    "rasa-bhava.png",
    "dhvani-poetics.png",
    "natya-performance.png",
  ];
  for (const image of images) {
    await access(new URL(`../public/illustrations/${image}`, import.meta.url));
    assert.match(page, new RegExp(image.replaceAll(".", "\\.")));
  }
});

test("finished illustrations replace direction placeholders and remain print-safe", () => {
  assert.match(page, /has-chapter-image/);
  assert.match(css, /\.has-chapter-image \.illustration\{display:none\}/);
  assert.match(css, /\.chapter-image img\{max-height:92mm;object-fit:contain\}/);
});

test("illustrations are assigned after chapter hierarchy repair", () => {
  const repairPosition = page.indexOf("const hierarchy = repairChapterHierarchy(normalizedChapters)");
  const assignmentPosition = page.indexOf("const illustratedChapters = attachChapterVisuals");
  assert.ok(repairPosition >= 0, "chapter hierarchy repair is present");
  assert.ok(assignmentPosition > repairPosition, "all final chapters receive art after their titles are repaired");
  assert.match(page, /contextualIllustration\(project, chapter, index\)/);
  assert.match(page, /chapters: illustratedChapters/);
});

test("every newly uploaded adaptation receives one contextual visual per chapter", () => {
  assert.match(page, /const chapters = attachChapterVisuals\(\{ \.\.\.project, sourceTerms: source\.terms \}, sourceChapters\)/);
  assert.match(page, /chapters: attachChapterVisuals\(\{ \.\.\.project, sourceTerms: source\.terms \}, reconcileOriginalChapters/);
  assert.match(page, /const next = \{ \.\.\.project, chapters: attachChapterVisuals\(project, merged\) \}/);
  assert.match(page, /if \(chapter\.imageKey && chapter\.imageUrl\) return chapter/);
});

test("generic books use chapter-aware visual fallbacks instead of Arthashastra art", () => {
  for (const visualType of ["map", "venn", "tree", "timeline", "cycle", "concept"]) {
    assert.match(worker, new RegExp(`\\"${visualType}\\"`));
  }
  assert.match(worker, /url\.pathname === "\/api\/visual"/);
  assert.match(worker, /GENERATED FROM THE CHAPTER CONTEXT/);
  assert.match(page, /visualKeywords\(chapter\.title, chapter\.body, project\.sourceTerms\)/);
  assert.doesNotMatch(page, /return fallback\[/);
});
