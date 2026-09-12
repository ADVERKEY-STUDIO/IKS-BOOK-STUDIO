# Phase B — Art-direction workspace

Completed: 12 September 2026

## Delivered

- Art direction is a workspace inside each devotional edition, alongside setup, source review, and the reading proof.
- Three composition studies use the project’s actual passages: open reading, separated reading zones, and a framed reading area.
- Suggestions respond to audience, language, passage length, supplementary content, simple manuscript imagery cues, and saved book references. Imagery cues are explicitly subject to editorial interpretation.
- A passage selector lets users compare the same source text across proposals. Compact studies label shortened excerpts; the editable guide has a full-passage sample.
- Editable guide rules cover reading purpose, tone, illustration medium, texture, line treatment, detail, spacing, ornaments, page furniture, environments, cultural details, and avoidances.
- Editable paper, ink, accent, and supporting colors; separate original, transliteration, translation, commentary, and caption typography.
- Independent reference choices and notes, with navigation to the existing real-book gallery.
- Each save creates a numbered draft guide version with a revision note. Approval applies only to the latest saved version and requires approved original passages.
- Historical guide versions remain available and can be used as a new draft.
- Manuscript changes flag the guide for review. A compact context fingerprint avoids duplicating the manuscript in every guide version.
- Server-validated guide commands use the existing optimistic edition revision checks. Ordinary project saves cannot overwrite approved guide data.
- Production-brief download and copy include the approved guide version and manuscript context. Draft or stale guides are blocked on the server.
- External manuscript and illustration prompt builders carry the approved guide when an edition is provided. Devotional requests avoid the children-only prompt path.
- Current approved typography and palette reach the reading proof and HTML/print export, with a frame when selected.
- A helper identifies registered output targets made with older guide versions or needing review after source changes.

## Validation

- 222 automated tests pass.
- Phase B API integration passes: save, approval, persistence, protected-save rejection, previous-version retention, source preservation, and stale-guide production blocking.
- Phase A API integration continues to pass.
- Browser verification covers selection, editing, version save and approval, brief download, proof colors/type size, and reopening the saved edition.
- The original Devanagari text remains identical in the rendered proof after applying guide styling.
- Desktop comparison and 390px mobile layout were inspected; mobile has no horizontal overflow.
- Production build and artifact validation pass.
- TypeScript continues to report the same 34 existing diagnostics; no diagnostics occur in the new art-direction modules.

Local verification commands:

```sh
node --test tests/*.test.mjs
python3 scripts/verify-art-direction-api.py
python3 scripts/verify-edition-api.py
```

The API checks require the local preview on port 5173. They use isolated verification owners and delete their test projects.

## Scope and boundaries

Proposals are rule-based editorial composition studies, not AI-generated finished illustrations. No model credentials or paid generation service are introduced in this phase.

The live sample demonstrates typography and composition. The existing text proof adopts approved type, color, and optional frame; it does not become the later facing-page compositor. The separated-zone proposal remains a design study until that compositor is implemented.

Production briefs and prompt builders provide the versioned handoff. Actual asset and spread producers will register their guide-version usage when those later phases are built. No claim is made that existing artwork has been regenerated.

## Next phase — awaiting user approval

Phase C: recurring character and visual references, with approved versions, identity notes, and continuity comparisons. Finished-art generation remains in its planned production phase.
