import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const summary = await import(new URL("../lib/child-summary.ts", import.meta.url));

test("reader-facing HTML removes provenance while private metadata can remain", () => {
  const cleaned = summary.authorialReaderHtml(`<div class="source-draft-notice"><b>EDITOR CHECK</b></div><p>This chapter explains the source clearly.</p><p class="source-note">Source note: p. 4</p><p>According to the original text, courage matters. <sup>p. 8</sup></p>`);
  assert.doesNotMatch(cleaned, /source-draft-notice|source-note|p\. 8|original text/i);
  assert.match(cleaned, /introduces the main ideas clearly/i);
  assert.match(cleaned, /courage matters/i);
});

test("preview and editable export present a finished author-written book", () => {
  assert.doesNotMatch(page, /<span>Adapted from \{project\.source\}<\/span>/);
  assert.doesNotMatch(page, /EDITOR’S SOURCE NOTES/);
  assert.match(page, /Written to invite curiosity, imagination and thoughtful questions/);
  assert.match(page, /These notes never appear in Preview, PDF or DOCX/);
  assert.doesNotMatch(worker, /new Paragraph\(\{ text: `Adapted from/);
  assert.doesNotMatch(worker, /children\.push\(new Paragraph\(\{ text: "Source notes"/);
  assert.match(worker, /manuscriptParagraphs\(authorialReaderHtml/);
});

test("all new and refreshed drafts use the authorial generation profile", () => {
  assert.match(summary.AUTHORIAL_READER_INSTRUCTION, /Write as the author/);
  assert.match(summary.generationProfileKey("Ages 10–12", "English"), /authorial:10-12:english/);
  assert.doesNotMatch(worker, /This chapter explains the source clearly/);
  assert.doesNotMatch(worker, /evidence from the source supports your view/);
  assert.doesNotMatch(worker, /<sup>\$\{pair/);
});
