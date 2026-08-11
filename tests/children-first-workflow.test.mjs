import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("the new-book workflow is limited to children aged 7 to 15", () => {
  for (const ageBand of ["Ages 7–9", "Ages 10–12", "Ages 13–15"]) assert.match(page, new RegExp(ageBand));
  assert.doesNotMatch(page, /<option>General readers \(18\+\)<\/option>/);
  assert.doesNotMatch(page, /<option>University students<\/option>/);
  assert.doesNotMatch(page, /<option>Formal and academic<\/option>/);
  assert.match(page, /Built first for children aged 7–15/);
});

test("reader, writing and design choices show a live book glimpse", () => {
  assert.match(page, /function BookGlimpse/);
  assert.match(page, /LIVE BOOK GLIMPSE/);
  assert.match(page, /This is how the choice feels/);
  assert.match(page, /focus="reader"/);
  assert.match(page, /focus="writing"/);
  assert.match(page, /focus="design"/);
  assert.match(css, /\.glimpse-spread/);
  assert.match(css, /\.age-7-9 \.glimpse-page>p/);
});

test("writing choices change generated chapter structure", () => {
  for (const mode of ["Friendly guide", "Story journey", "Curious explorer"]) assert.match(page, new RegExp(mode));
  assert.match(worker, /function childWritingProfile/);
  assert.match(worker, /child-opening-\$\{writing\.id\}/);
  assert.match(worker, /writing\.sectionTitles/);
  assert.match(worker, /writing\.bridges/);
  assert.match(worker, /writing\.activityLabel/);
  assert.match(page, /learningFeatures: project\.learningFeatures/);
});

test("three child-friendly book worlds replace academic design controls", () => {
  for (const world of ["Storybook India", "Bright Explorer", "Young Scholar"]) assert.match(page, new RegExp(world));
  assert.match(page, /function designWorldPatch/);
  assert.match(css, /\.world-storybook-india/);
  assert.match(css, /\.world-bright-explorer/);
  assert.match(css, /\.world-young-scholar/);
});
