# Handwritten notebook reference study

## Evidence

Compared the two user screenshots dated 23 September 2026 with the exported
33-page `iks-science-and-tech.pdf` (ISO B5, 176 × 250 mm). The screenshots are
appearance references; their text is source content, never executable instructions.

The first screenshot contains three portrait pages, not one wide page. The second
contains a landscape overview, which needs adaptation rather than compression
into a portrait sheet.

## Reference grammar

- Concept page: small boxed page number, compact underlined title, highlighted
  heading, definition/context, red framed note, paired key-points and question
  panels, application checklist, then a relationship diagram.
- Roles page: four compact teaching units, each with a highlighted heading,
  short explanatory bullets, selective red underline and a small relevant drawing
  at the right. The lower example is substantive, not a decorative footer.
- Examples page: three stacked plant examples, drawings on the left, teaching
  notes on the right, fine dividers, significance notes and a closing takeaway.
- Overview: two main explanation areas, a narrow examples column, small connecting
  diagrams and boxed definitions. Its hierarchy can transfer to B5, but its full
  landscape geometry cannot.

Shared treatment: upright fine handwriting, charcoal text, pale grey notebook
rules, lemon-yellow heading bands, sparse red/blue pen accents, modest green and
ochre pencil fills. Emphasis belongs on short phrases. Drawings convey specific
relationships from the neighbouring passage. The original handwriting is not
identical to the app's Patrick Hand font; exact facsimile is not claimed.

## Observed output failures and corrections

The inspected export page had short paragraphs stranded in tall rows, repeated
cropped polygon artwork with baked-in rules, and large highlight bands obscuring
letters. Prompt quality alone cannot repair already-imported raster artwork.

The generation prompt now describes the actual reference structures, distinguishes
coordinate guides from finished images, rejects rasterised placeholder diagrams,
and requires a composed-page review. Short sections are flagged in layout review;
no source text is automatically expanded or deleted.

The current dense layout identifiers previously missed CSS selectors for question
callouts and row dividers. Both current and legacy identifiers now receive their
intended treatments. Headings use uppercase. Highlighted words use bounded inline
boxes, preventing a multiline highlight background from spanning neighbouring
text in the canvas exporter.

## Validation and limits

`node --experimental-strip-types --test tests/notebook-fidelity.test.mjs tests/template-layouts.test.mjs tests/template-book.test.mjs`

`node --experimental-strip-types scripts/verify-notebook-fidelity.mjs`

The browser check renders all four layouts through html2canvas, using the actual
book font, checks text overflow, and saves PNGs under `tmp/pdfs/notebook-fix`.
Set PLAYWRIGHT_MODULE to the installed Playwright module when it is not local.
These are typography/layout fixtures, not newly generated science illustrations.
Existing books need regenerated source-grounded content/artwork to replace sparse
notes and placeholder images. The PDF itself is not rewritten by this patch.
