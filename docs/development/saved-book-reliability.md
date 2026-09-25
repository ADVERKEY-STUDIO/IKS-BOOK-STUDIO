# Saved book reliability

## Reproduced failures

An account save failure previously prevented the local fallback from running.
A subsequent save with an incomplete image manifest could replace an existing
cloud book's artwork references, even though the image objects still existed.
Browser autosave previously meant IndexedDB only, including while signed in.
These are verified failure paths, not proof of the cause of any particular
historical loss. No production data was inspected or modified during diagnosis.

## Save contract

- Local and account saves are attempted independently. An offline account must not
  prevent a local copy; full browser storage must not prevent an account copy.
- Signed-in edits receive a debounced account backup. Manual and automatic saves
  share a queue and only advance their revision after acknowledgement. Changes made
  during an upload remain pending for the next backup.
- Queued requests identify the expected account; a changed sign-in cannot route
  an in-flight book save into another account. Automatic backup skips books linked
  to another account. Manual saving remains an explicit user action.
- IndexedDB writes are transactional and reject older snapshots or removal of
  still-used image entries or the manuscript. Cloud writes keep revision checks
  and reject removal of still-used saved image references or the manuscript.
- Account restores check SHA-256 for every downloaded asset. Failed or truncated
  downloads are never committed as a successful restored book.
- Opening a local book repairs absent/unreadable images from its matching account
  book without replacing local words or readable artwork edits. If browser storage
  was cleared entirely, a bookmarked book can reopen from the signed-in library.
- Request persistent browser storage when available, but do not assume the browser
  grants it. Display account backup status separately from browser-save status.
- Back up all browser books explicitly protects older local drafts. Books linked
  to another account are skipped; errors remain visible per book. It does not
  delete local books or overwrite conflicting cloud revisions.

## Verification

Unit/API tests cover offline fallback, full browser storage, serialized uploads,
account switching, missing manifests, revision conflicts, byte-preserving restores,
image recovery and integrity failures.

Run the local Vite app on port 5187, then:

```
node --experimental-strip-types scripts/verify-book-persistence.mjs
node --experimental-strip-types scripts/verify-account-backup.mjs
```

Set PLAYWRIGHT_MODULE when Playwright comes from an external runtime. These scripts
use isolated browser contexts. The account integration script stubs sign-in and
uses an in-memory API, never a real account. It covers automatic and bulk backup,
browser eviction, missing local images, and an account outage after editing.

## Recovery limits

No code can reconstruct images that are absent from both browser and account
storage. The original editable ZIP or another intact copy is required. Browser
persistence is a best-effort request and does not survive deliberate clearing.
Account availability, quota and bucket retention policies are external to these
checks. A successful backup means the server accepted the manifest after checking
its objects, not a guarantee against every future infrastructure failure.
