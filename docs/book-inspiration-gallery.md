# Book inspiration gallery

The studio dashboard and book toolbar open a curated library of eight real published books and historical manuscripts. Each record credits its creators and source, identifies the edition, and distinguishes interior previews, covers, and manuscript folios.

Readers can search and filter the collection, inspect original source-hosted previews, and select separate references for typography, palette, illustration, and layout. Selections and notes persist with an existing or newly created project. Compatible book design defaults update immediately; the design brief also travels into external manuscript and illustration prompts. Existing individual page overrides remain authoritative.

## Extending the collection

Add reviewed records to `lib/book-inspiration.ts`. Verify the publisher or library source, edition, preview identity, creator credits, and rights statement. Include explicit labels when only a cover is available. Direction suggestions are editorial interpretations, not claims about the original book's production specifications. Research candidates are recorded separately in `docs/research/book-inspiration-candidates.md`.

Preview images load from their original hosts and can become unavailable. The gallery supplies a fallback and source link. They are not imported into generated books. No automated crawler, asset reuse license, or finished-art generation service is introduced by this feature.

This release establishes the inspiration workflow. A dedicated illustrated-spread compositor and the broader devotional publishing workflow remain separate work; the existing age and manuscript workflow is retained.

## Validation

- All 210 automated tests pass, including selection mixing, persistence normalization, catalogue evidence, and illustration prompt integration.
- Production build and artifact validation pass.
- Browser checks cover desktop and mobile layouts, original previews, empty search, and saved selections after reload.
- Type checking reports the same 34 diagnostics on the baseline and this branch, with no new diagnostics introduced.
