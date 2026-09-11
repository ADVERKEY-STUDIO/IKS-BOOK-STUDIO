# Phase A — Edition setup and protected content

Completed: 11 September 2026

## Delivered

- A new devotional edition entry point alongside the existing adaptation workflow.
- Five edition types and independent Adults, Families, and Children audience choices.
- Source edition, author/traditional attribution, editor/translator, language, script, and source-location metadata.
- Dedicated source desk with stable passage IDs and separate original, transliteration, translation, commentary, and private editorial-note fields.
- TXT, DOCX, and text-PDF import up to 10 MB. Original files are retained in asset storage and can be downloaded separately from edited passages.
- Extracted, user-provided, and generated provenance labels.
- Field-level review and approval. Supplementary text requires the original to be approved first.
- Explicit source corrections with reasons and previous/current revision comparison.
- Split and adjacent-merge operations with retired source records and lineage. Earlier supplementary content remains available for reassignment.
- Original corrections invalidate supplementary approvals and record affected bound work. Spread bindings will be supplied by the later storyboard/compositor phase.
- Saved edition metadata history, unsaved-edit navigation guards, and recoverable error messages.
- Server-controlled editorial commands and optimistic revision checks. Ordinary project saves cannot replace protected content.
- Saved devotional projects reopen in the source desk without children’s analysis or generation.
- Text reading proof, downloadable HTML with bundled font, and browser Print / Save as PDF. Unapproved or stale content blocks export; private notes are excluded.
- Library cards distinguish passages from adaptation chapters. Edition duplication copies the server-held editorial record.

## Verification

- 216 automated tests pass.
- Local API integration verifies exact source upload/download text, approval, persistence, stale-revision rejection, protected-content save rejection, approved export, blocked unapproved export, and translation approval invalidation.
- Browser checks cover adult edition setup, passage creation and approval, HTML download, fresh-page reopening, and desktop/mobile rendering.
- Representative Devanagari conjuncts, a Vedic accent, and Latin transliteration diacritics were visually inspected; the bundled Book Sanskrit font loaded and the original text matched exactly in the rendered DOM.
- 390px mobile proof has no horizontal overflow.
- Production build and artifact validation pass.
- TypeScript retains the 34 existing diagnostics; the new edition modules introduce no diagnostics.

Run unit tests with the repository’s Node runtime and `node --test tests/*.test.mjs`. With local preview running on port 5173, run `python3 scripts/verify-edition-api.py` for the API checks. The script uses an isolated verification owner and deletes its test project afterward.

## Boundaries

This phase provides source review and a text proof. It does not implement illustrated spread composition, art generation, translation generation, automatic OCR for scanned PDFs, or final press-ready export. Browser PDF output uses the browser print dialog. Font inspection covers the tested sample, not every script or every Vedic character.

Original extraction remains a draft: users must compare it with the retained source. A scanned PDF without usable text is rejected with an actionable message.

Existing children’s projects keep their established workflow. No existing project is automatically converted.

## Next phase — awaiting user approval

Phase B: a manuscript-specific art-direction workspace with editable visual rules, representative direction proposals, versioning, and approval.
