"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { strToU8, unzipSync, zipSync } from "fflate";
import { AUTHORIAL_READER_INSTRUCTION, authorialReaderHtml, childAgeBand, generationProfileKey } from "../lib/child-summary";
import { ADAPTATION_PLAN_VERSION, allocatePagesWithinBudget, CHAPTER_PAGE_BUDGET, FIXED_MATTER_PAGES, recommendedAdaptationPages, TOTAL_BOOK_PAGE_LIMIT } from "../lib/adaptation-pages";
import type { ChapterOneGate, PedagogyQuality } from "../lib/pedagogy";
import { BOOK_PACKAGE_FORMAT, expectedChapterId, expectedContextKey, expectedPageId, type BookPackage, type BookPackageValidation, validateBookPackage } from "../lib/book-package";

type View = "dashboard" | "wizard" | "analysis" | "brief" | "editor";

type SourceSection = { title: string; page: number; excerpt: string };

type ChapterGenerationStatus = "Waiting" | "Generating" | "Completed" | "Needs review" | "Paused by quota";

type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  requests: number;
  updatedAt?: string;
};

type DraftApiResponse = {
  chapters?: Chapter[];
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
const TEMPORARY_RETRY_DELAY_MS = 1800;

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
};

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
  audience: string;
  readingLevel: string;
  language: string;
  bookType: string;
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

function chooseVisualType(title: string, body: string, index: number) {
  const context = normalizedTitle(`${title} ${body.replace(/<[^>]+>/g, " ")}`).slice(0, 7000);
  if (/\b(?:map|geograph\w*|territor\w*|region\w*|route\w*|trade|border\w*|foreign|countr\w*|kingdom\w*|empire\w*|statecraft|rajya|rājya|coast\w*|ocean\w*|current\w*)\b/.test(context)) return "map";
  if (/\b(?:compar\w*|contrast\w*|relationship\w*|balance\w*|intersection\w*|overlap\w*|dual\w*|between|constituent\w*|element\w*)\b/.test(context)) return "venn";
  if (/\b(?:structure\w*|hierarch\w*|system\w*|govern\w*|administr\w*|branch\w*|classification\w*|organisation\w*|organization\w*|design\w*|network\w*|webs?)\b/.test(context)) return "tree";
  if (/\b(?:origin\w*|histor\w*|develop\w*|evolution\w*|period\w*|ancient|introduction\w*|chronolog\w*|journey\w*)\b/.test(context)) return "timeline";
  if (/\b(?:cycle\w*|process\w*|strateg\w*|econom\w*|agricultur\w*|production\w*|stage\w*|sequence\w*|method\w*)\b/.test(context)) return "cycle";
  return ["concept", "tree", "venn", "timeline"][Math.abs(index) % 4];
}

const visualTypeOrder = ["concept", "map", "venn", "tree", "timeline", "cycle"];

function visualIdentity(imageKey?: string, imageUrl?: string) {
  if (imageKey) return `asset:${imageKey}`;
  if (imageUrl) return `url:${imageUrl}`;
  return "";
}

function contextualIllustration(
  project: Pick<Project, "aesthetic" | "illustrationStyle" | "sourceTerms">,
  chapter: Pick<Chapter, "title" | "body">,
  index: number,
  usedImages: Set<string>,
) {
  const curated = curatedIllustration(chapter.title, chapter.body);
  if (curated && !usedImages.has(visualIdentity(undefined, curated.url))) return { ...curated, type: "illustration" };
  const terms = visualKeywords(chapter.title, chapter.body, project.sourceTerms);
  const preferredType = chooseVisualType(chapter.title, chapter.body, index);
  const preferredIndex = Math.max(0, visualTypeOrder.indexOf(preferredType));

  for (let offset = 0; offset < visualTypeOrder.length; offset += 1) {
    const type = visualTypeOrder[(preferredIndex + offset) % visualTypeOrder.length];
    const params = new URLSearchParams({
      title: chapter.title.slice(0, 180),
      terms: terms.join("|"),
      type,
      style: project.illustrationStyle.slice(0, 80),
      aesthetic: project.aesthetic.slice(0, 80),
      chapter: String(index + 1),
      variant: String(index + 1),
    });
    const url = `/api/visual?${params.toString()}`;
    if (usedImages.has(visualIdentity(undefined, url))) continue;
    const readableType = type === "venn" ? "relationship diagram" : type === "tree" ? "concept tree" : `${type} visual`;
    return {
      url,
      caption: `${chapter.title}: a ${readableType} built from ${terms.slice(0, 3).join(", ") || "the chapter’s central ideas"}.`,
      alt: `${readableType} for ${chapter.title}, showing ${terms.slice(0, 4).join(", ") || "the main chapter concepts"}.`,
      type,
    };
  }

  // The chapter index and title make this final URL unique even when a very
  // long book exhausts every diagram family above.
  const params = new URLSearchParams({ title: chapter.title, terms: terms.join("|"), type: "concept", chapter: String(index + 1), variant: `chapter-${index + 1}` });
  return { url: `/api/visual?${params.toString()}`, caption: `${chapter.title}: a concept visual built from the chapter’s central ideas.`, alt: `Unique concept visual for ${chapter.title}.`, type: "concept" };
}

function attachChapterVisuals(project: Pick<Project, "aesthetic" | "illustrationStyle" | "sourceTerms">, chapters: Chapter[]) {
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
  chapters: [
    { id: 1, title: "Opening chapter", pages: 10, status: "planned", generationStatus: "Waiting", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>Opening chapter</h1><p class="chapter-deck">Your generated chapter will appear here after the book brief is approved.</p>` },
  ],
  editorialPreferences: [],
  briefApproved: false,
  adaptationPlanConfirmed: false,
  adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
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
] as const;

const pageWatermarks = [
  { value: "Lotus Seal", label: "Lotus Seal", description: "A soft lotus medallion centred behind the page.", detail: "Calm and cultural without distracting from reading" },
  { value: "Knowledge Tree", label: "Knowledge Tree", description: "A faint branching tree rising gently from the lower page.", detail: "Ideal for learning, ideas and connected concepts" },
  { value: "Sun Mandala", label: "Sun Mandala", description: "A quiet circular geometry placed behind the page content.", detail: "Balanced and refined for every age group" },
] as const;

const typographyThemes = [
  { value: "Storybook Serif", label: "Storybook Serif", description: "Warm, literary letterforms with expressive chapter titles.", detail: "Classic and inviting for stories and cultural subjects", sample: "Once an idea begins, it can travel through generations." },
  { value: "Friendly Rounded", label: "Friendly Rounded", description: "Soft, open letters that feel lively and approachable.", detail: "Comfortable for younger and visual-first readers", sample: "Let’s discover how every part of this idea connects!" },
  { value: "Clear Reader", label: "Clear Reader", description: "A clean, highly readable type system with calm spacing.", detail: "Excellent for longer chapters and confident readers", sample: "The central idea becomes clearer when we examine each connection." },
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
  if (/tree|branch|knowledge/i.test(value)) return pageWatermarks[1];
  if (/sun|mandala|circle|geometry/i.test(value)) return pageWatermarks[2];
  return pageWatermarks[0];
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
      locked: Boolean(existing?.locked),
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
      locked: Boolean(labelChapter.locked || titleChapter.locked),
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
  const reader = childAudienceProfile(cleanSaved.audience ?? "");
  const writing = naturalWritingProfile(reader.value);
  const design = childDesignWorld(cleanSaved.aesthetic ?? "");
  const pages = pageAesthetic(cleanSaved.pageAesthetic ?? "");
  const border = bookBorder(cleanSaved.bookBorder ?? "");
  const watermark = pageWatermark(cleanSaved.pageWatermark ?? "");
  const typography = typographyTheme(cleanSaved.fontTheme ?? "");
  const childFirstSaved: Project = {
    ...emptyProject,
    ...cleanSaved,
    adaptationPlanVersion: cleanSaved.adaptationPlanVersion ?? 1,
    audience: reader.value,
    readingLevel: reader.readingLevel,
    bookType: "Illustrated children’s adaptation",
    adaptation: "Faithful children’s adaptation",
    citationStyle: "Source notes for grown-ups",
    learningFeatures: [...writing.learningFeatures],
    aesthetic: design.value,
    pageAesthetic: pages.value,
    bookBorder: border.value,
    pageWatermark: watermark.value,
    illustrationStyle: design.illustrationStyle,
    fontTheme: typography.value,
    imageFrequency: reader.imageFrequency,
  };
  const normalizedChapters = (cleanSaved.chapters ?? []).map((chapter, index) => {
    const title = chapter.title || `Chapter ${index + 1}`;
    return {
      id: chapter.id ?? index + 1,
      title,
      pages: chapter.pages || 6,
      status: chapter.status || "planned",
      locked: Boolean(chapter.locked),
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
    illustrationStyle: cleanSaved.illustrationStyle ?? "Editorial watercolour",
    fontTheme: typography.value,
    citationStyle: cleanSaved.citationStyle ?? "Source page notes",
    learningFeatures: [...writing.learningFeatures],
    briefApproved: cleanSaved.briefApproved ?? false,
    adaptationPlanConfirmed: cleanSaved.adaptationPlanConfirmed ?? Boolean((cleanSaved as Project & { summaryLengthConfirmed?: boolean }).summaryLengthConfirmed),
    sourceHeadings: hierarchy.repaired ? illustratedChapters.map((chapter) => chapter.title) : (cleanSaved.sourceHeadings ?? []),
    chapters: illustratedChapters,
  };
}

function makeId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `${Date.now().toString(36)}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
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
  const [showVersions, setShowVersions] = useState(false);
  const [showPackageImport, setShowPackageImport] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [versions, setVersions] = useState<{ label: string; date: string; snapshot: Project }[]>([]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
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

  function ownerHeaders() {
    let owner = window.localStorage.getItem("iks-book-studio-owner");
    if (!owner) {
      owner = makeId();
      window.localStorage.setItem("iks-book-studio-owner", owner);
    }
    return { "x-book-studio-owner": owner };
  }

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
    if ("aesthetic" in patch || "illustrationStyle" in patch) return { ...next, chapters: attachChapterVisuals(next, next.chapters) };
    return next;
  });

  function startNewBook() {
    setProject({ ...emptyProject, id: makeId(), editorialPreferences: [...designerPreferences], chapters: emptyProject.chapters.map((chapter) => ({ ...chapter })) });
    setWizardStep(0);
    setView("wizard");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceBusy(true);
    patchProject({ source: file.name, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), sourceSize: file.size });
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", project.id || makeId());
      form.set("audience", project.audience);
      const response = await fetch("/api/source", { method: "POST", headers: ownerHeaders(), body: form });
      const data = await response.json() as { source?: SourceResult; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Upload failed");
      const source = data.source;
      const headings = source.headings.length ? source.headings : ["Opening chapter", "Core ideas", "Applications and examples", "Closing reflections"];
      const sourceChapters: Chapter[] = headings.map((title, index) => chapterFromContextPlan(title, index, source.sections[index], source.chapterPlans[index], project.audience));
      const chapters = attachChapterVisuals({ ...project, sourceTerms: source.terms }, applyAutomaticAdaptationPlan(sourceChapters, project.audience, true));
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
        briefApproved: false,
        adaptationPlanConfirmed: false,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        chapters,
      });
      notify(`${file.name} analysed successfully`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not analyse this source");
    } finally {
      setSourceBusy(false);
    }
  }

  async function refreshSource(file: File) {
    setSourceBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", project.id);
      form.set("audience", project.audience);
      const response = await fetch("/api/source", { method: "POST", headers: ownerHeaders(), body: form });
      const data = await response.json() as { source?: SourceResult; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Source upload failed");
      const source = data.source;
      const titles = source.headings.length ? source.headings : project.sourceHeadings;
      const next = {
        ...project,
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
        adaptationPlanConfirmed: false,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        briefApproved: false,
        chapters: attachChapterVisuals({ ...project, sourceTerms: source.terms }, reconcileOriginalChapters(project, titles, source.sections, source.chapterPlans)),
      };
      setProject(next);
      await persistProject(next);
      setView("analysis");
      notify("Original chapters re-detected and adaptation pages recommended.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not refresh the source");
    } finally {
      setSourceBusy(false);
    }
  }

  async function persistProject(next: Project) {
    const bounded = { ...next, chapters: fitChaptersToBookLimit(next.chapters) };
    const response = await fetch("/api/projects", { method: "POST", headers: requestHeaders(), body: JSON.stringify(bounded) });
    if (!response.ok) throw new Error("Could not save the book");
    const data = await response.json() as { project: Project };
    setProject(data.project);
    setProjects((current) => [data.project, ...current.filter((item) => item.id !== data.project.id)]);
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
      const titles = data.source.headings.length ? data.source.headings : next.sourceHeadings;
      next = {
        ...next,
        sourcePages: data.source.pages || next.sourcePages,
        sourceWords: data.source.words || next.sourceWords,
        sourceQuality: data.source.quality,
        sourceHeadings: titles,
        sourceTerms: data.source.terms,
        sourceSections: data.source.sections,
        sourcePreview: data.source.preview,
        adaptationPlanVersion: ADAPTATION_PLAN_VERSION,
        adaptationPlanConfirmed: needsContextPlan ? false : next.adaptationPlanConfirmed,
        briefApproved: needsContextPlan ? false : next.briefApproved,
        chapters: attachChapterVisuals({ ...next, sourceTerms: data.source.terms }, reconcileOriginalChapters(next, titles, data.source.sections, data.source.chapterPlans)),
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
    const edited = project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body: html, status: "draft" as const, generationStatus: "Needs review" as const, generationProfile: "", pedagogyQuality: undefined, importedPages: undefined, importValidated: false } : chapter);
    const next = { ...project, chapters: attachChapterVisuals(project, edited) };
    setProject(next);
    try { await persistProject(next); notify("Chapter updated and saved"); } catch { notify("Chapter changed; save again when connected"); }
  }

  async function aiAction(action: string) {
    const selected = window.getSelection()?.toString().trim();
    const prompt = `Edit the children’s book “${project.title}” as its author. ${action}. Audience: ${project.audience}. Reading level: ${project.readingLevel}. Use natural, age-appropriate prose without a themed writing mode. Preserve factual accuracy. ${AUTHORIAL_READER_INSTRUCTION} Text: ${selected || authorialReaderHtml(active?.body || "").replace(/<[^>]+>/g, " ")}`;
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
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, imageKey: data.image?.key, imageUrl: data.image?.url, imageCaption: chapter.imageCaption || chapter.title, imageAlt: `Uploaded illustration for ${chapter.title}`, visualType: "uploaded" } : chapter) };
    setProject(next);
    await persistProject(next).catch(() => undefined);
    notify("Illustration added to chapter");
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

  function draftRequestBody(snapshot: Project, chapterId: number, repairOnly = false) {
    return JSON.stringify({
      source: snapshot.source,
      sourceObjectKey: snapshot.sourceObjectKey,
      audience: snapshot.audience,
      readingLevel: snapshot.readingLevel,
      language: snapshot.language,
      adaptation: snapshot.adaptation,
      learningFeatures: snapshot.learningFeatures,
      aesthetic: snapshot.aesthetic,
      illustrationStyle: snapshot.illustrationStyle,
      imageFrequency: snapshot.imageFrequency,
      sourceTerms: snapshot.sourceTerms,
      chapters: snapshot.chapters.map(({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore, pedagogyQuality }) => ({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore, pedagogyQuality })),
      chapterIds: [chapterId],
      repairOnly,
      phase7ChapterOneOnly: !repairOnly && !snapshot.chapters.find((chapter) => chapter.id === 1)?.phase7Evaluation?.passed,
    });
  }

  async function requestDraftChapter(snapshot: Project, chapterId: number, quotaStopped: () => boolean, stopForQuota: () => void, repairOnly = false) {
    let providerRequests = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/draft", {
          method: "POST",
          headers: requestHeaders(),
          body: draftRequestBody(snapshot, chapterId, repairOnly),
        });
        const data = await response.json() as DraftApiResponse;
        providerRequests += data.usage?.requests || data.requestCount || 0;
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
        if (!data.retryable || attempt === 1 || quotaStopped()) {
          return { ok: false as const, data: { ...data, requestCount: providerRequests } };
        }
      } catch {
        if (attempt === 1 || quotaStopped()) {
          return { ok: false as const, data: { error: "The website connection failed after one delayed retry. Resume from this chapter.", code: "temporary-network", retryable: true, requestCount: providerRequests } satisfies DraftApiResponse };
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, TEMPORARY_RETRY_DELAY_MS));
      if (quotaStopped()) return { ok: false as const, data: { error: "Generation stopped because the quota was exhausted. Resume the book later.", code: "quota-stop", quota: true, requestCount: providerRequests } satisfies DraftApiResponse };
    }
    return { ok: false as const, data: { error: "Chapter drafting stopped safely.", requestCount: providerRequests } satisfies DraftApiResponse };
  }

  async function prepareDraft(scope: "sample" | "all" | "active" | "thin", options: { repairOnly?: boolean } = {}) {
    pauseAfterCurrentRef.current = false;
    setBookPaused(false);
    const activeIndex = project.chapters.findIndex((chapter) => chapter.id === activeChapter);
    const selectedProfile = generationProfileKey(project.audience, project.language);
    const requestedChapterIds = project.chapters.filter((chapter, index) => {
      if (chapter.locked) return false;
      if (scope === "all") return chapter.generationStatus !== "Completed" || chapter.generationProfile !== selectedProfile;
      if (scope === "sample") return index === 0;
      if (scope === "active") return index === activeIndex;
      return chapterWordCount(chapter) < 350;
    }).map((chapter) => chapter.id);
    const chapterOne = project.chapters.find((chapter) => chapter.id === 1);
    const chapterOnePassed = Boolean(chapterOne?.phase7Evaluation?.passed);
    const chapterIds = options.repairOnly || chapterOnePassed ? requestedChapterIds : chapterOne && !chapterOne.locked ? [1] : [];
    if (!options.repairOnly && !chapterOnePassed && requestedChapterIds.some((chapterId) => chapterId !== 1)) {
      notify("Phase 7 safety gate: generating Chapter 1 only. Chapters 2–6 stay untouched until its measurements pass.");
    }
    if (!chapterIds.length) { notify("All unlocked chapters already passed the teaching-quality review"); return; }
    setDraftBusy(true);
    let completed = 0;
    let workingProject = project;
    let quotaPause = false;
    let failureReason = "";
    let chapterOneStable = project.chapters.some((chapter) => chapter.id === 1 && chapterGenerationState(chapter) === "Completed" && chapter.generationProfile === selectedProfile);
    const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, requests: 0 };
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
          workingProject = {
            ...workingProject,
            chapters: workingProject.chapters.map((chapter) => chapter.id === chapterId
              ? { ...chapter, generationStatus: "Generating" as const, generationError: undefined }
              : chapter),
          };
          setProject(workingProject);
          await persistProject(workingProject);
        }

        const requestSnapshot = workingProject;
        let saveQueue = Promise.resolve();
        const outcomes = await Promise.all(batch.map(async (chapterId) => {
          const result = await requestDraftChapter(requestSnapshot, chapterId, () => quotaPause, () => { quotaPause = true; }, Boolean(options.repairOnly));
          saveQueue = saveQueue.then(async () => {
            if (!result.ok || !result.data.chapters?.length) {
              const requestCount = result.data.requestCount || 0;
              const failedUsage = result.data.usage;
              const generationStatus: ChapterGenerationStatus = result.data.quota ? "Paused by quota" : "Needs review";
              workingProject = {
                ...workingProject,
                chapters: workingProject.chapters.map((chapter) => chapter.id === chapterId
                  ? {
                      ...chapter,
                      generationStatus,
                      generationError: result.data.error || "Chapter drafting failed",
                      repairAttempts: options.repairOnly || result.data.code === "quality-review" ? 1 : chapter.repairAttempts || 0,
                      phase7Evaluation: result.data.phase7Evaluation,
                      generationUsage: requestCount || failedUsage ? {
                        inputTokens: (chapter.generationUsage?.inputTokens || 0) + (failedUsage?.inputTokens || 0),
                        outputTokens: (chapter.generationUsage?.outputTokens || 0) + (failedUsage?.outputTokens || 0),
                        totalTokens: (chapter.generationUsage?.totalTokens || 0) + (failedUsage?.totalTokens || 0),
                        reasoningTokens: (chapter.generationUsage?.reasoningTokens || 0) + (failedUsage?.reasoningTokens || 0),
                        requests: (chapter.generationUsage?.requests || 0) + (failedUsage?.requests || requestCount),
                        updatedAt: new Date().toISOString(),
                      } : chapter.generationUsage,
                    }
                  : chapter),
              };
              failureReason ||= result.data.error || "Chapter drafting failed";
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
                  repairAttempts: options.repairOnly || (replacement.pedagogyQuality?.revisionPasses || 0) > 0 ? 1 : 0,
                  generationUsage: {
                    inputTokens: (chapter.generationUsage?.inputTokens || 0) + (usage?.inputTokens || 0),
                    outputTokens: (chapter.generationUsage?.outputTokens || 0) + (usage?.outputTokens || 0),
                    totalTokens: (chapter.generationUsage?.totalTokens || 0) + (usage?.totalTokens || 0),
                    reasoningTokens: (chapter.generationUsage?.reasoningTokens || 0) + (usage?.reasoningTokens || 0),
                    requests: (chapter.generationUsage?.requests || 0) + (usage?.requests || 0),
                    updatedAt: new Date().toISOString(),
                  },
                  phase7Evaluation: result.data.phase7Evaluation,
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
        if (outcomes.some((result) => !result.ok)) break;
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
        notify(gate ? `Chapter 1 ${gate.passed ? "passed" : "did not pass"} the Phase 7 measurement gate${usageNote}` : `${completed} chapter${completed === 1 ? "" : "s"} prepared and saved${usageNote}`);
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

  async function improveActiveChapter() {
    if (!active || draftBusy) return;
    setComparison({ chapterId: active.id, original: structuredClone(active) });
    const improved = await prepareDraft("active");
    if (improved) setShowComparison(true);
    else setComparison(null);
  }

  async function repairActiveOnce() {
    if (!active || draftBusy) return;
    if ((active.repairAttempts || 0) >= 1) {
      notify("This chapter has already used its one targeted repair");
      return;
    }
    setComparison({ chapterId: active.id, original: structuredClone(active) });
    const repaired = await prepareDraft("active", { repairOnly: true });
    if (repaired) setShowComparison(true);
    else setComparison(null);
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

  if (view === "dashboard") return <Dashboard projects={projects} onNew={startNewBook} onOpen={openProject} onDuplicate={duplicateProject} onDelete={deleteProject} />;

  return (
    <div className="studio-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></button>
        <div className="current-project"><i /> <span><strong>{project.title}</strong><small>{project.source}</small></span></div>
        <div className="top-actions">
          {view === "editor" && <button onClick={() => setView("brief")}>☷ <span>Book plan</span></button>}
          {(view === "editor" || view === "brief") && <details className="advanced-tools"><summary>Advanced tools</summary><div><button className="package-import-button" onClick={() => setShowPackageImport(true)}>ChatGPT ZIP workflow</button><small>Manual request and completed-book import</small></div></details>}
          {(view === "editor" || view === "brief") && <label className="top-upload">{sourceBusy ? "Reading…" : "↥ Source"}<input type="file" accept=".pdf,.docx,.txt,.md" disabled={sourceBusy || draftBusy} onChange={(event) => event.target.files?.[0] && refreshSource(event.target.files[0])}/></label>}
          <button onClick={openVersions}>↺ <span>Versions</span></button>
          <button onClick={saveProject}>✓ <span>Save</span></button>
          <button onClick={() => setShowPreview(true)}>Preview</button>
          <button className="export-button" onClick={exportDoc} disabled={exportBusy}>{exportBusy ? "Preparing…" : "↓ DOCX"}</button>
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
        onImprove={() => void improveActiveChapter()}
        onBuild={() => void prepareDraft("all")}
        onPause={pauseAfterCurrentChapter}
        onResume={() => void prepareDraft("all")}
        onCompare={() => comparison ? setShowComparison(true) : notify("Improve a chapter first to compare both versions")}
        onAccept={acceptImprovement}
        onKeep={() => void keepOriginal()}
        onRepair={() => void repairActiveOnce()}
        onRestore={() => void restorePreviousVersion()}
      />}

      {view === "wizard" && <Wizard step={wizardStep} project={project} sourceBusy={sourceBusy} onPatch={patchProject} onFile={handleFile} onBack={() => wizardStep === 0 ? setView("dashboard") : setWizardStep((step) => step - 1)} onNext={() => wizardStep < 3 ? setWizardStep((step) => step + 1) : setView("analysis")} />}
      {view === "analysis" && <Analysis project={project} sourceBusy={sourceBusy} onPatch={patchProject} onBack={() => { setView("wizard"); setWizardStep(4); }} onContinue={confirmAdaptationPlan} />}
      {view === "brief" && <BookBrief project={project} allocated={allocatedPages} draftBusy={draftBusy} onBack={() => setView("analysis")} onUpdateChapter={updateChapter} onPrepare={prepareDraft} onContinue={() => { patchProject({ briefApproved: true }); setActiveChapter(project.chapters[0]?.id ?? 1); setView("editor"); }} />}
      {view === "editor" && <Editor project={project} active={active} activeId={activeChapter} allocated={allocatedPages} draftBusy={draftBusy} onSelect={setActiveChapter} onSaveBody={saveChapterBody} editorRef={editorRef} onAi={aiAction} onRemember={rememberPreference} onDraft={() => prepareDraft("active")} onToggleLock={() => patchProject({ chapters: project.chapters.map((chapter) => chapter.id === active?.id ? { ...chapter, locked: !chapter.locked } : chapter) })} onAddChapter={addChapter} onUploadImage={uploadChapterImage} onPatchProject={patchProject} onUpdateChapter={updateChapter} />}

      {showPreview && <Preview project={project} draftBusy={draftBusy} onFill={() => prepareDraft("thin")} onRefresh={() => prepareDraft("all")} onClose={() => setShowPreview(false)} onPrint={() => window.print()} />}
      {showVersions && <Versions versions={versions} onCreate={createVersion} onRestore={(snapshot) => { setProject(normalizeProject(snapshot)); setShowVersions(false); notify("Version restored"); }} onClose={() => setShowVersions(false)} />}
      {showPackageImport && <BookPackageImporter project={project} busy={packageBusy} onClose={() => setShowPackageImport(false)} onDownloadRequest={downloadChatGptBookRequest} onImport={importBookPackage} />}
      {showComparison && comparison && <ChapterComparison original={comparison.original} improved={project.chapters.find((chapter) => chapter.id === comparison.chapterId) || comparison.original} onAccept={acceptImprovement} onKeep={() => void keepOriginal()} onClose={() => setShowComparison(false)} />}
      {aiRequest && <AiRoundTrip request={aiRequest} onChange={(result) => setAiRequest({ ...aiRequest, result })} onClose={() => setAiRequest(null)} onApply={applyAiResult} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function SimpleWorkflowBar({ project, active, busy, paused, connection, hasComparison, onTest, onImprove, onBuild, onPause, onResume, onCompare, onAccept, onKeep, onRepair, onRestore }: {
  project: Project;
  active: Chapter;
  busy: boolean;
  paused: boolean;
  connection: NemotronConnection;
  hasComparison: boolean;
  onTest: () => void;
  onImprove: () => void;
  onBuild: () => void;
  onPause: () => void;
  onResume: () => void;
  onCompare: () => void;
  onAccept: () => void;
  onKeep: () => void;
  onRepair: () => void;
  onRestore: () => void;
}) {
  const quotaPaused = project.chapters.some((chapter) => chapter.generationStatus === "Paused by quota");
  const unfinished = project.chapters.some((chapter) => chapter.generationStatus !== "Completed" && !chapter.locked);
  const chapterOneGate = project.chapters.find((chapter) => chapter.id === 1)?.phase7Evaluation;
  return <section className="simple-workflow-bar" aria-label="Book improvement controls">
    <div className={`connection-pill ${connection.state}`}><span /> <b>Nemotron</b><small>{connection.message}</small></div>
    <div className="workflow-actions primary-actions">
      <button onClick={onTest} disabled={busy || connection.state === "testing"}>{connection.state === "testing" ? "Testing…" : "Test Nemotron connection"}</button>
      <button className="main-action" onClick={onImprove} disabled={busy || active.locked}>Improve this chapter</button>
      <button className="main-action" onClick={onBuild} disabled={busy || (Boolean(chapterOneGate?.passed) && !unfinished)}>{chapterOneGate?.passed ? "Build remaining chapters" : "Generate Chapter 1 test"}</button>
      <button onClick={onPause} disabled={!busy || paused}>Pause after current chapter</button>
      <button onClick={onResume} disabled={busy || (!paused && !quotaPaused && !unfinished)}>Resume book</button>
    </div>
    <div className="workflow-actions review-actions">
      <button onClick={onCompare} disabled={!hasComparison}>Compare original and improved</button>
      <button onClick={onAccept} disabled={!hasComparison}>Accept improvement</button>
      <button onClick={onKeep} disabled={!hasComparison}>Keep original</button>
      <button onClick={onRepair} disabled={busy || active.locked || (active.repairAttempts || 0) >= 1}>Repair once</button>
      <button onClick={onRestore} disabled={busy}>Restore previous version</button>
    </div>
    <Phase7Report evaluation={chapterOneGate}/>
  </section>;
}

function Phase7Report({ evaluation }: { evaluation?: ChapterOneGate }) {
  if (!evaluation) return <div className="phase7-report waiting"><b>PHASE 7 · CHAPTER 1 GATE</b><span>Waiting for one measured Chapter 1 generation. Chapters 2–6 are locked.</span></div>;
  const seconds = Math.round(evaluation.metrics.durationMs / 100) / 10;
  return <div className={`phase7-report ${evaluation.passed ? "passed" : "failed"}`}><header><b>PHASE 7 · {evaluation.passed ? "PASSED" : "NEEDS REVIEW"}</b><span>{evaluation.passed ? "Chapters 2–6 unlocked" : "Chapters 2–6 remain locked"}</span></header><div><span><b>{evaluation.metrics.requests}</b> request</span><span><b>{evaluation.metrics.totalTokens.toLocaleString()}</b> tokens</span><span><b>{seconds}s</b> speed</span><span><b>{evaluation.metrics.words}</b> words</span><span><b>{evaluation.metrics.accuracyScore}</b> accuracy</span><span><b>{evaluation.metrics.ageFitScore}</b> age fit</span><span><b>{evaluation.metrics.qualityAverage}</b> quality</span></div></div>;
}

function ChapterComparison({ original, improved, onAccept, onKeep, onClose }: { original: Chapter; improved: Chapter; onAccept: () => void; onKeep: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="comparison-modal"><header><div><p className="eyebrow">CHAPTER DECISION</p><h2>Compare original and improved</h2><p>{improved.title}</p></div><button onClick={onClose}>×</button></header><div className="comparison-grid"><article><span>ORIGINAL</span><div className="book-copy" dangerouslySetInnerHTML={{ __html: authorialReaderHtml(original.body) }}/></article><article className="improved"><span>IMPROVED</span><div className="book-copy" dangerouslySetInnerHTML={{ __html: authorialReaderHtml(improved.body) }}/></article></div><footer><button className="secondary" onClick={onKeep}>Keep original</button><button className="primary" onClick={onAccept}>Accept improvement</button></footer></section></div>;
}

function Dashboard({ projects, onNew, onOpen, onDuplicate, onDelete }: { projects: Project[]; onNew: () => void; onOpen: (project: Project) => void; onDuplicate: (project: Project) => void; onDelete: (project: Project) => void }) {
  return <main className="dashboard">
    <header><div className="brand"><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></div><button className="primary" onClick={onNew}>＋ New book</button></header>
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

function BookGlimpse({ project, focus }: { project: Project; focus: "reader" | "design" }) {
  const [previewPage, setPreviewPage] = useState<(typeof glimpsePages)[number]["value"]>("chapter");
  const reader = childAudienceProfile(project.audience);
  const writing = naturalWritingProfile(project.audience);
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
  return <aside className={`book-glimpse world-${worldClass} page-aesthetic-${pageClass} book-border-${borderClass} page-watermark-${watermarkClass} typography-${typographyClass} age-${ageClass}`} aria-live="polite">
    <header><div><p className="eyebrow">LIVE BOOK & PAGE GLIMPSE</p><h2>See every important page before you build</h2></div><span>{focus === "reader" ? reader.value : `${pages.label} · ${border.label} · ${watermark.label}`}</span></header>
    <nav className="glimpse-tabs" aria-label="Preview a page type">{glimpsePages.map((item) => <button type="button" className={previewPage === item.value ? "active" : ""} onClick={() => setPreviewPage(item.value)} key={item.value}>{item.label}</button>)}</nav>
    <div className="glimpse-spread">
      <div className="glimpse-cover"><small>AN ILLUSTRATED BOOK FOR</small><strong>{reader.value.replace("Ages ", "AGES ")}</strong><div className="cover-symbol"><i/><i/><i/></div><h3>{project.title === "Untitled adaptation" ? "YOUR NEW BOOK" : project.title}</h3><span>{design.label}</span></div>
      <div className={`glimpse-page glimpse-page-${previewPage}`}>
        {previewPage === "chapter" && <><span>CHAPTER 01</span><h3>{chapterTitle}</h3><div className="glimpse-illustration" aria-hidden="true"><i/><b>✦</b><i/></div><b className="glimpse-hook">A NEW IDEA BEGINS</b><p>{glimpseSample(project)}</p></>}
        {previewPage === "reading" && <><span>UNDERSTANDING THE IDEA</span><h3>How the parts connect</h3><b className="glimpse-hook">NATURAL WRITING FOR {reader.value.toUpperCase()}</b><p>{glimpseSample(project)}</p><p className="glimpse-second-paragraph">The next example gives the idea a clear shape and connects it to the chapter as a whole.</p><div className="glimpse-word"><b>WORD HELPER</b><span>Context means the ideas and events around a topic.</span></div></>}
        {previewPage === "visual" && <><span>LOOK CLOSER</span><h3>A picture of the big idea</h3><div className="glimpse-concept-map" aria-label="Example concept map"><b>{chapterTitle.split(/\s+/).slice(0, 2).join(" ")}</b><i>People</i><i>Ideas</i><i>Choices</i></div><p className="glimpse-caption">Every chapter receives a different context-based illustration, map, timeline, tree or diagram.</p></>}
        {previewPage === "activity" && <><span>{writing.activityLabel}</span><h3>Pause, connect and create</h3><div className="glimpse-activity-card"><b>YOUR CHALLENGE</b><p>{writing.activity}</p><ol><li>Find one important idea.</li><li>Connect it to an example.</li><li>Share what you discovered.</li></ol></div></>}
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

function Wizard({ step, project, sourceBusy, onPatch, onFile, onBack, onNext }: { step: number; project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onBack: () => void; onNext: () => void }) {
  return <div className="wizard-layout">
    <aside className="step-rail"><p>CHILDREN’S EDITION</p>{wizardSteps.map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><b>{label}</b></div>)}<blockquote>Built first for children aged 7–15. Adult publishing choices will return in a later edition.</blockquote></aside>
    <main className="wizard-main">
      <p className="eyebrow">STEP {step + 1} OF 4 · AGES 7–15</p><h1>{["Choose the source.", "Choose the child reader.", "Choose the book world.", "Review your children’s book."][step]}</h1><p className="lead">{["Upload the book you are authorised to adapt.", "Pick one age band. Vocabulary, sentence length, explanation depth and text size adjust automatically.", "Choose a complete visual system and see the page before building the adaptation.", "These child-first choices guide every generated chapter and illustration."][step]}</p>
      {step === 0 && <section className="form-card"><label className={`upload ${sourceBusy ? "busy" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={sourceBusy}/><span>{sourceBusy ? "…" : "↑"}</span><strong>{sourceBusy ? "Reading and analysing your book…" : project.source}</strong><small>{sourceBusy ? "Large PDFs can take a short while" : "Click to choose a PDF, DOCX or TXT book (maximum 30 MB)"}</small></label><div className="fields two"><label>New book title<input value={project.title} onChange={(e) => onPatch({ title: e.target.value })}/></label><label>Source book<input value={project.source} readOnly/></label></div></section>}
      {step === 1 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">READER AGE</p><div className="choice-cards">{childAudienceProfiles.map((profile) => <button className={project.audience === profile.value ? "choice selected" : "choice"} onClick={() => onPatch(audiencePatch(profile.value))} key={profile.value}><span>{profile.value}</span><strong>{profile.label}</strong><small>{profile.description}</small><i>“{profile.sample}”</i></button>)}</div><div className="language-choice"><span>BOOK LANGUAGE</span>{["English", "Hindi", "English + Hindi"].map((language) => <button className={project.language === language ? "selected" : ""} onClick={() => onPatch({ language })} key={language}>{language}</button>)}</div><div className="auto-settings"><b>Natural writing is automatic</b><span>{project.learningFeatures.join(" · ")}</span><small>The studio changes vocabulary, sentence length, explanation depth and reflection for the selected age. There are no separate writing modes.</small></div></div><BookGlimpse project={project} focus="reader"/></section>}
      {step === 2 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">ILLUSTRATION WORLD</p><div className="design-world-cards">{childDesignWorlds.map((world) => <button className={`${project.aesthetic === world.value ? "selected " : ""}design-world world-${normalizedTitle(world.value).replace(/[^a-z]+/g, "-")}`} onClick={() => onPatch(designWorldPatch(world.value))} key={world.value}><span className="world-thumbnail"><i/><b>Ab</b><i/></span><strong>{world.label}</strong><small>{world.description}</small><em>{world.illustrationStyle}</em></button>)}</div><div className="page-aesthetic-section"><p className="choice-label">PAGE AESTHETIC · APPLIES TO EVERY PAGE</p><div className="page-aesthetic-cards">{pageAesthetics.map((aesthetic) => { const aestheticClass = normalizedTitle(aesthetic.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.pageAesthetic === aesthetic.value ? "selected " : ""}page-aesthetic-choice aesthetic-${aestheticClass}`} onClick={() => onPatch(pageAestheticPatch(aesthetic.value))} key={aesthetic.value}><span className="page-aesthetic-thumbnail"><i/><b>Chapter</b><i/><i/><i/></span><strong>{aesthetic.label}</strong><small>{aesthetic.description}</small><em>{aesthetic.detail}</em></button>; })}</div></div><div className="book-border-section"><p className="choice-label">BOOK BORDER · MIX WITH ANY PAGE AESTHETIC</p><div className="book-border-cards">{bookBorders.map((border) => { const borderClass = normalizedTitle(border.value).replace(/[^a-z]+/g, "-"); return <button className={`${project.bookBorder === border.value ? "selected " : ""}book-border-choice border-${borderClass}`} onClick={() => onPatch(bookBorderPatch(border.value))} key={border.value}><span className="book-border-thumbnail"><i/><b>Chapter</b><i/><i/><i/></span><strong>{border.label}</strong><small>{border.description}</small><em>{border.detail}</em></button>; })}</div></div><div className="auto-settings"><b>Visual guarantee</b><span>One unique image, page aesthetic and chosen border in every chapter</span><small>If a literal scene is unsuitable, the app creates a relevant map, timeline, tree, cycle or relationship diagram. Use the live tabs to inspect the chapter, reading, visual and activity pages.</small></div></div><BookGlimpse project={project} focus="design"/></section>}
      {step === 3 && <><section className="brief-review child-review"><div><span>SOURCE</span><strong>{project.source}</strong></div><div><span>CHILD READER</span><strong>{project.audience} · {project.readingLevel}</strong></div><div><span>BOOK</span><strong>{project.bookType}</strong></div><div><span>WRITING</span><strong>Natural age-based writing · {project.language}</strong></div><div><span>ILLUSTRATION WORLD</span><strong>{project.aesthetic} · {project.illustrationStyle}</strong></div><div><span>PAGE AESTHETIC</span><strong>{project.pageAesthetic} · applied to every page</strong></div><div><span>BOOK BORDER</span><strong>{project.bookBorder} · applied to every physical page</strong></div><div><span>PAGE WATERMARK</span><strong>{project.pageWatermark} · subtle background design</strong></div><div><span>LENGTH</span><strong>Shortest clear length · never padded · under 100 pages</strong></div></section><BookGlimpse project={project} focus="design"/></>}
      {step === 2 && <TypographyPicker project={project} onPatch={onPatch}/>}
      {step === 2 && <WatermarkPicker project={project} onPatch={onPatch}/>}
      <footer className="wizard-footer"><button className="secondary" onClick={onBack}>← Back</button><button className="primary" onClick={onNext} disabled={sourceBusy || (step === 0 && project.source === "No source selected")}>{step === 3 ? "Detect original chapters" : "Continue"} →</button></footer>
    </main>
  </div>;
}

function Analysis({ project, sourceBusy, onPatch, onBack, onContinue }: { project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onBack: () => void; onContinue: () => void }) {
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
      <aside className="generation-card"><p className="eyebrow">CONTROLLED REQUEST WORKFLOW</p><h2>Six chapters normally use six requests</h2><p>Chapter 1 runs alone. After it passes, the studio may run two chapters at once—never more. Each successful chapter is saved immediately.</p><div className="request-budget"><span><b>1</b> tiny connection test</span><span><b>{project.chapters.length}</b> normal chapter requests</span><span><b>0</b> local validation requests</span><span><b>0</b> page and export requests</span></div><div className="quality-gates"><span>Waiting</span><span>Generating</span><span>Completed</span><span>Needs review</span><span>Quota pause</span></div><div className="draft-progress"><span><b>{drafted}</b> of {project.chapters.length} completed</span><i><b style={{ width: `${project.chapters.length ? drafted / project.chapters.length * 100 : 0}%` }}/></i></div><div className="generation-usage"><span><b>{usage.totalTokens.toLocaleString()}</b> tokens recorded</span><span><b>{usage.requests}</b> Nemotron request{usage.requests === 1 ? "" : "s"}</span></div><button className="secondary full" disabled={draftBusy} onClick={() => onPrepare("sample")}>{draftBusy ? "Teaching engine is reviewing…" : "Build and review sample lesson"}</button><button className="primary full" disabled={draftBusy} onClick={() => onPrepare("all")}>{draftBusy ? "Saving each chapter before continuing…" : quotaPaused ? "Resume book" : drafted ? "Resume unfinished chapters" : "Build all reviewed lessons"}</button><small>Temporary provider failures get one delayed retry. Quota errors never retry. Formatting is repaired locally; only a genuine quality failure may use one targeted repair request.</small></aside></div>
    {first && <section className="sample-spread"><div className="sample-copy"><p className="eyebrow">SAMPLE SPREAD</p><span>CHAPTER 01</span><h2>{first.title}</h2>{first.pedagogyQuality && <div className="sample-quality"><b>✓ Teaching quality passed · {pedagogyAverage(first.pedagogyQuality)}/100</b><span>{first.pedagogyQuality.summary}</span></div>}<p>{first.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 420)}</p><button className="text-button" onClick={() => onPrepare("sample")}>{first.status === "planned" ? "Create this sample" : "Refresh and review sample"} →</button></div>{first.imageUrl ? <figure className="sample-art sample-art-image"><img src={first.imageUrl} alt={first.imageAlt || first.imageCaption || first.title}/><figcaption>{first.imageCaption || first.title}</figcaption></figure> : <div className="sample-art"><span>ILLUSTRATION DIRECTION</span><strong>{project.aesthetic}</strong><p>{first.title} · {project.imageFrequency}</p><b>✦</b></div>}</section>}
    <footer className="brief-actions"><div><b>Ready for editorial review</b><span>{drafted ? `${drafted} chapter draft${drafted === 1 ? "" : "s"} prepared` : "Prepare at least one chapter now, or begin with a blank structure."}</span></div><button className="primary" onClick={onContinue}>Approve brief & open studio →</button></footer>
  </main>;
}

function Editor({ project, active, activeId, allocated, draftBusy, onSelect, editorRef, onSaveBody, onAi, onRemember, onDraft, onToggleLock, onAddChapter, onUploadImage, onPatchProject, onUpdateChapter }: { project: Project; active?: Chapter; activeId: number; allocated: number; draftBusy: boolean; onSelect: (id: number) => void; editorRef: React.RefObject<HTMLDivElement | null>; onSaveBody: () => void; onAi: (action: string) => void; onRemember: (scope: "book" | "designer") => void; onDraft: () => void; onToggleLock: () => void; onAddChapter: () => void; onUploadImage: (file: File) => void; onPatchProject: (patch: Partial<Project>) => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void }) {
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
    <label className="editor-typography-select">Typography<select value={project.fontTheme} onChange={(event) => onPatchProject(typographyPatch(event.target.value))}>{typographyThemes.map((theme) => <option key={theme.value}>{theme.value}</option>)}</select></label>
    <aside className="chapters"><header><p className="eyebrow">BOOK STRUCTURE</p><button onClick={onAddChapter} aria-label="Add chapter">＋</button></header><div className="front-matter"><span>FM</span><div><b>Front matter</b><small>Cover · Contents · Preface</small></div></div>{project.chapters.map((chapter) => { const state = chapterGenerationState(chapter); return <button className={chapter.id === activeId ? "chapter active" : "chapter"} onClick={() => onSelect(chapter.id)} key={chapter.id}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small className={`chapter-generation-state generation-${normalizedTitle(state).replace(/[^a-z]+/g, "-")}`}>{state}{chapter.generationUsage?.totalTokens ? ` · ${chapter.generationUsage.totalTokens.toLocaleString()} tokens` : ""}</small></div><i>{chapter.locked ? "◆" : ""}</i></button>; })}<div className="page-budget"><span><b>{allocated}</b> planned pages</span><small>Natural length · 100-page safety ceiling</small></div></aside>
    <section className="canvas"><nav className="editor-tools"><div><button onClick={() => document.execCommand("bold")}><b>B</b></button><button onClick={() => document.execCommand("italic")}><i>I</i></button><button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button><button onClick={() => document.execCommand("insertUnorderedList")}>• List</button></div><div className="chapter-meter"><span>{active.pages} target pages</span><i><b style={{ width: active.status === "planned" ? "18%" : "67%" }}/></i><button onClick={onToggleLock}>{active.locked ? "◆ Locked" : "◇ Lock"}</button></div></nav><div className="page-stage"><article className={`paper font-${fontClass} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")} page-aesthetic-${pageClass} book-border-${borderClass} age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}${active.imageUrl ? " has-chapter-image" : ""}`}><header><span>{project.title}</span><span>{project.audience}</span></header><div className="ornament">✦</div><div key={active.id} ref={editorRef} className="book-copy" contentEditable={!active.locked} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: authorialReaderHtml(active.body) }}/>{active.imageUrl && <figure className="chapter-image"><img src={active.imageUrl} alt={active.imageAlt || active.imageCaption || active.title}/><figcaption>{active.imageCaption || active.title}</figcaption></figure>}<footer><span>{project.title}</span><span>{active.id}</span></footer></article></div><button className="save-float" onClick={onSaveBody}>✓ Save chapter</button></section>
    <aside className="assistant"><nav><button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>✦<span>AI EDIT</span></button><button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>◈<span>DESIGN</span></button><button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>⌕<span>SOURCES</span></button></nav><div className="assistant-body">
      {tab === "ai" && <><div className="assistant-title"><span>✦</span><div><b>Teaching-quality editor</b><small>The complete lesson must pass before publication.</small></div></div><div className="request-control-card"><b>REQUEST CONTROL</b><span>1 request per chapter · maximum 2 at once after Chapter 1</span><small>One delayed retry only for temporary failures · no quota retry</small></div><div className={`generation-status-card generation-${normalizedTitle(chapterGenerationState(active)).replace(/[^a-z]+/g, "-")}`}><b>{chapterGenerationState(active)}</b><span>{active.generationUsage?.totalTokens ? `${active.generationUsage.totalTokens.toLocaleString()} tokens · ${active.generationUsage.requests} request${active.generationUsage.requests === 1 ? "" : "s"}` : "No Nemotron usage recorded yet"}</span>{active.generationError && <small>{active.generationError}</small>}</div>{!active.locked && <button className="draft-chapter-button" disabled={draftBusy} onClick={onDraft}>{draftBusy ? "Understanding and reviewing…" : chapterGenerationState(active) === "Completed" ? "↻ Rebuild and review lesson" : chapterGenerationState(active) === "Paused by quota" ? "▶ Resume this chapter" : "✦ Build and review this lesson"}</button>}{active.importValidated ? <div className="package-lock-report"><b>✓ STRUCTURED PACKAGE VERIFIED</b><p>{active.importedPages?.length || active.pages} page IDs are locked to Chapter {active.id}. Its text and images were imported without automatic redistribution.</p>{active.importedPages && <ol>{active.importedPages.map((page) => <li key={page.pageId}><span>{page.pageId}</span><b>{page.purpose}</b><i>{page.imageUrl ? "image linked" : "text"}</i></li>)}</ol>}</div> : active.pedagogyQuality ? <div className="pedagogy-report"><header><div><b>✓ READY FOR CHILDREN</b><span>{pedagogyAverage(active.pedagogyQuality)}/100</span></div><p>{active.pedagogyQuality.summary}</p></header><div className="score-grid">{Object.entries(active.pedagogyQuality.scores).map(([name, score]) => <span key={name}><b>{score}</b>{qualityScoreLabels[name] || name}</span>)}</div><div className="quality-checks">{active.pedagogyQuality.checks.map((check) => <p key={check}>✓ {check}</p>)}</div></div> : <div className="pedagogy-pending"><b>Quality review required</b><p>This older draft has not passed context, coherence, age-fit, teaching, and accuracy checks. Rebuild it before export.</p></div>}<p className="selection-tip">This chapter has <b>{chapterWordCount(active).toLocaleString()} words</b>. Every edit keeps the voice direct and authorial for the selected age.</p><div className="ai-list">{["Simplify language", "Shorten selection", "Expand with examples", "Make age-appropriate", "Improve storytelling", "Check factual accuracy", "Suggest an illustration"].map((action) => <button onClick={() => onAi(action)} key={action}><span>✦</span>{action}<i>→</i></button>)}</div><div className="memory-box"><p className="eyebrow">EDITORIAL MEMORY</p><p>{project.editorialPreferences.length ? project.editorialPreferences.join(" · ") : "No saved preferences yet"}</p><button onClick={() => onRemember("book")}>＋ Remember for this book</button><button onClick={() => onRemember("designer")}>＋ Remember for future books</button></div></>}
      {tab === "design" && <><div className="assistant-title"><span>◈</span><div><b>Book design</b><small>Illustration world, page aesthetic, border and watermark apply across the whole adaptation.</small></div></div><div className="design-controls"><div className="visual-status"><b>✓ Chapter visual ready</b><span>{active.visualType === "uploaded" ? "Your uploaded image" : `${active.visualType || "context"} visual generated from this chapter`}</span></div><label>Illustration world<select value={project.aesthetic} onChange={(e) => onPatchProject(designWorldPatch(e.target.value))}>{childDesignWorlds.map((world) => <option key={world.value}>{world.value}</option>)}</select></label><label>Page aesthetic<select value={project.pageAesthetic} onChange={(e) => onPatchProject(pageAestheticPatch(e.target.value))}>{pageAesthetics.map((aesthetic) => <option key={aesthetic.value}>{aesthetic.value}</option>)}</select></label><label>Book border<select value={project.bookBorder} onChange={(e) => onPatchProject(bookBorderPatch(e.target.value))}>{bookBorders.map((border) => <option key={border.value}>{border.value}</option>)}</select></label><label>Page watermark<select value={project.pageWatermark} onChange={(e) => onPatchProject(pageWatermarkPatch(e.target.value))}>{pageWatermarks.map((watermark) => <option key={watermark.value}>{watermark.value}</option>)}</select></label><div className="design-summary"><b>{project.pageAesthetic} · {project.bookBorder} · {project.pageWatermark}</b><span>{project.illustrationStyle} · {project.fontTheme} · {project.imageFrequency}</span></div><label className="image-upload">Replace chapter image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}/></label>{active.imageUrl && <label>Image caption<input value={active.imageCaption || ""} onChange={(e) => onUpdateChapter(active.id, { imageCaption: e.target.value })}/></label>}</div></>}
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
  const openChatGPT = async () => {
    try { await navigator.clipboard.writeText(request.prompt); } catch { /* clipboard permission can be unavailable */ }
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(request.prompt)}`, "_blank", "noopener,noreferrer");
  };
  return <div className="modal-backdrop"><section className="ai-modal"><header><div><p className="eyebrow">CHATGPT EDIT</p><h2>{request.action}</h2></div><button onClick={onClose}>×</button></header><ol><li><button className="primary" onClick={openChatGPT}>Open this edit in ChatGPT ↗</button><small>The instruction is also copied automatically.</small></li><li><label>Paste ChatGPT’s revised text here<textarea value={request.result} onChange={(e) => onChange(e.target.value)} placeholder="Paste the approved revision…"/></label></li></ol><footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!request.result.trim()} onClick={onApply}>Apply and save revision</button></footer></section></div>;
}

function paginateReaderHtml(html: string, audience: string) {
  const clean = authorialReaderHtml(html);
  const blocks = clean.match(/<(h2|h3|p|blockquote|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [clean];
  const age = childAgeBand(audience);
  const pageCapacity = age === "7-9" ? 1180 : age === "13-15" ? 1580 : 1380;
  const pages: string[] = [];
  let current: string[] = [];
  let weight = 0;

  for (const block of blocks) {
    const textLength = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
    const blockWeight = textLength + (/^<h[23]/i.test(block) ? 260 : 0) + (/^<(?:ul|ol|blockquote)/i.test(block) ? 150 : 0);
    if (current.length && weight + blockWeight > pageCapacity) {
      pages.push(current.join(""));
      current = [];
      weight = 0;
    }
    current.push(block);
    weight += blockWeight;
  }
  if (current.length) pages.push(current.join(""));
  return pages.length ? pages : [clean];
}

function Preview({ project, draftBusy, onFill, onRefresh, onClose, onPrint }: { project: Project; draftBusy: boolean; onFill: () => void; onRefresh: () => void; onClose: () => void; onPrint: () => void }) {
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
  const thinChapters = project.chapters.filter((chapter) => chapterWordCount(chapter) < 350 && !chapter.locked && !chapter.importValidated);
  const selectedProfile = generationProfileKey(project.audience, project.language);
  const staleChapters = project.chapters.filter((chapter) => !chapter.locked && !chapter.importValidated && chapterWordCount(chapter) >= 350 && chapter.generationProfile !== selectedProfile);
  const unreviewedChapters = project.chapters.filter((chapter) => !chapter.importValidated && chapter.pedagogyQuality?.status !== "passed");
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  const worldClass = `world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")}`;
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
