import assert from "node:assert/strict";
import test from "node:test";

import { assessPublication, paginateContents, pdfRasterSettings, sanitizeReaderHtml } from "../lib/publication.ts";

test("long contents lists split into stable pages without losing chapters", () => {
  const chapters = Array.from({ length: 27 }, (_, index) => ({
    id: index + 1,
    title: `Chapter ${index + 1}`,
    pages: 3,
  }));
  const counts = new Map(chapters.map((chapter) => [chapter.id, chapter.id === 27 ? 4 : 3]));
  const pages = paginateContents(chapters, counts, 15);

  assert.equal(pages.length, 2);
  assert.deepEqual(pages.flat().map((entry) => entry.title), chapters.map((chapter) => chapter.title));
  assert.equal(pages[1].at(-1)?.pageCount, 4);
  assert.equal(pages[0][0].startPage, 1);
  assert.equal(pages[0][1].startPage, 4);
  assert.equal(pages[1].at(-1)?.startPage, 79);
  assert.equal(pages[1].at(-1)?.ordinal, 27);
});

test("long publication PDFs use a bounded raster memory profile", () => {
  assert.deepEqual(pdfRasterSettings(83, "publication"), { scale: 1.7, quality: 0.84 });
  assert.deepEqual(pdfRasterSettings(12, "publication"), { scale: 2.5, quality: 0.92 });
  assert.deepEqual(pdfRasterSettings(83, "draft"), { scale: 1.45, quality: 0.78 });
});

test("publication readiness rejects missing visuals and private production text", () => {
  const result = assessPublication([
    {
      id: 1,
      title: "Ready prose, unfinished production",
      body: "<p>Reader-facing chapter.</p><h2>MANUSCRIPT FILE MANIFEST</h2>",
      importValidated: true,
      manualApproved: true,
      visualType: "illustration-pending",
    },
  ]);

  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing-illustration"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "private-production-text"));
});

test("a partially illustrated chapter remains blocked even when its first image exists", () => {
  const result = assessPublication([{ id: 1, title: "Only the first image arrived", body: "<p>Complete prose.</p>", importValidated: true, imageUrl: "/first.jpg", visualType: "illustration-pending" }]);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing-illustration"));
});

test("every narrative chapter requires an actual illustration even when visualType metadata is absent", () => {
  const result = assessPublication([{ id: 1, title: "The One Existence", body: "<p>Complete prose.</p>", importValidated: true }]);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing-illustration"));
});

test("reference matter may remain text-only without blocking publication", () => {
  const result = assessPublication([{ id: 27, title: "Glossary", body: "<p>Atma — the Self.</p>", importValidated: true }]);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("explicitly skipped narrative illustrations still block the publication PDF", () => {
  const result = assessPublication([
    {
      id: 1,
      title: "Intentionally text only",
      body: "<p>Complete reader-facing chapter.</p>",
      importValidated: true,
      visualType: "illustration-skipped",
    },
  ]);

  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((blocker) => blocker.code === "missing-illustration"));
});

test("reader rendering removes a private production tail without rewriting the manuscript", () => {
  const manuscript = "<p>Reader chapter.</p><h2>MANUSCRIPT FILE MANIFEST</h2><p>chapter-01.md: 700 words</p>";
  assert.equal(sanitizeReaderHtml(manuscript), "<p>Reader chapter.</p>");
  assert.match(manuscript, /MANUSCRIPT FILE MANIFEST/);
});

test("reader rendering removes explicitly tagged internal blocks", () => {
  const html = `<p>Customer text.</p><section data-publication="internal"><h2>Build notes</h2><p>Do not print.</p></section><div class="manifest-page">files.md: 800 words</div><p>Closing text.</p>`;
  const cleaned = sanitizeReaderHtml(html);
  assert.match(cleaned, /Customer text/);
  assert.match(cleaned, /Closing text/);
  assert.doesNotMatch(cleaned, /Build notes|Do not print|files\.md|manifest-page/);
});
