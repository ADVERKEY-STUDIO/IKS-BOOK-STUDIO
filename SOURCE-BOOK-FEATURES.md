# Source images and Sanskrit — phased implementation

## Phase 1: setup and saved preferences — complete

Setup and review choices cover new/source/mixed images, enhancement, illustration styles, chapter style exceptions, Sanskrit preservation and its companion text. Existing books retain their saved choices. New books now default to normal new illustrations plus source images, gentle cleaning and relevant source ślokas.

## Phase 2: prompts and package contract — complete

- Manuscript prompts request readable Sanskrit blocks in the Markdown and a separate `source-manifest.json` with verse text, source page, attribution, translation/transliteration/explanation and uncertainty notes. Verse blocks must match the manifest before import. Sanskrit is not generated from memory to fill unreadable source words.
- Normal generated illustration prompts remain. A source-image companion prompt requests extraction of real originals and lightly cleaned copies, keeping labels, diagram geometry and aspect ratios. It asks for explicit extraction failure notes instead of fabricated originals.
- Multiple source-image placements per section retain separate identities, exact context anchors and relevance reasons. Source-page references and captions are preserved. Pending source slots survive reopening and slot upgrades. Reordering imported sections updates the manifest's section references.
- Image ZIP imports store original and cleaned files, including unplaced originals. A Download source images button returns these folders and their manifest. Normal illustrations remain in `images/`; originals use `source-images/`; cleaned copies use `cleaned-source-images/`.
- Invalid paths, duplicate IDs/paths, mismatched verse text, missing anchors/files, invalid image data and changed illustration-stage manifests produce explicit import errors. Source metadata does not silently alter the approved manuscript.
- Existing plain Markdown imports remain supported. Sanskrit source blocks require the manifest ZIP. The manuscript-stage ZIP contract contains numbered reader files and one private manifest; the later image ZIP contains the actual files. Upload the source PDF and approved manifest to the external image tool as the prompt instructs.

### Verification

224 tests pass (194 unit/source tests and 30 Chromium browser tests). The expanded real ZIP workflow also passes in Firefox. It imports a Sanskrit block and explanation, two placements of one source image in the same chapter, and an unplaced original; downloads originals and cleaned copies; produces a PDF; and reloads saved settings. HTTP persistence and asset storage are mocked in this test; ZIP parsing, multipart upload construction, rendering and export are real application code. External AI extraction/enhancement is requested by prompts, not performed inside Book Studio.

Standalone TypeScript checking reports 34 existing errors. Enabling TypeScript import extensions for this no-emit project removes the previous import-extension diagnostics and supports the shared modules executed by the Node tests. No new feature-module errors remain. Production build and Worker artifact validation pass.

## Phase 3: review and layout safeguards — awaiting user approval

Add original/enhanced comparisons with approval and revert, source-image resolution and context review, source-PDF verse comparison, font and line-break checks, and verse/explanation/image-caption grouping improvements. Phase 2 checks package consistency; it cannot independently certify that the external AI faithfully extracted the original source. Automatic PDF extraction or in-app enhancement remains a separately agreed capability.

Stop after each phase, push it, and obtain the user's instruction before starting the next phase.
