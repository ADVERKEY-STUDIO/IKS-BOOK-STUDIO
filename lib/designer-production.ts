export type DesignerAsset = {
  key: string;
  url: string;
  name: string;
  contentType?: string;
  size?: number;
  uploadedAt: string;
};

export type DesignerGuide = { id: string; axis: "x" | "y"; position: number };

export type DesignerPrintSettings = {
  exportMode: "standard" | "printer" | "review";
  innerMargin: number;
  outerMargin: number;
  topMargin: number;
  bottomMargin: number;
  gutter: number;
  bleedMm: number;
  cropMarks: boolean;
  safeArea: boolean;
  facingPages: boolean;
};

export type DesignerTextStyle = {
  id: string;
  name: string;
  selector: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  fontWeight?: string;
  textAlign?: string;
};

export type DesignerMaster = {
  id: string;
  name: string;
  kind: "cover" | "contents" | "chapter" | "body" | "illustration" | "custom" | "back";
  style: Record<string, string | number | boolean | undefined>;
  updatedAt: string;
};

export type DesignerDocumentV2 = {
  version: 2;
  migratedAt: string;
  assets: DesignerAsset[];
  guides: DesignerGuide[];
  print: DesignerPrintSettings;
  textStyles: DesignerTextStyle[];
  masters: DesignerMaster[];
  protectedPages: Record<string, { protectedAt: string; reason: "manual-edit" | "restored" }>;
};

export type DesignerElementInspector = {
  width: number;
  height: number;
  padding: number;
  opacity: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  objectFit: string;
  objectPosition: string;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  shadow: string;
  floating: string;
  alt: string;
  caption: string;
  locked: boolean;
  hidden: boolean;
  zIndex: number;
};

export const DEFAULT_PRINT_SETTINGS: DesignerPrintSettings = {
  exportMode: "standard",
  innerMargin: 60,
  outerMargin: 60,
  topMargin: 60,
  bottomMargin: 60,
  gutter: 18,
  bleedMm: 0,
  cropMarks: false,
  safeArea: true,
  facingPages: false,
};

export const DEFAULT_TEXT_STYLES: DesignerTextStyle[] = [
  { id: "book-title", name: "Book title", selector: "h1", fontFamily: "Georgia, serif", fontSize: 46, lineHeight: 1.05, color: "#173f37", fontWeight: "400" },
  { id: "chapter-title", name: "Chapter title", selector: "h2", fontFamily: "Georgia, serif", fontSize: 31, lineHeight: 1.08, color: "#173f37", fontWeight: "400" },
  { id: "heading", name: "Heading", selector: "h3", fontFamily: "Georgia, serif", fontSize: 21, lineHeight: 1.2, color: "#173f37", fontWeight: "700" },
  { id: "body", name: "Body", selector: "p", fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.55, color: "#243b34" },
  { id: "caption", name: "Caption", selector: "figcaption", fontFamily: "Arial, sans-serif", fontSize: 10, lineHeight: 1.35, color: "#66766f" },
  { id: "quote", name: "Quote", selector: "blockquote", fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.5, color: "#8b4f35" },
  { id: "activity", name: "Activity", selector: ".activity", fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5, color: "#173f37", fontWeight: "700" },
  { id: "page-number", name: "Page number", selector: ".sheet-number", fontFamily: "Arial, sans-serif", fontSize: 9, lineHeight: 1, color: "#77756e" },
];

export function createDesignerDocumentV2(existing?: Partial<DesignerDocumentV2>): DesignerDocumentV2 {
  return {
    version: 2,
    migratedAt: existing?.migratedAt || new Date().toISOString(),
    assets: existing?.assets ?? [],
    guides: existing?.guides ?? [],
    print: { ...DEFAULT_PRINT_SETTINGS, ...(existing?.print ?? {}) },
    textStyles: existing?.textStyles?.length ? existing.textStyles : DEFAULT_TEXT_STYLES,
    masters: existing?.masters ?? [],
    protectedPages: existing?.protectedPages ?? {},
  };
}

export function parseDesignerTransform(transform = "") {
  const rotation = Number(transform.match(/rotate\((-?[\d.]+)deg\)/)?.[1] ?? 0);
  const scale = transform.match(/scale\((-?[\d.]+)\s*,\s*(-?[\d.]+)\)/);
  const scaleX = Number(transform.match(/scaleX\((-?[\d.]+)\)/)?.[1] ?? scale?.[1] ?? 1);
  const scaleY = Number(transform.match(/scaleY\((-?[\d.]+)\)/)?.[1] ?? scale?.[2] ?? 1);
  return { rotation, flipX: scaleX < 0, flipY: scaleY < 0 };
}

export function composeDesignerTransform(rotation: number, flipX: boolean, flipY: boolean) {
  return `rotate(${Number.isFinite(rotation) ? rotation : 0}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`;
}

function numeric(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseFloat(value || "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function inspectDesignerElement(node: HTMLElement | null): DesignerElementInspector {
  if (!node) return { width: 360, height: 300, padding: 12, opacity: 1, borderRadius: 0, borderWidth: 0, borderColor: "#173f37", objectFit: "contain", objectPosition: "center", rotation: 0, flipX: false, flipY: false, shadow: "none", floating: "none", alt: "", caption: "", locked: false, hidden: false, zIndex: 2 };
  const style = getComputedStyle(node);
  const transform = parseDesignerTransform(node.style.transform || style.transform);
  return {
    width: numeric(node.style.width, node.getBoundingClientRect().width || 360),
    height: numeric(node.style.height, node.getBoundingClientRect().height || 300),
    padding: numeric(node.style.padding, numeric(style.paddingTop, 12)),
    opacity: numeric(node.style.opacity, numeric(style.opacity, 1)),
    borderRadius: numeric(node.style.borderRadius, numeric(style.borderTopLeftRadius, 0)),
    borderWidth: numeric(node.style.borderWidth, numeric(style.borderTopWidth, 0)),
    borderColor: node.style.borderColor || style.borderColor || "#173f37",
    objectFit: node.style.objectFit || style.objectFit || "contain",
    objectPosition: node.style.objectPosition || style.objectPosition || "center",
    rotation: transform.rotation,
    flipX: transform.flipX,
    flipY: transform.flipY,
    shadow: node.style.boxShadow || "none",
    floating: node.style.float || "none",
    alt: node instanceof HTMLImageElement ? node.alt : "",
    caption: node.closest("figure")?.querySelector("figcaption")?.textContent || "",
    locked: node.dataset.designerLocked === "true",
    hidden: node.dataset.designerHidden === "true",
    zIndex: numeric(node.style.zIndex, 2),
  };
}

export function designerDraftStorageKey(projectId: string) {
  return `iks-designer-v2:${projectId}`;
}
