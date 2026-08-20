import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("Designer Studio is a separate persisted final-production layer", () => {
  assert.match(page, /designerPages\?: DesignerPageOverride\[\]/);
  assert.match(page, /designerPageOrder\?: string\[\]/);
  assert.match(page, /designerPages: \(cleanSaved\.designerPages \?\? \[\]\)\.map\(hydrateDesignerOverride\)/);
  assert.match(page, />Designer<\/button>/);
  assert.match(page, /Edit the final book without changing generated chapters or Nemotron history/);
});

test("advanced typography, object, border and image controls are selection-aware", () => {
  assert.match(page, /Page font/);
  assert.match(page, /Line height/);
  assert.match(page, /Paragraph spacing/);
  assert.match(page, /Page border/);
  assert.match(page, /Selected image/);
  assert.match(page, /Crop \/ fit/);
  assert.match(page, /Replace image/);
  assert.match(page, /addTextBox/);
  assert.match(page, /moveObject/);
  assert.match(page, /Lock \/ unlock object/);
});

test("designer supports reusable styles, scoped application and local preflight", () => {
  assert.match(page, /applyStyle\("chapter"\)/);
  assert.match(page, /applyStyle\("book"\)/);
  assert.match(page, /Save current style/);
  assert.match(page, /runPreflight/);
  assert.match(page, /overflow the printable page/);
  assert.match(page, /missing accessibility text/);
  assert.match(page, /undoStack/);
  assert.match(page, /redoStack/);
});

test("designer can edit content and manage page structure", () => {
  assert.match(page, /contentEditable suppressContentEditableWarning/);
  assert.match(page, /Leave intentionally blank/);
  assert.match(page, /Remove from final book/);
  assert.match(page, /addBlankPage/);
  assert.match(page, /duplicatePage/);
  assert.match(page, /movePage\(-1\)/);
  assert.match(page, /Restore previous/);
  assert.match(page, /Restore studio page/);
});

test("custom backgrounds, watermarks, and layers are available", () => {
  assert.match(page, /backgroundImageKey/);
  assert.match(page, /watermarkImageKey/);
  assert.match(page, /Custom watermark/);
  assert.match(page, /watermarkOpacity/);
  assert.match(page, /watermarkRotation/);
  assert.match(page, /contentVisible[\s\S]{0,180}Content/);
  assert.match(page, /watermarkVisible[\s\S]{0,180}Watermark/);
  assert.match(css, /\.designer-watermark-layer/);
});

test("uploaded backgrounds are visible and immediately persisted", () => {
  assert.match(page, /const uploadBackground = async/);
  assert.match(page, /await saveRevision\(\{ \.\.\.currentSnapshot\(\), \.\.\.background \}\)/);
  assert.match(page, /Background applied to this page and saved/);
  assert.ok(page.indexOf("function ownerHeaders()") < page.indexOf("export default function Home()"), "ownerHeaders must be module-scoped so Designer Studio can upload");
  assert.match(css, /\.designer-canvas-page \.designer-background-layer,.designer-rendered-sheet \.designer-background-layer\{z-index:0/);
  assert.match(css, /\.designer-canvas-page \.designer-editable-content,.designer-rendered-sheet \.designer-render-content\{position:relative;z-index:2/);
});

test("background upload asks for page or whole-book scope", () => {
  assert.match(page, /pendingBackground/);
  assert.match(page, /Where should this background be used\?/);
  assert.match(page, />This page only</);
  assert.match(page, />All pages</);
  assert.match(page, /applyUploadedBackground\("page"\)/);
  assert.match(page, /applyUploadedBackground\("book"\)/);
  assert.match(page, /allPages\.forEach/);
  assert.match(css, /\.designer-background-choice/);
});

test("Designer Studio exposes the complete book as one editable flowing workspace", () => {
  assert.match(page, /Whole-book Designer/);
  assert.match(page, /designer-whole-book-canvas/);
  assert.match(page, /orderedPages\.filter\(\(page\) => !revisionFor\(page\)\.deleted\)\.map/);
  assert.match(page, /Save whole book/);
  assert.match(page, /saveWholeBook/);
  assert.match(page, /liveBookHtml/);
  assert.match(page, /rememberLiveHtml/);
  assert.match(css, /\.designer-whole-book-canvas/);
  assert.match(css, /\.designer-flow-page\.selected/);
});

test("whole-book layout balancing is local, scoped and preserves locked pages", () => {
  assert.match(page, /balanceLayout = async \(scope: "chapter" \| "book"\)/);
  assert.match(page, /paginateReaderHtml\(flowingText, project\.audience\)/);
  assert.match(page, /layoutLocked/);
  assert.match(page, /Lock this page during reflow/);
  assert.match(page, /Balance this chapter/);
  assert.match(page, /Balance layout/);
  assert.match(page, /without using AI tokens/);
});

test("whole-book preflight reports fill problems with page navigation", () => {
  assert.match(page, /designerPageFill/);
  assert.match(page, /runBookPreflight/);
  assert.match(page, /Only \$\{fill\.ratio\}% filled/);
  assert.match(page, /content may be clipped/);
  assert.match(page, />Go to page</);
  assert.match(css, /\.page-fill-badge\.empty/);
  assert.match(css, /\.page-fill-badge\.overflow/);
});

test("Preview and PDF consume saved designer pages and custom ordering", () => {
  assert.match(page, /project\.designerPageOrder \?\? \[\]/);
  assert.match(page, /renderDesignerSheet/);
  assert.match(page, /designer-rendered-sheet/);
  assert.match(page, /pdf-render-stack/);
  assert.match(page, /override\?\.active[\s\S]*designerFor\(sheet\)/);
});
