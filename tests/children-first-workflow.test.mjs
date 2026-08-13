import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const summary = await import(new URL("../lib/child-summary.ts", import.meta.url));

test("the new-book workflow is limited to children aged 7 to 15", () => {
  for (const ageBand of ["Ages 7–9", "Ages 10–12", "Ages 13–15"]) assert.match(page, new RegExp(ageBand));
  assert.doesNotMatch(page, /<option>General readers \(18\+\)<\/option>/);
  assert.doesNotMatch(page, /<option>University students<\/option>/);
  assert.doesNotMatch(page, /<option>Formal and academic<\/option>/);
  assert.match(page, /Built first for children aged 7–15/);
});

test("the writing-style step is removed and the wizard has four steps", () => {
  assert.match(page, /const wizardSteps = \["Source", "Reader", "Design", "Review"\]/);
  assert.match(page, /STEP \{step \+ 1\} OF 4/);
  assert.doesNotMatch(page, /WRITING MODE/);
  assert.doesNotMatch(page, /Friendly guide|Story journey|Curious explorer/);
  assert.doesNotMatch(page, /focus="writing"/);
  assert.match(page, /Natural writing is automatic/);
});

test("reader and design choices show a live book glimpse", () => {
  assert.match(page, /function BookGlimpse/);
  assert.match(page, /LIVE BOOK & PAGE GLIMPSE/);
  assert.match(page, /See every important page before you build/);
  assert.match(page, /focus="reader"/);
  assert.match(page, /focus="design"/);
  assert.match(css, /\.glimpse-spread/);
  assert.match(css, /\.age-7-9 \.glimpse-page>p/);
});

test("one pedagogy pipeline changes prose requirements only by age band", () => {
  assert.match(worker, /buildPedagogicalDraft/);
  assert.match(worker, /efficientChapterPrompt/);
  assert.match(worker, /reviewPrompt/);
  assert.match(worker, /generationProfileKey/);
  assert.doesNotMatch(worker, /childWritingMode|modeParagraphParts|modeEvidenceOrder/);

  const sentence = "The council consequently constitutes the main body, and its members consider how duties should be shared between the different offices.";
  const common = { sentence, focus: "council", related: "duties", chapterTitle: "The Council", paragraphIndex: 0 };
  const early = summary.ageParagraphText({ ...common, audience: "Ages 7–9" });
  const middle = summary.ageParagraphText({ ...common, audience: "Ages 10–12" });
  const teen = summary.ageParagraphText({ ...common, audience: "Ages 13–15" });
  assert.notEqual(early, middle);
  assert.notEqual(middle, teen);
  assert.notEqual(early, teen);
  assert.match(early, /so forms/i);
  assert.doesNotMatch(early, /This means .* are connected/i);
  assert.doesNotMatch(middle, /Together, these ideas show why/i);
  assert.match(teen, /wider context|wider consequences/);
});

test("generation profiles invalidate drafts made for another age or language", () => {
  const early = summary.generationProfileKey("Ages 7–9", "English");
  const teen = summary.generationProfileKey("Ages 13–15", "English");
  const hindi = summary.generationProfileKey("Ages 7–9", "Hindi");
  assert.notEqual(early, teen);
  assert.notEqual(early, hindi);
  assert.match(early, /authorial:7-9:english/);
  assert.match(page, /Build reviewed lessons for \$\{project\.audience\}/);
});

test("three child-friendly book worlds replace academic design controls", () => {
  for (const world of ["Storybook India", "Bright Explorer", "Young Scholar"]) assert.match(page, new RegExp(world));
  assert.match(page, /function designWorldPatch/);
  assert.match(css, /\.world-storybook-india/);
  assert.match(css, /\.world-bright-explorer/);
  assert.match(css, /\.world-young-scholar/);
});
