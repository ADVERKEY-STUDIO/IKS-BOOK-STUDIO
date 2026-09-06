/** Geometry measured from the same publication surface in every view. */
export function measureBookContent(content: HTMLElement) {
  const box = content.getBoundingClientRect();
  const css = getComputedStyle(content);
  const scale = box.height / Math.max(1, content.offsetHeight);
  const paddingTop = (parseFloat(css.paddingTop) || 0) * scale;
  const paddingBottom = (parseFloat(css.paddingBottom) || 0) * scale;
  const top = box.top + paddingTop;
  const footer = content.querySelector<HTMLElement>(":scope > .sheet-number,:scope > footer,:scope > .back-isbn-strip");
  const bottom = Math.min(box.bottom - paddingBottom, footer ? footer.getBoundingClientRect().top - 10 * scale : Infinity);
  const nodes = Array.from(content.querySelectorAll<HTMLElement>("*"))
    .filter((node) => !node.closest("footer,.sheet-number,.back-isbn-strip,.free-image-dragbar,.free-image-handle,.free-image-nudge") && node.getClientRects().length);
  const bounds = nodes.map((node) => node.getBoundingClientRect());
  const occupied = Math.max(top, ...bounds.map((rect) => rect.bottom));
  const tolerance = Math.max(1, 2 * scale);
  return {
    fillRatio: Math.max(0, (occupied - top) / Math.max(1, bottom - top)),
    overflowX: content.scrollWidth > content.clientWidth + 2 || bounds.some((rect) => rect.left < box.left - tolerance || rect.right > box.right + tolerance),
    overflowY: content.scrollHeight > content.clientHeight + 2 || occupied > bottom + tolerance || bounds.some((rect) => rect.top < box.top - tolerance),
  };
}

/** Extract only page chrome; preserve all story nodes in their authored order. */
export function pageFlowHtml(html: string, doc: Document = document) {
  const root = doc.createElement("div");
  root.innerHTML = html;
  const header = root.querySelector(":scope > header");
  const generated = Boolean(header && (header.matches(".print-chapter-header") || /^CHAPTER\s+\d+/i.test(header.textContent ?? "")));
  root.querySelectorAll(":scope > .sheet-number,:scope > .continued-title").forEach((node) => node.remove());
  if (generated) {
    header?.remove();
    root.querySelector(":scope > footer")?.remove();
    // Only pages with chapter chrome have a generated title to extract.
    // Headings on a custom page are part of the authored story.
    root.querySelector(":scope > h2")?.remove();
  }
  root.querySelectorAll(":scope > .preview-body").forEach((body) => body.replaceWith(...Array.from(body.childNodes)));
  return root.innerHTML.trim();
}

type NumberedPage = { slotId: string; html: string; kind: string; chapterId?: number; deleted: boolean; layoutLocked: boolean };

/** Update generated references during an explicit layout edit, never while
 * previewing. Authored titles, styles and custom numbering stay untouched. */
export function refreshBookPageNumbers<T extends NumberedPage>(pages: T[], previous: T[], chapters: { id: number; title: string }[], doc: Document = document): T[] {
  const numbering = (items: T[]) => {
    let number = 0;
    const slots = new Map<string, number>(); const starts = new Map<number, number>();
    items.filter((page) => !page.deleted && typeof page.chapterId === "number").forEach((page) => {
      slots.set(page.slotId, ++number);
      if (!starts.has(page.chapterId!)) starts.set(page.chapterId!, number);
    });
    return { slots, starts };
  };
  const before = numbering(previous); const after = numbering(pages);
  return pages.map((page) => {
    if (page.deleted || page.layoutLocked) return page;
    const root = doc.createElement("div"); root.innerHTML = page.html;
    let changed = false;
    const update = (element: Element | null, value: string, previousValue: string) => {
      if (!element || (!element.hasAttribute("data-book-page-number") && element.textContent?.trim() !== previousValue)) return;
      if (element.textContent !== value) { element.textContent = value; changed = true; }
    };
    const number = after.slots.get(page.slotId);
    if (number !== undefined) {
      update(root.querySelector(":scope > .print-chapter-header > span:last-child"), `PAGE ${number}`, `PAGE ${before.slots.get(page.slotId)}`);
      update(root.querySelector(":scope > .sheet-number > span:last-child"), String(number), String(before.slots.get(page.slotId)));
    }
    if (page.kind === "contents") root.querySelectorAll("ol > li").forEach((item) => {
      const markedChapter = Number(item.getAttribute("data-book-chapter"));
      const chapter = chapters.find((chapter) => chapter.id === markedChapter || item.querySelector(":scope > span")?.textContent?.trim() === chapter.title);
      const start = chapter && after.starts.get(chapter.id);
      if (chapter && start !== undefined) update(item.querySelector(":scope > i"), `p. ${start}`, `p. ${before.starts.get(chapter.id)}`);
    });
    return changed ? { ...page, html: root.innerHTML } : page;
  });
}

/** Split at word boundaries using DOM ranges so emphasis, links, spans and
 * paragraph attributes survive. Positioned artwork is never split. */
export function splitFlowBlock(html: string, accepts: (head: string) => boolean, doc: Document = document): [string, string] | null {
  const holder = doc.createElement("div"); holder.innerHTML = html;
  const element = holder.firstElementChild as HTMLElement | null;
  if (!element || element.querySelector("img,figure,table,[style*='position:']")) return null;
  if (element.matches("table")) {
    // Rowspans need a dedicated table editor; never split through a merged cell.
    if (element.querySelector("[rowspan]")) return null;
    const rows = Array.from(element.querySelectorAll(":scope > tbody > tr,:scope > tr"));
    for (let count = rows.length - 1; count >= 1; count--) {
      const head = element.cloneNode(true) as HTMLElement;
      const tail = element.cloneNode(true) as HTMLElement;
      head.querySelectorAll(":scope > tbody > tr,:scope > tr").forEach((row, index) => { if (index >= count) row.remove(); });
      tail.querySelectorAll(":scope > tbody > tr,:scope > tr").forEach((row, index) => { if (index < count) row.remove(); });
      head.querySelectorAll("tfoot").forEach((node) => node.remove());
      tail.querySelectorAll("caption").forEach((node) => node.remove());
      tail.removeAttribute("id");
      tail.querySelectorAll("thead").forEach((node) => { node.setAttribute("data-repeated-header", "true"); node.removeAttribute("id"); node.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id")); });
      if (accepts(head.outerHTML)) return [head.outerHTML, tail.outerHTML];
    }
    return null;
  }
  if (element.matches("ul,ol")) {
    const items = Array.from(element.children);
    for (let count = items.length - 1; count >= 1; count--) {
      const head = element.cloneNode(false) as HTMLElement;
      const tail = element.cloneNode(false) as HTMLElement;
      tail.removeAttribute("id");
      items.forEach((item, index) => (index < count ? head : tail).append(item.cloneNode(true)));
      if (element.tagName === "OL") {
        const step = element.hasAttribute("reversed") ? -1 : 1;
        const start = Number(element.getAttribute("start")) || (step < 0 ? items.length : 1);
        let next = start;
        items.slice(0, count).forEach((item) => { next = (item.hasAttribute("value") ? Number(item.getAttribute("value")) : next) + step; });
        head.setAttribute("start", String(start)); tail.setAttribute("start", String(next));
      }
      if (accepts(head.outerHTML)) return [head.outerHTML, tail.outerHTML];
    }
    return null;
  }
  if (!element.matches("p,blockquote")) return null;
  const text = element.textContent ?? "";
  const words = [...text.matchAll(/\S+\s*/g)];
  if (words.length < 24) return null;
  const splitAt = (offset: number): [string, string] => {
    const walker = doc.createTreeWalker(element, 4 /* SHOW_TEXT */);
    let node = walker.nextNode(); let remaining = offset;
    while (node && remaining > (node.textContent?.length ?? 0)) {
      remaining -= node.textContent?.length ?? 0; node = walker.nextNode();
    }
    if (!node) return [html, ""];
    const headRange = doc.createRange(); headRange.selectNodeContents(element); headRange.setEnd(node, remaining);
    const tailRange = doc.createRange(); tailRange.selectNodeContents(element); tailRange.setStart(node, remaining);
    const head = element.cloneNode(false) as HTMLElement; head.append(headRange.cloneContents());
    const tail = element.cloneNode(false) as HTMLElement; tail.append(tailRange.cloneContents()); tail.removeAttribute("id");
    const headIds = new Set(Array.from(head.querySelectorAll("[id]")).map((node) => node.id));
    tail.querySelectorAll("[id]").forEach((node) => { if (headIds.has(node.id)) node.removeAttribute("id"); });
    return [head.outerHTML, tail.outerHTML];
  };
  let low = 12; let high = words.length - 12; let result: [string, string] | null = null;
  while (low <= high) {
    const count = Math.floor((low + high) / 2);
    const word = words[count - 1];
    const parts = splitAt((word.index ?? 0) + word[0].length);
    if (accepts(parts[0])) { result = parts; low = count + 1; } else high = count - 1;
  }
  return result;
}

/** Pagination uses the browser's actual page measurements, never character
 * estimates. A figure remains at its story position with its caption. */
export function paginateFlowBlocks(blocks: string[], fits: (blocks: string[], pageIndex: number) => boolean, doc: Document = document, occupation?: (blocks: string[], pageIndex: number) => number) {
  const pages: string[][] = []; const pending = [...blocks]; let current: string[] = [];
  const image = (block: string) => /<(?:figure|img)\b/i.test(block);
  const paragraph = (block: string) => /^<(?:p|blockquote)\b/i.test(block);
  while (pending.length) {
    const block = pending.shift()!;
    const index = pages.length;
    const keepNext = /^<h[1-6]\b/i.test(block) || (image(block) && !current.some(paragraph));
    if (current.length && keepNext && pending[0] && !fits([...current, block, pending[0]], index) && fits([block, pending[0]], index + 1)) {
      pages.push(current); current = []; pending.unshift(block); continue;
    }
    if (fits([...current, block], index)) { current.push(block); continue; }
    // Carry a nearby paragraph with a figure instead of creating image-only
    // pages when that pair fits on the next page.
    const previous = current.at(-1);
    if (image(block) && previous && paragraph(previous)) {
      const count = /^<h[1-6]\b/i.test(current.at(-2) ?? "") ? 2 : 1;
      const carried = [...current.slice(-count), block];
      if (fits(carried, index + 1)) {
        current.splice(-count); if (current.length) pages.push(current); current = carried; continue;
      }
    }
    const parts = splitFlowBlock(block, (head) => fits([...current, head], index), doc);
    if (parts) { pages.push([...current, parts[0]]); current = []; pending.unshift(parts[1]); continue; }
    if (current.length) {
      const heading = current.at(-1)!;
      if (current.length > 1 && /^<h[1-6]\b/i.test(heading)) { current.pop(); pages.push(current); current = [heading]; pending.unshift(block); continue; }
      pages.push(current); current = []; pending.unshift(block); continue;
    }
    // Keep an unsplittable oversized block intact for preflight to identify.
    current.push(block);
  }
  if (current.length) pages.push(current);
  // Reconsider the final boundary. A one-item exercise or glossary tail
  // should share the last two pages with preceding content when it fits.
  for (let index = 0; index < pages.length - 1; index++) {
    const weight = (blocks: string[]) => {
      const root = doc.createElement("div"); root.innerHTML = blocks.join("");
      return (root.textContent?.length ?? 0) + root.querySelectorAll("img").length * 600;
    };
    const left = pages[index], right = pages[index + 1];
    const sparse = occupation
      ? (index > 0 && occupation(left, index) < .55) || (index + 1 === pages.length - 1 && occupation(right, index + 1) < .3)
      : index === pages.length - 2 && weight(right) < weight(left) * .5;
    if (sparse) {
      const all = [...left, ...right];
      const imbalance = (a: string[], b: string[]) => occupation ? Math.abs(occupation(a, index) - occupation(b, index + 1)) : Math.abs(weight(a) - weight(b));
      let best = [left, right]; let score = imbalance(left, right);
      const consider = (a: string[], b: string[]) => {
        if (!a.length || !b.length || /^<h[1-6]\b/i.test(a.at(-1)!)) return;
        const nextScore = imbalance(a, b);
        if (nextScore < score && fits(a, index) && fits(b, index + 1)) { best = [a, b]; score = nextScore; }
      };
      for (let boundary = 0; boundary < all.length; boundary++) {
        consider(all.slice(0, boundary), all.slice(boundary));
        const target = weight(all) / 2 - weight(all.slice(0, boundary));
        if (target > 0) {
          const parts = splitFlowBlock(all[boundary], (head) => weight([head]) <= target && fits([...all.slice(0, boundary), head], index), doc);
          if (parts) consider([...all.slice(0, boundary), parts[0]], [parts[1], ...all.slice(boundary + 1)]);
        }
      }
      pages.splice(index, 2, ...best);
    }
  }
  return pages.map((blocks) => blocks.join(""));
}

/** Compare the ordered reader content before committing a reflow. Repeated
 * table headers are presentation chrome; all other text and assets must survive. */
export function flowManifest(html: string, doc: Document = document) {
  const root = doc.createElement("div"); root.innerHTML = html;
  root.querySelectorAll("[data-repeated-header]").forEach((node) => node.remove());
  const assets = Array.from(root.querySelectorAll("img")).map((node) => [node.getAttribute("src"), node.getAttribute("alt")]);
  // Splitting a paragraph changes block boundaries, not its characters.
  const text = (root.textContent ?? "").replace(/\s+/gu, " ").trim();
  return JSON.stringify({ text, assets });
}

export function assertFlowPreserved(before: string, after: string, doc: Document = document) {
  if (flowManifest(before, doc) !== flowManifest(after, doc)) {
    throw new Error("Content verification failed: text or illustrations changed during pagination. The original pages have been preserved.");
  }
}

/** Issues that must be checked against the rendered page, including locked pages. */
export function inspectBookPage(content: HTMLElement): string[] {
  const issues: string[] = [];
  const geometry = measureBookContent(content);
  if (geometry.overflowX || geometry.overflowY) issues.push("Content crosses the printable area or overlaps the footer.");
  if (Array.from(content.querySelectorAll("img")).some((image) => !image.complete || !image.naturalWidth)) issues.push("An illustration has not loaded.");
  const flow = content.querySelector(":scope > .preview-body") ?? content;
  const last = flow.lastElementChild;
  if (last?.matches("h1,h2,h3,h4,h5,h6")) issues.push("A heading is stranded without its following text.");
  return issues;
}
