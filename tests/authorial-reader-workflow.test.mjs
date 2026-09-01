import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const summary = await import(new URL("../lib/child-summary.ts", import.meta.url));

test("reader-facing HTML removes provenance while private metadata can remain", () => {
  const cleaned = summary.authorialReaderHtml(`<div class="source-draft-notice"><b>EDITOR CHECK</b></div><p>This chapter explains the source clearly.</p><p class="source-note">Source note: p. 4</p><p>According to the original text, courage matters. <sup>p. 8</sup></p>`);
  assert.doesNotMatch(cleaned, /source-draft-notice|source-note|p\. 8|original text/i);
  assert.match(cleaned, /main ideas come into focus here/i);
  assert.match(cleaned, /courage matters/i);
});

test("reader cleanup removes adaptation commentary and repairs lowercase sentence openings", () => {
  const cleaned = summary.authorialReaderHtml(`<p>this chapter begins with dharma.</p><p>The source describes karma.</p><p>A seed is planted. The source explains what follows.</p><p>This adaptation keeps this chapter's religious and ethical structure while avoiding claims unsuitable for children today.</p><p>After the opening, this chapter connects duty with care.</p>`);
  assert.match(cleaned, /<p>This chapter begins with dharma\.<\/p>/);
  assert.doesNotMatch(cleaned, /This adaptation|avoiding claims|unsuitable for children today/i);
  assert.doesNotMatch(cleaned, /<p>this chapter|\bthe subject\b|\bthe source\b/);
  assert.match(cleaned, /<p>The teaching describes karma\.<\/p>/);
  assert.match(cleaned, /A seed is planted\. The teaching explains what follows\./);
});

test("reader-facing chapter titles replace demeaning or archaic headings without erasing historical terms from prose", () => {
  assert.equal(summary.readerFacingChapterTitle("The Four Castes"), "Varna: Roles and Responsibilities");
  assert.equal(summary.readerFacingChapterTitle("Virtues and Vices in Relation to Superiors"), "Duties in Relationships of Guidance");
  assert.equal(summary.readerFacingChapterTitle("Virtues and Vices in Relation to Equals"), "Virtues Among Peers");
  assert.equal(summary.readerFacingChapterTitle("Virtues and Vices in Relation to Inferiors"), "Duties Toward Those in Our Care");
  assert.equal(summary.readerFacingChapterTitle("The Re-action of Virtues and Vices on Each Other"), "How Virtues and Vices Affect One Another");
  assert.match(summary.authorialReaderHtml("<p>The historical source uses the term varna.</p>"), /varna/);
});

test("legacy workbook headings become two lighter recurring reader blocks", () => {
  const cleaned = summary.authorialReaderHtml(`<h3>IN THIS CHAPTER</h3><p>A direct opening promise.</p><h3>A meaningful idea</h3><p>Explanation.</p><h3>KEY TERMS</h3><p>Dharma means responsible conduct.</p><h3>CHECK YOUR UNDERSTANDING</h3><p>What would you choose?</p><h3>CHAPTER RECAP</h3><p>The same idea repeated.</p>`);
  assert.doesNotMatch(cleaned, /IN THIS CHAPTER|CHAPTER RECAP|same idea repeated/i);
  assert.match(cleaned, /KEY TERMS/);
  assert.match(cleaned, /THINK IT THROUGH/);
  assert.match(cleaned, /direct opening promise/i);
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
