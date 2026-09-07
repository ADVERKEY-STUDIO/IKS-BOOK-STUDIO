# Source images and Sanskrit — phased implementation

## Phase 1: setup and saved preferences — complete

- Setup step 3 includes generated, reused or mixed images; keep-original, clean/upscale or selected-image restyling preferences.
- Illustration styles include the existing book style, watercolour, ink, miniature-inspired art, realistic painting, collage and custom instructions.
- Sanskrit options include preserving source ślokas, Roman transliteration, translation and age-appropriate explanation.
- Setup review shows the choices. Existing books can edit them in Production workflow → Design, including chapter style exceptions, then use Advanced → Save project now.
- Preferences survive manuscript acceptance, illustration import, saving and reload. Older projects default to their existing generation behaviour; no source images or verses are changed in this phase.
- The UI explicitly identifies prompt/processing support as pending the next phase.

Verification: 189 unit/source tests pass. The real ZIP-import-to-PDF browser test selects these options and verifies their persistence in Chromium and Firefox. Existing targeted layout regressions also pass. Production build and Worker artifact validation pass. The repository's 38 pre-existing standalone TypeScript errors remain; no additional errors were reported.

## Phase 2: prompts and package contract — awaiting user approval

Wire preferences into manuscript and illustration prompts. Preserve source image identity, page references, captions and placement; supply original images for enhancement. Define Sanskrit verse, numbering, attribution, transliteration, translation, explanation and uncertainty fields. Validate and preserve this metadata during import. Do not generate missing original verse text.

## Phase 3: review and layout safeguards — not started

Add original/enhanced image comparison with approval and revert, resolution and placement checks, Sanskrit source comparison and font/line-break checks, and image-caption/verse-explanation layout regression tests. Automatic PDF image extraction or in-app enhancement requires a separately agreed scope; the planned initial path uses uploaded originals and externally enhanced results.

Stop after each phase, push it, and obtain the user's instruction before starting the next phase.
