import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const packageTools = await import(new URL("../lib/book-package.ts", import.meta.url));

const plan = [
  { id: 1, title: "Foundations of the Arthashastra" },
  { id: 2, title: "Knowledge and Learning" },
];

function validPackage() {
  return {
    format: "iks-book-package-v1",
    bookTitle: "The Art of Wise Governance",
    audience: "Ages 10–12",
    chapters: plan.map((chapter, index) => ({
      chapterId: packageTools.expectedChapterId(index + 1),
      chapterNumber: index + 1,
      title: chapter.title,
      contextKey: packageTools.expectedContextKey(index + 1, chapter.title),
      pages: [{
        pageId: packageTools.expectedPageId(index + 1, 1),
        pageNumber: 1,
        purpose: "Teach this chapter's central idea",
        text: `Distinct reader-facing explanation for ${chapter.title} with enough words to identify the page uniquely and preserve its exact destination in the imported book package.`,
        image: { fileName: `chapter-0${index + 1}-page-01.webp` },
      }],
    })),
  };
}

test("a complete package with locked chapter and page IDs is accepted", () => {
  const result = packageTools.validateBookPackage(validPackage(), plan, "Ages 10–12");
  assert.equal(result.errors.length, 0);
  assert.equal(result.chapterCount, 2);
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.imageNames, ["chapter-01-page-01.webp", "chapter-02-page-01.webp"]);
});

test("text or images cannot silently cross chapter boundaries", () => {
  const mixed = validPackage();
  mixed.chapters[1].title = plan[0].title;
  mixed.chapters[1].pages[0].image.fileName = "chapter-01-page-01-extra.webp";
  const result = packageTools.validateBookPackage(mixed, plan, "Ages 10–12");
  assert.ok(result.errors.some((error) => /does not match the approved plan title/.test(error)));
  assert.ok(result.errors.some((error) => /not named for chapter-02/.test(error)));
});

test("page IDs and substantial duplicated text are rejected", () => {
  const duplicated = validPackage();
  duplicated.chapters[1].pages[0].pageId = "chapter-01-page-01";
  duplicated.chapters[1].pages[0].text = duplicated.chapters[0].pages[0].text;
  const result = packageTools.validateBookPackage(duplicated, plan, "Ages 10–12");
  assert.ok(result.errors.some((error) => /must use ID chapter-02-page-01/.test(error)));
  assert.ok(result.errors.some((error) => /repeats substantial text/.test(error)));
});

test("the UI exchanges one request ZIP and one completed ZIP", () => {
  assert.match(page, /Download ChatGPT Book Request/);
  assert.match(page, /Choose Completed Book ZIP/);
  assert.match(page, /unzipSync/);
  assert.doesNotMatch(page, /Choose JSON manifest/);
  assert.doesNotMatch(page, /Choose all page images/);
  assert.match(page, /importedPages\.map/);
  assert.match(page, /Nothing is guessed or moved/);
  assert.match(page, /exact-import-page/);
  assert.match(css, /\.package-import-modal/);
});

test("template and placeholder page text is rejected", () => {
  const unfinished = validPackage();
  unfinished.chapters[0].pages[0].text = "Replace this with the final reader-facing text for this exact page.";
  const result = packageTools.validateBookPackage(unfinished, plan, "Ages 10–12");
  assert.ok(result.errors.some((error) => /placeholder text/.test(error)));
});
