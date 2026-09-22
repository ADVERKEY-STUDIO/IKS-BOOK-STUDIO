import { templateDesignPrompt, templateLayout, templates, type TemplateBook, type TemplateId } from './template-book.ts';
import { validateBookArtwork } from './template-capacity.ts';

/** Construct from selected assets only; template examples never enter the book. */
export function createImageFirstBook(projectId: string, templateId: TemplateId, files: File[]) {
  if (!files.length || files.length > 80) throw Error('Choose between 1 and 80 images.');
  const images: Record<string, Blob> = {};
  const pages = files.map((file, index) => {
    const extension = file.name.match(/\.(png|jpe?g|webp)$/i)?.[1].toLowerCase();
    if (!extension) throw Error('Choose PNG, JPEG or WebP images.');
    const id = `spread-${String(index + 1).padStart(2, '0')}`;
    const image = `${id}.${extension}`;
    images[image] = file;
    return { id, image, title: '', original: '', meaning: '', sourceReference: '', scene: '', layout: templateLayout(templateId), fontSize: 22, imageScale: 100 };
  });
  validateBookArtwork(images);
  const book: TemplateBook = { format: 'iks-template-book-v1', contentMode: 'images', projectId, templateId, title: 'My picture book', language: 'English', characterGuide: '', pages };
  return { book, images };
}

export function imageDevelopmentPrompt(book: TemplateBook) {
  const template = templates.find(item => item.id === book.templateId)!;
  return `Develop new illustrations using the attached images as visual references for “${book.title}”. Read book.json and the images/ folder first. If you cannot access the images, ask me to attach them; do not guess what they contain.
Preserve the subjects, recognizable characters and important details of each reference. Use a consistent visual style across the book. User-written scene notes below describe requested changes; when blank, keep the scene faithful to the reference. Do not add new story text or rewrite book.json.
${templateDesignPrompt(book.templateId)}
The chosen book design is ${template.name}: ${template.description}. Borrow its composition and text placement, not its sample artwork or characters. The website adds all lettering; generate no text inside images. Each full spread is 420 × 250 mm. Keep essential subjects clear of the gutter and reserved text areas.
Composition rules: art-right/art-left = one half-spread image (210 × 250 mm); vignette = a small image within generous margins; panorama = wide art above a bottom reading band; immersive = full-spread art with the left 40% quiet for a text panel; poetry = a small image beneath centered text; study = a shallow image strip above text columns.
Generate a separate image for every entry below. Return Book-Images.zip containing images/<exact filename>, preserving the declared file formats. Do not return book.json, a montage, or template example artwork. Report any unfinished images honestly. I will upload the ZIP using “Upload all images ZIP” in the existing book; it replaces matching images only.
${book.pages.map((page, index) => `\n${index + 1}. Reference and output: images/${page.image}\nComposition: ${page.layout}\nScene notes: ${page.scene || 'Keep the supplied scene and subjects.'}\nText context (do not draw): ${page.original || '(not yet supplied)'}`).join('\n')}`;
}
