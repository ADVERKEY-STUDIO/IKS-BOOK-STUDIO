# IKS Book Studio — Consolidated Project Work

Prepared: 11 September 2026

## Scope of this document

This document brings together the work recorded in this project's source code, implementation notes, tests, and Git history. It describes project accomplishments rather than attributing every change to an individual: the available records do not establish who personally performed every piece of work.

Implemented features, historical verification results, known limitations, and proposed future work are separated below. This is a documentation review, not a fresh end-to-end certification of the application or a record of every saved book in hosted storage. The Hanuman Chalisa picture-book changes discussed on 11 September are proposals, not completed implementation.

## 1. Product and publishing workflow

Built IKS Book Studio to turn source books into editable, illustrated adaptations, with a workflow covering source selection, reader settings, chapter planning, manuscript creation, illustrations, review, page design, preview, and export.

- Added a publishing interface with chapter and illustration navigation.
- Added whole-book and chapter preview workflows.
- Added review queues, request history, and draft/publication export paths.
- Added local setup for the application originally exported as Sites version 84.

## 2. Source upload and analysis

- Support for PDF, DOCX, TXT, and Markdown source material.
- Source-aware chapter discovery and preservation of original chapter names.
- Chapter context, key-term, complexity, and source-page analysis.
- Scan-aware source intelligence and OCR outline review.
- Chunked large-PDF upload and resumable OCR work.
- Recovery work for malformed OCR batches without discarding completed progress.
- Source-range safeguards for chapter generation.
- Chapter discovery remains visible when imported source validation fails, allowing the publisher to understand and repair the problem.

## 3. Reader settings and adaptation planning

- Children-first reader bands: 7–9, 10–12, and 13–15.
- Writing modes: Friendly Guide, Story Journey, and Curious Explorer.
- Reader-dependent vocabulary, sentence length, and reading density.
- Separate adaptation approaches for explanation, narrative discovery, and inquiry.
- Source-aware chapter page recommendations instead of a uniform page allocation.
- Editable recommendations without a global maximum.
- Draft settings tracking so changes to reader or writing preferences can prompt a refresh.
- Pedagogy and chapter-quality checks, plus bounded feedback and fitting work.

## 4. Manuscript creation and external AI workflow

- Internal AI generation/review integration through the configured server-side provider.
- External AI manuscript prompt and import workflow.
- Structured book-package and manuscript ZIP validation.
- Preservation of the selected title and design settings during import.
- Recognition of introduction, conclusion, glossary, and appendix roles.
- Part labels attached to the appropriate following chapter.
- Import recovery for folder-wrapped ZIP files and ignored Finder metadata.
- Clear rejection of ambiguous manifests and inconsistent source packages.
- Copyable correction requests and retry support for repaired manuscript packages.

The external workflow depends on the external tool actually producing the requested manuscript or assets. A prompt requesting extraction or illustration is not evidence that Book Studio itself performs that work.

## 5. Visual identity and book styling

- Book personas that combine palette, mood, typography, illustration direction, cover style, motifs, and activity language.
- Persona families covering civic strategy, performance, science/nature, history, philosophy, folklore, and making/design.
- Page aesthetics, borders, watermarks, and font themes.
- Background uploads and background scope controls.
- Theme switching and expanded design controls.
- Border inheritance fixes, including preservation of the explicit No Border choice.
- Cover-background and opacity fixes.
- ISBN and MRP controls recorded in project history.

## 6. Illustrations and image handling

- Chapter illustration selection and upload workflows.
- Image ZIP imports and saved/staged image count reporting.
- Imported artwork occurrence IDs so the same image file can appear more than once with different captions.
- Placement metadata for chapter opening, middle, reflection, and explicit content anchors.
- Image ZIP updates that preserve existing Designer frames.
- Captions kept with their images.
- Free-placement images with drag, resize, and nudge controls.
- Trackpad interaction improvements, image reselection, and restored controls after reopening.
- Uploaded artwork handling and missing-illustration review information.

Finished hand-painted book art still requires suitable supplied/generated artwork. The existing illustration infrastructure does not establish a complete reference-guided character-consistency pipeline.

## 7. Source images and original/cleaned asset workflow

- Preferences for generated, source-first, reused, and mixed artwork.
- Original, cleaned, and restyled image choices, including chapter-specific style exceptions.
- Source-image extraction prompts requesting genuine originals and cleaned copies.
- Separate storage/package conventions for generated images, source originals, and cleaned source images.
- Retention of unplaced original images.
- Source-image ZIP download with accompanying manifest.
- Multiple context-linked placements, relevance reasons, and source-page references.
- Validation of duplicate IDs, paths, file data, missing anchors, and changed manifests.
- Side-by-side original/cleaned review with dimensions and placement reasons.
- Approval of cleaned artwork or restoration of originals across occurrences while retaining saved frames.
- Structured extraction notes and clearer handling of incomplete extraction.

## 8. Source verses and Devanagari support

- Source-verse preservation preferences and optional transliteration, translation, and explanation.
- Manifest records for verse text, source page, attribution, companion text, and uncertainty.
- Validation that manuscript verse blocks match the supplied manifest.
- Correction flows for missing verse blocks instead of silently dropping them.
- Local source-PDF page-text extraction for comparison.
- Manual comparison for scanned or unreadable text.
- Human approval checks for attribution, line breaks, and companion text.
- Changed source/context/text requires fresh review.
- Preview checks for altered verses, companion text, and source-image placements.
- Bundled Devanagari font support in Designer, Preview, and raster PDF export.
- Verse groups kept together during pagination; oversized groups reported for editing.

The existing interface uses Sanskrit-oriented terminology. A Hanuman Chalisa edition needs language-aware labels and validation appropriate to its source text rather than assuming all Devanagari text is Sanskrit.

## 9. Designer Studio editing

- Whole-book editing and continuous Word-style pagination work.
- Per-page saving and a shared page representation.
- Typography, alignment, selected-text sizing, and editing toolbar controls.
- Undo/redo visibility and behavior improvements.
- Caret stability and boundary-editing fixes.
- Page tracking, global page counts, and page numbering controls.
- Blank-page deletion and page-order recovery work.
- Manual Canva page workflow and protection of custom compositions.
- Background, free-image, and free-text composition support.
- Protection for locked pages, intentional blanks, and manually positioned compositions during automatic reflow.

## 10. Layout and pagination reliability

- Shared publication geometry for Designer, Preview, and PDF.
- Font/image loading before page measurement.
- Actual rendered-page measurements instead of relying solely on character estimates.
- Recursive pagination of ordinary nested content containers.
- Paragraph splitting that retains inline formatting.
- Ordered-list splitting that retains numbering.
- Table splitting by rows with repeated headers where supported.
- Heading/following-content and nearby figure/paragraph grouping.
- Measured contents-page pagination.
- Balancing of sparse adjacent pages and short final pages.
- Ordered text and image preservation checks before committing reflow.
- Automatic repair of eligible saved in-flow image overflow when opening completed books.
- Preservation of deliberate free layouts and oversized indivisible content for manual review.

## 11. Book formats and publication checks

- Four trim formats: 7 × 10 inches, A4, A5, and 6 × 9 inches.
- Format-specific page geometry and preview assessment.
- Checks for page overflow, footer collisions, broken images, stranded headings, and private production text.
- Sparse-page and effective image-resolution findings.
- Page-linked review findings in Preview.
- Shared structural inspection across Designer, Preview, and export.

Checks help identify structural problems; they cannot certify visual beauty, source accuracy, or character consistency.

## 12. PDF and DOCX export

- PDF and DOCX export infrastructure.
- Raster publication rendering and preservation of computed styles during PDF export.
- Frozen publication DOM during export to avoid lost captions or footers.
- Work to prevent long PDF exports from exhausting browser memory.
- Exact failing-page reporting for PDF errors.
- PDF page-count verification recorded in implementation notes.
- PDF engine preloading to avoid a missing lazy-loaded module during download.
- Publication downloads allowed even when editorial approval, artwork, or layout review is incomplete.
- Review findings remain visible; missing renderable pages or actual rendering failures can still prevent export.

The 7 September download-policy update supersedes older notes claiming that structural review findings always block publication downloads. Publication download is not a certificate of editorial completion.

## 13. Storage and application foundation

- React/TypeScript application using Next.js/Vinext and Vite tooling.
- Worker-side API, source processing, provider integration, and export code.
- Cloudflare-compatible D1 persistence and R2 asset storage bindings.
- Drizzle migration tooling.
- Local and hosted storage separation documented in local setup.
- Saved-book reload and persistence-related fixes, including pruning nested history associated with oversized database writes.
- Build/artifact validation helpers and local setup documentation.

This report does not inspect credentials, enumerate hosted user books, or verify current deployment health.

## 14. Testing and verification already recorded

The repository contains unit/source tests and browser workflows for planning, imports, persona settings, typography, illustration handling, source review, pagination, publication safety, and export.

Historical reports include:

| Milestone | Recorded result | Scope/limitation |
| --- | --- | --- |
| Book structure recheck | 186 unit/source tests; 27 browser tests in each of Chromium and Firefox | Historical result, not rerun for this document |
| Source package implementation | 194 unit/source tests plus 30 Chromium browser tests | External extraction/generation excluded |
| Source review safeguards | 228 unit and Chromium browser tests | Historical milestone total |
| Import recovery update | 231 tests | Historical milestone total; not a new run |
| Build validation | Production build and Worker artifact validation reported passing | Applies to the recorded revisions |
| TypeScript | Latest source-feature notes report 34 existing diagnostics | Current count not remeasured |

Recorded browser workflows exercise real ZIP parsing, multipart request construction, rendering, source comparisons, and PDF export, while mocking HTTP persistence and asset storage. They do not verify live external AI behavior or hosted storage.

Earlier visual checks include an exported illustrated PDF page, matching Designer/Preview image geometry, and a 27-section structural stress fixture. That stress fixture used representative repeated artwork rather than every final illustration and retained spacing warnings.

No tests were rerun for this documentation-only task. Different historical totals describe different milestones and must not be added together.

## 15. Known limits and unfinished work

- Professional picture-book quality is not guaranteed by the current style settings or layout checks.
- External illustration, extraction, and enhancement requests still require suitable tool outputs and editorial review.
- A full book-wide character reference and consistency system is not established by the inspected code.
- Automatic reflow intentionally avoids protected manual compositions.
- Oversized verse groups, merged tables, missing assets, and unsuitable artwork can require manual adjustment.
- Historical TypeScript diagnostics remain documented; a clean typecheck is not claimed.
- Older README descriptions of deterministic context visuals should not be treated as evidence of a current finished-art generation service.

## 16. Proposed next stage: Hanuman Chalisa picture book

Status: discussed and recommended; not implemented in this conversation.

Target: an illustrated devotional book with expressive hand-drawn outlines, textured watercolor/gouache, consistent Hanuman artwork, and short readable text integrated into calm areas of each composition.

Recommended system changes:

1. Add an Illustrated Devotional Picture Book mode based on verses and facing-page spreads.
2. Store a reusable book art guide covering palette, texture, proportions, costume, ornaments, environments, and reference artwork.
3. Create approved Hanuman character reference sheets and reuse them throughout art production.
4. Plan each spread's source verse, meaning, scene, composition, and reserved text area before illustration.
5. Add reference-guided artwork production/import, revisions, and version history.
6. Add a spread compositor for full-page artwork, facing-page compositions, and vignettes.
7. Keep Devanagari text separately typeset and editable rather than baked into generated pictures.
8. Use language-aware source-text handling for the Hanuman Chalisa.
9. Extend review to character continuity, art consistency, gutter clearance, cropping, and text contrast.
10. Produce three sample spreads before the full book: a quiet devotional scene, a close-up, and an action scene.

One or two chaupais per spread is an initial design hypothesis, not an approved final page plan. Audience, translation length, transliteration, and trim size will determine the final layout.

## 17. Main implementation locations

| Location | Responsibility |
| --- | --- |
| `app/page.tsx` | Main studio interface and workflow coordination |
| `app/globals.css` | Application and book-page styling |
| `app/components/source-book-options.tsx` | Source artwork and verse preferences |
| `app/components/source-book-review.tsx` | Source artwork and verse review interface |
| `worker/index.ts` | Server/API, storage, processing, provider and export work |
| `lib/source-intelligence.ts` | Source analysis |
| `lib/pedagogy.ts`, `lib/adaptation-pages.ts` | Adaptation and page-planning logic |
| `lib/external-manuscript.ts`, `lib/manuscript-import.ts` | External manuscript and import workflows |
| `lib/book-package.ts`, `lib/source-book-package.ts` | Package contracts and validation |
| `lib/book-persona.ts` | Book visual/persona definitions |
| `lib/book-illustrations.ts` | Illustration occurrence identity and placement |
| `lib/source-book-options.ts`, `lib/source-book-review.ts` | Source preferences and review rules |
| `lib/book-layout.ts`, `lib/book-format.ts` | Pagination, geometry, formats and inspection |
| `lib/book-raster.ts`, `lib/publication.ts` | Publication rendering and checks |
| `tests/`, `tests/browser/` | Automated regression coverage |

## 18. Evidence used

- `README.md`
- `LOCAL_SETUP.md`
- `BOOK-STRUCTURE-IMPLEMENTATION.md`
- `BOOK-STRUCTURE-RECHECK.md`
- `SOURCE-BOOK-FEATURES.md`
- Current inspected source modules and test-file inventory
- Git commit history through the revision recorded in the appendix

The appendix preserves commit subjects as historical records. Reverts, merges, and historical feature names are not independent guarantees of current behavior.


## Appendix: recorded Git history

Snapshot: `7f16666` (10 September 2026). The repository contains 157 commits at this revision, listed newest first.

| Commit | Date | Recorded change |
| --- | --- | --- |
| `7f16666` | 2026-09-10 | Prefer contextual source images and accept structured extraction notes |
| `d86c072` | 2026-09-10 | Align mixed source artwork prompts and explain Sanskrit script failures |
| `b7cce9d` | 2026-09-08 | Keep detected chapters visible when manuscript source validation fails |
| `eb1c2ac` | 2026-09-08 | Add source artwork and Sanskrit review with layout safeguards |
| `4cf2233` | 2026-09-07 | Add source image and Sanskrit manuscript package workflow |
| `72b18ef` | 2026-09-07 | Allow unfinished publication PDF exports and preload PDF engine |
| `8833c52` | 2026-09-07 | Add phase one source image and Sanskrit book preferences |
| `493ee15` | 2026-09-07 | Verify borderless rendering and legacy border defaults |
| `eb79052` | 2026-09-07 | Fix page border inheritance: preserve No Border choice and add inherit option |
| `a2ca22c` | 2026-09-07 | Repair saved image overflow and close book workflow review gaps |
| `b0af780` | 2026-09-07 | Make book layout measurable, preserve export geometry, and enforce publication checks |
| `5bfce1d` | 2026-09-05 | Fix Designer page tracking and private captions |
| `debac55` | 2026-09-05 | Unify Designer preview and PDF layouts |
| `dc970f8` | 2026-09-03 | Fix Designer Preview PDF consistency and export |
| `9efb844` | 2026-09-02 | Report exact failing PDF pages |
| `b7b7411` | 2026-09-02 | Add quality-first book format previews |
| `c3993d3` | 2026-09-02 | Prevent long PDF exports from exhausting browser memory |
| `765f0a0` | 2026-09-02 | Improve publication-safe book exports |
| `84ef8f5` | 2026-09-01 | Add publication safety module and regression tests |
| `4e3e284` | 2026-09-01 |  fixed diagnosing bugs |
| `6ae779b` | 2026-09-01 | image .zip files function added |
| `5fc911f` | 2026-09-01 | FIxed again overflowing of text |
| `da8d213` | 2026-09-01 | ADDED ICON |
| `f099837` | 2026-09-01 | fixed again overflowing of text and image |
| `338ce28` | 2026-09-01 | Image Feature |
| `1ad289a` | 2026-08-31 | fix: disable column gap for single column (deploy) |
| `e29d60c` | 2026-08-31 | fix: typo designerBasePages for cover handling (deploy fix) |
| `06a7cae` | 2026-08-31 | added alignment again |
| `e3bff80` | 2026-08-31 | ADDED ALINGMENT |
| `7b7186f` | 2026-08-31 | FIXED THE OPACITY |
| `43e3f62` | 2026-08-31 | Feature Added ISBN and MRP |
| `978442d` | 2026-08-31 | fixed the undo and redo button working |
| `7114c15` | 2026-08-31 | Poslished  the undo and redo button |
| `893a69c` | 2026-08-31 | Fix Designer caret stability and editing control |
| `40f99ca` | 2026-08-31 | Revert "Merge pull request #1 from Gaurav60419430/updrade-branch" |
| `b16eed6` | 2026-08-27 | Merge pull request #1 from Gaurav60419430/updrade-branch |
| `6ae6202` | 2026-08-27 | Fix Selected text size spinner not applying (was onBlur only) |
| `ed9f72b` | 2026-08-26 | fix designer image position and preview overlay |
| `8be3cd4` | 2026-08-26 | Make Undo/Redo more visible in Designer toolbar |
| `6209f5d` | 2026-08-26 | Make Designer and Preview pages exactly same (pixel-identical book page) |
| `fc04ed0` | 2026-08-26 | Fix free image reselection drag without rerender (trackpad) |
| `a1af02e` | 2026-08-26 | Fix persistent interactive image sizing |
| `9174646` | 2026-08-26 | Improve Designer workflow and background chooser |
| `065056c` | 2026-08-24 | Polish free image editing and preview |
| `4b0bfdb` | 2026-08-24 | Restore free image controls after reopening |
| `44fe187` | 2026-08-24 | Fix arrow nudge not working for free image (trackpad) |
| `75c752e` | 2026-08-24 | Make free image move easy for trackpad (larger bar + nudge pad) |
| `015ff15` | 2026-08-24 | Make free image drag trackpad-friendly (easy move) |
| `a95f1e9` | 2026-08-24 | Add free-placement image anywhere with pointer height/width handles (Designer) |
| `bfbf09d` | 2026-08-24 | Restore tracked code to GitHub main |
| `523b8bb` | 2026-08-24 | Recover collapsed Designer page orders |
| `c4dc4aa` | 2026-08-24 | Fix Designer page recovery and boundary editing |
| `b10cec1` | 2026-08-24 | Add continuous Word-style Designer pagination |
| `44a87b6` | 2026-08-24 | Fix planned page count and text selection |
| `579f63c` | 2026-08-24 | Merge commit '3c918510c933815f68e4f8fd9aaaa8cbb55f6595' |
| `3ebc271` | 2026-08-24 | Upgrade Designer production workflow |
| `6427c4d` | 2026-08-24 | Bind existing Cloudflare D1 database |
| `fc8b369` | 2026-08-24 | Fix Cloudflare D1 and R2 provisioning |
| `3c91851` | 2026-08-24 | Publish local Sites updates |
| `379cea2` | 2026-08-22 | chore: verify push 2026-08-22T12:37:12Z — re-push to confirm live on origin/main |
| `9fd6156` | 2026-08-22 | Make global book page badge visible (was 7px) |
| `0ee2e38` | 2026-08-22 | Add global book page count regardless of chapter in Designer |
| `ae0b229` | 2026-08-22 | Add built-in page number system and shift-anywhere in Designer |
| `6afebd4` | 2026-08-22 | Fix outside-Designer image upload not showing in Preview |
| `c62e25a` | 2026-08-22 | Add live theme switcher for preview (Original/Banyan/Curious/Scholar) — local only, no push of Structured gallery |
| `147fb4d` | 2026-08-22 | Fix Designer Preview SQLITE_TOOBIG: prune nested history |
| `da9a08a` | 2026-08-21 | Revert JS transparent paper for backgrounds, rely on CSS has-background |
| `333a505` | 2026-08-21 | Fix floral background not showing: make paper transparent on upload |
| `a3f7596` | 2026-08-21 | Add Delete page button for blank pages in Designer |
| `118a81f` | 2026-08-21 | Fix Designer/Preview A4 mismatch: unify pagination to 794px A4 |
| `abfc86e` | 2026-08-21 | Fix cover background: remove green overlay when cover has uploaded background |
| `a040e3c` | 2026-08-21 | Import IKS Book Studio version 84 |
| `ff29983` | 2026-08-21 | Unify page manifest and repair pagination |
| `576df0d` | 2026-08-21 | Unify Designer with final preview pages and add per-page saving |
| `3bf3d6d` | 2026-08-21 | Add external AI manuscript workflow |
| `e4ffb61` | 2026-08-21 | Recover malformed OCR batches without losing progress |
| `16d4ff0` | 2026-08-21 | Add resumable OCR and Nemotron source intelligence |
| `03b8a7f` | 2026-08-21 | Add scan-aware source intelligence, chunked large-PDF upload, OCR outline review, and range-safe generation |
| `724411f` | 2026-08-20 | Measure and compact real A4 chapter layouts |
| `574f4b4` | 2026-08-20 | Match Designer layout in Preview and PDF |
| `bc6b199` | 2026-08-20 | Add continuous whole-book designer and local layout balancing |
| `32be763` | 2026-08-20 | Add background scope chooser |
| `7254b84` | 2026-08-20 | Repair Designer background upload request |
| `926f094` | 2026-08-20 | Fix Designer Studio background uploads |
| `91fcb99` | 2026-08-20 | Expand Designer Studio controls |
| `3143931` | 2026-08-20 | Add final Designer Studio |
| `6ef09f1` | 2026-08-20 | Keep typography control inside editor toolbar |
| `3164c7e` | 2026-08-20 | Add manual Canva page workflow and expanded book design controls |
| `8c83a44` | 2026-08-20 | Add source-led Book Persona publishing system |
| `5f26c41` | 2026-08-14 | Pack sparse chapter pages with their illustrations |
| `7e663c8` | 2026-08-14 | Fill chapter pages and tighten subsection spacing |
| `3da5b1f` | 2026-08-14 | Add whole-book and complete-chapter preview modes |
| `6120130` | 2026-08-14 | Simplify book preview and allow PDF export at every stage |
| `fa3b804` | 2026-08-14 | Redesign the studio with a premium editorial publishing interface |
| `507d400` | 2026-08-14 | Complete publishing navigation with Chapters and Illustrations |
| `b29254f` | 2026-08-14 | Unify publishing workflow, review queue, request history, and proof/final PDF export |
| `ac44da4` | 2026-08-14 | Fix preview mounting and PDF print export flow |
| `6b92fc2` | 2026-08-13 | Automate bounded chapter quality feedback |
| `ce9e7f9` | 2026-08-13 | Align chapter quality budget and add safe local fitting |
| `ab5b394` | 2026-08-13 | Create chapter-specific narrative illustration workflow |
| `0cee13a` | 2026-08-13 | Use A4 space efficiently in PDF export |
| `2ab952c` | 2026-08-13 | Fix PDF pagination and add contextual illustration prompts |
| `9839479` | 2026-08-13 | Add designer handoff PDF export and larger typography |
| `3f882c2` | 2026-08-13 | Simplify chapter-wise generation workflow |
| `f17d84c` | 2026-08-13 | Keep compact chapter wrapper |
| `74f52a0` | 2026-08-13 | Score compact chapters locally |
| `79d33b7` | 2026-08-13 | Place two required teaching examples |
| `1787e48` | 2026-08-13 | Reject empty teaching sections |
| `e7abeac` | 2026-08-13 | Compact Phase 8 Nemotron response |
| `9049193` | 2026-08-13 | Tune Phase 8 Chapter 1 trial |
| `969d868` | 2026-08-13 | Make Phase 7 single request fully measurable |
| `501430c` | 2026-08-13 | Add Phase 7 Chapter 1 evaluation gate |
| `9f66a56` | 2026-08-13 | Add simplified Nemotron book workflow |
| `f188645` | 2026-08-13 | Control chapter requests and retries |
| `7c7757f` | 2026-08-13 | Protect resumable chapter generation |
| `24cc129` | 2026-08-13 | Add token-smart resumable Nemotron chapter generation |
| `09ca530` | 2026-08-13 | Apply OpenRouter secret to Phase 1 connection check |
| `b47369f` | 2026-08-13 | Add protected OpenRouter connection check |
| `de741b5` | 2026-08-12 | Simplify ChatGPT book exchange to two ZIP files |
| `8e5f184` | 2026-08-12 | Add structured full-book package import |
| `48934b9` | 2026-08-12 | Plan essential ideas within chapter space |
| `effa9eb` | 2026-08-12 | Enforce concise page-aware chapter length |
| `574ec4c` | 2026-08-12 | Enforce author voice before quality scoring |
| `dcbc4e3` | 2026-08-12 | Use stable Gemini 3.5 teaching model |
| `a6d1814` | 2026-08-12 | Retry Gemini rate limits with backoff |
| `1208fbb` | 2026-08-12 | Exclude source front matter from chapter context |
| `fbfe963` | 2026-08-12 | Recover incomplete Gemini responses |
| `ed822d3` | 2026-08-12 | Retry temporary Gemini capacity errors |
| `3789af9` | 2026-08-12 | Upgrade Gemini chapter planning and quality review |
| `632b216` | 2026-08-12 | Match preview sheets to PDF and add no-border option |
| `e018f3a` | 2026-08-12 | Fix print borders and add page watermarks |
| `fa073b5` | 2026-08-12 | Add whole-book typography choices and live specimens |
| `e2947f5` | 2026-08-11 | Add selectable book borders with live page glimpses |
| `d09f742` | 2026-08-11 | Write every adaptation in a clean authorial voice |
| `029c5cd` | 2026-08-11 | Add page aesthetics and live page previews |
| `c1f138b` | 2026-08-11 | Use one natural age-based writing pipeline |
| `3ea47b6` | 2026-08-11 | Use natural chapter lengths under 100 pages |
| `40b0d69` | 2026-08-11 | Keep source-aware adaptations within 100 pages |
| `3246dca` | 2026-08-11 | Upgrade saved books to adaptive page plans |
| `beb94a7` | 2026-08-11 | Add source-aware adaptation page planning |
| `e5193a9` | 2026-08-11 | Remove maximum page limits |
| `4809149` | 2026-08-11 | Make child writing modes rewrite chapter summaries |
| `62f652f` | 2026-08-11 | Make adaptation workflow children-first for ages 7-15 |
| `eb928ba` | 2026-08-11 | Ensure every chapter has a unique visual |
| `d088e5a` | 2026-08-11 | Generate one contextual visual for every chapter |
| `7485f33` | 2026-08-11 | Preserve original chapters and ask summary length in pages |
| `41882ce` | 2026-08-11 | Add contextual illustrations to every chapter |
| `7a4e737` | 2026-08-11 | Assign illustrations after chapter hierarchy repair |
| `5c8a1d1` | 2026-08-11 | Add contextual chapter illustrations to book preview |
| `9da7c9e` | 2026-08-10 | Fix source chapter hierarchy detection |
| `aa3eaed` | 2026-08-10 | Remove duplicate print page breaks |
| `4a7149b` | 2026-08-10 | Fix duplicate chapter content and print pagination |
| `04ad05a` | 2026-08-10 | Build substantial source-grounded chapter manuscripts |
| `693087c` | 2026-08-10 | Complete the end-to-end book studio workflow |
| `a0a8ba5` | 2026-08-10 | Add book brief and draft generation workflow |
| `2f8d3c8` | 2026-08-10 | Add real source analysis and durable projects |
| `3cd36bf` | 2026-08-10 | Build complete IKS Book Studio experience |
