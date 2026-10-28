# Hanuman Chalisa Picture Book — System Improvement Proposal

Date: 11 September 2026

Status: Proposed improvements, not completed implementation.

## Goal

Create a Hanuman Chalisa book with the expressive, hand-painted picture-book quality shown in the supplied reference: textured paint, confident ink outlines, soft background washes, consistent characters, and readable text placed in quiet areas of the illustration.

The central change is to compose illustrated spreads rather than simply add pictures to chapters. A spread is two facing pages designed together. Artwork and typography should form one composition.

## Existing foundations

IKS Book Studio already has illustration imports, editable image placement, source-verse preservation, page measurement, and print checks. These provide a useful foundation for the proposed workflow.

The current layout engine primarily flows paragraphs and figures across pages. Keep that capability for text-heavy books and add a dedicated spread compositor for picture books.

### Correction to the original discussion

The earlier response incorrectly described `/api/visual` as disabled. Inspection of `worker/index.ts` shows that the route is active and returns procedural SVG scene plans. Those scene plans do not provide the finished painted artwork required for this proposal. The existing external-art import workflow is a useful starting point.

## Recommended system changes

| System area | Change needed |
| --- | --- |
| Book type | Add an **Illustrated Devotional Picture Book** mode with verse-based spreads, rather than forcing the content into educational chapters. |
| Art direction | Save a book-wide visual guide covering paint texture, outline style, palette, character proportions, clothing, ornaments, environments, and example images. |
| Character consistency | Create an approved Hanuman reference sheet with multiple poses and expressions. Reuse those references throughout illustration production. |
| Spread planning | Plan each spread's verse, meaning, scene, composition, and text area before generating artwork. |
| Illustration production | Support finished painted assets, reference-guided generation, revisions, and version history for each spread. |
| Page design | Add full-page artwork, facing-page compositions, soft-edged vignettes, and editable text over reserved quiet areas. |
| Quality review | Check character continuity, verse accuracy, text readability, cropping, gutter clearance, and print resolution. |

## Suggested creative direction

### Artwork

Use warm watercolor and gouache, expressive hand-drawn outlines, and visible paper texture. A suggested palette includes saffron, coral, leafy green, and soft sky blue.

Take inspiration from the reference's broad visual qualities while developing original characters, scenes, and compositions appropriate to the Hanuman Chalisa.

### Hanuman character design

Depict Hanuman as approachable, expressive, and dignified. Keep facial features, clothing, ornaments, proportions, and other identifying details consistent across the book.

Approve a character reference sheet before producing the complete illustration set. Include multiple poses and expressions so consistency can be assessed across both quiet and active scenes.

### Content

Use approved original Devanagari verses, short child-friendly meanings, and optional transliteration. Keep the original text separate from explanations.

Replace Sanskrit-specific assumptions in the verse interface with language-aware handling appropriate to this edition. Devanagari script alone does not identify the language of the source text.

### Composition

Start by exploring one or two chaupais per spread, then adjust for reading comfort. This is a design starting point, not a final page-count commitment.

Alternate expansive scenes with intimate character moments. Reserve calm areas for text during scene planning, rather than trying to find space after the artwork is complete.

### Typography

Typeset verses separately from the illustrations. This keeps text accurate, sharp, and editable, and allows corrections without regenerating artwork.

## Proposed production workflow

1. Confirm the intended reader, source text, companion text, and trim size.
2. Establish the book's art guide and approve the Hanuman reference sheet.
3. Map the verses to spreads and write a scene brief for each spread.
4. Specify illustration composition, text areas, and gutter clearance.
5. Produce artwork using the approved references and review its consistency.
6. Compose editable text and artwork in the spread designer.
7. Review source accuracy, readability, layout, and print resolution.
8. Export and visually inspect a print proof before completing the full book.

## Recommended first milestone

Create three finished sample spreads inside the system:

- A quiet devotional scene.
- An expressive close-up.
- A dramatic action scene.

These samples should test art consistency, verse treatment, text placement, and print layout before producing the whole book. Review both facing pages together and inspect the exported proof.

## Implementation priorities

The highest priorities are a reusable art guide, consistent character references, and spread-based composition. Changing the illustration-style dropdown alone will not achieve the reference quality.

Relevant existing implementation areas:

| File | Role in the proposed work |
| --- | --- |
| `app/page.tsx` | Book setup, workflow, and Designer integration |
| `app/globals.css` | Book-page and spread styling |
| `worker/index.ts` | Current procedural visual route and server-side workflow |
| `lib/book-persona.ts` | Existing visual identity definitions |
| `lib/book-illustrations.ts` | Illustration identity and placement |
| `lib/book-layout.ts` | Existing flow layout and structural inspection |
| `lib/book-format.ts` | Trim formats and image-resolution review |
| `lib/source-book-options.ts` | Source text and image preferences |
| `lib/source-book-review.ts` | Source review safeguards |

This proposal does not claim that the spread compositor, reference-guided artwork pipeline, or sample spreads have already been built.
