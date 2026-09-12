# Phase E — Dedicated spread compositor

Completed core implementation: 12 September 2026

## Delivered

- A Designer workspace for existing storyboard plans, alongside the original flowing-text renderer.
- Independently stored composition records with physical millimetre geometry, plan/guide versions, source context, and optimistic project revisions.
- Protected source-bound original, transliteration, translation, and commentary layers; editable captions/page furniture; image and border layers.
- Selection, pointer movement, numeric move/resize, alignment, layer ordering, duplicate/delete, lock/hide, and bounded session undo/redo.
- Full-page/full-spread placement, contain/cover crops, focal-point controls, opacity, and soft-edge masking.
- Type size, line height, alignment, inset, ink, paper, and border colors. The bundled Devanagari-capable proof font is used throughout; arbitrary font uploads are not included.
- Book print defaults with per-spread overrides, trim/bleed/safe-margin/gutter guides, and zoom that does not alter physical coordinates.
- Measured DOM text overflow, source review, stale-plan/guide/source checks, missing planned layers, unsafe margins/gutter, missing artwork, and effective resolution warnings.
- Rebuild from storyboard is explicit and undoable. Outdated plan geometry cannot silently acknowledge new allocations through ordinary save.
- Self-contained selected-spread HTML proof, including font and image bytes, and native browser Print / Save as PDF using the same physical markup.
- Composition targets register source and art-guide dependencies.

## Validation

- 246 automated tests pass; production build and artifact validation pass.
- A–E API integration passes, including source preservation, exact saved coordinates, stale-edit rejection, protected-save rejection, and dependency registration.
- Browser checks cover creation, numeric resize, measured overflow, undo, lock, save state, preview, and HTML/print proof creation. The 390px viewport has no page-level horizontal overflow.
- Saved PDF was inspected with Poppler: one page, 1207.56 × 725.669 points (426 × 256 mm), embedded font streams, and visibly rendered Sanskrit with no clipping in the quiet text fixture.
- Native printing uncovered and corrected unwanted pagination. Print markup uses a one-pixel flow body and fixed sheet to preserve the full physical sheet without generating an extra blank page.
- Image crop/opacity/mask markup parity is tested. An image-rich native PDF was not inspected in this phase; that remains part of the three-spread pilot acceptance.
- Repository typecheck retains 34 existing diagnostics; no new compositor diagnostics were reported.

## Operational limits

The print dialog can override CSS paper size. The UI displays exact bleed dimensions and requires matching paper, zero printer margins, 100% scale, backgrounds enabled, and headers/footers disabled. Verify width and height in the resulting PDF; orientation labels vary with custom paper definitions.

Artwork currently comes from registered reference uploads. Independent production assets and revisions follow in Phase F. Whole-book PDF assembly and printer-specific release packaging remain Phase J. Technical checks do not establish artistic or iconographic quality.

Proof files used for verification are local QA artifacts, not approved book artwork. No live Cloudflare deployment is included in this phase push.

Next phase: F — Finished-art production and revisions, after user approval.
