# Phase F — Artwork imports and revision review

Implemented 12 September 2026 on `codex/book-inspiration-gallery`.

## Scope

The user selected “Build imports first; no paid generation yet.” This completes the import and review portion of Phase F. It does not complete the deferred generation-service portion. No paid generation request was made.

## Delivered

- Saved production requests capture the approved art direction, selected passage text, spread plan, reference-image metadata, reserved text geometry, revision direction, and 300 dpi dimensions including bleed.
- A downloadable ZIP includes the saved brief, request manifest, and available reference files.
- Finished PNG, JPEG, and WebP artwork can be uploaded with a revision note, caption, creator credit, and provenance. Upload limits are 10 MB and 64 megapixels.
- Imports append versions without replacing approved artwork. Users can compare versions across spreads, approve a version, and restore an earlier approval while retaining all later versions and approval history.
- Changes to the source, direction, references, or reserved text geometry mark approved artwork for renewed review.
- Designer accepts production artwork and keeps the exact selected image. Unapproved or stale production artwork is reported in composition review and blocks proof export until resolved.
- Project ownership, server-side image validation, and revision concurrency checks protect uploads and downloads. Failed imports retain the request and form for retry.

## Verification

- All 252 unit tests pass, including six production tests for immutable requests, non-destructive imports/restoration, stale approvals, Designer validation, and invalid actions.
- Local API verification passed for request ZIPs, two imports, exact asset retrieval, ownership isolation, approval/restoration, persistence, and rejection of JSON upload bypasses. Existing phase API checks also passed.
- Browser verification used a separate “Phase F — artwork QA” project: imported an existing repository fixture twice, confirmed the first approval survived the second import, approved the second version, restored the first, and loaded both comparison images.
- Both imported versions appeared in Designer’s artwork selector. The temporary layout edit was discarded.
- The uploaded fixture was below the full-spread target; the UI correctly displayed its resolution warning. This fixture is technical test material, not approved devotional artwork.
- Production build passes. TypeScript retains the existing 34 baseline diagnostics; no new Phase F diagnostics were observed.

## Deferred

Provider integration, generation queues/statuses, cancellation, duplicate-billing protection, provider retries, usage estimates, and spending limits are not implemented. In-app generation is explicitly disabled. No Cloudflare production deployment is included in this branch push.

Phase G is the three-spread pilot using real approved passages and appropriate finished artwork. It requires the user’s go-ahead before work starts. Image-rich printed proof and artistic/cultural review belong to that pilot; technical tests do not establish visual excellence.
