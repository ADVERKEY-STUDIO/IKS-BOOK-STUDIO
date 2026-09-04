import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../lib/book-layout.ts", import.meta.url), "utf8");

test("Designer Studio is a separate persisted final-production layer", () => {
  assert.match(page, /designerPages\?: DesignerPageOverride\[\]/);
  assert.match(page, /designerPageOrder\?: string\[\]/);
  assert.match(page, /designerPages: \(cleanSaved\.designerPages \?\? \[\]\)\.map\(hydrateDesignerOverride\)/);
  assert.match(page, /designer-nav-button/);
  assert.match(page, /Edit the final book without changing generated chapters or Nemotron history/);
});

test("completed books use Designer as the embedded primary workspace", () => {
  assert.match(page, /type EditorWorkspace = "designer" \| "workflow"/);
  assert.match(page, /function isDesignerReady\(project: Project\)/);
  assert.match(page, /setEditorWorkspace\(isDesignerReady\(next\) \? "designer" : "workflow"\)/);
  assert.match(page, /editorWorkspace === "designer" && <DesignerStudio ref=\{designerStudioRef\} embedded/);
  assert.match(css, /\.designer-embedded-shell\{/);
});

test("production workflow remains available without sitting behind Designer", () => {
  assert.match(page, />Production workflow<\/button>/);
  assert.match(page, /editorWorkspace === "workflow" && active && <SimpleWorkflowBar/);
  assert.match(page, /editorWorkspace === "workflow" && <Editor/);
  assert.match(page, /await designerStudioRef\.current\?\.saveWholeBook\(\)/);
  assert.match(page, /!embedded && <button className="designer-close"/);
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

test("saved free-placement images regain drag and resize controls after reopening", () => {
  assert.match(page, /wiredFreeImages = useRef\(new WeakSet<HTMLElement>\(\)\)/);
  assert.match(page, /wireFreeImageControls/);
  assert.match(page, /bookEditors\.current\.forEach/);
  assert.match(page, /querySelectorAll<HTMLElement>\("\.designer-free-image"\)/);
  assert.match(page, /document\.addEventListener\("pointercancel", finishPointerAction\)/);
  assert.match(page, /rememberLiveHtml\(slotId, root\.innerHTML\)/);
  assert.match(css, /\.designer-free-image\.designer-object-selected \.free-image-nudge/);
});

test("image inspector keeps a stable selection and resizes both image types continuously", () => {
  assert.match(page, /type DesignerObjectIdentity/);
  assert.match(page, /data-designer-object-id/);
  assert.match(page, /selectedObjectIdentityRef/);
  assert.match(page, /findDesignerObject/);
  assert.match(page, /resolveSelectedObject/);
  assert.match(page, /imageParts/);
  assert.match(page, /selectedImageSize/);
  assert.match(page, /resizeSelectedImage/);
  assert.match(page, /beginImageResize/);
  assert.match(page, /finishImageResize/);
  assert.match(page, /aria-label="Image width in pixels"/);
  assert.match(page, /aria-label="Image height in pixels"/);
  assert.match(page, /frame\.style\[dimension\]/);
  assert.match(page, /visual\.src = image\.url/);
  assert.match(css, /\.designer-size-control/);
});

test("wrapped-image controls reserve readable text space without rewriting saved geometry", () => {
  assert.match(page, /SAFE_WRAPPED_IMAGE_WIDTH = 260/);
  const hydration = page.slice(page.indexOf("function hydrateDesignerRevision"), page.indexOf("const designerStyleKeys"));
  assert.doesNotMatch(hydration, /repairUnsafeDesignerImageHtml/);
  assert.match(hydration, /html: revision\?\.html \?\? html/);
  assert.match(page, /frame\.style\.maxWidth = "42%"/);
  assert.match(page, /Block — recommended/);
  assert.match(page, /Image left · text right/);
  assert.match(page, /Image right · text left/);
  assert.match(page, /Height follows the image’s original proportions automatically/);
  assert.match(page, /A wrapped image leaves too little room for readable text/);
  assert.match(css, /img\[data-designer-wrap=left\]/);
  assert.match(css, /img\[data-designer-wrap=left\][^{]*\{max-width:100%;height:auto;position:relative\}/);
  assert.doesNotMatch(css, /width:min\(260px,42%\)!important/);
});

test("page columns flow only inside chapter text and fixed pages self-repair to one column", () => {
  assert.match(page, /function normalizedDesignerColumns/);
  assert.match(page, /function designerPageSupportsColumns/);
  assert.match(page, /function designerColumnsForPage/);
  assert.match(page, /!designerPageSupportsColumns\(selected\)\) return/);
  assert.match(page, /columns: designerColumnsForPage\(page, revision\.columns\)/);
  assert.match(page, /designerColumnVariables\(designerColumnsForPage\(page, revision\.columns\), revision\.columnGap\)/);
  assert.doesNotMatch(page, /columnCount: revision\.columns/);
  assert.doesNotMatch(page, /columnCount: page\.columns/);
  assert.match(css, /\.designer-editable-content>\.preview-body,\.designer-render-content>\.preview-body\{[^}]*column-count:var\(--designer-column-count,1\)/);
  assert.match(css, /\.designer-canvas-page\.contents-page \.designer-editable-content[^}]*--designer-column-count:1/);
});

test("free images hide editing chrome outside selection and can be deleted", () => {
  assert.match(page, /persistableDesignerHtml/);
  assert.match(page, /html: persistableDesignerHtml\(revision\.html\)/);
  assert.match(page, />Delete selected image</);
  assert.match(page, /Image deleted\. Save the page or whole book/);
  assert.match(css, /\.designer-free-image:not\(\.designer-object-selected\)>\.free-image-dragbar/);
  assert.match(css, /\.designer-render-content \.designer-free-image>\.free-image-dragbar/);
  assert.match(css, /\.designer-render-content \.designer-free-image>img/);
  assert.match(css, /\.designer-editable-content \.designer-free-image>img\{width:100%!important;height:100%!important;max-height:none!important;padding-top:0!important\}/);
});

test("designer and Preview preserve free-image geometry and keep actions outside the scaled page", () => {
  assert.match(page, /clampFreeImageFrame/);
  assert.match(page, /footerClearance = Math\.max\(58/);
  assert.match(page, /A freely placed image overlaps the page-number or footer area/);
  assert.match(page, /className="continuous-sheet-scale"/);
  assert.match(css, /\.continuous-sheet-frame>\.continuous-sheet-scale\{/);
  assert.doesNotMatch(css, /\.continuous-sheet-frame>div\{/);
});

test("a deselected free image can be selected and dragged again without a pointerdown rerender", () => {
  assert.match(page, /selectDesignerObject = \(node: HTMLElement, slotId: string, kind: "text box" \| "image", commitState = true\)/);
  assert.match(page, /selectImage\(false\)/);
  assert.match(page, /if \(commitState\) setSelectedId\(slotId\)/);
  assert.match(page, /rememberPosition\(\);\s*selectImage\(\);/);
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

test("text clicks preserve the caret while selecting pages and opening text tools", () => {
  assert.match(page, /type DesignerSelectionBookmark/);
  assert.match(page, /type DesignerPendingCaretPoint/);
  assert.match(page, /beginTextInteraction/);
  assert.match(page, /event\.stopPropagation\(\)/);
  assert.match(page, /caretRangeFromPoint/);
  assert.match(page, /caretPositionFromPoint/);
  assert.match(page, /root\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /restoreSelection\(bookmark\)/);
  assert.match(page, /clearObjectSelectionForText/);
  assert.match(page, /setPanel\("text"\)/);
  assert.match(page, /ref=\{designerCanvasRef\}/);
  assert.match(page, /page\.slotId !== selectedId/);
});

test("live Designer pages are uncontrolled so ordinary rerenders cannot reset the caret", () => {
  const activeDesigner = page.slice(page.indexOf("const DesignerStudio ="), page.indexOf("function LegacyDesignerStudio"));
  assert.match(activeDesigner, /const connectBookEditor/);
  assert.match(activeDesigner, /node\.innerHTML = liveBookHtml\.current\[slotId\] \?\? initialHtml/);
  assert.match(activeDesigner, /const replaceEditorHtml/);
  assert.match(activeDesigner, /anchorTextOffset/);
  assert.match(activeDesigner, /focusTextOffset/);
  assert.match(activeDesigner, /restoreSelection\(bookmark, true\)/);
  assert.match(activeDesigner, /renderBookPage\(project, \{ \.\.\.page, \.\.\.revision \}, page\.slotId, \{/);
  assert.match(activeDesigner, /editorProps:\s*\{\s*ref: \(node\) => connectBookEditor\(page\.slotId, revision\.html, node\)/);
  assert.match(activeDesigner, /contentEditable: true, suppressContentEditableWarning: true/);
  assert.match(page, /options\.editorProps \?\? \{ dangerouslySetInnerHTML: \{ __html: page\.html \} \}/);
  assert.doesNotMatch(activeDesigner, /dangerouslySetInnerHTML/);
  assert.match(page, /<DesignerStudio ref=\{designerStudioRef\} embedded key=\{project\.id\}/);
});

test("contents titles indent horizontally with Space and reverse with Backspace", () => {
  assert.match(page, /handleContentsTitleKeyDown/);
  assert.match(page, /event\.key !== " " && event\.key !== "Backspace"/);
  assert.match(page, /closest\("li > span"\)/);
  assert.match(page, /Math\.min\(64, currentIndent \+ 8\)/);
  assert.match(page, /Math\.max\(0, currentIndent - 8\)/);
  assert.match(page, /title\.dataset\.designerIndent/);
  assert.match(page, /title\.style\.marginInlineStart/);
  assert.match(page, /rememberLiveHtml\(slotId, html\)/);
  assert.match(page, /replaceEditorHtml\(selectedId, previous\.html\)/);
  assert.match(page, /replaceEditorHtml\(selectedId, next\.html\)/);
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
  assert.match(page, /const replacement = makeOverride\(target, revision, existing\)/);
  assert.match(page, /Background applied to \$\{target\.label\} and saved/);
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
  assert.match(page, /targetSlotId: target\.slotId/);
  assert.match(page, /Uploaded from <b>\{pendingBackground\.targetLabel\}<\/b>/);
  assert.match(page, /ref=\{backgroundChoicePrimaryRef\}/);
  assert.match(page, /event\.key !== "Escape"/);
  assert.match(page, /event\.key !== "Tab"/);
  assert.match(page, /ref=\{backgroundUploadInputRef\}/);
  assert.match(css, /\.designer-background-choice-overlay\{position:absolute;z-index:100;inset:0;display:grid;place-items:center/);
  assert.match(css, /\.designer-background-choice/);
  assert.ok(page.indexOf("designer-whole-book-canvas") < page.indexOf("designer-background-choice-overlay"), "background chooser must render outside the long book canvas");
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
  assert.match(page, /measureChapterPages\(chapter, combined, revisions\.map/);
  assert.match(page, /const measured = measureBookContent\(content\)/);
  assert.match(page, /return !measured\.overflowX && !measured\.overflowY/);
  assert.match(page, /paginateFlowBlocks\(blocks, fits\)/);
  assert.match(layout, /splitFlowBlock\(block, \(head\) => fits\(\[\.\.\.current, head\], index\), doc\)/);
  assert.match(page, /flowBodyFromRenderedPage/);
  assert.match(page, /layoutLocked/);
  assert.match(page, /Lock this page during reflow/);
  assert.match(page, /Balance this chapter/);
  assert.match(page, /Balance layout/);
  assert.match(page, /balanced locally/);
});

test("whole-book preflight reports fill problems with page navigation", () => {
  assert.match(page, /designerPageFill/);
  assert.match(page, /runBookPreflight/);
  assert.match(page, /Only \$\{fill\.ratio\}% filled/);
  assert.match(page, /Content crosses the page boundary or overlaps its footer/);
  assert.match(page, />Go to page</);
  assert.match(css, /\.page-fill-badge\.empty/);
  assert.match(css, /\.page-fill-badge\.overflow/);
});

test("Preview and PDF consume saved designer pages and custom ordering", () => {
  assert.match(page, /project\.designerPageOrder \?\? \[\]/);
  const preview = page.slice(page.indexOf("function CanvaPreview("));
  assert.match(preview, /resolveBookPages\(project\)\.filter\(\(page\) => !page\.deleted\)/);
  assert.match(preview, /renderBookPage\(project, sheet, key, \{ draftProof \}\)/);
  assert.doesNotMatch(preview, /designerBasePages\(|readerPagesForFormat\(|sanitizeReaderHtml\(/);
  assert.match(page, /className="designer-editable-content"/);
  assert.match(page, /pdf-render-stack/);
  const surface = page.slice(page.indexOf("function renderBookPage("), page.indexOf("function designerStyleFrom("));
  assert.match(surface, /candidate\.slotId === page\.slotId && candidate\.active/);
  assert.match(surface, /canva \? <img src=\{canva\.current\.imageUrl\}/);
});

test("Designer, preview and PDF use the same publication surface and responsive scale", () => {
  assert.doesNotMatch(page, /className={`designer-render-canvas/);
  assert.match(css, /\.designer-flow-page,\.designer-flow-page>\.designer-canvas-page\{width:var\(--book-page-width,794px\)/);
  assert.match(page, /previewWholeBook/);
  assert.match(page, /await saveWholeBook\(\);[\s\S]*onPreview\(\)/);
});

test("publication export stays available while quality issues remain visible", () => {
  assert.doesNotMatch(page, /mode === "publication" && !publication\.ready/);
  assert.match(page, /publication = useMemo\(\(\) => \(\{ \.\.\.publicationReview, ready: true \}\)/);
  assert.match(page, /qualityReport\?\.overflowIssues\.length/);
  assert.match(page, /Some content crosses a page boundary or overlaps a footer/);
});

test("Designer uses the final publication template and saves individual pages", () => {
  assert.match(page, /function designerBookClasses/);
  assert.match(page, /function designerPageClasses/);
  assert.match(page, /designer-canvas-page book-sheet \$\{designerBookClasses\(project\)\} \$\{designerPageClasses\(project, page\)\}/);
  assert.match(page, /page\.backgroundImageUrl \? " has-background"/);
  assert.match(page, /style=\{bookContentStyle\(page, page\)\}/);
  assert.match(page, /savePageById = async/);
  assert.match(page, /page-save-button/);
  assert.match(page, /Save page/);
  assert.match(page, /designer-more-menu/);
  assert.match(css, /\.designer-canvas-page\.contents-page li/);
  assert.match(css, /\.page-save-button\.dirty/);
});
