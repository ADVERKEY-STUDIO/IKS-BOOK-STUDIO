# Email sign-in and shared books

The template studio keeps its IndexedDB copies and adds an explicit **Save book to account** action. A cloud save uploads all images and the source file before committing the book manifest. Open a cloud book on another browser after signing in with the same email. Conflicts reject stale saves; opening the cloud copy preserves an existing local copy as a separate backup.

The main studio uses the verified email session to select a stable library identity. First sign-in links the current browser's existing library identity; sign in first from the browser containing your original books. Browser libraries created independently before this feature are not automatically combined. Template books must be opened and saved to the account individually.

## Hosting setup

D1 (`DB`) and R2 (`BUCKET`) are existing bindings. New library tables initialize on the first account/library request. Configure these Worker secrets before email sign-in can work:

- `RESEND_API_KEY`: a Resend sending key.
- `AUTH_EMAIL_FROM`: an address on a verified sending domain, such as `Book Studio <books@example.com>`.

A Gmail address can receive sign-in codes but is not a verified sending domain for this integration. Do not put real secrets in `.dev.vars.example` or source control. For local development, configure ignored `.dev.vars` using the same names.

The implementation calls the [Resend email API](https://resend.com/docs/api-reference/emails/send-email). Without configuration, the UI states that email sign-in is awaiting setup; it never claims a message was sent. Codes expire in ten minutes, can be used once, allow five attempts, and are stored as hashes. Requests are limited by email and IP. Sessions are hashed in D1 and issued as HttpOnly, SameSite=Strict cookies, with Secure on HTTPS. They expire after 30 days and sign-out revokes the session.

Cloud access requires a verified session. Asset keys are content hashes scoped to the account, and a stale revision cannot overwrite a newer manifest. Uploads remain at full quality, bounded to 25 MB each and 512 MB of artwork per book. Source files are limited to 20 MB.

## Verification

`node --test tests/library.test.mjs tests/template-book.test.mjs tests/template-capacity.test.mjs`

The account tests run the actual API with SQLite and an in-memory object bucket, capturing email in-process without sending mail. They cover independent sessions for the same email, artwork bytes, account isolation, one-use codes, logout, stale-save rejection, and missing email configuration. Live email delivery still requires the configured sender and a deployment smoke test.
