/** Let the browser paint the saved page's CSS, including image fitting,
 * columns, theme borders and modern colours. Export must not restyle pages. */
export async function renderBookPageCanvas(sheet: HTMLElement, options: { scale: number; backgroundColor?: string }) {
  await document.fonts?.ready;
  await Promise.all(Array.from(sheet.querySelectorAll("img")).map((image) => image.decode()));
  const width = sheet.offsetWidth; const height = sheet.offsetHeight;
  if (!width || !height) throw new Error("The book page has no printable size");
  const resources = new Map<string, Promise<string>>();
  const embed = (url: string) => {
    if (url.startsWith("data:")) return Promise.resolve(url);
    const absolute = new URL(url, document.baseURI).href;
    if (!resources.has(absolute)) resources.set(absolute, (async () => {
      const response = await fetch(absolute, { credentials: "same-origin" });
      if (!response.ok) throw new Error("A page image or font could not be loaded for export");
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("A page image or font could not be read for export"));
        reader.readAsDataURL(blob);
      });
    })());
    return resources.get(absolute)!;
  };
  const embedCss = async (value: string) => {
    const urls = [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
    for (const match of urls) if (!match[1].startsWith("#")) value = value.replace(match[0], `url("${await embed(match[1])}")`);
    return value;
  };
  const pseudoRules: string[] = []; const families = new Set<string>();
  let nodeId = 0;
  const cssText = async (style: CSSStyleDeclaration) => {
    const declarations: string[] = [];
    // Set prefixed aliases before their standard longhands. In Chromium,
    // -webkit-border-image otherwise resets border-image-slice to "fill".
    for (const property of Array.from(style).reverse()) {
      if (property.startsWith("--")) continue;
      const value = style.getPropertyValue(property);
      declarations.push(`${property}:${value.includes("url(") ? await embedCss(value) : value};`);
    }
    return declarations.join("");
  };
  const cloneNode = async (source: Node): Promise<Node | null> => {
    if (!(source instanceof Element)) return source.cloneNode(false);
    if (source.matches("script,.free-image-dragbar,.free-image-handle,.free-image-nudge")) return null;
    const clone = source.cloneNode(false) as HTMLElement;
    const computed = getComputedStyle(source);
    families.add(computed.fontFamily.toLowerCase());
    clone.setAttribute("style", await cssText(computed));
    clone.removeAttribute("contenteditable");
    for (const attribute of Array.from(clone.attributes)) if (/^on/i.test(attribute.name)) clone.removeAttribute(attribute.name);
    const id = String(++nodeId); clone.setAttribute("data-book-raster-node", id);
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(source, pseudo);
      if (style.content !== "none" && style.content !== "normal" && style.display !== "none") {
        pseudoRules.push(`[data-book-raster-node="${id}"]${pseudo}{${await cssText(style)}}`);
      }
    }
    if (source instanceof HTMLImageElement) {
      clone.setAttribute("src", await embed(source.currentSrc || source.src));
      clone.removeAttribute("srcset"); clone.removeAttribute("loading");
    }
    for (const child of Array.from(source.childNodes)) {
      const copied = await cloneNode(child); if (copied) clone.append(copied);
    }
    return clone;
  };
  const clone = await cloneNode(sheet) as HTMLElement;
  // Screen zoom, scroll position and the editor's surrounding chrome do not
  // change the physical page. Child positions and transforms remain intact.
  Object.assign(clone.style, { position: "relative", inset: "auto", left: "0", top: "0", margin: "0", transform: "none", width: `${width}px`, height: `${height}px` });
  const fontRules: string[] = [];
  const collectFonts = async (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule && [...families].some((family) => family.includes(rule.style.fontFamily.replace(/["']/g, "").toLowerCase()))) fontRules.push(await embedCss(rule.cssText));
      else if ("cssRules" in rule) await collectFonts((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const stylesheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = stylesheet.cssRules; } catch { continue; }
    await collectFonts(rules);
  }
  const style = document.createElement("style"); style.textContent = [...fontRules, ...pseudoRules].join("\n");
  clone.prepend(style);
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * options.scale); canvas.height = Math.round(height * options.scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create a PDF page canvas");
  context.fillStyle = options.backgroundColor ?? "#fffdf8"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
