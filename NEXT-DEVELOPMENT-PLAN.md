# Full next development plan — IKS Book Studio

Status: A–F core/import workspaces and Phase H–I production/review workspaces implemented; Phase G review studies ready with acceptance checks pending; paid generation deferred; Phase J and discovery expansion pending
Updated: 12 September 2026

Phase E implementation and PDF verification: `docs/development/PHASE-E-COMPLETED.md`.

Progress and qualified acceptance status: see `docs/development/REVIEW-A-THROUGH-D.md` and the phase completion reports. Scene comparison and artwork production remain later dependencies; the full product is not complete.

## 1. Product objective

Build a studio for producing visually exceptional editions of old Vedic and devotional works. The finished book should feel intentionally designed: accurate source text, thoughtful typography, expressive artwork where appropriate, consistent visual identity, and a varied reading rhythm.

Hanuman Chalisa is one possible pilot. The system must also accommodate verse collections, scripture with translation, commentary, devotional narratives, and illustrated family editions.

Every book should derive its design from its manuscript, audience, and editorial purpose. Variation should have a reason; consistent scripture typography and recurring visual motifs are desirable when they help the reader.

Professional quality is a production process involving selection, review, and revision. It cannot be guaranteed by an inspiration card, a template, or a single generation request.

## 2. Existing foundation and limits

Completed:

- Eight real-book and manuscript reference entries with credited source-hosted previews.
- Search, filters, detail previews, and dashboard inspiration shelf.
- Independent typography, palette, illustration, and layout reference selections.
- Saved reference choices and notes connected to compatible book defaults and production prompts.
- Dashboard overlap and responsive spacing correction.

Existing foundations include source imports, project persistence, illustration imports, editable placement, page measurement, preview/export, and print checks.

Limits to address:

- The primary workflow still assumes a children’s adaptation.
- There is no dedicated facing-page spread compositor.
- The disabled visual route does not produce finished painted artwork.
- Approved character references and asset revision history are not established.
- The gallery is curated; there is no automated discovery and review pipeline.
- The baseline has 34 TypeScript diagnostics. Track and resolve these without obscuring new errors.

## 3. Intended user journey

1. Create a book and choose its edition type, audience, languages, and print format.
2. Import the source and verify passage boundaries, attribution, and original text.
3. Explore real-book references and collect useful design qualities.
4. Compare proposed visual directions using the actual manuscript.
5. Approve an art guide and recurring character references where needed.
6. Review the whole-book storyboard and passage allocation.
7. Produce three contrasting sample spreads; revise and approve them.
8. Produce remaining spreads in manageable batches.
9. Refine illustrations, text placement, typography, and pacing in the designer.
10. Review editorial, visual, and print issues.
11. Export a proof, correct it, and produce the final edition.

Projects should resume at the last completed stage. Users must be able to revisit earlier decisions, with clear indications of which later outputs need review.

## 4. Main website workspaces

| Workspace | Purpose | Main output |
| --- | --- | --- |
| Library | Open projects and see production status | Resumable project |
| Edition setup | Define audience, content structure, and format | Edition brief |
| Source desk | Inspect and approve original passages | Verified content |
| Inspiration | Browse and combine real references | Selected design qualities |
| Art direction | Compare sample directions and define visual rules | Approved art guide |
| Characters and assets | Maintain recurring figures and reusable approved artwork | Reference library |
| Storyboard | Plan facing pages and visual rhythm | Whole-book spread plan |
| Production | Generate/import art and manage revisions | Approved spread assets |
| Designer | Compose text and artwork | Finished page compositions |
| Review | Resolve editorial and print issues | Approved proof |
| Export | Package final outputs | Print and digital files |

Keep these within one project workflow. Avoid exposing infrastructure details in normal book-design screens.

## 5. Phase A — Edition setup and protected content

### Build

Add edition types:

- Original verses with optional transliteration and translation.
- Scripture with commentary.
- Illustrated devotional edition.
- Devotional narrative or retelling.
- Children’s or family adaptation.

Make audience independent of edition type. Adult books must not inherit children’s activities, simplified language, or classroom sections.

Add source metadata: work title, source edition, author or traditional attribution, editor/translator when known, language, script, and source location. Preserve imported source files separately from edited content.

Create passage records with stable identifiers. Store original text, transliteration, translation, commentary, and editorial notes separately. Mark which fields are user-provided, extracted, or generated. Allow optional fields to remain absent.

Provide a source-review screen for correcting extraction, merging/splitting passages, comparing revisions, and approving original text. AI-generated translations or explanations require their own review status.

### Protection rules

- Layout and illustration operations cannot rewrite approved source text.
- Source corrections create revisions and mark dependent approvals stale.
- Generated explanations cannot silently replace original passages.
- Sanskrit, Hindi, and other languages are represented explicitly rather than assumed from the script.
- Test Devanagari shaping, conjuncts, diacritics, and Vedic accents using representative content and suitable fonts.

### Acceptance

An adult verse-and-commentary project can be created, saved, reopened, and exported without children’s adaptation rules. Approved text remains unchanged across these operations. A deliberate source edit is traceable and identifies affected spreads.

## 6. Phase B — Art-direction workspace

### Build

Convert gallery selections into an editable book-wide guide containing:

- Audience, tone, and reading purpose.
- Illustration medium, texture, line treatment, and level of detail.
- Palette with roles for reading areas, headings, accents, and illustrations.
- Typography for original verses, translation, commentary, and captions.
- Spacing, ornaments, borders, background treatment, and page-number conventions.
- Environments, architecture, clothing, symbolic details, and cultural constraints.
- References, user notes, and explicit avoidances.

Offer two or three direction proposals based on the manuscript. Show each through a representative page or spread using real project content. A color swatch or style name alone is insufficient.

Let users combine or revise proposals, then approve a version. Support modest, predominantly typographic books as well as richly illustrated books.

### Acceptance

The chosen guide persists and is attached to every subsequent production request. Changing the guide identifies assets and spreads made with an older version. Distinct manuscripts receive meaningfully different proposals.

## 7. Phase C — Character and visual continuity

### Build

For books with recurring figures, provide a character sheet containing:

- Name, narrative role, and identifying features.
- Face, body proportions, clothing, ornaments, colors, and held objects.
- Front, side, and three-quarter references as needed.
- Expression and pose examples.
- User-reviewed cultural and iconographic notes.

Allow finished reference uploads and reference-guided generation. Store approved and superseded versions. References for environments and recurring objects can use the same asset system.

### Acceptance

A production request identifies the exact approved reference versions it uses. Revising one scene does not unexpectedly replace the approved character definition. A reviewer can compare scenes side by side for continuity.

## 8. Phase D — Whole-book storyboard

### Build

Represent a spread as two facing pages, while handling the cover, opening right-hand page, and other single pages explicitly.

For each spread, record:

- Passage identifiers and content fields to display.
- Reading purpose and emotional tone.
- Scene or non-narrative visual concept.
- Composition and illustration requirements.
- Reserved text areas and approximate text budget.
- Relationship to preceding and following spreads.
- Production and approval status.

Provide a thumbnail overview, drag-to-reorder, passage reassignment, and a missing-content panel. Preserve content mappings when spreads move.

Use varied composition families: quiet verse pages, image-and-commentary pages, vignettes, close details, panoramic scenes, and multi-part narrative sequences. These are planning aids, not rigid templates imposed on every book.

Flag repeated compositions for review. Do not enforce arbitrary variety where a consistent reading structure serves the content.

### Acceptance

Every required passage has a visible allocation. Omissions and accidental duplication are detectable. Page parity remains valid after reordering. Long passages can use additional space without tiny text or forced cropping.

## 9. Phase E — Dedicated spread compositor

### Build

Add a new layout path alongside the existing flowing-text renderer. Store composition data independently of the editor interface.

Supported elements:

- Full-page and full-spread artwork.
- Contained illustrations and soft-edged assets.
- Original verse, transliteration, translation, commentary, and caption blocks.
- Optional ornaments, borders, and running page furniture.

Editing controls:

- Select, move, resize, align, and reorder layers.
- Crop and focal-point adjustment.
- Lock, hide, duplicate, and undo/redo.
- Typography, line spacing, text alignment, and inset controls.
- Guides for trim, bleed, gutter, margins, and text-safe areas.
- Book-wide defaults with explicit per-spread overrides.

Use physical dimensions for print composition. Scale the editor view without changing the underlying layout. For initial release, use reserved text regions rather than complex automatic contour text wrapping.

Typeset verses as editable text. Do not generate scripture lettering inside illustrations.

### Acceptance

A composition has matching positions, crops, text, and dimensions in designer, preview, and PDF. Overflow is visible and actionable. Text and important imagery avoid the gutter and unsafe trim regions. Saving and reopening preserves edits.

## 10. Phase F — Finished-art production and revisions

Imports and revision review implemented. The user selected “Build imports first; no paid generation yet.” Provider integration and generation jobs remain deferred. See [Phase F report](docs/development/PHASE-F-IMPORTS-COMPLETED.md).

### Build

Start with reliable imports of finished illustrations. Add a supported image-generation service behind a provider interface after checking current capabilities, credentials, cost, and reference-image support.

A production request should include the spread brief, approved art-guide version, character references, required dimensions, and reserved text areas. Store inputs and outputs so a revision can be reproduced or understood.

Support:

- Generate, import, revise, compare, approve, and restore versions.
- Revision notes such as changing expression or composition while preserving approved identity.
- File validation, image dimensions, effective print resolution, and asset provenance.
- Explicit selection of the approved asset for each spread.

Generation jobs need queued/running/failed/completed states, cancellation where supported, safe retries, and protection against duplicate billable submissions. Keep service credentials on the server. Show estimated usage before large batches and allow budget limits.

### Acceptance

Failed jobs can be retried without losing the brief or replacing approved art. A completed request does not overwrite newer user changes. Users can restore an earlier asset version. Imported artwork remains usable even if generation is unavailable.

## 11. Phase G — Three-spread pilot

Three heritage-art review studies and an editable draft workflow are available at `/pilot`. User acceptance and native PDF verification remain pending; see [Phase G review report](docs/development/PHASE-G-REVIEW-READY.md).

Before full-book production, choose a representative devotional work and produce three finished spreads:

1. A quiet devotional or verse-led composition.
2. A close character, ornament, or symbolic detail.
3. An expansive scene, or a denser commentary composition when better suited to the work.

Use the selected work’s real approved passages. The three samples should test differing demands, not force every book into an action-story structure.

Review together for source accuracy, typography, cultural appropriateness, continuity, visual pacing, and print reproduction. Examine actual-size proof pages in addition to thumbnails.

### Acceptance

The user approves the sample direction before remaining spreads are produced. Problems discovered in the pilot are fixed in the guide or compositor, rather than repeated throughout the book.

## 12. Phase H — Full-book production

Workspace implementation complete; finished-book acceptance remains pending. See [Phase H report](docs/development/PHASE-H-WORKSPACE-COMPLETED.md). The user authorized starting H after the G review milestone without closing outstanding pilot checks.

### Build

Produce remaining spreads in batches. Show progress by spread and distinguish drafts, awaiting review, approved, and stale outputs.

Offer a whole-book contact sheet to inspect repeated compositions, palette drift, inconsistent characters, and abrupt changes in density. Allow targeted rework without regenerating the entire book.

Design front and back matter as part of the edition: title page, edition/source credits, introduction where requested, contents where useful, glossary or notes where relevant, and colophon. Do not add generic filler sections automatically.

Add cover design using the book’s approved identity. Derive spine and cover dimensions from the selected printer’s actual requirements when available; do not guess them.

### Acceptance

All required content is accounted for, each spread uses approved assets, and the complete book reads coherently. Changing a single spread leaves unrelated approved work intact.

## 13. Phase I — Editorial, visual, and print review

Review workspace implemented and pilot browser audit completed. Publication sign-off and native PDF inspection remain pending. See [Phase I report](docs/development/PHASE-I-WORKSPACE-COMPLETED.md).

### Automated review

- Missing or duplicated passage allocations.
- Unexpected changes to approved source text.
- Overflow, clipping, missing glyphs, and unavailable fonts.
- Missing assets and insufficient resolution at placed size.
- Unsafe trim/gutter placement.
- Unresolved production errors and stale approvals.
- Differences between composition data and export output.

### Human review

- Meaning, translation, and commentary accuracy.
- Cultural and iconographic appropriateness.
- Character continuity and expressive quality.
- Typography, reading comfort, page rhythm, and overall visual quality.

Issues should point to the affected passage, element, or spread and allow a correction or documented resolution. Distinguish blocking errors from review suggestions.

### Acceptance

A reviewer can identify and resolve issues without searching the whole book manually. Final export makes unresolved critical problems explicit. Passing technical checks is not presented as proof of artistic excellence.

## 14. Phase J — Export and release

### Build

Provide a print PDF with selected physical dimensions, verified fonts, and appropriate bleed settings. Support a digital reading PDF separately where useful. Preserve existing export capabilities and identify any new-layout export limitations clearly.

Create a project backup containing composition data, approved content, references, and permitted project assets. Keep third-party inspiration previews out of the book asset package.

Export jobs should use a stable project revision so edits made during export do not create a mixed-version book.

### Acceptance

Inspect representative exported pages as images and at actual print size. Confirm page order, glyph rendering, artwork quality, and trim behavior. Test restoration from a project backup before considering it reliable.

For website release: migrate data compatibly, run regressions, review a staging build, and prepare rollback. A GitHub push does not constitute a live deployment.

## 15. Parallel track — Reference discovery and gallery expansion

Build a reviewed acquisition pipeline:

1. Discover candidates through publisher catalogues, libraries, museums, and institutional collections.
2. Record title, edition, creators, source URL, and preview availability.
3. Deduplicate editions and distinguish covers from interiors.
4. Inspect representative interiors and record useful design observations.
5. Record image-use status separately from visual quality.
6. Publish approved entries through an administrative review screen.
7. Recheck broken sources and stale metadata periodically.

Use crawling or source APIs only where access permits. Do not bypass access controls or automatically republish discovered images. A rights-uncertain entry can remain a source link while appropriate preview access is resolved.

Broaden coverage beyond the current publisher concentration, especially adult scripture, commentary, regional traditions, and typographically strong editions. The initial research register supplies candidates, not automatically approved gallery cards.

### Acceptance

Every visible card has verified identity and accurately labeled evidence. Gallery expansion improves useful design variety rather than merely increasing the card count.

## 16. Proposed data model

Exact schemas should follow a focused codebase review; these are the required domain concepts.

| Entity | Important responsibilities |
| --- | --- |
| Edition brief | Edition type, audience, languages, format, editorial purpose |
| Source edition | Attribution, imported source, source locations |
| Passage and revision | Original text and separate supplementary fields, approvals |
| Art guide and revision | Visual rules, references, approved direction |
| Character reference | Identity specification and approved asset versions |
| Spread plan | Content allocation, scene, composition intent, page parity |
| Spread composition | Physical geometry, text bindings, crops, layers |
| Asset and revision | Files, dimensions, provenance, approval history |
| Production job | Request revision, status, retries, usage, output |
| Review issue | Target, severity, decision, resolution |
| Export revision | Immutable input revision and resulting files |

Use stable IDs to connect content and layout. Keep large image files in asset storage and project metadata in the existing persistence layer. Version new data and migrate old projects without replacing their existing layout mode.

## 17. Engineering approach

- Audit the existing source, persistence, rendering, and export seams before schema changes.
- Keep the existing text-flow engine operational; select the spread renderer by explicit layout mode.
- Introduce focused modules for passage protection, spread composition, asset production, and review.
- Keep service adapters replaceable and production jobs independent of browser lifetime.
- Define how undo/redo and revision history interact: editing history is not an approval record.
- Preserve manual edits when regenerating plans or assets.
- Warn about affected downstream work before changing approved upstream inputs.
- Add meaningful tests for invariants and cross-surface behavior rather than tests that repeat implementation details.

## 18. Test and quality plan

| Area | Required evidence |
| --- | --- |
| Compatibility | Existing projects reopen and retain their current output |
| Content | Approved text survives transformations and exports |
| Language | Representative Devanagari, transliteration, and accent cases render correctly |
| Layout | Save/reload and designer/preview/PDF match |
| Persistence | Interrupted saves and stale edits do not silently lose work |
| Production | Retry, failure, cancellation, and stale result handling |
| Visual | Desktop/mobile workflow checks and actual-size spread review |
| Export | Page dimensions, ordering, embedded text, images, and glyph inspection |
| Recovery | Restore project backups and recover failed jobs |

Use the three-spread pilot as the first end-to-end acceptance fixture. Expand to a complete representative book before production release.

## 19. Dependencies and decisions

Resolve these at the relevant milestone, while progressing on independent work:

| Decision | Needed before |
| --- | --- |
| Pilot source work, source edition, and audience | Content approval and sample production |
| Translation/commentary scope and reviewer | Generated supplementary content approval |
| Initial print size and printer requirements | Final print/export acceptance |
| Image service, credentials, and budget | In-app generation and large batches |
| Required languages and font coverage | Typography acceptance |
| Preview display permissions and source access | Expanding hosted/displayed gallery material |
| Hosting and production release target | Live deployment |

Default implementation assumptions: retain the existing stack, support finished-art imports first, preserve editable text, provide manual review, and release new layout capabilities incrementally.

## 20. Delivery sequence and milestone gates

| Milestone | Deliverable | Gate to continue |
| --- | --- | --- |
| M1 | Edition setup and protected passages | Adult and family workflows behave correctly; text invariants pass |
| M2 | Art guide and reference management | One approved manuscript-specific direction |
| M3 | Storyboard and composition foundation | Complete passage allocation and stable facing-page model |
| M4 | Spread editor and export parity | Three distinct compositions render consistently |
| M5 | Finished-art production and revisions | Imported/generated assets can be reviewed and restored |
| M6 | Three finished sample spreads | User approval of reading and visual quality |
| M7 | Batch production and whole-book review | Complete representative edition reviewed |
| M8 | Final export, migration, and release | Proof accepted and release checks passed |

Reference-library expansion can proceed alongside these milestones. Avoid building a large crawler before the design and production workflow is proven.

Calendar and cost estimates should follow the M1 technical audit and image-service selection. Rendering complexity, language coverage, and the amount of art revision will materially affect them; fixed dates now would be speculative.

## 21. What to build immediately

Start M1 with a small representative manuscript:

1. Audit where children’s assumptions currently enter project defaults, source analysis, prompts, and exports.
2. Add edition type and independent audience selection with backward-compatible defaults.
3. Add stable passages with separate original, transliteration, translation, and commentary fields.
4. Build the source-review and approval screen.
5. Prevent generation and design operations from overwriting approved original text.
6. Verify save/reload and export with an adult devotional sample and an existing children’s project.
7. Demonstrate the completed workflow and record remaining issues before starting M2.

## 22. Definition of the completed product

A user can import a devotional work, verify its content, choose and refine a distinctive visual direction, approve recurring references, plan and compose facing pages, revise finished artwork, review the entire edition, and export a faithful print proof.

The result must preserve the text and intent of the chosen edition while allowing considered visual variety. The user retains control over source accuracy, cultural details, artwork approval, and final publication.
