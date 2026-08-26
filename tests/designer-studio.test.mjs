import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

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

test("free images hide editing chrome outside selection and can be deleted", () => {
  assert.match(page, /persistableDesignerHtml/);
  assert.match(page, /html: persistableDesignerHtml\(revision\.html\)/);
  assert.match(page, />Delete selected image</);
  assert.match(page, /Image deleted\. Save the page or whole book/);
  assert.match(css, /\.designer-free-image:not\(\.designer-object-selected\)>\.free-image-dragbar/);
  assert.match(css, /\.designer-render-content \.designer-free-image>\.free-image-dragbar/);
  assert.match(css, /\.designer-render-content \.designer-free-image>img/);
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
  assert.match(page, /measureChapterPages\(chapter, flowingText, firstStyle\)/);
  assert.match(page, /content\.scrollHeight <= content\.clientHeight \+ 1/);
  assert.match(page, /splitForRemainingSpace/);
  assert.match(page, /flowBodyFromRenderedPage/);
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

test("Designer preview and PDF preserve the shared 794×1123 A4 layout", () => {
  assert.match(page, /designer-render-canvas/);
  assert.match(css, /\.designer-render-canvas\{[^}]*width:794px[^}]*height:1123px[^}]*transform:none/);
  assert.match(page, /previewWholeBook/);
  assert.match(page, /await saveWholeBook\(\);[\s\S]*onPreview\(\)/);
});

test("Designer uses the final publication template and saves individual pages", () => {
  assert.match(page, /function designerBookClasses/);
  assert.match(page, /function designerPageClasses/);
  assert.match(page, /designer-canvas-page book-sheet \$\{bookClasses\} \$\{pageClasses\}/);
  assert.match(page, /surfaceClasses = `\$\{designerBookClasses\(project\)\} \$\{designerPageClasses\(project, page\)\}\$\{page\.backgroundImageUrl/);
  assert.match(page, /savePageById = async/);
  assert.match(page, /page-save-button/);
  assert.match(page, /Save page/);
  assert.match(page, /designer-more-menu/);
  assert.match(css, /\.designer-canvas-page\.contents-page li/);
  assert.match(css, /\.page-save-button\.dirty/);
});
