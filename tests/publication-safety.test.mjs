import assert from "node:assert/strict";
import test from "node:test";

import { assessPublication, paginateContents, sanitizeReaderHtml } from "../lib/publication.ts";

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
  assert.equal(pages[1].at(-1)?.ordinal, 27);
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

test("explicitly skipped illustrations do not block publication", () => {
  const result = assessPublication([
    {
      id: 1,
      title: "Intentionally text only",
      body: "<p>Complete reader-facing chapter.</p>",
      importValidated: true,
      visualType: "illustration-skipped",
    },
  ]);

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("reader rendering removes a private production tail without rewriting the manuscript", () => {
  const manuscript = "<p>Reader chapter.</p><h2>MANUSCRIPT FILE MANIFEST</h2><p>chapter-01.md: 700 words</p>";
  assert.equal(sanitizeReaderHtml(manuscript), "<p>Reader chapter.</p>");
  assert.match(manuscript, /MANUSCRIPT FILE MANIFEST/);
});
