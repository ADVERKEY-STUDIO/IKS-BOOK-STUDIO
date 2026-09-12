# Phase J — export and restore workspace

Implemented 12 September 2026. The export/restore workspace is implemented; publication approval and Cloudflare production deployment are separate, still outstanding steps.

## Delivered

- Whole-book interior proofs use the existing physical composition renderer. Facing spreads are clipped into individual pages, in storyboard order, including intentional parity blanks. Covers remain separate.
- Print output includes configured bleed. Digital output removes bleed. Interior dimensions must be consistent; unsupported mixed formats fail explicitly.
- Working proofs require current browser render checks and no unresolved scoped manual blockers. They may contain draft editorial content. Final release additionally requires all current release checks, human reviews, and production approvals.
- Export retrieves one owner-scoped saved revision from the server. A revision mismatch returns 409. Font bytes are checked against the reviewed SHA-256 before producing self-contained HTML and opening the browser PDF print dialog.
- Backup ZIPs contain edition metadata, original text/history, compositions, guide/reference/artwork history, and all registered source/reference/artwork files, including saved request references. No project-level inspiration preview files are included.
- Restore verifies the exact archive against an owner-scoped receipt before decompression, verifies asset checksums, remaps asset keys, and inserts a new project. It never overwrites the source project. Current review and production evidence becomes stale; historical notes remain.
- Existing adaptation exports, selected-spread Designer proofs and text-only Reading proof remain available.

## Verification

- Automated suite: 279 tests pass, including page parity, print/digital geometry, mixed-format rejection, asset selection, review invalidation, and protection against rewriting text during key remapping.
- `python3 scripts/verify-book-release-api.py`: passes revision mismatch, source byte restoration/download, tamper rejection, foreign-owner rejection, original-project isolation, stale evidence and final-release blocking.
- TypeScript retains the pre-existing 34 diagnostics; no additional diagnostics from this work.
- Native Zen Save to PDF, saved pilot revision 26: print 7 pages at 186 × 236 mm; digital 7 pages at 180 × 230 mm. Physical dimensions checked with Poppler/pypdf. Fonts embedded; text remains selectable. All pages rendered and inspected, with a representative verse page also inspected at 72 dpi. No clipping, missing artwork or unintended blank pages in these files.
- Pilot source/meaning/iconography approvals were not invented. Its final release remains blocked by 19 requirements. Inspection of a PDF is not physical printer proof approval.

Local review artifacts, deliberately excluded from the Git commit:

- `output/pdf/phase-j/print-working-proof.pdf`
- `output/pdf/phase-j/digital-working-proof.pdf`

## Limits and follow-up

PDF creation currently uses the browser print dialog; it is not an unattended server PDF job. Zen’s Save to PDF was verified at 100% scale, backgrounds on, headers/footers off, and CSS page margins. Safari inserted extra blank pages for custom paper in testing. Do not use that Safari output for release; open the self-contained HTML in the verified browser and check page count. Browser-specific pagination hacks that clipped or resized page artwork were discarded.

The native PDFs are approximately 42 MB each. Optimized digital compression, PDF/X certification, CMYK conversion, trim-box metadata and printer wrap/spine generation are not supplied by this workspace. Bleed is represented in the physical page canvas. Confirm printer acceptance independently.

Backups support up to 40 MB of registered assets and 2 MB of edition metadata, with a 42 MB archive ceiling. They restore only on the issuing installation and original browser owner identity. R2 `edition-backup-receipts/` authenticates archives; retain this namespace in infrastructure backups. A ZIP alone is not a cross-installation/disaster-recovery migration. A future portable format needs an explicit trust/import-validation design. Failed restores clean up newly written assets; server receipts and test upload assets follow existing retention behavior.

No paid generation, database schema migration, production data replacement, or Cloudflare deployment occurred.

## Website release and rollback

1. Merge the reviewed branch through the existing GitHub workflow. Record the commit and deployed Worker version; pushing a branch is not deployment.
2. Deploy the built artifact to an isolated staging environment with its own D1 and R2 bindings. Do not point destructive test cleanup at production. Run regression scripts there only after adapting their explicit local base URL.
3. Smoke-test an existing adaptation, an existing devotional edition, owner isolation, revision conflicts, working PDF, blocked final release, and backup/restore as a new book. Verify `/fonts/book-sanskrit.ttf` identity and print assets on the deployed origin.
4. Preserve the current production Worker version and D1/R2 backups before promotion. No J schema changes are required. Retain new restored-project records and backup receipts on rollback.
5. If production smoke checks fail, roll back the Worker artifact to the recorded version; do not roll back or delete user data as part of application rollback. Recheck existing library read/save and asset access.

Staging deployment, staging smoke review and production promotion are pending. The current environment’s hosting configuration and actual Cloudflare deployment target must be reconciled before promotion.
