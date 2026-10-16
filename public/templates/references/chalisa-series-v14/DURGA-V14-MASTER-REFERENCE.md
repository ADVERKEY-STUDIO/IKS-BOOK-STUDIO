# Durga v14 — master reference for future Chalisa books

Version: 2026-10-16, detailed re-audit after the Shiva cloud/moral correction.

## Authority and scope

This is a production reference, not permission to publish or a claim that a generated book is finished. The user’s latest instructions take precedence. Use this guide together with the actual reference images, source verses and rendered output. Do not substitute a verbal style prompt for looking at the references.

**Critical requirements: translucent clouds; substantive two-line morals in each language; visual continuity with Durga v14; correct deity-specific details.** The current Shiva screenshot is a rejected reference for cloud opacity and moral length. Its large opaque cream panel and single-line morals must not become the series template.

Canonical PDF: `output/pdf/Durga-Chalisa-v14-Final-Detailed-Review.pdf`. This is the reviewed v14 PDF, not the earlier v13 in Downloads. SHA-256: 874516bc5871a4e62b7c77e52bb4a3a017a8210646515f91203caa50f1f2fe5a.

Evidence used: all 55 pages inspected in rendered contact sheets, with full-size inspections of representative interior/cloud, Shiva-Parvati, longer-moral and glossary pages; embedded PDF graphics state inspected across all 41 illustrated entries; authoring CSS, placement audit and reviewed manuscript inspected. This is a detailed reproducible specification, not a claim that every tiny mark on every page is flawless. Text extraction has broken Devanagari mappings in places: the rendered page and verified manuscript outrank extracted OCR/text. Never copy corrupted extraction into a new book.

Evidence labels below distinguish **measured**, **observed**, and **required for future books**. Physical print dimensions and bleed must be established separately; PDF point dimensions alone are not a printer specification.

## 1. Structure and pagination

| PDF pages | Function | Layout |
|---|---|---|
| 1 | Illustrated front cover | Square; title at top; deity and children below; botanical edges |
| 2 | Title page | Square cream page; centered Hindi title, English subtitle, small publisher/year |
| 3 | Copyright + invocation | Two-square spread; legal/editorial text left; invocation and transliteration right, lotus at foot |
| 4 | Introduction | Hindi left, equivalent English right; generous cream space |
| 5 | How to use | Hindi left, English right; practical reading guidance |
| 6–46 | 41 illustrated entries | One continuous 2:1 scene per spread; verse and all four bilingual fields together |
| 47–54 | Glossary | Eight square pages, six entries per page, two columns × three rows |
| 55 | Back cover | Square; short blurb, publisher/legal information, botanical foot |

Measured canvas: interior spreads 1260 × 630 PDF points; square pages 630 × 630. Each spread represents two square book pages. Do not confuse 55 PDF sheets with 55 physical book pages. Durga’s first illustrated entry has printed pages 8–9; final prayer 88–89; glossary begins at 90. Use a new pagination map for every new book. Do not copy Durga page references to Shiva.

Durga contains 40 chaupai entries plus a closing prayer. Shiva’s verified source has 44 entries in the current project. Preserve that source-specific count, including opening/closing forms; do not force Shiva into Durga’s 41 entries. Recalculate glossary and final page numbers after assembly.

## 2. The cloud: actual transparency, shape and compositing

**Measured across PDF pages 6–46:** `/ReviewCloud` has nonstroking alpha `/ca = 0.78` and stroking alpha `/CA = 0.78`. The cloud image is 3094 × 2063 pixels and has a separate soft mask. The 78% is the drawing opacity multiplied by the cloud’s per-pixel soft mask, not a solid cream rectangle with 78% alpha and not 78% transparency.

The original cloud has been extracted as `durga-v14-reference/cloud-original-soft-mask.png`. Its PNG contains the original soft mask; apply overall opacity **0.78 once**, when compositing over the scene. Do not flatten it against white first. Do not bake 0.78 into the PNG and also set 0.78 in the layout. Do not apply the opacity to a parent containing the text: the verse and body text remain fully opaque.

Layer order:

1. Full continuous, unlettered illustration, including the quiet landscape behind the text area.
2. Original soft-masked cloud, scaled and positioned to fit the text region, at 0.78 overall opacity.
3. Crisp editable verse and bilingual text, 100% opacity.
4. Discreet page numbers at outside lower corners.

**Observed:** warm ivory rather than stark white; large irregular rounded lobes; subtle paper texture; no thick border, shadow, speech tail, rectangular card or uniform oval. Mountains, trees, roofs, sky and ground remain recognizably visible through the cloud, especially its lower and side areas. Look at PDF pages 6 and 12 at full size. A faint outline inherent in the original raster is acceptable; do not add a graphic stroke.

The cloud size follows the amount of text and the scene. It is not a fixed enormous half-page sticker. Keep landscape and foreground visible below it. Keep significant faces, hands, deity attributes and narrative action out from behind its reading area. Alternate left and right composition according to the scene; the reference does not rigidly alternate every spread.

**Reject** a preview if the cloud erases the landscape, looks like a pasted opaque cream panel, occupies almost the full spread height without need, obscures the main action, or makes the text low contrast. If scenery is too busy, quiet the underlying composition; do not solve that by turning the cloud opaque.

## 3. Text hierarchy, fonts, sizes and spacing

Measured from the v14 authoring source for the four explanation fields:

- English body: **Charis SIL Regular**, local reference file `english.otf`.
- Hindi body: **Noto Serif Devanagari Regular**, `hindi.ttf`.
- English bold labels: the source file named `english-bold.ttf` is actually **Times New Roman Bold**. Do not mislabel it as Charis Bold.
- Body size: **15.75 pt** on the 1260 × 630 point spread canvas; line height **1.38** (about 21.735 pt).
- Labels: **12 pt**, line height **1.25**, bottom margin **4 pt**.
- Normal paragraph bottom margin **12 pt**; moral paragraph bottom margin **10 pt**.
- Body color **#292723**.
- Preserved original verse size **19.5 pt**; warm brick-red/brown, visually stronger than body. Its exact original face/color should be sampled from the source, not replaced with the body face by assumption.
- Source insertion checked `scale == 1`: no automatic shrinking to squeeze overflowing paragraphs.

Use the same relative scale if building on a different canvas. Do not copy point sizes unchanged into a 210 mm square design without scaling the entire composition consistently. Original file fonts are retained for reference; verify their embedding/distribution permissions for the chosen export workflow.

Block order, always together in one cloud:

1. Original Hindi verse, preserving its punctuation and intended line breaks.
2. `हिंदी अर्थ` label, then Hindi meaning.
3. `English meaning` label, then English meaning.
4. `हिंदी नैतिक शिक्षा` label, then Hindi moral.
5. `English moral` label, then English moral.

The actual v14 labels use this capitalization and are not followed by a colon in the representative inspected spreads. Hindi and English paragraphs are left aligned, not justified. Do not split Hindi onto one square and English onto the other for an illustrated entry. That bilingual left/right split belongs to introduction/how-to-use pages.

Reference placement examples from the audit (points, x0/y0/x1/y1, four-field area excluding verse): page 6 `[692, 97.19, 1147.75, 427.75]`; page 7 `[74.60, 115.94, 530.50, 434]`; page 12 `[74.60, 115.94, 530.50, 425.50]`. These are examples, not one universal box. The text region is usually about 430–456 points wide, with some narrower variants. Preserve breathing room around cloud lobes and below the final moral.

Protect Devanagari matras, conjuncts, chandrabindu and danda/double-danda. Use shaping-capable text layout. Do not synthesize Hindi lettering in the image generator. Keep a short final phrase together to avoid a lone last word; the v14 builder kept the final three Hindi words / two English words together. Check the effect rather than blindly inserting nonbreaking spaces everywhere.

## 4. Meanings and two-line morals

**User requirement for future books:** each Hindi moral and each English moral must render as **two readable body lines**, excluding its heading. Use two concise, connected thoughts: the lesson grounded in this verse, followed by a specific action a child can take. Prefer two short sentences. Two sentences and two rendered lines are different tests; check both meaning and the final line wrapping.

**Honest reference observation:** v14 often has two-line morals, but not universally. Page 16’s English moral uses three rendered lines. Do not claim every v14 moral is exactly two lines. The future two-line requirement comes from the user’s latest direction and must be applied deliberately.

Reference example, entry 1:

> माँ दुर्गा सुख देती हैं और दुःख दूर करती हैं। उनसे सीखकर हम उदास व्यक्ति को प्यार और सहारा दें।
>
> Maa Durga brings joy and eases sorrow. We can follow her example by comforting someone who is sad.

The actual text wraps into two body lines in each language at its reference placement. A single instruction such as “Help a classmate who is struggling” loses the explicit relationship to the verse. A semicolon does not turn that into a developed two-line moral.

Shiva example to refine during layout, not a claim of verified line count:

> शिव करुणा से दुखियों की सहायता करते हैं।
> उनसे सीखकर हम परेशान साथी की बात सुनें और मदद करें।
>
> Shiva shows compassion by caring for those in distress.
> Follow his example: listen to a troubled friend and offer help.

Use separate line fields or controlled breaks only after measuring at the final font and width. If either language becomes one line or three, edit the phrasing while retaining its meaning; do not shrink text, stretch letters, add filler, or narrow the entire panel just to force a count. Render and count actual lines before acceptance.

Meanings must explain all significant words and names accurately, with Hindi/English equivalence. Preserve original traditional verses even when their language is archaic. Keep interpretation separate from quotation. Do not silently replace a name because a familiar retelling uses another name; v14 page 16 explicitly preserves Hiranyaksha in that source verse rather than silently changing it. Label source variants and resolve them from the chosen source.

Voice: simple, warm, respectful, practical, suitable for the selected reader age; no dense theological lecture. Avoid repetitive generic “be good” lessons. Courage includes asking a trusted adult for help; compassion includes listening, sharing and supporting; humility includes acknowledging a mistake; gratitude includes recognizing support. Do not frame worship as a guarantee of money, cure, safety or effortless success. Explain devotional promises in the context of the verse.

Every moral must be anchored to this specific verse, meaningful on its own, and equivalent in both languages. Do not introduce an action or belief in one language absent from the other. Vary examples naturally rather than repeating “help your friend” on every page.

## 5. Illustration style and composition

Observed visual language: matte painted storybook illustration; broad, softly modeled shapes; fine grain/paper texture; expressive rounded faces; stylized botanical shapes with lighter leaf veins; warm ochre/gold light against teal, forest green and blue-grey landscapes. Dark forms remain colored rather than solid black. Avoid glossy 3D, photoreal skin, comic outlines, neon effects or excessive sharp digital detail.

One scene spans both squares with a continuous horizon, foreground, lighting and perspective. Do not produce two unrelated panels or a visible split down the middle. One side usually contains the principal action and the other a quiet text zone. Avoid faces, hands and essential attributes on the binding fold. Preserve visual movement across the gutter rather than placing a hard divider there.

Repeated motifs: trees arching from upper corners, layered leaves and branches, lotus and small white flowers low in the frame, water/reflections, stone steps and temple terraces, rounded hills or distant mountain layers. Foreground foliage is darker/larger; distant forms are lighter and less detailed. Vary motifs according to the verse, not by stamping the same tree/temple on every scene.

Page-specific scenes include domestic food sharing, harvest, temple devotion, mountains, cosmic water, protection, fierce forms, self-discipline and family reading. The illustration must show the verse’s subject, not merely the book’s deity in a generic beautiful landscape.

Violence is stylized and restrained, with symbolic conflict and aftermath rather than gore. Fierce forms are dignified and meaningful. Do not remove crucial source content, but do not add frightening details unrelated to the verse.

## 6. Character continuity and minute-detail inspection

Create and inspect a reference sheet for each recurring character, using the actual v14 style reference. Record face shape, eyes, brow, nose, mouth, skin palette, hair part/braid/bun, garment shape, trim, jewelry, relative age/height and characteristic pose. Reuse those identities across scenes; a changed expression or camera angle must not become a different person.

Durga reference: warm complexion, long dark hair, red sari with golden border, gold crown with red focal jewel, bindi, earrings, necklaces/bangles and circular gold halo. Her arms and held objects vary with depicted form; never use one fixed arm count for every manifestation. The recurring girl has dark hair/braid and teal clothing; the boy has dark hair and warm yellow clothing. Match their actual character sheet, not an invented uniform.

Shiva reference on PDF page 12: blue-grey skin; matted topknot; crescent; forehead markings; dark hair; gold hoop earrings; rudraksha; tiger-pattern drape; green neck snake; trident with attached damaru; softly textured golden halo. Carry the visual grammar into Shiva’s book, but use Shiva’s source-specific iconography. Do not copy Durga’s crown, sari or multiple arms onto Shiva merely to match the series.

Inspect at enlarged scale:

- Trace every arm from shoulder through elbow/wrist to its hand; check overlap ownership and deliberate limb count.
- Count visible fingers where the pose permits; check thumbs, palm direction, wrist attachment, bent joints and grip.
- A chakra should have coherent support/placement, not float arbitrarily or cover a repaired finger.
- Trident: three readable prongs, continuous straight shaft, plausible grip/support, no broken/floating middle segment.
- Damaru: coherent hourglass body, strings and attachment; bow: continuous curve/string and plausible held position; sword: continuous blade/guard/handle.
- Snake: continuous neck/body course, one coherent head, no extra tail fragments or fused ornament; no unintended threatening bite.
- Third eye, forehead stripes, bindi/crescent, crown jewels and halo must remain distinct rather than merge into random paint marks.
- Jewelry must attach to ears/neck/wrists; cloth folds must follow torso and limbs; patterned garments must remain coherent through overlap.
- Feet and seated legs connect naturally; humans/animals contact the ground; lion paws, muzzle, ears, tail and mane remain distinct.
- Reflections and shadows must match the subject sufficiently to avoid extra figures or duplicated limbs.
- Instruments, bowls, lamps, books, steps, columns and doors retain sensible structure; repeated architecture does not melt into decorative noise.
- Check small background people too, not only the main deity. Do not let repair overlays obscure corrected hands or leave seams.

For local defects, correct the smallest necessary region and inspect the full scene afterward. Preserve the composition and characters rather than regenerating an unrelated image. Retain original, revision and reason for change.

## 7. Cover, front matter, glossary and back cover

Cover: square, full bleed in the reference preview; English title “Durga Chalisa” in large warm-red decorative serif at top, “for Young Minds” in dark teal below, smaller descriptive line underneath; gold decorative flourishes. Deity and two children create a warm relationship below the title; leaves/flowers frame edges. For another deity replace title and attributes, preserve hierarchy. Reserve title space in the unlettered art and add editable typography afterward. Do not let trident/crescent/halo cross through letters. A provisional 32% clear title zone was used in the Shiva test; that is not a measured universal v14 value. Match the actual cover composition and type sizes visually.

Title page: spacious cream field, centered Hindi title in warm brown/red, smaller English title below, small publisher/year lower; quiet, not another busy illustration.

Copyright/invocation: text-left, devotional-right; right side warm textured sky and lotus foliage along bottom. Use correct deity-specific invocation and verify transliteration; do not copy a Durga invocation into another book without checking relevance. Confirm real publisher/year/rights statements. Do not invent ISBN or legal assertions.

Introduction and how-to-use: Hindi on left, English on right, modest dark warm headings, matching paragraph content and generous lower whitespace. Explain purpose, how to read verse/meaning/moral and how to discuss/practice a lesson. Avoid excessive added worksheets or unrelated sections.

Glossary: cream background; brown serif heading “Glossary”; small subtitle “Words, meanings and chaupai references”; two columns, three entries in each; thin muted tan horizontal separators and a fine central vertical divider. Each entry: reddish Hindi headword, Hindi definition, English definition, smaller muted verse/page reference. Maintain clear spacing and do not draw heavy boxes. Reference has 48 entries across eight pages; future book count depends on its vocabulary. Match layout, not irrelevant Durga headwords. Keep correct printed-page references and identify doha/prayer rather than calling every item a chaupai.

Back cover: short child-friendly blurb high on cream; publisher/contact/rights information below; generous open space; strong teal leaves, pink lotuses and small white flowers at bottom; botanical corners. Copy only verified current publisher details. Preserve space for a real ISBN/barcode if supplied; do not invent one.

## 8. Output quality and acceptance gates

A pretty preview is not a completed book. Keep art, cloud, text and page numbers independently editable. Save a structured manuscript, per-entry source map, illustration manifest, revision log and assembly source. Record actual source-image pixels and effective PPI at intended physical size. Upscaling a low-resolution image does not establish new native detail. Verify trim/bleed and embedded fonts before calling a PDF print-ready.

Before mass production, render one left-cloud and one right-cloud finished spread, plus cover and glossary sample. Compare them side by side with v14. Both morals must be two body lines, the actual cloud must be visibly translucent, all text must fit without shrinking, and character/attribute checks must pass. An automated worker must inspect and record these checks itself; do not demand routine user Continue. If uncertain, save an explicit unresolved finding rather than claiming success.

For EVERY final spread record: source entry ID; original verse matched; Hindi/English meaning checked; both moral strings; actual rendered moral line counts (2 and 2); cloud asset hash; overlay alpha 0.78; visual background visibility pass; text clipping/widow check; font/size; illustration and character references; anatomy/attributes QA; page numbers; file hashes and unresolved issues.

Final gate: all source entries represented once; full-resolution preview review of every spread; consistent characters and style; cover/back matter complete; glossary references resolve; no old patch layers covering new repairs; actual final PDF + editable package + honest QA report. Do not mark a book complete merely because text is complete or all images have been generated.

## 9. Reusable production instruction

> Read this entire guide and inspect the actual Durga v14 reference pages before making the next Chalisa. Preserve this book’s source verses and entry count. Match the continuous 2:1 painted scenes, character consistency, warm cream/teal/gold palette, editable typographic hierarchy and actual soft-masked cloud at 0.78 drawing opacity. Every Hindi moral and every English moral must contain a verse-grounded lesson plus a concrete child-friendly action and render in exactly two body lines. Keep all four bilingual fields together below the original verse. Inspect source meaning, hands, limbs, attributes, scene continuity, text shaping and final layout. Save checkpoints and QA evidence. Correct localized defects without replacing the book’s identity. Never use an opaque generated cloud or a single-line moral as an acceptable shortcut.

## 10. Page-by-page visual ledger

Numbers below are PDF page numbers, not printed book page numbers. These observations were made from the rendered page overview; selected full-size examples are identified above. Use the full source page for detailed implementation.

| PDF page | Observed detail |
|---|---|
| 1 | Front cover: warm mother/children grouping, red title, teal subtitle, gold flourishes and leafy edges. |
| 2 | Title page: centered bilingual title on cream, substantial empty space, small publisher/year. |
| 3 | Copyright left; invocation right; lotus and foliage along bottom of right square. |
| 4 | Introduction: aligned Hindi-left/English-right paragraphs; generous whitespace. |
| 5 | How to use: same bilingual split and restrained cream typography. |
| 6 | Durga and girl with lion left; cloud right; temple/trees visibly show through cloud. |
| 7 | Cosmic light/three worlds: cloud left; winding luminous path, mountains and water right. |
| 8 | Large close-up deity face right; cloud left; crescent, brows, crown and lotus foreground. |
| 9 | Shrine and worshipping family left; cloud right; trident and supported chakra require close QA. |
| 10 | Harvest scene: cloud left; crops, grain vessels, workers and Durga right. |
| 11 | Annapurna serving food left; cloud right; utensils, fire and hand-to-bowl relationships. |
| 12 | Shiva and Parvati right above cosmic water; cloud left with visible mountains/waves beneath. |
| 13 | Gathered gods and worship shrine left; cloud right; multiple identities and hands remain distinct. |
| 14 | Saraswati teaching with veena right; cloud left; instrument strings/hand positions matter. |
| 15 | Narasimha emerging from split pillar left; cloud right; stone fragments and connected limbs. |
| 16 | Narasimha protecting child right; cloud left; English moral wraps to THREE lines in v14. |
| 17 | Lakshmi and Vishnu left with lotus pond; cloud right; separate faces, crowns and attributes. |
| 18 | Vishnu reclining under serpent canopy right; cloud left; continuous serpents, lotus water. |
| 19 | Hinglaj cave shrine left; cloud right; pilgrims and warm arid landscape. |
| 20 | Multiple goddess forms right beneath tree; cloud left; distinct colors/instruments/identities. |
| 21 | Boat/protective symbolic scene left; cloud right; water movement, lotus/flame motif. |
| 22 | Procession and Hanuman greeting right; cloud left; flags, drums and coherent crowd scale. |
| 23 | Fierce goddess on lion left; cloud right; sword/bowl and dark swirling background. |
| 24 | Protective goddess/lion on fort right; cloud left; trident, shield and conflict in distance. |
| 25 | Nagarkot temple approach left; cloud right; bells, musicians, flags and distant valley. |
| 26 | Goddess and lion on rocky height right; cloud left; defeated foes shown without gore. |
| 27 | Proud king elevated left; distressed people below; cloud right; narrative hierarchy. |
| 28 | Kali right; cloud left; dark blue-black skin, red/black drapery, coherent limbs and battlefield. |
| 29 | Protection of saints in storm left; cloud right; wind, waves and consistent gesture direction. |
| 30 | Celestial procession right with white elephant; cloud left; multi-figure anatomy/overlap QA. |
| 31 | Jwala flame shrine left; cloud right; warm lamp glow balanced by cool distance. |
| 32 | Family singing/ritual right; cloud left; instruments, altar, seated people and foreground animal. |
| 33 | Meditation by water left; cloud right; reflection and symbolic life-cycle forms distinguished. |
| 34 | Assembly of sages and gods right; cloud left; gold flowing motif connects the group. |
| 35 | Shankaracharya seated left; cloud right; mountain quiet and symbolic swirling forms. |
| 36 | Shankaracharya worshipping Shiva lingam right; cloud left; moonlit arch, lamps, markings. |
| 37 | Shankaracharya resting after loss of strength left; cloud right; connected seated anatomy. |
| 38 | Humble prostration at goddess shrine right; cloud left; hands and elbows need careful tracing. |
| 39 | Durga restores strength left; cloud right; coherent blessing hand and recipient gesture. |
| 40 | Mother/child approaching home shrine right; cloud left; sorrow/support and warm interior. |
| 41 | Girl entangled by symbolic possessions left; cloud right; vines/objects must not become limbs. |
| 42 | Protective Durga with meditating girl right; cloud left; calm face and guarded surroundings. |
| 43 | Blessings and household skills left; cloud right; loom/objects, hand grips and gifts coherent. |
| 44 | Elder reading to children right under tree; cloud left; book, listening poses and foreground cow. |
| 45 | Family devotional reading left; cloud right; open book, lamps and respectful expressions. |
| 46 | Closing prayer: bowed devotee and goddess shrine right; cloud left; water/steps and soft light. |
| 47 | Glossary 1: two columns, six entries; muted fine rules; small printed page 90. |
| 48 | Glossary 2: same grid; longer definition wraps naturally without shrinking. |
| 49 | Glossary 3: creation/wisdom/Narasimha vocabulary; corrected Hindi wisdom definition. |
| 50 | Glossary 4: divine-form names; references use printed pages, not PDF indexes. |
| 51 | Glossary 5: weapons/body/ritual terms; heading/body/reference hierarchy retained. |
| 52 | Glossary 6: destruction, trouble, pride and celestial vocabulary; six-entry grid. |
| 53 | Glossary 7: devotion, poverty, rebirth and yoga vocabulary; consistent cream background. |
| 54 | Glossary 8: humility/desires/grace vocabulary; closing prayer correctly distinguished from chaupai 40. |
| 55 | Back cover: small upper blurb, publisher/legal blocks, abundant cream, lotus/leaf footer. |

## 11. Exact editorial reference pairs from all 41 Durga entries

These are source examples for studying the lesson construction, not text to paste into another deity’s book. Rendered line count must be checked separately. Original source spelling is preserved.

### Entry 1 — PDF page 6

नमो नमो दुर्गे सुख करनी।  
नमो नमो अम्बे दुःख हरनी॥

- Hindi meaning: सर्व सुख प्रदान करने वाली देवी दुर्गा को बारम्बार नमन। सब दुःख हरने वाली माँ अम्बा को बारम्बार नमन।
- English meaning: O Goddess Durga, the giver of all happiness, I bow before you. O Goddess Amba, who ends all sorrow, I bow before you.
- Hindi moral: माँ दुर्गा सुख देती हैं और दुःख दूर करती हैं। उनसे सीखकर हम उदास व्यक्ति को प्यार और सहारा दें।
- English moral: Maa Durga brings joy and eases sorrow. We can follow her example by comforting someone who is sad.

### Entry 2 — PDF page 7

निराकार है ज्योति तुम्हारी।  
तिहुँ लोक फैली उजियारी॥

- Hindi meaning: माँ, आपकी ज्योति का कोई निश्चित रूप नहीं है। उसका उजाला तीनों लोकों—पृथ्वी, स्वर्ग और पाताल—में फैला है।
- English meaning: Maa, your light has no fixed form. It shines through the three worlds: earth, heaven and the world below.
- Hindi moral: माँ की शक्ति सब तक पहुँचती है। उनसे सीखकर हम अपनी शक्ति और दया से सबकी मदद करें।
- English moral: Maa’s power reaches everyone. Inspired by her, let us use our strength and kindness to help others.

### Entry 3 — PDF page 8

शशि ललाट मुख महाविशाला।  
नेत्र लाल भृकुटि विकराला॥

- Hindi meaning: माँ के माथे पर चंद्रमा शोभा देता है और उनका मुख विशाल है। उनकी लाल आँखें और तनी हुई भौंहें उनका शक्तिशाली रूप दिखाती हैं।
- English meaning: The moon shines on Maa’s forehead, and her face is grand. Her red eyes and fierce brows show her power.
- Hindi moral: माँ का रूप सिखाता है कि शांत मन में भी साहस हो सकता है। दयालु रहें और किसी के साथ अन्याय हो तो उसका साथ दें।
- English moral: Maa’s form reminds us that a gentle heart can be brave. Be kind, and stand beside someone who is treated unfairly.

### Entry 4 — PDF page 9

रूप मातु को अधिक सुहावे।  
दरश करत जन अति सुख पावे॥

- Hindi meaning: माँ का रूप सुंदर और मन को भाने वाला है। उनके दर्शन से भक्तों को बहुत खुशी मिलती है।
- English meaning: The Mother’s form is beautiful. Seeing her brings great joy to her devotees.
- Hindi moral: माँ का सुंदर, ममतामय रूप मन को खुशी देता है।
हम भी प्यार भरे व्यवहार से किसी का दिन सुंदर बना सकते हैं।
- English moral: Maa’s beautiful, loving presence brings joy.
Our gentle actions can brighten someone’s day too.

### Entry 5 — PDF page 10

तुम संसार शक्ति लय कीना।  
पालन हेतु अन्न धन दीना॥

- Hindi meaning: संसार की सारी शक्तियाँ आप में समाई हैं। आप सबके पालन के लिए अन्न और धन देती हैं।
- English meaning: All the world’s powers rest in you. You give food and wealth to care for everyone.
- Hindi moral: माँ अपनी शक्ति से सबका पालन करती हैं। उनसे सीखकर भोजन व्यर्थ न करें और ज़रूरतमंदों की मदद करें।
- English moral: Maa uses her strength to care for everyone. Inspired by her, avoid wasting food and help those in need.

### Entry 6 — PDF page 11

अन्नपूर्णा हुई जग पाला।  
तुम ही आदि सुन्दरी बाला॥

- Hindi meaning: माँ अन्नपूर्णा के रूप में आप सारे जगत को भोजन देती हैं। आप ही देवी आदि शक्ति त्रिपुरा सुंदरी हैं।
- English meaning: As Maa Annapurna, you feed and care for the whole world. You are also Goddess Adi Shakti Tripura Sundari.
- Hindi moral: माँ अन्नपूर्णा सबको भोजन देकर पोषण करती हैं।
उनसे सीखकर हम भोजन का आदर करें और मिल-बाँटकर खाएँ।
- English moral: Maa Annapurna nourishes everyone with food.
We can honour food and share it with others.

### Entry 7 — PDF page 12

प्रलयकाल सब नाशन हारी।  
तुम गौरी शिवशंकर प्यारी॥

- Hindi meaning: सृष्टि के अंत में आप सबका अंत करती हैं। आप ही भगवान शिव की प्रिय गौरी हैं।
- English meaning: At the end of creation, you bring everything to an end. You are Gauri (Parvati), beloved of Lord Shiva.
- Hindi moral: माँ के रूप सिखाते हैं कि जीवन में बदलाव आता है।
बदलाव के समय प्रेम और धैर्य से एक-दूसरे का साथ दें।
- English moral: Maa’s forms remind us that life brings change.
Meet change with patience and care for one another.

### Entry 8 — PDF page 13

शिव योगी तुम्हरे गुण गावें।  
ब्रह्मा विष्णु तुम्हें नित ध्यावें॥

- Hindi meaning: भगवान शिव और योगी आपके गुण गाते हैं। ब्रह्मा और विष्णु हर दिन आपका ध्यान करते हैं।
- English meaning: Lord Shiva and the yogis sing your praises. Brahma and Vishnu meditate on you every day.
- Hindi moral: देवता भी माँ की शक्ति का आदर करते हैं।
हम भी अपनी मदद करने वालों का आभार मानें।
- English moral: Even the gods honour Maa’s strength.
We can be grateful to those who help us.

### Entry 9 — PDF page 14

रूप सरस्वती को तुम धारा।  
दे सुबुद्धि ऋषि-मुनिन उबारा॥

- Hindi meaning: आपने देवी सरस्वती का रूप लिया। ऋषियों और मुनियों को अच्छी बुद्धि देकर आपने उनका भला किया।
- English meaning: You took the form of Goddess Saraswati. You gave wisdom to the sages and helped them.
- Hindi moral: माँ सरस्वती हमें अच्छी बुद्धि की प्रेरणा देती हैं।
जो सीखें, उसका उपयोग सही निर्णय लेने में करें।
- English moral: Maa Saraswati inspires wisdom and good sense.
Use what you learn to make thoughtful choices.

### Entry 10 — PDF page 15

धरा रूप नरसिंह को अम्बा।  
प्रगट भई फाड़कर खम्बा॥

- Hindi meaning: हे माँ अम्बा, आपने नरसिंह का रूप धारण किया। आप खम्भे को चीरकर प्रकट हुईं।
- English meaning: O Mother Amba, you took the form of Narasimha. You split open the pillar and appeared.
- Hindi moral: माँ का नरसिंह रूप संकट में साहस जगाता है।
मुश्किल देखकर हार न मानें, सही मदद खोजें।
- English moral: Maa’s Narasimha form inspires courage in danger.
When trouble comes, seek the right help and keep trying.

### Entry 11 — PDF page 16

रक्षा कर प्रह्लाद बचायो।  
हिरण्याक्ष को स्वर्ग पठायो॥

- Hindi meaning: आपने भक्त प्रह्लाद की रक्षा की। इस चौपाई में कहा गया है कि आपने हिरण्याक्ष को स्वर्ग भेजा।
- English meaning: You protected Prahlad. This verse says that you sent Hiranyaksha to heaven.
- Hindi moral: माँ हमें मन और शरीर से मज़बूत बनकर दूसरों की रक्षा करना सिखाती हैं। डर लगे तब भी सही का साथ दें और ज़रूरत हो तो किसी बड़े की मदद लें।
- English moral: Maa inspires us to grow strong in mind and body so we can protect others. Stand up for what is right, and ask an adult for help when needed.

### Entry 12 — PDF page 17

लक्ष्मी रूप धरो जग माहीं।  
श्री नारायण अंग समाहीं॥

- Hindi meaning: आपने संसार में लक्ष्मी का रूप धारण किया। श्री नारायण में आप ही समायी हैं।
- English meaning: You appeared in the world as Goddess Lakshmi. You are one with Shri Narayan.
- Hindi moral: माँ लक्ष्मी का रूप समृद्धि का आदर करना सिखाता है।
अपनी चीज़ें सँभालें और उनका उपयोग भलाई में करें।
- English moral: Maa Lakshmi teaches us to value what we have. Care for your belongings and use them to do good.

### Entry 13 — PDF page 18

क्षीरसिन्धु में करत विलासा।  
दयासिन्धु दीजै मन आसा॥

- Hindi meaning: आप भगवान विष्णु के साथ क्षीर सागर में आनंद से रहती हैं। हे दया की सागर माँ, मेरे मन की आशाएँ पूरी कीजिए।
- English meaning: You dwell in the ocean of milk (with Lord Vishnu). O ocean of kindness, please fulfil the desires of my heart.
- Hindi moral: दया की सागर माँ हमें करुणा की प्रेरणा देती हैं।
अपनी इच्छाओं के साथ दूसरों की ज़रूरतें भी समझें।
- English moral: Maa, the ocean of kindness, inspires compassion.
Think of others’ needs as well as your own wishes.

### Entry 14 — PDF page 19

हिंगलाज में तुम्हीं भवानी।  
महिमा अमित न जात बखानी॥

- Hindi meaning: हे माँ भवानी! हिंगलाज देवी भी आप स्वयं हैं। आपकी महिमा का वर्णन करना संभव नहीं है।
- English meaning: O Mother Bhavani, you are Goddess Hingalaj. Your greatness is too vast for words.
- Hindi moral: माँ की असीम महिमा हमें विनम्र बनना सिखाती है।
सब कुछ जानने का दावा न करें, सीखने को तैयार रहें।
- English moral: Maa’s greatness reminds us to be humble. Stay ready to learn instead of claiming to know everything.

### Entry 15 — PDF page 20

मातंगी अरु धूमावति माता।  
भुवनेश्वरी बगला सुख दाता॥

- Hindi meaning: मातंगी और धूमावती माता आप ही हैं। आप ही भुवनेश्वरी और बगलामुखी देवी के रूप में सभी को प्रसन्नता प्रदान करती हैं।
- English meaning: You are Matangi and Dhumavati. As Bhuvaneshwari and Bagalamukhi, you bring happiness to all.
- Hindi moral: माँ के अनेक रूप सबके कल्याण की प्रेरणा देते हैं।
हम भी अलग-अलग ज़रूरतों को समझकर मदद करें।
- English moral: Maa’s many forms inspire care for everyone.
Notice different needs and find thoughtful ways to help.

### Entry 16 — PDF page 21

श्री भैरव तारा जग तारिणि।  
छिन्न भाल भव दुःख निवारिणि॥

- Hindi meaning: आप भैरव और सारे जगत का उद्धार करती हैं। छिन्नमस्ता देवी के रूप में आप संसार के दुःख दूर करती हैं।
- English meaning: You are the saviour of Bhairav and the whole world. As Goddess Chhinnamasta, you ease the world’s sorrows.
- Hindi moral: दुःख दूर करने वाली माँ हमें सहारा देना सिखाती हैं।
परेशान साथी की बात सुनें और मदद के लिए साथ चलें।
- English moral: Maa, who eases sorrow, inspires us to offer support.
Listen to a troubled friend and help them seek care.

### Entry 17 — PDF page 22

केहरि वाहन सोह भवानी।  
लांगुर वीर चलत अगवानी॥

- Hindi meaning: आप अपने वाहन सिंह पर सुशोभित रहती हैं। वीर वानर भगवान हनुमान आपकी अगुवाई करते हैं।
- English meaning: O Mother Bhavani, you look majestic riding your lion. Brave Hanuman goes ahead to welcome you.
- Hindi moral: माँ का साहस और हनुमान की सेवा हमें प्रेरणा देते हैं।
अपनी हिम्मत किसी अच्छे काम में लगाएँ।
- English moral: Maa’s courage and Hanuman’s service inspire us.
Use your courage to help a good cause.

### Entry 18 — PDF page 23

कर में खप्पर-खड्ग विराजै।  
जाको देख काल डर भाजे॥

- Hindi meaning: आपके हाथों में खड्ग और खप्पर शोभा देते हैं। इस निर्भय रूप को देखकर काल भी डरकर भाग जाता है।
- English meaning: A sword and a skull-shaped bowl shine in your hands. Even Kaal, the power of time and death, flees in fear.
- Hindi moral: माँ का निर्भय रूप हमें डर का सामना करना सिखाता है। डर लगे तो धीरे-धीरे साँस लें और भरोसेमंद बड़े से बात करें।
- English moral: Maa’s fearless form inspires us to face fear. Take a slow breath and speak to a trusted adult.

### Entry 19 — PDF page 24

सोहै अस्त्र और त्रिशूला।  
जाते उठत शत्रु हिय शूला॥

- Hindi meaning: आपके हाथों में अस्त्र और त्रिशूल सुशोभित हैं। उनके उठते ही शत्रु का हृदय भय से काँपने लगता है।
- English meaning: Weapons and a trident shine in your hands. Seeing them fills your enemies’ hearts with fear.
- Hindi moral: माँ के अस्त्र रक्षा और साहस के प्रतीक हैं।
अपनी ताकत से दूसरों को सुरक्षित रखें, डराएँ नहीं।
- English moral: Maa’s weapons stand for protection and courage.
Use your strength to keep others safe, never to frighten them.

### Entry 20 — PDF page 25

नगर कोटि में तुम्हीं विराजत।  
तिहुँलोक में डंका बाजत॥

- Hindi meaning: काँगड़ा के नगरकोट में देवी के रूप में आप ही विराजमान हैं। तीनों लोकों में आपके यश का गुणगान होता है।
- English meaning: You dwell as the Goddess at Nagarkot in Kangra. All three worlds sing your praises.
- Hindi moral: तीनों लोक माँ की महिमा का गुणगान करते हैं।
हम भी अच्छे कार्यों को पहचानें और उनकी सराहना करें।
- English moral: The three worlds celebrate Maa’s glory.
We too can notice good deeds and appreciate them.

### Entry 21 — PDF page 26

शुम्भ निशुम्भ दानव तुम मारे।  
रक्तबीज शंखन संहारे॥

- Hindi meaning: आपने शुम्भ और निशुम्भ दानवों का वध किया। आपने रक्तबीज और उसके अनेक रूपों का भी संहार किया।
- English meaning: You slew the demons Shumbha and Nishumbha. You also destroyed Raktabeej and his many forms.
- Hindi moral: माँ दुर्गा की विजय सिखाती है कि अहंकार और अन्याय दूसरों को दुःख देते हैं।
उनसे प्रेरणा लेकर हम अपने भीतर की बुराइयों पर विजय पाएँ और सही का साथ दें।
- English moral: Maa Durga’s victory shows that pride and unfair actions hurt others. Inspired by her, we can overcome harmful habits and stand up for what is right.

### Entry 22 — PDF page 27

महिषासुर नृप अति अभिमानी।  
जेहि अघ भार मही अकुलानी॥

- Hindi meaning: महिषासुर नाम का असुर राजा बहुत घमंडी था। उसके बुरे कामों से पूरी धरती दुःखी थी।
- English meaning: The demon king Mahishasura was very proud. His cruel deeds made the whole earth suffer.
- Hindi moral: महिषासुर का घमंड सबके दुःख का कारण बना।
माँ की कथा से सीखकर सफलता पर विनम्र रहें।
- English moral: Mahishasura’s pride brought suffering to others.
Maa’s story reminds us to stay humble when we succeed.

### Entry 23 — PDF page 28

रूप कराल कालिका धारा।  
सेन सहित तुम तिहि संहारा॥

- Hindi meaning: आपने देवी काली का विकराल रूप धारण किया। आपने महिषासुर और उसकी सेना का संहार किया।
- English meaning: You took the fierce form of Goddess Kali. You slew Mahishasura and his army.
- Hindi moral: माँ काली अन्याय का अंत करके रक्षा करती हैं।
उनसे सीखकर गलत काम का शांत और दृढ़ विरोध करें।
- English moral: Maa Kali protects others by ending injustice.
Inspired by her, stand firmly and calmly against wrongdoing.

### Entry 24 — PDF page 29

परी गाढ़ सन्तन पर जब-जब।  
भई सहाय मातु तुम तब तब॥

- Hindi meaning: जब भी संतों पर संकट आया, माँ, आपने उनकी सहायता और रक्षा की।
- English meaning: Whenever the saints were in trouble, Mother, you came to help and protect them.
- Hindi moral: माँ संकट में संतों की सहायता करती हैं।
हम भी मुश्किल में पड़े किसी व्यक्ति को सहारा दें।
- English moral: Maa comes to the saints’ aid in times of trouble.
We can offer support to someone facing a difficulty.

### Entry 25 — PDF page 30

अमरपुरी अरु बासव लोका।  
तब महिमा सब रहें अशोका॥

- Hindi meaning: अमरपुरी यानी इंद्र और देवताओं के लोक में आपकी महिमा से सब दुःख से मुक्त रहते हैं।
- English meaning: In Amarpuri, the realm of Indra and the gods, your glory keeps everyone free from sorrow.
- Hindi moral: माँ की उपस्थिति देवताओं के लोक में सुख लाती है।
हम भी घर में प्रेम और सहयोग से खुशियाँ बढ़ाएँ।
- English moral: Maa’s presence brings joy to the realm of the gods.
We can bring joy to our home through love and cooperation.

### Entry 26 — PDF page 31

ज्वाला में है ज्योति तुम्हारी।  
तुम्हें सदा पूजें नर-नारी॥

- Hindi meaning: आपके प्रताप से ही ज्वाला जी में निरंतर ज्योति जलती रहती है। सभी नर व नारी सदैव आपको पूजते हैं।
- English meaning: Your light is present in the flame of Jwalaji. Men and women always worship you.
- Hindi moral: माँ की अखंड ज्योति हमें आशा की याद दिलाती है।
कठिन दिन में भी एक अच्छा कदम आगे बढ़ाएँ।
- English moral: Maa’s steady flame reminds us of hope.
Even on a hard day, take one helpful step forward.

### Entry 27 — PDF page 32

प्रेम भक्ति से जो यश गावै।  
दुःख दारिद्र निकट नहिं आवें॥

- Hindi meaning: चालीसा कहती है कि जो प्रेम और भक्ति से आपका गुणगान करते हैं, उनके पास दुःख और गरीबी नहीं आते।
- English meaning: The Chalisa says that sorrow and poverty stay away from those who sing your praises with love and devotion.
- Hindi moral: माँ का प्रेम से गुणगान मन में आशा जगाता है।
मिलकर प्रार्थना करें और दुःखी लोगों का साथ दें।
- English moral: Singing Maa’s praise with love fills hearts with hope.
Pray together and support those who feel sorrow.

### Entry 28 — PDF page 33

ध्यावे तुम्हें जो नर मन लाई।  
जन्म-मरण ताकौ छुटि जाई॥

- Hindi meaning: जो पूरे मन से आपका ध्यान करते हैं, वे जन्म और मृत्यु के चक्र से मुक्त हो जाते हैं।
- English meaning: Those who meditate on you with a focused mind find freedom from the cycle of birth and death.
- Hindi moral: माँ का ध्यान मन को गहराई से जोड़ने की प्रेरणा देता है।
कुछ शांत पल निकालें और अपने मन को समझें।
- English moral: Meditating on Maa inspires a deeper, calmer focus.
Take a few quiet moments to understand your feelings.

### Entry 29 — PDF page 34

जोगी सुर मुनि कहत पुकारी।  
योग न हो बिन शक्ति तुम्हारी॥

- Hindi meaning: सभी योगी, देवता और ऋषि-मुनि यही कहते हैं कि आपकी शक्ति के बिना ईश्वर-प्राप्ति नहीं हो सकती।
- English meaning: Yogis, gods and sages say that without your power, no one can become one with God.
- Hindi moral: योगी भी माँ की शक्ति और कृपा का सहारा मानते हैं।
हम भी दूसरों के सहयोग को आदर से स्वीकार करें।
- English moral: Even yogis recognise Maa’s strength and grace.
We too can accept others’ support with gratitude.

### Entry 30 — PDF page 35

शंकर आचारज तप कीनो।  
काम अरु क्रोध जीति सब लीनो॥

- Hindi meaning: शंकराचार्य ने गहरी तपस्या की। इससे उन्होंने काम और क्रोध पर विजय पाई।
- English meaning: Shankaracharya practised deep prayer and self-discipline. Through this, he overcame desire and anger.
- Hindi moral: शंकराचार्य का तप संयम की शक्ति दिखाता है।
क्रोध आने पर रुकें और सोचकर उत्तर दें।
- English moral: Shankaracharya’s discipline shows the strength of self-control. When you feel angry, pause and think before you reply.

### Entry 31 — PDF page 36

निशिदिन ध्यान धरो शंकर को।  
काहु काल नहिं सुमिरो तुमको॥

- Hindi meaning: उन्होंने दिन-रात भगवान शिव का ध्यान किया, पर आपका स्मरण नहीं किया।
- English meaning: He meditated on Lord Shiva day and night, but did not remember you.
- Hindi moral: यह कथा माँ की शक्ति को याद रखने की सीख देती है।
एक काम में डूबकर अपनी दूसरी ज़िम्मेदारियाँ न भूलें।
- English moral: This story reminds us to remember Maa’s strength.
While focusing on one task, remember your other duties too.

### Entry 32 — PDF page 37

शक्ति रूप को मरम न पायो।  
शक्ति गई तब मन पछितायो॥

- Hindi meaning: वह माँ की शक्ति का महत्व नहीं समझ पाए। जब उनकी अपनी शक्ति चली गई, तो उन्हें अपनी भूल पर पछतावा हुआ।
- English meaning: He did not understand Maa’s power. When he lost his own strength, he saw his mistake and felt sorry.
- Hindi moral: माँ की शक्ति को न समझने पर शंकराचार्य ने भूल मानी।
हम भी अपनी गलती पहचानकर उससे सीखें।
- English moral: Shankaracharya admitted that he had not understood Maa’s power. We too can recognise our mistakes and learn from them.

### Entry 33 — PDF page 38

शरणागत हुई कीर्ति बखानी।  
जय जय जय जगदम्ब भवानी॥

- Hindi meaning: उन्होंने आपकी शरण ली और आपकी महिमा गाई: “जय, जय, जय, जगदम्बा भवानी!”
- English meaning: He sought your shelter and sang your praises: “Victory, victory, victory to Mother Jagadamba Bhavani!”
- Hindi moral: माँ की शरण में शंकराचार्य ने विनम्रता दिखाई।
हम भी घमंड छोड़कर आदर से सहायता माँगें।
- English moral: Shankaracharya showed humility by seeking Maa’s care.
We too can set pride aside and ask respectfully for help.

### Entry 34 — PDF page 39

भई प्रसन्न आदि जगदम्बा।  
दई शक्ति नहिं कीन विलम्बा॥

- Hindi meaning: माँ जगदम्बा उन पर प्रसन्न हुईं। उन्होंने बिना देर किए उनकी शक्ति लौटा दी।
- English meaning: Maa Jagadamba was pleased with him. She gave him back his strength without delay.
- Hindi moral: माँ ने प्रसन्न होकर शंकराचार्य को फिर शक्ति दी।
हम भी भूल सुधारने वाले को नया अवसर दें।
- English moral: Maa joyfully restored Shankaracharya’s strength.
We too can give someone a fresh chance after a mistake.

### Entry 35 — PDF page 40

मोको मातु कष्ट अति घेरो।  
तुम बिन कौन हरै दुःख मेरो॥

- Hindi meaning: हे माँ, मैं बहुत कष्ट में हूँ। आपके सिवाय मेरा दुःख कौन दूर कर सकता है?
- English meaning: O Mother, I am troubled by pain. Who but you can take away my sorrow?
- Hindi moral: माँ के सामने भक्त अपना दुःख खुलकर कहता है।
हम भी परेशानी छिपाने के बजाय भरोसेमंद बड़े से कहें।
- English moral: The devotee shares his sorrow openly with Maa.
We too can tell a trusted adult when we are troubled.

### Entry 36 — PDF page 41

आशा तृष्णा निपट सतावै।  
मोह मदादिक सब विनशावै॥

- Hindi meaning: कभी न मिटने वाली इच्छाएँ मुझे बहुत परेशान करती हैं। मोह और घमंड मेरा सुख-चैन छीन लेते हैं।
- English meaning: Endless wants trouble me. Attachment and pride take away my peace.
- Hindi moral: माँ से की गई प्रार्थना लालच और घमंड से बचना सिखाती है।
हर चीज़ पाने की ज़िद छोड़ें और जो मिला है उसका आदर करें।
- English moral: This prayer to Maa reminds us to resist greed and pride.
Value what you have instead of insisting on having everything.

### Entry 37 — PDF page 42

शत्रु नाश कीजै महारानी।  
सुमिरौं इकचित तुम्हें भवानी॥

- Hindi meaning: हे महारानी, मेरे शत्रुओं का नाश कीजिए। माँ भवानी, मैं एकाग्रचित्त होकर केवल आपका सुमिरन करता रहूँ।
- English meaning: O Queen, please destroy my enemies. May I remember you with a focused mind.
- Hindi moral: माँ से रक्षा माँगते हुए भक्त एकाग्र होकर उन्हें याद करता है।
हम भी मन को सँभालें और शांति से सही रास्ता चुनें।
- English moral: The devotee seeks Maa’s protection with a focused heart.
We too can steady our minds and choose a peaceful, right path.

### Entry 38 — PDF page 43

करो कृपा हे मातु दयाला।  
ऋद्धि-सिद्धि दे करहु निहाला॥

- Hindi meaning: हे दयालु माँ, मुझ पर कृपा कीजिए।
ऋद्धि और सिद्धि देकर मुझे आनन्दित कीजिए।
- English meaning: O kind Mother, bless me with your grace. Grant prosperity and spiritual powers, and bring me joy.
- Hindi moral: दयालु माँ से भक्त समृद्धि और सिद्धि का आशीर्वाद माँगता है।
जो योग्यता और साधन मिलें, उन्हें अच्छे काम में लगाएँ।
- English moral: The devotee asks kind Maa for prosperity and spiritual gifts. Use your skills and what you have to do good.

### Entry 39 — PDF page 44

जब लगि जियउं दया फल पाऊं।  
तुम्हरो यश मैं सदा सुनाऊं॥

- Hindi meaning: हे माँ, जीवन भर आपकी दया का फल पाता रहूँ।
मैं सदा आपकी महिमा गाता और सुनाता रहूँ।
- English meaning: O Mother, may I receive your kindness throughout my life. May I always sing and share your glory.
- Hindi moral: भक्त जीवन भर माँ की कृपा का आभार मानना चाहता है।
हम भी मिली सहायता को याद रखें और कृतज्ञ रहें।
- English moral: The devotee wishes to thank Maa throughout his life.
We too can remember the help we receive and stay grateful.

### Entry 40 — PDF page 45

दुर्गा चालीसा जो नित गावै।  
सब सुख भोग परमपद पावै॥

- Hindi meaning: चालीसा कहती है कि जो इसे रोज़ गाता है, वह सभी सुख भोगकर परम आध्यात्मिक पद पाता है।
- English meaning: The Chalisa says that one who sings it daily
enjoys happiness and reaches the highest spiritual state.
- Hindi moral: माँ का नियमित स्मरण भक्ति और लगन की प्रेरणा देता है।
अपने दिन में प्रार्थना और अच्छे काम के लिए समय रखें।
- English moral: Remembering Maa regularly inspires devotion and dedication.
Make time each day for prayer and a kind action.

### Entry 41 — PDF page 46

देवीदास शरण निज जानी।  
करहु कृपा जगदम्ब भवानी॥

- Hindi meaning: हे माँ जगदम्बा भवानी, देवीदास आपकी शरण में हैं।
उन्हें अपना मानकर उन पर कृपा कीजिए।
- English meaning: O Mother Jagadamba Bhavani, Devidas seeks your shelter. Accept him as your own and bless him with your grace.
- Hindi moral: देवीदास माँ से विनम्रता और विश्वास के साथ कृपा माँगते हैं।
हम भी नम्र रहें और हर दिन भलाई की ओर बढ़ें।
- English moral: Devidas asks for Maa’s kindness with humility and trust.
We too can stay humble and choose goodness each day.

## 12. Retained evidence and reuse

- `durga-v14-reference/cloud-original-soft-mask.png`: original cloud with alpha, apply drawing opacity once.
- `durga-v14-reference/english.otf`, `english-bold.ttf`, `hindi.ttf`: actual body/label font files used by v14.
- `durga-v14-reference/contact-sheet-1.jpg` through `contact-sheet-7.jpg`: overview of all 55 rendered pages, with PDF page labels.
- `durga-v14-reference/measurements.json`: PDF hash, page sizes, graphics states and extracted text. Extracted Hindi is not safe manuscript input.
- Representative original visual references: `public/templates/references/chalisa-series-v14/` in the website repository; full reviewed PDF remains canonical.

Do not describe this as automatic enforcement by itself. The renderer/worker must actually use these assets and perform the stated checks. Existing Shiva drafts require re-audit against this guide; do not bulk-delete or silently replace them. The queue was paused for this reference correction so further incorrect spreads would not accumulate.
