import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifySource, ocrEstimate, outlineForMode, pdfChunkRanges, validateOutline } from "../lib/source-intelligence.ts";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");

test("scanned, mixed, and searchable sources are classified without AI", () => {
  assert.equal(classifySource(Array(12).fill(""), 125).sourceKind, "scanned");
  assert.equal(classifySource(["", "Readable source text ".repeat(20), "", "Readable chapter text ".repeat(20)], 4).sourceKind, "mixed");
  assert.equal(classifySource(Array(12).fill("Readable searchable source text ".repeat(20)), 12).sourceKind, "searchable");
});

test("large PDFs are split into bounded physical page ranges", () => {
  const ranges = pdfChunkRanges(125, 10);
  assert.equal(ranges.length, 13);
  assert.deepEqual(ranges[0], { startPage: 1, endPage: 10, index: 0 });
  assert.deepEqual(ranges.at(-1), { startPage: 121, endPage: 125, index: 12 });
  assert.match(page, /PDFDocument\.load/);
  assert.match(worker, /file\.size > 28 \* 1024 \* 1024/);
});

test("generic fallback chapters are rejected", () => {
  const result = validateOutline([{ id: "x", type: "chapter", title: "Opening chapter", sourceStartPage: 1, sourceEndPage: 10, confidence: .9, included: true }], 125);
  assert.ok(result.errors.some((message) => /Generic fallback/i.test(message)));
  assert.doesNotMatch(page.slice(page.indexOf("function Analysis("), page.indexOf("function LegacyAnalysis(")), /\["Opening chapter"\]/);
});

test("outline review can choose major Parts or detailed chapters", () => {
  const outline = [
    { id: "p1", type: "part", title: "Part I", sourceStartPage: 10, sourceEndPage: 60, confidence: .9, included: true },
    { id: "c1", type: "chapter", title: "Chapter One", sourceStartPage: 12, sourceEndPage: 24, confidence: .9, included: true, parentId: "p1" },
  ];
  assert.deepEqual(outlineForMode(outline, "parts").map((item) => item.id), ["p1"]);
  assert.deepEqual(outlineForMode(outline, "chapters").map((item) => item.id), ["c1"]);
  assert.match(page, /Build from major Parts/);
  assert.match(page, /Build from detailed chapters/);
});

test("scan OCR is explicit and shows the accurate-parser estimate", () => {
  assert.equal(ocrEstimate(125), .25);
  assert.match(page, /Try free OCR first/);
  assert.match(page, /Use accurate scan OCR/);
  assert.match(worker, /plugins: \[\{ id: "file-parser"/);
});

test("scanned chapter generation sends only overlapping verified chunks", () => {
  assert.match(worker, /chunk\.endPage >= start && chunk\.startPage <= end/);
  assert.match(worker, /relevant\.slice\(0, 3\)/);
  assert.match(worker, /sourceDigest/);
  assert.match(worker, /buildPedagogicalDraft\([^\n]+scannedInitial\)/);
});

test("source state is resumable and stored in the R2 manifest", () => {
  assert.match(worker, /manifest\.json/);
  assert.match(worker, /cacheKey:/);
  assert.match(worker, /status: "outline-review"/);
  assert.match(page, /sourceIntelligence\?: SourceIntelligence/);
});
