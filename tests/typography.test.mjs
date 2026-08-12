import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("offers three independent whole-book typography choices", () => {
  assert.match(page, /const typographyThemes = \[/);
  assert.match(page, /Storybook Serif/);
  assert.match(page, /Friendly Rounded/);
  assert.match(page, /Clear Reader/);
  assert.match(page, /function typographyPatch/);
  assert.doesNotMatch(page, /illustrationStyle: world\.illustrationStyle,\s*fontTheme:/);
});

test("shows typography specimens and applies the choice to every book surface", () => {
  assert.match(page, /TypographyPicker/);
  assert.match(page, /LIVE BOOK & PAGE GLIMPSE/);
  assert.match(page, /dataset\.bookTypography/);
  assert.match(page, /editor-typography-select/);
  assert.match(css, /\.typography-storybook-serif/);
  assert.match(css, /\.typography-friendly-rounded/);
  assert.match(css, /\.typography-clear-reader/);
  assert.match(css, /@media print\{\.typography-storybook-serif/);
  assert.match(css, /data-book-typography="friendly-rounded"/);
});

test("preserves typography in saved projects and DOCX exports", () => {
  assert.match(page, /typographyTheme\(cleanSaved\.fontTheme \?\? ""\)/);
  assert.match(page, /fontTheme: typography\.value/);
  assert.match(worker, /const docxFont =/);
  assert.match(worker, /font: docxFont/);
});
