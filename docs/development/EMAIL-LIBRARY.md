# Clerk accounts and shared books

Clerk now owns sign-in, sign-up, email verification, Google sign-in when enabled in the Clerk instance, session renewal, and sign-out. The old custom email-code endpoints return 410; Resend is no longer required. No paid Clerk plan is enabled by this integration.

## Linked application and configuration

Application: `app_3JJcLxlw2SrFADAPKe22enxvmLK`.

The Clerk CLI linked the project and populated ignored local configuration. Use `clerk env pull --app app_3JJcLxlw2SrFADAPKe22enxvmLK` for Next.js build configuration and `clerk env pull --app app_3JJcLxlw2SrFADAPKe22enxvmLK --file .dev.vars` for the local Cloudflare worker. Do not print or commit either file.

Required deployment configuration:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the build environment and Worker bindings.
- `CLERK_SECRET_KEY` as a Worker secret only, never a public build define.
- Existing D1 `DB` and R2 `BUCKET` bindings.

Configure the Clerk production instance and domain before live rollout. Development keys are not a completed production setup. Run `clerk doctor` and `clerk deploy status` to review the linked instance.

## Runtime integration

The provider sits inside `<body>`. `proxy.ts` includes the API matcher and `/__clerk/:path*`. UI routes use Clerk middleware; the custom Worker API routes execute before the Next.js handler, so they independently verify session tokens using `@clerk/backend.authenticateRequest()` and a same-origin authorized-party check. Only a verified primary email can link a library. Client-supplied account IDs or emails cannot authorize storage access.

Clerk user IDs map to the original storage identity, preserving saved books if an account changes its email address. The first explicit library link connects the browser's pre-existing main-studio library identity. Sign in first from the browser with the original books. Independently created pre-login browser libraries are not automatically combined.

The Vite config excludes `@clerk/nextjs` from dependency prebundling to retain React Server Component boundaries. It selects Clerk's own browser-safe `#safe-node-apis` implementation because workerd cannot run the SDK's Node filesystem require shim. `nodejs_compat_populate_process_env` exposes Worker secrets to server-only SDK code. A narrowly scoped Vite transform also converts the SDK navigation hook’s optional Next.js require calls into a static ESM import. Revalidate these compatibility adaptations on Clerk upgrades.

## Saving

Template books retain their IndexedDB copies. **Save book to account** uploads all artwork and the source file before committing a revision-checked manifest. Open a cloud book after signing into the same Clerk account in another browser. Existing local template books must be saved to the account individually. A stale save is rejected; opening a cloud copy preserves a local backup.

Artwork remains at full quality with 25 MB per file and 512 MB per book limits. Source files are limited to 20 MB. Account-scoped content hashes identify the stored bytes.

## Validation

`node --test tests/clerk-identity.test.mjs tests/library.test.mjs tests/template-book.test.mjs tests/template-capacity.test.mjs`

Library tests exercise the actual API and browser serialization helpers with SQLite and an in-memory object bucket. The Clerk verifier is injected in these tests; no real mail or Clerk user is created. Tests cover independent sessions, manuscript/source/artwork restoration, account isolation, retired login routes, stable identity after an email change, and stale-save rejection. A real browser sign-in is also needed to validate the SDK and instance configuration.

The identity test additionally uses the real Clerk SDK with locally signed RSA tokens and stubbed Clerk API responses to verify signature rejection, authorized-party enforcement, and verified-email requirements. Local browser testing confirmed Google sign-in, the profile menu, account linking, and a successful cloud save.
