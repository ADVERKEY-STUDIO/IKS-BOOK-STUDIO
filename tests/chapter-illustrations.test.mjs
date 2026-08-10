import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

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
  const assignmentPosition = page.indexOf("const illustratedChapters = hierarchy.chapters.map");
  assert.ok(repairPosition >= 0, "chapter hierarchy repair is present");
  assert.ok(assignmentPosition > repairPosition, "all final chapters receive art after their titles are repaired");
  assert.match(page, /curatedIllustration\(chapter\.title, chapter\.body, chapter\.id\)/);
  assert.match(page, /return fallback\[Math\.abs\(id - 1\) % fallback\.length\]/);
  assert.match(page, /chapters: illustratedChapters/);
});
