# Book structure implementation — three phases

The shared page model is the authority for Designer, Preview and PDF. New completed books receive a measured first layout; saved in-flow image overflow is repaired on opening, while protected manual compositions require explicit adjustment. Publication export reports objective structural checks without blocking a requested download. Draft export remains available for review.

## Phase 1 — preserve content and export geometry

- Capture every computed style synchronously before fetching PDF assets. Freeze the entire publication DOM for the duration of export so progress updates cannot detach footers or captions.
- Compare ordered reader text, image sources and alternative text before committing reflow. The comparison excludes only explicitly repeated table headers. A failed comparison leaves the saved book untouched.
- Validate the actual rendered pages at publication export: printable boundaries, footer collisions, broken images, stranded headings and private production text. Report pending editorial approval and layout review; verify PDF page count.

## Phase 2 — measured pagination

- Start from continuous section content, preserving tables, inline formatting, footnotes and figures instead of using the old character splitter as the final layout. Recursively paginate ordinary nested flow containers, and accept short approved sections during initial layout.
- Load fonts and images, reserve intrinsic image dimensions, and measure against the same styled page used in Designer and Preview. Explicit dimensions also address Firefox's delayed cached-image layout.
- Preserve every imported illustration occurrence by slot identity, including reused files with different captions. Retain opening/middle/reflection and explicit anchor metadata. Place imported figures between paragraphs. Keep captions inside their figure, carry a heading with its paragraph when moving nearby artwork, split paragraphs and ordered lists without losing formatting or numbering, and split tables by rows with repeated headers.
- Reconsider sparse adjacent pages and short final pages using measured occupancy. Paginate generated contents pages by their actual height too.
- Preserve locked, intentionally blank, freely positioned and Canva-designed sections during reflow. Oversized indivisible content stays intact and is reported for manual adjustment.

## Phase 3 — import and publication workflow

- Retain the chosen book title and design settings on manuscript import. Preserve introduction, conclusion, glossary and appendix roles in generated page headers and contents numbering.
- Attach Part labels before chapter boundaries to the following chapter instead of the preceding section.
- Show saved image counts separately from staged files, clear staged uploads after success, and report upload failures accurately. Later image ZIPs update saved Designer artwork as well as manuscript image metadata, preserving an existing image frame.
- Make typography controls apply to the actual body text and make No border suppress theme page borders.
- Use the same rendered structural inspection in Designer, Preview and export, including private production text. Link preflight findings to individual Preview pages. Structural errors, sparse-page and image-resolution findings remain visible for review; they do not disable download.

## Verification

- 186 existing/unit tests and 27 browser tests per engine pass, including import boundaries and publication readiness. The full source-selection → manuscript ZIP → image ZIP → publication PDF UI regression passes in Chromium and Firefox; see BOOK-STRUCTURE-RECHECK.md for its scope.
- Browser regression suite covers raster export, DOM/content preservation, table/list splitting, heading-plus-image movement, four trim sizes, saved-page reloads, and Designer/Preview position equality. It runs in Chromium and Firefox.
- A local integration fixture uses all 27 sections of the user's Sanatana Dharma manuscript and 26 placements of a representative supplied illustration. It has no blocking layout errors at 7×10 and 6×9 after the final fixes; spacing warnings remain visible on four pages in each run. Earlier A4 and A5 illustrated runs also had no blocking errors. This is structural test coverage, not a new saved user book or a claim to have reviewed all artwork.
- A five-page PDF proof exported successfully in Firefox. Its illustrated page was rendered and visually inspected: artwork, caption, following prose and bottom footer are correctly placed.
- A saved free image moved 5 px left retained matching Designer and Preview geometry across all 31 pages of the edit fixture.
- Production build and Worker artifact validation passed. Standalone TypeScript checking retains the repository's 38 pre-existing errors; no new errors were introduced.

Run unit tests with `node --test tests/*.test.mjs`. Run browser tests with Playwright available using `IKS_APP_URL=http://localhost:5175 node --test tests/browser/*.test.mjs`; set `IKS_BROWSER=firefox` for Firefox. `IKS_PLAYWRIGHT_MODULE` can point to a bundled Playwright installation. The app workflow test explicitly skips when no local app URL is supplied.

## Practical limits

These checks do not guarantee aesthetic perfection for arbitrary source material. A merged table cell larger than a page, a deliberately positioned composition, a missing font, or unsuitable artwork can require editorial intervention. Existing completed books are checked for overflowing in-flow illustrations on opening; eligible affected chapters are repaired automatically. Locked, blank and freely positioned compositions remain protected. Use Designer → More → Balance layout for other eligible layout changes, then review Preview's page checks.

## Download policy update — 7 September 2026

At the publisher’s request, Download publication PDF exports the current preview even when approval, illustrations or layout review are incomplete. The PDF retains publication rendering quality without a draft watermark, uses a neutral publication filename, and identifies incomplete editorial review in its metadata. Missing renderable pages and actual rendering errors still produce errors. The PDF engine is imported with the app instead of fetched only when downloading, avoiding the missing lazy-module URL reported on the Workers deployment. Existing open tabs must load the updated app after their edits are saved.
