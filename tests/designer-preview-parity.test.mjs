import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.env.IKS_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(repoRoot, "package.json"));
const ts = require("typescript");

// Execute the actual components and their real helpers without a browser. The
// hook host retains state so Preview's size chooser can be dismissed through
// its actual click handler. Geometry assertions below concern saved content;
// browser layout still needs a visual/computed-style integration check.
let hookState = [];
let hookIndex = 0;
const react = {
  forwardRef: (render) => render,
  useState(initial) {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = typeof initial === "function" ? initial() : initial;
    return [hookState[index], (next) => { hookState[index] = typeof next === "function" ? next(hookState[index]) : next; }];
  },
  useRef: (current) => ({ current }),
  useMemo: (factory) => factory(),
  useEffect() {},
  useImperativeHandle() {},
};
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const modules = new Map();
function loadSource(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const exposes = filename.endsWith("/app/page.tsx")
    ? "\nexport { DesignerStudio, CanvaPreview, defaultDesignerRevision, designerBasePages, hydrateDesignerOverride, emptyProject };" : "";
  const compiled = ts.transpileModule(readFileSync(filename, "utf8") + exposes, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === "react") return react;
    if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (specifier.startsWith(".")) {
      const imported = resolve(dirname(filename), specifier);
      return loadSource(/\.tsx?$/.test(imported) ? imported : `${imported}.ts`);
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}
const { DesignerStudio, CanvaPreview, defaultDesignerRevision, designerBasePages, hydrateDesignerOverride, emptyProject } = loadSource(resolve(repoRoot, "app/page.tsx"));

function allElements(root, predicate) {
  const matches = [];
  const visit = (element) => {
    if (!element || typeof element !== "object") return;
    if (Array.isArray(element)) return element.forEach(visit);
    if (predicate(element)) matches.push(element);
    visit(element.props?.children);
  };
  visit(root);
  return matches;
}
const hasClass = (element, className) => element.props?.className?.split(/\s+/).includes(className);
function textContent(element) {
  if (typeof element === "string" || typeof element === "number") return String(element);
  if (Array.isArray(element)) return element.map(textContent).join("");
  return element?.props ? textContent(element.props.children) : "";
}
function render(component, props) {
  hookIndex = 0;
  return component(props, null);
}
function previewTree(project) {
  hookState = [];
  const props = { project, exportBusy: false, pdfProgress: 0, pdfExportMode: "publication", onClose() {}, onDownload() {}, async onUseFormat() {}, async onSaveCanvaPage() {}, async onSetCanvaActive() {} };
  let tree = render(CanvaPreview, props);
  const chooser = allElements(tree, (element) => element.type === "button" && textContent(element) === "Preview this size")[0];
  if (chooser) { chooser.props.onClick(); tree = render(CanvaPreview, props); }
  return tree;
}
function pageSnapshot(article, slotId) {
  const content = allElements(article, (element) => hasClass(element, "designer-editable-content") || hasClass(element, "designer-render-content"))[0];
  let html = content?.props.dangerouslySetInnerHTML?.__html ?? "";
  if (content?.props.ref) {
    const node = { dataset: {}, innerHTML: "" };
    content.props.ref(node);
    html = node.innerHTML;
  }
  const images = allElements(article, (element) => element.type === "img").map((image) => ({ src: image.props.src, alt: image.props.alt, style: image.props.style }));
  return { slotId: slotId ?? article.props["data-page-slot"], html, style: content?.props.style, images };
}
function designerPages(project) {
  hookState = [];
  const tree = render(DesignerStudio, { project, embedded: true, onClose() {}, onPreview() {}, async onCommit() {} });
  return allElements(tree, (element) => hasClass(element, "designer-flow-page")).map((section) => {
    const article = allElements(section, (element) => element.type === "article" && hasClass(element, "book-sheet"))[0];
    return pageSnapshot(article, section.props.id.slice("designer-flow-".length));
  });
}
function previewPages(project, pdf = false) {
  const tree = previewTree(project);
  const container = allElements(tree, (element) => hasClass(element, pdf ? "pdf-render-stack" : "whole-book-preview"))[0];
  assert.ok(container, "Preview must expose its whole-book and PDF surfaces");
  return allElements(container, (element) => element.type === "article" && hasClass(element, "book-sheet")).map((article) => pageSnapshot(article));
}
function projectFixture(format = "a4", chapterCount = 2) {
  return {
    ...structuredClone(emptyProject), id: "layout-parity-fixture", title: "A reader's book", bookFormat: format,
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      id: index + 1, title: `Chapter ${index + 1}`, pages: 1, status: "draft", generationStatus: "Completed", locked: false,
      sourceRefs: [], manualApproved: true, body: `<p>Paragraph ${index + 1}. ${"A reader studies a meaningful idea with a nearby illustration. ".repeat(8)}</p>`,
    })), designerPages: [], designerPageOrder: [], canvaPages: [],
  };
}
function savePage(project, slotId, patch) {
  const page = designerBasePages(project).find((candidate) => candidate.slotId === slotId);
  assert.ok(page, `Fixture page ${slotId} must exist`);
  project.designerPages.push({ ...defaultDesignerRevision(page.html), ...page, ...patch, history: [] });
}

for (const format of ["a4", "7x10", "a5", "6x9"]) {
  test(`${format}: an unedited illustrated book has the same pages and content in every surface`, () => {
    const project = projectFixture(format);
    project.chapters[0].imageUrl = "/chapter-art.png";
    project.chapters[0].imageAlt = "Reading outdoors";
    project.chapters[0].imageCaption = "A reader explores an idea.";
    const designer = designerPages(project);
    assert.deepEqual(previewPages(project), designer);
    assert.deepEqual(previewPages(project, true), designer);
  });

  test(`${format}: saved image movement, resizing and page typography are identical in Designer, Preview and PDF`, () => {
    const project = projectFixture(format);
    const html = '<div class="preview-body"><p>Text before the illustration.</p><div class="designer-free-image" style="position:absolute;left:117px;top:241px;width:287px;height:193px"><img src="/fixture-illustration.png" alt="A reader" data-free-image="true" style="width:100%;height:100%;object-fit:contain"></div><p>Text after the illustration.</p></div>';
    savePage(project, "chapter-1-page-1", { html, fontFamily: "Arial, sans-serif", fontSize: 19, lineHeight: 1.7, paragraphSpacing: 17, letterSpacing: 0.4, pagePadding: 49 });
    const designer = designerPages(project).find((page) => page.slotId === "chapter-1-page-1");
    assert.equal(designer.html, html);
    assert.deepEqual(previewPages(project).find((page) => page.slotId === designer.slotId), designer);
    assert.deepEqual(previewPages(project, true).find((page) => page.slotId === designer.slotId), designer);
  });
}

test("saving and reopening a safely wrapped image preserves a small designer nudge", () => {
  const project = projectFixture();
  savePage(project, "chapter-1-page-1", { html: '<div class="preview-body"><img src="/wrapped-art.png" alt="Reader" data-designer-wrap="left" style="float:left;position:relative;left:-12px;top:5px;width:180px;height:auto"><p>Reading alongside the illustration.</p></div>' });
  const saved = hydrateDesignerOverride(project.designerPages[0]);
  assert.match(saved.html, /left:\s*-12px/, "saving must retain the 12px left movement");
  assert.match(saved.html, /top:\s*5px/, "saving must retain the 5px downward movement");
  project.designerPages = [saved];
  const designer = designerPages(project).find((page) => page.slotId === saved.slotId);
  assert.deepEqual(previewPages(project).find((page) => page.slotId === saved.slotId), designer);
  assert.deepEqual(previewPages(project, true).find((page) => page.slotId === saved.slotId), designer);
});

test("opening an old saved page removes only its private caption and keeps image geometry", () => {
  const project = projectFixture("7x10");
  const privateCaption = "[PRIVATE — In a courtyard, arrange the children beside a potter. This section will never print.]";
  const figureStyle = "position:relative;left:-12px;top:5px;width:413px;height:277px;margin:17px 0";
  const imageStyle = "width:100%;height:100%;object-fit:cover;object-position:left 42%;border-radius:9px";
  const unsafeHtml = `<header class="print-chapter-header"><span>CHAPTER 1</span><span>PAGE 1</span></header><div class="preview-body"><p>Text before.</p><figure id="private-art" class="chapter-image" style="${figureStyle}"><img src="/art.png" alt="Reader scene" style="${imageStyle}"><figcaption>${privateCaption}</figcaption></figure><p>Text after.</p></div><footer class="sheet-number">1</footer>`;
  const expectedHtml = unsafeHtml.replace(`<figcaption>${privateCaption}</figcaption>`, "");
  savePage(project, "chapter-1-page-1", { html: unsafeHtml });
  project.designerPages[0].history = [{ ...defaultDesignerRevision(unsafeHtml), html: unsafeHtml }];

  const hydrated = hydrateDesignerOverride(project.designerPages[0]);
  assert.equal(hydrated.html, expectedHtml, "hydration may remove only the private caption");
  assert.equal(hydrated.history[0].html, expectedHtml, "revision history must not restore the leak");
  project.designerPages = [hydrated];

  for (const pages of [designerPages(project), previewPages(project), previewPages(project, true)]) {
    const savedPage = pages.find((candidate) => candidate.slotId === "chapter-1-page-1");
    assert.equal(savedPage.html, expectedHtml);
    assert.match(savedPage.html, new RegExp(`style="${figureStyle}"`));
    assert.match(savedPage.html, new RegExp(`style="${imageStyle}"`));
    assert.doesNotMatch(savedPage.html, /\[PRIVATE|<figcaption/i);
    assert.match(savedPage.html, /Text before/);
    assert.match(savedPage.html, /Text after/);
  }
});

test("generated chapter artwork shares a prose page instead of creating an image-only page", () => {
  const project = projectFixture("a4", 1);
  project.chapters[0].imageUrl = "/chapter-art.png";
  project.chapters[0].imageAlt = "Children learning beside a potter";
  project.chapters[0].imageCaption = "Clay and care";
  const pages = designerBasePages(project).filter((page) => page.chapterId === 1);
  assert.equal(pages.length, 1);
  assert.match(pages[0].html, /Paragraph 1/);
  assert.match(pages[0].html, /chapter-art\.png/);
  assert.doesNotMatch(pages[0].html, /designer-full-figure/);
});

test("Preview preserves an edited contents illustration and text instead of regenerating that page", () => {
  const project = projectFixture();
  const base = designerBasePages(project).find((page) => page.slotId === "contents");
  const html = base.html.replace("<ol>", '<p style="margin-left:13px">My reading route</p><div class="designer-free-image" style="position:absolute;left:113px;top:404px;width:211px;height:139px"><img src="/contents-art.png" alt="Reading route" data-free-image="true"></div><ol>');
  savePage(project, "contents", { html });
  const designer = designerPages(project).find((page) => page.slotId === "contents");
  assert.equal(designer.html, html);
  assert.deepEqual(previewPages(project).find((page) => page.slotId === "contents"), designer);
  assert.deepEqual(previewPages(project, true).find((page) => page.slotId === "contents"), designer);
});

test("Preview and PDF preserve the Designer page order including moved contents continuations", () => {
  const project = projectFixture("a4", 16);
  const base = designerBasePages(project);
  assert.ok(base.some((page) => page.slotId === "contents-2"), "Fixture must have a second contents page");
  const order = base.map((page) => page.slotId).filter((slot) => slot !== "contents-2");
  order.splice(order.indexOf("chapter-1-page-1") + 1, 0, "contents-2");
  project.designerPageOrder = order;
  const designer = designerPages(project).map((page) => page.slotId);
  assert.deepEqual(designer, order);
  assert.deepEqual(previewPages(project).map((page) => page.slotId), designer);
  assert.deepEqual(previewPages(project, true).map((page) => page.slotId), designer);
});

test("a materialized book keeps authored HTML, image geometry and order when its trim size changes", () => {
  const project = projectFixture("a4");
  // These are the pages the editor has saved, distinct from the original
  // chapter manuscript which would produce many pages at smaller trim sizes.
  project.designerPages = designerBasePages(project).map((page) => ({ ...defaultDesignerRevision(page.html), ...page, history: [] }));
  const authored = project.designerPages.find((page) => page.slotId === "chapter-1-page-1");
  authored.html = '<div class="preview-body"><p>Revised opening paragraph.</p><div class="designer-free-image" style="position:absolute;left:123px;top:251px;width:263px;height:191px"><img src="/authored-art.png" alt="Edited illustration" data-free-image="true"></div><p>Revised closing paragraph.</p></div>';
  authored.fontSize = 18;
  authored.pagePadding = 46;
  project.designerPageOrder = ["cover", "contents", "chapter-2-page-1", "chapter-1-page-1", "back"];
  project.designerLayoutSnapshot = true;
  project.chapters[0].body = `<p>${"The original manuscript is longer than the designer edition. ".repeat(300)}</p>`;
  const saved = structuredClone(project.designerPages);
  const expected = designerPages(project);
  assert.deepEqual(expected.map((page) => page.slotId), project.designerPageOrder);
  assert.equal(expected.find((page) => page.slotId === authored.slotId).html, authored.html);
  for (const bookFormat of ["a4", "7x10", "a5", "6x9"]) {
    const resized = { ...project, bookFormat };
    assert.deepEqual(designerPages(resized), expected, `${bookFormat} must preserve the authored edition`);
    assert.deepEqual(previewPages(resized), expected, `${bookFormat} Preview must not repaginate the original manuscript`);
    assert.deepEqual(previewPages(resized, true), expected, `${bookFormat} PDF must use that same edition`);
  }
  assert.deepEqual(project.designerPages, saved, "Rendering must not mutate saved pages");
});

test("removed pages stay removed and inserted custom pages retain their saved position", () => {
  const project = projectFixture();
  savePage(project, "contents", { deleted: true });
  savePage(project, "chapter-2-page-1", { deleted: true });
  const custom = { ...defaultDesignerRevision('<p style="margin-left:15px">An inserted reading exercise.</p>'), slotId: "custom-exercise", label: "Reading exercise", kind: "custom", chapterId: 1, history: [] };
  project.designerPages.push(custom);
  project.designerPageOrder = ["cover", "contents", "custom-exercise", "chapter-1-page-1", "chapter-2-page-1", "back"];
  const designer = designerPages(project);
  assert.deepEqual(designer.map((page) => page.slotId), ["cover", "custom-exercise", "chapter-1-page-1", "back"]);
  assert.equal(designer.find((page) => page.slotId === custom.slotId).html, custom.html);
  assert.deepEqual(previewPages(project), designer);
  assert.deepEqual(previewPages(project, true), designer);
});

test("an active Canva page is the same image in Designer, Preview and PDF", () => {
  const project = projectFixture();
  project.canvaPages = [{ slotId: "chapter-1-page-1", label: "Chapter one", kind: "chapter", chapterId: 1, pageIndex: 0, active: true, current: { imageUrl: "/canva-finished-page.png", imageKey: "canva-finished-page" }, history: [] }];
  const designer = designerPages(project);
  const canvaPage = designer.find((page) => page.slotId === "chapter-1-page-1");
  assert.equal(canvaPage.html, "", "Active Canva pages must not expose the underlying studio text");
  assert.deepEqual(canvaPage.images.map((image) => image.src), ["/canva-finished-page.png"]);
  assert.deepEqual(previewPages(project), designer);
  assert.deepEqual(previewPages(project, true), designer);
  project.canvaPages[0].active = false;
  const restored = designerPages(project);
  assert.ok(restored.find((page) => page.slotId === "chapter-1-page-1").html.includes("Paragraph 1"));
  assert.deepEqual(previewPages(project), restored);
  assert.deepEqual(previewPages(project, true), restored);
});

test("an authored back cover does not gain Designer-only footer content on reopening", () => {
  const project = projectFixture();
  const html = '<p style="margin-top:23px">A custom closing thought.</p>';
  savePage(project, "back", { html });
  const designer = designerPages(project).find((page) => page.slotId === "back");
  assert.equal(designer.html, html, "The editor must initialize the exact saved back cover");
  assert.deepEqual(previewPages(project).find((page) => page.slotId === "back"), designer);
  assert.deepEqual(previewPages(project, true).find((page) => page.slotId === "back"), designer);
});
