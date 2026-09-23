/** Canvas measures text in the host document even when its source lives in an iframe. */
export async function prepareExportFont(document: Document, url: string) {
 const response = await fetch(url);
 if (!response.ok) throw Error('The book font could not be loaded for PDF export.');
 const bytes = await response.arrayBuffer();
 const face = new FontFace('Book', bytes);
 await face.load();
 document.fonts.add(face);
 return {
  async prepareClone(source: Document, clone: Document) {
   const cloneFace = new FontFace('Book', bytes);
   await cloneFace.load();
   clone.fonts.add(cloneFace);
   // Freeze container-relative typography before html2canvas lays out its clone.
   const originals = source.querySelectorAll<HTMLElement>('.spread, .spread *');
   clone.querySelectorAll<HTMLElement>('.spread, .spread *').forEach((element, index) => {
    if (!originals[index]) return;
    const style = source.defaultView!.getComputedStyle(originals[index]);
    element.style.fontSize = style.fontSize;
    element.style.fontFamily = style.fontFamily;
    element.style.lineHeight = style.lineHeight;
    element.style.letterSpacing = style.letterSpacing;
   });
   await clone.fonts.ready;
  },
  release() { document.fonts.delete(face); }
 };
}
