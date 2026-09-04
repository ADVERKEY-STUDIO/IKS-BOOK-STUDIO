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
export function paginateFlowBlocks(blocks: string[], fits: (blocks: string[], pageIndex: number) => boolean, doc: Document = document) {
  const pages: string[][] = []; const pending = [...blocks]; let current: string[] = [];
  const image = (block: string) => /<(?:figure|img)\b/i.test(block);
  const paragraph = (block: string) => /^<(?:p|blockquote)\b/i.test(block);
  while (pending.length) {
    const block = pending.shift()!;
    const index = pages.length;
    const keepNext = /^<h[1-6]\b/i.test(block) || image(block);
    if (current.length && keepNext && pending[0] && !fits([...current, block, pending[0]], index) && fits([block, pending[0]], index + 1)) {
      pages.push(current); current = []; pending.unshift(block); continue;
    }
    if (fits([...current, block], index)) { current.push(block); continue; }
    // Carry a nearby paragraph with a figure instead of creating image-only
    // pages when that pair fits on the next page.
    const previous = current.at(-1);
    if (image(block) && previous && paragraph(previous) && fits([previous, block], index + 1)) {
      current.pop(); if (current.length) pages.push(current); current = [previous, block]; continue;
    }
    const parts = splitFlowBlock(block, (head) => fits([...current, head], index), doc);
    if (parts) { pages.push([...current, parts[0]]); current = []; pending.unshift(parts[1]); continue; }
    if (current.length) { pages.push(current); current = []; pending.unshift(block); continue; }
    // Keep an unsplittable oversized block intact for preflight to identify.
    current.push(block);
  }
  if (current.length) pages.push(current);
  return pages.map((blocks) => blocks.join(""));
}
