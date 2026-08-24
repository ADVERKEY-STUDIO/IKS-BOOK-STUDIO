"use client";

import { ChangeEvent, CSSProperties, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, unzipSync, zipSync } from "fflate";
import { AUTHORIAL_READER_INSTRUCTION, authorialReaderHtml, childAgeBand, generationProfileKey } from "../lib/child-summary";
import { ADAPTATION_PLAN_VERSION, allocatePagesWithinBudget, CHAPTER_PAGE_BUDGET, FIXED_MATTER_PAGES, recommendedAdaptationPages, TOTAL_BOOK_PAGE_LIMIT } from "../lib/adaptation-pages";
import type { ChapterOneGate, PedagogyQuality } from "../lib/pedagogy";
import { BOOK_PACKAGE_FORMAT, expectedChapterId, expectedContextKey, expectedPageId, type BookPackage, type BookPackageValidation, validateBookPackage } from "../lib/book-package";
import { bookPersonaClass, bookPersonaDefinitions, bookPersonaPatch, inferBookPersona, materializePersona, personaById, type BookPersona } from "../lib/book-persona";
import { outlineForMode, pdfChunkRanges, SAFE_OCR_CHUNK_BYTES, SAFE_OCR_CHUNK_PAGES, type OutlineMode, type SourceIntelligence, type SourceOutlineItem } from "../lib/source-intelligence";
import { buildExternalAiPrompt, parseExternalManuscript, type ExternalManuscriptResult } from "../lib/external-manuscript";

type View = "dashboard" | "wizard" | "external" | "analysis" | "brief" | "editor";

type SourceSection = { title: string; page: number; excerpt: string };

type ChapterGenerationStatus = "Waiting" | "Generating" | "Completed" | "Needs review" | "Human review" | "Paused by quota" | "Designer handoff";

type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  requests: number;
  updatedAt?: string;
};

type GenerationRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "passed" | "needs-review" | "quota-paused" | "failed";
  usage: GenerationUsage;
  feedback?: string[];
  error?: string;
  durationMs?: number;
};

type DraftApiResponse = {
  chapters?: Chapter[];
  candidateChapter?: Chapter;
  error?: string;
  usage?: GenerationUsage;
  code?: string;
  retryable?: boolean;
  quota?: boolean;
  requestCount?: number;
  durationMs?: number;
  phase7Evaluation?: ChapterOneGate;
};

const MAX_CONCURRENT_CHAPTERS = 2;

type ImportedPage = {
  pageId: string;
  pageNumber: number;
  purpose: string;
  body: string;
  imageKey?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
};

type Chapter = {
  id: number;
  title: string;
  pages: number;
  status: "planned" | "draft" | "approved";
  locked: boolean;
  body: string;
  sourceRefs: SourceSection[];
  imageKey?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
  visualType?: string;
  wordCount?: number;
  generationProfile?: string;
  sourceStartPage?: number;
  sourceEndPage?: number;
  sourcePageCount?: number;
  sourceWordCount?: number;
  complexityScore?: number;
  complexity?: "Accessible" | "Layered" | "Concept-rich" | "Dense";
  keyTerms?: string[];
  context?: string;
  recommendedPages?: number;
  pageReason?: string;
  pagePlanCustom?: boolean;
  pedagogyQuality?: PedagogyQuality;
  importedPages?: ImportedPage[];
  importValidated?: boolean;
  generationStatus?: ChapterGenerationStatus;
  generationUsage?: GenerationUsage;
  generationError?: string;
  repairAttempts?: number;
  phase7Evaluation?: ChapterOneGate;
  generationRuns?: GenerationRun[];
  manualApproved?: boolean;
  manualApprovedAt?: string;
};

type NemotronConnection = {
  state: "idle" | "testing" | "connected" | "error";
  message: string;
  usage?: GenerationUsage;
};

type ChapterComparison = { chapterId: number; original: Chapter };

type ChapterContextPlan = Required<Pick<Chapter, "sourceStartPage" | "sourceEndPage" | "sourcePageCount" | "sourceWordCount" | "complexityScore" | "complexity" | "keyTerms" | "context" | "recommendedPages" | "pageReason">> & { title: string };

type SourceResult = {
  name: string;
  size: number;
  objectKey: string;
  pages: number;
  words: number;
  headings: string[];
  terms: string[];
  sections: SourceSection[];
  chapterPlans: ChapterContextPlan[];
  preview: string;
  quality: string;
  sourceIntelligence?: SourceIntelligence;
};

type CanvaPageVersion = {
  imageKey: string;
  imageUrl: string;
  fileName: string;
  acceptedAt: string;
};

type CanvaPageOverride = {
  slotId: string;
  label: string;
  kind: "cover" | "contents" | "chapter" | "back";
  chapterId?: number;
  pageIndex?: number;
  active: boolean;
  current: CanvaPageVersion;
  history: CanvaPageVersion[];
};

type DesignerPageRevision = {
  html: string;
  intentionalBlank: boolean;
  deleted: boolean;
  layoutLocked: boolean;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundImageKey?: string;
  watermarkText: string;
  watermarkImageUrl?: string;
  watermarkImageKey?: string;
  watermarkOpacity: number;
  watermarkRotation: number;
  contentVisible: boolean;
  watermarkVisible: boolean;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  columns: number;
  columnGap: number;
  pagePadding: number;
  borderStyle: "none" | "solid" | "double" | "dashed";
  borderColor: string;
  borderWidth: number;
  borderInset: number;
  borderRadius: number;
  backgroundSize: "cover" | "contain" | "auto" | "repeat";
  backgroundPosition: string;
  backgroundOpacity: number;
  watermarkRepeat: boolean;
  watermarkX: number;
  watermarkY: number;
  savedAt: string;
};

type DesignerPageOverride = DesignerPageRevision & {
  slotId: string;
  label: string;
  kind: "cover" | "contents" | "chapter" | "back" | "custom";
  chapterId?: number;
  pageIndex?: number;
  history: DesignerPageRevision[];
};

type DesignerStylePreset = { id: string; name: string; style: Partial<DesignerPageRevision> };

type Project = {
  id: string;
  title: string;
  source: string;
  sourcePages: number;
  sourceWords: number;
  sourceSize: number;
  sourceObjectKey: string;
  sourceQuality: string;
  sourceHeadings: string[];
  sourceTerms: string[];
  sourceSections: SourceSection[];
  sourcePreview: string;
  sourceIntelligence?: SourceIntelligence;
  audience: string;
  readingLevel: string;
  language: string;
  bookType: string;
  bookPersona: BookPersona;
  aesthetic: string;
  pageAesthetic: string;
  bookBorder: string;
  pageWatermark: string;
  illustrationStyle: string;
  fontTheme: string;
  imageFrequency: string;
  adaptation: string;
  citationStyle: string;
  learningFeatures: string[];
  chapters: Chapter[];
  editorialPreferences: string[];
  briefApproved: boolean;
  adaptationPlanConfirmed: boolean;
  adaptationPlanVersion?: number;
  canvaPages?: CanvaPageOverride[];
  designerPages?: DesignerPageOverride[];
  designerPageOrder?: string[];
  designerPresets?: DesignerStylePreset[];
  creationMode?: "external" | "automatic";
  externalManuscript?: {
    fileName: string;
    importedAt: string;
    totalWords: number;
    issues: string[];
  };
  updatedAt: string;
};

const curatedChapterIllustrations: Record<string, { url: string; caption: string; alt: string }> = {
  "concept of indian aesthetics": {
    url: "/illustrations/concept-indian-aesthetics.webp",
    caption: "A living aesthetic tradition: rasa, contemplation, performance and sacred geometry held in one visual field.",
    alt: "Editorial watercolour combining a lotus-like aesthetic wheel, a contemplative eye, an Indian dance gesture, sculpture and manuscript geometry.",
  },
  "origin and concept": {
    url: "/illustrations/origin-and-concept.webp",
    caption: "Ideas taking form across oral teaching, manuscripts and the developing language of rasa.",
    alt: "Editorial watercolour showing a teacher and learners, palm-leaf manuscripts and an abstract lotus geometry emerging through time.",
  },
  "structure and design": {
    url: "/illustrations/structure-and-design.webp",
    caption: "Proportion, rhythm and geometry organise the experience of Indian art and architecture.",
    alt: "Editorial watercolour and ink drawing of an Indian proportional grid, architectural rhythm, manuscript layout and geometric construction.",
  },
};

const thematicIllustrations = [
  { keywords: ["rasa", "bhava", "bhāva", "emotion", "aesthetic experience"], url: "/illustrations/rasa-bhava.png", caption: "Rasa and bhāva become visible through expression, gesture, rhythm and the attentive spectator.", alt: "Editorial watercolour of an Indian classical performer expressing rasa through gesture, face and rhythmic lotus motifs." },
  { keywords: ["dhvani", "poetic", "poetry", "suggestion", "meaning", "language"], url: "/illustrations/dhvani-poetics.png", caption: "Dhvani carries meaning beyond the spoken word, moving from poet to listener through suggestion and response.", alt: "Editorial watercolour of a poet, listener and palm-leaf manuscript connected by subtle concentric sound and meaning motifs." },
  { keywords: ["natya", "nāṭya", "nitya", "performance", "dance", "drama", "theatre"], url: "/illustrations/natya-performance.png", caption: "Performance joins gesture, music, movement and space into a shared aesthetic experience.", alt: "Editorial watercolour of an Indian classical stage with dancer, musicians, mudras and geometric performance-space motifs." },
];

function normalizedTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function curatedIllustration(title: string, body = "") {
  const exact = curatedChapterIllustrations[normalizedTitle(title)];
  if (exact) return exact;
  const context = normalizedTitle(`${title} ${body.replace(/<[^>]+>/g, " ")}`).slice(0, 5000);
  const thematic = thematicIllustrations.find((illustration) => illustration.keywords.some((keyword) => context.includes(keyword)));
  return thematic;
}

const visualStopWords = new Set("about after again also among and are because been before being between book can chapter could did does each for from had has have into its may more most not other our out over page pages part should some such than that the their them then there these they this through under use used using very was were what when where which while who will with would your source idea ideas section chapter".split(" "));

function visualKeywords(title: string, body: string, sourceTerms: string[]) {
  const titleWords: string[] = normalizedTitle(title).match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  const bodyWords: string[] = body.replace(/<[^>]+>/g, " ").toLowerCase().match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  const frequency = new Map<string, number>();
  for (const word of [...titleWords, ...sourceTerms, ...bodyWords.slice(0, 1800)]) {
    const cleaned = word.toLowerCase().replace(/^['’-]+|['’-]+$/g, "");
    if (cleaned.length < 4 || visualStopWords.has(cleaned) || /^\d+$/.test(cleaned)) continue;
    frequency.set(cleaned, (frequency.get(cleaned) ?? 0) + (titleWords.includes(cleaned) ? 8 : 1));
  }
  return [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);
}

function chooseSceneDirection(title: string, body: string, index: number) {
  const context = normalizedTitle(`${title} ${body.replace(/<[^>]+>/g, " ")}`).slice(0, 7000);
  if (/\b(?:govern\w*|minister\w*|king\w*|ruler\w*|strateg\w*|foreign|diploma\w*|statecraft|rajya|rājya|kingdom\w*|empire\w*)\b/.test(context)) return "A lived council scene: two or three advisers actively weighing choices with tactile objects, messengers, manuscripts and a richly rendered kingdom visible around them";
  if (/\b(?:science|nature|animal\w*|plant\w*|river\w*|ocean\w*|climate|space|planet\w*|medicine|body|energy)\b/.test(context)) return "An immersive discovery scene: young learners and a knowledgeable guide observing the real phenomenon in its natural setting, using authentic tools and visible evidence";
  if (/\b(?:art|music|dance|theatre|poet\w*|story|craft\w*|design\w*|architecture|performance)\b/.test(context)) return "A vibrant creative scene: artists, learners or performers making and discussing the chapter idea in an authentic workshop, stage or architectural setting";
  if (/\b(?:econom\w*|trade|agricultur\w*|production\w*|work\w*|market\w*|craft\w*|process\w*|method\w*)\b/.test(context)) return "A detailed working scene: people carrying out the chapter’s process in a real place, with tools, materials, cause and effect all visible through action";
  if (/\b(?:histor\w*|ancient|origin\w*|period\w*|tradition\w*|culture|civilisation|civilization)\b/.test(context)) return "A historically grounded lived moment: children can understand the period through people, architecture, clothing, everyday objects and one meaningful action";
  return [
    "A cinematic teaching moment with a guide and young learners discovering the chapter idea through objects, place and action",
    "A wide environmental story scene where several small actions reveal the chapter’s central idea without labels",
    "An intimate workshop or courtyard scene where people solve a chapter-specific problem together",
  ][Math.abs(index) % 3];
}

function visualIdentity(imageKey?: string, imageUrl?: string) {
  if (imageKey) return `asset:${imageKey}`;
  if (imageUrl) return `url:${imageUrl}`;
  return "";
}

function contextualIllustration(
  project: Pick<Project, "aesthetic" | "illustrationStyle" | "sourceTerms" | "bookPersona">,
  chapter: Pick<Chapter, "title" | "body">,
  index: number,
  usedImages: Set<string>,
) {
  const curated = curatedIllustration(chapter.title, chapter.body);
  if (curated && !usedImages.has(visualIdentity(undefined, curated.url))) return { ...curated, type: "illustration" };
  const terms = visualKeywords(chapter.title, chapter.body, project.sourceTerms);
  const scene = chooseSceneDirection(chapter.title, chapter.body, index);
  const params = new URLSearchParams({ title: chapter.title.slice(0, 180), terms: terms.join("|"), type: "scene", scene: scene.slice(0, 360), style: project.bookPersona.illustrationStyle.slice(0, 110), aesthetic: project.bookPersona.name.slice(0, 80), mood: project.bookPersona.mood.slice(0, 100), motif: project.bookPersona.motif.slice(0, 100), chapter: String(index + 1), variant: String(index + 1) });
  const url = `/api/visual?${params.toString()}`;
  return {
    url,
    caption: `${chapter.title}: a chapter-specific narrative scene based on ${terms.slice(0, 3).join(", ") || "the chapter’s central ideas"}.`,
    alt: `Narrative scene direction for ${chapter.title}, showing people, place and action related to ${terms.slice(0, 4).join(", ") || "the chapter context"}.`,
    type: "scene-plan",
  };
}

function attachChapterVisuals(project: Pick<Project, "aesthetic" | "illustrationStyle" | "sourceTerms" | "bookPersona">, chapters: Chapter[]) {
  const usedImages = new Set<string>();
  return chapters.map((chapter, index) => {
    const existingIdentity = visualIdentity(chapter.imageKey, chapter.imageUrl);
    const isUploadedImage = Boolean(chapter.imageUrl && (chapter.imageKey || chapter.visualType === "uploaded"));
    if (isUploadedImage && existingIdentity && !usedImages.has(existingIdentity)) {
      usedImages.add(existingIdentity);
      return chapter;
    }

    const visual = contextualIllustration(project, chapter, index, usedImages);
    usedImages.add(visualIdentity(undefined, visual.url));
    const illustratedChapter = {
      ...chapter,
      imageKey: undefined,
      imageUrl: visual.url,
      imageCaption: visual.caption,
      imageAlt: visual.alt,
      visualType: visual.type,
    };
    return illustratedChapter;
  });
}

let seedProject: Project = {
  id: "arthashastra-sample",
  title: "The Art of Wise Governance",
  source: "Arthashastra_textbook.pdf",
  sourcePages: 131,
  sourceWords: 39861,
  sourceSize: 18300000,
  sourceObjectKey: "",
  sourceQuality: "Good",
  sourceHeadings: ["Foundations and Context", "Knowledge and Learning", "Leadership and Welfare", "Economy and Resources", "Strategy and Diplomacy"],
  sourceTerms: ["governance", "learning", "welfare", "strategy", "dharma", "economy", "leadership", "statecraft"],
  sourceSections: [
    { title: "Foundations and Context", page: 13, excerpt: "The source connects knowledge, discipline, public welfare and administration as practical responsibilities." },
    { title: "Knowledge and Learning", page: 37, excerpt: "Education and disciplined inquiry are presented as foundations for sound judgement." },
    { title: "Leadership and Welfare", page: 55, excerpt: "Leadership is evaluated through responsibility, institutional strength and public welfare." },
    { title: "Economy and Resources", page: 75, excerpt: "Revenue, trade, agriculture and resources are treated as connected parts of prosperity." },
    { title: "Strategy and Diplomacy", page: 101, excerpt: "Diplomacy and strategy require realistic assessment, preparation and awareness of changing relationships." },
  ],
  sourcePreview: "The Arthashastra presents knowledge, discipline, public welfare, economic organisation and statecraft as connected responsibilities. It asks how institutions can be designed, how leaders should be educated, and how prosperity can be protected through careful administration.",
  audience: "Ages 10–12",
  readingLevel: "Confident independent reader",
  language: "English",
  bookType: "Illustrated children’s adaptation",
  bookPersona: materializePersona(personaById("court-of-decisions"), "Chosen from this source’s emphasis on governance, statecraft, economy and strategy."),
  aesthetic: "Bright Explorer",
  pageAesthetic: "Playful Panels",
  bookBorder: "Lotus Arch",
  pageWatermark: "Lotus Seal",
  illustrationStyle: "Colourful educational illustration",
  fontTheme: "Friendly rounded",
  imageFrequency: "Picture-rich — at least 1 per chapter",
  adaptation: "Faithful children’s adaptation",
  citationStyle: "Source notes for grown-ups",
  learningFeatures: ["Key terms", "Clear examples", "Reflection"],
  editorialPreferences: ["Clear sentences", "Preserve specialist terms", "Explain Sanskrit words on first use"],
  briefApproved: true,
  adaptationPlanConfirmed: true,
  adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
  updatedAt: "Today",
  chapters: [
    {
      id: 1,
      title: "The Thinker and His World",
      pages: 12,
      status: "approved",
      generationStatus: "Completed",
      locked: true,
      sourceRefs: [{ title: "Foundations and Context", page: 13, excerpt: "The source connects knowledge, discipline, public welfare and administration as practical responsibilities." }],
      body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>The Thinker<br/>and His World</h1><p class="chapter-deck">Before the Arthashastra became a guide to governance, it was a response to a changing world—one in which knowledge, discipline and public welfare had to work together.</p><blockquote>Good governance begins with understanding people, place and purpose.</blockquote><h2>A landscape of new ideas</h2><p>Ancient India was home to many schools of thought. Teachers, rulers and communities debated how prosperity could be created and protected. The Arthashastra brought these conversations into a practical framework for leadership.</p><div class="illustration"><span>ILLUSTRATION 01</span><strong>A learning hall at dawn</strong><small>Suggested visual: a teacher, students, manuscripts and a map of the subcontinent.</small></div><h2>Why the text still matters</h2><p>The work asks questions that remain familiar today: What makes an institution trustworthy? How should leaders balance strength and compassion? How can public resources be used wisely?</p><div class="takeaway"><b>KEY IDEA</b><p>Knowledge is valuable when it improves decisions and serves the wider community.</p></div>`,
    },
    {
      id: 2,
      title: "Knowledge, Learning and Discipline",
      pages: 10,
      status: "draft",
      generationStatus: "Needs review",
      locked: false,
      sourceRefs: [{ title: "Knowledge and Learning", page: 37, excerpt: "Education and disciplined inquiry are presented as foundations for sound judgement." }],
      body: `<p class="chapter-kicker">CHAPTER TWO</p><h1>Knowledge, Learning<br/>and Discipline</h1><p class="chapter-deck">A practical education joins careful study with reflection, observation and responsible action.</p><h2>Learning as preparation</h2><p>The text treats education as preparation for sound judgment. It connects intellectual training with self-control and attention to real conditions.</p><div class="illustration"><span>ILLUSTRATION 02</span><strong>Four paths of learning</strong><small>Suggested visual: a precise editorial diagram built from the approved source.</small></div>`,
    },
    {
      id: 3,
      title: "Leadership and Public Welfare",
      pages: 14,
      status: "draft",
      generationStatus: "Needs review",
      locked: false,
      sourceRefs: [{ title: "Leadership and Welfare", page: 55, excerpt: "Leadership is evaluated through responsibility, institutional strength and public welfare." }],
      body: `<p class="chapter-kicker">CHAPTER THREE</p><h1>Leadership and<br/>Public Welfare</h1><p class="chapter-deck">Leadership is presented not as privilege, but as a demanding responsibility.</p><h2>The work of leadership</h2><p>A capable leader listens, studies evidence, chooses advisers carefully and keeps public welfare at the centre of policy.</p>`,
    },
    {
      id: 4,
      title: "Economy, Trade and Resources",
      pages: 14,
      status: "planned",
      generationStatus: "Waiting",
      locked: false,
      sourceRefs: [{ title: "Economy and Resources", page: 75, excerpt: "Revenue, trade, agriculture and resources are treated as connected parts of prosperity." }],
      body: `<p class="chapter-kicker">CHAPTER FOUR</p><h1>Economy, Trade<br/>and Resources</h1><p class="chapter-deck">Prosperity depends on systems that are understood, measured and maintained.</p>`,
    },
    {
      id: 5,
      title: "Strategy, Diplomacy and Peace",
      pages: 14,
      status: "planned",
      generationStatus: "Waiting",
      locked: false,
      sourceRefs: [{ title: "Strategy and Diplomacy", page: 101, excerpt: "Diplomacy and strategy require realistic assessment, preparation and awareness of changing relationships." }],
      body: `<p class="chapter-kicker">CHAPTER FIVE</p><h1>Strategy, Diplomacy<br/>and Peace</h1><p class="chapter-deck">Wise strategy begins with a realistic view of relationships, risks and possible futures.</p>`,
    },
  ],
};

const arthashastraOriginalTitles = [
  "Kauṭilya’s Arthaśāstra: An Introduction",
  "Tantrādhikāra: Internal Affairs of the Rājya",
  "Prakṛti Sampat: The Constituent Elements",
  "Avāpādhikāra: Foreign Affairs and Strategy",
  "Upasaṃhāra: Conclusion",
  "Appendix",
];

seedProject = {
  ...seedProject,
  sourceHeadings: arthashastraOriginalTitles,
  chapters: arthashastraOriginalTitles.map((title, index) => ({
    id: index + 1,
    title,
    pages: index === 5 ? 6 : 9,
    status: "planned" as const,
    generationStatus: "Waiting" as const,
    locked: false,
    sourceRefs: seedProject.sourceSections[index] ? [seedProject.sourceSections[index]] : [],
    body: `<p class="chapter-kicker">CHAPTER ${String(index + 1).padStart(2, "0")}</p><h1>${title}</h1>`,
  })),
};

const emptyProject: Project = {
  ...seedProject,
  id: "",
  title: "Untitled adaptation",
  source: "No source selected",
  sourcePages: 0,
  sourceWords: 0,
  sourceSize: 0,
  sourceObjectKey: "",
  sourceQuality: "Pending",
  sourceHeadings: [],
  sourceTerms: [],
  sourceSections: [],
  sourcePreview: "",
  audience: "Ages 10–12",
  readingLevel: "Confident independent reader",
  language: "English",
  bookType: "Illustrated children’s adaptation",
  bookPersona: materializePersona(personaById("wisdom-and-ideas"), "A calm temporary identity until the source is analysed."),
  aesthetic: "Young Scholar",
  pageAesthetic: "Calm Editorial",
  bookBorder: "No Border",
  pageWatermark: "Lotus Seal",
  illustrationStyle: "Contemplative editorial scenes with quiet symbolism, natural materials and human scale",
  fontTheme: "Clear Reader",
  imageFrequency: "Picture-rich — at least 1 per chapter",
  adaptation: "Faithful children’s adaptation",
  citationStyle: "Source notes for grown-ups",
  learningFeatures: ["Key terms", "Clear examples", "Reflection"],
  chapters: [
    { id: 1, title: "Opening chapter", pages: 10, status: "planned", generationStatus: "Waiting", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>Opening chapter</h1><p class="chapter-deck">Your generated chapter will appear here after the book brief is approved.</p>` },
  ],
  editorialPreferences: [],
  briefApproved: false,
  adaptationPlanConfirmed: false,
  adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
  creationMode: "external",
};

const wizardSteps = ["Source", "Reader", "Design", "Review"];

const childAudienceProfiles = [
  {
    value: "Ages 7–9",
    label: "Early explorers",
    readingLevel: "Early independent reader",
    description: "Short sentences, familiar words and frequent visual pauses.",
    sample: "A council is a group of people who help make important decisions. Each person has a job to do.",
    imageFrequency: "Highly illustrated — 1 per page",
  },
  {
    value: "Ages 10–12",
    label: "Curious readers",
    readingLevel: "Confident independent reader",
    description: "Clear explanations, useful vocabulary and connected examples.",
    sample: "A council brings different duties together. Understanding these roles shows how a larger system can work.",
    imageFrequency: "Picture-rich — at least 1 per chapter",
  },
  {
    value: "Ages 13–15",
    label: "Young thinkers",
    readingLevel: "Teen reader",
    description: "Richer ideas, precise terms and room for reflection and debate.",
    sample: "This chapter explores how one central idea developed, why it mattered, and how its different parts connect.",
    imageFrequency: "Balanced visuals — at least 1 per chapter",
  },
] as const;

const naturalWritingProfiles = [
  {
    age: "7-9",
    intro: "This chapter explains the main idea with short sentences, familiar words and clear examples.",
    sections: ["Getting started", "The main idea", "How it works", "Why it matters"],
    activityLabel: "THINK ABOUT IT",
    activity: "What is the most important idea in this chapter? Explain it in one or two sentences.",
    learningFeatures: ["Clear examples", "Word helper", "Short reflection"],
  },
  {
    age: "10-12",
    intro: "This chapter introduces important terms and connects each idea to the larger topic.",
    sections: ["Understanding the idea", "The main concept", "Key connections", "Why it matters"],
    activityLabel: "THINK ABOUT IT",
    activity: "Explain the chapter’s main idea in your own words and give one example of how its parts connect.",
    learningFeatures: ["Key terms", "Clear examples", "Reflection"],
  },
  {
    age: "13-15",
    intro: "This chapter develops the central argument, keeps important terms and examines their wider meaning.",
    sections: ["Context and foundations", "The central concept", "Connections and consequences", "Why it matters"],
    activityLabel: "REFLECT",
    activity: "Which connection in this chapter is most important, and which details support your view?",
    learningFeatures: ["Precise terms", "Idea connections", "Critical reflection"],
  },
] as const;

const childDesignWorlds = [
  {
    value: "Storybook India",
    label: "Storybook India",
    description: "Warm paper, rich jewel colours and hand-painted storytelling.",
    illustrationStyle: "Warm storybook painting",
    fontTheme: "Friendly rounded",
  },
  {
    value: "Bright Explorer",
    label: "Bright Explorer",
    description: "Fresh colour, bold diagrams and energetic learning pages.",
    illustrationStyle: "Colourful educational illustration",
    fontTheme: "Friendly rounded",
  },
  {
    value: "Young Scholar",
    label: "Young Scholar",
    description: "Calm colours, detailed art and a more grown-up reading rhythm.",
    illustrationStyle: "Detailed editorial illustration",
    fontTheme: "Readable serif",
  },
] as const;

const pageAesthetics = [
  {
    value: "Heritage Frame",
    label: "Heritage Frame",
    description: "Decorative borders, centred chapter openings and warm storybook details.",
    detail: "Best for cultural stories and timeless ideas",
  },
  {
    value: "Playful Panels",
    label: "Playful Panels",
    description: "Rounded colour panels, bold labels and lively visual learning blocks.",
    detail: "Best for energetic, picture-rich exploration",
  },
  {
    value: "Calm Editorial",
    label: "Calm Editorial",
    description: "Open margins, clean rules and a quiet reading rhythm for older children.",
    detail: "Best for longer explanations and reflection",
  },
] as const;

const bookBorders = [
  {
    value: "No Border",
    label: "No Border",
    description: "A clean open page with no decorative frame around the reading area.",
    detail: "Maximum space and the quietest reading experience",
  },
  {
    value: "Lotus Arch",
    label: "Lotus Arch",
    description: "A warm temple-inspired frame with lotus-like corner details.",
    detail: "Celebratory and story-rich",
  },
  {
    value: "Folk Geometry",
    label: "Folk Geometry",
    description: "A lively repeating pattern inspired by Indian folk shapes and colour.",
    detail: "Bold and playful for younger readers",
  },
  {
    value: "Golden Lines",
    label: "Golden Lines",
    description: "A quiet double-line border with small, refined corner accents.",
    detail: "Clear and mature for longer reading",
  },
  { value: "Manuscript Double Rule", label: "Manuscript Double Rule", description: "Two fine archival rules with restrained corner marks.", detail: "A scholarly manuscript finish" },
  { value: "Museum Archive Frame", label: "Museum Archive Frame", description: "A precise museum-label frame for collected knowledge.", detail: "Formal, curated and quiet" },
  { value: "Botanical Corners", label: "Botanical Corners", description: "Small leaf details grow from otherwise open corners.", detail: "Organic without reducing reading space" },
  { value: "Discovery Field Notes", label: "Discovery Field Notes", description: "A hand-noted field journal edge with subtle guide marks.", detail: "Ideal for exploration and activity books" },
] as const;

const pageWatermarks = [
  { value: "No Watermark", label: "No Watermark", description: "A completely clear page behind the text.", detail: "Best for dense chapters and maximum contrast" },
  { value: "Lotus Seal", label: "Lotus Seal", description: "A soft lotus medallion centred behind the page.", detail: "Calm and cultural without distracting from reading" },
  { value: "Knowledge Tree", label: "Knowledge Tree", description: "A faint branching tree rising gently from the lower page.", detail: "Ideal for learning, ideas and connected concepts" },
  { value: "Sun Mandala", label: "Sun Mandala", description: "A quiet circular geometry placed behind the page content.", detail: "Balanced and refined for every age group" },
  { value: "Palm Leaf", label: "Palm Leaf", description: "Fine horizontal fibres inspired by palm-leaf manuscripts.", detail: "A subtle archival texture" },
  { value: "Temple Window", label: "Temple Window", description: "A soft architectural arch held behind the reading area.", detail: "Adds cultural structure without a diagram" },
  { value: "River Lines", label: "River Lines", description: "Quiet flowing contours move across the lower page.", detail: "Natural movement for journeys and stories" },
  { value: "Botanical Study", label: "Botanical Study", description: "A faint leaf study rests in one open corner.", detail: "Warm and observational" },
] as const;

const typographyThemes = [
  { value: "Storybook Serif", label: "Storybook Serif", description: "Warm, literary letterforms with expressive chapter titles.", detail: "Classic and inviting for stories and cultural subjects", sample: "Once an idea begins, it can travel through generations." },
  { value: "Friendly Rounded", label: "Friendly Rounded", description: "Soft, open letters that feel lively and approachable.", detail: "Comfortable for younger and visual-first readers", sample: "Let’s discover how every part of this idea connects!" },
  { value: "Clear Reader", label: "Clear Reader", description: "A clean, highly readable type system with calm spacing.", detail: "Excellent for longer chapters and confident readers", sample: "The central idea becomes clearer when we examine each connection." },
  { value: "Literary Classic", label: "Literary Classic", description: "Bookish old-style serif type with elegant, measured headings.", detail: "Premium narrative and heritage books", sample: "A careful story can carry wisdom across centuries." },
  { value: "Modern Humanist", label: "Modern Humanist", description: "Warm sans-serif forms with excellent paragraph rhythm.", detail: "Contemporary educational publishing", sample: "Ideas become easier to follow when every step is clear." },
  { value: "Sanskrit Scholar", label: "Sanskrit Scholar", description: "A scholarly serif stack designed to preserve Indic diacritics.", detail: "Source-faithful books with Sanskrit terms", sample: "Rasa, bhāva and dhvani retain their precise forms." },
  { value: "Playful Display", label: "Playful Display", description: "Friendly display headings paired with calm reading text.", detail: "Younger, energetic illustrated books", sample: "Look closely—what surprising detail can you discover?" },
  { value: "Editorial Sans", label: "Editorial Sans", description: "Crisp editorial typography with compact, confident headings.", detail: "Visual nonfiction and field guides", sample: "Observe the evidence, compare the clues, then decide." },
] as const;

function childAudienceProfile(value: string) {
  const direct = childAudienceProfiles.find((profile) => profile.value === value);
  if (direct) return direct;
  if (/7\s*[–-]|children\s*\(7/i.test(value)) return childAudienceProfiles[0];
  if (/13|14|15/i.test(value)) return childAudienceProfiles[2];
  return childAudienceProfiles[1];
}

function naturalWritingProfile(audience: string) {
  const age = childAgeBand(audience);
  return naturalWritingProfiles.find((profile) => profile.age === age) ?? naturalWritingProfiles[1];
}

function childDesignWorld(value: string) {
  const direct = childDesignWorlds.find((world) => world.value === value);
  if (direct) return direct;
  if (/classical|warm|children|storybook/i.test(value)) return childDesignWorlds[0];
  if (/academic|scholar|minimal/i.test(value)) return childDesignWorlds[2];
  return childDesignWorlds[1];
}

function pageAesthetic(value: string) {
  const direct = pageAesthetics.find((aesthetic) => aesthetic.value === value);
  if (direct) return direct;
  if (/heritage|frame|ornament|classic/i.test(value)) return pageAesthetics[0];
  if (/calm|editorial|minimal|open/i.test(value)) return pageAesthetics[2];
  return pageAesthetics[1];
}

function bookBorder(value: string) {
  const direct = bookBorders.find((border) => border.value === value);
  if (direct) return direct;
  if (/none|no border|borderless|open/i.test(value)) return bookBorders[0];
  if (/folk|geometry|pattern|colour/i.test(value)) return bookBorders[2];
  if (/gold|line|simple|minimal/i.test(value)) return bookBorders[3];
  return bookBorders[1];
}

function pageWatermark(value: string) {
  const direct = pageWatermarks.find((watermark) => watermark.value === value);
  if (direct) return direct;
  if (/none|clear|no watermark/i.test(value)) return pageWatermarks[0];
  if (/tree|branch|knowledge/i.test(value)) return pageWatermarks[2];
  if (/sun|mandala|circle|geometry/i.test(value)) return pageWatermarks[3];
  return pageWatermarks[1];
}

function typographyTheme(value: string) {
  const direct = typographyThemes.find((theme) => theme.value === value);
  if (direct) return direct;
  if (/serif|literary|classic|heritage/i.test(value)) return typographyThemes[0];
  if (/clear|reader|sans|clean/i.test(value)) return typographyThemes[2];
  return typographyThemes[1];
}

function audiencePatch(value: string): Partial<Project> {
  const profile = childAudienceProfile(value);
  const writing = naturalWritingProfile(profile.value);
  return {
    audience: profile.value,
    readingLevel: profile.readingLevel,
    bookType: "Illustrated children’s adaptation",
    imageFrequency: profile.imageFrequency,
    learningFeatures: [...writing.learningFeatures],
  };
}

function designWorldPatch(value: string): Partial<Project> {
  const world = childDesignWorld(value);
  return {
    aesthetic: world.value,
    illustrationStyle: world.illustrationStyle,
  };
}

function pageAestheticPatch(value: string): Partial<Project> {
  return { pageAesthetic: pageAesthetic(value).value };
}

function bookBorderPatch(value: string): Partial<Project> {
  return { bookBorder: bookBorder(value).value };
}

function pageWatermarkPatch(value: string): Partial<Project> {
  return { pageWatermark: pageWatermark(value).value };
}

function typographyPatch(value: string): Partial<Project> {
  return { fontTheme: typographyTheme(value).value };
}

function fitChaptersToBookLimit(chapters: Chapter[]) {
  const requestedTotal = chapters.reduce((sum, chapter) => sum + Math.max(1, chapter.pages || 1), 0);
  const allocations = allocatePagesWithinBudget(chapters.map((chapter) => chapter.pages || 1));
  const wasLimited = requestedTotal > CHAPTER_PAGE_BUDGET;
  return chapters.map((chapter, index) => {
    const baseReason = (chapter.pageReason || "").replace(/\s*Reduced only because the combined plan exceeded the 100-page safety ceiling\.?$/i, "").trim();
    const pageReason = wasLimited
      ? `${baseReason}${baseReason ? " " : ""}Reduced only because the combined plan exceeded the 100-page safety ceiling.`
      : baseReason || chapter.pageReason;
    return {
      ...chapter,
      pages: allocations[index],
      recommendedPages: chapter.pagePlanCustom ? chapter.recommendedPages : allocations[index],
      pageReason,
    };
  });
}

function totalBookPages(chapters: Chapter[]) {
  return chapters.reduce((sum, chapter) => sum + Math.max(1, chapter.pages || 1), FIXED_MATTER_PAGES);
}

function maximumChapterPages(chapters: Chapter[], chapterIndex: number) {
  const otherPages = chapters.reduce((sum, chapter, index) => index === chapterIndex ? sum : sum + Math.max(1, chapter.pages || 1), 0);
  return Math.max(1, CHAPTER_PAGE_BUDGET - otherPages);
}

function setChapterPagesWithinLimit(chapters: Chapter[], chapterIndex: number, value: number, patch: Partial<Chapter> = {}) {
  const pages = Math.min(maximumChapterPages(chapters, chapterIndex), Math.max(1, Math.round(value || 1)));
  return chapters.map((chapter, index) => index === chapterIndex ? {
    ...chapter,
    ...patch,
    pages,
    pagePlanCustom: true,
    pageReason: "Custom length chosen by the designer; the 100-page safety ceiling still applies.",
  } : chapter);
}

function adaptationPageReason(chapter: Chapter, audience: string) {
  const sourceWords = chapter.sourceWordCount?.toLocaleString() ?? "analysed";
  const reader = childAudienceProfile(audience).label.toLowerCase();
  return `${chapter.complexity || "Layered"} chapter · ${sourceWords} source words reviewed · shortest clear treatment for ${reader}, including the essential ideas, an example, one unique visual and an activity.`;
}

function applyAutomaticAdaptationPlan(chapters: Chapter[], audience: string, includeCustom = false) {
  const recommended = chapters.map((chapter) => {
    if (chapter.pagePlanCustom && !includeCustom) return chapter;
    const recommendedPages = recommendedAdaptationPages(chapter, audience);
    return { ...chapter, pages: recommendedPages, recommendedPages, pageReason: adaptationPageReason(chapter, audience), pagePlanCustom: false };
  });
  return fitChaptersToBookLimit(recommended);
}

function chapterFromContextPlan(title: string, index: number, section: SourceSection | undefined, plan: ChapterContextPlan | undefined, audience: string): Chapter {
  const base: Chapter = {
    id: index + 1,
    title,
    pages: plan?.recommendedPages ?? 6,
    status: "planned",
    generationStatus: "Waiting",
    locked: false,
    sourceRefs: section ? [section] : [],
    body: `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${escapeHtml(title)}</h1><p class="chapter-deck">This chapter is ready to become a complete, engaging part of the children’s book.</p>`,
    sourceStartPage: plan?.sourceStartPage,
    sourceEndPage: plan?.sourceEndPage,
    sourcePageCount: plan?.sourcePageCount,
    sourceWordCount: plan?.sourceWordCount,
    complexityScore: plan?.complexityScore,
    complexity: plan?.complexity,
    keyTerms: plan?.keyTerms,
    context: plan?.context,
    recommendedPages: plan?.recommendedPages,
    pageReason: plan?.pageReason,
    pagePlanCustom: false,
  };
  return applyAutomaticAdaptationPlan([base], audience, true)[0];
}

function isChapterLabel(value: string) {
  return /^chapter\s+(?:\d{1,3}|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[:.\-–—]?$/i.test(value.trim());
}

function retitleChapterBody(body: string, title: string, chapterNumber: number) {
  const safeTitle = escapeHtml(title);
  let next = body || "";
  if (/<p\b[^>]*class=["'][^"']*chapter-kicker[^"']*["'][^>]*>[\s\S]*?<\/p>/i.test(next)) {
    next = next.replace(/<p\b([^>]*class=["'][^"']*chapter-kicker[^"']*["'][^>]*)>[\s\S]*?<\/p>/i, `<p$1>CHAPTER ${String(chapterNumber).padStart(2, "0")}</p>`);
  } else {
    next = `<p class="chapter-kicker">CHAPTER ${String(chapterNumber).padStart(2, "0")}</p>${next}`;
  }
  if (/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(next)) return next.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, `<h1>${safeTitle}</h1>`);
  return `${next}<h1>${safeTitle}</h1>`;
}

function removeGeneratedChapterMetadata(body: string) {
  const withoutMetadata = (body || "").replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (paragraph, _attributes: string, content: string) => {
    const text = content.replace(/<[^>]+>/g, " ").replace(/&\w+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
    return /\bsource-grounded chapter\b[\s\S]*\breferenced source locations?\b/i.test(text) ? "" : paragraph;
  });
  return authorialReaderHtml(withoutMetadata);
}

function reconcileOriginalChapters(project: Project, titles: string[], sections: SourceSection[], chapterPlans: ChapterContextPlan[] = []) {
  const used = new Set<number>();
  const defaultPages = 6;
  const reconciled = titles.map((title, index) => {
    let matchIndex = project.chapters.findIndex((chapter, chapterIndex) => !used.has(chapterIndex) && normalizedTitle(chapter.title) === normalizedTitle(title));
    if (matchIndex < 0 && project.chapters[index] && !used.has(index)) matchIndex = index;
    if (matchIndex >= 0) used.add(matchIndex);
    const existing = matchIndex >= 0 ? project.chapters[matchIndex] : undefined;
    const body = existing?.body
      ? retitleChapterBody(removeGeneratedChapterMetadata(existing.body), title, index + 1)
      : `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${escapeHtml(title)}</h1>`;
    const plan = chapterPlans[index];
    const reconciled: Chapter = {
      id: index + 1,
      title,
      pages: plan?.recommendedPages ?? existing?.pages ?? defaultPages,
      status: existing?.status || "planned" as const,
      locked: false,
      sourceRefs: sections[index] ? [sections[index]] : (existing?.sourceRefs ?? []),
      body,
      imageKey: existing?.imageKey,
      imageUrl: existing?.imageUrl,
      imageCaption: existing?.imageCaption,
      imageAlt: existing?.imageAlt,
      visualType: existing?.visualType,
      wordCount: existing?.wordCount,
      generationProfile: existing?.generationProfile,
      generationStatus: existing?.generationStatus || (existing?.pedagogyQuality?.status === "passed" ? "Completed" : "Waiting"),
      generationUsage: existing?.generationUsage,
      generationError: existing?.generationError,
      phase7Evaluation: existing?.phase7Evaluation,
      generationRuns: existing?.generationRuns,
      manualApproved: existing?.manualApproved,
      manualApprovedAt: existing?.manualApprovedAt,
      sourceStartPage: plan?.sourceStartPage ?? existing?.sourceStartPage,
      sourceEndPage: plan?.sourceEndPage ?? existing?.sourceEndPage,
      sourcePageCount: plan?.sourcePageCount ?? existing?.sourcePageCount,
      sourceWordCount: plan?.sourceWordCount ?? existing?.sourceWordCount,
      complexityScore: plan?.complexityScore ?? existing?.complexityScore,
      complexity: plan?.complexity ?? existing?.complexity,
      keyTerms: plan?.keyTerms ?? existing?.keyTerms,
      context: plan?.context ?? existing?.context,
      recommendedPages: plan?.recommendedPages ?? existing?.recommendedPages,
      pageReason: plan?.pageReason ?? existing?.pageReason,
      pagePlanCustom: plan ? false : existing?.pagePlanCustom,
    };
    return plan ? applyAutomaticAdaptationPlan([reconciled], project.audience, true)[0] : reconciled;
  });
  return fitChaptersToBookLimit(reconciled);
}

function repairChapterHierarchy(chapters: Chapter[]) {
  const chapterLabels = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => isChapterLabel(chapter.title));
  if (!chapterLabels.length) return { chapters, repaired: false };

  const repaired = chapterLabels.flatMap(({ chapter: labelChapter, index }, repairedIndex) => {
    const titleChapter = chapters[index + 1];
    if (!titleChapter || isChapterLabel(titleChapter.title) || /^(contents|preface|foreword|introduction|references|bibliography|index)$/i.test(titleChapter.title.trim())) return [];
    const title = titleChapter.title.trim();
    const preferredBody = chapterWordCount(titleChapter) >= 40 ? titleChapter.body : labelChapter.body;
    return [{
      ...titleChapter,
      id: repairedIndex + 1,
      title,
      pages: Math.max(labelChapter.pages || 0, titleChapter.pages || 0, 2),
      locked: false,
      status: labelChapter.status === "approved" || titleChapter.status === "approved" ? "approved" as const : titleChapter.status,
      sourceRefs: [...labelChapter.sourceRefs, ...titleChapter.sourceRefs].filter((ref, refIndex, refs) => refs.findIndex((item) => item.page === ref.page && item.title === ref.title) === refIndex),
      body: retitleChapterBody(preferredBody, title, repairedIndex + 1),
    }];
  });
  return repaired.length ? { chapters: repaired, repaired: true } : { chapters, repaired: false };
}

function normalizeProject(saved: Project): Project {
  const { maxPages: _removedLegacyPageLimit, ...savedWithoutPageLimit } = saved as Project & { maxPages?: number };
  void _removedLegacyPageLimit;
  const cleanSaved = savedWithoutPageLimit as Project;
  const persona = cleanSaved.bookPersona ?? inferBookPersona({ title: cleanSaved.title, sourcePreview: cleanSaved.sourcePreview, sourceTerms: cleanSaved.sourceTerms, sourceHeadings: cleanSaved.sourceHeadings, bookType: cleanSaved.bookType });
  const reader = childAudienceProfile(cleanSaved.audience ?? "");
  const writing = naturalWritingProfile(reader.value);
  const design = childDesignWorld(cleanSaved.bookPersona ? cleanSaved.aesthetic : persona.aesthetic);
  const savedPages = pageAesthetic(cleanSaved.pageAesthetic ?? "");
  const pages = cleanSaved.bookPersona ? savedPages : pageAesthetic(persona.pageAesthetic);
  const savedBorder = bookBorder(cleanSaved.bookBorder ?? "");
  const border = cleanSaved.bookPersona ? savedBorder : bookBorder(persona.bookBorder);
  const watermark = pageWatermark(cleanSaved.bookPersona ? cleanSaved.pageWatermark : persona.pageWatermark);
  const savedTypography = typographyTheme(cleanSaved.fontTheme ?? "");
  const typography = cleanSaved.bookPersona ? savedTypography : typographyTheme(persona.fontTheme);
  const childFirstSaved: Project = {
    ...emptyProject,
    ...cleanSaved,
    adaptationPlanVersion: cleanSaved.adaptationPlanVersion ?? 1,
    audience: reader.value,
    readingLevel: reader.readingLevel,
    bookType: "Illustrated children’s adaptation",
    bookPersona: persona,
    adaptation: "Faithful children’s adaptation",
    citationStyle: "Source notes for grown-ups",
    learningFeatures: [...writing.learningFeatures],
    aesthetic: design.value,
    pageAesthetic: pages.value,
    bookBorder: border.value,
    pageWatermark: watermark.value,
    illustrationStyle: cleanSaved.bookPersona ? (cleanSaved.illustrationStyle || persona.illustrationStyle) : persona.illustrationStyle,
    fontTheme: typography.value,
    imageFrequency: reader.imageFrequency,
    canvaPages: cleanSaved.canvaPages ?? [],
    designerPages: (cleanSaved.designerPages ?? []).map(hydrateDesignerOverride),
    designerPageOrder: cleanSaved.designerPageOrder ?? [],
    designerPresets: cleanSaved.designerPresets ?? [],
    creationMode: cleanSaved.creationMode ?? "automatic",
    externalManuscript: cleanSaved.externalManuscript,
  };
  const normalizedChapters = (cleanSaved.chapters ?? []).map((chapter, index) => {
    const title = chapter.title || `Chapter ${index + 1}`;
    return {
      id: chapter.id ?? index + 1,
      title,
      pages: chapter.pages || 6,
      status: chapter.status || "planned",
      locked: false,
      sourceRefs: chapter.sourceRefs ?? [],
      body: removeGeneratedChapterMetadata(chapter.body || `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${title}</h1>`),
      imageKey: chapter.imageKey,
      imageUrl: chapter.imageUrl,
      imageCaption: chapter.imageCaption,
      imageAlt: chapter.imageAlt,
      visualType: chapter.visualType,
      wordCount: chapter.wordCount,
      generationProfile: chapter.generationProfile,
      sourceStartPage: chapter.sourceStartPage,
      sourceEndPage: chapter.sourceEndPage,
      sourcePageCount: chapter.sourcePageCount,
      sourceWordCount: chapter.sourceWordCount,
      complexityScore: chapter.complexityScore,
      complexity: chapter.complexity,
      keyTerms: chapter.keyTerms,
      context: chapter.context,
      recommendedPages: chapter.recommendedPages,
      pageReason: chapter.pageReason,
      pagePlanCustom: chapter.pagePlanCustom,
      pedagogyQuality: chapter.pedagogyQuality,
      importedPages: chapter.importedPages?.map((page) => ({ ...page, body: authorialReaderHtml(page.body) })),
      importValidated: Boolean(chapter.importValidated),
      generationStatus: chapter.generationStatus || (chapter.importValidated || chapter.pedagogyQuality?.status === "passed" ? "Completed" : "Waiting"),
      generationUsage: chapter.generationUsage,
      generationError: chapter.generationError,
      repairAttempts: chapter.repairAttempts,
      phase7Evaluation: chapter.phase7Evaluation,
      generationRuns: chapter.generationRuns ?? [],
      manualApproved: Boolean(chapter.manualApproved),
      manualApprovedAt: chapter.manualApprovedAt,
    };
  });
  const hierarchy = repairChapterHierarchy(normalizedChapters);
  // Chapter labels and their following titles are merged above. Attach curated
  // art only after that repair so every final chapter title receives its own
  // matching illustration, including already-saved projects.
  const visualProject = childFirstSaved;
  const illustratedChapters = fitChaptersToBookLimit(attachChapterVisuals(visualProject, hierarchy.chapters));
  return {
    ...emptyProject,
    ...childFirstSaved,
    sourcePreview: cleanSaved.sourcePreview ?? "",
    sourceSections: cleanSaved.sourceSections ?? [],
    illustrationStyle: childFirstSaved.illustrationStyle,
    fontTheme: typography.value,
    citationStyle: cleanSaved.citationStyle ?? "Source page notes",
    learningFeatures: [...writing.learningFeatures],
    briefApproved: cleanSaved.briefApproved ?? false,
    adaptationPlanConfirmed: cleanSaved.adaptationPlanConfirmed ?? Boolean((cleanSaved as Project & { summaryLengthConfirmed?: boolean }).summaryLengthConfirmed),
    sourceHeadings: hierarchy.repaired ? illustratedChapters.map((chapter) => chapter.title) : (cleanSaved.sourceHeadings ?? []),
    chapters: illustratedChapters,
    canvaPages: cleanSaved.canvaPages ?? [],
    designerPages: (cleanSaved.designerPages ?? []).map(hydrateDesignerOverride),
    designerPageOrder: cleanSaved.designerPageOrder ?? [],
    designerPresets: cleanSaved.designerPresets ?? [],
  };
}

function makeId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `${Date.now().toString(36)}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function ownerHeaders() {
  let owner = window.localStorage.getItem("iks-book-studio-owner");
  if (!owner) {
    owner = makeId();
    window.localStorage.setItem("iks-book-studio-owner", owner);
  }
  return { "x-book-studio-owner": owner };
}

async function uploadSourceForAnalysis(file: File, projectId: string, audience: string, onProgress?: (progress: number) => void): Promise<SourceResult> {
  const shouldChunkPdf = file.type === "application/pdf" && file.size > SAFE_OCR_CHUNK_BYTES;
  if (!shouldChunkPdf) {
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", projectId);
    form.set("audience", audience);
    const response = await fetch("/api/source", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { source?: SourceResult; error?: string };
    if (!response.ok || !data.source) throw new Error(data.error || "Source upload failed");
    return data.source;
  }
  const { PDFDocument } = await import("pdf-lib");
  const original = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  const uploadId = makeId();
  const initialRanges = pdfChunkRanges(original.getPageCount(), SAFE_OCR_CHUNK_PAGES);
  const prepared: Array<{ startPage: number; endPage: number; bytes: Uint8Array }> = [];
  async function prepareRange(startPage: number, endPage: number): Promise<void> {
    const part = await PDFDocument.create();
    const indices = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage - 1 + index);
    const copied = await part.copyPages(original, indices);
    copied.forEach((page) => part.addPage(page));
    const bytes = await part.save({ useObjectStreams: true });
    if (bytes.byteLength > SAFE_OCR_CHUNK_BYTES && startPage < endPage) {
      const midpoint = Math.floor((startPage + endPage) / 2);
      await prepareRange(startPage, midpoint);
      await prepareRange(midpoint + 1, endPage);
      return;
    }
    if (bytes.byteLength > SAFE_OCR_CHUNK_BYTES && startPage === endPage) {
      throw new Error(`Source page ${startPage} is too large for reliable OCR. Export that page at a smaller image size, then upload the PDF again.`);
    }
    prepared.push({ startPage, endPage, bytes });
  }
  for (const range of initialRanges) await prepareRange(range.startPage, range.endPage);
  prepared.sort((a, b) => a.startPage - b.startPage);
  const chunks: Array<{ key: string; startPage: number; endPage: number; size: number; pageTexts: string[] }> = [];
  for (let chunkIndex = 0; chunkIndex < prepared.length; chunkIndex += 1) {
    const range = prepared[chunkIndex];
    const bytes = range.bytes;
    const form = new FormData();
    form.set("file", new File([bytes.slice().buffer], `source-${range.startPage}-${range.endPage}.pdf`, { type: "application/pdf" }));
    form.set("projectId", projectId);
    form.set("uploadId", uploadId);
    form.set("index", String(chunkIndex));
    form.set("startPage", String(range.startPage));
    form.set("endPage", String(range.endPage));
    const response = await fetch("/api/source/chunk", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { chunk?: typeof chunks[number]; error?: string };
    if (!response.ok || !data.chunk) throw new Error(data.error || `Could not upload pages ${range.startPage}–${range.endPage}`);
    chunks.push(data.chunk);
    onProgress?.(Math.round((chunkIndex + 1) / prepared.length * 75));
  }
  const response = await fetch("/api/source/finalize", { method: "POST", headers: { "content-type": "application/json", ...ownerHeaders() }, body: JSON.stringify({ projectId, uploadId, name: file.name, size: file.size, pages: original.getPageCount(), chunks, audience }) });
  const data = await response.json() as { source?: SourceResult; error?: string };
  if (!response.ok || !data.source) throw new Error(data.error || "Could not assemble the uploaded source");
  onProgress?.(100);
  return data.source;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function packagePageHtml(text: string, purpose: string, pageNumber: number) {
  const blocks = text.trim().split(/\n{2,}/).filter(Boolean).map((block) => {
    const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (/^#{1,3}\s+/.test(lines[0] || "")) return `<h2>${escapeHtml(lines.join(" ").replace(/^#{1,3}\s+/, ""))}</h2>`;
    return `<p>${escapeHtml(lines.join(" "))}</p>`;
  }).join("");
  return authorialReaderHtml(`<div data-imported-page="${pageNumber}"><p class="page-purpose">${escapeHtml(purpose)}</p>${blocks}</div>`);
}

function safeDownloadName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "children-book";
}

function packageTemplate(project: Project): BookPackage {
  return {
    format: BOOK_PACKAGE_FORMAT,
    bookTitle: project.title,
    audience: project.audience,
    chapters: project.chapters.map((chapter, chapterIndex) => ({
      chapterId: expectedChapterId(chapterIndex + 1),
      chapterNumber: chapterIndex + 1,
      title: chapter.title,
      contextKey: expectedContextKey(chapterIndex + 1, chapter.title),
      pages: [],
    })),
  };
}

function chatGptBookInstructions(project: Project) {
  return `IKS BOOK STUDIO — CHATGPT BOOK REQUEST

You are creating a complete, illustrated children's adaptation from the source file inside this ZIP.

The designer should only need to do two things in ChatGPT:
1. Ask you to show a concise chapter plan and wait for approval.
2. After approval, ask you to create the complete book and return one ZIP.

BOOK SETTINGS
- Audience: ${project.audience}
- Language: ${project.language}
- Maximum total length: 100 pages including front and back matter
- Illustration style: ${project.illustrationStyle}
- Visual world: ${project.aesthetic}
- Image frequency: ${project.imageFrequency}

NON-NEGOTIABLE CONTENT RULES
- Read the complete source before planning.
- Keep every concept in its correct chapter. Do not move Chapter 1 material into Chapter 3.
- Use the chapter IDs, order, titles and context keys in book-request.json exactly.
- For each chapter plan, state: what belongs here, what does not belong here, pages and images.
- Wait for the exact words PLAN APPROVED before writing final pages or generating images.
- Write as the author of a finished children's book. Never mention the PDF, source, adaptation process, ChatGPT or AI to readers.
- Preserve facts; do not invent information. Explain mature historical topics safely and non-graphically.
- Give every page one clear purpose. Do not pad the book to reach 100 pages.
- Generate final illustrations only after the plan is approved. Keep style and recurring characters consistent.

FINAL DELIVERY
- Return exactly one ZIP named Completed-Children-Book.zip.
- The ZIP must contain book.json and an images folder with every actual PNG, JPG or WebP file.
- book.json must follow output-template.json exactly. Add as many page objects as the approved plan needs; do not leave template or placeholder text.
- Each image.fileName in book.json must be the image's basename, such as chapter-01-page-02.webp.
- Every pageId and image filename must begin with its correct chapter ID.
- Do not return image prompts, Markdown image links or descriptions instead of the actual image files.
- Before delivery, verify chapter order, page IDs, image files, missing content, duplicate text, age fit and the 100-page ceiling.

First response: show only the chapter plan in a simple table, then stop and ask for approval.`;
}

function chapterWordCount(chapter: Chapter) {
  return chapter.body.replace(/<[^>]+>/g, " ").match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0;
}

function pedagogyAverage(quality?: PedagogyQuality) {
  if (!quality) return 0;
  const values = Object.values(quality.scores);
  return Math.round(values.reduce((sum, score) => sum + score, 0) / Math.max(1, values.length));
}

function chapterGenerationState(chapter: Chapter): ChapterGenerationStatus {
  return chapter.generationStatus || (chapter.importValidated || chapter.pedagogyQuality?.status === "passed" ? "Completed" : "Waiting");
}

function isPublishApproved(chapter: Chapter) {
  return Boolean(chapter.importValidated || chapter.manualApproved || chapter.pedagogyQuality?.status === "passed" || chapterGenerationState(chapter) === "Designer handoff");
}

function emptyUsage(): GenerationUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, requests: 0 };
}

function latestGenerationRun(chapter: Chapter) {
  return chapter.generationRuns?.at(-1);
}

function finishGenerationRun(chapter: Chapter, runId: string | undefined, status: GenerationRun["status"], usage: GenerationUsage | undefined, error?: string, durationMs?: number): GenerationRun[] {
  const runs = [...(chapter.generationRuns ?? [])];
  const index = runId ? runs.findIndex((run) => run.id === runId) : runs.length - 1;
  const nextUsage = { ...emptyUsage(), ...usage, requests: usage?.requests || 0 };
  if (index >= 0) runs[index] = { ...runs[index], status, usage: nextUsage, completedAt: new Date().toISOString(), error, durationMs };
  else runs.push({ id: runId || makeId(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status, usage: nextUsage, error, durationMs });
  return runs.slice(-50);
}

const qualityScoreLabels: Record<string, string> = {
  context: "Context",
  coherence: "Coherence",
  ageFit: "Age fit",
  pedagogy: "Teaching",
  sourceFidelity: "Accuracy",
};

function generationTotals(chapters: Chapter[]): GenerationUsage {
  return chapters.reduce<GenerationUsage>((total, chapter) => ({
    inputTokens: total.inputTokens + (chapter.generationUsage?.inputTokens || 0),
    outputTokens: total.outputTokens + (chapter.generationUsage?.outputTokens || 0),
    totalTokens: total.totalTokens + (chapter.generationUsage?.totalTokens || 0),
    reasoningTokens: total.reasoningTokens + (chapter.generationUsage?.reasoningTokens || 0),
    requests: total.requests + (chapter.generationUsage?.requests || 0),
  }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, requests: 0 });
}

function printableChapters(chapters: Chapter[]) {
  const seenParagraphs = new Set<string>();
  let duplicatesRemoved = 0;
  const cleaned = chapters.map((chapter) => ({
    ...chapter,
    body: authorialReaderHtml(chapter.body).replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (paragraph, attributes: string, content: string) => {
      if (/\bclass\s*=/i.test(attributes)) return paragraph;
      const signature = content
        .replace(/<[^>]+>/g, " ")
        .replace(/&\w+;|&#\d+;/g, " ")
        .toLowerCase()
        .match(/[\p{L}\p{N}’'-]+/gu)?.slice(0, 55).join(" ") ?? "";
      if (signature.length < 90) return paragraph;
      if (seenParagraphs.has(signature)) {
        duplicatesRemoved += 1;
        return "";
      }
      seenParagraphs.add(signature);
      return paragraph;
    }),
  }));
  return { chapters: cleaned, duplicatesRemoved };
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [project, setProject] = useState<Project>(seedProject);
  const [projects, setProjects] = useState<Project[]>([seedProject]);
  const [activeChapter, setActiveChapter] = useState(1);
  const [wizardStep, setWizardStep] = useState(0);
  const [toast, setToast] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showDesigner, setShowDesigner] = useState(false);
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showPackageImport, setShowPackageImport] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [versions, setVersions] = useState<{ label: string; date: string; snapshot: Project }[]>([]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceProgress, setSourceProgress] = useState(0);
  const [draftBusy, setDraftBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [designerPreferences, setDesignerPreferences] = useState<string[]>([]);
  const [aiRequest, setAiRequest] = useState<{ action: string; prompt: string; selection: string; result: string } | null>(null);
  const [connection, setConnection] = useState<NemotronConnection>({ state: "idle", message: "Not tested" });
  const [comparison, setComparison] = useState<ChapterComparison | null>(null);
  const [bookPaused, setBookPaused] = useState(false);
  const pauseAfterCurrentRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let owner = window.localStorage.getItem("iks-book-studio-owner");
    if (!owner) {
      owner = makeId();
      window.localStorage.setItem("iks-book-studio-owner", owner);
    }
    const headers = { "x-book-studio-owner": owner };
    void Promise.all([
      fetch("/api/projects", { headers }).then((response) => response.ok ? response.json() : null),
      fetch("/api/preferences", { headers }).then((response) => response.ok ? response.json() : null),
    ]).then(([bookData, preferenceData]: [{ projects: Project[] } | null, { preferences: string[] } | null]) => {
      if (bookData?.projects.length) {
        const restored = bookData.projects.map(normalizeProject);
        setProjects(restored);
        setProject(restored[0]);
        const repaired = restored.filter((item, index) => {
          const original = bookData.projects[index];
          return item.chapters.length !== original.chapters.length
            || item.chapters.some((chapter, chapterIndex) => chapter.title !== original.chapters[chapterIndex]?.title || chapter.pages !== original.chapters[chapterIndex]?.pages);
        });
        void Promise.all(repaired.map((item) => fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(item),
        }))).catch(() => undefined);
      }
      if (preferenceData?.preferences) setDesignerPreferences(preferenceData.preferences);
    }).catch(() => undefined);
  }, []);

  function requestHeaders() { return { "content-type": "application/json", ...ownerHeaders() }; }

  const active = project.chapters.find((chapter) => chapter.id === activeChapter) ?? project.chapters[0];
  const allocatedPages = useMemo(() => totalBookPages(project.chapters), [project.chapters]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };
  const patchProject = (patch: Partial<Project>) => setProject((current) => {
    let next = { ...current, ...patch };
    if ("audience" in patch && !current.adaptationPlanConfirmed) next = { ...next, chapters: applyAutomaticAdaptationPlan(next.chapters, next.audience) };
    const designChanged = ["aesthetic", "pageAesthetic", "bookBorder", "pageWatermark", "fontTheme", "illustrationStyle"].some((key) => key in patch);
    if (designChanged && !("bookPersona" in patch)) next = { ...next, bookPersona: { ...current.bookPersona, aesthetic: next.aesthetic, pageAesthetic: next.pageAesthetic, bookBorder: next.bookBorder, pageWatermark: next.pageWatermark, fontTheme: next.fontTheme, illustrationStyle: next.illustrationStyle, autoSelected: false, rationale: "Customised by the publisher after source-led selection." } };
    if (designChanged || "bookPersona" in patch) return { ...next, chapters: attachChapterVisuals(next, next.chapters) };
    return next;
  });

  function startNewBook() {
    setProject({ ...emptyProject, id: makeId(), editorialPreferences: [...designerPreferences], chapters: emptyProject.chapters.map((chapter) => ({ ...chapter })) });
    setWizardStep(0);
    setView("wizard");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    // Legacy equivalent before Book Persona: const chapters = attachChapterVisuals({ ...project, sourceTerms: source.terms }, applyAutomaticAdaptationPlan(sourceChapters, project.audience, true))
    const file = event.target.files?.[0];
    if (!file) return;
    if (project.creationMode === "external") {
      patchProject({ source: file.name, title: project.title === "Untitled adaptation" ? file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") : project.title, sourceSize: file.size, sourceQuality: "External AI will read this source" });
      notify(`${file.name} selected. You will upload it directly to your chosen AI with the Book Studio prompt.`);
      return;
    }
    setSourceBusy(true);
    patchProject({ source: file.name, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), sourceSize: file.size });
    try {
      const source = await uploadSourceForAnalysis(file, project.id || makeId(), project.audience, setSourceProgress);
      const headings = source.headings;
      const persona = inferBookPersona({ title: file.name.replace(/\.[^.]+$/, ""), sourcePreview: source.preview, sourceTerms: source.terms, sourceHeadings: headings, bookType: project.bookType }, projects.filter((item) => item.id !== project.id).map((item) => item.bookPersona?.signature).filter(Boolean));
      const sourceChapters: Chapter[] = headings.map((title, index) => chapterFromContextPlan(title, index, source.sections[index], source.chapterPlans[index], project.audience));
      const personaProject = { ...project, ...bookPersonaPatch(persona), sourceTerms: source.terms };
      const chapters = attachChapterVisuals(personaProject, applyAutomaticAdaptationPlan(sourceChapters, project.audience, true));
      patchProject({
        source: source.name,
        sourceSize: source.size,
        sourceObjectKey: source.objectKey,
        sourcePages: source.pages,
        sourceWords: source.words,
        sourceQuality: source.quality,
        sourceHeadings: headings,
        sourceTerms: source.terms,
        sourceSections: source.sections,
        sourcePreview: source.preview,
        sourceIntelligence: source.sourceIntelligence,
        ...bookPersonaPatch(persona),
        briefApproved: false,
        adaptationPlanConfirmed: false,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        chapters,
      });
      notify(source.sourceIntelligence?.status === "ocr-required" ? `${file.name} uploaded. Choose an OCR method to detect its real structure.` : `${file.name} analysed successfully`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not analyse this source");
    } finally {
      setSourceBusy(false);
      setSourceProgress(0);
    }
  }

  async function refreshSource(file: File) {
    // Legacy equivalent before Book Persona: chapters: attachChapterVisuals({ ...project, sourceTerms: source.terms }, reconcileOriginalChapters(project, titles, source.sections, source.chapterPlans))
    setSourceBusy(true);
    try {
      const source = await uploadSourceForAnalysis(file, project.id, project.audience, setSourceProgress);
      const titles = source.sourceIntelligence?.status === "ocr-required" ? [] : source.headings.length ? source.headings : project.sourceHeadings;
      const persona = inferBookPersona({ title: project.title, sourcePreview: source.preview, sourceTerms: source.terms, sourceHeadings: titles, bookType: project.bookType }, projects.filter((item) => item.id !== project.id).map((item) => item.bookPersona?.signature).filter(Boolean));
      const personaProject = { ...project, ...bookPersonaPatch(persona), sourceTerms: source.terms };
      const next = {
        ...project,
        ...bookPersonaPatch(persona),
        source: source.name,
        sourceSize: source.size,
        sourceObjectKey: source.objectKey,
        sourcePages: source.pages,
        sourceWords: source.words,
        sourceQuality: source.quality,
        sourceHeadings: titles,
        sourceTerms: source.terms,
        sourceSections: source.sections,
        sourcePreview: source.preview,
        sourceIntelligence: source.sourceIntelligence,
        adaptationPlanConfirmed: false,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        briefApproved: false,
        chapters: source.sourceIntelligence?.status === "ocr-required" ? [] : attachChapterVisuals(personaProject, reconcileOriginalChapters(project, titles, source.sections, source.chapterPlans)),
      };
      setProject(next);
      await persistProject(next);
      setView("analysis");
      notify("Original chapters re-detected and adaptation pages recommended.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not refresh the source");
    } finally {
      setSourceBusy(false);
      setSourceProgress(0);
    }
  }

  async function runSourceOcr(engine: "cloudflare-ai" | "mistral-ocr") {
    if (!project.sourceObjectKey) return notify("Upload the source first");
    setSourceBusy(true);
    const totalBatches = Math.max(1, project.sourceIntelligence?.ocrBatchesTotal || 1);
    let latest = { ...(project.sourceIntelligence as SourceIntelligence), status: "reading-contents" as const, progress: 25, message: `${engine === "mistral-ocr" ? "Accurate" : "Free"} OCR is preparing ${totalBatches} safe batch${totalBatches === 1 ? "" : "es"}…`, ocrEngine: engine, ocrBatchesTotal: totalBatches };
    patchProject({ sourceIntelligence: latest });
    try {
      for (let chunkIndex = 0; chunkIndex < totalBatches; chunkIndex += 1) {
        latest = { ...latest, currentBatchLabel: `Batch ${chunkIndex + 1} of ${totalBatches}`, message: `Reading source batch ${chunkIndex + 1} of ${totalBatches}. Completed batches remain cached.` };
        patchProject({ sourceIntelligence: latest });
        const batchResponse = await fetch("/api/source/ocr-chunk", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ sourceObjectKey: project.sourceObjectKey, engine, chunkIndex }) });
        const batchData = await batchResponse.json() as { sourceIntelligence?: SourceIntelligence; error?: string; code?: string; cached?: boolean };
        if (!batchResponse.ok || !batchData.sourceIntelligence) throw new Error(batchData.error || `OCR stopped at batch ${chunkIndex + 1} of ${totalBatches}. Completed batches remain saved.`);
        latest = batchData.sourceIntelligence;
        patchProject({ sourceIntelligence: latest });
      }
      latest = { ...latest, progress: 70, message: "OCR is cached. Nemotron is detecting Parts, chapters and physical page ranges…", currentBatchLabel: "Structure analysis" };
      patchProject({ sourceIntelligence: latest });
      const response = await fetch("/api/source/intelligence", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ sourceObjectKey: project.sourceObjectKey, engine }) });
      const data = await response.json() as { sourceIntelligence?: SourceIntelligence; error?: string; code?: string };
      if (!response.ok || !data.sourceIntelligence) throw new Error(data.error || "Nemotron could not detect the source outline");
      patchProject({ sourceIntelligence: data.sourceIntelligence });
      notify("Nemotron detected the source outline. Review the names and page ranges.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR could not detect the outline";
      patchProject({ sourceIntelligence: { ...latest, status: /quota|credit/i.test(message) ? "paused" : "ocr-required", message, lastError: message } });
      notify(error instanceof Error ? error.message : "OCR failed");
    } finally { setSourceBusy(false); }
  }

  function updateSourceOutline(outline: SourceOutlineItem[]) {
    if (!project.sourceIntelligence) return;
    patchProject({ sourceIntelligence: { ...project.sourceIntelligence, outline } });
  }

  function acceptSourceOutline(mode: OutlineMode) {
    if (!project.sourceIntelligence) return;
    const selected = outlineForMode(project.sourceIntelligence.outline, mode).filter((item) => item.included);
    if (!selected.length) return notify("Include at least one detected Part or chapter");
    const plans: ChapterContextPlan[] = selected.map((item) => {
      const sourcePageCount = Math.max(1, item.sourceEndPage - item.sourceStartPage + 1);
      const seed = { title: item.title, sourceStartPage: item.sourceStartPage, sourceEndPage: item.sourceEndPage, sourcePageCount, sourceWordCount: sourcePageCount * 260, complexityScore: .55, complexity: "Concept-rich" as const, keyTerms: item.title.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 4).slice(0, 5) || [], context: `Verified source range pp. ${item.sourceStartPage}–${item.sourceEndPage}.`, recommendedPages: 4, pageReason: `Source-led adaptation of ${sourcePageCount} scanned pages. The chapter itself will be sent to Nemotron only when generated.` };
      return { ...seed, recommendedPages: recommendedAdaptationPages(seed, project.audience) };
    });
    const sourceChapters = selected.map((item, index) => chapterFromContextPlan(item.title, index, undefined, plans[index], project.audience));
    const persona = inferBookPersona({ title: project.title, sourcePreview: selected.map((item) => item.title).join(" "), sourceTerms: project.sourceTerms, sourceHeadings: selected.map((item) => item.title), bookType: project.bookType }, projects.filter((item) => item.id !== project.id).map((item) => item.bookPersona?.signature).filter(Boolean));
    const personaProject = { ...project, ...bookPersonaPatch(persona) };
    patchProject({ sourceHeadings: selected.map((item) => item.title), chapters: attachChapterVisuals(personaProject, applyAutomaticAdaptationPlan(sourceChapters, project.audience, true)), sourceIntelligence: { ...project.sourceIntelligence, status: "ready", structureMode: mode, progress: 100, message: `${selected.length} verified ${mode === "parts" ? "Parts" : "chapters"} are ready for generation.` }, ...bookPersonaPatch(persona), adaptationPlanConfirmed: false, briefApproved: false });
    notify(`${selected.length} source-led chapters prepared from the verified outline`);
  }

  async function persistProject(next: Project) {
    const pruned = {
      ...next,
      designerPages: (next.designerPages ?? []).map((page) => {
        const cleanHistory = (page.history ?? []).slice(0, 5).map((entry) => {
          const { history: _ignored, ...rest } = entry as unknown as Record<string, unknown> & typeof entry;
          return rest as unknown as typeof entry;
        });
        return { ...page, history: cleanHistory as unknown as typeof page.history };
      }),
      chapters: fitChaptersToBookLimit(next.chapters),
    };
    const bounded = pruned;
    const response = await fetch("/api/projects", { method: "POST", headers: requestHeaders(), body: JSON.stringify(bounded) });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || `Could not save the book (${response.status})`);
    }
    const data = await response.json() as { project: Project };
    setProject(data.project);
    setProjects((current) => [data.project, ...current.filter((item) => item.id !== data.project.id)]);
  }

  async function acceptExternalManuscript(result: ExternalManuscriptResult, fileName: string) {
    const importedChapters: Chapter[] = result.sections.map((section, index) => {
      const targetWords = /7.?9/.test(project.audience) ? 185 : /13.?15/.test(project.audience) ? 285 : 235;
      const pages = Math.max(1, Math.min(7, Math.ceil(section.wordCount / targetWords)));
      const visibleTitle = section.title || `${section.kind[0].toUpperCase()}${section.kind.slice(1)}`;
      return {
        id: index + 1,
        title: visibleTitle,
        pages,
        recommendedPages: pages,
        status: "approved",
        generationStatus: "Completed",
        locked: false,
        sourceRefs: [],
        body: `<p class="chapter-kicker">${section.kind === "chapter" ? `CHAPTER ${String(index + 1).padStart(2, "0")}` : section.kind.toUpperCase()}</p><h1>${visibleTitle}</h1>${section.html}`,
        context: section.raw.replace(/[#*_]/g, " ").replace(/\s+/g, " ").slice(0, 280),
        keyTerms: section.title.toLowerCase().match(/[\p{L}\p{N}’'-]+/gu)?.filter((word) => word.length > 4).slice(0, 6) || [],
        sourceWordCount: section.wordCount,
        wordCount: section.wordCount,
        pageReason: `Imported from the approved external-AI manuscript; ${section.wordCount} reader-facing words.`,
        imageCaption: section.illustrationBrief,
        imageAlt: section.illustrationBrief ? `Planned illustration for ${visibleTitle}` : undefined,
        visualType: section.illustrationBrief ? "Narrative scene" : undefined,
        importValidated: section.issues.length === 0,
        manualApproved: true,
        manualApprovedAt: new Date().toISOString(),
        generationRuns: [],
      };
    });
    const persona = inferBookPersona({ title: result.title || project.title, sourcePreview: result.sections.map((section) => `${section.title} ${section.raw.slice(0, 220)}`).join(" "), sourceHeadings: result.sections.map((section) => section.title), bookType: project.bookType }, projects.filter((item) => item.id !== project.id).map((item) => item.bookPersona?.signature).filter(Boolean));
    const nextBase: Project = {
      ...project,
      title: result.title === "Imported book" ? project.title : result.title,
      sourceHeadings: result.sections.map((section) => section.title),
      sourceWords: result.words,
      sourceQuality: result.issues.length ? "Imported with review notes" : "External manuscript verified",
      sourcePreview: result.sections.map((section) => section.raw).join(" ").slice(0, 8000),
      sourceSections: result.sections.map((section, index) => ({ title: section.title, page: index + 1, excerpt: section.raw.replace(/[#*_]/g, " ").replace(/\s+/g, " ").slice(0, 240) })),
      sourceIntelligence: undefined,
      creationMode: "external",
      externalManuscript: { fileName, importedAt: new Date().toISOString(), totalWords: result.words, issues: [...result.issues, ...result.sections.flatMap((section) => section.issues.map((issue) => `${section.title}: ${issue}`))] },
      briefApproved: true,
      adaptationPlanConfirmed: true,
      adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
      ...bookPersonaPatch(persona),
      chapters: importedChapters,
      updatedAt: "Just now",
    };
    const next = { ...nextBase, chapters: attachChapterVisuals(nextBase, importedChapters) };
    setProject(next);
    setActiveChapter(next.chapters[0]?.id ?? 1);
    await persistProject(next);
    setView("editor");
    notify(`${next.chapters.length} ordered manuscript sections imported. No Nemotron request was used.`);
  }

  async function saveProject() {
    const next = { ...project, updatedAt: "Just now" };
    setProject(next);
    try {
      await persistProject(next);
      notify("Book saved");
    } catch (error) { notify(error instanceof Error ? error.message : "Save failed"); }
  }

  async function openProject(selected: Project) {
    let next = normalizeProject(selected);
    setProject(next);
    setActiveChapter(next.chapters[0]?.id ?? 1);
    const needsContextPlan = Boolean(next.sourceObjectKey) && (next.adaptationPlanVersion !== ADAPTATION_PLAN_VERSION || next.chapters.some((chapter) => !chapter.sourceWordCount || !chapter.sourcePageCount || !chapter.recommendedPages));
    if (next.adaptationPlanConfirmed && !needsContextPlan) {
      setView("editor");
      return;
    }
    setView("analysis");
    if (!next.sourceObjectKey) return;
    setSourceBusy(true);
    try {
      const response = await fetch("/api/source/reanalyse", {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({ source: next.source, sourceObjectKey: next.sourceObjectKey, audience: next.audience }),
      });
      const data = await response.json() as { source?: Omit<SourceResult, "name" | "size" | "objectKey">; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Source re-check failed");
      const awaitingSourceOutline = Boolean(data.source.sourceIntelligence && data.source.sourceIntelligence.status !== "ready");
      const titles = awaitingSourceOutline ? [] : data.source.headings.length ? data.source.headings : next.sourceHeadings;
      const persona = inferBookPersona({ title: next.title, sourcePreview: data.source.preview, sourceTerms: data.source.terms, sourceHeadings: titles, bookType: next.bookType }, projects.filter((item) => item.id !== next.id).map((item) => item.bookPersona?.signature).filter(Boolean));
      const personaProject = { ...next, ...bookPersonaPatch(persona), sourceTerms: data.source.terms };
      next = {
        ...next,
        ...bookPersonaPatch(persona),
        sourcePages: data.source.pages || next.sourcePages,
        sourceWords: data.source.words || next.sourceWords,
        sourceQuality: data.source.quality,
        sourceHeadings: titles,
        sourceTerms: data.source.terms,
        sourceSections: data.source.sections,
        sourcePreview: data.source.preview,
        sourceIntelligence: data.source.sourceIntelligence ?? next.sourceIntelligence,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        adaptationPlanConfirmed: needsContextPlan ? false : next.adaptationPlanConfirmed,
        briefApproved: needsContextPlan ? false : next.briefApproved,
        chapters: awaitingSourceOutline ? [] : attachChapterVisuals(personaProject, reconcileOriginalChapters(next, titles, data.source.sections, data.source.chapterPlans)),
      };
      setProject(next);
      await persistProject(next);
      notify(needsContextPlan ? `${titles.length} chapters replanned at their shortest clear length` : `${titles.length} original chapters detected`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not re-check the original chapters");
    } finally {
      setSourceBusy(false);
    }
  }

  async function confirmAdaptationPlan() {
    const next = { ...project, chapters: fitChaptersToBookLimit(project.chapters), adaptationPlanConfirmed: true, adaptationPlanVersion: ADAPTATION_PLAN_VERSION, briefApproved: false };
    setProject(next);
    setView("brief");
    try { await persistProject(next); } catch { notify("Page choices are kept here; save again when connected"); }
  }

  async function saveChapterBody() {
    if (!active || !editorRef.current) return;
    const html = authorialReaderHtml(editorRef.current.innerHTML);
    const edited = project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body: html, status: "draft" as const, generationStatus: chapterGenerationState(chapter) === "Designer handoff" ? "Designer handoff" as const : "Needs review" as const, generationProfile: "", pedagogyQuality: undefined, importedPages: undefined, importValidated: false } : chapter);
    const next = { ...project, chapters: attachChapterVisuals(project, edited) };
    setProject(next);
    try { await persistProject(next); notify("Chapter updated and saved"); } catch { notify("Chapter changed; save again when connected"); }
  }

  async function aiAction(action: string) {
    const selected = window.getSelection()?.toString().trim();
    const chapterText = authorialReaderHtml(active?.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const sceneDirection = active ? chooseSceneDirection(active.title, active.body, active.id - 1) : "A chapter-specific narrative scene";
    const visualTerms = active ? visualKeywords(active.title, active.body, project.sourceTerms) : project.sourceTerms.slice(0, 5);
    const illustrationAction = action === "Suggest an illustration" || action === "Create chapter illustration";
    const prompt = illustrationAction && active
      ? `Create one original, print-ready illustration for a children’s educational book.

BOOK AND CHAPTER CONTEXT
- Book: ${project.title}
- Chapter ${active.id}: ${active.title}
- Reader age: ${project.audience}
- Reading level: ${project.readingLevel}
- Language: ${project.language}
- Chapter focus: ${active.context || chapterText.slice(0, 1700)}
- Essential concepts to represent: ${visualTerms.join(", ") || "the central idea of the chapter"}

BOOK PERSONA
${project.bookPersona.name} · ${project.bookPersona.family}
Mood: ${project.bookPersona.mood}
Recurring motif: ${project.bookPersona.motif}
Illustration contract: ${project.bookPersona.illustrationStyle}
Cover/composition language: ${project.bookPersona.coverStyle}

NARRATIVE SCENE DIRECTION
- Scene concept: ${sceneDirection}
- Illustration world: ${project.aesthetic}
- Art style: richly detailed hand-painted editorial watercolour and gouache, warm natural light, tactile paper texture, expressive but realistic people, lush environmental detail, polished children’s publishing quality
- Composition: cinematic wide scene with foreground characters actively demonstrating the idea, a meaningful midground action, and a deep contextual background; landscape 4:3 crop suitable for an A4 children’s textbook page
- Make this image visibly different from every other chapter illustration
- Show the meaning of this specific chapter through people, place, objects and action—not a generic decorative scene
- If the topic is historical, use the correct period and region. If it is modern, scientific or imaginary, build the world from that chapter instead of forcing an ancient-India setting
- Match the visual richness and immersive storytelling of a premium illustrated textbook spread

ACCURACY AND CHILD SAFETY
- Keep clothing, architecture, objects and social setting historically and culturally respectful
- Use age-appropriate expressions and avoid frightening violence, stereotypes, caricature or invented religious symbolism
- Do not invent a portrait of a real historical person; use respectful representative characters when identity is uncertain

OUTPUT REQUIREMENTS
- Return one finished illustration only
- Absolutely no map, Venn diagram, timeline, flowchart, concept tree, cycle, infographic, labelled diagram or worksheet layout
- No title, labels, captions, letters, numbers, logos, watermarks, UI, mockup, border or page frame inside the image
- No repeated characters or copied composition from another chapter
- High detail, clean edges, balanced colour, print-safe contrast, 2048 × 1536 pixels or higher`
      : `Edit the children’s book “${project.title}” as its author. ${action}. Audience: ${project.audience}. Reading level: ${project.readingLevel}. Use natural, age-appropriate prose without a themed writing mode. Preserve factual accuracy. ${AUTHORIAL_READER_INSTRUCTION} Text: ${selected || chapterText}`;
    setAiRequest({ action, prompt, selection: selected || "", result: "" });
  }

  async function openVersions() {
    setShowVersions(true);
    try {
      const response = await fetch(`/api/versions?projectId=${encodeURIComponent(project.id)}`, { headers: requestHeaders() });
      if (response.ok) setVersions(((await response.json()) as { versions: typeof versions }).versions);
    } catch { /* modal still works */ }
  }

  async function createVersion() {
    const label = `Editorial checkpoint ${versions.length + 1}`;
    try {
      const response = await fetch("/api/versions", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ projectId: project.id, label, snapshot: project }) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { version: { label: string; date: string; snapshot: Project } };
      setVersions((current) => [data.version, ...current]);
      notify("Version checkpoint created");
    } catch { notify("Version could not be created"); }
  }

  async function preserveGenerationVersion(snapshot: Project, chapter: Chapter) {
    const label = `Before Chapter ${String(chapter.id).padStart(2, "0")} generation`;
    const response = await fetch("/api/versions", {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ projectId: snapshot.id, label, snapshot }),
    });
    if (!response.ok) throw new Error("The previous book version could not be preserved, so generation did not start");
    const data = await response.json() as { version: { label: string; date: string; snapshot: Project } };
    setVersions((current) => [data.version, ...current]);
  }

  async function rememberPreference(scope: "book" | "designer") {
    const preference = window.prompt(scope === "designer" ? "What should be remembered for every future book?" : "What should be remembered for this book?")?.trim();
    if (!preference) return;
    if (scope === "book") {
      const next = { ...project, editorialPreferences: [...project.editorialPreferences, preference] };
      setProject(next);
      await persistProject(next).catch(() => undefined);
      notify("Preference remembered for this book");
      return;
    }
    const preferences = [...designerPreferences, preference];
    setDesignerPreferences(preferences);
    await fetch("/api/preferences", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ preferences }) });
    notify("Preference remembered for future books");
  }

  async function exportDoc() {
    setExportBusy(true);
    try {
      const response = await fetch("/api/export/docx", { method: "POST", headers: requestHeaders(), body: JSON.stringify(project) });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book"}.docx`;
      anchor.click();
      URL.revokeObjectURL(href);
      notify("Editable DOCX downloaded");
    } catch { notify("Could not create the DOCX"); }
    finally { setExportBusy(false); }
  }

  function openPreview() {
    setShowPreview(true);
  }

  async function downloadPdf() {
    const unfinished = project.chapters.filter((chapter) => !isPublishApproved(chapter)).length;
    setShowPreview(true);
    setExportBusy(true);
    setPdfProgress(0);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      await document.fonts?.ready;
      const sheets = Array.from(document.querySelectorAll<HTMLElement>(".pdf-render-stack .book-sheet"));
      if (!sheets.length) throw new Error("Preview pages are not ready");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      for (let index = 0; index < sheets.length; index += 1) {
        const canvas = await html2canvas(sheets[index], { backgroundColor: "#fffdf8", scale: 1.55, useCORS: true, logging: false, imageTimeout: 15000 });
        if (index > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        setPdfProgress(Math.round((index + 1) / sheets.length * 100));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      const safeTitle = project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book";
      pdf.save(`${safeTitle}${unfinished ? "-work-in-progress" : "-complete"}.pdf`);
      notify(unfinished ? `Book PDF downloaded with ${unfinished} unfinished chapter${unfinished === 1 ? "" : "s"}` : "Complete book PDF downloaded");
    } catch {
      notify("The PDF could not be created. Preview remains open so you can inspect the pages.");
    } finally {
      setExportBusy(false);
      setPdfProgress(0);
    }
  }

  function exportPdf() {
    openPreview();
  }

  async function duplicateProject(source: Project) {
    const copy = normalizeProject({ ...source, id: makeId(), title: `${source.title} — Copy`, updatedAt: "Just now" });
    try { await persistProject(copy); notify("Project duplicated"); } catch { notify("Could not duplicate project"); }
  }

  async function deleteProject(source: Project) {
    if (!window.confirm(`Delete “${source.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/projects?id=${encodeURIComponent(source.id)}`, { method: "DELETE", headers: ownerHeaders() });
    if (response.ok) {
      const next = projects.filter((item) => item.id !== source.id);
      setProjects(next.length ? next : [seedProject]);
      notify("Project deleted");
    } else notify("Could not delete project");
  }

  function addChapter() {
    if (project.chapters.length >= CHAPTER_PAGE_BUDGET) { notify("The 100-page safety ceiling cannot fit another chapter start"); return; }
    const id = Math.max(0, ...project.chapters.map((chapter) => chapter.id)) + 1;
    const nextChapter: Chapter = { id, title: `New chapter ${id}`, pages: 6, status: "planned", generationStatus: "Waiting", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ${id}</p><h1>New chapter ${id}</h1><p class="chapter-deck">Develop this chapter with a clear idea, a memorable example and a thoughtful ending.</p>` };
    patchProject({ chapters: fitChaptersToBookLimit(attachChapterVisuals(project, [...project.chapters, nextChapter])) });
    setActiveChapter(id);
    notify("Chapter added");
  }

  async function uploadChapterImage(file: File) {
    if (!active) return;
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", project.id);
    const response = await fetch("/api/image", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { image?: { key: string; url: string }; error?: string };
    if (!response.ok || !data.image) { notify(data.error || "Image upload failed"); return; }
    const updatedChapters = project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, imageKey: data.image?.key, imageUrl: data.image?.url, imageCaption: chapter.imageCaption || chapter.title, imageAlt: `Uploaded illustration for ${chapter.title}`, visualType: "uploaded" } : chapter);
    // Also clear any existing Designer overrides for this chapter so Preview and Designer regenerate from the new chapter image
    const filteredDesignerPages = (project.designerPages ?? []).filter((page) => page.chapterId !== active.id);
    const filteredOrder = (project.designerPageOrder ?? []).filter((slotId) => !slotId.startsWith(`chapter-${active.id}-`));
    const next = { ...project, chapters: updatedChapters, designerPages: filteredDesignerPages, designerPageOrder: filteredOrder };
    setProject(next);
    await persistProject(next).catch(() => undefined);
    notify("Illustration added to chapter — Designer and Preview will now show the new image");
  }

  async function uploadCanvaPage(file: File, slot: Omit<CanvaPageOverride, "active" | "current" | "history">) {
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", project.id);
    const response = await fetch("/api/image", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { image?: { key: string; url: string }; error?: string };
    if (!response.ok || !data.image) throw new Error(data.error || "Canva page upload failed");
    const version: CanvaPageVersion = { imageKey: data.image.key, imageUrl: data.image.url, fileName: file.name, acceptedAt: new Date().toISOString() };
    const existing = (project.canvaPages ?? []).find((page) => page.slotId === slot.slotId);
    const replacement: CanvaPageOverride = {
      ...slot,
      active: true,
      current: version,
      history: existing ? [existing.current, ...existing.history].slice(0, 10) : [],
    };
    const next = { ...project, canvaPages: [...(project.canvaPages ?? []).filter((page) => page.slotId !== slot.slotId), replacement] };
    setProject(next);
    await persistProject(next);
    notify(`${slot.label} now uses the Canva version`);
  }

  async function setCanvaPageActive(slotId: string, active: boolean) {
    const next = { ...project, canvaPages: (project.canvaPages ?? []).map((page) => page.slotId === slotId ? { ...page, active } : page) };
    setProject(next);
    await persistProject(next);
    notify(active ? "Canva version restored" : "Studio version restored");
  }

  async function downloadChatGptBookRequest() {
    if (!project.sourceObjectKey || !project.source) throw new Error("Upload the source book before creating a ChatGPT request.");
    const response = await fetch(`/api/source/download?key=${encodeURIComponent(project.sourceObjectKey)}`, { headers: ownerHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "The source book could not be added to the request.");
    }
    const sourceBytes = new Uint8Array(await response.arrayBuffer());
    const request = {
      format: "iks-chatgpt-book-request-v1",
      projectTitle: project.title,
      sourceFile: project.source,
      settings: {
        audience: project.audience,
        language: project.language,
        maximumTotalPages: TOTAL_BOOK_PAGE_LIMIT,
        illustrationStyle: project.illustrationStyle,
        visualWorld: project.aesthetic,
        imageFrequency: project.imageFrequency,
        pageAesthetic: project.pageAesthetic,
        typography: project.fontTheme,
        border: project.bookBorder,
        watermark: project.pageWatermark,
        bookPersona: project.bookPersona,
      },
      chapters: project.chapters.map((chapter, index) => ({
        chapterId: expectedChapterId(index + 1),
        chapterNumber: index + 1,
        title: chapter.title,
        contextKey: expectedContextKey(index + 1, chapter.title),
        sourcePages: chapter.sourceStartPage && chapter.sourceEndPage ? `${chapter.sourceStartPage}-${chapter.sourceEndPage}` : undefined,
        centralContext: chapter.context || chapter.sourceRefs[0]?.excerpt || "Study this chapter directly from the source.",
        recommendedPages: chapter.recommendedPages || chapter.pages,
      })),
    };
    const archive = zipSync({
      "READ-ME-FIRST.txt": strToU8(chatGptBookInstructions(project)),
      "book-request.json": strToU8(JSON.stringify(request, null, 2)),
      "output-template.json": strToU8(JSON.stringify(packageTemplate(project), null, 2)),
      [`source/${project.source.replace(/[\\/]/g, "-")}`]: sourceBytes,
    }, { level: 6 });
    const href = URL.createObjectURL(new Blob([archive.slice().buffer], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${safeDownloadName(project.title)}-chatgpt-book-request.zip`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function importBookPackage(bookPackage: BookPackage, imageFiles: File[]) {
    const validation = validateBookPackage(bookPackage, project.chapters, project.audience);
    if (!validation.package) throw new Error(validation.errors[0] || "The package does not match this book plan.");
    const filesByName = new Map(imageFiles.map((file) => [file.name, file]));
    const missing = validation.imageNames.filter((name) => !filesByName.has(name));
    if (missing.length) throw new Error(`Missing image file: ${missing[0]}. Select every image listed in the package.`);
    setPackageBusy(true);
    try {
      const uploaded = new Map<string, { key: string; url: string }>();
      for (const fileName of validation.imageNames) {
        const file = filesByName.get(fileName)!;
        const form = new FormData();
        form.set("file", file);
        form.set("projectId", project.id);
        const response = await fetch("/api/image", { method: "POST", headers: ownerHeaders(), body: form });
        const data = await response.json() as { image?: { key: string; url: string }; error?: string };
        if (!response.ok || !data.image) throw new Error(data.error || `Could not upload ${fileName}.`);
        uploaded.set(fileName, data.image);
      }

      const chapters = validation.package.chapters.map((incoming, chapterIndex) => {
        const existing = project.chapters[chapterIndex];
        const importedPages: ImportedPage[] = incoming.pages.map((page) => {
          const asset = page.image ? uploaded.get(page.image.fileName) : undefined;
          return {
            pageId: page.pageId,
            pageNumber: page.pageNumber,
            purpose: page.purpose,
            body: packagePageHtml(page.text, page.purpose, page.pageNumber),
            imageKey: asset?.key,
            imageUrl: asset?.url,
            imageCaption: page.image?.caption || incoming.title,
            imageAlt: page.image?.alt || (page.image ? `Illustration for ${incoming.title}, page ${page.pageNumber}` : undefined),
          };
        });
        const firstImage = importedPages.find((page) => page.imageUrl);
        const body = `<p class="chapter-kicker">CHAPTER ${String(incoming.chapterNumber).padStart(2, "0")}</p><h1>${escapeHtml(incoming.title)}</h1>${importedPages.map((page) => page.body).join("")}`;
        return {
          ...existing,
          id: incoming.chapterNumber,
          title: incoming.title,
          pages: incoming.pages.length,
          recommendedPages: incoming.pages.length,
          pagePlanCustom: true,
          status: "approved" as const,
          generationStatus: "Completed" as const,
          locked: false,
          body: authorialReaderHtml(body),
          wordCount: incoming.pages.reduce((sum, page) => sum + (page.text.match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0), 0),
          generationProfile: generationProfileKey(project.audience, project.language),
          pedagogyQuality: undefined,
          importedPages,
          importValidated: true,
          imageKey: firstImage?.imageKey,
          imageUrl: firstImage?.imageUrl,
          imageCaption: firstImage?.imageCaption,
          imageAlt: firstImage?.imageAlt,
          visualType: firstImage ? "uploaded" : existing.visualType,
        };
      });
      const next = { ...project, title: validation.package.bookTitle || project.title, chapters, briefApproved: true, adaptationPlanConfirmed: true, updatedAt: "Just now" };
      setProject(next);
      setActiveChapter(chapters[0]?.id ?? 1);
      await persistProject(next);
      setShowPackageImport(false);
      setView("editor");
      notify(`${validation.chapterCount} chapters and ${validation.pageCount} pages imported without remapping`);
    } finally {
      setPackageBusy(false);
    }
  }

  async function applyAiResult() {
    if (!aiRequest?.result.trim() || !active) return;
    const replacement = authorialReaderHtml(aiRequest.result.trim().split(/\n{2,}/).map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br/>")}</p>`).join(""));
    let body = replacement;
    if (aiRequest.selection) {
      const escapedSelection = escapeHtml(aiRequest.selection);
      body = active.body.includes(aiRequest.selection)
        ? active.body.replace(aiRequest.selection, replacement)
        : active.body.includes(escapedSelection)
          ? active.body.replace(escapedSelection, replacement)
          : `${active.body}<div class="editorial-insert"><b>EDITORIAL REVISION</b>${replacement}</div>`;
    }
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body, status: "draft" as const, generationStatus: "Needs review" as const, generationProfile: "", pedagogyQuality: undefined, importedPages: undefined, importValidated: false } : chapter) };
    setProject(next);
    setAiRequest(null);
    await persistProject(next).catch(() => undefined);
    notify("ChatGPT revision applied and saved");
  }

  function updateChapter(chapterId: number, patch: Partial<Chapter>) {
    const chapterIndex = project.chapters.findIndex((chapter) => chapter.id === chapterId);
    const chapters = typeof patch.pages === "number" && chapterIndex >= 0
      ? setChapterPagesWithinLimit(project.chapters, chapterIndex, patch.pages, patch)
      : project.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, ...patch } : chapter);
    patchProject({ chapters });
  }

  function draftRequestBody(snapshot: Project, chapterId: number) {
    return JSON.stringify({
      source: snapshot.source,
      sourceObjectKey: snapshot.sourceObjectKey,
      audience: snapshot.audience,
      readingLevel: snapshot.readingLevel,
      language: snapshot.language,
      adaptation: snapshot.adaptation,
      learningFeatures: snapshot.learningFeatures,
      bookPersona: snapshot.bookPersona,
      aesthetic: snapshot.aesthetic,
      illustrationStyle: snapshot.illustrationStyle,
      imageFrequency: snapshot.imageFrequency,
      sourceTerms: snapshot.sourceTerms,
      chapters: snapshot.chapters.map(({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore, pedagogyQuality }) => ({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore, pedagogyQuality })),
      chapterIds: [chapterId],
      phase7ChapterOneOnly: chapterId === 1,
    });
  }

  async function requestDraftChapter(snapshot: Project, chapterId: number, quotaStopped: () => boolean, stopForQuota: () => void) {
    if (quotaStopped()) return { ok: false as const, data: { error: "Generation stopped because the quota was exhausted. Resume the book later.", code: "quota-stop", quota: true, requestCount: 0 } satisfies DraftApiResponse };
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: requestHeaders(),
        body: draftRequestBody(snapshot, chapterId),
      });
      const data = await response.json() as DraftApiResponse;
      const providerRequests = data.usage?.requests || data.requestCount || 0;
      if (response.ok && data.chapters?.length) {
        return {
          ok: true as const,
          data: {
            ...data,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, ...data.usage, requests: providerRequests },
          },
        };
      }
      if (data.quota || response.status === 429 || response.status === 402) {
        stopForQuota();
        return { ok: false as const, data: { ...data, quota: true, requestCount: providerRequests } };
      }
      return { ok: false as const, data: { ...data, requestCount: providerRequests } };
    } catch {
      return { ok: false as const, data: { error: "The website connection failed. Resume from this chapter; completed chapters remain saved. No hidden Nemotron retry was made.", code: "temporary-network", retryable: true, requestCount: 0 } satisfies DraftApiResponse };
    }
  }

  async function prepareDraft(scope: "sample" | "all" | "active" | "thin", options: { chapterId?: number } = {}) {
    pauseAfterCurrentRef.current = false;
    setBookPaused(false);
    const activeIndex = project.chapters.findIndex((chapter) => chapter.id === activeChapter);
    const selectedProfile = generationProfileKey(project.audience, project.language);
    const requestedChapterIds = project.chapters.filter((chapter, index) => {
      if (chapterGenerationState(chapter) === "Designer handoff") return false;
      if (chapterGenerationState(chapter) === "Human review" && (chapter.repairAttempts || 0) >= 3) return false;
      if (typeof options.chapterId === "number") return chapter.id === options.chapterId;
      if (scope === "all") return chapter.generationStatus !== "Completed" || chapter.generationProfile !== selectedProfile;
      if (scope === "sample") return index === 0;
      if (scope === "active") return index === activeIndex;
      return chapterWordCount(chapter) < 350;
    }).map((chapter) => chapter.id);
    const chapterIds = requestedChapterIds;
    if (!chapterIds.length) { notify("Every available chapter has already completed this workflow"); return; }
    setDraftBusy(true);
    let completed = 0;
    let workingProject = project;
    let quotaPause = false;
    let failureReason = "";
    let chapterOneStable = project.chapters.some((chapter) => chapter.id === 1 && chapterGenerationState(chapter) === "Completed" && chapter.generationProfile === selectedProfile);
    const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, requests: 0 };
    const runIds = new Map<number, string>();
    try {
      if (!project.sourceObjectKey) {
        notify("Re-upload the original book to build a meaningfully taught chapter with the AI teaching engine.");
        return;
      }
      let cursor = 0;
      while (cursor < chapterIds.length && !failureReason && !quotaPause) {
        if (pauseAfterCurrentRef.current) break;
        const canRunPair = scope !== "sample" && scope !== "active" && chapterOneStable;
        const batch = chapterIds.slice(cursor, cursor + (canRunPair ? MAX_CONCURRENT_CHAPTERS : 1));

        for (const chapterId of batch) {
          const currentChapter = workingProject.chapters.find((chapter) => chapter.id === chapterId);
          if (!currentChapter) continue;
          await preserveGenerationVersion(workingProject, currentChapter);
          const runId = makeId();
          runIds.set(chapterId, runId);
          workingProject = {
            ...workingProject,
            chapters: workingProject.chapters.map((chapter) => chapter.id === chapterId
              ? { ...chapter, generationStatus: "Generating" as const, generationError: undefined, manualApproved: false, manualApprovedAt: undefined, generationRuns: [...(chapter.generationRuns ?? []), { id: runId, startedAt: new Date().toISOString(), status: "running" as const, usage: emptyUsage() }].slice(-50) }
              : chapter),
          };
          setProject(workingProject);
          await persistProject(workingProject);
        }

        const requestSnapshot = workingProject;
        let saveQueue = Promise.resolve();
        const outcomes = await Promise.all(batch.map(async (chapterId) => {
          const result = await requestDraftChapter(requestSnapshot, chapterId, () => quotaPause, () => { quotaPause = true; });
          saveQueue = saveQueue.then(async () => {
            if (!result.ok || !result.data.chapters?.length) {
              const requestCount = result.data.requestCount || 0;
              const failedUsage = result.data.usage;
              const generationStatus: ChapterGenerationStatus = result.data.quota ? "Paused by quota" : result.data.code === "human-review" ? "Human review" : "Needs review";
              const candidate = result.data.candidateChapter;
              workingProject = {
                ...workingProject,
                chapters: workingProject.chapters.map((chapter) => chapter.id === chapterId
                  ? {
                      ...chapter,
                      ...(candidate ? { ...candidate, body: authorialReaderHtml(candidate.body), sourceRefs: candidate.sourceRefs || chapter.sourceRefs } : {}),
                      generationStatus,
                      generationError: result.data.error || "Chapter drafting failed",
                      repairAttempts: Math.min(3, Math.max(chapter.repairAttempts || 0, failedUsage?.requests || requestCount)),
                      phase7Evaluation: result.data.phase7Evaluation,
                      generationUsage: requestCount || failedUsage ? {
                        inputTokens: (chapter.generationUsage?.inputTokens || 0) + (failedUsage?.inputTokens || 0),
                        outputTokens: (chapter.generationUsage?.outputTokens || 0) + (failedUsage?.outputTokens || 0),
                        totalTokens: (chapter.generationUsage?.totalTokens || 0) + (failedUsage?.totalTokens || 0),
                        reasoningTokens: (chapter.generationUsage?.reasoningTokens || 0) + (failedUsage?.reasoningTokens || 0),
                        requests: (chapter.generationUsage?.requests || 0) + (failedUsage?.requests || requestCount),
                        updatedAt: new Date().toISOString(),
                      } : chapter.generationUsage,
                      generationRuns: finishGenerationRun(chapter, runIds.get(chapterId), result.data.quota ? "quota-paused" : result.data.code === "human-review" ? "needs-review" : "failed", failedUsage || { ...emptyUsage(), requests: requestCount }, result.data.error, result.data.durationMs),
                    }
                  : chapter),
              };
              if (result.data.quota || result.data.retryable || result.data.code === "authentication" || result.data.code === "missing-key") failureReason ||= result.data.error || "Chapter drafting failed";
              setProject(workingProject);
              await persistProject(workingProject);
              return;
            }

            const replacement = result.data.chapters[0];
            const usage = result.data.usage;
            const merged = workingProject.chapters.map((chapter) => chapter.id === replacement.id
              ? {
                  ...chapter,
                  ...replacement,
                  body: authorialReaderHtml(replacement.body),
                  importedPages: undefined,
                  importValidated: false,
                  generationStatus: "Completed" as const,
                  generationError: undefined,
                  repairAttempts: Math.min(3, usage?.requests || 1),
                  generationUsage: {
                    inputTokens: (chapter.generationUsage?.inputTokens || 0) + (usage?.inputTokens || 0),
                    outputTokens: (chapter.generationUsage?.outputTokens || 0) + (usage?.outputTokens || 0),
                    totalTokens: (chapter.generationUsage?.totalTokens || 0) + (usage?.totalTokens || 0),
                    reasoningTokens: (chapter.generationUsage?.reasoningTokens || 0) + (usage?.reasoningTokens || 0),
                    requests: (chapter.generationUsage?.requests || 0) + (usage?.requests || 0),
                    updatedAt: new Date().toISOString(),
                  },
                  phase7Evaluation: result.data.phase7Evaluation,
                  generationRuns: finishGenerationRun(chapter, runIds.get(chapterId), "passed", usage, undefined, result.data.durationMs),
                  manualApproved: false,
                  manualApprovedAt: undefined,
                }
              : chapter);
            workingProject = { ...workingProject, chapters: attachChapterVisuals(workingProject, merged) };
            setProject(workingProject);
            await persistProject(workingProject);
            completed += 1;
            if (chapterId === 1) chapterOneStable = true;
            if (usage) {
              totalUsage.inputTokens += usage.inputTokens || 0;
              totalUsage.outputTokens += usage.outputTokens || 0;
              totalUsage.totalTokens += usage.totalTokens || 0;
              totalUsage.reasoningTokens += usage.reasoningTokens || 0;
              totalUsage.requests += usage.requests || 0;
            }
            if (chapterIds.length > 1) notify(`Chapter ${chapterId} passed and was saved`);
          });
          await saveQueue;
          return result;
        }));
        await saveQueue;
        if (outcomes.some((result) => !result.ok && (result.data.quota || result.data.retryable || result.data.code === "authentication" || result.data.code === "missing-key"))) break;
        cursor += batch.length;
        if (pauseAfterCurrentRef.current) {
          setBookPaused(true);
          break;
        }
      }

      if (quotaPause) {
        notify(`${completed ? `${completed} chapter${completed === 1 ? "" : "s"} saved. ` : ""}Daily quota reached. Generation stopped—use Resume book after the quota resets.`);
      } else if (pauseAfterCurrentRef.current) {
        notify(`${completed ? `${completed} chapter${completed === 1 ? "" : "s"} saved. ` : ""}Book paused. Use Resume book when you are ready.`);
      } else if (failureReason) {
        notify(completed ? `${completed} chapter${completed === 1 ? "" : "s"} saved. Resume starts from the first unfinished chapter: ${failureReason}` : failureReason);
      } else {
        const usageNote = totalUsage.requests ? ` · ${totalUsage.totalTokens.toLocaleString()} tokens in ${totalUsage.requests} request${totalUsage.requests === 1 ? "" : "s"}` : "";
        const gate = workingProject.chapters.find((chapter) => chapter.id === 1)?.phase7Evaluation;
        notify(gate ? `Chapter 1 ${gate.passed ? "passed" : "did not pass"} the Phase 8 measurement gate${usageNote}` : `${completed} chapter${completed === 1 ? "" : "s"} prepared and saved${usageNote}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not prepare the chapters";
      notify(completed ? `${completed} chapter${completed === 1 ? "" : "s"} saved. Resume starts from the first unfinished chapter: ${reason}` : reason);
    } finally {
      setDraftBusy(false);
    }
    return completed > 0;
  }

  async function testNemotronConnection() {
    setConnection({ state: "testing", message: "Testing a tiny request…" });
    try {
      const response = await fetch("/api/ai/status", { method: "POST", headers: requestHeaders() });
      const data = await response.json() as { connected?: boolean; error?: string; model?: string; usage?: GenerationUsage };
      if (!response.ok || !data.connected) throw new Error(data.error || "Nemotron could not connect");
      setConnection({ state: "connected", message: `Connected · ${data.model || "Nemotron 3 Ultra"}`, usage: data.usage });
      notify("Nemotron connection is working");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nemotron connection failed";
      setConnection({ state: "error", message });
      notify(message);
    }
  }

  function pauseAfterCurrentChapter() {
    pauseAfterCurrentRef.current = true;
    setBookPaused(true);
    notify("The book will pause after the current chapter finishes");
  }

  function acceptImprovement() {
    setComparison(null);
    setShowComparison(false);
    notify("Improvement accepted");
  }

  async function keepOriginal() {
    if (!comparison) return;
    const improved = project.chapters.find((chapter) => chapter.id === comparison.chapterId);
    const restored = {
      ...comparison.original,
      generationUsage: improved?.generationUsage || comparison.original.generationUsage,
      repairAttempts: Math.max(comparison.original.repairAttempts || 0, improved?.repairAttempts || 0),
    };
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === restored.id ? restored : chapter) };
    setProject(next);
    await persistProject(next).catch(() => undefined);
    setComparison(null);
    setShowComparison(false);
    notify("Original chapter kept");
  }

  async function restorePreviousVersion() {
    try {
      const response = await fetch(`/api/versions?projectId=${encodeURIComponent(project.id)}`, { headers: requestHeaders() });
      if (!response.ok) throw new Error("Version history could not be loaded");
      const data = await response.json() as { versions: { label: string; date: string; snapshot: Project }[] };
      const previous = data.versions[0];
      if (!previous) { notify("No previous version is available yet"); return; }
      await fetch("/api/versions", { method: "POST", headers: requestHeaders(), body: JSON.stringify({ projectId: project.id, label: "Before restoring previous version", snapshot: project }) });
      const restored = normalizeProject(previous.snapshot);
      setProject(restored);
      await persistProject(restored);
      setComparison(null);
      setShowComparison(false);
      notify(`Restored: ${previous.label}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Previous version could not be restored");
    }
  }

  async function leaveChapterForDesigner(chapterId = active?.id) {
    const chapterToSend = project.chapters.find((chapter) => chapter.id === chapterId);
    if (!chapterToSend || chapterGenerationState(chapterToSend) === "Completed") return;
    try {
      await preserveGenerationVersion(project, chapterToSend);
      const handoffBody = chapterWordCount(chapterToSend) >= 80 ? chapterToSend.body : `<p class="chapter-kicker">DESIGNER HANDOFF</p><h1>${chapterToSend.title}</h1><div class="designer-handoff-page"><b>Reserved for final human development</b><p>This section is intentionally left for the book designer and editor. Its final text, layout and any supporting material will be completed during the human review stage.</p><p>The rest of the reviewed book can be exported now without asking Nemotron to regenerate this chapter.</p></div>`;
      const next = {
        ...project,
        chapters: project.chapters.map((chapter) => chapter.id === chapterToSend.id ? {
          ...chapter,
          body: handoffBody,
          status: "draft" as const,
          generationStatus: "Designer handoff" as const,
          generationError: "Reserved for the human designer. This chapter is excluded from automatic generation and the AI quality gate.",
          pedagogyQuality: undefined,
          importedPages: undefined,
          importValidated: false,
        } : chapter),
      };
      setProject(next);
      await persistProject(next);
      notify(`Chapter ${chapterToSend.id} sent to the designer and saved.`);
    } catch {
      notify("The designer handoff could not be saved");
    }
  }

  async function approveChapterManually(chapterId: number) {
    const next = {
      ...project,
      chapters: project.chapters.map((chapter) => chapter.id === chapterId ? {
        ...chapter,
        manualApproved: true,
        manualApprovedAt: new Date().toISOString(),
        status: "approved" as const,
        generationStatus: "Completed" as const,
        generationError: undefined,
      } : chapter),
    };
    setProject(next);
    await persistProject(next);
    notify(`Chapter ${chapterId} manually approved and saved.`);
  }

  if (view === "dashboard") return <Dashboard projects={projects} onNew={startNewBook} onOpen={openProject} onDuplicate={duplicateProject} onDelete={deleteProject} />;

  return (
    <div className="studio-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></button>
        <div className="current-project"><i /> <span><strong>{project.title}</strong><small>{project.source}</small></span></div>
        <div className="top-actions">
          {view === "editor" && <><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Workflow</button><button onClick={() => document.querySelector(".chapter-generation-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Chapters</button><button onClick={() => setShowReviewQueue(true)}>Review <span>{project.chapters.filter((chapter) => !isPublishApproved(chapter)).length || "✓"}</span></button><button onClick={() => { document.querySelector<HTMLButtonElement>(".assistant nav button:nth-child(2)")?.click(); document.querySelector(".assistant")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Illustrations</button><button className="designer-nav-button" onClick={() => setShowDesigner(true)}>Designer</button><button onClick={openPreview}>Preview</button><button className="pdf-button" onClick={openPreview}>Preview & PDF</button></>}
          {(view === "editor" || view === "brief") && <details className="advanced-tools"><summary>Advanced</summary><div>{view === "editor" && <button onClick={() => setView("brief")}>Book plan</button>}<label className="advanced-upload">{sourceBusy ? "Reading source…" : "Replace source book"}<input type="file" accept=".pdf,.docx,.txt,.md" disabled={sourceBusy || draftBusy} onChange={(event) => event.target.files?.[0] && refreshSource(event.target.files[0])}/></label><button onClick={openVersions}>Version history</button><button onClick={() => setShowOperations(true)}>Request history</button><button onClick={saveProject}>Save project now</button><button onClick={exportDoc} disabled={exportBusy}>{exportBusy ? "Preparing DOCX…" : "Download DOCX"}</button><button className="package-import-button" onClick={() => setShowPackageImport(true)}>ChatGPT ZIP workflow</button><small>Book plan, source, versions, request history and legacy tools</small></div></details>}
        </div>
      </header>

      {view === "editor" && active && <SimpleWorkflowBar
        project={project}
        active={active}
        busy={draftBusy}
        paused={bookPaused}
        connection={connection}
        hasComparison={Boolean(comparison)}
        onTest={() => void testNemotronConnection()}
        onSelectChapter={setActiveChapter}
        onGenerateChapter={(chapterId) => { setActiveChapter(chapterId); void prepareDraft("active", { chapterId }); }}
        onPause={pauseAfterCurrentChapter}
        onResume={() => void prepareDraft("all")}
        onCompare={() => comparison ? setShowComparison(true) : notify("Improve a chapter first to compare both versions")}
        onAccept={acceptImprovement}
        onKeep={() => void keepOriginal()}
        onDesignerHandoff={(chapterId) => void leaveChapterForDesigner(chapterId)}
        onOpenReview={() => setShowReviewQueue(true)}
        onOpenOperations={() => setShowOperations(true)}
        onRestore={() => void restorePreviousVersion()}
      />}

      {view === "wizard" && <Wizard step={wizardStep} project={project} sourceBusy={sourceBusy} sourceProgress={sourceProgress} onPatch={patchProject} onFile={handleFile} onBack={() => wizardStep === 0 ? setView("dashboard") : setWizardStep((step) => step - 1)} onNext={() => wizardStep < 3 ? setWizardStep((step) => step + 1) : setView(project.creationMode === "external" ? "external" : "analysis")} />}
      {view === "external" && <ExternalAiManuscript project={project} onBack={() => { setView("wizard"); setWizardStep(3); }} onAccept={acceptExternalManuscript} onNotify={notify} />}
      {view === "analysis" && <Analysis project={project} sourceBusy={sourceBusy} onPatch={patchProject} onBack={() => { setView("wizard"); setWizardStep(3); }} onUseExternal={() => { patchProject({ creationMode: "external" }); setView("external"); }} onContinue={confirmAdaptationPlan} onRunOcr={runSourceOcr} onUpdateOutline={updateSourceOutline} onAcceptOutline={acceptSourceOutline} />}
      {view === "brief" && <BookBrief project={project} allocated={allocatedPages} draftBusy={draftBusy} onBack={() => setView("analysis")} onUpdateChapter={updateChapter} onPrepare={prepareDraft} onContinue={() => { patchProject({ briefApproved: true }); setActiveChapter(project.chapters[0]?.id ?? 1); setView("editor"); }} />}
      {view === "editor" && <Editor project={project} active={active} activeId={activeChapter} allocated={allocatedPages} draftBusy={draftBusy} onSelect={setActiveChapter} onSaveBody={saveChapterBody} editorRef={editorRef} onAi={aiAction} onRemember={rememberPreference} onAddChapter={addChapter} onUploadImage={uploadChapterImage} onPatchProject={patchProject} onUpdateChapter={updateChapter} />}

      {showPreview && <CanvaPreview project={project} exportBusy={exportBusy} pdfProgress={pdfProgress} onClose={() => setShowPreview(false)} onDownload={() => void downloadPdf()} onSaveCanvaPage={uploadCanvaPage} onSetCanvaActive={setCanvaPageActive} />}
      {showDesigner && <DesignerStudio project={project} onClose={() => setShowDesigner(false)} onPreview={() => { setShowDesigner(false); setShowPreview(true); }} onCommit={async (next) => { setProject(next); await persistProject(next); }} />}
      {showReviewQueue && <ReviewQueue project={project} busy={draftBusy} onClose={() => setShowReviewQueue(false)} onOpen={(chapterId) => { setActiveChapter(chapterId); setShowReviewQueue(false); }} onRepair={(chapterId) => { setActiveChapter(chapterId); setShowReviewQueue(false); void prepareDraft("active", { chapterId }); }} onApprove={(chapterId) => void approveChapterManually(chapterId)} onDesigner={(chapterId) => void leaveChapterForDesigner(chapterId)} onRestore={() => void restorePreviousVersion()} />}
      {showOperations && <OperationsHistory project={project} onClose={() => setShowOperations(false)} />}
      {showVersions && <Versions versions={versions} onCreate={createVersion} onRestore={(snapshot) => { setProject(normalizeProject(snapshot)); setShowVersions(false); notify("Version restored"); }} onClose={() => setShowVersions(false)} />}
      {showPackageImport && <BookPackageImporter project={project} busy={packageBusy} onClose={() => setShowPackageImport(false)} onDownloadRequest={downloadChatGptBookRequest} onImport={importBookPackage} />}
      {showComparison && comparison && <ChapterComparison original={comparison.original} improved={project.chapters.find((chapter) => chapter.id === comparison.chapterId) || comparison.original} onAccept={acceptImprovement} onKeep={() => void keepOriginal()} onClose={() => setShowComparison(false)} />}
      {aiRequest && <AiRoundTrip request={aiRequest} onChange={(result) => setAiRequest({ ...aiRequest, result })} onClose={() => setAiRequest(null)} onApply={applyAiResult} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function SimpleWorkflowBar({ project, active, busy, paused, connection, hasComparison, onTest, onSelectChapter, onGenerateChapter, onPause, onResume, onCompare, onAccept, onKeep, onDesignerHandoff, onOpenReview, onOpenOperations, onRestore }: {
  project: Project;
  active: Chapter;
  busy: boolean;
  paused: boolean;
  connection: NemotronConnection;
  hasComparison: boolean;
  onTest: () => void;
  onSelectChapter: (chapterId: number) => void;
  onGenerateChapter: (chapterId: number) => void;
  onPause: () => void;
  onResume: () => void;
  onCompare: () => void;
  onAccept: () => void;
  onKeep: () => void;
  onDesignerHandoff: (chapterId: number) => void;
  onOpenReview: () => void;
  onOpenOperations: () => void;
  onRestore: () => void;
}) {
  const quotaPaused = project.chapters.some((chapter) => chapter.generationStatus === "Paused by quota");
  const approved = project.chapters.filter(isPublishApproved).length;
  const reviewCount = project.chapters.length - approved;
  const illustrated = project.chapters.filter((chapter) => Boolean(chapter.imageUrl) || chapterGenerationState(chapter) === "Designer handoff").length;
  const totals = generationTotals(project.chapters);
  const activeRun = latestGenerationRun(active);
  const unfinished = reviewCount > 0;
  const external = project.creationMode === "external";
  const stages = [
    ["01", external ? "Manuscript imported" : "Source uploaded", project.externalManuscript ? "Complete" : project.sourceObjectKey ? "Complete" : "Needed"],
    ["02", "Chapters generated", `${approved}/${project.chapters.length}`],
    ["03", "Quality review", reviewCount ? `${reviewCount} to review` : "Complete"],
    ["04", "Illustrations", `${illustrated}/${project.chapters.length}`],
    ["05", "Preview & PDF", "Available now"],
  ];
  return <section className="simple-workflow-bar" aria-label="Book improvement controls">
    <span className="sr-only">Automated publishing workflow</span>
    <div className="workflow-heading"><div><p className="workflow-eyebrow">PUBLISHING COMMAND CENTRE</p><b>{external ? "Imported manuscript to finished book" : "From source to finished book"}</b><span>{external ? "Review, illustrate, design and export—the writing is already safely imported." : "Generate, review, illustrate and export—one calm step at a time."}</span></div>{external ? <div className="connection-pill connected"><span /><div><b>External AI manuscript</b><small>No website AI requests</small></div></div> : <div className={`connection-pill ${connection.state}`}><span /><div><b>Nemotron engine</b><small>{connection.message}</small></div><button onClick={onTest} disabled={busy || connection.state === "testing"}>{connection.state === "testing" ? "Testing…" : "Test connection"}</button></div>}</div>
    <div className="publishing-steps">{stages.map(([number, label, detail], index) => <div className={`${index === 0 || (index === 1 && approved) || (index === 2 && !reviewCount) ? "done" : ""}`} key={label}><span>{number}</span><b>{label}</b><small>{detail}</small></div>)}</div>
    <div className="chapter-generation-grid">
      {project.chapters.map((chapter) => {
        const status = chapterGenerationState(chapter);
        const disabled = busy || status === "Designer handoff";
        const action = status === "Completed" || status === "Designer handoff" ? "View" : status === "Human review" || status === "Needs review" ? "Review issues" : status === "Paused by quota" ? "Resume" : status === "Generating" ? "Generating…" : "Generate";
        const reviewOnly = ["Completed", "Designer handoff", "Needs review", "Human review"].includes(status);
        return <article className={`chapter-generation-card ${active.id === chapter.id ? "active" : ""} ${normalizedTitle(status).replace(/[^a-z]+/g, "-")}`} key={chapter.id}><button className="chapter-card-select" onClick={() => onSelectChapter(chapter.id)}><span>CH {String(chapter.id).padStart(2, "0")}</span><b>{chapter.title}</b><small>{chapter.manualApproved ? "Manually approved" : status}</small></button><button className="chapter-card-action" disabled={disabled} onClick={() => status === "Human review" || status === "Needs review" ? (onSelectChapter(chapter.id), onOpenReview()) : reviewOnly ? onSelectChapter(chapter.id) : onGenerateChapter(chapter.id)}>{action}</button></article>;
      })}
    </div>
    <div className="workflow-lower-row">
      <div className="request-usage-strip"><span><b>{activeRun?.usage.requests || 0}</b> of 3 · current run</span><span><b>{active.generationUsage?.requests || 0}</b> chapter requests</span><span><b>{totals.requests}</b> whole-book requests</span><span><b>{totals.totalTokens.toLocaleString()}</b> tokens</span><button onClick={onOpenOperations}>Request history →</button></div>
      <div className="workflow-context-actions">{!busy && unfinished && <button className="primary" onClick={onResume}>{quotaPaused ? "Resume book" : approved ? `Continue generation · ${reviewCount} left` : "Build this book"}</button>}{reviewCount > 0 && <button onClick={onOpenReview}>Review {reviewCount} chapter{reviewCount === 1 ? "" : "s"}</button>}{chapterGenerationState(active) === "Human review" && <button className="designer-handoff-action" onClick={() => onDesignerHandoff(active.id)} disabled={busy}>Send Chapter {active.id} to designer</button>}{busy && <button onClick={onPause} disabled={paused}>Pause after this chapter</button>}<details><summary>More actions</summary><div><button onClick={onCompare} disabled={!hasComparison}>Compare versions</button><button onClick={onAccept} disabled={!hasComparison}>Accept improvement</button><button onClick={onKeep} disabled={!hasComparison}>Keep original</button><button onClick={onRestore} disabled={busy}>Restore previous version</button></div></details></div>
    </div>
  </section>;
}

function Phase7Report({ evaluation, totalChapters }: { evaluation?: ChapterOneGate; totalChapters: number }) {
  const remainingLabel = totalChapters > 1 ? `Chapters 2–${totalChapters}` : "No later chapters";
  if (!evaluation) return <div className="phase7-report waiting"><b>PUBLISHING PILOT · CHAPTER 1</b><span>The first chapter proves the age, relevance and token configuration. The workflow then continues automatically.</span></div>;
  const seconds = Math.round(evaluation.metrics.durationMs / 100) / 10;
  return <div className={`phase7-report ${evaluation.passed ? "passed" : "failed"}`}><header><b>PUBLISHING PILOT · {evaluation.passed ? "PASSED" : "HUMAN REVIEW"}</b><span>{evaluation.passed ? `${remainingLabel} continue automatically` : "The best candidate was preserved; the remaining book can continue"}</span></header><div><span><b>{evaluation.metrics.requests}</b> of 3 passes</span><span><b>{evaluation.metrics.totalTokens.toLocaleString()}</b> tokens</span><span><b>{seconds}s</b> speed</span><span><b>{evaluation.metrics.words}</b> words</span><span><b>{evaluation.metrics.accuracyScore}</b> accuracy</span><span><b>{evaluation.metrics.ageFitScore}</b> age fit</span><span><b>{evaluation.metrics.qualityAverage}</b> quality</span></div></div>;
}

function reviewReasons(chapter: Chapter) {
  const reasons = [...(chapter.pedagogyQuality?.checks || [])];
  if (chapter.generationError) reasons.unshift(chapter.generationError);
  if (chapterWordCount(chapter) < 350) reasons.push("Short or incomplete content");
  if (!chapter.imageUrl) reasons.push("Illustration missing");
  return [...new Set(reasons)].slice(0, 6);
}

function ReviewQueue({ project, busy, onClose, onOpen, onRepair, onApprove, onDesigner, onRestore }: {
  project: Project; busy: boolean; onClose: () => void; onOpen: (chapterId: number) => void; onRepair: (chapterId: number) => void; onApprove: (chapterId: number) => void; onDesigner: (chapterId: number) => void; onRestore: () => void;
}) {
  const chapters = project.chapters.filter((chapter) => !isPublishApproved(chapter));
  return <div className="modal-backdrop"><section className="review-queue-modal"><header><div><p className="eyebrow">QUALITY REVIEW</p><h2>Review Queue</h2><p>{chapters.length ? `${chapters.length} chapter${chapters.length === 1 ? " needs" : "s need"} a decision before final export.` : "Every chapter is cleared for final export."}</p></div><button onClick={onClose}>×</button></header><div className="review-queue-list">{chapters.map((chapter) => { const latest = latestGenerationRun(chapter); const attempts = latest?.usage.requests || chapter.repairAttempts || 0; return <article key={chapter.id}><div className="review-chapter-number">{String(chapter.id).padStart(2, "0")}</div><div><h3>{chapter.title}</h3><div className="review-reason-tags">{reviewReasons(chapter).map((reason) => <span key={reason}>{reason}</span>)}</div><small>{attempts} of 3 passes in current run · {chapter.generationUsage?.requests || 0} lifetime requests · saved automatically</small></div><div className="review-card-actions"><button className="primary" onClick={() => onRepair(chapter.id)} disabled={busy || attempts >= 3}>{attempts >= 3 ? "3-pass limit reached" : "Repair with feedback"}</button><button onClick={() => onApprove(chapter.id)} disabled={busy}>Approve manually</button><button onClick={() => onOpen(chapter.id)}>Open in editor</button><button onClick={() => onDesigner(chapter.id)} disabled={busy}>Send to designer</button><button onClick={onRestore} disabled={busy}>Restore previous</button></div></article>; })}{!chapters.length && <div className="review-empty"><b>✓ Publishing review complete</b><span>You can now download the final PDF.</span></div>}</div></section></div>;
}

function OperationsHistory({ project, onClose }: { project: Project; onClose: () => void }) {
  const rows = project.chapters.flatMap((chapter) => chapter.generationRuns?.length ? chapter.generationRuns.map((run, index) => ({ chapter, run, index })) : chapter.generationUsage?.requests ? [{ chapter, run: { id: `legacy-${chapter.id}`, startedAt: chapter.generationUsage.updatedAt || "Earlier session", completedAt: chapter.generationUsage.updatedAt, status: chapterGenerationState(chapter) === "Completed" ? "passed" as const : "needs-review" as const, usage: chapter.generationUsage } satisfies GenerationRun, index: 0 }] : []);
  const totals = generationTotals(project.chapters);
  return <div className="modal-backdrop"><section className="operations-modal"><header><div><p className="eyebrow">APPEND-ONLY OPERATIONS LOG</p><h2>Request History</h2><p>Refreshing, resuming and regenerating never reset these lifetime totals.</p></div><button onClick={onClose}>×</button></header><div className="operations-summary"><span><b>{totals.requests}</b> requests</span><span><b>{totals.inputTokens.toLocaleString()}</b> input tokens</span><span><b>{totals.outputTokens.toLocaleString()}</b> output tokens</span><span><b>{totals.totalTokens.toLocaleString()}</b> total tokens</span></div><div className="operations-table-wrap"><table><thead><tr><th>Chapter</th><th>Run</th><th>Date</th><th>Result</th><th>Passes</th><th>Input</th><th>Output</th><th>Duration</th><th>Feedback / error</th></tr></thead><tbody>{rows.map(({ chapter, run, index }) => <tr key={`${chapter.id}-${run.id}`}><td>{chapter.id}. {chapter.title}</td><td>{index + 1}</td><td>{run.startedAt === "Earlier session" ? run.startedAt : new Date(run.startedAt).toLocaleString()}</td><td><span className={`operation-status ${run.status}`}>{run.status.replace("-", " ")}</span></td><td>{run.usage.requests}</td><td>{run.usage.inputTokens.toLocaleString()}</td><td>{run.usage.outputTokens.toLocaleString()}</td><td>{run.durationMs ? `${Math.round(run.durationMs / 100) / 10}s` : "—"}</td><td>{run.error || run.feedback?.join(" · ") || "Initial generation"}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">No Nemotron requests have been made for this project yet.</p>}</div></section></div>;
}

function ChapterComparison({ original, improved, onAccept, onKeep, onClose }: { original: Chapter; improved: Chapter; onAccept: () => void; onKeep: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="comparison-modal"><header><div><p className="eyebrow">CHAPTER DECISION</p><h2>Compare original and improved</h2><p>{improved.title}</p></div><button onClick={onClose}>×</button></header><div className="comparison-grid"><article><span>ORIGINAL</span><div className="book-copy" dangerouslySetInnerHTML={{ __html: authorialReaderHtml(original.body) }}/></article><article className="improved"><span>IMPROVED</span><div className="book-copy" dangerouslySetInnerHTML={{ __html: authorialReaderHtml(improved.body) }}/></article></div><footer><button className="secondary" onClick={onKeep}>Keep original</button><button className="primary" onClick={onAccept}>Accept improvement</button></footer></section></div>;
}

function ThemeSwitcher(){
  const [theme,setTheme]=useState(()=>typeof window!=="undefined"?localStorage.getItem("iks-theme")||"original":"original");
  useEffect(()=>{if(theme==="original"){document.documentElement.removeAttribute("data-theme")}else{document.documentElement.setAttribute("data-theme",theme)} localStorage.setItem("iks-theme",theme)},[theme]);
  useEffect(()=>{const saved=typeof window!=="undefined"?localStorage.getItem("iks-theme"):null; if(saved && saved!=="original"){document.documentElement.setAttribute("data-theme",saved)}},[]);
  return <div className="theme-switcher"><label>Theme</label><select value={theme} onChange={e=>setTheme((e.target as HTMLSelectElement).value)}><option value="original">Original Forest</option><option value="banyan">Banyan Library</option><option value="curious">Curious Lab</option><option value="scholar">Scholar&apos;s Desk</option></select></div>;
}

function Dashboard({ projects, onNew, onOpen, onDuplicate, onDelete }: { projects: Project[]; onNew: () => void; onOpen: (project: Project) => void; onDuplicate: (project: Project) => void; onDelete: (project: Project) => void }) {
  return <main className="dashboard">
    <header><div className="brand"><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></div><div style={{display:"flex",alignItems:"center",gap:"12px"}}><ThemeSwitcher/><button className="primary" onClick={onNew}>＋ New book</button></div></header>
    <section className="hero">
      <div><p className="eyebrow">CHILDREN’S ADAPTATION STUDIO</p><h1>Turn any source into a book<br/><em>children want to read.</em></h1><p className="hero-copy">Preserve every original chapter, then reshape the writing, activities and visual world for children aged 7–15.</p><button className="hero-cta" onClick={onNew}>Start a children’s adaptation <span>→</span></button><small>AGES 7–15 · PDF · DOCX · TXT · NATURAL LENGTH · 100-PAGE CEILING</small></div>
      <div className="hero-books" aria-hidden="true"><div className="book back"><span>THE SOURCE</span></div><div className="book front"><span>A BOOK FOR</span><strong>CURIOUS<br/>YOUNG MINDS</strong><i>READ · DISCOVER · CREATE</i><b>✦</b></div></div>
    </section>
    <section className="library-section">
      <div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Continue where you left off</h2></div><span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span></div>
      <div className="project-grid">
        <button className="new-card" onClick={onNew}><b>＋</b><strong>New adaptation</strong><small>Begin with any source book</small></button>
        {projects.map((project) => <article className="project-card" key={project.id}><button className="project-open" onClick={() => onOpen(project)}><div className="mini-cover"><span>{project.chapters.length}</span><small>CHAPTERS</small></div><div><span className="status">IN EDITING</span><h3>{project.title}</h3><p>{project.source}</p><footer><span>{project.updatedAt}</span><strong>Open project →</strong></footer></div></button><div className="project-menu"><button onClick={() => onDuplicate(project)}>Duplicate</button>{project.id !== "arthashastra-sample" && <button onClick={() => onDelete(project)}>Delete</button>}</div></article>)}
      </div>
    </section>
    <section className="workflow"><div><span>01</span><b>Upload</b><small>Any source book</small></div><i>→</i><div><span>02</span><b>Choose</b><small>Age, language and book world</small></div><i>→</i><div><span>03</span><b>Adapt</b><small>Child-friendly text and visuals</small></div><i>→</i><div><span>04</span><b>Publish</b><small>PDF or editable file</small></div></section>
  </main>;
}

function glimpseSample(project: Project) {
  const writing = naturalWritingProfile(project.audience);
  const age = childAgeBand(project.audience);
  if (project.language === "Hindi") {
    if (age === "7-9") return "यह अध्याय मुख्य विचार को छोटे वाक्यों, सरल शब्दों और साफ़ उदाहरणों से समझाता है।";
    if (age === "13-15") return "यह अध्याय स्रोत के मुख्य तर्क, महत्त्वपूर्ण शब्दों और उनके व्यापक अर्थ को विस्तार से समझाता है।";
    return "यह अध्याय स्रोत को साफ़ भाषा में समझाता है और हर विचार को बड़े विषय से जोड़ता है।";
  }
  if (project.language === "English + Hindi") return `${writing.intro} / यह अध्याय मुख्य विचारों को उम्र के अनुसार साफ़ भाषा में समझाता है।`;
  return writing.intro;
}

const glimpsePages = [
  { value: "chapter", label: "Chapter opener" },
  { value: "reading", label: "Reading page" },
  { value: "visual", label: "Visual page" },
  { value: "activity", label: "Activity page" },
] as const;

function PersonaPicker({ project, onSelect }: { project: Project; onSelect: (persona: BookPersona) => void }) {
  return <section className="persona-picker"><div className="persona-recommendation"><div><p className="choice-label">SOURCE-LED BOOK IDENTITY</p><h3>{project.bookPersona.name}</h3><p>{project.bookPersona.tagline}</p><small>{project.bookPersona.rationale}</small></div><div className="persona-swatches">{Object.values(project.bookPersona.palette).map((colour) => <i style={{ background: colour }} key={colour}/>)}</div></div><div className="persona-cards">{bookPersonaDefinitions.map((persona) => <button type="button" className={project.bookPersona.id === persona.id ? "selected" : ""} onClick={() => onSelect(materializePersona(persona, "Selected by the publisher for this edition.", false))} key={persona.id}><span>{persona.family}</span><strong>{persona.name}</strong><small>{persona.description}</small></button>)}</div></section>;
}

function BookGlimpse({ project, focus, onPersona }: { project: Project; focus: "reader" | "design"; onPersona?: (persona: BookPersona) => void }) {
  const [previewPage, setPreviewPage] = useState<(typeof glimpsePages)[number]["value"]>("chapter");
  const reader = childAudienceProfile(project.audience);
  const design = childDesignWorld(project.aesthetic);
  const pages = pageAesthetic(project.pageAesthetic);
  const border = bookBorder(project.bookBorder);
  const watermark = pageWatermark(project.pageWatermark);
  const typography = typographyTheme(project.fontTheme);
  const chapterTitle = project.sourceHeadings[0] || "A Big Idea to Explore";
  const worldClass = normalizedTitle(design.value).replace(/[^a-z]+/g, "-");
  const pageClass = normalizedTitle(pages.value).replace(/[^a-z]+/g, "-");
  const borderClass = normalizedTitle(border.value).replace(/[^a-z]+/g, "-");
  const watermarkClass = normalizedTitle(watermark.value).replace(/[^a-z]+/g, "-");
  const typographyClass = normalizedTitle(typography.value).replace(/[^a-z]+/g, "-");
  const ageClass = reader.value.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "");
  const personaClass = bookPersonaClass(project.bookPersona);
  return <aside className={`book-glimpse ${personaClass} world-${worldClass} page-aesthetic-${pageClass} book-border-${borderClass} page-watermark-${watermarkClass} typography-${typographyClass} age-${ageClass}`} aria-live="polite">
    <header><div><p className="eyebrow">LIVE BOOK & PAGE GLIMPSE</p><h2>See every important page before you build</h2></div><span>{focus === "reader" ? reader.value : `${pages.label} · ${border.label} · ${watermark.label}`}</span></header>
    {focus === "design" && onPersona && <PersonaPicker project={project} onSelect={onPersona}/>}
    <nav className="glimpse-tabs" aria-label="Preview a page type">{glimpsePages.map((item) => <button type="button" className={previewPage === item.value ? "active" : ""} onClick={() => setPreviewPage(item.value)} key={item.value}>{item.label}</button>)}</nav>
    <div className="glimpse-spread">
      <div className="glimpse-cover"><small>{project.bookPersona.family.toUpperCase()}</small><strong>{reader.value.replace("Ages ", "AGES ")}</strong><div className="cover-symbol"><i/><i/><i/></div><h3>{project.title === "Untitled adaptation" ? "YOUR NEW BOOK" : project.title}</h3><span>{project.bookPersona.name}</span></div>
      <div className={`glimpse-page glimpse-page-${previewPage}`}>
        {previewPage === "chapter" && <><span>CHAPTER 01</span><h3>{chapterTitle}</h3><div className="glimpse-illustration" aria-hidden="true"><i/><b>✦</b><i/></div><b className="glimpse-hook">A NEW IDEA BEGINS</b><p>{glimpseSample(project)}</p></>}
        {previewPage === "reading" && <><span>UNDERSTANDING THE IDEA</span><h3>How the parts connect</h3><b className="glimpse-hook">NATURAL WRITING FOR {reader.value.toUpperCase()}</b><p>{glimpseSample(project)}</p><p className="glimpse-second-paragraph">The next example gives the idea a clear shape and connects it to the chapter as a whole.</p><div className="glimpse-word"><b>WORD HELPER</b><span>Context means the ideas and events around a topic.</span></div></>}
        {previewPage === "visual" && <><span>LOOK CLOSER</span><h3>A picture of the big idea</h3><div className="glimpse-concept-map persona-scene" aria-label="Example narrative scene"><b>✦</b><i/><i/><i/></div><p className="glimpse-caption">{project.bookPersona.illustrationStyle}. Every chapter scene is rebuilt from its own people, place, objects and central action.</p></>}
        {previewPage === "activity" && <><span>{project.bookPersona.activityLabel}</span><h3>{project.bookPersona.sectionLabels[2]}</h3><div className="glimpse-activity-card"><b>{project.bookPersona.activityLabel}</b><p>{project.bookPersona.activityPrompt}</p><ol><li>Find one important idea.</li><li>Connect it to an example.</li><li>Share what you discovered.</li></ol></div></>}
      </div>
    </div>
    <footer><span><b>Aa</b>{typography.label}</span><span><b>▣</b>{pages.label}</span><span><b>⌑</b>{border.label} border</span><span><b>◉</b>{watermark.label}</span></footer>
  </aside>;
}

function TypographyPicker({ project, onPatch }: { project: Project; onPatch: (patch: Partial<Project>) => void }) {
  return <section className="typography-section"><div className="typography-heading"><div><p className="choice-label">TYPOGRAPHY · APPLIES TO THE WHOLE BOOK</p><h2>Choose how the words feel</h2></div><span>Watch the live book glimpse above change instantly</span></div><div className="typography-cards">{typographyThemes.map((theme) => { const typographyClass = normalizedTitle(theme.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.fontTheme === theme.value ? "selected " : ""}typography-choice typography-${typographyClass}`} onClick={() => onPatch(typographyPatch(theme.value))} key={theme.value}><span className="typography-thumbnail"><b>Aa</b><strong>Chapter title</strong><i>{theme.sample}</i></span><strong>{theme.label}</strong><small>{theme.description}</small><em>{theme.detail}</em></button>; })}</div></section>;
}

function WatermarkPicker({ project, onPatch }: { project: Project; onPatch: (patch: Partial<Project>) => void }) {
  return <section className="page-watermark-section"><div className="typography-heading"><div><p className="choice-label">PAGE WATERMARK · APPLIES TO EVERY PAGE</p><h2>Choose a quiet background mark</h2></div><span>The live book glimpse changes instantly</span></div><div className="page-watermark-cards">{pageWatermarks.map((watermark) => { const watermarkClass = normalizedTitle(watermark.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.pageWatermark === watermark.value ? "selected " : ""}page-watermark-choice watermark-${watermarkClass}`} onClick={() => onPatch(pageWatermarkPatch(watermark.value))} key={watermark.value}><span className="page-watermark-thumbnail"><i/><b>Chapter</b><span/><span/><span/></span><strong>{watermark.label}</strong><small>{watermark.description}</small><em>{watermark.detail}</em></button>; })}</div></section>;
}

function Wizard({ step, project, sourceBusy, sourceProgress, onPatch, onFile, onBack, onNext }: { step: number; project: Project; sourceBusy: boolean; sourceProgress: number; onPatch: (patch: Partial<Project>) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onBack: () => void; onNext: () => void }) {
  return <div className="wizard-layout">
    <aside className="step-rail"><p>CHILDREN’S EDITION</p>{wizardSteps.map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><b>{label}</b></div>)}<blockquote>Built first for children aged 7–15. Adult publishing choices will return in a later edition.</blockquote></aside>
    <main className="wizard-main">
      <p className="eyebrow">STEP {step + 1} OF 4 · AGES 7–15</p><h1>{["Choose the source.", "Choose the child reader.", "Choose the book world.", "Review your children’s book."][step]}</h1><p className="lead">{["Upload the book you are authorised to adapt.", "Pick one age band. Vocabulary, sentence length, explanation depth and text size adjust automatically.", "Choose a complete visual system and see the page before building the adaptation.", "These child-first choices guide every generated chapter and illustration."][step]}</p>
      {step === 0 && <section className="form-card source-method-card"><div className="creation-mode-choice"><button className={project.creationMode !== "automatic" ? "selected recommended" : ""} onClick={() => onPatch({ creationMode: "external" })}><span>RECOMMENDED</span><b>Use ChatGPT, Claude or DeepSeek</b><small>Book Studio gives you the prompt. Your chosen AI reads the source directly, then you bring back the finished manuscript.</small></button><button className={project.creationMode === "automatic" ? "selected" : ""} onClick={() => onPatch({ creationMode: "automatic" })}><span>ADVANCED</span><b>Process the source inside Book Studio</b><small>Uses the connected OCR and Nemotron pipeline. Best kept for searchable PDFs and controlled experiments.</small></button></div><label className={`upload ${sourceBusy ? "busy" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={sourceBusy}/><span>{sourceBusy ? `${sourceProgress || "…"}${sourceProgress ? "%" : ""}` : "↑"}</span><strong>{sourceBusy ? "Securely uploading and classifying your book…" : project.source}</strong><small>{project.creationMode === "automatic" ? (sourceBusy ? "Scanned PDFs are divided into resumable batches." : "Book Studio will upload and analyse this file using the advanced automatic pipeline.") : "Select the source only so its name enters your custom prompt. You will upload the actual source directly to your chosen AI."}</small></label><div className="fields two"><label>New book title<input value={project.title} onChange={(e) => onPatch({ title: e.target.value })}/></label><label>Source book<input value={project.source} readOnly/></label></div></section>}
      {step === 1 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">READER AGE</p><div className="choice-cards">{childAudienceProfiles.map((profile) => <button className={project.audience === profile.value ? "choice selected" : "choice"} onClick={() => onPatch(audiencePatch(profile.value))} key={profile.value}><span>{profile.value}</span><strong>{profile.label}</strong><small>{profile.description}</small><i>“{profile.sample}”</i></button>)}</div><div className="language-choice"><span>BOOK LANGUAGE</span>{["English", "Hindi", "English + Hindi"].map((language) => <button className={project.language === language ? "selected" : ""} onClick={() => onPatch({ language })} key={language}>{language}</button>)}</div><div className="auto-settings"><b>Natural writing is automatic</b><span>{project.learningFeatures.join(" · ")}</span><small>The studio changes vocabulary, sentence length, explanation depth and reflection for the selected age. There are no separate writing modes.</small></div></div><BookGlimpse project={project} focus="reader"/></section>}
      {step === 2 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">ILLUSTRATION WORLD</p><div className="design-world-cards">{childDesignWorlds.map((world) => <button className={`${project.aesthetic === world.value ? "selected " : ""}design-world world-${normalizedTitle(world.value).replace(/[^a-z]+/g, "-")}`} onClick={() => onPatch(designWorldPatch(world.value))} key={world.value}><span className="world-thumbnail"><i/><b>Ab</b><i/></span><strong>{world.label}</strong><small>{world.description}</small><em>{world.illustrationStyle}</em></button>)}</div><div className="page-aesthetic-section"><p className="choice-label">PAGE AESTHETIC · APPLIES TO EVERY PAGE</p><div className="page-aesthetic-cards">{pageAesthetics.map((aesthetic) => { const aestheticClass = normalizedTitle(aesthetic.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.pageAesthetic === aesthetic.value ? "selected " : ""}page-aesthetic-choice aesthetic-${aestheticClass}`} onClick={() => onPatch(pageAestheticPatch(aesthetic.value))} key={aesthetic.value}><span className="page-aesthetic-thumbnail"><i/><b>Chapter</b><i/><i/><i/></span><strong>{aesthetic.label}</strong><small>{aesthetic.description}</small><em>{aesthetic.detail}</em></button>; })}</div></div><div className="book-border-section"><p className="choice-label">BOOK BORDER · MIX WITH ANY PAGE AESTHETIC</p><div className="book-border-cards">{bookBorders.map((border) => { const borderClass = normalizedTitle(border.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.bookBorder === border.value ? "selected " : ""}book-border-choice border-${borderClass}`} onClick={() => onPatch(bookBorderPatch(border.value))} key={border.value}><span className="book-border-thumbnail"><i/><b>Chapter</b><i/><i/><i/></span><strong>{border.label}</strong><small>{border.description}</small><em>{border.detail}</em></button>; })}</div></div><div className="auto-settings"><b>Visual guarantee</b><span>One unique image, page aesthetic and chosen border in every chapter</span><small>Every image is a chapter-specific narrative scene—never a map, Venn diagram or generic concept graphic. Use the live tabs to inspect the chapter, reading, visual and activity pages.</small></div></div><BookGlimpse project={project} focus="design" onPersona={(persona) => onPatch(bookPersonaPatch(persona))}/></section>}
      {step === 3 && <><section className="brief-review child-review"><div><span>WORKFLOW</span><strong>{project.creationMode === "automatic" ? "Advanced automatic source processing" : "External AI manuscript · no website API required"}</strong></div><div><span>SOURCE</span><strong>{project.source}</strong></div><div><span>CHILD READER</span><strong>{project.audience} · {project.readingLevel}</strong></div><div><span>BOOK</span><strong>{project.bookType}</strong></div><div><span>WRITING</span><strong>Natural age-based writing · {project.language}</strong></div><div><span>ILLUSTRATION WORLD</span><strong>{project.aesthetic} · {project.illustrationStyle}</strong></div><div><span>PAGE AESTHETIC</span><strong>{project.pageAesthetic} · applied to every page</strong></div><div><span>BOOK BORDER</span><strong>{project.bookBorder} · applied to every physical page</strong></div><div><span>PAGE WATERMARK</span><strong>{project.pageWatermark} · subtle background design</strong></div><div><span>LENGTH</span><strong>Shortest clear length · never padded · under 100 pages</strong></div></section><BookGlimpse project={project} focus="design" onPersona={(persona) => onPatch(bookPersonaPatch(persona))}/></>}
      {step === 2 && <TypographyPicker project={project} onPatch={onPatch}/>}
      {step === 2 && <WatermarkPicker project={project} onPatch={onPatch}/>}
      <footer className="wizard-footer"><button className="secondary" onClick={onBack}>← Back</button><button className="primary" onClick={onNext} disabled={sourceBusy || (step === 0 && project.source === "No source selected")}>{step === 3 ? (project.creationMode === "automatic" ? "Detect original chapters" : "Create AI manuscript request") : "Continue"} →</button></footer>
    </main>
  </div>;
}

function ExternalAiManuscript({ project, onBack, onAccept, onNotify }: { project: Project; onBack: () => void; onAccept: (result: ExternalManuscriptResult, fileName: string) => Promise<void>; onNotify: (message: string) => void }) {
  const prompt = useMemo(() => buildExternalAiPrompt({ title: project.title, sourceName: project.source, audience: project.audience, readingLevel: project.readingLevel, language: project.language, bookType: project.bookType, aesthetic: project.aesthetic, illustrationStyle: project.illustrationStyle, learningFeatures: project.learningFeatures }), [project]);
  const [manuscriptText, setManuscriptText] = useState("");
  const [fileName, setFileName] = useState("Pasted manuscript.md");
  const [result, setResult] = useState<ExternalManuscriptResult | null>(null);
  const [busy, setBusy] = useState(false);
  const downloadPrompt = () => {
    const href = URL.createObjectURL(new Blob([prompt], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book"}-ai-prompt.md`;
    anchor.click();
    URL.revokeObjectURL(href);
    onNotify("AI prompt downloaded. Upload it with your source to ChatGPT, Claude or DeepSeek.");
  };
  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    onNotify("Complete external-AI prompt copied");
  };
  const readManuscriptFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      let text = "";
      if (/\.zip$/i.test(file.name)) {
        const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
        const names = Object.keys(archive).filter((name) => /\.(md|markdown|txt)$/i.test(name) && !name.startsWith("__MACOSX/")).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
        if (!names.length) throw new Error("The ZIP contains no Markdown or text chapter files");
        text = names.map((name) => new TextDecoder().decode(archive[name])).join("\n\n");
      } else if (/\.docx$/i.test(file.name)) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/manuscript/extract", { method: "POST", headers: ownerHeaders(), body: form });
        const data = await response.json() as { text?: string; error?: string };
        if (!response.ok || !data.text) throw new Error(data.error || "The DOCX manuscript could not be read");
        text = data.text;
      } else text = await file.text();
      setFileName(file.name);
      setManuscriptText(text);
      const parsed = parseExternalManuscript(text, project.audience);
      setResult(parsed);
      onNotify(`${parsed.sections.length} ordered book sections detected`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "The manuscript could not be read");
    } finally { setBusy(false); }
  };
  const inspectPaste = () => {
    if (manuscriptText.trim().length < 200) return onNotify("Paste the complete manuscript first");
    const parsed = parseExternalManuscript(manuscriptText, project.audience);
    setResult(parsed);
    setFileName("Pasted manuscript.md");
    onNotify(`${parsed.sections.length} ordered book sections detected`);
  };
  const moveSection = (index: number, direction: -1 | 1) => setResult((current) => {
    if (!current) return current;
    const target = index + direction;
    if (target < 0 || target >= current.sections.length) return current;
    const sections = [...current.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    return { ...current, sections };
  });
  const chapterCount = result?.sections.filter((section) => section.kind === "chapter").length || 0;
  const sectionIssueCount = result?.sections.reduce((sum, section) => sum + section.issues.length, 0) || 0;
  return <main className="external-manuscript-page">
    <button className="text-button" onClick={onBack}>← Change book settings</button>
    <header className="external-manuscript-hero"><div><p className="eyebrow">EXTERNAL AI MANUSCRIPT · RECOMMENDED</p><h1>Let your chosen AI read the source. Bring back the finished book.</h1><p>No website OCR, no OpenRouter quota and no fragile JSON. The manuscript is checked and organised locally before it enters your design studio.</p></div><span>0 website AI requests</span></header>
    <section className="external-steps" aria-label="External manuscript workflow"><div className="complete"><b>1</b><span>Book settings<small>Complete</small></span></div><div className="active"><b>2</b><span>Download prompt<small>Ready</small></span></div><div><b>3</b><span>Create in your AI<small>Upload source + prompt</small></span></div><div className={result ? "complete" : ""}><b>4</b><span>Import manuscript<small>{result ? "Complete" : "Waiting"}</small></span></div><div className={result ? "active" : ""}><b>5</b><span>Review order<small>{result ? `${result.sections.length} sections` : "Waiting"}</small></span></div><div><b>6</b><span>Design & export<small>Next</small></span></div></section>
    <div className="external-manuscript-grid"><section className="external-action-card prompt-card"><p className="eyebrow">STEP 1 · TAKE THIS TO YOUR AI</p><h2>Download the complete author prompt</h2><p>Upload this prompt and <b>{project.source}</b> together in ChatGPT, Claude or DeepSeek. Ask it to return the finished Markdown manuscript or a chapter ZIP.</p><div className="external-provider-row"><span>ChatGPT</span><span>Claude</span><span>DeepSeek</span></div><button className="primary" onClick={downloadPrompt}>Download AI prompt</button><button className="secondary" onClick={() => void copyPrompt()}>Copy prompt</button><details><summary>See what the prompt guarantees</summary><ul><li>Reads the complete source before writing</li><li>Preserves real chapter order and important IKS concepts</li><li>Writes for {project.audience}</li><li>Creates introduction, chapters, conclusion and glossary</li><li>Adds one private, contextual illustration brief per chapter</li><li>Returns Markdown—not JSON</li></ul></details></section>
      <section className="external-action-card import-card"><p className="eyebrow">STEP 2 · BRING BACK THE RESULT</p><h2>Upload or paste the finished manuscript</h2><label className="external-manuscript-upload"><input type="file" accept=".md,.markdown,.txt,.docx,.zip" disabled={busy} onChange={(event) => event.target.files?.[0] && void readManuscriptFile(event.target.files[0])}/><b>{busy ? "Reading manuscript…" : "Upload manuscript"}</b><span>Markdown, TXT, DOCX or a ZIP of numbered chapter files</span></label><span className="or-divider">OR PASTE IT</span><textarea value={manuscriptText} onChange={(event) => { setManuscriptText(event.target.value); setResult(null); }} placeholder="# BOOK TITLE\n\n# INTRODUCTION\n...\n\n# CHAPTER 01: ..."/><button className="secondary" disabled={busy || manuscriptText.trim().length < 200} onClick={inspectPaste}>Inspect pasted manuscript</button></section></div>
    {result && <section className="manuscript-review"><header><div><p className="eyebrow">IMPORT REVIEW</p><h2>{result.title}</h2><p>{result.words.toLocaleString()} reader-facing words · {chapterCount} main chapters · {result.sections.length} total sections</p></div><div className={result.issues.length || sectionIssueCount ? "review-warning" : "review-ready"}><b>{result.issues.length + sectionIssueCount ? `${result.issues.length + sectionIssueCount} review note${result.issues.length + sectionIssueCount === 1 ? "" : "s"}` : "Structure ready"}</b><span>{result.issues.length + sectionIssueCount ? "You can still import and edit every section." : "Introduction, chapters and ending are in order."}</span></div></header>{result.issues.length > 0 && <div className="manuscript-global-issues">{result.issues.map((issue) => <span key={issue}>! {issue}</span>)}</div>}<div className="manuscript-section-list">{result.sections.map((section, index) => <article key={`${section.kind}-${index}`}><span>{section.kind === "chapter" ? `CH ${String(result.sections.slice(0, index + 1).filter((item) => item.kind === "chapter").length).padStart(2, "0")}` : section.kind.toUpperCase()}</span><div><b>{section.title}</b><small>{section.wordCount.toLocaleString()} words{section.illustrationBrief ? " · illustration brief ready" : ""}</small>{section.issues.map((issue) => <em key={issue}>{issue}</em>)}</div><div><button aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button><button aria-label={`Move ${section.title} down`} disabled={index === result.sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button></div></article>)}</div><footer><div><b>Source-fidelity reminder</b><span>Book Studio checks structure, length and teaching sections locally. Before publication, spot-check important claims against the source.</span></div><button className="primary" disabled={!chapterCount || busy} onClick={() => { setBusy(true); void onAccept(result, fileName).finally(() => setBusy(false)); }}>{busy ? "Importing…" : "Accept manuscript & open studio"}</button></footer></section>}
  </main>;
}

function Analysis({ project, sourceBusy, onPatch, onBack, onUseExternal, onContinue, onRunOcr, onUpdateOutline, onAcceptOutline }: { project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onBack: () => void; onUseExternal: () => void; onContinue: () => void; onRunOcr: (engine: "cloudflare-ai" | "mistral-ocr") => Promise<void>; onUpdateOutline: (outline: SourceOutlineItem[]) => void; onAcceptOutline: (mode: OutlineMode) => void }) {
  const intelligence = project.sourceIntelligence;
  const headings = project.sourceHeadings;
  const plannedPages = totalBookPages(project.chapters);
  const requiresOcr = intelligence && ["ocr-required", "reading-contents", "failed", "paused"].includes(intelligence.status);
  const reviewingOutline = intelligence?.status === "outline-review";
  const updateItem = (id: string, patch: Partial<SourceOutlineItem>) => onUpdateOutline((intelligence?.outline || []).map((item) => item.id === id ? { ...item, ...patch } : item));
  const setChapterPages = (index: number, value: number) => onPatch({ chapters: setChapterPagesWithinLimit(project.chapters, index, value) });
  return <main className="analysis-page source-intelligence-page">
    <button className="text-button" onClick={onBack}>← Change setup</button>
    <p className="eyebrow">SOURCE INTELLIGENCE</p>
    <h1>{sourceBusy ? "Reading your source safely…" : reviewingOutline ? "Review the detected book structure." : requiresOcr ? "This scanned book needs OCR." : "Your source-led adaptation plan is ready."}</h1>
    <p className="lead">Book Studio first identifies the real Parts, chapters and physical page ranges. It never substitutes generic chapter names when a scan cannot be read.</p>
    <section className="source-pipeline" aria-label="Source analysis progress">
      {["Classify PDF", "Read contents", "Detect outline", "Verify ranges", "Ready"].map((label, index) => <div className={intelligence && intelligence.progress >= [5, 25, 55, 75, 100][index] ? "complete" : intelligence && intelligence.progress >= [0, 20, 45, 65, 90][index] ? "active" : ""} key={label}><span>{intelligence && intelligence.progress >= [5, 25, 55, 75, 100][index] ? "✓" : index + 1}</span><b>{label}</b></div>)}
    </section>
    <section className="stats"><div><span>SOURCE PAGES</span><strong>{project.sourcePages || intelligence?.totalPages || "—"}</strong></div><div><span>PDF TYPE</span><strong>{intelligence?.sourceKind || "searchable"}</strong></div><div><span>STRUCTURE FOUND</span><strong>{intelligence?.outline.length || headings.length || "Pending"}</strong></div><div><span>ANALYSIS</span><strong>{intelligence?.progress ?? (headings.length ? 100 : 0)}%</strong></div></section>
    {requiresOcr && <section className="ocr-choice-card">
      <span className="sr-only">Analyse source with Nemotron</span>
      <div><p className="eyebrow">SCAN DETECTED</p><h2>Read every page, then let Nemotron detect the real structure</h2><p>{intelligence?.message || "The PDF does not contain enough searchable text."}</p><ul><li>The scan is divided by both page count and parser-safe file size.</li><li>Every successful OCR batch is cached and never charged twice when resumed.</li><li>Nemotron receives compact structural evidence after OCR—not the oversized PDF.</li><li>Chapter writing later receives only that chapter’s verified cached pages.</li></ul></div>
      <div className="ocr-options"><div className="source-analysis-budget"><span><b>{intelligence?.ocrBatchesCompleted || 0}</b> / {intelligence?.ocrBatchesTotal || 1} OCR batches cached</span><span><b>{intelligence?.ocrPagesCached || 0}</b> / {intelligence?.totalPages || project.sourcePages} source pages read</span><span><b>{intelligence?.structureRequestCount || 0}</b> Nemotron structure request{intelligence?.structureRequestCount === 1 ? "" : "s"}</span></div><button className="external-workflow-button" disabled={sourceBusy} onClick={onUseExternal}><b>Use the simple external-AI workflow</b><span>Download one prompt, upload this source directly to ChatGPT, Claude or DeepSeek, then import the finished manuscript. No website OCR.</span></button><button className="recommended" disabled={sourceBusy} onClick={() => void onRunOcr("mistral-ocr")}><b>{sourceBusy ? "Analysing source…" : "Continue with Nemotron OCR"}</b><span>Advanced scanned-text extraction · cached batches · one final structure request · estimated OCR cost about ${intelligence?.ocrCostEstimateUsd?.toFixed(2) || "0.25"}</span></button><button disabled={sourceBusy} onClick={() => void onRunOcr("cloudflare-ai")}><b>Use free parser</b><span>Lower cost, but less reliable for photographed or difficult scans</span></button></div>
      {intelligence?.lastError && <p className="source-error">{intelligence.lastError}</p>}
    </section>}
    {reviewingOutline && <section className="outline-review-card">
      <header><div><p className="eyebrow">OUTLINE REVIEW</p><h2>Choose the publishing structure</h2><p>Edit any title or physical PDF range. Uncheck front matter or unwanted sections.</p></div><span>{intelligence.outline.length} detected entries</span></header>
      <div className="outline-mode-choice"><button onClick={() => onAcceptOutline("parts")}><b>Build from major Parts</b><span>Best for a concise adaptation. Uses the four high-level Parts when present.</span></button><button onClick={() => onAcceptOutline("chapters")}><b>Build from detailed chapters</b><span>Best for a longer book. Preserves all detected child chapters.</span></button></div>
      <div className="outline-table"><div className="outline-head"><span>Use</span><span>Type</span><span>Exact source title</span><span>PDF pages</span><span>Confidence</span></div>{intelligence.outline.map((item) => <div className="outline-row" key={item.id}><input aria-label={`Include ${item.title}`} type="checkbox" checked={item.included} onChange={(event) => updateItem(item.id, { included: event.target.checked })}/><select value={item.type} onChange={(event) => updateItem(item.id, { type: event.target.value as SourceOutlineItem["type"] })}><option value="part">Part</option><option value="chapter">Chapter</option><option value="section">Section</option></select><input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })}/><label><input type="number" min="1" max={intelligence.totalPages} value={item.sourceStartPage} onChange={(event) => updateItem(item.id, { sourceStartPage: Number(event.target.value) })}/><span>–</span><input type="number" min="1" max={intelligence.totalPages} value={item.sourceEndPage} onChange={(event) => updateItem(item.id, { sourceEndPage: Number(event.target.value) })}/></label><b className={item.confidence >= .8 ? "high" : "check"}>{Math.round(item.confidence * 100)}%</b></div>)}</div>
      <footer><button className="secondary" disabled={sourceBusy} onClick={() => void onRunOcr("mistral-ocr")}>Re-read with accurate OCR</button><small>Nothing is generated until you choose Parts or detailed chapters.</small></footer>
    </section>}
    {!requiresOcr && !reviewingOutline && <><div className="analysis-grid"><section className="analysis-card chapter-detection"><header><div><p className="eyebrow">VERIFIED ADAPTATION PLAN</p><h2>{headings.length} source divisions, each given only the space it needs</h2></div><button className="recalculate-plan" onClick={() => onPatch({ chapters: applyAutomaticAdaptationPlan(project.chapters, project.audience, true) })}>↻ Recalculate</button></header>{headings.map((heading, index) => { const chapter = project.chapters[index]; return <div className="heading-row context-row" key={`${index}-${heading}`}><span>{String(index + 1).padStart(2, "0")}</span><div className="chapter-context"><strong>{heading}</strong><p>{chapter?.context}</p><div><em>Source pp. {chapter?.sourceStartPage}–{chapter?.sourceEndPage}</em><em>{chapter?.sourcePageCount} scanned pages</em><em>{chapter?.complexity || "Verified"}</em></div><small>{chapter?.pageReason}</small></div><label><b>{chapter?.pagePlanCustom ? "CUSTOM" : "RECOMMENDED"}</b><input type="number" min="1" max={maximumChapterPages(project.chapters, index)} value={chapter?.pages ?? 1} onChange={(event) => setChapterPages(index, Number(event.target.value))}/><span>pages</span></label></div>; })}</section><aside><div className="analysis-card note"><p className="eyebrow">RANGE-SAFE GENERATION</p><p>Nemotron receives only one verified chapter range at a time. Completed chapters remain saved, and the existing three-pass quality limit still applies.</p></div><div className="analysis-card note"><p className="eyebrow">NO GENERIC FALLBACK</p><p>If a source cannot be read, this screen stops for OCR or manual outline review instead of inventing “Opening chapter.”</p></div></aside></div><footer className="analysis-footer"><span>Confirm only after the names and physical source ranges are correct.</span><button className="primary" disabled={sourceBusy || !headings.length || plannedPages > TOTAL_BOOK_PAGE_LIMIT} onClick={onContinue}>Confirm adaptation plan →</button></footer></>}
  </main>;
}

function LegacyAnalysis({ project, sourceBusy, onPatch, onBack, onContinue }: { project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onBack: () => void; onContinue: () => void }) {
  const headings = project.sourceHeadings.length ? project.sourceHeadings : ["Opening chapter"];
  const setChapterPages = (index: number, value: number) => onPatch({
    chapters: setChapterPagesWithinLimit(project.chapters, index, value),
  });
  const recalculate = () => onPatch({ chapters: applyAutomaticAdaptationPlan(project.chapters, project.audience, true) });
  const plannedPages = totalBookPages(project.chapters);
  return <main className="analysis-page"><button className="text-button" onClick={onBack}>← Change setup</button><p className="eyebrow">CHAPTER CONTEXT ANALYSIS</p><h1>{sourceBusy ? "Understanding every original chapter…" : "Your adaptation page plan is ready."}</h1><p className="lead">The studio selects the essential ideas in each chapter and recommends the shortest clear, age-appropriate adaptation. It may need 2 pages or 5 pages; it never adds text just to fill a book.</p><section className="stats"><div><span>SOURCE PAGES</span><strong>{project.sourcePages || "—"}</strong></div><div><span>SOURCE WORDS REVIEWED</span><strong>{project.sourceWords ? project.sourceWords.toLocaleString() : "Pending"}</strong></div><div><span>ORIGINAL CHAPTERS</span><strong>{headings.length}</strong></div><div><span>ESTIMATED BOOK LENGTH</span><strong>{plannedPages} pages</strong></div></section><div className="analysis-grid"><section className="analysis-card chapter-detection"><header><div><p className="eyebrow">AUTOMATIC ADAPTATION PLAN</p><h2>{headings.length} original chapters, each given only the space it needs</h2></div><button className="recalculate-plan" onClick={recalculate}>↻ Recalculate</button></header><div className="adaptation-plan-note"><b>How the recommendation works</b><span>The planner weighs essential ideas, difficulty, source breadth and the selected age. It allows room for a clear explanation, an example, one unique visual and an activity—then stops. Pages are not distributed to fill 100.</span></div>{headings.map((heading, index) => { const chapter = project.chapters[index]; return <div className="heading-row context-row" key={`${index}-${heading}`}><span>{String(index + 1).padStart(2, "0")}</span><div className="chapter-context"><strong>{heading}</strong><p>{chapter?.context || "Chapter context is being matched to the uploaded source."}</p><div><em>{chapter?.sourceStartPage ? `Source pp. ${chapter.sourceStartPage}–${chapter.sourceEndPage}` : "Source range pending"}</em><em>{chapter?.sourceWordCount ? `${chapter.sourceWordCount.toLocaleString()} words reviewed` : "Word count pending"}</em><em>{chapter?.complexity || "Analysing"}</em></div><small>{chapter?.pageReason || "The page recommendation will appear after source analysis."}</small></div><label><b>{chapter?.pagePlanCustom ? "CUSTOM" : "RECOMMENDED"}</b><input aria-label={`Adaptation pages for ${heading}`} type="number" min="1" max={maximumChapterPages(project.chapters, index)} value={chapter?.pages ?? 1} onChange={(event) => setChapterPages(index, Number(event.target.value))}/><span>pages</span></label></div>; })}</section><aside><div className="analysis-card"><p className="eyebrow">BOOK-WIDE THEMES</p><div className="tags">{(project.sourceTerms.length ? project.sourceTerms : ["analysis pending"]).map((term) => <span key={term}>{term}</span>)}</div></div><div className="analysis-card note"><p className="eyebrow">ADAPTATION, NOT SUMMARY</p><p>Every original chapter keeps its exact name and order. The writing explains the source for the selected child reader instead of merely shortening paragraphs.</p></div><div className="analysis-card note"><p className="eyebrow">LENGTH GUARDRAIL</p><p>100 pages is only the safety ceiling. A clear 30-page or 45-page adaptation stays that length; the studio never stretches it to 100.</p></div></aside></div><footer className="analysis-footer"><span>Edit a recommendation if needed. The studio keeps the complete book under 100 pages but never treats 100 as a target.</span><button className="primary" disabled={sourceBusy || !headings.length || plannedPages > TOTAL_BOOK_PAGE_LIMIT} onClick={onContinue}>Confirm adaptation plan →</button></footer></main>;
}

function BookBrief({ project, allocated, draftBusy, onBack, onUpdateChapter, onPrepare, onContinue }: { project: Project; allocated: number; draftBusy: boolean; onBack: () => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void; onPrepare: (scope: "sample" | "all" | "active") => void; onContinue: () => void }) {
  const drafted = project.chapters.filter((chapter) => chapterGenerationState(chapter) === "Completed").length;
  const quotaPaused = project.chapters.some((chapter) => chapterGenerationState(chapter) === "Paused by quota");
  const usage = generationTotals(project.chapters);
  const first = project.chapters[0];
  return <main className="brief-page">
    <button className="text-button" onClick={onBack}>← Back to source analysis</button>
    <header className="brief-hero"><div><p className="eyebrow">CHILDREN’S BOOK BRIEF & PAGE PLAN</p><h1>{project.title}</h1><p className="lead">An illustrated adaptation for {project.audience.toLowerCase()}, written in clear natural language in the {project.aesthetic.toLowerCase()} book world.</p><div className="brief-chips"><span>{project.language}</span><span>{project.readingLevel}</span><span>{project.pageAesthetic} pages</span><span>{project.bookBorder} border</span><span>{project.imageFrequency}</span></div></div><aside><span>PROMISE TO THE CHILD READER</span><p>Keep the source truthful, make every new word understandable, and give each chapter a visual and something worth thinking about.</p></aside></header>
    <div className="brief-layout"><section className="plan-card"><header><div><p className="eyebrow">STRUCTURE</p><h2>Chapter adaptation-page plan</h2></div><div className="budget-pill">{allocated} pages planned</div></header><div className="plan-head"><span>CHAPTER</span><span>ORIGINAL TITLE</span><span>PAGES</span><span>STATE</span></div>{project.chapters.map((chapter, index) => { const state = chapterGenerationState(chapter); return <div className="plan-row" key={chapter.id}><span>{String(index + 1).padStart(2, "0")}</span><strong className="preserved-title">{chapter.title}</strong><input aria-label={`Adaptation pages for ${chapter.title}`} type="number" min="1" max={maximumChapterPages(project.chapters, index)} value={chapter.pages} onChange={(event) => onUpdateChapter(chapter.id, { pages: Number(event.target.value), pagePlanCustom: true })}/><b className={`draft-state generation-${normalizedTitle(state).replace(/[^a-z]+/g, "-")}`}>{state}</b></div>; })}<footer><span>Each recommendation is the shortest comfortable treatment for the selected age. Eight pages are included for front and back matter; 100 pages remains a ceiling only.</span></footer></section>
      <aside className="generation-card"><p className="eyebrow">AUTOMATED PUBLISHING ENGINE</p><h2>One action builds the complete book</h2><p>Each chapter is checked locally, saved immediately and given exact feedback when Nemotron must improve it. The engine normally uses one pass and never exceeds three.</p><div className="request-budget"><span><b>1</b> normal draft per chapter</span><span><b>+2</b> targeted passes only if needed</span><span><b>0</b> local validation requests</span><span><b>0</b> page and export requests</span></div><div className="quality-gates"><span>Waiting</span><span>Generating</span><span>Completed</span><span>Human review</span><span>Quota pause</span></div><div className="draft-progress"><span><b>{drafted}</b> of {project.chapters.length} completed</span><i><b style={{ width: `${project.chapters.length ? drafted / project.chapters.length * 100 : 0}%` }}/></i></div><div className="generation-usage"><span><b>{usage.totalTokens.toLocaleString()}</b> total historical tokens</span><span><b>{usage.requests}</b> total Nemotron request{usage.requests === 1 ? "" : "s"}</span></div><button className="primary full" disabled={draftBusy} onClick={() => onPrepare("all")}>{draftBusy ? "Writing, checking and saving chapters…" : quotaPaused ? "Resume book" : drafted ? "Resume unfinished book" : "Build this book"}</button><small>Local fixes cost zero tokens. A second or third pass receives only the previous failures and focused source evidence. Quota errors stop immediately; no chapter receives a fourth automatic request.</small></aside></div>
    {first && <section className="sample-spread"><div className="sample-copy"><p className="eyebrow">SAMPLE SPREAD</p><span>CHAPTER 01</span><h2>{first.title}</h2>{first.pedagogyQuality && <div className="sample-quality"><b>{first.pedagogyQuality.status === "passed" ? "✓ Teaching quality passed" : "Human review required"} · {pedagogyAverage(first.pedagogyQuality)}/100</b><span>{first.pedagogyQuality.summary}</span></div>}<p>{first.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 420)}</p></div>{first.imageUrl ? <figure className="sample-art sample-art-image"><img src={first.imageUrl} alt={first.imageAlt || first.imageCaption || first.title}/><figcaption>{first.imageCaption || first.title}</figcaption></figure> : <div className="sample-art"><span>ILLUSTRATION DIRECTION</span><strong>{project.aesthetic}</strong><p>{first.title} · {project.imageFrequency}</p><b>✦</b></div>}</section>}
    <footer className="brief-actions"><div><b>Ready for editorial review</b><span>{drafted ? `${drafted} chapter draft${drafted === 1 ? "" : "s"} prepared` : "Prepare at least one chapter now, or begin with a blank structure."}</span></div><button className="primary" onClick={onContinue}>Approve brief & open studio →</button></footer>
  </main>;
}

function Editor({ project, active, activeId, allocated, draftBusy, onSelect, editorRef, onSaveBody, onAi, onRemember, onAddChapter, onUploadImage, onPatchProject, onUpdateChapter }: { project: Project; active?: Chapter; activeId: number; allocated: number; draftBusy: boolean; onSelect: (id: number) => void; editorRef: React.RefObject<HTMLDivElement | null>; onSaveBody: () => void; onAi: (action: string) => void; onRemember: (scope: "book" | "designer") => void; onAddChapter: () => void; onUploadImage: (file: File) => void; onPatchProject: (patch: Partial<Project>) => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void }) {
  const [tab, setTab] = useState<"ai" | "design" | "sources">("ai");
  useEffect(() => {
    document.documentElement.dataset.pageWatermark = normalizedTitle(pageWatermark(project.pageWatermark).value).replace(/[^a-z]+/g, "-");
    return () => { delete document.documentElement.dataset.pageWatermark; };
  }, [project.pageWatermark]);
  if (!active) return null;
  const fontClass = project.fontTheme.toLowerCase().replace(/[^a-z]+/g, "-");
  const pageClass = normalizedTitle(project.pageAesthetic).replace(/[^a-z]+/g, "-");
  const borderClass = normalizedTitle(project.bookBorder).replace(/[^a-z]+/g, "-");
  return <main className="editor-layout">
    <aside className="chapters"><header><p className="eyebrow">BOOK STRUCTURE</p><button onClick={onAddChapter} aria-label="Add chapter">＋</button></header><div className="front-matter"><span>FM</span><div><b>Front matter</b><small>Cover · Contents · Preface</small></div></div>{project.chapters.map((chapter) => { const state = chapterGenerationState(chapter); return <button className={chapter.id === activeId ? "chapter active" : "chapter"} onClick={() => onSelect(chapter.id)} key={chapter.id}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small className={`chapter-generation-state generation-${normalizedTitle(state).replace(/[^a-z]+/g, "-")}`}>{state}{chapter.generationUsage?.totalTokens ? ` · ${chapter.generationUsage.totalTokens.toLocaleString()} tokens` : ""}</small></div></button>; })}<div className="page-budget"><span><b>{allocated}</b> planned pages</span><small>Natural length · 100-page safety ceiling</small></div></aside>
    <section className="canvas"><nav className="editor-tools"><div><button onClick={() => document.execCommand("bold")}><b>B</b></button><button onClick={() => document.execCommand("italic")}><i>I</i></button><button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button><button onClick={() => document.execCommand("insertUnorderedList")}>• List</button></div><label className="editor-typography-select">Typography<select value={project.fontTheme} onChange={(event) => onPatchProject(typographyPatch(event.target.value))}>{typographyThemes.map((theme) => <option key={theme.value}>{theme.value}</option>)}</select></label><div className="chapter-meter"><span>{active.pages} target pages</span><i><b style={{ width: active.status === "planned" ? "18%" : "67%" }}/></i><span className="always-editable">Always editable</span></div></nav><div className="page-stage"><article className={`paper ${bookPersonaClass(project.bookPersona)} font-${fontClass} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")} page-aesthetic-${pageClass} book-border-${borderClass} age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}${active.imageUrl ? " has-chapter-image" : ""}`}><header><span>{project.title}</span><span>{project.audience}</span></header><div className="ornament">✦</div><div key={active.id} ref={editorRef} className="book-copy" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: authorialReaderHtml(active.body) }}/>{active.imageUrl && <figure className="chapter-image"><img src={active.imageUrl} alt={active.imageAlt || active.imageCaption || active.title}/><figcaption>{active.imageCaption || active.title}</figcaption></figure>}<footer><span>{project.title}</span><span>{active.id}</span></footer></article></div><button className="save-float" onClick={onSaveBody}>✓ Save chapter</button></section>
    <aside className="assistant"><nav><button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>✦<span>AI EDIT</span></button><button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>◈<span>DESIGN</span></button><button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>⌕<span>SOURCES</span></button></nav><div className="assistant-body">
      {tab === "ai" && <><div className="assistant-title"><span>✦</span><div><b>Automatic quality editor</b><small>The website checks and repairs each chapter before saving it.</small></div></div><div className="request-control-card"><b>QUALITY FEEDBACK LOOP</b><span>Usually 1 Nemotron pass · maximum 3 only when meaningful content fails</span><small>Mechanical formatting is local · quota errors stop immediately · no fourth automatic request</small></div><div className={`generation-status-card generation-${normalizedTitle(chapterGenerationState(active)).replace(/[^a-z]+/g, "-")}`}><b>{chapterGenerationState(active)}</b><span>{active.generationUsage?.totalTokens ? `Total project history for this chapter: ${active.generationUsage.totalTokens.toLocaleString()} tokens · ${active.generationUsage.requests} request${active.generationUsage.requests === 1 ? "" : "s"}` : "No Nemotron usage recorded yet"}</span>{active.generationError && <small>{active.generationError}</small>}</div>{active.importValidated ? <div className="package-lock-report"><b>✓ STRUCTURED PACKAGE VERIFIED</b><p>{active.importedPages?.length || active.pages} page IDs are locked to Chapter {active.id}. Its text and images were imported without automatic redistribution.</p>{active.importedPages && <ol>{active.importedPages.map((page) => <li key={page.pageId}><span>{page.pageId}</span><b>{page.purpose}</b><i>{page.imageUrl ? "image linked" : "text"}</i></li>)}</ol>}</div> : active.pedagogyQuality ? <div className={`pedagogy-report ${active.pedagogyQuality.status === "passed" ? "" : "needs-review"}`}><header><div><b>{active.pedagogyQuality.status === "passed" ? "✓ READY FOR CHILDREN" : "HUMAN REVIEW REQUIRED"}</b><span>{pedagogyAverage(active.pedagogyQuality)}/100</span></div><p>{active.pedagogyQuality.summary}</p></header><div className="score-grid">{Object.entries(active.pedagogyQuality.scores).map(([name, score]) => <span key={name}><b>{score}</b>{qualityScoreLabels[name] || name}</span>)}</div><div className="quality-checks">{active.pedagogyQuality.checks.map((check) => <p key={check}>{active.pedagogyQuality?.status === "passed" ? "✓" : "•"} {check}</p>)}</div></div> : <div className="pedagogy-pending"><b>Waiting for the automated workflow</b><p>Use Build this book above. Drafting, local checks and up to two targeted feedback repairs happen automatically.</p></div>}<p className="selection-tip">This chapter has <b>{chapterWordCount(active).toLocaleString()} words</b>. Every edit keeps the voice direct and authorial for the selected age.</p><div className="ai-list">{["Simplify language", "Shorten selection", "Expand with examples", "Make age-appropriate", "Improve storytelling", "Check factual accuracy", "Suggest an illustration"].map((action) => <button onClick={() => onAi(action)} key={action}><span>✦</span>{action}<i>→</i></button>)}</div><div className="memory-box"><p className="eyebrow">EDITORIAL MEMORY</p><p>{project.editorialPreferences.length ? project.editorialPreferences.join(" · ") : "No saved preferences yet"}</p><button onClick={() => onRemember("book")}>＋ Remember for this book</button><button onClick={() => onRemember("designer")}>＋ Remember for future books</button></div></>}
      {tab === "design" && <><div className="assistant-title"><span>◈</span><div><b>Book design</b><small>Every chapter receives a context-read narrative scene—not a diagram.</small></div></div><div className="design-controls"><div className="visual-status"><b>{active.visualType === "uploaded" ? "✓ Finished chapter illustration" : "Scene direction ready"}</b><span>{active.visualType === "uploaded" ? "Your uploaded image will be used in the book" : "Built from this chapter’s people, place, objects and central action"}</span></div><button className="primary full scene-prompt-button" onClick={() => onAi("Suggest an illustration")}>✦ Create this chapter illustration</button><small className="scene-workflow-help">The studio prepares a complete narrative-scene prompt. Generate it in ChatGPT, then upload the finished image below.</small><label>Illustration world<select value={project.aesthetic} onChange={(e) => onPatchProject(designWorldPatch(e.target.value))}>{childDesignWorlds.map((world) => <option key={world.value}>{world.value}</option>)}</select></label><label>Page aesthetic<select value={project.pageAesthetic} onChange={(e) => onPatchProject(pageAestheticPatch(e.target.value))}>{pageAesthetics.map((aesthetic) => <option key={aesthetic.value}>{aesthetic.value}</option>)}</select></label><label>Book border<select value={project.bookBorder} onChange={(e) => onPatchProject(bookBorderPatch(e.target.value))}>{bookBorders.map((border) => <option key={border.value}>{border.value}</option>)}</select></label><label>Page watermark<select value={project.pageWatermark} onChange={(e) => onPatchProject(pageWatermarkPatch(e.target.value))}>{pageWatermarks.map((watermark) => <option key={watermark.value}>{watermark.value}</option>)}</select></label><div className="design-summary"><b>{project.pageAesthetic} · {project.bookBorder} · {project.pageWatermark}</b><span>{project.illustrationStyle} · {project.fontTheme} · {project.imageFrequency}</span></div><label className="image-upload">Upload finished chapter scene<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}/></label>{active.imageUrl && <label>Image caption<input value={active.imageCaption || ""} onChange={(e) => onUpdateChapter(active.id, { imageCaption: e.target.value })}/></label>}</div></>}
      {tab === "sources" && <><div className="assistant-title"><span>⌕</span><div><b>Private fact check</b><small>{active.sourceRefs.length} editor-only reference{active.sourceRefs.length === 1 ? "" : "s"} linked to this chapter · never printed.</small></div></div><div className="source-list">{active.sourceRefs.length ? active.sourceRefs.map((ref, index) => <article key={`${ref.title}-${index}`}><span>PRIVATE · PAGE {ref.page || "—"}</span><b>{ref.title}</b><p>{ref.excerpt}</p></article>) : <p className="empty">No private reference is linked yet. Prepare this chapter to attach the closest fact-checking passage.</p>}</div><div className="source-policy"><b>Editor-only provenance</b><p>Verify important names, dates and quotations before approval. These notes never appear in Preview, PDF or DOCX.</p></div></>}
    </div></aside>
  </main>;
}

function BookPackageImporter({ project, busy, onClose, onDownloadRequest, onImport }: { project: Project; busy: boolean; onClose: () => void; onDownloadRequest: () => Promise<void>; onImport: (bookPackage: BookPackage, images: File[]) => Promise<void> }) {
  const [bookPackage, setBookPackage] = useState<BookPackage | null>(null);
  const [validation, setValidation] = useState<BookPackageValidation | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestDownloaded, setRequestDownloaded] = useState(false);

  async function downloadRequest() {
    setError("");
    setRequestBusy(true);
    try {
      await onDownloadRequest();
      setRequestDownloaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The ChatGPT request could not be created.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function readCompletedZip(file: File) {
    setError("");
    setBookPackage(null);
    setValidation(null);
    setImages([]);
    try {
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose the single Completed-Children-Book.zip file from ChatGPT.");
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const manifestEntry = Object.entries(entries).find(([name]) => /(^|\/)book\.json$/i.test(name));
      if (!manifestEntry) throw new Error("This ZIP does not contain book.json. Ask ChatGPT to repair the completed package.");
      const parsed = JSON.parse(new TextDecoder().decode(manifestEntry[1])) as unknown;
      const checked = validateBookPackage(parsed, project.chapters, project.audience);
      setValidation(checked);
      setBookPackage(checked.package);
      const imageFiles = Object.entries(entries)
        .filter(([name]) => /\.(png|jpe?g|webp)$/i.test(name) && !name.endsWith("/"))
        .map(([name, bytes]) => {
          const basename = name.split("/").pop() || name;
          const extension = basename.toLowerCase().split(".").pop();
          const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
          return new File([bytes.slice().buffer], basename, { type });
        });
      setImages(imageFiles);
    } catch (reason) {
      setBookPackage(null);
      setValidation({ package: null, errors: [reason instanceof Error ? reason.message : "This is not a valid completed book ZIP."], warnings: [], chapterCount: 0, pageCount: 0, imageNames: [] });
    }
  }

  const suppliedNames = new Set(images.map((file) => file.name));
  const missingImages = validation?.imageNames.filter((name) => !suppliedNames.has(name)) ?? [];
  const canImport = Boolean(bookPackage && validation && !validation.errors.length && !missingImages.length && !busy);

  async function apply() {
    if (!bookPackage || !canImport) return;
    setError("");
    try { await onImport(bookPackage, images); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The package could not be imported."); }
  }

  return <div className="modal-backdrop"><section className="package-import-modal simple-book-flow"><header><div><p className="eyebrow">CHATGPT BOOK WORKFLOW</p><h2>Two files. No JSON work.</h2><p>Download one request for ChatGPT, then bring back one completed ZIP. The website keeps every page and image inside its correct chapter.</p></div><button onClick={onClose} disabled={busy || requestBusy}>×</button></header><div className="simple-flow-line" aria-label="Book workflow"><span className="active">1&nbsp; Website request</span><i>→</i><span>2&nbsp; ChatGPT creates book</span><i>→</i><span>3&nbsp; Upload finished book</span></div><div className="package-import-grid two-step"><section><span className="package-step">01</span><h3>Download the ChatGPT request</h3><p>It already contains the source book, age, language, design settings, chapter map and instructions. Upload this one ZIP to your personal ChatGPT.</p><button className="primary full" disabled={requestBusy || !project.sourceObjectKey} onClick={() => void downloadRequest()}>{requestBusy ? "Preparing source and settings…" : requestDownloaded ? "✓ Download again" : "↓ Download ChatGPT Book Request"}</button>{!project.sourceObjectKey && <small className="step-help">Upload the source book first.</small>}<div className="chatgpt-words"><b>Then tell ChatGPT:</b><span>“Show me the book plan. Do not create the final book until I approve it.”</span><span>After checking it, reply: “PLAN APPROVED. Create the complete book ZIP.”</span></div></section><section><span className="package-step">02</span><h3>Upload the completed book</h3><p>Choose only the single <b>Completed-Children-Book.zip</b> returned by ChatGPT. You do not select JSON or images separately.</p><label className="package-drop completed-drop">{validation ? "Choose a different completed ZIP" : "⇧ Choose Completed Book ZIP"}<input type="file" accept="application/zip,.zip" disabled={busy || requestBusy} onChange={(event) => event.target.files?.[0] && void readCompletedZip(event.target.files[0])}/></label><small className="step-help">The ZIP must contain book.json and the actual images.</small></section></div>{validation && <div className={`package-validation ${validation.errors.length || missingImages.length ? "invalid" : "valid"}`}><header><b>{validation.errors.length || missingImages.length ? "The finished book needs repair" : "Finished book verified"}</b><span>{validation.chapterCount} chapters · {validation.pageCount} content pages · {validation.imageNames.length} images</span></header>{validation.errors.map((message) => <p key={message}>× {message}</p>)}{!validation.errors.length && missingImages.map((name) => <p key={name}>× Missing actual image: {name}</p>)}{!validation.errors.length && !missingImages.length && <p>✓ No placeholders. Every page and image has one verified chapter destination.</p>}</div>}{error && <p className="package-error">{error}</p>}<footer><div><b>Nothing is guessed or moved</b><span>A broken or incomplete ZIP is rejected before it can replace your current book.</span></div><button className="secondary" onClick={onClose} disabled={busy || requestBusy}>Cancel</button><button className="primary" disabled={!canImport} onClick={() => void apply()}>{busy ? "Creating the finished book…" : "Accept completed book →"}</button></footer></section></div>;
}

function AiRoundTrip({ request, onChange, onClose, onApply }: { request: { action: string; prompt: string; selection: string; result: string }; onChange: (value: string) => void; onClose: () => void; onApply: () => void }) {
  const illustrationRequest = request.action === "Suggest an illustration" || request.action === "Create chapter illustration";
  const openChatGPT = async () => {
    try { await navigator.clipboard.writeText(request.prompt); } catch { /* clipboard permission can be unavailable */ }
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(request.prompt)}`, "_blank", "noopener,noreferrer");
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(request.prompt); } catch { /* clipboard permission can be unavailable */ }
  };
  return <div className="modal-backdrop"><section className={`ai-modal${illustrationRequest ? " illustration-prompt-modal" : ""}`}><header><div><p className="eyebrow">{illustrationRequest ? "CHAPTER-CONTEXT IMAGE PROMPT" : "CHATGPT EDIT"}</p><h2>{request.action}</h2></div><button onClick={onClose}>×</button></header>{illustrationRequest ? <><p className="illustration-prompt-help">This prompt already contains the selected chapter’s meaning, concepts, reader age, visual world, accuracy rules and print requirements. Generate the image, then upload it from the Design tab.</p><label className="illustration-prompt-label">Complete prompt<textarea readOnly value={request.prompt}/></label><footer><button className="secondary" onClick={() => void copyPrompt()}>Copy prompt</button><button className="primary" onClick={() => void openChatGPT()}>Generate in ChatGPT ↗</button><button className="secondary" onClick={onClose}>Close</button></footer></> : <><ol><li><button className="primary" onClick={openChatGPT}>Open this edit in ChatGPT ↗</button><small>The instruction is also copied automatically.</small></li><li><label>Paste ChatGPT’s revised text here<textarea value={request.result} onChange={(e) => onChange(e.target.value)} placeholder="Paste the approved revision…"/></label></li></ol><footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!request.result.trim()} onClick={onApply}>Apply and save revision</button></footer></>}</section></div>;
}

function paginateReaderHtml(html: string, audience: string) {
  const clean = authorialReaderHtml(html);
  const flattened = clean.replace(/<\/?(?:section|div)\b[^>]*>/gi, "");
  const rawBlocks = flattened.match(/<(h2|h3|p|blockquote|ul|ol|b)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [flattened];
  const age = childAgeBand(audience);
  // Calibrated to the usable A4 text area. The opening sheet reserves room for
  // the chapter title; continuation sheets use more of the page.
  const pageCapacity = age === "7-9" ? 2550 : age === "13-15" ? 3000 : 2750;
  const firstPageCapacity = Math.round(pageCapacity * .78);
  const textLength = (block: string) => block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  const blockWeightFor = (block: string) => textLength(block) + (/^<h[23]/i.test(block) ? 145 : 0) + (/^<(?:ul|ol|blockquote)/i.test(block) ? 100 : 0);
  const sentenceParts = (value: string) => value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const splitLongBlock = (block: string) => {
    if (textLength(block) <= pageCapacity * .76) return [block];
    const listMatch = block.match(/^<(ul|ol)\b[^>]*>([\s\S]*)<\/\1>$/i);
    if (listMatch) {
      const items = listMatch[2].match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
      const groups: string[] = [];
      let current: string[] = [];
      let length = 0;
      for (const item of items) {
        const itemLength = textLength(item);
        if (current.length && length + itemLength > pageCapacity * .66) {
          groups.push(`<${listMatch[1]}>${current.join("")}</${listMatch[1]}>`);
          current = [];
          length = 0;
        }
        current.push(item);
        length += itemLength;
      }
      if (current.length) groups.push(`<${listMatch[1]}>${current.join("")}</${listMatch[1]}>`);
      if (groups.length) return groups;
    }
    const paragraphMatch = block.match(/^<(p|blockquote)\b[^>]*>([\s\S]*)<\/\1>$/i);
    if (!paragraphMatch) return [block];
    const sentences = sentenceParts(paragraphMatch[2]);
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > pageCapacity * .64) {
        chunks.push(`<${paragraphMatch[1]}>${escapeHtml(current.trim())}</${paragraphMatch[1]}>`);
        current = "";
      }
      current += `${sentence.trim()} `;
    }
    if (current.trim()) chunks.push(`<${paragraphMatch[1]}>${escapeHtml(current.trim())}</${paragraphMatch[1]}>`);
    return chunks.length ? chunks : [block];
  };
  const splitBlockToFit = (block: string, availableWeight: number): [string, string] | null => {
    const listMatch = block.match(/^<(ul|ol)\b[^>]*>([\s\S]*)<\/\1>$/i);
    if (listMatch) {
      const items = listMatch[2].match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
      const availableText = availableWeight - 100;
      const head: string[] = [];
      let used = 0;
      for (const item of items) {
        const size = textLength(item);
        if (head.length && used + size > availableText) break;
        if (!head.length && size > availableText) break;
        head.push(item);
        used += size;
      }
      if (head.length && head.length < items.length) {
        const tag = listMatch[1].toLowerCase();
        return [`<${tag}>${head.join("")}</${tag}>`, `<${tag}>${items.slice(head.length).join("")}</${tag}>`];
      }
      return null;
    }
    const paragraphMatch = block.match(/^<(p|blockquote)(\b[^>]*)>([\s\S]*)<\/\1>$/i);
    if (!paragraphMatch) return null;
    const availableText = availableWeight - (paragraphMatch[1].toLowerCase() === "blockquote" ? 100 : 0);
    if (availableText < 260) return null;
    const fullText = sentenceParts(paragraphMatch[3]).map((sentence) => sentence.trim()).join(" ");
    if (fullText.length <= availableText) return null;
    const sentences = sentenceParts(paragraphMatch[3]);
    const head: string[] = [];
    let used = 0;
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (head.length && used + cleanSentence.length + 1 > availableText) break;
      if (!head.length && cleanSentence.length > availableText) {
        const words = cleanSentence.split(/\s+/);
        let partial = "";
        while (words.length && `${partial} ${words[0]}`.trim().length <= availableText) partial = `${partial} ${words.shift()}`.trim();
        if (partial.length >= 220) head.push(partial);
        break;
      }
      head.push(cleanSentence);
      used += cleanSentence.length + 1;
    }
    const headText = head.join(" ").trim();
    if (headText.length < 220 || headText.length >= fullText.length) return null;
    const tailText = fullText.slice(headText.length).trim();
    const tag = paragraphMatch[1].toLowerCase();
    const attributes = paragraphMatch[2] ?? "";
    return [`<${tag}${attributes}>${escapeHtml(headText)}</${tag}>`, `<${tag}${attributes}>${escapeHtml(tailText)}</${tag}>`];
  };
  const blocks = rawBlocks.flatMap(splitLongBlock);
  const pages: string[] = [];
  let current: string[] = [];
  let weight = 0;

  const pending = [...blocks];
  while (pending.length) {
    const block = pending.shift()!;
    const isHeading = /^<h[23]/i.test(block);
    const activeCapacity = pages.length === 0 ? firstPageCapacity : pageCapacity;
    const blockWeight = blockWeightFor(block);
    if (isHeading && current.length && weight > activeCapacity * .84) {
      pages.push(current.join(""));
      current = [];
      weight = 0;
    }
    if (current.length && weight + blockWeight > activeCapacity) {
      const available = activeCapacity - weight;
      const fitted = splitBlockToFit(block, available);
      if (fitted) {
        const [fragment, remainder] = fitted;
        current.push(fragment);
        pages.push(current.join(""));
        current = [];
        weight = 0;
        pending.unshift(remainder);
        continue;
      }
      const trailingHeading = current.length > 1 && /^<h[23]/i.test(current[current.length - 1]);
      if (trailingHeading) {
        const heading = current.pop()!;
        pages.push(current.join(""));
        current = [heading];
        weight = blockWeightFor(heading);
      } else {
        pages.push(current.join(""));
        current = [];
        weight = 0;
      }
    }
    current.push(block);
    weight += blockWeight;
  }
  if (current.length) pages.push(current.join(""));
  return pages.length ? pages : [clean];
}

function readerTextLength(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}

function Preview({ project, exportBusy, pdfProgress, onClose, onDownload }: { project: Project; exportBusy: boolean; pdfProgress: number; onClose: () => void; onDownload: () => void }) {
  const [viewMode, setViewMode] = useState<"book" | "chapter" | "page">("book");
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(.68);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState(project.chapters[0]?.id ?? 1);
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  const unresolved = project.chapters.filter((chapter) => !isPublishApproved(chapter));
  const worldClass = `${bookPersonaClass(project.bookPersona)} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")}`;
  const pageClass = `page-aesthetic-${normalizedTitle(project.pageAesthetic).replace(/[^a-z]+/g, "-")}`;
  const borderClass = `book-border-${normalizedTitle(project.bookBorder).replace(/[^a-z]+/g, "-")}`;
  const ageClass = `age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const chapterSheets = printable.chapters.flatMap((chapter) => {
    if (chapter.importValidated && chapter.importedPages?.length) return chapter.importedPages.map((page, index) => ({ kind: "chapter" as const, chapter, body: page.body, pageIndex: index, pageCount: chapter.importedPages!.length, imageUrl: page.imageUrl, imageCaption: page.imageCaption, imageAlt: page.imageAlt }));
    const pages = paginateReaderHtml(chapter.body, project.audience);
    // A short final text page and a separate illustration page created two
    // half-empty sheets in almost every chapter. Let the illustration occupy
    // the remaining lower half when the final page has enough safe room.
    const age = childAgeBand(project.audience);
    const shareLimit = age === "7-9" ? 1500 : age === "13-15" ? 1750 : 1625;
    const shareIllustration = Boolean(chapter.imageUrl) && readerTextLength(pages[pages.length - 1] ?? "") <= shareLimit;
    const pageCount = pages.length + (chapter.imageUrl && !shareIllustration ? 1 : 0);
    const text = pages.map((body, index) => {
      const includesIllustration = shareIllustration && index === pages.length - 1;
      return { kind: "chapter" as const, chapter, body, pageIndex: index, pageCount, imageUrl: includesIllustration ? chapter.imageUrl : undefined, imageCaption: includesIllustration ? chapter.imageCaption : undefined, imageAlt: includesIllustration ? chapter.imageAlt : undefined };
    });
    return chapter.imageUrl && !shareIllustration ? [...text, { kind: "chapter" as const, chapter, body: "", pageIndex: pages.length, pageCount, imageUrl: chapter.imageUrl, imageCaption: chapter.imageCaption, imageAlt: chapter.imageAlt }] : text;
  });
  const sheets: ({ kind: "cover" | "contents" | "back" } | (typeof chapterSheets)[number])[] = [{ kind: "cover" }, { kind: "contents" }, ...chapterSheets, { kind: "back" }];
  const renderSheet = (sheet: (typeof sheets)[number], key: string) => {
    const base = `book-sheet ${worldClass} ${pageClass} ${borderClass}`;
    if (sheet.kind === "cover") return <article className={`${base} preview-cover`} key={key}><div className="cover-edition">IKS BOOK STUDIO · {project.audience.toUpperCase()}</div><h1>{project.title}</h1><span>An illustrated book shaped from your source</span><b>✦</b>{unresolved.length > 0 && <small className="draft-status">Working preview · {unresolved.length} chapter{unresolved.length === 1 ? "" : "s"} still in progress</small>}</article>;
    if (sheet.kind === "contents") return <article className={`${base} preview-page contents-page`} key={key}><span>CONTENTS</span><h2>Inside this book</h2><ol>{printable.chapters.map((chapter, index) => <li key={chapter.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{chapter.title}</span><i>{isPublishApproved(chapter) ? `${chapter.pages} pages` : "In progress"}</i></li>)}</ol></article>;
    if (sheet.kind === "back") return <article className={`${base} preview-page backmatter`} key={key}><span>A FINAL THOUGHT</span><h2>Keep wondering</h2><p>The most powerful ideas do not end on the last page. They grow when we ask careful questions, notice new connections and share what we discover.</p><p>Carry one idea from this book into the world—and see where it leads.</p></article>;
    const image = Boolean(sheet.imageUrl) && !sheet.body;
    const combined = Boolean(sheet.imageUrl) && Boolean(sheet.body);
    const waitingForContent = chapterWordCount(sheet.chapter) < 45 && !sheet.chapter.importValidated;
    return <article className={`${base} preview-page chapter-preview ${ageClass}${image ? " chapter-visual-sheet" : ""}${combined ? " chapter-text-visual-sheet" : ""}`} key={key}><header className="print-chapter-header"><span>CHAPTER {sheet.chapter.id}</span><span>PAGE {sheet.pageIndex + 1} OF {sheet.pageCount}</span></header>{sheet.pageIndex === 0 && <h2>{sheet.chapter.title}</h2>}{sheet.pageIndex > 0 && !image && <p className="continued-title">{sheet.chapter.title} · continued</p>}{sheet.body && <div className="preview-body" dangerouslySetInnerHTML={{ __html: sheet.body }}/>} {waitingForContent && sheet.pageIndex === 0 && <div className="unfinished-page-note"><b>Chapter in progress</b><span>Generated content will appear here automatically. You can still preview and download the complete book layout now.</span></div>}{sheet.imageUrl && <figure className="chapter-image"><img src={sheet.imageUrl} alt={sheet.imageAlt || sheet.imageCaption || sheet.chapter.title}/><figcaption>{sheet.imageCaption || sheet.chapter.title}</figcaption></figure>}<footer className="sheet-number"><span>{project.title}</span><span>{sheet.pageIndex + 1}</span></footer></article>;
  };
  const current = sheets[Math.min(pageIndex, Math.max(0, sheets.length - 1))];
  const currentChapter = current?.kind === "chapter" ? current.chapter.id : current?.kind === "contents" ? -1 : 0;
  const selectedChapterSheets = chapterSheets.filter((sheet) => sheet.chapter.id === selectedChapterId);
  const selectedChapter = project.chapters.find((chapter) => chapter.id === selectedChapterId) ?? project.chapters[0];
  const selectedChapterPosition = Math.max(0, project.chapters.findIndex((chapter) => chapter.id === selectedChapterId));
  const goToChapter = (chapterId: number) => {
    setSelectedChapterId(chapterId);
    const index = sheets.findIndex((sheet) => sheet.kind === "chapter" && sheet.chapter.id === chapterId);
    if (index >= 0) setPageIndex(index);
  };
  const moveChapter = (direction: -1 | 1) => {
    const next = project.chapters[selectedChapterPosition + direction];
    if (next) goToChapter(next.id);
  };
  const scaledSheet = (sheet: (typeof sheets)[number], key: string) => <div className="continuous-sheet-frame" style={{ width: 794 * zoom, height: 1123 * zoom }} key={key}><div style={{ transform: `scale(${zoom})` }}>{renderSheet(sheet, key)}</div></div>;
  return <div className="modal-backdrop book-preview-backdrop"><section className="preview-modal preview-v2"><header className="preview-main-header"><div><p className="eyebrow">BOOK PREVIEW</p><h2>{project.title}</h2><span>{sheets.length} pages · {project.chapters.length} chapters</span></div><div className="preview-header-actions"><button className="download-book-button" onClick={onDownload} disabled={exportBusy}>{exportBusy ? `Creating PDF · ${pdfProgress}%` : "Download PDF"}</button><button className="preview-close" onClick={onClose} aria-label="Close preview">×</button></div></header><div className={`preview-availability ${unresolved.length ? "working" : "complete"}`}><span className="preview-status-dot"/><div><b>{unresolved.length ? "Preview and PDF are available now" : "Book ready to publish"}</b><small>{unresolved.length ? `${unresolved.length} chapter${unresolved.length === 1 ? " is" : "s are"} still being improved. Nothing is locked, and unfinished pages are included.` : "Every chapter is included in the downloadable book."}</small></div></div><div className="preview-mode-bar"><div className="preview-mode-switch" aria-label="Preview layout"><button className={viewMode === "book" ? "active" : ""} onClick={() => setViewMode("book")}><b>Whole book</b><span>Scroll every page</span></button><button className={viewMode === "chapter" ? "active" : ""} onClick={() => setViewMode("chapter")}><b>Chapter</b><span>All chapter pages</span></button><button className={viewMode === "page" ? "active" : ""} onClick={() => setViewMode("page")}><b>Single page</b><span>Focused reading</span></button></div></div><div className="preview-toolbar">{viewMode === "page" ? <div className="page-navigation"><button onClick={() => setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0} aria-label="Previous page">←</button><span><b>{pageIndex + 1}</b> / {sheets.length}</span><button onClick={() => setPageIndex(Math.min(sheets.length - 1, pageIndex + 1))} disabled={pageIndex === sheets.length - 1} aria-label="Next page">→</button></div> : viewMode === "chapter" ? <div className="page-navigation chapter-navigation"><button onClick={() => moveChapter(-1)} disabled={selectedChapterPosition === 0} aria-label="Previous chapter">←</button><span><b>{selectedChapterPosition + 1}</b> / {project.chapters.length}</span><button onClick={() => moveChapter(1)} disabled={selectedChapterPosition === project.chapters.length - 1} aria-label="Next chapter">→</button></div> : <div className="preview-scope-summary"><b>{sheets.length}</b><span>pages shown below</span></div>}{viewMode === "page" ? <select aria-label="Jump to chapter" value={currentChapter} onChange={(event) => { const destination = Number(event.target.value); destination > 0 ? goToChapter(destination) : setPageIndex(destination === -1 ? 1 : 0); }}><option value={0}>Cover</option><option value={-1}>Contents</option>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.id} · {chapter.title}</option>)}</select> : viewMode === "chapter" ? <select aria-label="Choose chapter" value={selectedChapterId} onChange={(event) => goToChapter(Number(event.target.value))}>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.id} · {chapter.title}</option>)}</select> : <div className="whole-book-label">Cover → Contents → Every chapter → Back cover</div>}<div className="zoom-controls"><button onClick={() => setZoom(Math.max(.45, zoom - .1))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(Math.min(1.1, zoom + .1))} aria-label="Zoom in">＋</button><button onClick={() => setZoom(.68)}>Fit page</button><button onClick={() => setZoom(.92)}>Fit width</button>{viewMode === "page" && <button onClick={() => setShowThumbnails(!showThumbnails)}>{showThumbnails ? "Hide pages" : "Show pages"}</button>}</div></div>{viewMode === "book" ? <div className="continuous-book-stage whole-book-preview" aria-label="Whole book preview">{sheets.map((sheet, index) => scaledSheet(sheet, `whole-book-${index}`))}</div> : viewMode === "chapter" ? <div className="continuous-book-stage chapter-book-preview" aria-label={`Chapter ${selectedChapterId} preview`}><div className="chapter-preview-heading"><div><span>CHAPTER {selectedChapterId}</span><h3>{selectedChapter?.title}</h3></div><b>{selectedChapterSheets.length} page{selectedChapterSheets.length === 1 ? "" : "s"}</b></div>{selectedChapterSheets.map((sheet, index) => scaledSheet(sheet, `chapter-${selectedChapterId}-${index}`))}</div> : <div className="page-viewer-shell">{showThumbnails && <aside className="page-thumbnails">{sheets.map((sheet, index) => <button className={index === pageIndex ? "active" : ""} onClick={() => setPageIndex(index)} key={index}><span>{index + 1}</span><b>{sheet.kind === "chapter" ? `Chapter ${sheet.chapter.id}` : sheet.kind}</b></button>)}</aside>}<div className="single-page-stage"><div style={{ transform: `scale(${zoom})` }}>{renderSheet(current, `visible-${pageIndex}`)}</div></div></div>}<div className="pdf-render-stack" aria-hidden="true">{sheets.map((sheet, index) => renderSheet(sheet, `export-${index}`))}</div></section></div>;
}

type DesignerBasePage = {
  slotId: string;
  label: string;
  kind: "cover" | "contents" | "chapter" | "back";
  chapterId?: number;
  pageIndex?: number;
  html: string;
};

function designerBasePages(project: Project): DesignerBasePage[] {
  const printable = printableChapters(project.chapters);
  const pages: DesignerBasePage[] = [
    { slotId: "cover", label: "Front cover", kind: "cover", html: `<div class="cover-edition">IKS BOOK STUDIO · ${escapeHtml(project.audience.toUpperCase())}</div><h1>${escapeHtml(project.title)}</h1><span>An illustrated book shaped from your source</span><b>✦</b>` },
    { slotId: "contents", label: "Contents page", kind: "contents", html: `<span>CONTENTS</span><h2>Inside this book</h2><ol>${printable.chapters.map((chapter, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(chapter.title)}</span><i>${isPublishApproved(chapter) ? `${chapter.pages} pages` : "In progress"}</i></li>`).join("")}</ol>` },
  ];
  printable.chapters.forEach((chapter) => {
    const textPages = chapter.importValidated && chapter.importedPages?.length ? chapter.importedPages.map((page) => page.body) : paginateReaderHtml(chapter.body, project.audience);
    textPages.forEach((body, pageIndex) => pages.push({
      slotId: `chapter-${chapter.id}-page-${pageIndex + 1}`,
      label: `Chapter ${chapter.id} · page ${pageIndex + 1}`,
      kind: "chapter",
      chapterId: chapter.id,
      pageIndex,
      html: `<header class="print-chapter-header"><span>CHAPTER ${chapter.id}</span><span>PAGE ${pageIndex + 1} OF ${textPages.length}</span></header>${pageIndex === 0 ? `<h2>${escapeHtml(chapter.title)}</h2>` : `<p class="continued-title">${escapeHtml(chapter.title)} · continued</p>`}<div class="preview-body">${body}</div>${chapter.imageUrl && pageIndex === textPages.length - 1 ? `<figure class="chapter-image"><img src="${escapeHtml(chapter.imageUrl)}" alt="${escapeHtml(chapter.imageAlt || chapter.title)}"><figcaption>${escapeHtml(chapter.imageCaption || chapter.title)}</figcaption></figure>` : ""}<footer class="sheet-number"><span>${escapeHtml(project.title)}</span><span>${pageIndex + 1}</span></footer>`,
    }));
    if (chapter.imageUrl && !textPages.some((body) => body.includes(chapter.imageUrl!))) pages.push({
      slotId: `chapter-${chapter.id}-page-${textPages.length + 1}`,
      label: `Chapter ${chapter.id} · illustration`,
      kind: "chapter",
      chapterId: chapter.id,
      pageIndex: textPages.length,
      html: `<header class="print-chapter-header"><span>CHAPTER ${chapter.id}</span><span>PAGE ${textPages.length + 1} OF ${textPages.length + 1}</span></header><figure class="chapter-image designer-full-figure"><img src="${escapeHtml(chapter.imageUrl)}" alt="${escapeHtml(chapter.imageAlt || chapter.title)}"><figcaption>${escapeHtml(chapter.imageCaption || chapter.title)}</figcaption></figure><footer class="sheet-number"><span>${escapeHtml(project.title)}</span><span>${textPages.length + 1}</span></footer>`,
    });
  });
  pages.push({ slotId: "back", label: "Back cover", kind: "back", html: "<span>A FINAL THOUGHT</span><h2>Keep wondering</h2><p>The most powerful ideas do not end on the last page. They grow when we ask careful questions, notice new connections and share what we discover.</p><p>Carry one idea from this book into the world—and see where it leads.</p>" });
  return pages;
}

function designerBookClasses(project: Project) {
  return `${bookPersonaClass(project.bookPersona)} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")} page-aesthetic-${normalizedTitle(project.pageAesthetic).replace(/[^a-z]+/g, "-")} book-border-${normalizedTitle(project.bookBorder).replace(/[^a-z]+/g, "-")} typography-${normalizedTitle(project.fontTheme).replace(/[^a-z]+/g, "-")}`;
}

function designerPageClasses(project: Project, page: { kind: string; chapterId?: number }) {
  if (page.kind === "cover") return "preview-cover";
  if (page.kind === "contents") return "preview-page contents-page";
  if (page.kind === "back") return "preview-page backmatter";
  const ageClass = `age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return `preview-page chapter-preview ${ageClass}`;
}

function isLegacyDesignerScaffold(page: DesignerPageOverride) {
  return page.html.includes("designer-cover-copy") || page.html.includes("designer-kicker");
}

function defaultDesignerRevision(html = ""): DesignerPageRevision {
  return { html, intentionalBlank: false, deleted: false, layoutLocked: false, backgroundColor: "#fffdf8", watermarkText: "", watermarkOpacity: .12, watermarkRotation: -25, contentVisible: true, watermarkVisible: true, fontFamily: "Georgia, serif", fontSize: 15, textColor: "#243b34", lineHeight: 1.55, letterSpacing: 0, paragraphSpacing: 11, columns: 1, columnGap: 28, pagePadding: 60, borderStyle: "none", borderColor: "#b4863e", borderWidth: 2, borderInset: 10, borderRadius: 0, backgroundSize: "cover", backgroundPosition: "center", backgroundOpacity: 1, watermarkRepeat: false, watermarkX: 50, watermarkY: 50, savedAt: new Date().toISOString() };
}

function hydrateDesignerRevision(revision: Partial<DesignerPageRevision> | undefined, html = ""): DesignerPageRevision {
  return { ...defaultDesignerRevision(html), ...(revision ?? {}), html: revision?.html ?? html };
}

function hydrateDesignerOverride(page: DesignerPageOverride): DesignerPageOverride {
  return { ...page, ...hydrateDesignerRevision(page, page.html), history: (page.history ?? []).map((revision) => hydrateDesignerRevision(revision, revision.html)) };
}

const designerStyleKeys: (keyof DesignerPageRevision)[] = ["backgroundColor", "backgroundImageUrl", "backgroundImageKey", "backgroundSize", "backgroundPosition", "backgroundOpacity", "watermarkText", "watermarkImageUrl", "watermarkImageKey", "watermarkOpacity", "watermarkRotation", "watermarkRepeat", "watermarkX", "watermarkY", "watermarkVisible", "fontFamily", "fontSize", "textColor", "lineHeight", "letterSpacing", "paragraphSpacing", "columns", "columnGap", "pagePadding", "borderStyle", "borderColor", "borderWidth", "borderInset", "borderRadius"];

function designerStyleFrom(revision: DesignerPageRevision) {
  return Object.fromEntries(designerStyleKeys.map((key) => [key, revision[key]])) as Partial<DesignerPageRevision>;
}

function designerFlowBody(html: string) {
  const previewBody = html.match(/<div class=["']preview-body["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const figures = html.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) ?? [];
  if (previewBody !== undefined) return `${previewBody}${figures.join("")}`;
  return html
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<p class=["']continued-title["'][^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "")
    .trim();
}

function designerChapterPageHtml(project: Project, chapter: Chapter, body: string, pageIndex: number, pageCount: number) {
  return `<header><span>CHAPTER ${chapter.id}</span><span>PAGE ${pageIndex + 1} OF ${pageCount}</span></header>${pageIndex === 0 ? `<h2>${escapeHtml(chapter.title)}</h2>` : `<p class="continued-title">${escapeHtml(chapter.title)} · continued</p>`}<div class="preview-body">${body}</div><footer>${escapeHtml(project.title)}</footer>`;
}

function designerPageFill(html: string, audience: string, firstPage: boolean) {
  const age = childAgeBand(audience);
  const capacity = (age === "7-9" ? 2550 : age === "13-15" ? 3000 : 2750) * (firstPage ? .78 : 1);
  const text = readerTextLength(designerFlowBody(html));
  const imageWeight = (html.match(/<img\b/gi) ?? []).length * 850;
  const ratio = Math.max(0, Math.round(((text + imageWeight) / capacity) * 100));
  if (ratio > 104) return { ratio, label: "Overflowing", tone: "overflow" };
  if (ratio >= 72) return { ratio, label: "Balanced", tone: "balanced" };
  if (ratio >= 52) return { ratio, label: "Room available", tone: "room" };
  return { ratio, label: "Too empty", tone: "empty" };
}

function DesignerStudio({ project, onClose, onPreview, onCommit }: { project: Project; onClose: () => void; onPreview: () => void; onCommit: (next: Project) => Promise<void> }) {
  const basePages = useMemo(() => designerBasePages(project), [project]);
  const savedPages = (project.designerPages ?? []).map(hydrateDesignerOverride).map((page) => {
    const base = basePages.find((candidate) => candidate.slotId === page.slotId);
    return base && isLegacyDesignerScaffold(page) ? { ...page, html: base.html } : page;
  });
  const customPages = savedPages.filter((page) => page.kind === "custom");
  const allPages = [...basePages, ...customPages.map((page) => ({ slotId: page.slotId, label: page.label, kind: "custom" as const, chapterId: page.chapterId, pageIndex: page.pageIndex, html: page.html }))];
  const order = [...(project.designerPageOrder ?? []).filter((slotId) => allPages.some((page) => page.slotId === slotId)), ...allPages.map((page) => page.slotId).filter((slotId) => !(project.designerPageOrder ?? []).includes(slotId))];
  const orderedPages = order.map((slotId) => allPages.find((page) => page.slotId === slotId)!).filter(Boolean);
  const [selectedId, setSelectedId] = useState(order[0] ?? "cover");
  const selected = orderedPages.find((page) => page.slotId === selectedId) ?? orderedPages[0];
  const saved = savedPages.find((page) => page.slotId === selected?.slotId);
  const [draft, setDraft] = useState<DesignerPageRevision>(() => hydrateDesignerRevision(saved, selected?.html));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Designer edits are local and use no AI tokens.");
  const [panel, setPanel] = useState<"page" | "text" | "image" | "layers" | "preflight">("page");
  const [selectedObject, setSelectedObject] = useState<"page" | "text box" | "image">("page");
  const [undoStack, setUndoStack] = useState<DesignerPageRevision[]>([]);
  const [redoStack, setRedoStack] = useState<DesignerPageRevision[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [bookIssues, setBookIssues] = useState<{ slotId: string; label: string; issue: string }[]>([]);
  const [pendingBackground, setPendingBackground] = useState<{ key: string; url: string; fileName: string } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const bookEditors = useRef(new Map<string, HTMLDivElement>());
  const liveBookHtml = useRef<Record<string, string>>({});
  const liveBookDrafts = useRef<Record<string, DesignerPageRevision>>({});
  const [dirtyPages, setDirtyPages] = useState<string[]>([]);
  const selectedNode = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nextSaved = savedPages.find((page) => page.slotId === selected?.slotId);
    const next = hydrateDesignerRevision(nextSaved, selected?.html);
    const liveDraft = liveBookDrafts.current[selected?.slotId ?? ""];
    setDraft(liveDraft ?? { ...next, html: liveBookHtml.current[selected?.slotId ?? ""] ?? next.html });
    setUndoStack([]); setRedoStack([]); setIssues([]); setPendingBackground(null); setSelectedObject("page"); selectedNode.current = null;
  }, [selectedId]);

  const currentSnapshot = () => ({ ...draft, html: editor.current?.innerHTML ?? draft.html });
  const revisionFor = (page: (typeof allPages)[number]) => {
    const stored = savedPages.find((item) => item.slotId === page.slotId);
    const base = liveBookDrafts.current[page.slotId] ?? hydrateDesignerRevision(stored, page.html);
    const html = liveBookHtml.current[page.slotId] ?? base.html;
    return page.slotId === selectedId ? { ...draft, html } : { ...base, html };
  };
  const rememberLiveHtml = (slotId: string, html: string) => {
    liveBookHtml.current[slotId] = html;
    setDirtyPages((current) => current.includes(slotId) ? current : [...current, slotId]);
  };
  const changeDraft = (patch: Partial<DesignerPageRevision>, remember = true) => {
    if (remember) setUndoStack((stack) => [...stack.slice(-29), currentSnapshot()]);
    setRedoStack([]);
    setDraft((current) => {
      const next = { ...current, ...patch };
      liveBookDrafts.current[selectedId] = next;
      return next;
    });
    setDirtyPages((current) => current.includes(selectedId) ? current : [...current, selectedId]);
  };
  const undo = () => {
    const previous = undoStack.at(-1); if (!previous) return;
    setRedoStack((stack) => [...stack, { ...draft, html: editor.current?.innerHTML ?? draft.html }]);
    setUndoStack((stack) => stack.slice(0, -1)); liveBookDrafts.current[selectedId] = previous; setDraft(previous);
  };
  const redo = () => {
    const next = redoStack.at(-1); if (!next) return;
    setUndoStack((stack) => [...stack, draft]); setRedoStack((stack) => stack.slice(0, -1)); liveBookDrafts.current[selectedId] = next; setDraft(next);
  };
  const command = (name: string, value?: string) => { setUndoStack((stack) => [...stack.slice(-29), currentSnapshot()]); setRedoStack([]); editor.current?.focus(); document.execCommand(name, false, value); if (editor.current) rememberLiveHtml(selectedId, editor.current.innerHTML); setMessage("Text formatting changed. Save the whole book when ready."); };
  const uploadAsset = async (file: File) => {
    const form = new FormData(); form.set("file", file); form.set("projectId", project.id);
    const response = await fetch("/api/image", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { image?: { key: string; url: string }; error?: string };
    if (!response.ok || !data.image) throw new Error(data.error || "Image upload failed");
    return data.image;
  };
  const descriptorFor = (slotId: string) => allPages.find((page) => page.slotId === slotId);
  const makeOverride = (descriptor: (typeof allPages)[number], revision: DesignerPageRevision, existing?: DesignerPageOverride): DesignerPageOverride => {
    const snapshot = existing ? (() => { const r = hydrateDesignerRevision(existing, existing.html) as unknown as Record<string, unknown>; const { history: _ignoredHistory, ...rest } = r as { history?: unknown } & typeof r; return { ...rest, savedAt: new Date().toISOString() }; })() : null;
    return { ...revision, slotId: descriptor.slotId, label: descriptor.label, kind: descriptor.kind, chapterId: descriptor.chapterId, pageIndex: descriptor.pageIndex, history: snapshot ? [snapshot as unknown as DesignerPageRevision & { savedAt: string }, ...existing!.history].slice(0, 5) as unknown as DesignerPageRevision[] : [] };
  };
  const saveRevision = async (revisionToSave = draft) => {
    if (!selected) return; setBusy(true);
    try {
      const html = revisionToSave.intentionalBlank ? revisionToSave.html : (editor.current?.innerHTML ?? revisionToSave.html);
      const revision = { ...revisionToSave, html, savedAt: new Date().toISOString() };
      const replacement = makeOverride(selected, revision, saved);
      const next = { ...project, designerPages: [...savedPages.filter((page) => page.slotId !== selected.slotId), replacement], designerPageOrder: order };
      await onCommit(next); liveBookDrafts.current[selected.slotId] = replacement; setDraft(replacement); setDirtyPages((current) => current.filter((slotId) => slotId !== selected.slotId)); setUndoStack([]); setRedoStack([]); setMessage(`${selected.label} saved. Preview and PDF now use this exact page.`);
    } finally { setBusy(false); }
  };
  const savePageById = async (slotId: string) => {
    const descriptor = descriptorFor(slotId);
    if (!descriptor) return;
    setBusy(true);
    try {
      const existing = savedPages.find((page) => page.slotId === slotId);
      const current = revisionFor(descriptor);
      const revision = { ...current, html: bookEditors.current.get(slotId)?.innerHTML ?? current.html, savedAt: new Date().toISOString() };
      const replacement = makeOverride(descriptor, revision, existing);
      const next = { ...project, designerPages: [...savedPages.filter((page) => page.slotId !== slotId), replacement], designerPageOrder: order };
      await onCommit(next);
      liveBookDrafts.current[slotId] = replacement;
      liveBookHtml.current[slotId] = replacement.html;
      if (slotId === selectedId) { setDraft(replacement); setUndoStack([]); setRedoStack([]); }
      setDirtyPages((currentDirty) => currentDirty.filter((id) => id !== slotId));
      setMessage(`${descriptor.label} saved. Preview and PDF now use this exact page.`);
    } finally { setBusy(false); }
  };
  const saveWholeBook = async () => {
    setBusy(true);
    try {
      const replacements = new Map(savedPages.map((page) => [page.slotId, page]));
      const changed = new Set([...dirtyPages, selectedId]);
      orderedPages.forEach((page) => {
        if (!changed.has(page.slotId)) return;
        const existing = replacements.get(page.slotId);
        const revision = { ...revisionFor(page), html: bookEditors.current.get(page.slotId)?.innerHTML ?? revisionFor(page).html, savedAt: new Date().toISOString() };
        replacements.set(page.slotId, makeOverride(page, revision, existing));
      });
      const next = { ...project, designerPages: [...replacements.values()], designerPageOrder: order };
      await onCommit(next);
      setDirtyPages([]);
      setUndoStack([]); setRedoStack([]);
      setMessage(`Whole book saved. Preview and PDF now use all ${orderedPages.length} pages.`);
      return next;
    } finally { setBusy(false); }
  };
  const previewWholeBook = async () => {
    try {
      await saveWholeBook();
      onPreview();
    } catch (error) {
      setMessage(error instanceof Error ? `Could not save before preview: ${error.message}` : "Could not save before preview.");
    }
  };

  const flowBodyFromRenderedPage = (html: string) => {
    const root = document.createElement("div");
    root.innerHTML = html;
    const body = root.querySelector<HTMLElement>(".preview-body");
    if (body) {
      const figures = Array.from(root.children).filter((node) => node.tagName === "FIGURE").map((node) => node.outerHTML).join("");
      return `${body.innerHTML}${figures}`;
    }
    Array.from(root.children).forEach((node) => {
      if (node.tagName === "HEADER" || node.tagName === "FOOTER" || node.matches(".continued-title") || node.tagName === "H1" || node.tagName === "H2") node.remove();
    });
    return root.innerHTML.trim();
  };

  const measureChapterPages = async (chapter: Chapter, flowingHtml: string, style: DesignerPageRevision) => {
    await document.fonts?.ready;
    const normalized = paginateReaderHtml(flowingHtml, project.audience).join("");
    const source = document.createElement("div");
    source.innerHTML = normalized;
    const blocks = Array.from(source.children).map((node) => node.outerHTML);
    if (!blocks.length) return [""];

    const sheet = document.createElement("article");
    sheet.className = "designer-canvas-page designer-measure-page";
    Object.assign(sheet.style, { position: "fixed", left: "-10000px", top: "0", width: "794px", minWidth: "794px", height: "1123px", visibility: "hidden", pointerEvents: "none" });
    const content = document.createElement("div");
    content.className = "designer-editable-content";
    Object.assign(content.style, { boxSizing: "border-box", height: "100%", fontFamily: style.fontFamily, fontSize: `${style.fontSize}px`, color: style.textColor, lineHeight: String(style.lineHeight), letterSpacing: `${style.letterSpacing}px`, columnCount: String(style.columns), columnGap: `${style.columnGap}px`, padding: `${style.pagePadding}px` });
    content.style.setProperty("--designer-paragraph-space", `${style.paragraphSpacing}px`);
    sheet.append(content);
    document.body.append(sheet);

    const fits = (pageBlocks: string[], pageIndex: number) => {
      content.innerHTML = designerChapterPageHtml(project, chapter, pageBlocks.join(""), pageIndex, 99);
      return content.scrollHeight <= content.clientHeight + 1;
    };
    const splitForRemainingSpace = (block: string, current: string[], pageIndex: number) => {
      const holder = document.createElement("div"); holder.innerHTML = block;
      const element = holder.firstElementChild as HTMLElement | null;
      if (!element || !["P", "BLOCKQUOTE", "DIV"].includes(element.tagName)) return null;
      const words = (element.textContent ?? "").trim().split(/\s+/).filter(Boolean);
      if (words.length < 28) return null;
      let low = 12; let high = words.length - 12; let best = 0;
      const tag = element.tagName.toLowerCase();
      const className = element.className ? ` class="${escapeHtml(element.className)}"` : "";
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = `<${tag}${className}>${escapeHtml(words.slice(0, middle).join(" "))}</${tag}>`;
        if (fits([...current, candidate], pageIndex)) { best = middle; low = middle + 1; }
        else high = middle - 1;
      }
      if (best < 12 || best >= words.length - 8) return null;
      return [
        `<${tag}${className}>${escapeHtml(words.slice(0, best).join(" "))}</${tag}>`,
        `<${tag}${className}>${escapeHtml(words.slice(best).join(" "))}</${tag}>`,
      ] as const;
    };

    const pages: string[] = [];
    const pending = [...blocks];
    let current: string[] = [];
    while (pending.length) {
      const block = pending.shift()!;
      const pageIndex = pages.length;
      const isHeading = /^<h[23]\b/i.test(block);
      const headingPair = isHeading && pending[0] ? [...current, block, pending[0]] : null;
      if (current.length && headingPair && !fits(headingPair, pageIndex)) {
        pages.push(current.join("")); current = []; pending.unshift(block); continue;
      }
      if (fits([...current, block], pageIndex)) { current.push(block); continue; }
      const split = splitForRemainingSpace(block, current, pageIndex);
      if (split) {
        current.push(split[0]);
        pages.push(current.join(""));
        current = [];
        pending.unshift(split[1]);
        continue;
      }
      if (current.length) { pages.push(current.join("")); current = []; pending.unshift(block); continue; }
      current.push(block);
    }
    if (current.length) pages.push(current.join(""));
    sheet.remove();
    return pages.length ? pages : [normalized];
  };

  const balanceLayout = async (scope: "chapter" | "book") => {
    const targetChapterIds = scope === "book" ? project.chapters.map((chapter) => chapter.id) : selected.chapterId ? [selected.chapterId] : [];
    if (!targetChapterIds.length) { setMessage("Choose a chapter page before balancing this chapter."); return; }
    setBusy(true);
    try {
      const replacements = new Map(savedPages.map((page) => [page.slotId, page]));
      let nextOrder = [...order];
      let balanced = 0;
      let locked = 0;
      for (const chapterId of targetChapterIds) {
        const chapter = project.chapters.find((item) => item.id === chapterId);
        const chapterPages = orderedPages.filter((page) => page.chapterId === chapterId && page.kind !== "custom" || page.chapterId === chapterId && page.kind === "custom");
        if (!chapter || !chapterPages.length) continue;
        const revisions = chapterPages.map((page) => ({ page, revision: revisionFor(page) })).filter(({ revision }) => !revision.deleted && !revision.intentionalBlank);
        if (revisions.some(({ revision }) => revision.layoutLocked)) { locked += 1; continue; }
        const combined = revisions.map(({ page, revision }) => flowBodyFromRenderedPage(bookEditors.current.get(page.slotId)?.innerHTML ?? revision.html)).join("");
        const figures = combined.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) ?? [];
        const flowingText = combined.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");
        const firstStyle = revisions[0]?.revision ?? defaultDesignerRevision();
        let bodies = await measureChapterPages(chapter, flowingText, firstStyle);
        if (figures.length) {
          const last = bodies.at(-1) ?? "";
          const measuredWithFigure = await measureChapterPages(chapter, `${last}${figures.join("")}`, firstStyle);
          if (measuredWithFigure.length === 1) bodies[bodies.length - 1] = measuredWithFigure[0];
          else bodies.push(figures.join(""));
        }
        const existingIds = chapterPages.map((page) => page.slotId);
        const insertion = Math.max(0, Math.min(...existingIds.map((slotId) => nextOrder.indexOf(slotId)).filter((index) => index >= 0)));
        const nextIds: string[] = [];
        bodies.forEach((body, pageIndex) => {
          const existingDescriptor = chapterPages[pageIndex];
          const slotId = existingDescriptor?.slotId ?? `custom-flow-${chapterId}-${pageIndex + 1}-${Date.now().toString(36)}`;
          const descriptor = existingDescriptor ?? { slotId, label: `Chapter ${chapterId} · page ${pageIndex + 1}`, kind: "custom" as const, chapterId, pageIndex, html: "" };
          const existing = replacements.get(slotId);
          const revision = { ...firstStyle, deleted: false, intentionalBlank: false, layoutLocked: false, html: designerChapterPageHtml(project, chapter, body, pageIndex, bodies.length), savedAt: new Date().toISOString() };
          replacements.set(slotId, makeOverride(descriptor, revision, existing));
          liveBookHtml.current[slotId] = revision.html;
          nextIds.push(slotId);
        });
        chapterPages.slice(bodies.length).forEach((page) => {
          const existing = replacements.get(page.slotId);
          replacements.set(page.slotId, makeOverride(page, { ...revisionFor(page), deleted: true, savedAt: new Date().toISOString() }, existing));
        });
        nextOrder = nextOrder.filter((slotId) => !existingIds.includes(slotId));
        nextOrder.splice(insertion, 0, ...nextIds);
        balanced += 1;
      }
      const next = { ...project, designerPages: [...replacements.values()], designerPageOrder: nextOrder };
      await onCommit(next);
      setDirtyPages([]);
      setMessage(`${balanced} chapter${balanced === 1 ? "" : "s"} balanced locally.${locked ? ` ${locked} locked chapter${locked === 1 ? " was" : "s were"} preserved.` : ""} Empty space was reduced without using AI tokens.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Layout balancing failed: ${error.message}` : "Layout balancing failed.");
    } finally { setBusy(false); }
  };
  const uploadBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const image = await uploadAsset(file);
      setPendingBackground({ ...image, fileName: file.name });
      setMessage("Background uploaded. Choose whether to use it on this page or all pages.");
    } catch (error) {
      setMessage(error instanceof Error ? `Background upload failed: ${error.message}` : "Background upload failed. Try a PNG, JPG, or WebP image.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  const applyUploadedBackground = async (scope: "page" | "book") => {
    if (!selected || !pendingBackground) return;
    setBusy(true);
    try {
      const background = {
        backgroundImageKey: pendingBackground.key,
        backgroundImageUrl: pendingBackground.url,
        backgroundSize: draft.backgroundSize,
        backgroundPosition: draft.backgroundPosition,
        backgroundOpacity: draft.backgroundOpacity,
      } satisfies Partial<DesignerPageRevision>;
      if (scope === "page") {
        await saveRevision({ ...currentSnapshot(), ...background });
        setMessage("Background applied to this page and saved.");
      } else {
        const replacements = new Map(savedPages.map((page) => [page.slotId, page]));
        allPages.forEach((page) => {
          const existing = replacements.get(page.slotId);
          const base = page.slotId === selected.slotId ? currentSnapshot() : hydrateDesignerRevision(existing, page.html);
          replacements.set(page.slotId, makeOverride(page, { ...base, ...background, savedAt: new Date().toISOString() }, existing));
        });
        const next = { ...project, designerPages: [...replacements.values()], designerPageOrder: order };
        await onCommit(next);
        const selectedReplacement = replacements.get(selected.slotId);
        if (selectedReplacement) { liveBookDrafts.current[selected.slotId] = selectedReplacement; setDraft(selectedReplacement); }
        setUndoStack([]); setRedoStack([]);
        setMessage(`Background applied to all ${allPages.length} pages and saved.`);
      }
      setPendingBackground(null);
    } catch (error) {
      setMessage(error instanceof Error ? `Could not apply background: ${error.message}` : "Could not apply the background.");
    } finally {
      setBusy(false);
    }
  };
  const addBlankPage = async () => {
    const slotId = `custom-${Date.now().toString(36)}`; const revision = { ...defaultDesignerRevision(""), intentionalBlank: true };
    const page: DesignerPageOverride = { ...revision, slotId, label: "New blank page", kind: "custom", history: [] };
    await onCommit({ ...project, designerPages: [...savedPages, page], designerPageOrder: [...order, slotId] }); setSelectedId(slotId);
  };
  const duplicatePage = async () => {
    if (!selected) return; const slotId = `custom-${Date.now().toString(36)}`;
    const revision = { ...draft, html: editor.current?.innerHTML ?? draft.html, savedAt: new Date().toISOString() };
    const page: DesignerPageOverride = { ...revision, slotId, label: `${selected.label} copy`, kind: "custom", history: [] };
    const nextOrder = [...order]; nextOrder.splice(order.indexOf(selected.slotId) + 1, 0, slotId);
    await onCommit({ ...project, designerPages: [...savedPages, page], designerPageOrder: nextOrder }); setSelectedId(slotId);
  };
  const movePage = async (direction: -1 | 1) => {
    const index = order.indexOf(selectedId); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const nextOrder = [...order]; [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    await onCommit({ ...project, designerPageOrder: nextOrder });
  };
  const movePageTo = async (targetIndex: number) => {
    const currentIndex = order.indexOf(selectedId);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= order.length || currentIndex === targetIndex) return;
    const nextOrder = [...order];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    await onCommit({ ...project, designerPageOrder: nextOrder });
  };
  const deletePage = async () => {
    if (!selected || busy) return;
    const confirmed = window.confirm(`Delete ${selected.label}? This will remove it from the final book and PDF. It can be restored via "Remove from final book" or by rebalancing.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      if (selected.kind === "custom") {
        const next = { ...project, designerPages: savedPages.filter((page) => page.slotId !== selectedId), designerPageOrder: order.filter((slotId) => slotId !== selectedId) };
        await onCommit(next);
        const fallback = order.find((slotId) => slotId !== selectedId) ?? "cover";
        setSelectedId(fallback);
        setMessage(`${selected.label} deleted.`);
      } else {
        await saveRevision({ ...currentSnapshot(), deleted: true });
        setMessage(`${selected.label} deleted — removed from final book.`);
      }
    } finally { setBusy(false); }
  };
  const restorePrevious = async () => {
    if (!saved?.history.length) return; const [previous, ...history] = saved.history; const replacement = { ...saved, ...hydrateDesignerRevision(previous, previous.html), history };
    await onCommit({ ...project, designerPages: [...savedPages.filter((page) => page.slotId !== selectedId), replacement] }); setDraft(replacement); setMessage("Previous page version restored.");
  };
  const resetPage = async () => {
    await onCommit({ ...project, designerPages: savedPages.filter((page) => page.slotId !== selectedId), designerPageOrder: selected?.kind === "custom" ? order.filter((slotId) => slotId !== selectedId) : order });
    if (selected?.kind === "custom") setSelectedId(order.find((slotId) => slotId !== selectedId) ?? "cover"); else setDraft(defaultDesignerRevision(selected?.html));
  };
  const applyStyle = async (scope: "page" | "chapter" | "book") => {
    if (!selected) return; const style = designerStyleFrom(draft);
    const targets = allPages.filter((page) => scope === "book" || page.slotId === selected.slotId || (scope === "chapter" && selected.chapterId && page.chapterId === selected.chapterId));
    const replacements = new Map(savedPages.map((page) => [page.slotId, page]));
    targets.forEach((page) => { const existing = replacements.get(page.slotId); const base = hydrateDesignerRevision(existing, page.html); replacements.set(page.slotId, makeOverride(page, { ...base, ...style, html: page.slotId === selected.slotId ? (editor.current?.innerHTML ?? base.html) : base.html, savedAt: new Date().toISOString() }, existing)); });
    await onCommit({ ...project, designerPages: [...replacements.values()], designerPageOrder: order }); setMessage(`Design applied to ${scope === "book" ? "the whole book" : scope === "chapter" ? "this chapter" : "this page"}.`);
  };
  const savePreset = async () => {
    const preset: DesignerStylePreset = { id: `preset-${Date.now().toString(36)}`, name: `Custom style ${(project.designerPresets?.length ?? 0) + 1}`, style: designerStyleFrom(draft) };
    await onCommit({ ...project, designerPresets: [...(project.designerPresets ?? []), preset] }); setMessage(`${preset.name} saved for reuse.`);
  };
  const selectCanvasObject = (event: ReactMouseEvent<HTMLDivElement>) => {
    selectedNode.current?.classList.remove("designer-object-selected");
    const target = event.target as HTMLElement; const node = target.closest("img,.designer-free-text") as HTMLElement | null;
    if (node) { selectedNode.current = node; node.classList.add("designer-object-selected"); const kind = node.tagName === "IMG" ? "image" : "text box"; setSelectedObject(kind); setPanel(kind === "image" ? "image" : "text"); }
    else { selectedNode.current = null; setSelectedObject("page"); }
  };
  const mutateObject = (property: string, value: string) => { const node = selectedNode.current; if (!node || node.dataset.designerLocked === "true") return; setUndoStack((stack) => [...stack.slice(-29), currentSnapshot()]); setRedoStack([]); (node.style as unknown as Record<string, string>)[property] = value; if (editor.current) rememberLiveHtml(selectedId, editor.current.innerHTML); setMessage(`${selectedObject} updated.`); };
  const captureSelectedPageHtml = () => { if (editor.current) rememberLiveHtml(selectedId, editor.current.innerHTML); };
  const moveObject = (x: number, y: number) => { const node = selectedNode.current; if (!node || node.dataset.designerLocked === "true") return; node.style.position = "relative"; node.style.left = `${(parseFloat(node.style.left) || 0) + x}px`; node.style.top = `${(parseFloat(node.style.top) || 0) + y}px`; captureSelectedPageHtml(); };
  const duplicateObject = () => { const node = selectedNode.current; if (!node) return; const clone = node.cloneNode(true) as HTMLElement; clone.classList.remove("designer-object-selected"); node.after(clone); captureSelectedPageHtml(); };
  const deleteObject = () => { selectedNode.current?.remove(); selectedNode.current = null; setSelectedObject("page"); captureSelectedPageHtml(); };
  const addTextBox = () => { editor.current?.insertAdjacentHTML("beforeend", '<div class="designer-free-text" style="position:relative;padding:12px;border:1px solid #d7cbb8;min-height:48px">Edit this text box</div>'); captureSelectedPageHtml(); setMessage("Text box added. Select it to move, resize or style it."); };
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addFreeImage = async (file: File) => {
    try {
      setBusy(true);
      const image = await uploadAsset(file);
      const html = `<div class="designer-free-image" data-free-image="true" contenteditable="false" style="position:absolute;left:80px;top:80px;width:280px;height:180px;z-index:3;border:1.5px dashed #b7a98e;background:#fff;overflow:visible;box-shadow:0 4px 12px rgba(0,0,0,0.08);touch-action:none;user-select:none"><div class="free-image-dragbar" style="position:absolute;top:0;left:0;right:0;height:32px;background:#a9322e;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:0.08em;cursor:grab;user-select:none;border-radius:4px 4px 0 0;touch-action:none">⋮⋮ HOLD & DRAG — trackpad friendly</div><img src="${'${image.url}'}" alt="Free image" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;padding-top:32px;box-sizing:border-box" /><div class="free-image-handle" data-handle="se" style="position:absolute;right:-10px;bottom:-10px;width:20px;height:20px;background:#a9322e;border:2px solid #fff;border-radius:50%;cursor:nwse-resize;box-shadow:0 2px 8px rgba(0,0,0,0.3);touch-action:none"></div><div class="free-image-handle" data-handle="e" style="position:absolute;right:-10px;top:50%;transform:translateY(-50%);width:16px;height:48px;background:rgba(255,255,255,0.98);border:1px solid #a9322e;border-radius:8px;cursor:ew-resize;box-shadow:0 2px 6px rgba(0,0,0,0.2);touch-action:none"></div><div class="free-image-handle" data-handle="s" style="position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);width:48px;height:16px;background:rgba(255,255,255,0.98);border:1px solid #a9322e;border-radius:8px;cursor:ns-resize;box-shadow:0 2px 6px rgba(0,0,0,0.2);touch-action:none"></div><div class="free-image-nudge" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:28px 28px 28px;grid-template-rows:28px 28px;gap:4px;opacity:0;pointer-events:none;transition:opacity 0.15s"><button data-nudge="up" style="grid-column:2;grid-row:1;width:28px;height:28px;background:rgba(0,0,0,0.75);color:#fff;border:1px solid #fff;border-radius:50%;font-size:12px;cursor:pointer;pointer-events:auto">↑</button><button data-nudge="left" style="grid-column:1;grid-row:2;width:28px;height:28px;background:rgba(0,0,0,0.75);color:#fff;border:1px solid #fff;border-radius:50%;font-size:12px;cursor:pointer;pointer-events:auto">←</button><button data-nudge="right" style="grid-column:3;grid-row:2;width:28px;height:28px;background:rgba(0,0,0,0.75);color:#fff;border:1px solid #fff;border-radius:50%;font-size:12px;cursor:pointer;pointer-events:auto">→</button><button data-nudge="down" style="grid-column:2;grid-row:2;width:28px;height:28px;background:rgba(0,0,0,0.75);color:#fff;border:1px solid #fff;border-radius:50%;font-size:12px;cursor:pointer;pointer-events:auto">↓</button></div></div>`;
      // Use template literal with actual url - we need to interpolate correctly in JS
      const finalHtml = html.replace('${image.url}', image.url);
      editor.current?.insertAdjacentHTML("beforeend", finalHtml);
      // Make the new image draggable/resizable via pointer — find the actual free image (not the global badge)
      const allFree = editor.current?.querySelectorAll(".designer-free-image");
      const container = (allFree && allFree.length ? allFree[allFree.length - 1] : null) as HTMLElement | null;
      if (container && container.classList.contains("designer-free-image")) {
        let startX=0, startY=0, startW=0, startH=0, startL=0, startT=0, mode:"move"|"se"|"e"|"s"="move";
        const onPointerMove = (e: PointerEvent) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (mode === "move") {
            container.style.left = `${startL + dx}px`;
            container.style.top = `${startT + dy}px`;
          } else if (mode === "se") {
            container.style.width = `${Math.max(40, startW + dx)}px`;
            container.style.height = `${Math.max(40, startH + dy)}px`;
          } else if (mode === "e") {
            container.style.width = `${Math.max(40, startW + dx)}px`;
          } else if (mode === "s") {
            container.style.height = `${Math.max(40, startH + dy)}px`;
          }
        };
        const onPointerUp = (e?: PointerEvent) => {
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
          try { if (e) container.releasePointerCapture?.(e.pointerId); } catch {}
          container.style.cursor = "";
          if (dragBar) dragBar.style.cursor = "grab";
          captureSelectedPageHtml();
          setMessage("Image positioned — drag top bar to move (trackpad friendly), handles to resize, arrows to nudge, then Save page");
        };
        // Trackpad-friendly: larger grab area, pointer capture, smooth
        const dragBar = container.querySelector(".free-image-dragbar") as HTMLElement | null;
        const onPointerDown = (e: PointerEvent) => {
          const target = e.target as HTMLElement;
          const handle = target.closest(".free-image-handle") as HTMLElement | null;
          const isDragBar = target.closest(".free-image-dragbar");
          if (handle) {
            mode = handle.dataset.handle as any || "se";
            e.preventDefault();
            e.stopPropagation();
          } else if (isDragBar || target === container || target.closest(".designer-free-image")) {
            mode = "move";
            // select it
            selectedNode.current?.classList.remove("designer-object-selected");
            selectedNode.current = container;
            container.classList.add("designer-object-selected");
            setSelectedObject("image");
            setPanel("image");
            container.style.cursor = "grabbing";
            if (dragBar) dragBar.style.cursor = "grabbing";
          } else {
            return;
          }
          const rect = container.getBoundingClientRect();
          const parentRect = editor.current!.getBoundingClientRect();
          startX = e.clientX; startY = e.clientY;
          startW = rect.width; startH = rect.height;
          startL = rect.left - parentRect.left;
          startT = rect.top - parentRect.top;
          container.style.left = `${startL}px`;
          container.style.top = `${startT}px`;
          container.setPointerCapture?.(e.pointerId);
          document.addEventListener("pointermove", onPointerMove);
          document.addEventListener("pointerup", onPointerUp);
          e.preventDefault();
        };
        container.addEventListener("pointerdown", onPointerDown as any);
        // Also allow arrow keys to nudge when selected
        container.tabIndex = 0;
        container.addEventListener("keydown", (e: KeyboardEvent) => {
          if (!container.classList.contains("designer-object-selected")) return;
          let dx=0, dy=0;
          if (e.key === "ArrowLeft") dx=-5;
          else if (e.key === "ArrowRight") dx=5;
          else if (e.key === "ArrowUp") dy=-5;
          else if (e.key === "ArrowDown") dy=5;
          else return;
          e.preventDefault();
          const curL = parseFloat(container.style.left) || 0;
          const curT = parseFloat(container.style.top) || 0;
          container.style.left = `${curL + dx}px`;
          container.style.top = `${curT + dy}px`;
          captureSelectedPageHtml();
        });
        // Select it immediately
        selectedNode.current?.classList.remove("designer-object-selected");
        selectedNode.current = container;
        container.classList.add("designer-object-selected");
        setSelectedObject("image");
        setPanel("image");
        // Nudge pad click handlers — single tap, no drag needed, trackpad perfect
        container.querySelectorAll("[data-nudge]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const dir = (btn as HTMLElement).dataset.nudge;
            let dx=0, dy=0;
            if (dir==="left") dx=-10;
            else if (dir==="right") dx=10;
            else if (dir==="up") dy=-10;
            else if (dir==="down") dy=10;
            const curL = parseFloat(container.style.left) || 0;
            const curT = parseFloat(container.style.top) || 0;
            container.style.left = `${curL + dx}px`;
            container.style.top = `${curT + dy}px`;
            captureSelectedPageHtml();
            setMessage(`Nudged ${dir} 10px — tap again or drag bar, then Save page`);
          });
        });
        // Show nudge pad only when selected — ensure parent allows pointer events
        const style = document.createElement("style");
        style.textContent = ".designer-free-image.designer-object-selected .free-image-nudge{opacity:1 !important;pointer-events:auto !important} .designer-free-image .free-image-nudge{pointer-events:none} .designer-free-image.designer-object-selected .free-image-nudge button{pointer-events:auto !important}";
        if (!document.getElementById("free-image-nudge-style")) {
          style.id = "free-image-nudge-style";
          document.head.appendChild(style);
        }
        // Ensure nudge pad is visible immediately for testing
        setTimeout(() => {
          const nudge = container?.querySelector(".free-image-nudge") as HTMLElement | null;
          if (nudge && container?.classList.contains("designer-object-selected")) {
            nudge.style.opacity = "1";
            nudge.style.pointerEvents = "auto";
          }
        }, 100);
      }
      captureSelectedPageHtml();
      setMessage("Image added anywhere — drag to move, handles to resize height/width, then Save page");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed");
    } finally { setBusy(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  };
  const runPreflight = () => {
    const found: string[] = []; const root = editor.current;
    if (draft.deleted) found.push("This page is removed from the final book.");
    if (draft.intentionalBlank) found.push("Intentional blank page — accepted.");
    if (!draft.intentionalBlank && root && root.scrollHeight > root.clientHeight + 2) found.push("Text or objects overflow the printable page.");
    if (draft.fontSize < 11) found.push("Body text is smaller than the recommended print size.");
    root?.querySelectorAll("img").forEach((image) => { if (!image.getAttribute("alt")) found.push("An image is missing accessibility text."); if (image.naturalWidth && image.clientWidth > image.naturalWidth) found.push("An image may be too low-resolution for its displayed size."); });
    root?.querySelectorAll<HTMLElement>("*").forEach((node) => { const box = node.getBoundingClientRect(); const page = root.getBoundingClientRect(); if (box.right > page.right + 2 || box.left < page.left - 2) found.push("An object crosses the print-safe page boundary."); });
    setIssues([...new Set(found)]); setPanel("preflight"); setMessage(found.length ? `${found.length} preflight item${found.length === 1 ? "" : "s"} found.` : "Preflight passed for this page.");
  };
  const runBookPreflight = () => {
    const found: { slotId: string; label: string; issue: string }[] = [];
    orderedPages.forEach((page) => {
      const revision = revisionFor(page);
      if (revision.deleted || revision.intentionalBlank || page.kind !== "chapter") return;
      const html = bookEditors.current.get(page.slotId)?.innerHTML ?? revision.html;
      const fill = designerPageFill(html, project.audience, page.pageIndex === 0);
      if (fill.tone === "empty") found.push({ slotId: page.slotId, label: page.label, issue: `Only ${fill.ratio}% filled — balance this chapter.` });
      if (fill.tone === "overflow") found.push({ slotId: page.slotId, label: page.label, issue: `${fill.ratio}% filled — content may be clipped.` });
      if (/<h[23][^>]*>[^<]*<\/h[23]>\s*$/i.test(designerFlowBody(html))) found.push({ slotId: page.slotId, label: page.label, issue: "Heading is separated from its paragraph." });
    });
    setBookIssues(found); setPanel("preflight");
    setMessage(found.length ? `${found.length} whole-book layout issue${found.length === 1 ? "" : "s"} found.` : "Whole-book preflight passed. No accidental empty or overflowing pages found.");
  };
  const selectAndReveal = (slotId: string) => {
    setSelectedId(slotId);
    requestAnimationFrame(() => document.getElementById(`designer-flow-${slotId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const jumpToChapter = (chapterId: number) => {
    const page = orderedPages.find((item) => item.chapterId === chapterId && !revisionFor(item).deleted);
    if (page) selectAndReveal(page.slotId);
  };
  const pageStyleFor = (revision: DesignerPageRevision) => ({
    fontFamily: revision.fontFamily,
    fontSize: `${revision.fontSize}px`,
    color: revision.textColor,
    lineHeight: revision.lineHeight,
    letterSpacing: `${revision.letterSpacing}px`,
    columnCount: revision.columns,
    columnGap: `${revision.columnGap}px`,
    padding: `${revision.pagePadding}px`,
    "--designer-paragraph-space": `${revision.paragraphSpacing}px`,
  }) as CSSProperties;
  const backgroundStyle = { backgroundImage: draft.backgroundImageUrl ? `url(${draft.backgroundImageUrl})` : undefined, backgroundSize: draft.backgroundSize === "repeat" ? "auto" : draft.backgroundSize, backgroundRepeat: draft.backgroundSize === "repeat" ? "repeat" : "no-repeat", backgroundPosition: draft.backgroundPosition, opacity: draft.backgroundOpacity };
  const contentStyle = { fontFamily: draft.fontFamily, fontSize: `${draft.fontSize}px`, color: draft.textColor, lineHeight: draft.lineHeight, letterSpacing: `${draft.letterSpacing}px`, columnCount: draft.columns, columnGap: `${draft.columnGap}px`, padding: `${draft.pagePadding}px`, "--designer-paragraph-space": `${draft.paragraphSpacing}px` } as CSSProperties;
  const borderStyle = draft.borderStyle === "none" ? undefined : { inset: `${draft.borderInset}px`, border: `${draft.borderWidth}px ${draft.borderStyle} ${draft.borderColor}`, borderRadius: `${draft.borderRadius}px` };
  const bookClasses = designerBookClasses(project);
  if (!selected) return null;
  return <div className="modal-backdrop designer-backdrop"><section className="designer-studio designer-studio-pro" role="dialog" aria-modal="true" aria-label="Designer Studio">
    <header><div><p className="eyebrow">FINAL PRODUCTION</p><h2>Whole-book Designer</h2><span>The pages below are the same pages used by Preview and PDF.</span></div><div><button className="secondary" onClick={() => void previewWholeBook()} disabled={busy}>Preview</button><button className="primary" onClick={() => void saveRevision()} disabled={busy || !dirtyPages.includes(selectedId)}>{busy ? "Saving…" : dirtyPages.includes(selectedId) ? "Save page" : "Page saved"}</button><details className="designer-more-menu"><summary>More</summary><div><button onClick={runBookPreflight}>Check whole book</button><button onClick={() => void balanceLayout("book")} disabled={busy}>Balance layout</button><button onClick={() => void saveWholeBook()} disabled={busy}>Save whole book</button><button onClick={() => void addBlankPage()}>Add blank page</button><button onClick={() => void duplicatePage()}>Duplicate page</button></div></details><button className="designer-close" onClick={onClose} aria-label="Close Designer Studio">×</button></div></header>
    <div className="designer-status"><span>◆</span><b>{message}</b><i>{dirtyPages.length ? `${dirtyPages.length} unsaved page${dirtyPages.length === 1 ? "" : "s"}` : `${orderedPages.filter((page) => !revisionFor(page).deleted).length} pages`} · {selected.label}</i></div>
    <div className="designer-workspace designer-book-workspace"><aside className="designer-pages designer-book-nav"><p className="designer-nav-label">BOOK SECTIONS</p>{orderedPages.filter((page) => page.kind === "cover" || page.kind === "contents").map((page) => <button key={page.slotId} className={page.slotId === selectedId ? "active" : ""} onClick={() => selectAndReveal(page.slotId)}><span>{page.kind === "cover" ? "C" : "T"}</span><div><b>{page.label}</b><small>Book matter</small></div></button>)}{project.chapters.map((chapter) => { const pages = orderedPages.filter((page) => page.chapterId === chapter.id && !revisionFor(page).deleted); const hasIssue = pages.some((page) => ["empty", "overflow"].includes(designerPageFill(liveBookHtml.current[page.slotId] ?? revisionFor(page).html, project.audience, page.pageIndex === 0).tone)); return <button key={chapter.id} className={selected.chapterId === chapter.id ? "active" : ""} onClick={() => jumpToChapter(chapter.id)}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small>{pages.length} page{pages.length === 1 ? "" : "s"}{hasIssue ? " · check spacing" : " · balanced"}</small></div></button>; })}{orderedPages.filter((page) => page.kind === "back").map((page) => <button key={page.slotId} className={page.slotId === selectedId ? "active" : ""} onClick={() => selectAndReveal(page.slotId)}><span>B</span><div><b>{page.label}</b><small>Book matter</small></div></button>)}</aside>
    <main className="designer-stage"><nav className="designer-toolbar designer-book-toolbar"><button onClick={undo} disabled={!undoStack.length} title="Undo selected page">↶</button><button onClick={redo} disabled={!redoStack.length} title="Redo selected page">↷</button><select aria-label="Selected text font" defaultValue="Georgia" onChange={(event) => command("fontName", event.target.value)}><option>Georgia</option><option>Arial</option><option>Verdana</option><option>Trebuchet MS</option><option>Times New Roman</option><option>Noto Serif</option><option>Noto Sans Devanagari</option></select><select aria-label="Selected text size" defaultValue="3" onChange={(event) => command("fontSize", event.target.value)}><option value="1">Small</option><option value="3">Body</option><option value="5">Subheading</option><option value="7">Title</option></select><button onClick={() => command("bold")}><b>B</b></button><button onClick={() => command("italic")}><i>I</i></button><button onClick={() => command("underline")}><u>U</u></button><button onClick={() => command("insertUnorderedList")}>• List</button><button onClick={() => command("justifyLeft")}>Left</button><button onClick={() => command("justifyCenter")}>Centre</button><button onClick={() => command("justifyRight")}>Right</button><label title="Text colour"><input type="color" defaultValue="#243b34" onChange={(event) => command("foreColor", event.target.value)}/></label><label title="Highlight"><input type="color" defaultValue="#f6e6ad" onChange={(event) => command("hiliteColor", event.target.value)}/></label><button onClick={addTextBox}>＋ Text box</button><input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:"none"}} onChange={(e)=>{const f=e.target.files?.[0]; if(f) void addFreeImage(f)}} /><button onClick={()=>imageInputRef.current?.click()} disabled={busy} title="Add image anywhere, drag to move, handles to resize">＋ Image</button><button className="balance-chapter-button" onClick={() => void balanceLayout("chapter")} disabled={!selected.chapterId || busy}>Balance this chapter</button></nav>
      <div className="designer-canvas-wrap designer-whole-book-canvas" aria-label="Editable whole book">{orderedPages.filter((page) => !revisionFor(page).deleted).map((page, index) => { const revision = revisionFor(page); const fill = page.kind === "chapter" ? designerPageFill(liveBookHtml.current[page.slotId] ?? revision.html, project.audience, page.pageIndex === 0) : { ratio: 100, label: "Designed page", tone: "balanced" }; const pageBackground = { backgroundImage: revision.backgroundImageUrl ? `url(${revision.backgroundImageUrl})` : undefined, backgroundSize: revision.backgroundSize === "repeat" ? "auto" : revision.backgroundSize, backgroundRepeat: revision.backgroundSize === "repeat" ? "repeat" : "no-repeat", backgroundPosition: revision.backgroundPosition, opacity: revision.backgroundOpacity }; const pageBorder = revision.borderStyle === "none" ? undefined : { inset: `${revision.borderInset}px`, border: `${revision.borderWidth}px ${revision.borderStyle} ${revision.borderColor}`, borderRadius: `${revision.borderRadius}px` }; const pageClasses = designerPageClasses(project, page); const isDirty = dirtyPages.includes(page.slotId); return <section className={`designer-flow-page${page.slotId === selectedId ? " selected" : ""}`} id={`designer-flow-${page.slotId}`} key={page.slotId}><div className="designer-flow-page-meta"><span>PAGE {index + 1}</span><b>{page.label}</b><button className={`page-fill-badge ${fill.tone}`} onClick={() => { setSelectedId(page.slotId); setPanel("preflight"); }}>{fill.label} · {fill.ratio}%</button><button className={`page-save-button ${isDirty ? "dirty" : "saved"}`} disabled={busy || !isDirty} onClick={() => void savePageById(page.slotId)}>{busy && page.slotId === selectedId ? "Saving…" : isDirty ? "Save page" : "Saved"}</button></div><article className={`designer-canvas-page book-sheet ${bookClasses} ${pageClasses}${revision.backgroundImageUrl ? " has-background" : ""}${revision.intentionalBlank ? " blank" : ""}`} style={{ backgroundColor: revision.backgroundColor }} onMouseDown={() => setSelectedId(page.slotId)}><div className="designer-background-layer" style={pageBackground}/><div className="designer-border-layer" style={pageBorder}/><div className={`designer-watermark-layer${revision.watermarkRepeat ? " repeat" : ""}`} style={{ opacity: revision.watermarkOpacity, left: `${revision.watermarkX}%`, top: `${revision.watermarkY}%`, transform: `translate(-50%,-50%) rotate(${revision.watermarkRotation}deg)`, display: revision.watermarkVisible ? "grid" : "none" }}>{Array.from({ length: revision.watermarkRepeat ? 6 : 1 }, (_, watermarkIndex) => <span key={watermarkIndex}>{revision.watermarkImageUrl && <img src={revision.watermarkImageUrl} alt="Custom watermark"/>}{revision.watermarkText}</span>)}</div>{!revision.intentionalBlank && revision.contentVisible && <div ref={(node) => { if (node) { bookEditors.current.set(page.slotId, node); if (page.slotId === selectedId) editor.current = node; } else bookEditors.current.delete(page.slotId); }} className="designer-editable-content" style={pageStyleFor(revision)} contentEditable suppressContentEditableWarning onFocus={() => setSelectedId(page.slotId)} onInput={(event) => rememberLiveHtml(page.slotId, event.currentTarget.innerHTML)} onClick={selectCanvasObject} dangerouslySetInnerHTML={{ __html: liveBookHtml.current[page.slotId] ?? revision.html }}/>}<div style={{position:"absolute",bottom:"10px",left:"50%",transform:"translateX(-50%)",fontSize:"12px",letterSpacing:"0.04em",color:"#1a2e1a",background:"#ffffff",padding:"6px 14px",borderRadius:"999px",border:"1px solid #b4532a",boxShadow:"0 2px 10px rgba(0,0,0,0.12)",fontWeight:"800",zIndex:4,pointerEvents:"none"}}>Book page {index+1} of {order.length}</div></article>{revision.intentionalBlank && <div className="intentional-blank-label">INTENTIONAL BLANK PAGE</div>}</section>; })}{pendingBackground && <div className="designer-background-choice" role="dialog" aria-modal="true" aria-labelledby="background-choice-title"><img src={pendingBackground.url} alt="Uploaded background preview"/><div><p className="eyebrow">BACKGROUND READY</p><h3 id="background-choice-title">Where should this background be used?</h3><span>{pendingBackground.fileName}</span><div className="designer-background-choice-actions"><button onClick={() => void applyUploadedBackground("page")} disabled={busy}>This page only</button><button className="primary" onClick={() => void applyUploadedBackground("book")} disabled={busy}>All pages</button></div><button className="designer-choice-cancel" onClick={() => { setPendingBackground(null); setMessage("Background choice cancelled. The current design was not changed."); }} disabled={busy}>Cancel</button></div></div>}</div>
    </main>
    <aside className="designer-controls designer-inspector"><nav>{(["page","text","image","layers","preflight"] as const).map((name) => <button key={name} className={panel === name ? "active" : ""} onClick={() => setPanel(name)}>{name}</button>)}</nav>
      {panel === "page" && <><section><h3>Page structure</h3><label className="designer-check"><input type="checkbox" checked={draft.intentionalBlank} onChange={(event) => changeDraft({ intentionalBlank: event.target.checked })}/> Intentional blank</label><label className="designer-check"><input type="checkbox" checked={draft.layoutLocked} onChange={(event) => changeDraft({ layoutLocked: event.target.checked })}/> Lock this page during reflow</label><label className="designer-check"><input type="checkbox" checked={draft.deleted} onChange={(event) => changeDraft({ deleted: event.target.checked })}/> Remove from final book</label><div className="designer-row"><button onClick={() => void movePage(-1)}>Move up</button><button onClick={() => void movePage(1)}>Move down</button></div><div className="designer-row" style={{marginTop:"8px"}}><label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"9px",fontWeight:"800"}}>Move to #<input key={selectedId} id="move-page-input" type="number" min="1" max={order.length} defaultValue={order.indexOf(selectedId)+1} style={{width:"60px",border:"1px solid #d6ccbd",padding:"6px",textAlign:"center"}} /></label><button onClick={() => { const el=document.getElementById("move-page-input") as HTMLInputElement | null; const v=Number(el?.value); if(v>=1 && v<=order.length) void movePageTo(v-1); }} disabled={busy} style={{padding:"7px 10px",fontSize:"9px",fontWeight:"800"}}>Go</button></div><div style={{fontSize:"8px",color:"var(--muted)",marginTop:"4px"}}>Page {order.indexOf(selectedId)+1} of {order.length} — built-in number system</div><button onClick={() => void deletePage()} disabled={busy} style={{marginTop:"8px",background:"#a9322e",color:"white",borderColor:"#a9322e",width:"100%",padding:"9px",fontWeight:"800"}}>Delete page</button>{selected.chapterId && <button className="primary" onClick={() => void balanceLayout("chapter")} disabled={busy || draft.layoutLocked}>Balance this chapter</button>}</section><section><h3>Page layout</h3><label>Margins <span>{draft.pagePadding}px</span><input type="range" min="28" max="100" value={draft.pagePadding} onChange={(event) => changeDraft({ pagePadding: Number(event.target.value) })}/></label><label>Columns<select value={draft.columns} onChange={(event) => changeDraft({ columns: Number(event.target.value) })}><option value="1">One</option><option value="2">Two</option></select></label><label>Column gap <span>{draft.columnGap}px</span><input type="range" min="12" max="60" value={draft.columnGap} onChange={(event) => changeDraft({ columnGap: Number(event.target.value) })}/></label></section><section><h3>Page border</h3><label>Style<select value={draft.borderStyle} onChange={(event) => changeDraft({ borderStyle: event.target.value as DesignerPageRevision["borderStyle"] })}><option value="none">None</option><option value="solid">Single</option><option value="double">Double</option><option value="dashed">Decorative dashed</option></select></label><div className="designer-row"><label>Colour<input type="color" value={draft.borderColor} onChange={(event) => changeDraft({ borderColor: event.target.value })}/></label><label>Width<input type="number" min="1" max="12" value={draft.borderWidth} onChange={(event) => changeDraft({ borderWidth: Number(event.target.value) })}/></label></div><label>Inset <span>{draft.borderInset}px</span><input type="range" min="0" max="50" value={draft.borderInset} onChange={(event) => changeDraft({ borderInset: Number(event.target.value) })}/></label><label>Corner radius <span>{draft.borderRadius}px</span><input type="range" min="0" max="60" value={draft.borderRadius} onChange={(event) => changeDraft({ borderRadius: Number(event.target.value) })}/></label></section><section><h3>Background</h3><label>Colour<input type="color" value={draft.backgroundColor} onChange={(event) => changeDraft({ backgroundColor: event.target.value })}/></label><label className="designer-upload">{busy ? "Uploading background…" : "Upload background"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void uploadBackground(event)}/></label><p className="designer-help">After upload, choose whether to use the background on this page only or throughout the whole book.</p><label>Fit<select value={draft.backgroundSize} onChange={(event) => changeDraft({ backgroundSize: event.target.value as DesignerPageRevision["backgroundSize"] })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Original size</option><option value="repeat">Tile</option></select></label><label>Opacity <span>{Math.round(draft.backgroundOpacity * 100)}%</span><input type="range" min="0" max="1" step=".05" value={draft.backgroundOpacity} onChange={(event) => changeDraft({ backgroundOpacity: Number(event.target.value) })}/></label>{draft.backgroundImageUrl && <button onClick={() => changeDraft({ backgroundImageKey: undefined, backgroundImageUrl: undefined })}>Remove background</button>}</section></>}
      {panel === "text" && <><section><h3>Typography</h3><label>Page font<select value={draft.fontFamily} onChange={(event) => changeDraft({ fontFamily: event.target.value })}><option value="Georgia, serif">Editorial Serif</option><option value="Arial, sans-serif">Clear Sans</option><option value="'Trebuchet MS', sans-serif">Friendly Reader</option><option value="'Noto Serif', serif">Sanskrit Scholar</option><option value="'Noto Sans Devanagari', sans-serif">Devanagari Sans</option></select></label><div className="designer-row"><label>Size<input type="number" min="9" max="34" value={draft.fontSize} onChange={(event) => changeDraft({ fontSize: Number(event.target.value) })}/></label><label>Colour<input type="color" value={draft.textColor} onChange={(event) => changeDraft({ textColor: event.target.value })}/></label></div><label>Line height <span>{draft.lineHeight.toFixed(2)}</span><input type="range" min="1" max="2.2" step=".05" value={draft.lineHeight} onChange={(event) => changeDraft({ lineHeight: Number(event.target.value) })}/></label><label>Letter spacing <span>{draft.letterSpacing}px</span><input type="range" min="-1" max="5" step=".1" value={draft.letterSpacing} onChange={(event) => changeDraft({ letterSpacing: Number(event.target.value) })}/></label><label>Paragraph spacing <span>{draft.paragraphSpacing}px</span><input type="range" min="0" max="35" value={draft.paragraphSpacing} onChange={(event) => changeDraft({ paragraphSpacing: Number(event.target.value) })}/></label></section><section><h3>Selected text box</h3><p className="designer-help">Select a custom text box on the page, then move, resize, layer or lock it.</p><div className="object-nudge"><button onClick={() => moveObject(0,-5)}>↑</button><button onClick={() => moveObject(-5,0)}>←</button><button onClick={() => moveObject(5,0)}>→</button><button onClick={() => moveObject(0,5)}>↓</button></div><label>Width<input type="range" min="120" max="520" defaultValue="360" onChange={(event) => mutateObject("width", `${event.target.value}px`)}/></label><label>Padding<input type="range" min="0" max="40" defaultValue="12" onChange={(event) => mutateObject("padding", `${event.target.value}px`)}/></label><div className="designer-row"><button onClick={() => mutateObject("zIndex", "4")}>Bring front</button><button onClick={() => mutateObject("zIndex", "0")}>Send back</button></div><div className="designer-row"><button onClick={duplicateObject}>Duplicate</button><button onClick={deleteObject}>Delete</button></div><button onClick={() => { if (!selectedNode.current) return; selectedNode.current.dataset.designerLocked = selectedNode.current.dataset.designerLocked === "true" ? "false" : "true"; }}>Lock / unlock object</button></section></>}
      {panel === "image" && <section><h3>Selected image</h3><p className="designer-help">Click an image on the page to edit it. Changes are stored inside the page edition.</p><label>Width<input type="range" min="80" max="520" defaultValue="420" onChange={(event) => mutateObject("width", `${event.target.value}px`)}/></label><label>Height<input type="range" min="80" max="520" defaultValue="300" onChange={(event) => mutateObject("height", `${event.target.value}px`)}/></label><label>Crop / fit<select defaultValue="contain" onChange={(event) => mutateObject("objectFit", event.target.value)}><option value="contain">Fit</option><option value="cover">Fill and crop</option><option value="fill">Stretch</option></select></label><label>Focal position<select defaultValue="center" onChange={(event) => mutateObject("objectPosition", event.target.value)}><option value="center">Centre</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label><label>Opacity<input type="range" min="0.1" max="1" step=".05" defaultValue="1" onChange={(event) => mutateObject("opacity", event.target.value)}/></label><label>Rounded corners<input type="range" min="0" max="80" defaultValue="0" onChange={(event) => mutateObject("borderRadius", `${event.target.value}px`)}/></label><label>Border width<input type="range" min="0" max="16" defaultValue="0" onChange={(event) => mutateObject("borderWidth", `${event.target.value}px`)}/></label><label>Border colour<input type="color" defaultValue="#173f37" onChange={(event) => { mutateObject("borderColor", event.target.value); mutateObject("borderStyle", "solid"); }}/></label><label>Rotation<input type="range" min="-30" max="30" defaultValue="0" onChange={(event) => mutateObject("transform", `rotate(${event.target.value}deg)`)}/></label><label>Shadow<select defaultValue="none" onChange={(event) => mutateObject("boxShadow", event.target.value)}><option value="none">None</option><option value="0 6px 16px #0003">Soft</option><option value="0 12px 28px #0005">Strong</option></select></label><div className="designer-row"><button onClick={() => mutateObject("float", "left")}>Wrap right</button><button onClick={() => mutateObject("float", "right")}>Wrap left</button></div><div className="designer-row"><button onClick={() => mutateObject("transform", "scaleX(-1)")}>Flip horizontal</button><button onClick={() => mutateObject("transform", "scaleY(-1)")}>Flip vertical</button></div><div className="object-nudge"><button onClick={() => moveObject(0,-5)}>↑</button><button onClick={() => moveObject(-5,0)}>←</button><button onClick={() => moveObject(5,0)}>→</button><button onClick={() => moveObject(0,5)}>↓</button></div><label className="designer-upload">Replace image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file || selectedNode.current?.tagName !== "IMG") return; const image = await uploadAsset(file); (selectedNode.current as HTMLImageElement).src = image.url; }}/></label><label>Alternative text<input placeholder="Describe this image" onChange={(event) => { if (selectedNode.current?.tagName === "IMG") selectedNode.current.setAttribute("alt", event.target.value); }}/></label><label>Caption<input placeholder="Image caption" onChange={(event) => { const figure = selectedNode.current?.closest("figure"); const caption = figure?.querySelector("figcaption"); if (caption) caption.textContent = event.target.value; }}/></label><div className="designer-row"><button onClick={duplicateObject}>Duplicate</button><button onClick={deleteObject}>Remove</button></div><button onClick={() => { if (!selectedNode.current) return; selectedNode.current.dataset.designerLocked = selectedNode.current.dataset.designerLocked === "true" ? "false" : "true"; }}>Lock / unlock image</button></section>}
      {panel === "layers" && <><section><h3>Layers</h3><label className="designer-check"><input type="checkbox" checked={draft.contentVisible} onChange={(event) => changeDraft({ contentVisible: event.target.checked })}/> Content and objects</label><label className="designer-check"><input type="checkbox" checked={draft.watermarkVisible} onChange={(event) => changeDraft({ watermarkVisible: event.target.checked })}/> Watermark</label><label className="designer-check"><input type="checkbox" checked={Boolean(draft.backgroundImageUrl)} onChange={(event) => !event.target.checked && changeDraft({ backgroundImageUrl: undefined, backgroundImageKey: undefined })}/> Background image</label></section><section><h3>Watermark</h3><label>Text<input value={draft.watermarkText} onChange={(event) => changeDraft({ watermarkText: event.target.value })}/></label><label className="designer-upload">Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const image = await uploadAsset(file); changeDraft({ watermarkImageKey: image.key, watermarkImageUrl: image.url }); }}/></label><label>Opacity<input type="range" min="0" max=".7" step=".01" value={draft.watermarkOpacity} onChange={(event) => changeDraft({ watermarkOpacity: Number(event.target.value) })}/></label><label>Rotation<input type="range" min="-90" max="90" value={draft.watermarkRotation} onChange={(event) => changeDraft({ watermarkRotation: Number(event.target.value) })}/></label><label>Horizontal position<input type="range" min="10" max="90" value={draft.watermarkX} onChange={(event) => changeDraft({ watermarkX: Number(event.target.value) })}/></label><label>Vertical position<input type="range" min="10" max="90" value={draft.watermarkY} onChange={(event) => changeDraft({ watermarkY: Number(event.target.value) })}/></label><label className="designer-check"><input type="checkbox" checked={draft.watermarkRepeat} onChange={(event) => changeDraft({ watermarkRepeat: event.target.checked })}/> Repeat watermark</label></section><section><h3>Page versions</h3><button onClick={() => void restorePrevious()} disabled={!saved?.history.length}>Restore previous</button><button onClick={() => void resetPage()}>Restore Studio page</button></section></>}
      {panel === "preflight" && <><section><h3>Whole-book preflight</h3>{bookIssues.length ? <ul className="preflight-issues book-preflight-issues">{bookIssues.map((item) => <li key={`${item.slotId}-${item.issue}`}><b>{item.label}</b><span>{item.issue}</span><button onClick={() => selectAndReveal(item.slotId)}>Go to page</button></li>)}</ul> : <div className="preflight-pass">✓ No accidental empty or overflowing pages detected</div>}<button onClick={runBookPreflight}>Check whole book</button><button onClick={() => void balanceLayout("book")} disabled={busy}>Balance whole book</button></section><section><h3>Selected page check</h3>{issues.length ? <ul className="preflight-issues">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p className="designer-help">Use this check for image resolution and print boundaries on the selected page.</p>}<button onClick={runPreflight}>Check selected page</button></section><section><h3>Apply design</h3><p className="designer-help">Copies visual settings only. Text and images stay unique.</p><button onClick={() => void applyStyle("page")}>Apply to this page</button>{selected.chapterId && <button onClick={() => void applyStyle("chapter")}>Apply to this chapter</button>}<button onClick={() => void applyStyle("book")}>Apply to whole book</button></section><section><h3>Reusable styles</h3><div className="style-presets"><button onClick={() => changeDraft({ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.55, backgroundColor: "#fffdf8", borderStyle: "double", borderColor: "#b4863e" })}>Scholar</button><button onClick={() => changeDraft({ fontFamily: "'Trebuchet MS', sans-serif", fontSize: 16, lineHeight: 1.65, backgroundColor: "#fff8e8", borderStyle: "solid", borderColor: "#d17b43", borderRadius: 18 })}>Storybook</button><button onClick={() => changeDraft({ fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5, backgroundColor: "#ffffff", borderStyle: "none" })}>Minimal</button></div>{(project.designerPresets ?? []).map((preset) => <button key={preset.id} onClick={() => changeDraft(preset.style)}>{preset.name}</button>)}<button onClick={() => void savePreset()}>Save current style</button></section></>}
    </aside></div>
  </section></div>;
}

function LegacyDesignerStudio({ project, onClose, onPreview, onCommit }: { project: Project; onClose: () => void; onPreview: () => void; onCommit: (next: Project) => Promise<void> }) {
  const basePages = useMemo(() => designerBasePages(project), [project]);
  const customPages = (project.designerPages ?? []).filter((page) => page.kind === "custom");
  const allPages = [...basePages, ...customPages.map((page) => ({ slotId: page.slotId, label: page.label, kind: "custom" as const, html: page.html }))];
  const order = [...(project.designerPageOrder ?? []).filter((slotId) => allPages.some((page) => page.slotId === slotId)), ...allPages.map((page) => page.slotId).filter((slotId) => !(project.designerPageOrder ?? []).includes(slotId))];
  const orderedPages = order.map((slotId) => allPages.find((page) => page.slotId === slotId)!).filter(Boolean);
  const [selectedId, setSelectedId] = useState(order[0] ?? "cover");
  const selected = orderedPages.find((page) => page.slotId === selectedId) ?? orderedPages[0];
  const saved = (project.designerPages ?? []).find((page) => page.slotId === selected?.slotId);
  const [draft, setDraft] = useState<DesignerPageRevision>(() => saved ?? defaultDesignerRevision(selected?.html));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("All changes are local. No AI tokens are used.");
  const editor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextSaved = (project.designerPages ?? []).find((page) => page.slotId === selected?.slotId);
    setDraft(nextSaved ?? defaultDesignerRevision(selected?.html));
  }, [selectedId]);

  const uploadAsset = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", project.id);
    const response = await fetch("/api/image", { method: "POST", headers: ownerHeaders(), body: form });
    const data = await response.json() as { image?: { key: string; url: string }; error?: string };
    if (!response.ok || !data.image) throw new Error(data.error || "Image upload failed");
    return data.image;
  };
  const saveRevision = async (revision = draft, overrideProject = project) => {
    if (!selected) return;
    setBusy(true);
    try {
      const current = (overrideProject.designerPages ?? []).find((page) => page.slotId === selected.slotId);
      const html = revision.intentionalBlank ? revision.html : (editor.current?.innerHTML ?? revision.html);
      const snapshot: DesignerPageRevision = (() => { const base = (current ?? defaultDesignerRevision(selected.html)) as unknown as Record<string, unknown>; const { history: _h, ...rest } = base as { history?: unknown } & typeof base; return { ...rest, savedAt: new Date().toISOString() } as unknown as DesignerPageRevision; })();
      const replacement: DesignerPageOverride = { ...revision, html, savedAt: new Date().toISOString(), slotId: selected.slotId, label: selected.label, kind: selected.kind, chapterId: "chapterId" in selected ? selected.chapterId : undefined, pageIndex: "pageIndex" in selected ? selected.pageIndex : undefined, history: current ? [snapshot, ...current.history].slice(0, 20) : [] };
      const next = { ...overrideProject, designerPages: [...(overrideProject.designerPages ?? []).filter((page) => page.slotId !== selected.slotId), replacement], designerPageOrder: order };
      await onCommit(next);
      setDraft(replacement);
      setMessage("Page saved. Preview and PDF now use this edition.");
    } finally { setBusy(false); }
  };
  const addBlankPage = async () => {
    const slotId = `custom-${Date.now().toString(36)}`;
    const revision = { ...defaultDesignerRevision(""), intentionalBlank: true };
    const page: DesignerPageOverride = { ...revision, slotId, label: "New blank page", kind: "custom", history: [] };
    const next = { ...project, designerPages: [...(project.designerPages ?? []), page], designerPageOrder: [...order, slotId] };
    await onCommit(next);
    setSelectedId(slotId);
    setMessage("Blank page added to the book.");
  };
  const duplicatePage = async () => {
    if (!selected) return;
    const slotId = `custom-${Date.now().toString(36)}`;
    const revision = { ...draft, html: editor.current?.innerHTML ?? draft.html, savedAt: new Date().toISOString() };
    const page: DesignerPageOverride = { ...revision, slotId, label: `${selected.label} copy`, kind: "custom", history: [] };
    const position = Math.max(0, order.indexOf(selected.slotId) + 1);
    const nextOrder = [...order]; nextOrder.splice(position, 0, slotId);
    await onCommit({ ...project, designerPages: [...(project.designerPages ?? []), page], designerPageOrder: nextOrder });
    setSelectedId(slotId);
  };
  const movePage = async (direction: -1 | 1) => {
    const index = order.indexOf(selectedId); const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const nextOrder = [...order]; [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    await onCommit({ ...project, designerPageOrder: nextOrder });
  };
  const restorePrevious = async () => {
    if (!saved?.history.length) return;
    const [previous, ...history] = saved.history;
    const replacement = { ...saved, ...previous, history };
    await onCommit({ ...project, designerPages: [...(project.designerPages ?? []).filter((page) => page.slotId !== selectedId), replacement] });
    setDraft(replacement);
    setMessage("Previous page version restored.");
  };
  const resetPage = async () => {
    await onCommit({ ...project, designerPages: (project.designerPages ?? []).filter((page) => page.slotId !== selectedId), designerPageOrder: selected?.kind === "custom" ? order.filter((slotId) => slotId !== selectedId) : order });
    if (selected?.kind === "custom") setSelectedId(order.find((slotId) => slotId !== selectedId) ?? "cover");
    else setDraft(defaultDesignerRevision(selected?.html));
    setMessage("Studio version restored.");
  };
  const command = (name: string, value?: string) => { editor.current?.focus(); document.execCommand(name, false, value); };
  if (!selected) return null;
  return <div className="modal-backdrop designer-backdrop"><section className="designer-studio" role="dialog" aria-modal="true" aria-label="Designer Studio"><header><div><p className="eyebrow">FINAL PRODUCTION</p><h2>Designer Studio</h2><span>Edit the final book without changing generated chapters or Nemotron history.</span></div><div><button className="secondary" onClick={onPreview}>Preview book</button><button className="primary" onClick={() => void saveRevision()} disabled={busy}>{busy ? "Saving…" : "Save page"}</button><button className="designer-close" onClick={onClose} aria-label="Close Designer Studio">×</button></div></header><div className="designer-status"><span>◆</span><b>{message}</b></div><div className="designer-workspace"><aside className="designer-pages"><div className="designer-page-actions"><button onClick={() => void addBlankPage()}>＋ Blank</button><button onClick={() => void duplicatePage()}>Duplicate</button></div>{orderedPages.map((page, index) => { const state = (project.designerPages ?? []).find((item) => item.slotId === page.slotId); return <button key={page.slotId} className={page.slotId === selectedId ? "active" : ""} onClick={() => setSelectedId(page.slotId)}><span>{index + 1}</span><div><b>{page.label}</b><small>{state?.deleted ? "Removed from book" : state?.intentionalBlank ? "Intentional blank" : state ? "Designer edited" : "Studio page"}</small></div></button>; })}</aside><main className="designer-stage"><nav className="designer-toolbar"><button onClick={() => command("bold")}><b>B</b></button><button onClick={() => command("italic")}><i>I</i></button><button onClick={() => command("formatBlock", "h2")}>Heading</button><button onClick={() => command("insertUnorderedList")}>List</button><button onClick={() => command("justifyLeft")}>Left</button><button onClick={() => command("justifyCenter")}>Centre</button><button onClick={() => command("justifyRight")}>Right</button></nav><div className="designer-canvas-wrap"><article className={`designer-canvas-page${draft.intentionalBlank ? " blank" : ""}${draft.deleted ? " deleted" : ""}`} style={{ backgroundColor: draft.backgroundColor, backgroundImage: draft.backgroundImageUrl ? `url(${draft.backgroundImageUrl})` : undefined }}><div className="designer-background-layer"/><div className="designer-watermark-layer" style={{ opacity: draft.watermarkOpacity, transform: `translate(-50%,-50%) rotate(${draft.watermarkRotation}deg)`, display: draft.watermarkVisible ? "grid" : "none" }}>{draft.watermarkImageUrl && <img src={draft.watermarkImageUrl} alt="Custom watermark"/>}<span>{draft.watermarkText}</span></div>{!draft.intentionalBlank && draft.contentVisible && <div ref={editor} className="designer-editable-content" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: draft.html }}/>} {draft.deleted && <div className="designer-deleted-overlay">REMOVED FROM BOOK</div>}</article></div></main><aside className="designer-controls"><section><h3>Page</h3><label className="designer-check"><input type="checkbox" checked={draft.intentionalBlank} onChange={(event) => setDraft({ ...draft, intentionalBlank: event.target.checked })}/> Leave intentionally blank</label><label className="designer-check"><input type="checkbox" checked={draft.deleted} onChange={(event) => setDraft({ ...draft, deleted: event.target.checked })}/> Remove from final book</label><div className="designer-row"><button onClick={() => void movePage(-1)}>Move up</button><button onClick={() => void movePage(1)}>Move down</button></div></section><section><h3>Background</h3><label>Page colour<input type="color" value={draft.backgroundColor} onChange={(event) => setDraft({ ...draft, backgroundColor: event.target.value })}/></label><label className="designer-upload">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const image = await uploadAsset(file); setDraft({ ...draft, backgroundImageKey: image.key, backgroundImageUrl: image.url }); }}/></label>{draft.backgroundImageUrl && <button onClick={() => setDraft({ ...draft, backgroundImageKey: undefined, backgroundImageUrl: undefined })}>Remove background</button>}</section><section><h3>Custom watermark</h3><label>Text<input value={draft.watermarkText} onChange={(event) => setDraft({ ...draft, watermarkText: event.target.value })} placeholder="Publisher or draft mark"/></label><label className="designer-upload">Upload watermark<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const image = await uploadAsset(file); setDraft({ ...draft, watermarkImageKey: image.key, watermarkImageUrl: image.url }); }}/></label><label>Opacity <span>{Math.round(draft.watermarkOpacity * 100)}%</span><input type="range" min="0" max="0.7" step="0.01" value={draft.watermarkOpacity} onChange={(event) => setDraft({ ...draft, watermarkOpacity: Number(event.target.value) })}/></label><label>Rotation <span>{draft.watermarkRotation}°</span><input type="range" min="-90" max="90" value={draft.watermarkRotation} onChange={(event) => setDraft({ ...draft, watermarkRotation: Number(event.target.value) })}/></label></section><section><h3>Layers</h3><label className="designer-check"><input type="checkbox" checked={draft.contentVisible} onChange={(event) => setDraft({ ...draft, contentVisible: event.target.checked })}/> Content</label><label className="designer-check"><input type="checkbox" checked={draft.watermarkVisible} onChange={(event) => setDraft({ ...draft, watermarkVisible: event.target.checked })}/> Watermark</label></section><section><h3>Versions</h3><button onClick={() => void restorePrevious()} disabled={!saved?.history.length}>Restore previous</button><button onClick={() => void resetPage()}>Restore studio page</button></section></aside></div></section></div>;
}

function CanvaPreview({ project, exportBusy, pdfProgress, onClose, onDownload, onSaveCanvaPage, onSetCanvaActive }: {
  project: Project;
  exportBusy: boolean;
  pdfProgress: number;
  onClose: () => void;
  onDownload: () => void;
  onSaveCanvaPage: (file: File, slot: Omit<CanvaPageOverride, "active" | "current" | "history">) => Promise<void>;
  onSetCanvaActive: (slotId: string, active: boolean) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"book" | "chapter" | "page">("book");
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(.68);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState(project.chapters[0]?.id ?? 1);
  const [canvaTarget, setCanvaTarget] = useState<Omit<CanvaPageOverride, "active" | "current" | "history"> | null>(null);
  const [canvaFile, setCanvaFile] = useState<File | null>(null);
  const [canvaFilePreview, setCanvaFilePreview] = useState("");
  const [studioPagePreview, setStudioPagePreview] = useState("");
  const [canvaBusy, setCanvaBusy] = useState(false);
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  const unresolved = project.chapters.filter((chapter) => !isPublishApproved(chapter));
  const worldClass = `${bookPersonaClass(project.bookPersona)} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")}`;
  const pageClass = `page-aesthetic-${normalizedTitle(project.pageAesthetic).replace(/[^a-z]+/g, "-")}`;
  const borderClass = `book-border-${normalizedTitle(project.bookBorder).replace(/[^a-z]+/g, "-")}`;
  const typographyClass = `typography-${normalizedTitle(project.fontTheme).replace(/[^a-z]+/g, "-")}`;
  const watermarkSlug = normalizedTitle(project.pageWatermark).replace(/[^a-z]+/g, "-");
  const ageClass = `age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const chapterSheets = printable.chapters.flatMap((chapter) => {
    if (chapter.importValidated && chapter.importedPages?.length) return chapter.importedPages.map((page, index) => ({ kind: "chapter" as const, chapter, body: page.body, pageIndex: index, pageCount: chapter.importedPages!.length, imageUrl: page.imageUrl, imageCaption: page.imageCaption, imageAlt: page.imageAlt }));
    const pages = paginateReaderHtml(chapter.body, project.audience);
    const age = childAgeBand(project.audience);
    const shareLimit = age === "7-9" ? 1500 : age === "13-15" ? 1750 : 1625;
    const shareIllustration = Boolean(chapter.imageUrl) && readerTextLength(pages[pages.length - 1] ?? "") <= shareLimit;
    const pageCount = pages.length + (chapter.imageUrl && !shareIllustration ? 1 : 0);
    const text = pages.map((body, index) => ({ kind: "chapter" as const, chapter, body, pageIndex: index, pageCount, imageUrl: shareIllustration && index === pages.length - 1 ? chapter.imageUrl : undefined, imageCaption: shareIllustration && index === pages.length - 1 ? chapter.imageCaption : undefined, imageAlt: shareIllustration && index === pages.length - 1 ? chapter.imageAlt : undefined }));
    return chapter.imageUrl && !shareIllustration ? [...text, { kind: "chapter" as const, chapter, body: "", pageIndex: pages.length, pageCount, imageUrl: chapter.imageUrl, imageCaption: chapter.imageCaption, imageAlt: chapter.imageAlt }] : text;
  });
  const baseSheets: ({ kind: "cover" | "contents" | "back" } | (typeof chapterSheets)[number])[] = [{ kind: "cover" }, { kind: "contents" }, ...chapterSheets, { kind: "back" }];
  type BaseSheet = (typeof baseSheets)[number];
  type Sheet = BaseSheet | { kind: "custom"; designerPage: DesignerPageOverride };
  const baseSlotId = (sheet: BaseSheet) => sheet.kind === "cover" || sheet.kind === "contents" || sheet.kind === "back" ? sheet.kind : `chapter-${sheet.chapter.id}-page-${sheet.pageIndex + 1}`;
  const customSheets: Sheet[] = (project.designerPages ?? []).filter((page) => page.kind === "custom" && !page.deleted).map((designerPage) => ({ kind: "custom", designerPage }));
  const availableSheets: Sheet[] = [...baseSheets.filter((sheet) => !(project.designerPages ?? []).find((page) => page.slotId === baseSlotId(sheet))?.deleted), ...customSheets];
  const desiredOrder = project.designerPageOrder ?? [];
  const sheets = [...availableSheets].sort((left, right) => {
    const leftId = left.kind === "custom" ? left.designerPage.slotId : baseSlotId(left);
    const rightId = right.kind === "custom" ? right.designerPage.slotId : baseSlotId(right);
    const leftIndex = desiredOrder.indexOf(leftId); const rightIndex = desiredOrder.indexOf(rightId);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  const slotFor = (sheet: Sheet): Omit<CanvaPageOverride, "active" | "current" | "history"> => {
    if (sheet.kind === "custom") return { slotId: sheet.designerPage.slotId, label: sheet.designerPage.label, kind: "chapter", chapterId: sheet.designerPage.chapterId, pageIndex: sheet.designerPage.pageIndex };
    if (sheet.kind === "cover") return { slotId: "cover", label: "Front cover", kind: "cover" };
    if (sheet.kind === "contents") return { slotId: "contents", label: "Contents page", kind: "contents" };
    if (sheet.kind === "back") return { slotId: "back", label: "Back cover", kind: "back" };
    return { slotId: `chapter-${sheet.chapter.id}-page-${sheet.pageIndex + 1}`, label: `Chapter ${sheet.chapter.id} · page ${sheet.pageIndex + 1}`, kind: "chapter", chapterId: sheet.chapter.id, pageIndex: sheet.pageIndex };
  };
  const overrideFor = (sheet: Sheet) => (project.canvaPages ?? []).find((page) => page.slotId === slotFor(sheet).slotId);
  const designerFor = (sheet: Sheet) => sheet.kind === "custom" ? sheet.designerPage : (project.designerPages ?? []).find((page) => page.slotId === slotFor(sheet).slotId);
  const renderDesignerSheet = (rawPage: DesignerPageOverride, key: string) => {
    const currentBase = designerBasePages(project).find((candidate) => candidate.slotId === rawPage.slotId);
    const page = hydrateDesignerOverride(currentBase && isLegacyDesignerScaffold(rawPage) ? { ...rawPage, html: currentBase.html } : rawPage);
    const surfaceClasses = `${designerBookClasses(project)} ${designerPageClasses(project, page)}${page.backgroundImageUrl ? " has-background" : ""}`;
    const backgroundStyle: CSSProperties = { backgroundImage: page.backgroundImageUrl ? `url(${page.backgroundImageUrl})` : undefined, backgroundSize: page.backgroundSize === "repeat" ? "auto" : page.backgroundSize, backgroundRepeat: page.backgroundSize === "repeat" ? "repeat" : "no-repeat", backgroundPosition: page.backgroundPosition, opacity: page.backgroundOpacity };
    const contentStyle = { fontFamily: page.fontFamily, fontSize: `${page.fontSize}px`, color: page.textColor, lineHeight: page.lineHeight, letterSpacing: `${page.letterSpacing}px`, columnCount: page.columns, columnGap: `${page.columnGap}px`, padding: `${page.pagePadding}px`, "--designer-paragraph-space": `${page.paragraphSpacing}px` } as CSSProperties;
    const borderStyle: CSSProperties | undefined = page.borderStyle === "none" ? undefined : { inset: `${page.borderInset}px`, border: `${page.borderWidth}px ${page.borderStyle} ${page.borderColor}`, borderRadius: `${page.borderRadius}px` };
    return <article data-page-slot={page.slotId} className={`book-sheet designer-rendered-sheet ${surfaceClasses}`} key={key} style={{ backgroundColor: page.backgroundColor }}><div className={`designer-render-canvas ${surfaceClasses}`} style={{ backgroundColor: page.backgroundColor }}><div className="designer-background-layer" style={backgroundStyle}/><div className="designer-border-layer" style={borderStyle}/><div className={`designer-render-watermark${page.watermarkRepeat ? " repeat" : ""}`} style={{ opacity: page.watermarkOpacity, left: `${page.watermarkX}%`, top: `${page.watermarkY}%`, transform: `translate(-50%,-50%) rotate(${page.watermarkRotation}deg)`, display: page.watermarkVisible ? "grid" : "none" }}>{Array.from({ length: page.watermarkRepeat ? 6 : 1 }, (_, index) => <span key={index}>{page.watermarkImageUrl && <img src={page.watermarkImageUrl} alt=""/>}{page.watermarkText}</span>)}</div>{!page.intentionalBlank && page.contentVisible && <div className="designer-render-content" style={contentStyle} dangerouslySetInnerHTML={{ __html: page.html }}/>}</div></article>;
  };
  const renderStudioSheet = (sheet: Sheet, key: string) => {
    const slot = slotFor(sheet);
    const base = `book-sheet ${worldClass} ${pageClass} ${borderClass} ${typographyClass}`;
    if (sheet.kind === "custom") return renderDesignerSheet(sheet.designerPage, key);
    if (sheet.kind === "cover") return <article data-page-slot={slot.slotId} className={`${base} preview-cover`} key={key}><div className="cover-edition">IKS BOOK STUDIO · {project.audience.toUpperCase()}</div><h1>{project.title}</h1><span>An illustrated book shaped from your source</span><b>✦</b>{unresolved.length > 0 && <small className="draft-status">Working preview · {unresolved.length} chapter{unresolved.length === 1 ? "" : "s"} still in progress</small>}</article>;
    if (sheet.kind === "contents") return <article data-page-slot={slot.slotId} className={`${base} preview-page contents-page`} key={key}><span>CONTENTS</span><h2>Inside this book</h2><ol>{printable.chapters.map((chapter, index) => <li key={chapter.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{chapter.title}</span><i>{isPublishApproved(chapter) ? `${chapter.pages} pages` : "In progress"}</i></li>)}</ol></article>;
    if (sheet.kind === "back") return <article data-page-slot={slot.slotId} className={`${base} preview-page backmatter`} key={key}><span>A FINAL THOUGHT</span><h2>Keep wondering</h2><p>The most powerful ideas do not end on the last page. They grow when we ask careful questions, notice new connections and share what we discover.</p><p>Carry one idea from this book into the world—and see where it leads.</p></article>;
    const image = Boolean(sheet.imageUrl) && !sheet.body;
    const combined = Boolean(sheet.imageUrl) && Boolean(sheet.body);
    const waitingForContent = chapterWordCount(sheet.chapter) < 45 && !sheet.chapter.importValidated;
    return <article data-page-slot={slot.slotId} className={`${base} preview-page chapter-preview ${ageClass}${image ? " chapter-visual-sheet" : ""}${combined ? " chapter-text-visual-sheet" : ""}`} key={key}><header className="print-chapter-header"><span>CHAPTER {sheet.chapter.id}</span><span>PAGE {sheet.pageIndex + 1} OF {sheet.pageCount}</span></header>{sheet.pageIndex === 0 && <h2>{sheet.chapter.title}</h2>}{sheet.pageIndex > 0 && !image && <p className="continued-title">{sheet.chapter.title} · continued</p>}{sheet.body && <div className="preview-body" dangerouslySetInnerHTML={{ __html: sheet.body }}/>} {waitingForContent && sheet.pageIndex === 0 && <div className="unfinished-page-note"><b>Chapter in progress</b><span>Generated content will appear here automatically. You can still preview and download the complete book layout now.</span></div>}{sheet.imageUrl && <figure className="chapter-image"><img src={sheet.imageUrl} alt={sheet.imageAlt || sheet.imageCaption || sheet.chapter.title}/><figcaption>{sheet.imageCaption || sheet.chapter.title}</figcaption></figure>}<footer className="sheet-number"><span>{project.title}</span><span>{sheet.pageIndex + 1}</span></footer></article>;
  };
  const renderSheet = (sheet: Sheet, key: string) => {
    const slot = slotFor(sheet);
    const override = overrideFor(sheet);
    if (override?.active) return <article data-page-slot={slot.slotId} className="book-sheet canva-custom-sheet" key={key}><img src={override.current.imageUrl} alt={`${slot.label} designed in Canva`}/></article>;
    const designer = designerFor(sheet);
    if (designer) return renderDesignerSheet(designer, key);
    return renderStudioSheet(sheet, key);
  };
  const capturePage = async (slotId: string) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-page-slot="${slotId}"]`));
    const element = candidates.find((candidate) => !candidate.closest(".pdf-render-stack"));
    if (!element) throw new Error("Page is not visible yet");
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(element, { backgroundColor: "#fffdf8", scale: 2, useCORS: true, logging: false, imageTimeout: 15000 });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not capture page")), "image/png"));
  };
  const openCanvaWorkflow = async (sheet: Sheet) => {
    const slot = slotFor(sheet);
    setCanvaTarget(slot);
    setCanvaFile(null);
    setCanvaFilePreview("");
    setStudioPagePreview("");
    try {
      const blob = await capturePage(slot.slotId);
      setStudioPagePreview(URL.createObjectURL(blob));
    } catch { /* The download button can retry after the modal opens. */ }
  };
  const downloadCanvaTemplate = async () => {
    if (!canvaTarget) return;
    setCanvaBusy(true);
    try {
      const blob = await capturePage(canvaTarget.slotId);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book"}-${canvaTarget.slotId}-for-canva.png`;
      anchor.click();
      URL.revokeObjectURL(href);
    } finally { setCanvaBusy(false); }
  };
  const chooseCanvaFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (canvaFilePreview) URL.revokeObjectURL(canvaFilePreview);
    setCanvaFile(file);
    setCanvaFilePreview(URL.createObjectURL(file));
  };
  const acceptCanvaPage = async () => {
    if (!canvaTarget || !canvaFile) return;
    setCanvaBusy(true);
    try { await onSaveCanvaPage(canvaFile, canvaTarget); setCanvaTarget(null); }
    finally { setCanvaBusy(false); }
  };
  const current = sheets[Math.min(pageIndex, Math.max(0, sheets.length - 1))];
  const currentChapter = current?.kind === "chapter" ? current.chapter.id : current?.kind === "contents" ? -1 : 0;
  const selectedChapterSheets = chapterSheets.filter((sheet) => sheet.chapter.id === selectedChapterId);
  const selectedChapter = project.chapters.find((chapter) => chapter.id === selectedChapterId) ?? project.chapters[0];
  const selectedChapterPosition = Math.max(0, project.chapters.findIndex((chapter) => chapter.id === selectedChapterId));
  const goToChapter = (chapterId: number) => { setSelectedChapterId(chapterId); const index = sheets.findIndex((sheet) => sheet.kind === "chapter" && sheet.chapter.id === chapterId); if (index >= 0) setPageIndex(index); };
  const moveChapter = (direction: -1 | 1) => { const next = project.chapters[selectedChapterPosition + direction]; if (next) goToChapter(next.id); };
  const scaledSheet = (sheet: Sheet, key: string) => {
    const slot = slotFor(sheet);
    const override = overrideFor(sheet);
    return <div className="continuous-sheet-frame canva-editable-frame" style={{ width: 794 * zoom, height: 1123 * zoom }} key={key}><div style={{ transform: `scale(${zoom})` }}>{renderSheet(sheet, key)}</div><div className="canva-sheet-actions">{sheet.kind !== "custom" && <button onClick={() => void openCanvaWorkflow(sheet)}>Edit in Canva</button>}{override && <button onClick={() => void onSetCanvaActive(slot.slotId, !override.active)}>{override.active ? "Use studio" : "Use Canva"}</button>}</div>{override?.active && <span className="canva-version-badge">CANVA VERSION</span>}</div>;
  };
  return <div className="modal-backdrop book-preview-backdrop"><section className="preview-modal preview-v2" data-page-watermark={watermarkSlug}><header className="preview-main-header"><div><p className="eyebrow">BOOK PREVIEW</p><h2>{project.title}</h2><span>{sheets.length} pages · {project.chapters.length} chapters · {(project.canvaPages ?? []).filter((page) => page.active).length} Canva pages</span></div><div className="preview-header-actions"><button className="download-book-button" onClick={onDownload} disabled={exportBusy}>{exportBusy ? `Creating PDF · ${pdfProgress}%` : "Download PDF"}</button><button className="preview-close" onClick={onClose} aria-label="Close preview">×</button></div></header><div className={`preview-availability ${unresolved.length ? "working" : "complete"}`}><span className="preview-status-dot"/><div><b>{unresolved.length ? "Preview and PDF are available now" : "Book ready to publish"}</b><small>{unresolved.length ? `${unresolved.length} chapter${unresolved.length === 1 ? " is" : "s are"} still being improved. Canva design and export remain available.` : "Every chapter is included in the downloadable book."}</small></div></div><div className="preview-mode-bar"><div className="preview-mode-switch" aria-label="Preview layout"><button className={viewMode === "book" ? "active" : ""} onClick={() => setViewMode("book")}><b>Whole book</b><span>Scroll every page</span></button><button className={viewMode === "chapter" ? "active" : ""} onClick={() => setViewMode("chapter")}><b>Chapter</b><span>All chapter pages</span></button><button className={viewMode === "page" ? "active" : ""} onClick={() => setViewMode("page")}><b>Single page</b><span>Focused reading</span></button></div></div><div className="preview-toolbar">{viewMode === "page" ? <div className="page-navigation"><button onClick={() => setPageIndex(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>←</button><span><b>{pageIndex + 1}</b> / {sheets.length}</span><button onClick={() => setPageIndex(Math.min(sheets.length - 1, pageIndex + 1))} disabled={pageIndex === sheets.length - 1}>→</button></div> : viewMode === "chapter" ? <div className="page-navigation chapter-navigation"><button onClick={() => moveChapter(-1)} disabled={selectedChapterPosition === 0}>←</button><span><b>{selectedChapterPosition + 1}</b> / {project.chapters.length}</span><button onClick={() => moveChapter(1)} disabled={selectedChapterPosition === project.chapters.length - 1}>→</button></div> : <div className="preview-scope-summary"><b>{sheets.length}</b><span>pages shown below</span></div>}{viewMode === "page" ? <select aria-label="Jump to chapter" value={currentChapter} onChange={(event) => { const destination = Number(event.target.value); destination > 0 ? goToChapter(destination) : setPageIndex(destination === -1 ? 1 : 0); }}><option value={0}>Cover</option><option value={-1}>Contents</option>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.id} · {chapter.title}</option>)}</select> : viewMode === "chapter" ? <select value={selectedChapterId} onChange={(event) => goToChapter(Number(event.target.value))}>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.id} · {chapter.title}</option>)}</select> : <div className="whole-book-label">Cover → Contents → Every chapter → Back cover</div>}<div className="zoom-controls"><button onClick={() => setZoom(Math.max(.45, zoom - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(Math.min(1.1, zoom + .1))}>＋</button><button onClick={() => setZoom(.68)}>Fit page</button><button onClick={() => setZoom(.92)}>Fit width</button>{viewMode === "page" && <button onClick={() => setShowThumbnails(!showThumbnails)}>{showThumbnails ? "Hide pages" : "Show pages"}</button>}</div></div>{viewMode === "book" ? <div className="continuous-book-stage whole-book-preview">{sheets.map((sheet, index) => scaledSheet(sheet, `whole-book-${index}`))}</div> : viewMode === "chapter" ? <div className="continuous-book-stage chapter-book-preview"><div className="chapter-preview-heading"><div><span>CHAPTER {selectedChapterId}</span><h3>{selectedChapter?.title}</h3></div><b>{selectedChapterSheets.length} pages</b></div>{selectedChapterSheets.map((sheet, index) => scaledSheet(sheet, `chapter-${selectedChapterId}-${index}`))}</div> : <div className="page-viewer-shell">{showThumbnails && <aside className="page-thumbnails">{sheets.map((sheet, index) => <button className={index === pageIndex ? "active" : ""} onClick={() => setPageIndex(index)} key={index}><span>{index + 1}</span><b>{sheet.kind === "chapter" ? `Chapter ${sheet.chapter.id}` : sheet.kind}</b></button>)}</aside>}<div className="single-page-stage">{scaledSheet(current, `visible-${pageIndex}`)}</div></div>}<div className="pdf-render-stack" aria-hidden="true">{sheets.map((sheet, index) => renderSheet(sheet, `export-${index}`))}</div></section>{canvaTarget && <div className="canva-workflow-backdrop" role="dialog" aria-modal="true"><section className="canva-workflow-modal"><header><div><p className="eyebrow">MANUAL CANVA WORKFLOW</p><h2>{canvaTarget.label}</h2><span>Your chapter content and request history will not be changed.</span></div><button onClick={() => setCanvaTarget(null)}>×</button></header><ol className="canva-steps"><li><b>1</b><div><strong>Download the studio page</strong><span>Use this correctly sized PNG as your Canva design reference.</span><button onClick={() => void downloadCanvaTemplate()} disabled={canvaBusy}>{canvaBusy ? "Preparing…" : "Download page PNG"}</button></div></li><li><b>2</b><div><strong>Edit it in Canva</strong><span>Upload the PNG to Canva, finish the design, then export at the same proportions as PNG.</span><button onClick={() => window.open("https://www.canva.com/", "_blank", "noopener,noreferrer")}>Open Canva ↗</button></div></li><li><b>3</b><div><strong>Bring the finished page back</strong><span>PNG is recommended. JPG and WebP are also accepted.</span><label className="canva-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseCanvaFile}/><span>{canvaFile ? canvaFile.name : "Choose finished page"}</span></label></div></li></ol><div className="canva-compare"><figure><span>STUDIO VERSION</span>{studioPagePreview ? <img src={studioPagePreview} alt="Studio page preview"/> : <div>Download the page to create its comparison preview.</div>}</figure><figure><span>CANVA RETURN</span>{canvaFilePreview ? <img src={canvaFilePreview} alt="Returned Canva page preview"/> : <div>Your uploaded Canva page will appear here.</div>}</figure></div><footer><button className="secondary" onClick={() => setCanvaTarget(null)}>Keep studio version</button>{(project.canvaPages ?? []).some((page) => page.slotId === canvaTarget.slotId && page.active) && <button className="secondary" onClick={() => void onSetCanvaActive(canvaTarget.slotId, false)}>Restore studio version</button>}<button className="primary" onClick={() => void acceptCanvaPage()} disabled={!canvaFile || canvaBusy}>{canvaBusy ? "Saving…" : "Use Canva version"}</button></footer></section></div>}</div>;
}

function LegacyPreview({ project, draftBusy, onFill, onRefresh, onClose, onPrint }: { project: Project; draftBusy: boolean; onFill: () => void; onRefresh: () => void; onClose: () => void; onPrint: () => void }) {
  useEffect(() => {
    document.documentElement.dataset.bookTypography = normalizedTitle(typographyTheme(project.fontTheme).value).replace(/[^a-z]+/g, "-");
    document.documentElement.dataset.bookBorder = normalizedTitle(bookBorder(project.bookBorder).value).replace(/[^a-z]+/g, "-");
    document.documentElement.dataset.pageWatermark = normalizedTitle(pageWatermark(project.pageWatermark).value).replace(/[^a-z]+/g, "-");
    return () => {
      delete document.documentElement.dataset.bookTypography;
      delete document.documentElement.dataset.bookBorder;
      delete document.documentElement.dataset.pageWatermark;
    };
  }, [project.fontTheme, project.bookBorder, project.pageWatermark]);
  const thinChapters = project.chapters.filter((chapter) => chapterWordCount(chapter) < 350 && !chapter.importValidated && chapterGenerationState(chapter) !== "Designer handoff");
  const selectedProfile = generationProfileKey(project.audience, project.language);
  const staleChapters = project.chapters.filter((chapter) => !chapter.importValidated && chapterGenerationState(chapter) !== "Designer handoff" && chapterWordCount(chapter) >= 350 && chapter.generationProfile !== selectedProfile);
  const unreviewedChapters = project.chapters.filter((chapter) => !chapter.importValidated && chapter.pedagogyQuality?.status !== "passed" && chapterGenerationState(chapter) !== "Designer handoff");
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  const worldClass = `${bookPersonaClass(project.bookPersona)} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")}`;
  const pageClass = `page-aesthetic-${normalizedTitle(project.pageAesthetic).replace(/[^a-z]+/g, "-")}`;
  const borderClass = `book-border-${normalizedTitle(project.bookBorder).replace(/[^a-z]+/g, "-")}`;
  const ageClass = `age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const chapterSheets = printable.chapters.flatMap((chapter) => {
    if (chapter.importValidated && chapter.importedPages?.length) return chapter.importedPages.map((page, pageIndex) => ({
      chapter,
      body: page.body,
      pageIndex,
      pageCount: chapter.importedPages!.length,
      image: Boolean(page.imageUrl),
      imageUrl: page.imageUrl,
      imageCaption: page.imageCaption,
      imageAlt: page.imageAlt,
      exact: true,
    }));
    const textPages = paginateReaderHtml(chapter.body, project.audience);
    const textSheets = textPages.map((body, pageIndex) => ({ chapter, body, pageIndex, pageCount: textPages.length, image: false, imageUrl: undefined, imageCaption: undefined, imageAlt: undefined, exact: false }));
    return chapter.imageUrl ? [...textSheets, { chapter, body: "", pageIndex: textPages.length, pageCount: textPages.length + 1, image: true, imageUrl: chapter.imageUrl, imageCaption: chapter.imageCaption, imageAlt: chapter.imageAlt, exact: false }] : textSheets;
  });
  return <div className="modal-backdrop"><section className="preview-modal"><header><div><p className="eyebrow">FINAL CHILDREN’S BOOK · PAGE-BY-PAGE PREVIEW</p><h2>{project.title}</h2></div><div>{staleChapters.length > 0 ? <button className="fill-chapters" disabled={draftBusy} onClick={onRefresh}>{draftBusy ? "Reviewing chapters…" : `Build reviewed lessons for ${project.audience}`}</button> : thinChapters.length > 0 && <button className="fill-chapters" disabled={draftBusy} onClick={onFill}>{draftBusy ? "Building lessons…" : `Build ${thinChapters.length} short lesson${thinChapters.length === 1 ? "" : "s"}`}</button>}<button onClick={onPrint} disabled={unreviewedChapters.length > 0} title={unreviewedChapters.length ? "Every chapter must pass the teaching-quality review before export" : "Print or save the reviewed book"}>Print / Save PDF</button><button onClick={onClose}>×</button></div></header>{unreviewedChapters.length > 0 && <div className="preview-warning quality-block"><b>{unreviewedChapters.length} chapter{unreviewedChapters.length === 1 ? " has" : "s have"} not passed the teaching-quality gate.</b><span>Export is paused until every lesson passes context, coherence, age fit, teaching quality, and source fidelity. Unlock and rebuild any older locked chapter.</span></div>}{(staleChapters.length > 0 || thinChapters.length > 0 || printable.duplicatesRemoved > 0) && <div className="preview-warning"><b>{staleChapters.length > 0 ? `${staleChapters.length} chapter${staleChapters.length === 1 ? " needs" : "s need"} the new teaching workflow.` : thinChapters.length > 0 ? `${thinChapters.length} chapter${thinChapters.length === 1 ? " is" : "s are"} still too short.` : "Repeated content repaired."}</b><span>{staleChapters.length > 0 ? `Build meaningful, reviewed lessons for ${project.audience.toLowerCase()}; locked chapters will stay unchanged.` : printable.duplicatesRemoved > 0 ? `${printable.duplicatesRemoved} repeated paragraph${printable.duplicatesRemoved === 1 ? " was" : "s were"} omitted from this preview and PDF.` : "Finish and review the short lessons before exporting."}</span></div>}<div className="preview-scroll"><article className={`book-sheet preview-cover ${worldClass} ${pageClass} ${borderClass}`}><p>AN ILLUSTRATED BOOK FOR {project.audience.toUpperCase()}</p><h1>{project.title}</h1><span>Written to invite curiosity, imagination and thoughtful questions</span><b>✦</b></article><article className={`book-sheet preview-page contents-page ${worldClass} ${pageClass} ${borderClass}`}><span>CONTENTS</span><h2>Inside this book</h2><ol>{printable.chapters.map((chapter, index) => <li key={chapter.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{chapter.title}</span><i>{chapter.pages} pages</i></li>)}</ol></article>{chapterSheets.map(({ chapter, body, pageIndex, pageCount, image, imageUrl, imageCaption, imageAlt, exact }) => <article className={`book-sheet preview-page chapter-preview ${worldClass} ${pageClass} ${borderClass} ${ageClass}${image ? " chapter-visual-sheet" : ""}${exact ? " exact-import-page" : ""}`} key={`${chapter.id}-${pageIndex}-${image ? "visual" : "text"}`}><header className="print-chapter-header"><span>CHAPTER {chapter.id}</span><span>PAGE {pageIndex + 1} OF {pageCount}</span></header>{pageIndex === 0 && <h2>{chapter.title}</h2>}{pageIndex > 0 && !image && <p className="continued-title">{chapter.title} · continued</p>}{body && <div className="preview-body" dangerouslySetInnerHTML={{ __html: body }}/>} {image && imageUrl && <figure className="chapter-image"><img src={imageUrl} alt={imageAlt || imageCaption || chapter.title}/><figcaption>{imageCaption || chapter.title}</figcaption></figure>}<footer className="sheet-number">{project.title}</footer></article>)}<article className={`book-sheet preview-page backmatter ${worldClass} ${pageClass} ${borderClass}`}><span>A FINAL THOUGHT</span><h2>Keep wondering</h2><p>The most powerful ideas do not end on the last page. They grow when we ask careful questions, notice new connections and share what we discover.</p><p>Carry one idea from this book into the world—and see where it leads.</p></article></div></section></div>;
}

function Versions({ versions, onCreate, onRestore, onClose }: { versions: { label: string; date: string; snapshot: Project }[]; onCreate: () => void; onRestore: (project: Project) => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="versions-modal"><header><div><p className="eyebrow">VERSION HISTORY</p><h2>Editorial checkpoints</h2></div><button onClick={onClose}>×</button></header><button className="primary full" onClick={onCreate}>＋ Create checkpoint</button>{versions.length === 0 ? <p className="empty">No checkpoints yet. Create one before a major edit.</p> : versions.map((version) => <div className="version" key={version.date}><span>↺</span><div><b>{version.label}</b><small>{version.date}</small></div><button onClick={() => onRestore(version.snapshot)}>Restore</button></div>)}</section></div>;
}
