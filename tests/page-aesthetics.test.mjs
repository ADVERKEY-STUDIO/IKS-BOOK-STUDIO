import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("three page aesthetics can be selected independently of the illustration world", () => {
  for (const aesthetic of ["Heritage Frame", "Playful Panels", "Calm Editorial"]) {
    assert.match(page, new RegExp(aesthetic));
  }
  assert.match(page, /pageAesthetic: string/);
  assert.match(page, /function pageAestheticPatch/);
  assert.match(page, /PAGE AESTHETIC · APPLIES TO EVERY PAGE/);
  assert.match(page, /value=\{project\.pageAesthetic\}/);
});

test("the live glimpse exposes every important page type", () => {
  assert.match(page, /LIVE BOOK & PAGE GLIMPSE/);
  for (const pageType of ["Chapter opener", "Reading page", "Visual page", "Activity page"]) {
    assert.match(page, new RegExp(pageType));
  }
  assert.match(page, /glimpse-tabs/);
  assert.match(page, /glimpse-page-\$\{previewPage\}/);
  assert.match(css, /\.glimpse-concept-map/);
  assert.match(css, /\.glimpse-activity-card/);
});

test("selected page aesthetics reach the editor, preview and print output", () => {
  assert.match(page, /page-aesthetic-\$\{pageClass\}/);
  assert.match(page, /const pageClass = `page-aesthetic-/);
  assert.match(css, /\.paper\.page-aesthetic-heritage-frame/);
  assert.match(css, /\.preview-page\.page-aesthetic-playful-panels/);
  assert.match(css, /\.preview-page\.page-aesthetic-calm-editorial/);
  assert.match(css, /@media print\{[^}]*page-aesthetic-playful-panels/);
});

test("older saved books receive a safe page-aesthetic default", () => {
  assert.match(page, /pageAesthetic\(cleanSaved\.pageAesthetic \?\? ""\)/);
  assert.match(page, /pageAesthetic: pages\.value/);
});
