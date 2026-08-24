import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const production = await readFile(new URL("../lib/designer-production.ts", import.meta.url), "utf8");

test("Designer Studio is a separate persisted final-production layer", () => {
  assert.match(page, /designerPages\?: DesignerPageOverride\[\]/);
  assert.match(page, /designerPageOrder\?: string\[\]/);
  assert.match(page, /designerPages: \(cleanSaved\.designerPages \?\? \[\]\)\.map\(hydrateDesignerOverride\)/);
  assert.match(page, />Designer<\/button>/);
  assert.match(page, /Click any word to edit\. Reading text flows onto new A4 pages automatically/);
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
  assert.match(page, /toggleObjectLock/);
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
  assert.match(page, /Intentional blank/);
  assert.match(page, /Remove from final book/);
  assert.match(page, /addBlankPage/);
  assert.match(page, /duplicatePage/);
  assert.match(page, /movePage\(-1\)/);
  assert.match(page, /Restore previous/);
  assert.match(page, /Reset and allow reflow/);
});

test("custom backgrounds, watermarks, and layers are available", () => {
  assert.match(page, /backgroundImageKey/);
  assert.match(page, /watermarkImageKey/);
  assert.match(page, /Watermark/);
  assert.match(page, /watermarkOpacity/);
  assert.match(page, /watermarkRotation/);
  assert.match(page, /contentVisible[\s\S]{0,240}Flowing content/);
  assert.match(page, /watermarkVisible[\s\S]{0,240}Watermark/);
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
  assert.match(page, /measureChapterPages\(chapter, flowingText, firstStyle\)/);
  assert.match(page, /content\.scrollHeight <= content\.clientHeight \+ 1/);
  assert.match(page, /splitForRemainingSpace/);
  assert.match(page, /flowBodyFromRenderedPage/);
  assert.match(page, /layoutLocked/);
  assert.match(page, /Lock this page during reflow/);
  assert.match(page, /Balance this chapter/);
  assert.match(page, /Repaginate book/);
  assert.match(page, /No AI tokens were used/);
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

test("Designer preview and PDF preserve the shared 794 by 1123 A4 layout", () => {
  assert.match(page, /designer-render-canvas/);
  assert.match(css, /\.designer-render-canvas\{[^}]*width:794px[^}]*height:1123px[^}]*transform:none/);
  assert.match(page, /previewWholeBook/);
  assert.match(page, /await saveWholeBook\(\);[\s\S]*onPreview\(\)/);
});

test("Designer materializes the complete planned book and preserves Word-style text ranges", () => {
  assert.match(page, /paginateReaderHtml\(chapter\.body, project\.audience, textPageTarget\)/);
  assert.match(page, /designerPlannedChapterPageCount\(project, chapter\)/);
  assert.match(page, /function designerPageIsRemoved/);
  assert.match(page, /project\.designerPageOrder/);
  assert.match(page, /supplementalPages/);
  assert.match(page, /slotId: "half-title"/);
  assert.match(page, /slotId: "copyright"/);
  assert.match(page, /slotId: "dedication"/);
  assert.match(page, /slotId: "preface"/);
  assert.match(page, /slotId: "about-book"/);
  assert.match(page, /hasCompletePhysicalOrder/);
  assert.match(page, /const nextOrder = order\.filter\(\(slotId\) => slotId !== selectedId\)/);
  assert.match(page, /savedTextRange/);
  assert.match(page, /designer-selection-toolbar/);
  assert.match(page, /designer-selection-count/);
  assert.match(css, /designer-editable-content::selection/);
});

test("Designer uses the final publication template and saves individual pages", () => {
  assert.match(page, /function designerBookClasses/);
  assert.match(page, /function designerPageClasses/);
  assert.match(page, /designer-canvas-page book-sheet \$\{bookClasses\} \$\{pageClasses\}/);
  assert.match(page, /designerBookClasses\(project\)/);
  assert.match(page, /designerPageClasses\(project, page\)/);
  assert.match(page, /savePageById = async/);
  assert.match(page, /page-save-button/);
  assert.match(page, /Save page/);
  assert.match(page, /designer-more-menu/);
  assert.match(css, /\.designer-canvas-page\.contents-page li/);
  assert.match(css, /\.page-save-button\.dirty/);
});

test("production editor protects work, autosaves, and exposes direct manipulation tools", () => {
  assert.match(page, /designerDocument\?: DesignerDocument/);
  assert.match(page, /manuallyEdited: true/);
  assert.match(page, /designerDraftStorageKey/);
  assert.match(page, /Offline draft/);
  assert.match(page, /onPointerDown=\{startObjectDrag\}/);
  assert.match(page, /PAGE THUMBNAILS · DRAG TO REORDER/);
  assert.match(page, /Project asset library/);
  assert.match(page, /A4 print setup/);
  assert.match(page, /composeDesignerTransform/);
  assert.match(css, /\.designer-safe-area/);
  assert.match(css, /\.designer-layer-list/);
});

test("Designer provides Word-style continuous section editing and automatic A4 reflow", () => {
  assert.match(page, /measureFlowPages/);
  assert.match(page, /scheduleStoryReflow\(identity\.id\)/);
  assert.match(page, /window\.setTimeout[\s\S]{0,180}reflowStory/);
  assert.match(page, /delay = 300/);
  assert.match(page, /designerFlowBodyFromDom/);
  assert.match(page, /splitPreservingMarkup/);
  assert.match(page, /captureFlowCaret/);
  assert.match(page, /data-designer-caret/);
  assert.match(page, /onCompositionStart/);
  assert.match(page, /onCompositionEnd/);
  assert.match(page, /handleFlowBoundaryKey/);
  assert.match(page, /joinFlowBlocks/);
  assert.match(page, /boundaryFlowBlock/);
  assert.doesNotMatch(page, /targetNode\.deleteData/);
  assert.match(page, /removedByReflow/);
  assert.match(page, /detachedPageSlots/);
  assert.match(page, /Protected from regeneration; its text still reflows/);
  assert.match(css, /designer-continuous-editor/);
  assert.match(production, /DesignerDocumentV3/);
  assert.match(production, /flowStories: Record<string, DesignerFlowStory>/);
  assert.match(production, /protectedFlows/);
  assert.match(production, /version: 3/);
});
