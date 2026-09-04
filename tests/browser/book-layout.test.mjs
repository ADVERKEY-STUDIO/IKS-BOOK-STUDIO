import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const repoRoot = process.env.IKS_REPO_ROOT ?? process.cwd();
const repoRequire = createRequire(resolve(repoRoot, "package.json"));
const ts = repoRequire("typescript");
const { chromium } = repoRequire(process.env.IKS_PLAYWRIGHT_MODULE || "playwright");
const source = ts.transpileModule(readFileSync(resolve(repoRoot, "lib/book-layout.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const browser = await chromium.launch({ headless: true });
after(async () => { await browser.close(); });
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
await page.evaluate((code) => {
  const exports = {};
  new Function("exports", code)(exports);
  globalThis.bookLayout = exports;
}, source);

test("flow extraction keeps nested story formatting, anchors, artwork and captions in authored order", async () => {
  const result = await page.evaluate(() => {
    const html = '<header class="print-chapter-header">CHAPTER 1</header><h2>Opening chapter</h2><div class="preview-body"><p id="opening">A <em>meaningful</em> <a href="#figure-one">idea</a>.</p><section id="reader-section"><h3>Look carefully</h3><p><span data-reader="yes">Read this first.</span></p></section><figure id="figure-one"><img src="/illustration.png" alt="An idea"><figcaption>Keep this caption with its image.</figcaption></figure><p id="closing">Now consider the picture.</p></div><footer class="sheet-number">12</footer>';
    const output = bookLayout.pageFlowHtml(html);
    const root = document.createElement("div"); root.innerHTML = output;
    return {
      ids: [...root.querySelectorAll("[id]")].map((element) => element.id),
      text: root.textContent,
      emphasis: root.querySelector("em")?.textContent,
      link: root.querySelector("a")?.getAttribute("href"),
      figure: root.querySelector("figure")?.outerHTML,
      hasChrome: Boolean(root.querySelector(".print-chapter-header,.sheet-number,.preview-body")),
    };
  });
  assert.deepEqual(result.ids, ["opening", "reader-section", "figure-one", "closing"]);
  assert.equal(result.emphasis, "meaningful");
  assert.equal(result.link, "#figure-one");
  assert.equal(result.figure, '<figure id="figure-one"><img src="/illustration.png" alt="An idea"><figcaption>Keep this caption with its image.</figcaption></figure>');
  assert.equal(result.hasChrome, false);
  assert.ok(result.text.indexOf("Read this first.") < result.text.indexOf("Keep this caption"));
  assert.ok(result.text.indexOf("Keep this caption") < result.text.indexOf("Now consider"));
});

test("balancing updates generated book numbers and contents without rewriting authored references", async () => {
  const actual = await page.evaluate(() => {
    const chapter = (slotId, chapterId, number) => ({ slotId, chapterId, kind: "chapter", deleted: false, layoutLocked: false, html: `<header class="print-chapter-header"><span>CHAPTER ${chapterId}</span><span data-book-page-number>PAGE ${number}</span></header><p>Story ${slotId}</p><footer class="sheet-number"><span>Book</span><span data-book-page-number>${number}</span></footer>` });
    const contents = { slotId: "contents", kind: "contents", deleted: false, layoutLocked: false, html: '<ol><li><b>1</b><span>One</span><i>p. 1</i></li><li><b>2</b><span>Two</span><i>p. 3</i></li><li><span>Authored reference</span><i>p. 99</i></li></ol>' };
    const before = [contents, chapter("a", 1, 1), chapter("b", 1, 2), chapter("c", 2, 3)];
    const after = bookLayout.refreshBookPageNumbers([contents, before[1], { ...before[2], deleted: true }, before[3]], before, [{ id: 1, title: "One" }, { id: 2, title: "Two" }]);
    return { contents: after[0].html, secondChapter: after[3].html, removed: after[2] };
  });
  assert.match(actual.contents, /<span>Two<\/span><i>p\. 2<\/i>/);
  assert.match(actual.contents, /Authored reference<\/span><i>p\. 99<\/i>/);
  assert.match(actual.secondChapter, />PAGE 2<\/span>/);
  assert.equal(actual.removed.deleted, true);
  assert.match(actual.removed.html, />Story b<\/p>/);
});

test("custom page headings and authored headers are preserved as story content", async () => {
  const html = '<header>A reader’s note</header><h2>A new idea</h2><p>Keep all of this text.</p><footer>Author’s note</footer>';
  assert.equal(await page.evaluate((html) => bookLayout.pageFlowHtml(html), html), html);
});

test("the intentional back-cover ISBN strip is treated as reserved footer space", async () => {
  const measured = await page.evaluate(() => {
    const content = document.createElement("div");
    Object.assign(content.style, { position: "relative", width: "400px", height: "600px", padding: "40px 40px 120px", overflow: "hidden" });
    content.innerHTML = '<p style="height:300px;margin:0">Back-cover copy</p><div class="back-isbn-strip" style="position:absolute;left:0;right:0;bottom:0;height:90px">ISBN</div>';
    document.body.append(content); const result = bookLayout.measureBookContent(content); content.remove(); return result;
  });
  assert.equal(measured.overflowX, false);
  assert.equal(measured.overflowY, false);
  assert.ok(measured.fillRatio < 1);
});

test("paragraph splitting retains every word and inline emphasis/link formatting", async () => {
  const result = await page.evaluate(() => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index + 1}`).join(" ");
    const html = `<p id="paragraph" class="reader-copy" data-source="story"><em><a href="https://example.org/source">${words}</a></em></p>`;
    const wordCount = (value) => { const element = document.createElement("div"); element.innerHTML = value; return element.textContent.trim().split(/\s+/).length; };
    const parts = bookLayout.splitFlowBlock(html, (head) => wordCount(head) <= 20);
    return { words, parts: parts?.map((html) => {
      const holder = document.createElement("div"); holder.innerHTML = html;
      const element = holder.firstElementChild;
      return { text: element.textContent, id: element.id, className: element.className, source: element.dataset.source, emphasized: element.querySelector("em")?.textContent, href: element.querySelector("a")?.getAttribute("href") };
    }) };
  });
  assert.ok(result.parts);
  assert.equal(result.parts.map((part) => part.text).join(""), result.words);
  assert.equal(result.parts[0].id, "paragraph");
  assert.equal(result.parts[1].id, "");
  for (const part of result.parts) {
    assert.equal(part.className, "reader-copy");
    assert.equal(part.source, "story");
    assert.equal(part.emphasized, part.text);
    assert.equal(part.href, "https://example.org/source");
  }
});

test("splitting nested identified spans keeps each DOM anchor unique across pages", async () => {
  const result = await page.evaluate(() => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index + 1}`).join(" ");
    const html = `<p id="paragraph"><em id="term"><a id="reference" href="#term">${words}</a></em></p>`;
    const parts = bookLayout.splitFlowBlock(html, (head) => {
      const root = document.createElement("div"); root.innerHTML = head;
      return root.textContent.trim().split(/\s+/).length <= 20;
    });
    const root = document.createElement("div"); root.innerHTML = parts?.join("") ?? "";
    return [...root.querySelectorAll("[id]")].map((element) => element.id);
  });
  assert.deepEqual(result, ["paragraph", "term", "reference"], "Only the first split fragment may keep each anchor id");
});

test("ordered-list splitting preserves numbering, attributes and all list items without duplicate anchors", async () => {
  const result = await page.evaluate(() => {
    const html = '<ol id="reading-steps" start="7" class="reader-list"><li id="step-seven"><strong>Observe</strong></li><li id="step-eight"><em>Compare</em></li><li id="step-nine"><a href="#step-seven">Revisit</a></li><li id="step-ten">Explain</li></ol>';
    const parts = bookLayout.splitFlowBlock(html, (head) => {
      const root = document.createElement("div"); root.innerHTML = head;
      return root.querySelectorAll("li").length <= 2;
    });
    return parts?.map((html) => { const root = document.createElement("div"); root.innerHTML = html; const list = root.firstElementChild; return { start: list.start, className: list.className, ids: [...root.querySelectorAll("[id]")].map((element) => element.id), items: [...list.children].map((item) => item.outerHTML) }; });
  });
  assert.ok(result);
  assert.deepEqual(result.map((part) => part.start), [7, 9]);
  assert.deepEqual(result.map((part) => part.className), ["reader-list", "reader-list"]);
  assert.deepEqual(result.flatMap((part) => part.ids), ["reading-steps", "step-seven", "step-eight", "step-nine", "step-ten"]);
  assert.deepEqual(result.flatMap((part) => part.items), [
    '<li id="step-seven"><strong>Observe</strong></li>', '<li id="step-eight"><em>Compare</em></li>', '<li id="step-nine"><a href="#step-seven">Revisit</a></li>', '<li id="step-ten">Explain</li>',
  ]);
});

test("pagination keeps a heading with its next paragraph and preserves sequence", async () => {
  const result = await page.evaluate(() => {
    const blocks = ['<p data-cost="2">Previous thought.</p>', '<h3 data-cost="1">New thought</h3>', '<p data-cost="2"><em>The related paragraph.</em></p>'];
    return bookLayout.paginateFlowBlocks(blocks, (candidate) => {
      const root = document.createElement("div"); root.innerHTML = candidate.join("");
      return [...root.children].reduce((sum, node) => sum + Number(node.dataset.cost), 0) <= 3;
    });
  });
  assert.deepEqual(result, ['<p data-cost="2">Previous thought.</p>', '<h3 data-cost="1">New thought</h3><p data-cost="2"><em>The related paragraph.</em></p>']);
});

test("pagination carries the nearby paragraph with a terminal figure and keeps its caption intact", async () => {
  const result = await page.evaluate(() => {
    const blocks = ['<p data-cost="1">Earlier thought.</p>', '<p data-cost="1">Explanation of the image.</p>', '<figure id="diagram" data-cost="2"><img src="/diagram.png" alt="Diagram"><figcaption>Its caption.</figcaption></figure>'];
    return bookLayout.paginateFlowBlocks(blocks, (candidate) => {
      const root = document.createElement("div"); root.innerHTML = candidate.join("");
      return [...root.children].reduce((sum, node) => sum + Number(node.dataset.cost), 0) <= 3;
    });
  });
  assert.deepEqual(result, ['<p data-cost="1">Earlier thought.</p>', '<p data-cost="1">Explanation of the image.</p><figure id="diagram" data-cost="2"><img src="/diagram.png" alt="Diagram"><figcaption>Its caption.</figcaption></figure>']);
});

test("a figure keeps its story position between surrounding text during pagination", async () => {
  const result = await page.evaluate(() => {
    const blocks = ['<p data-cost="2">Before image.</p>', '<figure data-cost="2"><img src="/scene.png" alt="Scene"><figcaption>Scene caption.</figcaption></figure>', '<p data-cost="1">After image.</p>'];
    return bookLayout.paginateFlowBlocks(blocks, (candidate) => {
      const root = document.createElement("div"); root.innerHTML = candidate.join("");
      return [...root.children].reduce((sum, node) => sum + Number(node.dataset.cost), 0) <= 3;
    });
  });
  assert.deepEqual(result, ['<p data-cost="2">Before image.</p>', '<figure data-cost="2"><img src="/scene.png" alt="Scene"><figcaption>Scene caption.</figcaption></figure><p data-cost="1">After image.</p>']);
});

test("an oversized unsplittable figure is preserved exactly so preflight can flag it", async () => {
  const figure = '<figure id="oversized"><img src="/large.png" alt="Large image"><figcaption>A complete caption.</figcaption></figure>';
  const result = await page.evaluate((html) => ({
    split: bookLayout.splitFlowBlock(html, () => false),
    pages: bookLayout.paginateFlowBlocks([html], () => false),
  }), figure);
  assert.equal(result.split, null);
  assert.deepEqual(result.pages, [figure]);
});
