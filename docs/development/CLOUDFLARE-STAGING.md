# Cloudflare staging verification

Status, 12 September 2026: local preparation complete; Cloudflare authentication pending. No staging resource or deployment has been created. Production has not been changed.

The generated build uses Worker name `iks-book-studio`, a configured D1 binding, and an R2 binding without a concrete bucket name. The repository also contains legacy Sites packaging metadata. Do not deploy that generated configuration directly to the user's `iksmain` production Worker.

## Prepared workflow

1. Authenticate Wrangler with the intended Cloudflare account. Inspect account identity and existing Workers/resources before provisioning. OAuth approval is performed by the account holder; no credentials should be pasted into this repository or chat.
2. Create or verify dedicated resources named `iks-book-studio-staging-db` (D1) and `iks-book-studio-staging-assets` (R2). Record their identifiers. Verify that neither is bound to production.
3. Build using the established build workflow and validate the artifact. Generate the isolated config:

   ```sh
   python3 scripts/prepare-cloudflare-staging.py --database-id ACTUAL_STAGING_DATABASE_UUID
   ```

   The script writes `.wrangler/staging/wrangler.json`, points to the compiled Worker/client assets, uses Worker name `iks-book-studio-staging`, clears variables/routes, and replaces D1/R2 bindings. It does not deploy. It rejects the build's database ID. Do not use a fabricated UUID to deploy.
4. Run Wrangler deploy against that explicit config only after verifying its resource bindings. Record the resulting staging origin and Worker version. No OpenRouter secret is needed for import/export/review tests; no paid generation is authorized.
5. Set `IKS_STAGING_URL` to the deployed `https://iks-book-studio-staging.<account>.workers.dev` origin and run:

   ```sh
   python3 scripts/verify-art-production-api.py
   python3 scripts/verify-book-production-api.py
   python3 scripts/verify-book-review-api.py
   python3 scripts/verify-book-release-api.py
   ```

   Each script defaults to local port 5173. The shared destination guard rejects production and arbitrary remote hosts. Fixtures use unique test owner identities and delete only their own project records. Uploaded fixture objects follow existing storage retention behavior.
6. Browser smoke-check the staged library, an adaptation draft, a devotional draft, artwork upload, review gate, PDF proof and backup restoration. Verify font checksum, images, dimensions and page count from the staged origin. Test a backup before describing staging as verified.
7. Prepare production promotion separately with the actual production bindings and record its current Worker version for rollback. Keep D1/R2 and backup receipts intact on application rollback.

## Local evidence

- `python3 scripts/test-staging-guards.py`: verifies local default, named staging acceptance, unsafe destination rejection, and isolated generated bindings.
- Export/restore API regression passes against localhost after destination-guard changes.
- Cloudflare CLI `whoami` reported unauthenticated. Remote verification must not be reported as passed until authentication and deployment succeed.
