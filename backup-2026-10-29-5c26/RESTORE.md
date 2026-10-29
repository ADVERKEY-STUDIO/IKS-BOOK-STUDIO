# IKS Book Studio — restoration record

Snapshot date: 29 October 2026 (Asia/Kolkata). Scope: only this one worktree.

Original absolute directory: `/Users/gaurav/.codex/worktrees/5c26/IKS-Book-Studio-Local-v84`.
Source commit: `73ea47d0f3ac30987f8f647df95eb4301cf07c80`.
GitHub repository: https://github.com/ADVERKEY-STUDIO/IKS-BOOK-STUDIO
Backup branch: `codex/archive-5c26-2026-10-29`.

## Contents and limits

The ZIP preserves all 392 project files, including hidden configuration templates, artwork, scripts, tests and retained output. `manifest.json` records each original absolute path, SHA-256 checksum, byte count and Unix permissions. The ZIP passed CRC and individual SHA-256 verification before upload.

The `.git` file was a pointer to the main checkout's Git metadata, not application content. Its original contents are recorded in the manifest. Do not restore this stale pointer. Git history remains in the GitHub repository and in the other local checkout. No other worktree is included or scheduled for deletion.

No ignored/untracked project files, `.dev.vars`, `.env` files, installed dependencies, or local runtime database were present in this folder. Hosted D1 records, R2 uploads, external account settings and credentials are not in this backup. Obtain those from their existing services if needed. The application has not been run as part of this backup; file restoration is verified, but future availability of services cannot be guaranteed.

## Restore

1. Download the ZIP, `manifest.json`, and `SHA256SUMS` from this backup directory on GitHub into one folder.
2. Verify the download: `shasum -a 256 -c SHA256SUMS`.
3. Extract into a new, empty parent directory: `unzip IKS-Book-Studio-Local-v84-2026-10-29-5c26.zip`. This creates `IKS-Book-Studio-Local-v84/` with the original relative paths. Avoid overwriting a different existing copy.
4. To recreate the exact original location, use `/Users/gaurav/.codex/worktrees/5c26` as the parent only when that location is vacant. A normal folder elsewhere also works; the old `.git` pointer is intentionally omitted.
5. Use Node.js >=22.13.0. Inside the restored project run `npm ci`, then follow `LOCAL_SETUP.md` and the authentication/runtime setup in `README.md`. Create `.dev.vars` from `.dev.vars.example` and supply credentials through the documented local environment files.
6. Start with `npm run dev`. Local D1/R2 state will be initialized separately. For a macOS build, follow `LOCAL_SETUP.md` (`npx vinext build`). Verify relevant workflows after configuring external services.
7. If Git history is needed, clone the repository separately and check out source commit `73ea47d0f3ac30987f8f647df95eb4301cf07c80`. The backup branch contains the source plus this restoration package.

## File map

All paths below are relative to the original root above. Each file returns to the same relative path when extracted. Purpose descriptions combine directory role and filename with exported symbols or document headings where available; they are an index, not a line-by-line semantic audit. Keep the listed files because they belong to this exact source snapshot, even where their current runtime usage is uncertain.

| Original relative path | Purpose / why retained |
| --- | --- |
| `.dev.vars.example` | Placeholder configuration template; not real credentials |
| `.gitignore` | Rules excluding secrets and generated runtime files |
| `.npmrc` | npm installation settings |
| `.openai/hosting.json` | Hosting project metadata: hosting |
| `BOOK-INSPIRATION-RESEARCH.md` | Project reference/documentation: BOOK INSPIRATION RESEARCH Title: Book inspiration: first discovery and visual review. |
| `BOOK-STRUCTURE-IMPLEMENTATION.md` | Project reference/documentation: BOOK STRUCTURE IMPLEMENTATION Title: Book structure implementation — three phases. |
| `BOOK-STRUCTURE-RECHECK.md` | Project reference/documentation: BOOK STRUCTURE RECHECK Title: Book structure recheck and fixes — 7 September 2026. |
| `LOCAL_SETUP.md` | Local installation and runtime setup instructions Title: IKS Book Studio — Local Setup. |
| `NEXT-DEVELOPMENT-PLAN.md` | Project reference/documentation: NEXT DEVELOPMENT PLAN Title: Full next development plan — IKS Book Studio. |
| `README.md` | Project overview and usage documentation Title: IKS Book Studio. |
| `SOURCE-BOOK-FEATURES.md` | Project reference/documentation: SOURCE BOOK FEATURES Title: Source images and Sanskrit — phased implementation. |
| `app/art-direction.css` | Application pages, UI components and styling: art direction |
| `app/art-production.css` | Application pages, UI components and styling: art production |
| `app/book-inspiration.css` | Application pages, UI components and styling: book inspiration |
| `app/book-production.css` | Application pages, UI components and styling: book production |
| `app/book-review.css` | Application pages, UI components and styling: book review |
| `app/catalogue/catalogue.css` | Application pages, UI components and styling: catalogue |
| `app/catalogue/page.tsx` | Application pages, UI components and styling: page |
| `app/chatgpt-auth.ts` | Application pages, UI components and styling: chatgpt auth Exports: ChatGPTUser, getChatGPTUser, requireChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath. |
| `app/components/account-panel.css` | Application pages, UI components and styling: account panel |
| `app/components/account-panel.tsx` | Application pages, UI components and styling: account panel |
| `app/components/art-direction-workspace.tsx` | Application pages, UI components and styling: art direction workspace Exports: ArtDirectionWorkspace. |
| `app/components/art-production-workspace.tsx` | Application pages, UI components and styling: art production workspace Exports: ArtUpload, ArtProductionWorkspace. |
| `app/components/book-inspiration.tsx` | Application pages, UI components and styling: book inspiration Exports: InspirationShelf, BookInspirationGallery. |
| `app/components/book-production-workspace.tsx` | Application pages, UI components and styling: book production workspace Exports: BookProductionWorkspace. |
| `app/components/book-release-workspace.tsx` | Application pages, UI components and styling: book release workspace Exports: BookReleaseWorkspace. |
| `app/components/book-review-workspace.tsx` | Application pages, UI components and styling: book review workspace Exports: BookReviewWorkspace. |
| `app/components/catalogue-handoff.css` | Application pages, UI components and styling: catalogue handoff |
| `app/components/catalogue-handoff.tsx` | Application pages, UI components and styling: catalogue handoff |
| `app/components/edition-desk.tsx` | Application pages, UI components and styling: edition desk Exports: EditionDesk. |
| `app/components/firebase-account-panel.tsx` | Application pages, UI components and styling: firebase account panel Exports: FirebaseConfig. |
| `app/components/saved-template-library.tsx` | Application pages, UI components and styling: saved template library |
| `app/components/source-book-options.tsx` | Application pages, UI components and styling: source book options Exports: SourceBookOptions, SourceBookOptionsReview. |
| `app/components/source-book-review.tsx` | Application pages, UI components and styling: source book review Exports: SourceBookReviewPanel. |
| `app/components/spread-designer.tsx` | Application pages, UI components and styling: spread designer Exports: SpreadDesigner. |
| `app/components/storyboard-workspace.tsx` | Application pages, UI components and styling: storyboard workspace Exports: StoryboardWorkspace. |
| `app/components/template-cover-preview.tsx` | Application pages, UI components and styling: template cover preview |
| `app/components/visual-reference-workspace.tsx` | Application pages, UI components and styling: visual reference workspace Exports: ReferenceUpload, VisualReferenceWorkspace, ReferencePicture. |
| `app/edition-desk.css` | Application pages, UI components and styling: edition desk |
| `app/globals.css` | Application pages, UI components and styling: globals |
| `app/home.css` | Application pages, UI components and styling: home |
| `app/layout.tsx` | Application pages, UI components and styling: layout Exports: metadata. |
| `app/midnight/page.tsx` | Application pages, UI components and styling: page |
| `app/midnight/queue.css` | Application pages, UI components and styling: queue |
| `app/page.tsx` | Application pages, UI components and styling: page |
| `app/pilot/page.tsx` | Application pages, UI components and styling: page |
| `app/pilot/pilot.css` | Application pages, UI components and styling: pilot |
| `app/sign-in/[[...sign-in]]/page.tsx` | Application pages, UI components and styling: page |
| `app/sign-up/[[...sign-up]]/page.tsx` | Application pages, UI components and styling: page |
| `app/spread-designer.css` | Application pages, UI components and styling: spread designer |
| `app/storyboard.css` | Application pages, UI components and styling: storyboard |
| `app/template-studio/approved-chalisa-samples.tsx` | Application pages, UI components and styling: approved chalisa samples |
| `app/template-studio/book-sections-editor.tsx` | Application pages, UI components and styling: book sections editor |
| `app/template-studio/chalisa-edition-picker.tsx` | Application pages, UI components and styling: chalisa edition picker |
| `app/template-studio/chalisa-page-editor.tsx` | Application pages, UI components and styling: chalisa page editor |
| `app/template-studio/chatgpt-handoff.tsx` | Application pages, UI components and styling: chatgpt handoff |
| `app/template-studio/children-gallery.tsx` | Application pages, UI components and styling: children gallery |
| `app/template-studio/completion-editor.tsx` | Application pages, UI components and styling: completion editor |
| `app/template-studio/editor-tools.tsx` | Application pages, UI components and styling: editor tools Exports: EditorTools, ToolPanel. |
| `app/template-studio/glossary-editor.tsx` | Application pages, UI components and styling: glossary editor |
| `app/template-studio/layout-review.tsx` | Application pages, UI components and styling: layout review Exports: BookSpreadPreview, LayoutDiagram. |
| `app/template-studio/literary-gallery.tsx` | Application pages, UI components and styling: literary gallery |
| `app/template-studio/notes-gallery.tsx` | Application pages, UI components and styling: notes gallery |
| `app/template-studio/page.tsx` | Application pages, UI components and styling: page |
| `app/template-studio/studio.css` | Application pages, UI components and styling: studio |
| `app/template-studio/template-layout-samples.tsx` | Application pages, UI components and styling: template layout samples |
| `app/template-studio/text-background-editor.tsx` | Application pages, UI components and styling: text background editor |
| `app/template-studio/text-placement-editor.tsx` | Application pages, UI components and styling: text placement editor |
| `app/template-studio/typography-editor.tsx` | Application pages, UI components and styling: typography editor |
| `app/visual-references.css` | Application pages, UI components and styling: visual references |
| `build/sites-vite-plugin.ts` | Build integration source: sites vite plugin Exports: sites. |
| `db/index.ts` | Database schema and access layer: index Exports: getDb. |
| `db/schema.ts` | Database schema and access layer: schema Exports: projects, projectVersions, designerPreferences. |
| `docs/book-inspiration-gallery.md` | Project documentation: book inspiration gallery Title: Book inspiration gallery. |
| `docs/design/handwritten-notebook-fidelity.md` | Project documentation: handwritten notebook fidelity Title: Handwritten notebook reference study. |
| `docs/development/EMAIL-LIBRARY.md` | Project documentation: EMAIL LIBRARY Title: Clerk accounts and shared books. |
| `docs/development/PHASE-A-COMPLETED.md` | Project documentation: PHASE A COMPLETED Title: Phase A — Edition setup and protected content. |
| `docs/development/PHASE-B-COMPLETED.md` | Project documentation: PHASE B COMPLETED Title: Phase B — Art-direction workspace. |
| `docs/development/PHASE-C-COMPLETED.md` | Project documentation: PHASE C COMPLETED Title: Phase C — Character and visual continuity. |
| `docs/development/PHASE-D-COMPLETED.md` | Project documentation: PHASE D COMPLETED Title: Phase D — Whole-book storyboard. |
| `docs/development/PHASE-E-COMPLETED.md` | Project documentation: PHASE E COMPLETED Title: Phase E — Dedicated spread compositor. |
| `docs/development/PHASE-F-IMPORTS-COMPLETED.md` | Project documentation: PHASE F IMPORTS COMPLETED Title: Phase F — Artwork imports and revision review. |
| `docs/development/PHASE-G-PILOT-BRIEF.md` | Project documentation: PHASE G PILOT BRIEF Title: Phase G — Three-spread pilot brief. |
| `docs/development/PHASE-G-REVIEW-READY.md` | Project documentation: PHASE G REVIEW READY Title: Phase G — Three review studies ready. |
| `docs/development/PHASE-H-WORKSPACE-COMPLETED.md` | Project documentation: PHASE H WORKSPACE COMPLETED Title: Phase H — Full-book production workspace. |
| `docs/development/PHASE-I-WORKSPACE-COMPLETED.md` | Project documentation: PHASE I WORKSPACE COMPLETED Title: Phase I — Editorial, visual, and print review workspace. |
| `docs/development/PHASE-J-EXPORT-AND-RESTORE.md` | Project documentation: PHASE J EXPORT AND RESTORE Title: Phase J — export and restore workspace. |
| `docs/development/REVIEW-A-THROUGH-D.md` | Project documentation: REVIEW A THROUGH D Title: Development audit — Phases A through D. |
| `docs/development/TEMPLATE-BOOK-WORKFLOW.md` | Project documentation: TEMPLATE BOOK WORKFLOW Title: Template book workflow. |
| `docs/development/TEMPLATE-FIDELITY.md` | Project documentation: TEMPLATE FIDELITY Title: Template fidelity and varied spread layouts. |
| `docs/development/saved-book-reliability.md` | Project documentation: saved book reliability Title: Saved book reliability. |
| `docs/research/book-inspiration-candidates.md` | Project documentation: book inspiration candidates Title: Real published book candidates for the inspiration gallery. |
| `docs/research/phase-g-gita-sources.md` | Project documentation: phase g gita sources Title: Phase G: Bhagavad Gita pilot sources. |
| `docs/research/unique-book-template-references.md` | Project documentation: unique book template references Title: Distinctive book template references. |
| `drizzle/0000_fixed_whiplash.sql` | Database migration history: 0000 fixed whiplash |
| `drizzle/0001_thick_tag.sql` | Database migration history: 0001 thick tag |
| `drizzle/meta/0000_snapshot.json` | Database migration history: 0000 snapshot |
| `drizzle/meta/0001_snapshot.json` | Database migration history: 0001 snapshot |
| `drizzle/meta/_journal.json` | Database migration history:  journal |
| `drizzle.config.ts` | Database migration tooling configuration |
| `eslint.config.mjs` | Static code-checking configuration |
| `examples/d1/app/api/notes/route.ts` | Example input or workflow reference: route Exports: GET, POST. |
| `examples/d1/db/schema.ts` | Example input or workflow reference: schema Exports: notes. |
| `lib/adaptation-pages.ts` | Reusable book-processing and application logic: adaptation pages Exports: ADAPTATION_PLAN_VERSION, TOTAL_BOOK_PAGE_LIMIT, FIXED_MATTER_PAGES, CHAPTER_PAGE_BUDGET, AdaptationPageInputs, recommendedAdaptationPages, allocatePagesWithinBudget. |
| `lib/art-direction.ts` | Reusable book-processing and application logic: art direction Exports: guideTextFields, guideLayers, ArtGuide, GuideVersion, ArtDirection, guideContext, latestGuide, guideStatus. |
| `lib/art-production.ts` | Reusable book-processing and application logic: art production Exports: ArtRequest, ArtVersion, SpreadArt, ArtProduction, ProductionAction, artContext, approvedArt, artStatus. |
| `lib/book-backup.ts` | Reusable book-processing and application logic: book backup Exports: BACKUP_LIMIT, BackupManifest, digest, backupKeys, restoredEdition. |
| `lib/book-completion.ts` | Reusable book-processing and application logic: book completion Exports: BookCompletion, defaultBookCompletion, parseBookCompletion, bookArtworkFiles, coverArtworkPrompt, bookCompletionPrompt, renderBookCompletion, bookCompletionCss. |
| `lib/book-export.ts` | Reusable book-processing and application logic: book export Exports: ExportMode, bookExportIssues, bookPageSequence, bookDocument. |
| `lib/book-format.ts` | Reusable book-processing and application logic: book format Exports: BookFormatId, BookFormatDefinition, DEFAULT_NEW_BOOK_FORMAT, LEGACY_BOOK_FORMAT, BOOK_SCREEN_PX_PER_MM, BOOK_FORMATS, isBookFormatId, bookFormat. |
| `lib/book-glossary.ts` | Reusable book-processing and application logic: book glossary Exports: GlossaryEntry, parseBookGlossary, renderBookGlossary, glossaryMarkdown, bookGlossaryCss. |
| `lib/book-illustrations.ts` | Reusable book-processing and application logic: book illustrations Exports: BookIllustration, placeBookIllustrations. |
| `lib/book-inspiration.ts` | Reusable book-processing and application logic: book inspiration Exports: inspirationAspects, InspirationAspect, BookInspiration, InspirationBook, inspirationBooks, inspirationBook, normalizeInspiration, inspirationBrief. |
| `lib/book-layout.ts` | Reusable book-processing and application logic: book layout Exports: measureBookContent, pageFlowHtml, refreshBookPageNumbers, splitFlowBlock, paginateFlowBlocks, flowManifest, assertFlowPreserved, inspectBookPage. |
| `lib/book-package.ts` | Reusable book-processing and application logic: book package Exports: BOOK_PACKAGE_FORMAT, BookPackageImage, BookPackagePage, BookPackageChapter, BookPackage, PlannedChapter, BookPackageValidation, expectedChapterId. |
| `lib/book-persona.ts` | Reusable book-processing and application logic: book persona Exports: BookPersonaId, BookPersona, BOOK_PERSONA_VERSION, bookPersonaDefinitions, personaById, materializePersona, inferBookPersona, bookPersonaPatch. |
| `lib/book-production.ts` | Reusable book-processing and application logic: book production Exports: productionStates, ProductionState, bookPartRoles, BookPartRole, ProductionBatch, ProductionReview, PrinterCover, BookProduction. |
| `lib/book-raster.ts` | Reusable book-processing and application logic: book raster Exports: renderBookPageCanvas. |
| `lib/book-review.ts` | Reusable book-processing and application logic: book review Exports: ReviewTarget, ReviewFinding, humanReviewCategories, HumanReviewCategory, renderCodes, RenderProblem, RenderResult, BookReview. |
| `lib/book-sections.ts` | Reusable book-processing and application logic: book sections Exports: BookSection, parseBookSections, sectionColumns, renderBookSections, bookSectionsMarkdown, bookSectionsCss. |
| `lib/book-typography.ts` | Reusable book-processing and application logic: book typography Exports: BookTypography, parseBookTypography, bookTypographyCss. |
| `lib/canva-export.ts` | Reusable book-processing and application logic: canva export Exports: captureCanvaPage, exportCanvaBook. |
| `lib/canva-presentation.ts` | Reusable book-processing and application logic: canva presentation Exports: CanvaBox, CanvaTextRun, CanvaElement, CanvaPage, buildCanvaPresentation. |
| `lib/catalogue-pdf-download.ts` | Reusable book-processing and application logic: catalogue pdf download Exports: cataloguePdfDownload. |
| `lib/catalogue-source.ts` | Reusable book-processing and application logic: catalogue source Exports: CatalogueSource, selectedCategoryGroups, prepareCataloguePdf. |
| `lib/chalisa-approved-references.ts` | Reusable book-processing and application logic: chalisa approved references Exports: approvedChalisaSpreads, approvedChalisaReferenceRoot, approvedChalisaReferencePrompt. |
| `lib/chalisa-editions.ts` | Reusable book-processing and application logic: chalisa editions Exports: chalisaEditions, ChalisaEditionId, parseChalisaEdition, chalisaEdition, chalisaSeriesReferenceRoot, chalisaSeriesReferences, chalisaSeriesMasterPrompt, chalisaEditionPrompt. |
| `lib/chalisa-pages.ts` | Reusable book-processing and application logic: chalisa pages Exports: LEGACY_CHALISA_BLUEPRINT, DIAGONAL_CHALISA_BLUEPRINT, CHALISA_BLUEPRINT, CHALISA_FULL_SPREAD_IDS, CHALISA_SINGLE_BLUEPRINT, CHALISA_SINGLE_IDS, isSingleChalisa, isFullSpreadChalisa. |
| `lib/chalisa-publisher-review.ts` | Reusable book-processing and application logic: chalisa publisher review Exports: chalisaPublisherReviewPrompt. |
| `lib/chatgpt-handoff.ts` | Reusable book-processing and application logic: chatgpt handoff Exports: draftStep, sampleNames, canApproveSample, analysisPrompt, samplePrompt, chapterPrompt, handoffEntries. |
| `lib/child-summary.ts` | Reusable book-processing and application logic: child summary Exports: ChildAgeBand, childAgeBand, generationProfileKey, AUTHORIAL_READER_INSTRUCTION, readerFacingChapterTitle, authorialReaderHtml, adaptEvidenceForAge, ageEvidenceOrder. |
| `lib/children-templates.ts` | Reusable book-processing and application logic: children templates Exports: childrenTemplates, isChildrenTemplate. |
| `lib/create-gita-pilot-draft.ts` | Reusable book-processing and application logic: create gita pilot draft Exports: createGitaPilotDraft. |
| `lib/devotional-edition.ts` | Reusable book-processing and application logic: devotional edition Exports: editionTypes, editionAudiences, passageFields, PassageField, Provenance, EditorialField, PassageSnapshot, Passage. |
| `lib/external-manuscript.ts` | Reusable book-processing and application logic: external manuscript Exports: ExternalManuscriptSettings, ExternalManuscriptSection, ExternalManuscriptResult, ExternalIllustrationSlot, ExternalIllustrationPromptProject, ExternalIllustrationArchiveEntry, ExternalIllustrationArchiveMatch, ExternalIllustrationArchiveResult. |
| `lib/font-coverage.ts` | Reusable book-processing and application logic: font coverage Exports: PROOF_FONT_SHA256, fontCoverage, missingGlyphs. |
| `lib/gita-pilot.ts` | Reusable book-processing and application logic: gita pilot Exports: pilotStudies, pilotCredits, pilotAssets, gitaPilot. |
| `lib/iks-catalogue-seed.json` | Reusable book-processing and application logic: iks catalogue seed |
| `lib/iks-catalogue-storage.ts` | Reusable book-processing and application logic: iks catalogue storage Exports: catalogueStorage. |
| `lib/iks-catalogue.ts` | Reusable book-processing and application logic: iks catalogue Exports: kidsCategories, readerAges, CatalogueBook, ContentCard, CatalogueState, webUrl, selectionPack, mergeCatalogue. |
| `lib/iks-content-seed.json` | Reusable book-processing and application logic: iks content seed |
| `lib/illustration-batching.ts` | Reusable book-processing and application logic: illustration batching Exports: illustrationBatchPrompt. |
| `lib/image-first-book.ts` | Reusable book-processing and application logic: image first book Exports: createImageFirstBook, imageDevelopmentPrompt. |
| `lib/literary-templates.ts` | Reusable book-processing and application logic: literary templates Exports: literaryTemplates, literaryReferenceUrl, isLiteraryTemplate, literaryCover, literaryCss. |
| `lib/manuscript-import.ts` | Reusable book-processing and application logic: manuscript import Exports: ManuscriptInspection, inspectManuscript, inspectManuscriptArchive, manuscriptRepairRequest. |
| `lib/midnight-queue.ts` | Reusable book-processing and application logic: midnight queue Exports: editions, Edition, stages, Job, Artifact, Queue, seedQueue, inNight. |
| `lib/notebook-content.ts` | Reusable book-processing and application logic: notebook content Exports: NoteSection, parseNoteSections, notebookOriginal. |
| `lib/notebook-prompt.ts` | Reusable book-processing and application logic: notebook prompt Exports: notebookRelevancePrompt, notebookArtworkRequest, notebookBookPrompt, notebookDesignPrompt. |
| `lib/notebook-settings.ts` | Reusable book-processing and application logic: notebook settings Exports: parseNotebookPageCount, notebookPageCountPrompt. |
| `lib/pedagogy.ts` | Reusable book-processing and application logic: pedagogy Exports: TeachingVocabulary, TeachingSection, TeachingChapter, ChapterBlueprint, chapterBlueprintSchema, PedagogyScores, PedagogyQuality, ChapterEvaluation. |
| `lib/publication.ts` | Reusable book-processing and application logic: publication Exports: PublicationChapter, ContentsEntry, PublicationBlocker, pdfRasterSettings, chapterRequiresIllustration, sanitizeReaderHtml, readerSafeImageCaption, sanitizeReaderImageHtml. |
| `lib/render-book-review.ts` | Reusable book-processing and application logic: render book review Exports: renderBookReview. |
| `lib/series-art.ts` | Reusable book-processing and application logic: series art Exports: characterStyles, CharacterOption, SeriesArt, seriesReferenceName, characterOptionName, isSeriesReference, MAX_STYLE_REFERENCES, parseSeriesArt. |
| `lib/source-book-options.ts` | Reusable book-processing and application logic: source book options Exports: sourceImageModes, imageEnhancements, sourceImageStyles, SourceImageStyle, SourceBookOptions, normalizeSourceBookOptions. |
| `lib/source-book-package.ts` | Reusable book-processing and application logic: source book package Exports: SOURCE_PACKAGE_FORMAT, SourceImage, SourceVerse, SourceBookManifest, SourceArchiveAsset, parseSourceBookManifest, attachSourceBookManifest, sourceImageSlots. |
| `lib/source-book-review.ts` | Reusable book-processing and application logic: source book review Exports: SourceBookReview, SourceReviewProject, normalizeVerseText, compareSourceVerse, sourceImageSignature, sourceVerseSignature, sourceReviewIssues, inspectRenderedSourceVerses. |
| `lib/source-intelligence.ts` | Reusable book-processing and application logic: source intelligence Exports: SourceKind, SourceIntelligenceStatus, OutlineMode, SourceOutlineItem, SourceIntelligence, SAFE_OCR_CHUNK_BYTES, SAFE_OCR_CHUNK_PAGES, recoverOcrPageTexts. |
| `lib/spread-composition.ts` | Reusable book-processing and application logic: spread composition Exports: PrintFormat, CompositionLayer, SpreadComposition, CompositionAction, defaultPrintFormat, compositionFormat, layerDefaults, initialComposition. |
| `lib/story-compositions.ts` | Reusable book-processing and application logic: story compositions Exports: storyCompositions, StoryComposition, storySequence, storyCompositionAt, storyCompositionPrompt, splitStoryText, storyTextBlocks, storyCompositionCss. |
| `lib/story-text-placement.ts` | Reusable book-processing and application logic: story text placement Exports: placeStoryText, autoPlaceStoryBook. |
| `lib/storyboard.ts` | Reusable book-processing and application logic: storyboard Exports: compositionFamilies, pageKinds, Allocation, SpreadPlan, StoryboardAction, PageAssignment, blankSpread, storyboardPages. |
| `lib/template-archive.ts` | Reusable book-processing and application logic: template archive Exports: readTemplateArchive. |
| `lib/template-backup.ts` | Reusable book-processing and application logic: template backup Exports: accountSaveQueue, recoverDraftImages, recoverAccountImages. |
| `lib/template-book.ts` | Reusable book-processing and application logic: template book Exports: templates, templateAppearanceCss, TemplateId, selectableTemplates, layouts, Layout, templateLayout, templateDesign. |
| `lib/template-capacity.ts` | Reusable book-processing and application logic: template capacity Exports: MiB, BOOK_ARTWORK_BYTES, IMAGE_BYTES, ARCHIVE_BYTES, UNPACKED_BYTES, validateBookArtwork, SOURCE_BYTES, validateSourceFile. |
| `lib/template-export-fonts.ts` | Reusable book-processing and application logic: template export fonts Exports: prepareExportFont. |
| `lib/template-layout-sample.ts` | Reusable book-processing and application logic: template layout sample Exports: sampleArtwork, renderLayoutSample. |
| `lib/template-layouts.ts` | Reusable book-processing and application logic: template layouts Exports: TEMPLATE_REVISION, Region, Blueprint, blueprints, legacyChalisaBlueprint, diagonalChalisaBlueprint, chalisaFullSpreadBlueprints, chalisaBlueprint. |
| `lib/template-library.ts` | Reusable book-processing and application logic: template library Exports: LibraryBook, templateLibrary. |
| `lib/template-reference-assets.ts` | Reusable book-processing and application logic: template reference assets Exports: referenceAssets. |
| `lib/template-reference-contracts.ts` | Reusable book-processing and application logic: template reference contracts Exports: ReferenceContract, referenceContracts, legacyNotebookLayouts, referenceCoverage, referenceStylePrompt, referencePalette. |
| `lib/template-reference-package.ts` | Reusable book-processing and application logic: template reference package Exports: templateReferenceEntries. |
| `lib/template-sample.ts` | Reusable book-processing and application logic: template sample Exports: templateSample, renderTemplateSample. |
| `lib/template-save.ts` | Reusable book-processing and application logic: template save Exports: saveWithFallback, browserSaveError. |
| `lib/template-signatures.ts` | Reusable book-processing and application logic: template signatures Exports: signatureBlueprints. |
| `lib/template-storage.ts` | Reusable book-processing and application logic: template storage Exports: Draft, requestPersistentStorage, storage, CloudBook, cloudRequest, uploadDraft, downloadDraft. |
| `lib/text-backgrounds.ts` | Reusable book-processing and application logic: text backgrounds Exports: textBackgroundShapes, TextBackground, TextBackgrounds, parseTextBackgrounds, textBackgroundStyle, textBackgroundCss, applyTextBackgroundsToPages. |
| `lib/text-placement.ts` | Reusable book-processing and application logic: text placement Exports: parseTextPositions, moveTextBox, fitTextPositions. |
| `lib/visual-direction.ts` | Reusable book-processing and application logic: visual direction Exports: VisualDirection, parseVisualDirection, sourceBookPrompt, sourceRequestEntries, chalisaTemplateDirection, chalisaPrompt, validateChalisaBook, chalisaAstraPrompt. |
| `lib/visual-references.ts` | Reusable book-processing and application logic: visual references Exports: referenceKinds, referenceViews, referenceSpecFields, ReferenceSpec, ReferenceImage, ReferenceVersion, VisualReference, ReferenceAction. |
| `next.config.ts` | Next.js framework settings |
| `output/pdf/iks-book-studio-workflow-map.pdf` | Saved output/reference artifact: iks book studio workflow map |
| `package-lock.json` | Exact dependency resolution for reproducible npm installs |
| `package.json` | Dependency requirements and npm commands |
| `postcss.config.mjs` | CSS processing configuration |
| `proxy.ts` | Request middleware and authentication routing Exports: config. |
| `public/favicon.svg` | Static artwork or browser-served asset: favicon |
| `public/file.svg` | Static artwork or browser-served asset: file |
| `public/fonts/OFL-NotoSansDevanagari.txt` | Static artwork or browser-served asset: OFL NotoSansDevanagari |
| `public/fonts/OFL-NotoSerifDevanagari.txt` | Static artwork or browser-served asset: OFL NotoSerifDevanagari |
| `public/fonts/OFL-PatrickHand.txt` | Static artwork or browser-served asset: OFL PatrickHand |
| `public/fonts/book-hand.ttf` | Static artwork or browser-served asset: book hand |
| `public/fonts/book-sans.ttf` | Static artwork or browser-served asset: book sans |
| `public/fonts/book-sanskrit.ttf` | Static artwork or browser-served asset: book sanskrit |
| `public/globe.svg` | Static artwork or browser-served asset: globe |
| `public/illustrations/concept-indian-aesthetics.webp` | Static artwork or browser-served asset: concept indian aesthetics |
| `public/illustrations/dhvani-poetics.png` | Static artwork or browser-served asset: dhvani poetics |
| `public/illustrations/natya-performance.png` | Static artwork or browser-served asset: natya performance |
| `public/illustrations/origin-and-concept.webp` | Static artwork or browser-served asset: origin and concept |
| `public/illustrations/rasa-bhava.png` | Static artwork or browser-served asset: rasa bhava |
| `public/illustrations/structure-and-design.webp` | Static artwork or browser-served asset: structure and design |
| `public/pilot/gita/composite.jpg` | Static artwork or browser-served asset: composite |
| `public/pilot/gita/credits.json` | Static artwork or browser-served asset: credits |
| `public/pilot/gita/journey.jpg` | Static artwork or browser-served asset: journey |
| `public/pilot/gita/lamp.jpg` | Static artwork or browser-served asset: lamp |
| `public/templates/living-atlas.png` | Static artwork or browser-served asset: living atlas |
| `public/templates/references/ATTRIBUTION.json` | Static artwork or browser-served asset: ATTRIBUTION |
| `public/templates/references/beanstalk-adventure-1.webp` | Static artwork or browser-served asset: beanstalk adventure 1 |
| `public/templates/references/beanstalk-adventure-2.webp` | Static artwork or browser-served asset: beanstalk adventure 2 |
| `public/templates/references/beanstalk-adventure-3.webp` | Static artwork or browser-served asset: beanstalk adventure 3 |
| `public/templates/references/beanstalk-adventure-4.webp` | Static artwork or browser-served asset: beanstalk adventure 4 |
| `public/templates/references/bedtime-play-1.webp` | Static artwork or browser-served asset: bedtime play 1 |
| `public/templates/references/bedtime-play-2.webp` | Static artwork or browser-served asset: bedtime play 2 |
| `public/templates/references/bedtime-play-3.webp` | Static artwork or browser-served asset: bedtime play 3 |
| `public/templates/references/bedtime-skies-1.webp` | Static artwork or browser-served asset: bedtime skies 1 |
| `public/templates/references/bedtime-skies-2.webp` | Static artwork or browser-served asset: bedtime skies 2 |
| `public/templates/references/bedtime-skies-3.webp` | Static artwork or browser-served asset: bedtime skies 3 |
| `public/templates/references/chalisa-approved/approved-compassion-art.png` | Static artwork or browser-served asset: approved compassion art |
| `public/templates/references/chalisa-approved/approved-compassion-spread.png` | Static artwork or browser-served asset: approved compassion spread |
| `public/templates/references/chalisa-approved/approved-gauri-art.png` | Static artwork or browser-served asset: approved gauri art |
| `public/templates/references/chalisa-approved/approved-gauri-spread.png` | Static artwork or browser-served asset: approved gauri spread |
| `public/templates/references/chalisa-approved/approved-lakshmi-art.png` | Static artwork or browser-served asset: approved lakshmi art |
| `public/templates/references/chalisa-approved/approved-lakshmi-spread.png` | Static artwork or browser-served asset: approved lakshmi spread |
| `public/templates/references/chalisa-approved/cloud-left.png` | Static artwork or browser-served asset: cloud left |
| `public/templates/references/chalisa-approved/cloud-right.png` | Static artwork or browser-served asset: cloud right |
| `public/templates/references/chalisa-series-v14/DURGA-V14-MASTER-REFERENCE.md` | Static artwork or browser-served asset: DURGA V14 MASTER REFERENCE Title: Durga v14 — master reference for future Chalisa books. |
| `public/templates/references/chalisa-series-v14/REFERENCE-STUDY.txt` | Static artwork or browser-served asset: REFERENCE STUDY |
| `public/templates/references/chalisa-series-v14/back-cover.jpg` | Static artwork or browser-served asset: back cover |
| `public/templates/references/chalisa-series-v14/cloud-original-soft-mask.png` | Static artwork or browser-served asset: cloud original soft mask |
| `public/templates/references/chalisa-series-v14/compassion-spread.jpg` | Static artwork or browser-served asset: compassion spread |
| `public/templates/references/chalisa-series-v14/courage-spread.jpg` | Static artwork or browser-served asset: courage spread |
| `public/templates/references/chalisa-series-v14/devotion-spread.jpg` | Static artwork or browser-served asset: devotion spread |
| `public/templates/references/chalisa-series-v14/editorial-examples.json` | Static artwork or browser-served asset: editorial examples |
| `public/templates/references/chalisa-series-v14/front-cover.jpg` | Static artwork or browser-served asset: front cover |
| `public/templates/references/chalisa-series-v14/glossary.jpg` | Static artwork or browser-served asset: glossary |
| `public/templates/references/chalisa-series-v14/how-to-read.jpg` | Static artwork or browser-served asset: how to read |
| `public/templates/references/chalisa-series-v14/introduction.jpg` | Static artwork or browser-served asset: introduction |
| `public/templates/references/chalisa-series-v14/many-forms-spread.jpg` | Static artwork or browser-served asset: many forms spread |
| `public/templates/references/chalisa-series-v14/provenance.json` | Static artwork or browser-served asset: provenance |
| `public/templates/references/chalisa-series-v14/saraswati-spread.jpg` | Static artwork or browser-served asset: saraswati spread |
| `public/templates/references/chalisa-series-v14/shiva-spread.jpg` | Static artwork or browser-served asset: shiva spread |
| `public/templates/references/chalisa-series-v14/title-page.jpg` | Static artwork or browser-served asset: title page |
| `public/templates/references/chalisa-series-v14/vishnu-lakshmi-spread.jpg` | Static artwork or browser-served asset: vishnu lakshmi spread |
| `public/templates/references/colourful-journey-1.webp` | Static artwork or browser-served asset: colourful journey 1 |
| `public/templates/references/colourful-journey-2.webp` | Static artwork or browser-served asset: colourful journey 2 |
| `public/templates/references/colourful-journey-3.webp` | Static artwork or browser-served asset: colourful journey 3 |
| `public/templates/references/flower-festival-1.webp` | Static artwork or browser-served asset: flower festival 1 |
| `public/templates/references/flower-festival-2.webp` | Static artwork or browser-served asset: flower festival 2 |
| `public/templates/references/flower-festival-3.webp` | Static artwork or browser-served asset: flower festival 3 |
| `public/templates/references/flower-festival-4.webp` | Static artwork or browser-served asset: flower festival 4 |
| `public/templates/references/iks-notes/reference-1.jpg` | Static artwork or browser-served asset: reference 1 |
| `public/templates/references/iks-notes/reference-2.jpg` | Static artwork or browser-served asset: reference 2 |
| `public/templates/references/little-explorers-1.webp` | Static artwork or browser-served asset: little explorers 1 |
| `public/templates/references/little-explorers-2.webp` | Static artwork or browser-served asset: little explorers 2 |
| `public/templates/references/painted-memories-1.webp` | Static artwork or browser-served asset: painted memories 1 |
| `public/templates/references/painted-memories-2.webp` | Static artwork or browser-served asset: painted memories 2 |
| `public/templates/references/painted-memories-3.webp` | Static artwork or browser-served asset: painted memories 3 |
| `public/templates/references/paper-play-1.jpg` | Static artwork or browser-served asset: paper play 1 |
| `public/templates/references/snowy-friends-1.webp` | Static artwork or browser-served asset: snowy friends 1 |
| `public/templates/references/snowy-friends-2.webp` | Static artwork or browser-served asset: snowy friends 2 |
| `public/templates/references/snowy-friends-3.webp` | Static artwork or browser-served asset: snowy friends 3 |
| `public/templates/references/treehouse-days-1.webp` | Static artwork or browser-served asset: treehouse days 1 |
| `public/templates/references/treehouse-days-2.webp` | Static artwork or browser-served asset: treehouse days 2 |
| `public/templates/references/treehouse-days-3.webp` | Static artwork or browser-served asset: treehouse days 3 |
| `public/window.svg` | Static artwork or browser-served asset: window |
| `scripts/build-verified.sh` | Development, build or validation automation: build verified |
| `scripts/install-ci.sh` | Development, build or validation automation: install ci |
| `scripts/midnight-client.mjs` | Development, build or validation automation: midnight client |
| `scripts/sites-env.sh` | Development, build or validation automation: sites env |
| `scripts/validate-artifact.sh` | Development, build or validation automation: validate artifact |
| `scripts/verify-account-backup.mjs` | Development, build or validation automation: verify account backup |
| `scripts/verify-art-direction-api.py` | Development, build or validation automation: verify art direction api |
| `scripts/verify-art-production-api.py` | Development, build or validation automation: verify art production api |
| `scripts/verify-as-is-download.mjs` | Development, build or validation automation: verify as is download |
| `scripts/verify-book-persistence.mjs` | Development, build or validation automation: verify book persistence |
| `scripts/verify-book-production-api.py` | Development, build or validation automation: verify book production api |
| `scripts/verify-book-release-api.py` | Development, build or validation automation: verify book release api |
| `scripts/verify-book-review-api.py` | Development, build or validation automation: verify book review api |
| `scripts/verify-cloud-signin.sh` | Development, build or validation automation: verify cloud signin |
| `scripts/verify-composition-api.py` | Development, build or validation automation: verify composition api |
| `scripts/verify-edition-api.py` | Development, build or validation automation: verify edition api |
| `scripts/verify-notebook-fidelity.mjs` | Development, build or validation automation: verify notebook fidelity |
| `scripts/verify-notebook-settings.mjs` | Development, build or validation automation: verify notebook settings |
| `scripts/verify-reference-samples.mjs` | Development, build or validation automation: verify reference samples |
| `scripts/verify-storyboard-api.py` | Development, build or validation automation: verify storyboard api |
| `scripts/verify-template-layouts.mjs` | Development, build or validation automation: verify template layouts |
| `scripts/verify-text-fit.mjs` | Development, build or validation automation: verify text fit |
| `scripts/verify-visual-reference-api.py` | Development, build or validation automation: verify visual reference api |
| `tests/adaptation-page-planning.test.mjs` | Regression or workflow verification: adaptation page planning.test |
| `tests/art-direction.test.mjs` | Regression or workflow verification: art direction.test |
| `tests/art-production.test.mjs` | Regression or workflow verification: art production.test |
| `tests/authorial-reader-workflow.test.mjs` | Regression or workflow verification: authorial reader workflow.test |
| `tests/book-borders.test.mjs` | Regression or workflow verification: book borders.test |
| `tests/book-completion.test.mjs` | Regression or workflow verification: book completion.test |
| `tests/book-export.test.mjs` | Regression or workflow verification: book export.test |
| `tests/book-format.test.mjs` | Regression or workflow verification: book format.test |
| `tests/book-inspiration.test.mjs` | Regression or workflow verification: book inspiration.test |
| `tests/book-package-import.test.mjs` | Regression or workflow verification: book package import.test |
| `tests/book-persona.test.mjs` | Regression or workflow verification: book persona.test |
| `tests/book-production.test.mjs` | Regression or workflow verification: book production.test |
| `tests/book-review.test.mjs` | Regression or workflow verification: book review.test |
| `tests/book-typography.test.mjs` | Regression or workflow verification: book typography.test |
| `tests/browser/book-import.test.mjs` | Regression or workflow verification: book import.test |
| `tests/browser/book-layout.test.mjs` | Regression or workflow verification: book layout.test |
| `tests/browser/book-raster.test.mjs` | Regression or workflow verification: book raster.test |
| `tests/browser/book-regressions.test.mjs` | Regression or workflow verification: book regressions.test |
| `tests/browser/book-workflow.test.mjs` | Regression or workflow verification: book workflow.test |
| `tests/browser/chalisa-single-spread.test.mjs` | Regression or workflow verification: chalisa single spread.test |
| `tests/browser/chalisa-workflow.test.mjs` | Regression or workflow verification: chalisa workflow.test |
| `tests/browser/chatgpt-handoff.test.mjs` | Regression or workflow verification: chatgpt handoff.test |
| `tests/browser/image-first-book.test.mjs` | Regression or workflow verification: image first book.test |
| `tests/browser/notebook-mode.test.mjs` | Regression or workflow verification: notebook mode.test |
| `tests/browser/story-text-placement.test.mjs` | Regression or workflow verification: story text placement.test |
| `tests/browser/visual-direction.test.mjs` | Regression or workflow verification: visual direction.test |
| `tests/canva-presentation.test.mjs` | Regression or workflow verification: canva presentation.test |
| `tests/catalogue-handoff.test.mjs` | Regression or workflow verification: catalogue handoff.test |
| `tests/chalisa-astra.test.mjs` | Regression or workflow verification: chalisa astra.test |
| `tests/chalisa-editions.test.mjs` | Regression or workflow verification: chalisa editions.test |
| `tests/chalisa-editorial.test.mjs` | Regression or workflow verification: chalisa editorial.test |
| `tests/chalisa-facing-pages.test.mjs` | Regression or workflow verification: chalisa facing pages.test |
| `tests/chalisa-publisher-review.test.mjs` | Regression or workflow verification: chalisa publisher review.test |
| `tests/chalisa-single-spread.test.mjs` | Regression or workflow verification: chalisa single spread.test |
| `tests/chalisa.test.mjs` | Regression or workflow verification: chalisa.test |
| `tests/chapter-illustrations.test.mjs` | Regression or workflow verification: chapter illustrations.test |
| `tests/chatgpt-handoff.test.mjs` | Regression or workflow verification: chatgpt handoff.test |
| `tests/children-first-workflow.test.mjs` | Regression or workflow verification: children first workflow.test |
| `tests/clerk-identity.test.mjs` | Regression or workflow verification: clerk identity.test |
| `tests/designer-preview-parity.test.mjs` | Regression or workflow verification: designer preview parity.test |
| `tests/designer-studio.test.mjs` | Regression or workflow verification: designer studio.test |
| `tests/devotional-edition.test.mjs` | Regression or workflow verification: devotional edition.test |
| `tests/external-manuscript.test.mjs` | Regression or workflow verification: external manuscript.test |
| `tests/firebase-identity.test.mjs` | Regression or workflow verification: firebase identity.test |
| `tests/fixtures/chalisa-facing-pages.mjs` | Regression or workflow verification: chalisa facing pages Exports: leaves, facingBook. |
| `tests/fixtures/chalisa-single-spread.mjs` | Regression or workflow verification: chalisa single spread Exports: singleBook. |
| `tests/font-coverage.test.mjs` | Regression or workflow verification: font coverage.test |
| `tests/gita-pilot.test.mjs` | Regression or workflow verification: gita pilot.test |
| `tests/iks-catalogue.test.mjs` | Regression or workflow verification: iks catalogue.test |
| `tests/illustration-batching.test.mjs` | Regression or workflow verification: illustration batching.test |
| `tests/image-first-book.test.mjs` | Regression or workflow verification: image first book.test |
| `tests/library.test.mjs` | Regression or workflow verification: library.test |
| `tests/manual-canva-workflow.test.mjs` | Regression or workflow verification: manual canva workflow.test |
| `tests/manuscript-import.test.mjs` | Regression or workflow verification: manuscript import.test |
| `tests/midnight-api.test.mjs` | Regression or workflow verification: midnight api.test |
| `tests/midnight-queue.test.mjs` | Regression or workflow verification: midnight queue.test |
| `tests/notebook-artwork.test.mjs` | Regression or workflow verification: notebook artwork.test |
| `tests/notebook-fidelity.test.mjs` | Regression or workflow verification: notebook fidelity.test |
| `tests/notebook-import.test.mjs` | Regression or workflow verification: notebook import.test |
| `tests/original-chapter-workflow.test.mjs` | Regression or workflow verification: original chapter workflow.test |
| `tests/page-aesthetics.test.mjs` | Regression or workflow verification: page aesthetics.test |
| `tests/pedagogy-quality.test.mjs` | Regression or workflow verification: pedagogy quality.test |
| `tests/phase7-safety-gate.test.mjs` | Regression or workflow verification: phase7 safety gate.test |
| `tests/phase7-simulated-engine.test.mjs` | Regression or workflow verification: phase7 simulated engine.test |
| `tests/phase8-chapter-one-contract.test.mjs` | Regression or workflow verification: phase8 chapter one contract.test |
| `tests/print-layout.test.mjs` | Regression or workflow verification: print layout.test |
| `tests/publication-safety.test.mjs` | Regression or workflow verification: publication safety.test |
| `tests/rendered-html.test.mjs` | Regression or workflow verification: rendered html.test |
| `tests/request-control.test.mjs` | Regression or workflow verification: request control.test |
| `tests/resumable-generation.test.mjs` | Regression or workflow verification: resumable generation.test |
| `tests/series-art.test.mjs` | Regression or workflow verification: series art.test |
| `tests/simplified-workflow.test.mjs` | Regression or workflow verification: simplified workflow.test |
| `tests/source-book-options.test.mjs` | Regression or workflow verification: source book options.test |
| `tests/source-book-package.test.mjs` | Regression or workflow verification: source book package.test |
| `tests/source-book-review.test.mjs` | Regression or workflow verification: source book review.test |
| `tests/source-intelligence.test.mjs` | Regression or workflow verification: source intelligence.test |
| `tests/spread-composition.test.mjs` | Regression or workflow verification: spread composition.test |
| `tests/story-compositions.test.mjs` | Regression or workflow verification: story compositions.test |
| `tests/story-text-placement.test.mjs` | Regression or workflow verification: story text placement.test |
| `tests/storyboard.test.mjs` | Regression or workflow verification: storyboard.test |
| `tests/template-backup.test.mjs` | Regression or workflow verification: template backup.test |
| `tests/template-book.test.mjs` | Regression or workflow verification: template book.test |
| `tests/template-capacity.test.mjs` | Regression or workflow verification: template capacity.test |
| `tests/template-draft-regressions.test.mjs` | Regression or workflow verification: template draft regressions.test |
| `tests/template-layouts.test.mjs` | Regression or workflow verification: template layouts.test |
| `tests/template-library.test.mjs` | Regression or workflow verification: template library.test |
| `tests/template-save.test.mjs` | Regression or workflow verification: template save.test |
| `tests/template-upload.test.mjs` | Regression or workflow verification: template upload.test |
| `tests/text-backgrounds.test.mjs` | Regression or workflow verification: text backgrounds.test |
| `tests/typography.test.mjs` | Regression or workflow verification: typography.test |
| `tests/unlimited-page-plan.test.mjs` | Regression or workflow verification: unlimited page plan.test |
| `tests/visual-direction.test.mjs` | Regression or workflow verification: visual direction.test |
| `tests/visual-references.test.mjs` | Regression or workflow verification: visual references.test |
| `tmp/pdfs/make_workflow_map.py` | Retained working/reference artifact: make workflow map |
| `tmp/pdfs/rendered/workflow-1.png` | Retained working/reference artifact: workflow 1 |
| `tsconfig.json` | TypeScript compiler settings |
| `vite.config.ts` | Vite/Vinext and Cloudflare runtime bindings |
| `worker/book-release.ts` | Server API, storage and export implementation: book release Exports: bookReleaseApi. |
| `worker/clerk-identity.ts` | Server API, storage and export implementation: clerk identity Exports: ClerkIdentity, ClerkEnvironment, clerkConfigured, verifyClerkIdentity. |
| `worker/firebase-identity.ts` | Server API, storage and export implementation: firebase identity Exports: FirebaseEnvironment, firebaseConfigured, verifyFirebaseIdentity. |
| `worker/index.ts` | Server API, storage and export implementation: index Exports: Env. |
| `worker/library.ts` | Server API, storage and export implementation: library Exports: LibraryEnv, digest, librarySchema, libraryUser, libraryOwner, libraryApi. |
| `worker/midnight.ts` | Server API, storage and export implementation: midnight Exports: midnightSchema, midnightApi. |
| `worker/template-reference.ts` | Server API, storage and export implementation: template reference Exports: templateReferenceApi. |
