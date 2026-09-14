# Template book workflow

Entry: `/template-studio`, linked from the Library header as **Create from a template**.

## Reader workflow

1. Choose Painted devotion, Heritage folio or Quiet contemplation. Cards show original layouts with credited public-domain demonstration artwork, not copied published-book templates.
2. Select a PDF/DOCX (20 MB maximum), title and language. Copy the detailed prompt or download the request ZIP containing the prompt and source. Attach it in the external AI service.
3. Import `book.json` or a ZIP containing it and optional `images/` assets. Source text is preserved separately from meanings. Missing artwork is allowed.
4. Add image batches; exact filenames map automatically. Unmatched downloads offer a destination chooser. A continuation prompt lists only remaining scene images and retains the visual guide.
5. Edit original text, meanings, scene descriptions, source references, text size, artwork scale and left/right/vignette layouts. Read the book and print/save PDF from its preview.
6. Export `Editable-Book.zip`: manuscript, portable manifest, available images, preview HTML, font and license, README and the source if present. Restore a ZIP as a separate workspace without replacing existing books.

## Persistence and costs

This workflow runs locally in the browser. IndexedDB stores source, manuscript and images. It does not call paid AI APIs, upload the source to Book Studio's server or synchronize between browsers. Download backups before clearing browser data. External image generation follows the user's own service allowance and may require multiple sessions.

The existing devotional workspace and its approvals are independent. Template books use working proofs, not publication approval. An exported ZIP from this workspace is not the older chapter-package or edition-backup format.

## Contract

`lib/template-book.ts` defines `iks-template-book-v1`, three layout families, validated destinations, prompt generation and the print renderer. Every manifest carries a project ID; incoming manuscripts must match the current workspace. Existing edited manuscripts are not silently overwritten by later image batches. Restore creates a new workspace ID.

`lib/template-archive.ts` streams ZIP decompression with entry/output limits. It rejects traversal/duplicates and accepts only the manifest and raster image paths. UI imports decode actual images before saving; failed imports do not alter the prior draft. Maximum 80 spreads, 40 MB artwork, 10 MB/64 megapixels per image, 50 MB input batch and expanded archive budget. Manifests are limited to 2 MB. Preview escapes source content and runs in a script-disabled iframe.

## Validation

- Six behavior tests cover partial imports/continuation, identity checks, destination uniqueness, escaping and bounded ZIP handling.
- Scoped strict TypeScript check passes for the new route and modules.
- `vinext build` passes and includes `/template-studio`.
- Zen manual check: gallery, restore partial ZIP (1/2 images), edit original layout title, read assembled proof, download ZIP. Inspected downloaded manifest, artwork, font/license, preview and missing-image README.
- Repository-wide typecheck has pre-existing errors in legacy app and Worker code. The build wrapper requires GNU timeout, absent on this host; build invoked directly.

## Deliberate limits

Paintings remain raster assets; text and placement settings are editable. Templates do not guarantee artistic quality or complete source coverage from AI. Preview warns about detected text overflow and low placed image resolution. Source fidelity, character continuity and final print review still require inspection. Output is a working HTML/PDF proof, not PDF/X. Artwork generation is external, not an automatic background job.

### Structural compositions (September 14)

Four additional templates lead the gallery: Landscape journey (panoramic art and reading band), Painting & passage (full-spread art and opaque text inset), The sacred word (centered text with a small footer illustration), and Picture & commentary (art strip with separate original and meaning columns). These are editable layout values, carried in `book.json`, validated on import and rendered by the portable HTML export. Older three-layout books remain compatible. The generated prompt selects the corresponding primary composition and describes its illustration area. Gallery samples reuse credited public-domain artwork to demonstrate placement; they are not newly commissioned paintings. Review image cropping and text fit in the full proof before printing.

## Literary cover collection (September 2026)

Six original directions inspired by the selected Literary Hub covers are available at the top of `/template-studio`: The bold edition, The living atlas, The memory archive, The color story, The word edition, and The quiet atmosphere. Each card uses the portable book renderer to show one cover and one facing-page spread (two interior pages). “Look inside” opens a keyboard-dismissible modal; “Use template” enters the existing source/import/edit workflow.

Definitions, cover markup and shared layout styles live in `lib/literary-templates.ts`; sample text and responsive proof styling live in `lib/template-sample.ts`. The reference books are credited as cover inspiration; their interior pages and protected cover images are not packaged. Living atlas uses original generated demonstration art at `public/templates/living-atlas.png`; other photographic examples retain the existing public-domain credits. Uploaded first-spread artwork supplies the artwork on assembled literary covers.

Validation: nine template tests pass, the Vinext production build passes, and desktop/mobile gallery, enlarged previews, Escape dismissal and template selection were checked in the browser. Repository-wide TypeScript checking reports errors in existing `app/page.tsx`, `db/index.ts` and `worker/index.ts`; the new modules pass targeted lint.
