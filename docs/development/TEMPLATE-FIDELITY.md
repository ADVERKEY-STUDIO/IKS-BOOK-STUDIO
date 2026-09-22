# Template fidelity and varied spread layouts

Implemented 22 September 2026. Template Studio now separates illustration direction from per-spread arrangement. New requests pin `templateRevision: 1`; each spread records a template-supported `blueprint` and a human-readable `layoutReason`. Existing unversioned books remain readable and are explicitly marked as legacy.

## Shared layout contract

`lib/template-layouts.ts` owns revision-one geometry, template dimensions, text distribution, planning, layout checks, and spread rendering. All 29 retained catalogue templates have explicit supported layout families. Beanstalk supports six arrangements, including two diagonal scenes, paired scenes and three journey moments. The planner scores passage cues, text-area capacity and neighbouring layouts; it is a deterministic suggestion, not semantic image analysis. The user reviews and can change every suggestion before rebuilding.

Every new spread is one full-spread raster composite containing its planned scenes, plus editable Unicode text. Multiple scene regions do not require multiple image filenames. Typography is placed by the app, not generated inside the painting. Text distribution preserves every source character and whitespace, preferring line boundaries. It does not verify scripture accuracy against an original PDF.

Editor, reading preview, gallery layout samples and portable HTML share the renderer. PDF uses the same dimensions and resolves container-relative font sizes before canvas capture. Beanstalk is 420 × 210 mm. Other supported spreads remain 420 × 250 mm; the six literary portrait covers retain their 210 × 250 mm export dimensions. These are app template dimensions, not claims about the physical editions used as references.

Revision-one layout geometry must remain immutable; future geometry changes need another revision and an explicit migration. Reference art is directional: style similarity remains a visual review, not a pixel-identity guarantee.

## Workflow

1. Choose a template. “Look inside” offers the original reference and app-rendered Hindi/English layout samples. Samples clearly distinguish diagram art from finished illustrations.
2. Download the request ZIP. It includes actual reference images, a JSON specification, SVG arrangement guides, and explicit instructions to send only one selected blueprint to each image-generation call.
3. Import the generated manifest and artwork. Versioned manifests require supported blueprints; raster aspect ratios are checked. Missing artwork is recoverable.
4. Review the book as a contact sheet and inspect each spread. Text overflow checks run after fonts load. PDF/print checks stop missing artwork, overflowing text, or artwork flagged for a previous arrangement. A low-resolution image remains a review note.
5. To rebuild an older book, choose “Review layouts & rebuild artwork”. The layout planner opens before any mutation. Creating the redesign saves the original and a separate empty-art copy, then downloads all per-spread generation instructions. Old paintings are never silently moved under new text.

Cached previews under `public/templates/references/` provide reliable reference packaging; all 29 original previews are credited in `ATTRIBUTION.json`. The public reference endpoint redirects only validated catalogue requests to those same-origin assets. Sources and credits remain visible in the gallery.

## Verification

- 40 targeted Node tests pass: template layout contracts, Unicode preservation, revision validation, repeated layout review, stale-art detection, reference packaging and persistence.
- `scripts/verify-template-layouts.mjs`: against a running local app, exercises gallery, whole-book review, per-spread selection, downloaded redesign request, preserved original browser draft and rendered text fit. Set `PLAYWRIGHT_MODULE` if using an external bundled Playwright. Optional `TEMPLATE_FIXTURE` accepts a local manuscript JSON.
- The supplied 12-spread Lakshmi manuscript passed browser checks with no overflow and all original text retained. The original browser draft survives redesign unchanged.
- A complete angular-art redesign uses all six Beanstalk arrangements. Its deliverables are under `output/template-fidelity/completed/` and `Lakshmi-Redesigned-Book.zip`; the original uploaded ZIP is unchanged. Generated illustrations were inspected after text compositing, with overlapping artwork corrected. These are screen-review images, not guaranteed 300-DPI print masters.
- Production build and artifact validation pass. Focused lint reports no errors (native image-element warnings remain).
- The completed 12-image ZIP was imported through the actual local UI, with all 12 images decoded and no text overflow.
- A downloaded pilot PDF was checked at 420 × 210 mm and visually rendered for typography and placement review.
- Full-repository baseline issues remain outside this feature: `designer-preview-parity` resolves a CSS import as `.css.tsx`; `unlimited-page-plan` expects an absent UI string in unchanged `app/page.tsx`. Broad type checking also reports existing errors in the main app/worker types. Report these separately from template validation.

## Remaining operational steps

Local changes require deployment before they appear on the production website. Keep the existing production data bindings and environment; do not deploy the generic generated configuration over the production Worker. The original uploaded Lakshmi ZIP is unchanged. New artwork is reviewed separately from layout correctness.

## Distinct samples for every template

`lib/template-signatures.ts` defines individually authored interior compositions for all non-Beanstalk templates. Beanstalk retains its six narrative arrangements. There are 29 distinct default geometries and 62 current arrangements across all retained templates (20 selectable and 9 retired). Each new named arrangement has its own immutable ID; older revision-one generic IDs continue to resolve to their original coordinates when reading saved books.

`lib/template-layout-sample.ts` renders the sample through the real spread renderer. The gallery includes arrangement thumbnails, the actual sample text, and the selected template’s art direction. The same arrangements feed book prompts, request specifications, planning and exports. Shaded illustration regions are explicitly labelled as layout guides, not finished paintings.

Verification: 47 focused tests pass, including uniqueness across all 29 default geometries, sample/prompt agreement and saved-layout compatibility. All 62 arrangements were browser-rendered with no text overflow; contact sheets are in `output/template-fidelity/all-template-samples/`.
