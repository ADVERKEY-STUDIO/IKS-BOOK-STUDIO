# Phase H — Full-book production workspace

Implemented 12 September 2026. This completes the Phase H workspace implementation, not approval of a finished publication.

## Delivered

- A **Full book** workspace inside each devotional edition.
- Named batches of 1–50 active plans. Duplicate membership across active batches is rejected; batches can be archived and restored without changing artwork or approvals.
- Derived Draft / Awaiting review / Approved / Stale states for each spread, plus batch and book progress counts.
- Append-only review events with a note and a snapshot of the reviewed dependencies. Source, composition, guide, pagination, or relevant asset changes invalidate the affected review. Rework returns the selected spread to draft without deleting artwork or changing unrelated approvals.
- Production approval requires current source/plan/guide and asset readiness, plus explicit reviewer confirmations for meaning, artwork/cultural continuity, and actual-size text fit. It is not final print certification.
- Whole-book contact sheet using the existing physical compositor. Thumbnails load artwork when nearby; status and batch filters, pagination labels, text counts, and direct links to the selected Designer spread support targeted revisions.
- Explicit title page, credits, introduction, contents, glossary, notes, colophon, and front/back cover concept creation. Users provide actual text; no filler is generated. Sections start as drafts, preserve scripture, and inherit the latest art-guide palette when available.
- Printer cover requirements store supplied flat dimensions, spine, bleed, binding notes, and the printer/template reference. No spine estimate is invented. Front/back concepts remain separate; printer-ready cover-wrap export belongs to release packaging.

## Validation

- 262 unit tests pass, including seven production tests covering batch conflicts, targeted rework, stale approvals, explicit checks, section/source preservation, invalid printer dimensions, unapproved reference assets, and preservation of exact-asset approval after an alternate import.
- Local API integration passes for batch/review persistence, section and printer-record creation, source preservation, stale project revision rejection, and protected-save rejection.
- Browser: the Gita pilot appears in Full book, all three contact-sheet images load, a three-spread batch saves, and the Designer link selects the requested spread.
- A title page was added to the local pilot using its actual title and edition description. Saved layout opens in Designer with no geometry or measured text-overflow issues.
- The first pilot spread was submitted for review with an explicit note about pending meaning/artwork review and native PDF verification. No approval was fabricated. Structural changes can subsequently make that review stale.
- No page-level horizontal overflow at the observed 812 px viewport. Review controls were adjusted to keep checkboxes beside their labels.
- Production build and artifact validation pass. TypeScript retains 34 pre-existing diagnostics; no new Phase H diagnostics were found.

## Boundaries and remaining publication work

This is a production-management workspace, not a billable generation queue. Paid generation remains disabled per the user's instruction. Actual artwork production continues through imports/manual revisions.

The user explicitly instructed starting the next phase after the Phase G review milestone. This authorizes Phase H implementation; it does not establish editorial/cultural sign-off or native image-rich PDF verification. Those pilot checks remain pending.

The local Gita pilot is still a three-verse selection, not a completed full Bhagavad Gita edition. Its art guide, source/artwork reviews, complete book coherence, and final print proof still require review. Progress counters do not certify artistic quality.

No Cloudflare deployment is included. Push the implementation to the development branch, then ask before Phase I.
