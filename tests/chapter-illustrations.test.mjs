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
