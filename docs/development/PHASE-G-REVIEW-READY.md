# Phase G — Three review studies ready

12 September 2026. Status: review milestone, not completed Phase G acceptance.

## Available

Open `/pilot` on the local website, or use the pilot link beneath the home inspiration shelf. Three selected Bhagavad Gita verses are composed with the same physical renderer used by Designer. The public review specimen is separate from saved projects. The ‘Create editable draft’ action saves an owner-scoped library copy through the existing APIs, preserving all source and artwork as drafts. A copy was created and verified in the local browser session.

1. **2.47 — The work before you:** quiet verse page facing a complete Nepalese Bhagavata Purana painting.
2. **6.19 — A steady attention:** intimate lamp-object study, with original text and draft meaning opposite.
3. **11.12 — Beyond familiar forms:** comparative historic Navagunjara artwork, explicitly distinguished from a literal image of the Gita verse.

The chosen source is IIT Kanpur Gita Supersite's displayed Sanskrit, not an asserted printed critical edition. Source strings, sandhi, punctuation, and verse numerals remain bound separately from the newly drafted English meanings. Full citations and cultural caveats are in `docs/research/phase-g-gita-sources.md`.

Museum images retain complete frames. Object credits, public-domain status, and local SHA-256 checksums accompany the assets in `public/pilot/gita/credits.json`. No paid generation was used. Mixed historic artists are not represented as a continuous character-design system.

## Implementation and validation

- Dedicated review page, responsive spread selection, composition rationale, source/rights links, and self-contained HTML review downloads.
- Shared `compositionMarkup` / `compositionDocument` implementation; no second layout renderer.
- Three data-bound specimens at 180 × 230 mm page trim, 3 mm bleed. Combined spread: 366 × 236 mm.
- All 255 unit tests pass. Pilot tests verify exact source bindings, draft state, safe text geometry, gutter avoidance, physical proof size, and review labels.
- Browser inspection confirmed all three images load and no text overflow. At the observed 601 px viewport there was no page-level horizontal overflow.
- Image placement preserves at least 300 dpi: the smallest asset is 1200 × 973 px, contained in a 95 × 80 mm box. Larger paintings are 4000 × 2762 and 3937 × 2540 px in 144 × 132 mm boxes.
- Production build passes; TypeScript retains 34 existing diagnostics, with none from pilot files.

## Still required for Phase G completion

- User acceptance or revision of this heritage-art direction, including whether commissioned illustrations are preferred instead.
- Final editorial/cultural review of the Sanskrit witness, short English meanings, and comparative image associations.
- Review the saved library draft, establish its art guide, and approve source/artwork through the ordinary workflow once the user accepts the direction. Museum assets are registered as visual references; they are not falsely recorded as approved production results.
- Native image-rich PDF export and actual-size PDF inspection. The current verified deliverable is HTML review proof; no PDF print-verification claim is made.

The user subsequently instructed starting the next phase. Phase H workspace implementation is authorized; the outstanding pilot checks above remain pending. Do not label this an approved edition. No Cloudflare deployment was performed.
