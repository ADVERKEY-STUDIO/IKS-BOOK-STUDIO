# Book structure recheck and fixes — 7 September 2026

The recheck of `b0af780` identified five functional gaps. All five now have fixes and passing regression coverage. The additional saved-page image overflow shown in the screenshot is also addressed.

| Finding | Fix | Verification |
| --- | --- | --- |
| Reusing one image URL discarded a second placement and caption | Track manuscript slot identity; validate each declared occurrence before pagination captures its content baseline | Two occurrences of identical artwork retain different captions at opening and reflection anchors |
| Nested section/div prose remained an oversized block | Recursively split ordinary flow containers, retaining wrappers, inline formatting and reading order | Nested multi-page prose has no overflow and all 14 observation markers survive exactly once |
| A short approved section prevented initial layout | Determine readiness from section approval/completion, independently of text length | A long chapter and a 27-character glossary automatically receive a saved layout |
| Illustration anchors disappeared during import | Persist slot, placement and optional explicit anchor metadata; resolve opening, middle and reflection anchors against reader content | Real ZIP upload retains placement metadata; opening/reflection DOM regression checks actual order |
| Preview and publication export disagreed about private text | Share `inspectBookPage` across Designer preflight, Preview and export | Rendered private production text is reported by the shared inspection test |
| Saved in-flow artwork crossed the footer and was clipped | On opening a completed saved book, measure loaded illustrations and reflow affected eligible chapters; bound image height and keep its caption in the same figure | Saved 1100px image/figure is repaired with its caption intact and zero blocking pages |

Locked pages, intentional blanks, free image/text compositions and Canva overrides remain protected from automatic reflow. Their problems are reported for manual adjustment. This avoids replacing a deliberately positioned layout.

## Verification

- Five new targeted regressions were observed failing before their corresponding fixes, then passing.
- 186 unit/source tests pass.
- 27 browser tests pass in Chromium and 27 in Firefox, including four trim sizes, content preservation, Designer/Preview geometry, saved-page reloads and the new regressions.
- A fresh UI test starts from an empty project list, selects a real PDF, imports a real four-section manuscript ZIP and a real four-image ZIP, opens Designer/Preview, downloads a nine-page publication PDF, and reloads the saved book. No blocking pages or warnings were reported. Unlike the earlier workflow test, it does not inject a constructed project. Persistence and asset storage HTTP endpoints are intercepted in this test; ZIP parsing, multipart uploads, slot matching, layout and PDF export use the actual application. External AI generation is outside this test.
- Rendered page 3 of the exported PDF was visually inspected: the portrait image is contained, its caption follows it, subsequent prose remains visible, and the footer is separate.
- Production build and Worker artifact validation pass. Standalone TypeScript checking still reports the same 38 pre-existing errors.

Local proof: `/tmp/iks-five-gaps-proof/zip-workflow.pdf`. Local verification logs use `/tmp/iks-five-gaps-*`. The existing Zen book and its uploads were not replaced by these isolated tests.

## Remaining editorial limits

The earlier 27-section Sanatana Dharma stress fixture reported four spacing warnings at 7×10 and 6×9. That fixture used repeated representative artwork rather than every final image and was not rerun as part of this fix. Those warnings still require review on the actual book. Deliberate whitespace, oversized indivisible content, missing assets and protected manual compositions cannot be classified as aesthetically perfect by an automated check. Structural errors block publication and warnings remain visible for review.
