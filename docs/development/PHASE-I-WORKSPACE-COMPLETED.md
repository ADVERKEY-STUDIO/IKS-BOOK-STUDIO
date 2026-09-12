# Phase I — Editorial, visual, and print review workspace

Implemented 12 September 2026. Workspace implementation is complete; the pilot is not an approved publication.

## Delivered

- A Review desk with blocking findings, suggestions, filters, explicit targets, and a downloadable Markdown report.
- Source review state, missing/duplicate allocation, changed source bindings, geometry/crop/gutter/resolution problems, missing compositions, unapproved assets, and stale production work are surfaced together. Duplicate source/guide warnings are consolidated.
- Findings navigate directly to the relevant source field, storyboard plan, art direction, or Designer layer.
- Browser audits inspect every active saved composition using the shared physical renderer. They check image retrieval/decoding, text overflow, the bundled font's Unicode glyph map, and preview/export markup parity.
- The bundled font is pinned by SHA-256. A changed font cannot silently inherit old coverage evidence. The audit protocol version is included in review context; bump it when renderer semantics change.
- Saved audit evidence is tied to source, composition, guide, reference/production assets, metadata, and physical settings. Edits invalidate that evidence. Incomplete or stale audit writes are rejected.
- Reviewer findings can target a book, passage, spread, or layer. Documented resolutions retain history and reopen after relevant book edits. Automatic blockers cannot be waived.
- Human decisions cover meaning/translation, cultural/iconographic accuracy, character continuity/expression, typography/rhythm, and actual-size printed proof. Notes and decision history are retained; technical success never supplies human approval.
- Spread proof exports check current rendered evidence and unresolved targeted critical reviewer findings. Pending final print approval does not prevent creating a working proof for inspection.
- Owner-scoped `/api/edition/review` exposes revision, findings, current render status, release readiness, and explicit outstanding release requirements. Phase J must use this readiness gate for its final release exporter. Existing text-only reading proof remains a source-review tool.

## Validation

- All 273 tests pass, including eleven new review/font tests. Coverage includes unwaivable blockers, incomplete/stale audit rejection, reopened resolutions, exact layer targeting, altered approved text, human approval independence, proof/release separation, real-font identity/coverage, cmap 4/12 boundaries and zero glyphs, and malformed font data.
- API integration passes for review persistence and status, context validation, unwaivable blockers, resolution history/reopening, human decisions, ownership isolation, and rejection of direct protected project writes.
- Live browser audit passed all four saved Gita pilot compositions: three artwork spreads plus the title page. No font coverage, image decode, text overflow, or preview/proof markup differences were reported.
- Browser navigation verified the art-guide link and exact Navagunjara artwork layer. Review layout has no page-level horizontal overflow at the observed 568 px viewport.
- Production build and artifact validation pass. TypeScript retains 34 pre-existing diagnostics, with no new Phase I diagnostics.

## Pilot review records

A suggestion asks the reviewer to assess the comparative use of Navagunjara beside Gita 11.12. The caption already distinguishes the historic composite iconography from a literal illustration of the verse; its suitability for the intended reader remains an editorial choice.

The actual-size printed-proof category is recorded as changes required because no native image-rich PDF has yet been exported and visually inspected. Browser/HTML checks passed, but they do not satisfy that requirement. No source, cultural, or printed-proof approval was fabricated.

## Limits

Unicode cmap coverage does not establish correct complex-script shaping, conjunct formation, Vedic accent positioning, or aesthetic typography. Preview/export markup parity does not establish the browser print dialog's PDF output. Both require visual inspection, including actual-size native PDF proof.

This phase implements the review workflow and runs the available technical checks. Outstanding source/art-guide/artwork approvals and human reviews remain visible. Whole-book release files, backups, restoration checks, and deployment are Phase J work. No paid generation or Cloudflare deployment occurred.

## Technical source

Font coverage follows Microsoft's [OpenType cmap specification](https://learn.microsoft.com/en-us/typography/opentype/spec/cmap), with Unicode format 12 preferred when present and format 4 used for BMP maps. The bundled font has SHA-256 `1191e07bfeb062d80e252eb85b0eafdfbda1e350707a2a60628668e8f677dbbb`.
