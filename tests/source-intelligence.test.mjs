import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifySource, ocrEstimate, outlineForMode, pdfChunkRanges, recoverOcrPageTexts, SAFE_OCR_CHUNK_BYTES, SAFE_OCR_CHUNK_PAGES, validateOutline } from "../lib/source-intelligence.ts";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");

test("scanned, mixed, and searchable sources are classified without AI", () => {
  assert.equal(classifySource(Array(12).fill(""), 125).sourceKind, "scanned");
  assert.equal(classifySource(["", "Readable source text ".repeat(20), "", "Readable chapter text ".repeat(20)], 4).sourceKind, "mixed");
  assert.equal(classifySource(Array(12).fill("Readable searchable source text ".repeat(20)), 12).sourceKind, "searchable");
});

test("large PDFs are split into bounded physical page ranges", () => {
  const ranges = pdfChunkRanges(125, SAFE_OCR_CHUNK_PAGES);
  assert.equal(ranges.length, 32);
  assert.deepEqual(ranges[0], { startPage: 1, endPage: 4, index: 0 });
  assert.deepEqual(ranges.at(-1), { startPage: 125, endPage: 125, index: 31 });
  assert.equal(SAFE_OCR_CHUNK_BYTES, 3_250_000);
  assert.match(page, /PDFDocument\.load/);
  assert.match(page, /prepareRange\(startPage, midpoint\)/);
  assert.match(worker, /SAFE_OCR_CHUNK_BYTES \+ 250_000/);
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
  assert.match(page, /Analyse source with Nemotron/);
  assert.match(page, /Use free parser/);
  assert.match(worker, /plugins: \[\{ id: "file-parser"/);
});

test("OCR batches are cached before one text-only Nemotron outline pass", () => {
  assert.match(page, /\/api\/source\/ocr-chunk/);
  assert.match(worker, /chunk\.ocrPageTexts = result\.pageTexts/);
  assert.match(worker, /sourceStructureEvidence\(manifest\)/);
  assert.match(worker, /openRouterOutlineFromOcr/);
  assert.match(worker, /Every source page is cached/);
});

test("OCR page recovery accepts markers, form feeds, and complete legacy JSON", () => {
  assert.deepEqual(recoverOcrPageTexts("<<<PDF_PAGE_1>>>\nFirst page\n<<<END_PDF_PAGE_1>>>\n<<<PDF_PAGE_2>>>\nSecond page\n<<<END_PDF_PAGE_2>>>", 2), ["First page", "Second page"]);
  assert.deepEqual(recoverOcrPageTexts("First page\fSecond page", 2), ["First page", "Second page"]);
  assert.deepEqual(recoverOcrPageTexts('{"pages":[{"text":"First page"},{"text":"Second page"}]}', 2), ["First page", "Second page"]);
  assert.deepEqual(recoverOcrPageTexts('{"pages":[{"text":"Only the first page"}', 2), []);
  assert.doesNotMatch(worker.slice(worker.indexOf("async function openRouterOcrChunk"), worker.indexOf("function sourceStructureEvidence")), /response_format/);
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
