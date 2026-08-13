import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("every chapter exposes the five durable generation states", () => {
  for (const state of ["Waiting", "Generating", "Completed", "Needs review", "Paused by quota"]) {
    assert.match(page, new RegExp(state));
  }
  assert.match(page, /generationStatus\?: ChapterGenerationStatus/);
  assert.match(page, /generationUsage\?: GenerationUsage/);
});

test("the previous project version is preserved before each chapter starts", () => {
  const preserve = page.indexOf("await preserveGenerationVersion(workingProject, currentChapter)");
  const generating = page.indexOf('generationStatus: "Generating" as const', preserve);
  const draftRequest = page.indexOf('fetch("/api/draft"', generating);
  assert.ok(preserve >= 0);
  assert.ok(generating > preserve);
  assert.ok(draftRequest > generating);
  assert.match(page, /Before Chapter.*generation/);
});

test("completed chapters save usage immediately and resume skips them", () => {
  assert.match(page, /chapter\.generationStatus !== "Completed" \|\| chapter\.generationProfile !== selectedProfile/);
  assert.match(page, /generationStatus: "Completed" as const/);
  assert.match(page, /generationUsage: \{/);
  assert.match(page, /await persistProject\(workingProject\)/);
  assert.match(page, /Resume will continue from the first unfinished chapter/);
});

test("quota and quality failures keep earlier content and become resumable states", () => {
  assert.match(page, /response\.status === 429 \|\| response\.status === 402 \? "Paused by quota" : "Needs review"/);
  assert.match(page, /generationError: data\.error \|\| "Chapter drafting failed"/);
  assert.match(css, /generation-paused-by-quota/);
  assert.match(css, /generation-needs-review/);
});
