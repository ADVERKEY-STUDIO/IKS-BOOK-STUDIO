/** Illustration identity follows a manuscript occurrence, never a shared file URL. */
export type BookIllustration = {
  slotId: string;
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
  placement?: "after-opening" | "chapter-middle" | "before-reflection";
  anchorId?: string;
  previousUrl?: string;
  previousCaption?: string;
};

/** Mutate only declared artwork; preserve story nodes and existing image frames. */
export function placeBookIllustrations(root: HTMLElement, illustrations: BookIllustration[]) {
  const doc = root.ownerDocument;
  const claimed = new Set<Element>();
  const after = new Map<Element, Element>();
  const paragraphs = Array.from(root.querySelectorAll("p,blockquote,ul,ol,table"))
    .filter((node) => !node.closest("figure,footer,.sheet-number,.print-chapter-header") && !node.matches(".continued-title,.chapter-kicker"));
  const reflection = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6,[data-book-anchor='reflection']"))
    .find((node) => /^(?:reflection|reflect\b|think it through|think about it|activity|try it|check your understanding|questions)/i.test(node.textContent?.trim() ?? ""));
  const story = reflection ? paragraphs.filter((node) => Boolean(node.compareDocumentPosition(reflection) & 4)) : paragraphs;
  const insert = (figure: HTMLElement, item: BookIllustration) => {
    const explicit = item.anchorId && Array.from(root.querySelectorAll("[id],[data-book-anchor]")).find((node) => node.id === item.anchorId || node.getAttribute("data-book-anchor") === item.anchorId);
    if (!explicit && item.placement === "before-reflection" && reflection) { reflection.before(figure); return; }
    const anchor = explicit || (item.placement === "after-opening" ? story[0] : item.placement === "before-reflection" ? paragraphs.at(-1) : story[Math.floor((story.length - 1) / 2)]);
    if (anchor) { (after.get(anchor) ?? anchor).after(figure); after.set(anchor, figure); }
    else (root.querySelector(".preview-body") ?? root).append(figure);
  };
  for (const item of illustrations) {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    let image = images.find((node) => !claimed.has(node) && node.dataset.illustrationSlot === item.slotId);
    // Adopt at most one unmarked legacy occurrence. Other occurrences of the
    // same file remain independent, including those with different captions.
    image ??= images.find((node) => !claimed.has(node) && !node.dataset.illustrationSlot
      && node.getAttribute("src") === (item.previousUrl ?? item.imageUrl)
      && (node.closest("figure")?.querySelector("figcaption")?.textContent?.trim() ?? "") === (item.previousCaption ?? item.imageCaption).trim());
    if (!image) {
      const figure = doc.createElement("figure"); figure.className = "chapter-image";
      image = doc.createElement("img"); figure.append(image); insert(figure, item);
    }
    claimed.add(image);
    image.setAttribute("src", item.imageUrl); image.alt = item.imageAlt;
    image.dataset.illustrationSlot = item.slotId;
    image.dataset.illustrationPlacement = item.placement ?? "chapter-middle";
    if (item.anchorId) image.dataset.illustrationAnchor = item.anchorId;
    let frame = image.closest("figure,.designer-free-image");
    if (!frame) { frame = doc.createElement("figure"); frame.className = "chapter-image"; image.replaceWith(frame); frame.append(image); }
    let caption = frame.querySelector("figcaption");
    if (item.imageCaption) { if (!caption) { caption = doc.createElement("figcaption"); frame.append(caption); } caption.textContent = item.imageCaption; }
    else caption?.remove();
  }
  // Validate against the import declarations before pagination takes its own
  // baseline. This catches lost occurrences/captions at the import boundary.
  for (const item of illustrations) {
    const matches = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter((image) => image.dataset.illustrationSlot === item.slotId);
    const image = matches[0];
    if (matches.length !== 1 || image.getAttribute("src") !== item.imageUrl || image.alt !== item.imageAlt
      || (image.closest("figure,.designer-free-image")?.querySelector("figcaption")?.textContent ?? "") !== item.imageCaption) {
      throw new Error(`Illustration ${item.slotId} or its caption could not be preserved. The original book has not been replaced.`);
    }
  }
}
