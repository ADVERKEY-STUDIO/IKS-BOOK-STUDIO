# IKS Book Studio — Local Setup

This bundle contains the source code for the deployed **IKS Book Studio**, exported from Sites version 84 on 21 August 2026.

## What is included

- The complete Next.js/Vinext application
- Whole-book Designer Studio
- Source upload and parsing workflows
- External-AI manuscript import
- Nemotron/OpenRouter generation and review workflow
- Preview, DOCX and PDF export code
- Local D1 database and R2 upload bindings
- Automated tests and database migrations

Generated build folders, dependency caches, Git history and secret values are intentionally excluded.

## Requirements

- macOS, Linux or Windows with WSL
- Node.js 22.13 or newer
- npm

Check your versions:

```bash
node --version
npm --version
```

## Start on your Mac

1. Extract the ZIP.
2. Open Terminal in the extracted `IKS-Book-Studio-Local-v84` folder.
3. Install dependencies:

```bash
npm install
```

4. Create your local secret file:

```bash
cp .dev.vars.example .dev.vars
```

5. Open `.dev.vars` and replace `paste_your_openrouter_key_here` with your own OpenRouter key.
6. Start the website:

```bash
npm run dev
```

Open the local address printed in Terminal.

## Local AI configuration

The application reads these server-side variables:

```env
OPENROUTER_API_KEY=your_private_key
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

Never paste the real key into source files or commit `.dev.vars` to Git.

## Local books and uploads

The development server creates local Cloudflare-compatible D1 and R2 storage. Books and uploads created locally are separate from the data stored by the deployed website.

This source ZIP does **not** contain:

- Your OpenRouter key
- Uploaded source PDFs stored in the hosted bucket
- Hosted database records and saved books
- Deployment credentials

Export important books from the live website before replacing or deleting anything there.

## Use with Codex CLI

From the project folder:

```bash
codex
```

Tell Codex to inspect `LOCAL_SETUP.md` and the current project before editing. The included `.openai/hosting.json` identifies the existing Sites project, so explicitly say **local-only** when you do not want a deployment.

Example:

```text
Inspect this existing IKS Book Studio project. Work locally only, preserve its architecture and do not deploy until I approve.
```

## Use with Claude Code

From the project folder:

```bash
claude
```

Example instruction:

```text
Read LOCAL_SETUP.md, package.json, app/page.tsx, app/globals.css and worker/index.ts before making changes. Preserve the current book data model and test the affected workflow.
```

## Production build on macOS

The hosted Sites build helpers use Linux-only commands. On macOS, run Vinext directly:

```bash
npx vinext build
```

Then start the built application with:

```bash
npx vinext start
```

The normal `npm run build` command is retained because the hosted Sites deployment uses it.

## Important files

- `app/page.tsx` — main application and interface
- `app/globals.css` — website and book styling
- `worker/index.ts` — API, storage, OpenRouter and export engine
- `lib/` — book planning, manuscript, pedagogy and validation logic
- `tests/` — automated workflow checks
- `drizzle/` — database migrations
- `.openai/hosting.json` — existing Sites project and binding names; it contains no API key

## Recommended first Git backup

```bash
git init
git add .
git commit -m "Import IKS Book Studio version 84"
```

Confirm that `.dev.vars` is not staged before committing.
