"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { generationProfileKey, modeParagraphParts } from "../lib/child-summary";

type View = "dashboard" | "wizard" | "analysis" | "brief" | "editor";

type SourceSection = { title: string; page: number; excerpt: string };

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
};

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
  tone: string;
  language: string;
  bookType: string;
  aesthetic: string;
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
  tone: "Curious explorer",
  language: "English",
  bookType: "Illustrated children’s adaptation",
  aesthetic: "Bright Explorer",
  illustrationStyle: "Colourful educational illustration",
  fontTheme: "Friendly rounded",
  imageFrequency: "Picture-rich — at least 1 per chapter",
  adaptation: "Faithful children’s adaptation",
  citationStyle: "Source notes for grown-ups",
  learningFeatures: ["Big question", "Word helper", "Mini challenge"],
  editorialPreferences: ["Clear sentences", "Preserve specialist terms", "Explain Sanskrit words on first use"],
  briefApproved: true,
  adaptationPlanConfirmed: true,
  updatedAt: "Today",
  chapters: [
    {
      id: 1,
      title: "The Thinker and His World",
      pages: 12,
      status: "approved",
      locked: true,
      sourceRefs: [{ title: "Foundations and Context", page: 13, excerpt: "The source connects knowledge, discipline, public welfare and administration as practical responsibilities." }],
      body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>The Thinker<br/>and His World</h1><p class="chapter-deck">Before the Arthashastra became a guide to governance, it was a response to a changing world—one in which knowledge, discipline and public welfare had to work together.</p><blockquote>Good governance begins with understanding people, place and purpose.</blockquote><h2>A landscape of new ideas</h2><p>Ancient India was home to many schools of thought. Teachers, rulers and communities debated how prosperity could be created and protected. The Arthashastra brought these conversations into a practical framework for leadership.</p><div class="illustration"><span>ILLUSTRATION 01</span><strong>A learning hall at dawn</strong><small>Suggested visual: a teacher, students, manuscripts and a map of the subcontinent.</small></div><h2>Why the text still matters</h2><p>The work asks questions that remain familiar today: What makes an institution trustworthy? How should leaders balance strength and compassion? How can public resources be used wisely?</p><div class="takeaway"><b>KEY IDEA</b><p>Knowledge is valuable when it improves decisions and serves the wider community.</p></div>`,
    },
    {
      id: 2,
      title: "Knowledge, Learning and Discipline",
      pages: 10,
      status: "draft",
      locked: false,
      sourceRefs: [{ title: "Knowledge and Learning", page: 37, excerpt: "Education and disciplined inquiry are presented as foundations for sound judgement." }],
      body: `<p class="chapter-kicker">CHAPTER TWO</p><h1>Knowledge, Learning<br/>and Discipline</h1><p class="chapter-deck">A practical education joins careful study with reflection, observation and responsible action.</p><h2>Learning as preparation</h2><p>The text treats education as preparation for sound judgment. It connects intellectual training with self-control and attention to real conditions.</p><div class="illustration"><span>ILLUSTRATION 02</span><strong>Four paths of learning</strong><small>Suggested visual: a precise editorial diagram built from the approved source.</small></div>`,
    },
    {
      id: 3,
      title: "Leadership and Public Welfare",
      pages: 14,
      status: "draft",
      locked: false,
      sourceRefs: [{ title: "Leadership and Welfare", page: 55, excerpt: "Leadership is evaluated through responsibility, institutional strength and public welfare." }],
      body: `<p class="chapter-kicker">CHAPTER THREE</p><h1>Leadership and<br/>Public Welfare</h1><p class="chapter-deck">Leadership is presented not as privilege, but as a demanding responsibility.</p><h2>The work of leadership</h2><p>A capable leader listens, studies evidence, chooses advisers carefully and keeps public welfare at the centre of policy.</p>`,
    },
    {
      id: 4,
      title: "Economy, Trade and Resources",
      pages: 14,
      status: "planned",
      locked: false,
      sourceRefs: [{ title: "Economy and Resources", page: 75, excerpt: "Revenue, trade, agriculture and resources are treated as connected parts of prosperity." }],
      body: `<p class="chapter-kicker">CHAPTER FOUR</p><h1>Economy, Trade<br/>and Resources</h1><p class="chapter-deck">Prosperity depends on systems that are understood, measured and maintained.</p>`,
    },
    {
      id: 5,
      title: "Strategy, Diplomacy and Peace",
      pages: 14,
      status: "planned",
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
  tone: "Curious explorer",
  language: "English",
  bookType: "Illustrated children’s adaptation",
  aesthetic: "Bright Explorer",
  illustrationStyle: "Colourful educational illustration",
  fontTheme: "Friendly rounded",
  imageFrequency: "Picture-rich — at least 1 per chapter",
  adaptation: "Faithful children’s adaptation",
  citationStyle: "Source notes for grown-ups",
  learningFeatures: ["Big question", "Word helper", "Mini challenge"],
  chapters: [
    { id: 1, title: "Opening chapter", pages: 10, status: "planned", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>Opening chapter</h1><p class="chapter-deck">Your generated chapter will appear here after the book brief is approved.</p>` },
  ],
  editorialPreferences: [],
  briefApproved: false,
  adaptationPlanConfirmed: false,
};

const wizardSteps = ["Source", "Reader", "Writing", "Design", "Review"];

const childAudienceProfiles = [
  {
    value: "Ages 7–9",
    label: "Early explorers",
    readingLevel: "Early independent reader",
    description: "Short sentences, familiar words and frequent visual pauses.",
    sample: "A big idea can begin with a small question. Let’s look closely and discover what it means.",
    imageFrequency: "Highly illustrated — 1 per page",
  },
  {
    value: "Ages 10–12",
    label: "Curious readers",
    readingLevel: "Confident independent reader",
    description: "Clear explanations, new vocabulary and hands-on challenges.",
    sample: "Every chapter begins with a question, gathers clues from the source, and connects them to the world you know.",
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

const childWritingProfiles = [
  {
    value: "Friendly guide",
    label: "Friendly guide",
    icon: "☀",
    description: "A calm teacher explains one idea at a time.",
    hookLabel: "LET’S BEGIN",
    hook: "We will unpack this idea together, using clear steps and a helpful word guide.",
    sections: ["Let’s look closely", "One important idea", "Why it matters", "Remember this"],
    activityLabel: "QUICK CHECK",
    activity: "Can you explain the main idea in your own words?",
    learningFeatures: ["Key idea", "Word helper", "Quick check"],
  },
  {
    value: "Story journey",
    label: "Story journey",
    icon: "✦",
    description: "Facts unfold through a scene, a journey and moments of discovery.",
    hookLabel: "STEP INTO THE STORY",
    hook: "Imagine entering the world of this chapter. Each discovery will reveal another part of the source.",
    sections: ["Where our journey begins", "A discovery", "The turning point", "What the journey teaches us"],
    activityLabel: "STORY PAUSE",
    activity: "What would you notice, ask or do if you were there?",
    learningFeatures: ["Scene opener", "Story pause", "Word helper"],
  },
  {
    value: "Curious explorer",
    label: "Curious explorer",
    icon: "⌕",
    description: "Questions, clues, diagrams and mini challenges drive the chapter.",
    hookLabel: "BIG QUESTION",
    hook: "What can we discover here? Let’s collect clues, connect ideas and test what we learn.",
    sections: ["The big question", "Clue one", "Connect the clues", "Try thinking like an explorer"],
    activityLabel: "MINI CHALLENGE",
    activity: "Draw a three-part map that connects the chapter’s most important ideas.",
    learningFeatures: ["Big question", "Word helper", "Mini challenge"],
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

function childAudienceProfile(value: string) {
  const direct = childAudienceProfiles.find((profile) => profile.value === value);
  if (direct) return direct;
  if (/7\s*[–-]|children\s*\(7/i.test(value)) return childAudienceProfiles[0];
  if (/13|14|15/i.test(value)) return childAudienceProfiles[2];
  return childAudienceProfiles[1];
}

function childWritingProfile(value: string) {
  const direct = childWritingProfiles.find((profile) => profile.value === value);
  if (direct) return direct;
  if (/story/i.test(value)) return childWritingProfiles[1];
  if (/warm|friendly|clear/i.test(value)) return childWritingProfiles[0];
  return childWritingProfiles[2];
}

function childDesignWorld(value: string) {
  const direct = childDesignWorlds.find((world) => world.value === value);
  if (direct) return direct;
  if (/classical|warm|children|storybook/i.test(value)) return childDesignWorlds[0];
  if (/academic|scholar|minimal/i.test(value)) return childDesignWorlds[2];
  return childDesignWorlds[1];
}

function audiencePatch(value: string): Partial<Project> {
  const profile = childAudienceProfile(value);
  return {
    audience: profile.value,
    readingLevel: profile.readingLevel,
    bookType: "Illustrated children’s adaptation",
    imageFrequency: profile.imageFrequency,
  };
}

function writingPatch(value: string): Partial<Project> {
  const profile = childWritingProfile(value);
  return {
    tone: profile.value,
    adaptation: "Faithful children’s adaptation",
    citationStyle: "Source notes for grown-ups",
    learningFeatures: [...profile.learningFeatures],
  };
}

function designWorldPatch(value: string): Partial<Project> {
  const world = childDesignWorld(value);
  return {
    aesthetic: world.value,
    illustrationStyle: world.illustrationStyle,
    fontTheme: world.fontTheme,
  };
}

function recommendedAdaptationPages(chapter: Pick<Chapter, "title" | "sourcePageCount" | "sourceWordCount" | "complexityScore" | "keyTerms" | "recommendedPages">, audience: string) {
  if (!chapter.sourceWordCount || !chapter.sourcePageCount) return chapter.recommendedPages || 6;
  const age = /7\s*[–-]\s*9/i.test(audience)
    ? { wordsPerPage: 105, transformationRatio: .42, visualInterval: 3 }
    : /13\s*[–-]\s*15/i.test(audience)
      ? { wordsPerPage: 175, transformationRatio: .66, visualInterval: 6 }
      : { wordsPerPage: 140, transformationRatio: .54, visualInterval: 4 };
  const transformedWords = chapter.sourceWordCount * age.transformationRatio;
  const complexityAllowance = .88 + (chapter.complexityScore ?? .4) * .34;
  const visualAndActivityPages = Math.max(1, Math.ceil(chapter.sourcePageCount / age.visualInterval));
  const conceptAllowance = Math.max(1, Math.ceil((chapter.keyTerms?.length ?? 3) / 3));
  const shorterBackMatter = /^(appendix|conclusion|epilogue|references?)\b/i.test(chapter.title) ? .78 : 1;
  return Math.max(3, Math.round(((transformedWords / age.wordsPerPage) * complexityAllowance + visualAndActivityPages + conceptAllowance) * shorterBackMatter));
}

function adaptationPageReason(chapter: Chapter, audience: string) {
  const sourceWords = chapter.sourceWordCount?.toLocaleString() ?? "analysed";
  const reader = childAudienceProfile(audience).label.toLowerCase();
  return `${chapter.complexity || "Layered"} chapter · ${sourceWords} source words · space for ${reader} to understand the ideas through explanations, examples, a unique visual and an activity.`;
}

function applyAutomaticAdaptationPlan(chapters: Chapter[], audience: string, includeCustom = false) {
  return chapters.map((chapter) => {
    if (chapter.pagePlanCustom && !includeCustom) return chapter;
    const recommendedPages = recommendedAdaptationPages(chapter, audience);
    return { ...chapter, pages: recommendedPages, recommendedPages, pageReason: adaptationPageReason(chapter, audience), pagePlanCustom: false };
  });
}

function chapterFromContextPlan(title: string, index: number, section: SourceSection | undefined, plan: ChapterContextPlan | undefined, audience: string): Chapter {
  const base: Chapter = {
    id: index + 1,
    title,
    pages: plan?.recommendedPages ?? 6,
    status: "planned",
    locked: false,
    sourceRefs: section ? [section] : [],
    body: `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${escapeHtml(title)}</h1><p class="chapter-deck">This chapter is ready to become a complete children’s adaptation of its source ideas.</p>`,
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
  return (body || "").replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (paragraph, _attributes: string, content: string) => {
    const text = content.replace(/<[^>]+>/g, " ").replace(/&\w+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
    return /\bsource-grounded chapter\b[\s\S]*\breferenced source locations?\b/i.test(text) ? "" : paragraph;
  });
}

function reconcileOriginalChapters(project: Project, titles: string[], sections: SourceSection[], chapterPlans: ChapterContextPlan[] = []) {
  const used = new Set<number>();
  const defaultPages = 6;
  return titles.map((title, index) => {
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
  const writing = childWritingProfile(cleanSaved.tone ?? "");
  const design = childDesignWorld(cleanSaved.aesthetic ?? "");
  const childFirstSaved: Project = {
    ...emptyProject,
    ...cleanSaved,
    audience: reader.value,
    readingLevel: reader.readingLevel,
    tone: writing.value,
    bookType: "Illustrated children’s adaptation",
    adaptation: "Faithful children’s adaptation",
    citationStyle: "Source notes for grown-ups",
    learningFeatures: [...writing.learningFeatures],
    aesthetic: design.value,
    illustrationStyle: design.illustrationStyle,
    fontTheme: design.fontTheme,
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
    };
  });
  const hierarchy = repairChapterHierarchy(normalizedChapters);
  // Chapter labels and their following titles are merged above. Attach curated
  // art only after that repair so every final chapter title receives its own
  // matching illustration, including already-saved projects.
  const visualProject = childFirstSaved;
  const illustratedChapters = attachChapterVisuals(visualProject, hierarchy.chapters);
  return {
    ...emptyProject,
    ...childFirstSaved,
    sourcePreview: cleanSaved.sourcePreview ?? "",
    sourceSections: cleanSaved.sourceSections ?? [],
    illustrationStyle: cleanSaved.illustrationStyle ?? "Editorial watercolour",
    fontTheme: cleanSaved.fontTheme ?? "Literary serif",
    citationStyle: cleanSaved.citationStyle ?? "Source page notes",
    learningFeatures: cleanSaved.learningFeatures ?? ["Key takeaways"],
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

function chapterWordCount(chapter: Chapter) {
  return chapter.body.replace(/<[^>]+>/g, " ").match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0;
}

function printableChapters(chapters: Chapter[]) {
  const seenParagraphs = new Set<string>();
  let duplicatesRemoved = 0;
  const cleaned = chapters.map((chapter) => ({
    ...chapter,
    body: chapter.body.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (paragraph, attributes: string, content: string) => {
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

function sourceSentences(project: Project) {
  const sentences = project.sourcePreview
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 55 && sentence.length < 420 && !/copyright|isbn|contents/i.test(sentence));
  return sentences.length ? sentences : [`This chapter will be developed from the reviewed source material in ${project.source}.`];
}

function createChapterDraft(project: Project, chapter: Chapter, index: number): Chapter {
  const sentences = sourceSentences(project);
  const sourceRef = project.sourceSections[index % Math.max(1, project.sourceSections.length)];
  const refSentences = sourceRef?.excerpt.split(/(?<=[.!?])\s+/).filter(Boolean) ?? [];
  const first = refSentences[0] || sentences[(index * 2) % sentences.length];
  const second = refSentences[1] || sentences[(index * 2 + 1) % sentences.length];
  const rawTerm = project.sourceTerms[index % Math.max(1, project.sourceTerms.length)] || "key idea";
  const rawNextTerm = project.sourceTerms[(index + 1) % Math.max(1, project.sourceTerms.length)] || "context";
  const term = escapeHtml(rawTerm);
  const nextTerm = escapeHtml(rawNextTerm);
  const title = escapeHtml(chapter.title);
  const writing = childWritingProfile(project.tone);
  const firstParts = modeParagraphParts({ sentence: first, tone: project.tone, audience: project.audience, focus: rawTerm, related: rawNextTerm, chapterTitle: chapter.title, paragraphIndex: 0 });
  const secondParts = modeParagraphParts({ sentence: second, tone: project.tone, audience: project.audience, focus: rawNextTerm, related: rawTerm, chapterTitle: chapter.title, paragraphIndex: 1 });
  const fallbackParagraph = (parts: ReturnType<typeof modeParagraphParts>) => `<p class="mode-summary mode-summary-${normalizedTitle(writing.value).replace(/[^a-z]+/g, "-")}"><span class="reading-bridge">${escapeHtml(parts.lead)}</span><span class="mode-setup">${escapeHtml(parts.setup)}</span> <span class="mode-evidence">${escapeHtml(parts.evidence)}</span> <span class="mode-response">${escapeHtml(parts.response)}</span></p>`;
  const visual = escapeHtml(`${project.illustrationStyle} in a ${project.aesthetic.toLowerCase()} direction, connecting ${chapter.title} with ${rawTerm}; ${project.imageFrequency.toLowerCase()}`);
  return {
    ...chapter,
    status: "draft",
    sourceRefs: sourceRef ? [sourceRef] : chapter.sourceRefs,
    body: `<p class="chapter-kicker">CHAPTER ${String(index + 1).padStart(2, "0")}</p><h1>${title}</h1><div class="child-opening child-opening-${normalizedTitle(writing.value).replace(/[^a-z]+/g, "-")}"><b>${writing.hookLabel}</b><p>${writing.hook}</p></div><h2>${writing.sections[0]}</h2>${fallbackParagraph(firstParts)}<h2>${writing.sections[1]}</h2>${fallbackParagraph(secondParts)}<h2>${writing.sections[2]}</h2><p>This section connects <strong>${term}</strong> with <strong>${nextTerm}</strong> so the chapter’s big idea is easier to see.</p><div class="illustration"><span>ILLUSTRATION DIRECTION</span><strong>${title}</strong><small>${visual}</small></div><div class="takeaway child-activity"><b>${writing.activityLabel}</b><p>${writing.activity}</p></div>${sourceRef ? `<p class="source-note">Source note: ${escapeHtml(sourceRef.title)}, p. ${sourceRef.page}</p>` : ""}`,
    generationProfile: generationProfileKey(project.audience, project.tone, project.language),
  };
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
  const [versions, setVersions] = useState<{ label: string; date: string; snapshot: Project }[]>([]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [designerPreferences, setDesignerPreferences] = useState<string[]>([]);
  const [aiRequest, setAiRequest] = useState<{ action: string; prompt: string; selection: string; result: string } | null>(null);
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
            || item.chapters.some((chapter, chapterIndex) => chapter.title !== original.chapters[chapterIndex]?.title);
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
  const allocatedPages = useMemo(() => project.chapters.reduce((sum, chapter) => sum + chapter.pages, 8), [project.chapters]);
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
      const chapters = attachChapterVisuals({ ...project, sourceTerms: source.terms }, sourceChapters);
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
    const response = await fetch("/api/projects", { method: "POST", headers: requestHeaders(), body: JSON.stringify(next) });
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
    if (next.adaptationPlanConfirmed) {
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
        chapters: attachChapterVisuals({ ...next, sourceTerms: data.source.terms }, reconcileOriginalChapters(next, titles, data.source.sections, data.source.chapterPlans)),
      };
      setProject(next);
      await persistProject(next);
      notify(`${titles.length} original chapters detected`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not re-check the original chapters");
    } finally {
      setSourceBusy(false);
    }
  }

  async function confirmAdaptationPlan() {
    const next = { ...project, adaptationPlanConfirmed: true, briefApproved: false };
    setProject(next);
    setView("brief");
    try { await persistProject(next); } catch { notify("Page choices are kept here; save again when connected"); }
  }

  async function saveChapterBody() {
    if (!active || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const edited = project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body: html, status: "draft" as const } : chapter);
    const next = { ...project, chapters: attachChapterVisuals(project, edited) };
    setProject(next);
    try { await persistProject(next); notify("Chapter updated and saved"); } catch { notify("Chapter changed; save again when connected"); }
  }

  async function aiAction(action: string) {
    const selected = window.getSelection()?.toString().trim();
    const prompt = `Edit the book “${project.title}”, adapted from “${project.source}”. ${action}. Audience: ${project.audience}. Reading level: ${project.readingLevel}. Tone: ${project.tone}. Preserve factual accuracy and source traceability. Text: ${selected || active?.body.replace(/<[^>]+>/g, " ")}`;
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
    const id = Math.max(0, ...project.chapters.map((chapter) => chapter.id)) + 1;
    const nextChapter: Chapter = { id, title: `New chapter ${id}`, pages: 6, status: "planned", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ${id}</p><h1>New chapter ${id}</h1><p class="chapter-deck">Add or prepare this chapter from the reviewed source.</p>` };
    patchProject({ chapters: attachChapterVisuals(project, [...project.chapters, nextChapter]) });
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

  async function applyAiResult() {
    if (!aiRequest?.result.trim() || !active) return;
    const replacement = aiRequest.result.trim().split(/\n{2,}/).map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br/>")}</p>`).join("");
    let body = replacement;
    if (aiRequest.selection) {
      const escapedSelection = escapeHtml(aiRequest.selection);
      body = active.body.includes(aiRequest.selection)
        ? active.body.replace(aiRequest.selection, replacement)
        : active.body.includes(escapedSelection)
          ? active.body.replace(escapedSelection, replacement)
          : `${active.body}<div class="editorial-insert"><b>EDITORIAL REVISION</b>${replacement}</div>`;
    }
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body, status: "draft" as const } : chapter) };
    setProject(next);
    setAiRequest(null);
    await persistProject(next).catch(() => undefined);
    notify("ChatGPT revision applied and saved");
  }

  function updateChapter(chapterId: number, patch: Partial<Chapter>) {
    patchProject({ chapters: project.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, ...patch } : chapter) });
  }

  async function prepareDraft(scope: "sample" | "all" | "active" | "thin") {
    const activeIndex = project.chapters.findIndex((chapter) => chapter.id === activeChapter);
    const chapterIds = project.chapters.filter((chapter, index) => {
      if (chapter.locked) return false;
      if (scope === "all") return true;
      if (scope === "sample") return index === 0;
      if (scope === "active") return index === activeIndex;
      return chapterWordCount(chapter) < 350;
    }).map((chapter) => chapter.id);
    if (!chapterIds.length) { notify("All chapters already contain substantial content"); return; }
    setDraftBusy(true);
    try {
      if (!project.sourceObjectKey) {
        const drafted = project.chapters.map((chapter, index) => chapterIds.includes(chapter.id) ? createChapterDraft(project, chapter, index) : chapter);
        const fallback = attachChapterVisuals(project, drafted);
        const next = { ...project, chapters: fallback };
        setProject(next);
        await persistProject(next).catch(() => undefined);
        notify(scope === "all" || scope === "thin" ? "Chapter drafts prepared" : "Chapter draft prepared");
        return;
      }
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          source: project.source,
          sourceObjectKey: project.sourceObjectKey,
          audience: project.audience,
          readingLevel: project.readingLevel,
          tone: project.tone,
          language: project.language,
          adaptation: project.adaptation,
          learningFeatures: project.learningFeatures,
          aesthetic: project.aesthetic,
          illustrationStyle: project.illustrationStyle,
          imageFrequency: project.imageFrequency,
          sourceTerms: project.sourceTerms,
          chapters: project.chapters.map(({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore }) => ({ id, title, pages, locked, body, sourceStartPage, sourceEndPage, sourcePageCount, sourceWordCount, complexityScore })),
          chapterIds,
        }),
      });
      const data = await response.json() as { chapters?: Chapter[]; error?: string };
      if (!response.ok || !data.chapters) throw new Error(data.error || "Chapter drafting failed");
      const replacements = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
      const merged = project.chapters.map((chapter) => replacements.has(chapter.id) ? { ...chapter, ...replacements.get(chapter.id)! } : chapter);
      const next = { ...project, chapters: attachChapterVisuals(project, merged) };
      setProject(next);
      await persistProject(next);
      notify(scope === "all" || scope === "thin" ? `${data.chapters.length} full chapters prepared and saved` : "Full chapter prepared and saved");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not prepare the chapters");
    } finally {
      setDraftBusy(false);
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
          {(view === "editor" || view === "brief") && <label className="top-upload">{sourceBusy ? "Reading…" : "↥ Source"}<input type="file" accept=".pdf,.docx,.txt,.md" disabled={sourceBusy || draftBusy} onChange={(event) => event.target.files?.[0] && refreshSource(event.target.files[0])}/></label>}
          <button onClick={openVersions}>↺ <span>Versions</span></button>
          <button onClick={saveProject}>✓ <span>Save</span></button>
          <button onClick={() => setShowPreview(true)}>Preview</button>
          <button className="export-button" onClick={exportDoc} disabled={exportBusy}>{exportBusy ? "Preparing…" : "↓ DOCX"}</button>
        </div>
      </header>

      {view === "wizard" && <Wizard step={wizardStep} project={project} sourceBusy={sourceBusy} onPatch={patchProject} onFile={handleFile} onBack={() => wizardStep === 0 ? setView("dashboard") : setWizardStep((step) => step - 1)} onNext={() => wizardStep < 4 ? setWizardStep((step) => step + 1) : setView("analysis")} />}
      {view === "analysis" && <Analysis project={project} sourceBusy={sourceBusy} onPatch={patchProject} onBack={() => { setView("wizard"); setWizardStep(4); }} onContinue={confirmAdaptationPlan} />}
      {view === "brief" && <BookBrief project={project} allocated={allocatedPages} draftBusy={draftBusy} onBack={() => setView("analysis")} onUpdateChapter={updateChapter} onPrepare={prepareDraft} onContinue={() => { patchProject({ briefApproved: true }); setActiveChapter(project.chapters[0]?.id ?? 1); setView("editor"); }} />}
      {view === "editor" && <Editor project={project} active={active} activeId={activeChapter} allocated={allocatedPages} draftBusy={draftBusy} onSelect={setActiveChapter} onSaveBody={saveChapterBody} editorRef={editorRef} onAi={aiAction} onRemember={rememberPreference} onDraft={() => prepareDraft("active")} onToggleLock={() => patchProject({ chapters: project.chapters.map((chapter) => chapter.id === active?.id ? { ...chapter, locked: !chapter.locked } : chapter) })} onAddChapter={addChapter} onUploadImage={uploadChapterImage} onPatchProject={patchProject} onUpdateChapter={updateChapter} />}

      {showPreview && <Preview project={project} draftBusy={draftBusy} onFill={() => prepareDraft("thin")} onRefresh={() => prepareDraft("all")} onClose={() => setShowPreview(false)} onPrint={() => window.print()} />}
      {showVersions && <Versions versions={versions} onCreate={createVersion} onRestore={(snapshot) => { setProject(normalizeProject(snapshot)); setShowVersions(false); notify("Version restored"); }} onClose={() => setShowVersions(false)} />}
      {aiRequest && <AiRoundTrip request={aiRequest} onChange={(result) => setAiRequest({ ...aiRequest, result })} onClose={() => setAiRequest(null)} onApply={applyAiResult} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Dashboard({ projects, onNew, onOpen, onDuplicate, onDelete }: { projects: Project[]; onNew: () => void; onOpen: (project: Project) => void; onDuplicate: (project: Project) => void; onDelete: (project: Project) => void }) {
  return <main className="dashboard">
    <header><div className="brand"><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></div><button className="primary" onClick={onNew}>＋ New book</button></header>
    <section className="hero">
      <div><p className="eyebrow">CHILDREN’S ADAPTATION STUDIO</p><h1>Turn any source into a book<br/><em>children want to read.</em></h1><p className="hero-copy">Preserve every original chapter, then reshape the writing, activities and visual world for children aged 7–15.</p><button className="hero-cta" onClick={onNew}>Start a children’s adaptation <span>→</span></button><small>AGES 7–15 · PDF · DOCX · TXT · NO FIXED PAGE LIMIT</small></div>
      <div className="hero-books" aria-hidden="true"><div className="book back"><span>THE SOURCE</span></div><div className="book front"><span>A BOOK FOR</span><strong>CURIOUS<br/>YOUNG MINDS</strong><i>READ · DISCOVER · CREATE</i><b>✦</b></div></div>
    </section>
    <section className="library-section">
      <div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Continue where you left off</h2></div><span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span></div>
      <div className="project-grid">
        <button className="new-card" onClick={onNew}><b>＋</b><strong>New adaptation</strong><small>Begin with any source book</small></button>
        {projects.map((project) => <article className="project-card" key={project.id}><button className="project-open" onClick={() => onOpen(project)}><div className="mini-cover"><span>{project.chapters.length}</span><small>CHAPTERS</small></div><div><span className="status">IN EDITING</span><h3>{project.title}</h3><p>{project.source}</p><footer><span>{project.updatedAt}</span><strong>Open project →</strong></footer></div></button><div className="project-menu"><button onClick={() => onDuplicate(project)}>Duplicate</button>{project.id !== "arthashastra-sample" && <button onClick={() => onDelete(project)}>Delete</button>}</div></article>)}
      </div>
    </section>
    <section className="workflow"><div><span>01</span><b>Upload</b><small>Any source book</small></div><i>→</i><div><span>02</span><b>Choose</b><small>Age, voice and book world</small></div><i>→</i><div><span>03</span><b>Adapt</b><small>Child-friendly text and visuals</small></div><i>→</i><div><span>04</span><b>Publish</b><small>PDF or editable file</small></div></section>
  </main>;
}

function glimpseSample(project: Project) {
  const writing = childWritingProfile(project.tone);
  if (project.language === "Hindi") {
    if (writing.value === "Story journey") return "कल्पना कीजिए कि आप इस अध्याय की दुनिया में प्रवेश कर रहे हैं। हर खोज हमें स्रोत के एक नए विचार तक ले जाएगी।";
    if (writing.value === "Friendly guide") return "आइए इस विचार को छोटे और साफ़ चरणों में समझें। नए शब्दों के लिए एक आसान शब्द-सहायक भी मिलेगा।";
    return "हम यहाँ क्या खोज सकते हैं? आइए संकेत जुटाएँ, विचारों को जोड़ें और अपनी समझ को जाँचें।";
  }
  if (project.language === "English + Hindi") return `${writing.hook} / आइए इस अध्याय के मुख्य विचारों को खोजें और समझें।`;
  return writing.hook;
}

function BookGlimpse({ project, focus }: { project: Project; focus: "reader" | "writing" | "design" }) {
  const reader = childAudienceProfile(project.audience);
  const writing = childWritingProfile(project.tone);
  const design = childDesignWorld(project.aesthetic);
  const chapterTitle = project.sourceHeadings[0] || "A Big Idea to Explore";
  const worldClass = normalizedTitle(design.value).replace(/[^a-z]+/g, "-");
  const ageClass = reader.value.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "");
  return <aside className={`book-glimpse world-${worldClass} age-${ageClass}`} aria-live="polite">
    <header><div><p className="eyebrow">LIVE BOOK GLIMPSE</p><h2>This is how the choice feels</h2></div><span>{focus === "reader" ? reader.value : focus === "writing" ? writing.label : design.label}</span></header>
    <div className="glimpse-spread">
      <div className="glimpse-cover"><small>AN ILLUSTRATED BOOK FOR</small><strong>{reader.value.replace("Ages ", "AGES ")}</strong><div className="cover-symbol"><i/><i/><i/></div><h3>{project.title === "Untitled adaptation" ? "YOUR NEW BOOK" : project.title}</h3><span>{design.label}</span></div>
      <div className="glimpse-page"><span>CHAPTER 01</span><h3>{chapterTitle}</h3><div className="glimpse-illustration" aria-hidden="true"><i/><b>✦</b><i/></div><b className="glimpse-hook">{writing.hookLabel}</b><p>{glimpseSample(project)}</p><div className="glimpse-callout"><strong>{writing.activityLabel}</strong><span>{writing.activity}</span></div></div>
    </div>
    <footer><span><b>Aa</b>{reader.readingLevel}</span><span><b>✎</b>{writing.label}</span><span><b>◈</b>{project.imageFrequency}</span></footer>
  </aside>;
}

function Wizard({ step, project, sourceBusy, onPatch, onFile, onBack, onNext }: { step: number; project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onBack: () => void; onNext: () => void }) {
  return <div className="wizard-layout">
    <aside className="step-rail"><p>CHILDREN’S EDITION</p>{wizardSteps.map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><b>{label}</b></div>)}<blockquote>Built first for children aged 7–15. Adult publishing choices will return in a later edition.</blockquote></aside>
    <main className="wizard-main">
      <p className="eyebrow">STEP {step + 1} OF 5 · AGES 7–15</p><h1>{["Choose the source.", "Choose the child reader.", "Choose how it should sound.", "Choose the book world.", "Review your children’s book."][step]}</h1><p className="lead">{["Upload the book you are authorised to adapt.", "Pick one age band. Reading difficulty, text size and visual rhythm adjust together.", "Each writing mode changes the chapter opening, headings, paragraph rhythm and activities.", "Choose a complete visual system and see the page before building the adaptation.", "These child-first choices guide every generated chapter and illustration."][step]}</p>
      {step === 0 && <section className="form-card"><label className={`upload ${sourceBusy ? "busy" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={sourceBusy}/><span>{sourceBusy ? "…" : "↑"}</span><strong>{sourceBusy ? "Reading and analysing your book…" : project.source}</strong><small>{sourceBusy ? "Large PDFs can take a short while" : "Click to choose a PDF, DOCX or TXT book (maximum 30 MB)"}</small></label><div className="fields two"><label>New book title<input value={project.title} onChange={(e) => onPatch({ title: e.target.value })}/></label><label>Source book<input value={project.source} readOnly/></label></div></section>}
      {step === 1 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">READER AGE</p><div className="choice-cards">{childAudienceProfiles.map((profile) => <button className={project.audience === profile.value ? "choice selected" : "choice"} onClick={() => onPatch(audiencePatch(profile.value))} key={profile.value}><span>{profile.value}</span><strong>{profile.label}</strong><small>{profile.description}</small><i>“{profile.sample}”</i></button>)}</div></div><BookGlimpse project={project} focus="reader"/></section>}
      {step === 2 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">WRITING MODE</p><div className="choice-cards writing-choices">{childWritingProfiles.map((profile) => <button className={project.tone === profile.value ? "choice selected" : "choice"} onClick={() => onPatch(writingPatch(profile.value))} key={profile.value}><span className="choice-icon">{profile.icon}</span><strong>{profile.label}</strong><small>{profile.description}</small><i>{profile.hookLabel} · {profile.activityLabel}</i></button>)}</div><div className="language-choice"><span>BOOK LANGUAGE</span>{["English", "Hindi", "English + Hindi"].map((language) => <button className={project.language === language ? "selected" : ""} onClick={() => onPatch({ language })} key={language}>{language}</button>)}</div><div className="auto-settings"><b>Automatically included</b><span>{project.learningFeatures.join(" · ")}</span><small>Facts remain tied to the uploaded source. Source notes are kept for the adult editor and do not clutter the child’s page.</small></div></div><BookGlimpse project={project} focus="writing"/></section>}
      {step === 3 && <section className="wizard-choice-layout"><div className="form-card compact-choice-card"><p className="choice-label">VISUAL WORLD</p><div className="design-world-cards">{childDesignWorlds.map((world) => <button className={`${project.aesthetic === world.value ? "selected " : ""}design-world world-${normalizedTitle(world.value).replace(/[^a-z]+/g, "-")}`} onClick={() => onPatch(designWorldPatch(world.value))} key={world.value}><span className="world-thumbnail"><i/><b>Ab</b><i/></span><strong>{world.label}</strong><small>{world.description}</small><em>{world.illustrationStyle} · {world.fontTheme}</em></button>)}</div><div className="auto-settings"><b>Visual guarantee</b><span>At least one different context-based visual in every chapter</span><small>If a literal scene is unsuitable, the app creates a relevant map, timeline, tree, cycle or relationship diagram in the same book world.</small></div></div><BookGlimpse project={project} focus="design"/></section>}
      {step === 4 && <><section className="brief-review child-review"><div><span>SOURCE</span><strong>{project.source}</strong></div><div><span>CHILD READER</span><strong>{project.audience} · {project.readingLevel}</strong></div><div><span>BOOK</span><strong>{project.bookType}</strong></div><div><span>WRITING</span><strong>{project.tone} · {project.language}</strong></div><div><span>BOOK WORLD</span><strong>{project.aesthetic} · {project.illustrationStyle}</strong></div><div><span>LENGTH</span><strong>Set per original chapter</strong></div></section><BookGlimpse project={project} focus="design"/></>}
      <footer className="wizard-footer"><button className="secondary" onClick={onBack}>← Back</button><button className="primary" onClick={onNext} disabled={sourceBusy || (step === 0 && project.source === "No source selected")}>{step === 4 ? "Detect original chapters" : "Continue"} →</button></footer>
    </main>
  </div>;
}

function Analysis({ project, sourceBusy, onPatch, onBack, onContinue }: { project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onBack: () => void; onContinue: () => void }) {
  const headings = project.sourceHeadings.length ? project.sourceHeadings : ["Opening chapter"];
  const setChapterPages = (index: number, value: number) => onPatch({
    chapters: project.chapters.map((chapter, chapterIndex) => chapterIndex === index ? { ...chapter, pages: Math.max(1, value || 1), pagePlanCustom: true } : chapter),
  });
  const recalculate = () => onPatch({ chapters: applyAutomaticAdaptationPlan(project.chapters, project.audience, true) });
  const plannedPages = project.chapters.reduce((total, chapter) => total + chapter.pages, 8);
  return <main className="analysis-page"><button className="text-button" onClick={onBack}>← Change setup</button><p className="eyebrow">CHAPTER CONTEXT ANALYSIS</p><h1>{sourceBusy ? "Understanding every original chapter…" : "Your adaptation page plan is ready."}</h1><p className="lead">This is not a summary plan. The studio reads each chapter’s length, concepts and difficulty, then gives it enough space to become a complete, age-appropriate adaptation.</p><section className="stats"><div><span>SOURCE PAGES</span><strong>{project.sourcePages || "—"}</strong></div><div><span>SOURCE WORDS</span><strong>{project.sourceWords ? project.sourceWords.toLocaleString() : "Pending"}</strong></div><div><span>ORIGINAL CHAPTERS</span><strong>{headings.length}</strong></div><div><span>ADAPTATION PAGES</span><strong>{plannedPages}</strong></div></section><div className="analysis-grid"><section className="analysis-card chapter-detection"><header><div><p className="eyebrow">AUTOMATIC ADAPTATION PLAN</p><h2>{headings.length} original chapters, each planned from its own context</h2></div><button className="recalculate-plan" onClick={recalculate}>↻ Recalculate</button></header><div className="adaptation-plan-note"><b>How the recommendation works</b><span>Source length + idea density + reading age + examples + one unique visual + one activity. You can still edit any number.</span></div>{headings.map((heading, index) => { const chapter = project.chapters[index]; return <div className="heading-row context-row" key={`${index}-${heading}`}><span>{String(index + 1).padStart(2, "0")}</span><div className="chapter-context"><strong>{heading}</strong><p>{chapter?.context || "Chapter context is being matched to the uploaded source."}</p><div><em>{chapter?.sourceStartPage ? `Source pp. ${chapter.sourceStartPage}–${chapter.sourceEndPage}` : "Source range pending"}</em><em>{chapter?.sourceWordCount ? `${chapter.sourceWordCount.toLocaleString()} words` : "Word count pending"}</em><em>{chapter?.complexity || "Analysing"}</em></div><small>{chapter?.pageReason || "The page recommendation will appear after source analysis."}</small></div><label><b>{chapter?.pagePlanCustom ? "CUSTOM" : "RECOMMENDED"}</b><input aria-label={`Adaptation pages for ${heading}`} type="number" min="1" value={chapter?.pages ?? 1} onChange={(event) => setChapterPages(index, Number(event.target.value))}/><span>pages</span></label></div>; })}</section><aside><div className="analysis-card"><p className="eyebrow">BOOK-WIDE THEMES</p><div className="tags">{(project.sourceTerms.length ? project.sourceTerms : ["analysis pending"]).map((term) => <span key={term}>{term}</span>)}</div></div><div className="analysis-card note"><p className="eyebrow">ADAPTATION, NOT SUMMARY</p><p>Every original chapter keeps its exact name and order. The page count expands or contracts according to what children need to understand—not one repeated number for the whole book.</p></div><div className="analysis-card note"><p className="eyebrow">NO MAXIMUM</p><p>The recommended total is a starting plan, not a limit. Increase any chapter whenever its ideas need more room.</p></div></aside></div><footer className="analysis-footer"><span>Page recommendations can be changed later without renaming or removing any original chapter.</span><button className="primary" disabled={sourceBusy || !headings.length} onClick={onContinue}>Confirm adaptation plan →</button></footer></main>;
}

function BookBrief({ project, allocated, draftBusy, onBack, onUpdateChapter, onPrepare, onContinue }: { project: Project; allocated: number; draftBusy: boolean; onBack: () => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void; onPrepare: (scope: "sample" | "all" | "active") => void; onContinue: () => void }) {
  const drafted = project.chapters.filter((chapter) => chapter.status !== "planned").length;
  const first = project.chapters[0];
  return <main className="brief-page">
    <button className="text-button" onClick={onBack}>← Back to source analysis</button>
    <header className="brief-hero"><div><p className="eyebrow">CHILDREN’S BOOK BRIEF & PAGE PLAN</p><h1>{project.title}</h1><p className="lead">An illustrated adaptation for {project.audience.toLowerCase()}, written as a {project.tone.toLowerCase()} in the {project.aesthetic.toLowerCase()} book world.</p><div className="brief-chips"><span>{project.language}</span><span>{project.readingLevel}</span><span>{project.imageFrequency}</span></div></div><aside><span>PROMISE TO THE CHILD READER</span><p>Keep the source truthful, make every new word understandable, and give each chapter a question, a visual and something worth thinking about.</p></aside></header>
    <div className="brief-layout"><section className="plan-card"><header><div><p className="eyebrow">STRUCTURE</p><h2>Chapter adaptation-page plan</h2></div><div className="budget-pill">{allocated} planned pages</div></header><div className="plan-head"><span>CHAPTER</span><span>ORIGINAL TITLE</span><span>PAGES</span><span>STATE</span></div>{project.chapters.map((chapter, index) => <div className="plan-row" key={chapter.id}><span>{String(index + 1).padStart(2, "0")}</span><strong className="preserved-title">{chapter.title}</strong><input aria-label={`Adaptation pages for ${chapter.title}`} type="number" min="1" value={chapter.pages} onChange={(event) => onUpdateChapter(chapter.id, { pages: Math.max(1, Number(event.target.value) || 1), pagePlanCustom: true })}/><b className={`draft-state ${chapter.status}`}>{chapter.status}</b></div>)}<footer><span>Pages were recommended from each chapter’s context and may be adjusted. Includes 8 planned pages for front and back matter. There is no fixed maximum.</span></footer></section>
      <aside className="generation-card"><p className="eyebrow">FULL CHAPTER BUILDER</p><h2>Prepare the manuscript</h2><p>Build substantial editable chapters from multiple relevant passages in the uploaded source. Page markers and source evidence are added automatically. Locked chapters are never overwritten.</p><div className="draft-progress"><span><b>{drafted}</b> of {project.chapters.length} drafted</span><i><b style={{ width: `${project.chapters.length ? drafted / project.chapters.length * 100 : 0}%` }}/></i></div><button className="secondary full" disabled={draftBusy} onClick={() => onPrepare("sample")}>{draftBusy ? "Reading the source…" : "Build full sample chapter"}</button><button className="primary full" disabled={draftBusy} onClick={() => onPrepare("all")}>{draftBusy ? "Building full chapters…" : "Build all full chapters"}</button><small>This source-grounded builder works without an AI key. Use the editorial assistant afterward when you want stylistic rewriting.</small></aside></div>
    {first && <section className="sample-spread"><div className="sample-copy"><p className="eyebrow">SAMPLE SPREAD</p><span>CHAPTER 01</span><h2>{first.title}</h2><p>{first.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 420)}</p><button className="text-button" onClick={() => onPrepare("sample")}>{first.status === "planned" ? "Create this sample" : "Refresh sample draft"} →</button></div>{first.imageUrl ? <figure className="sample-art sample-art-image"><img src={first.imageUrl} alt={first.imageAlt || first.imageCaption || first.title}/><figcaption>{first.imageCaption || first.title}</figcaption></figure> : <div className="sample-art"><span>ILLUSTRATION DIRECTION</span><strong>{project.aesthetic}</strong><p>{first.title} · {project.imageFrequency}</p><b>✦</b></div>}</section>}
    <footer className="brief-actions"><div><b>Ready for editorial review</b><span>{drafted ? `${drafted} chapter draft${drafted === 1 ? "" : "s"} prepared` : "Prepare at least one chapter now, or begin with a blank structure."}</span></div><button className="primary" onClick={onContinue}>Approve brief & open studio →</button></footer>
  </main>;
}

function Editor({ project, active, activeId, allocated, draftBusy, onSelect, editorRef, onSaveBody, onAi, onRemember, onDraft, onToggleLock, onAddChapter, onUploadImage, onPatchProject, onUpdateChapter }: { project: Project; active?: Chapter; activeId: number; allocated: number; draftBusy: boolean; onSelect: (id: number) => void; editorRef: React.RefObject<HTMLDivElement | null>; onSaveBody: () => void; onAi: (action: string) => void; onRemember: (scope: "book" | "designer") => void; onDraft: () => void; onToggleLock: () => void; onAddChapter: () => void; onUploadImage: (file: File) => void; onPatchProject: (patch: Partial<Project>) => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void }) {
  const [tab, setTab] = useState<"ai" | "design" | "sources">("ai");
  if (!active) return null;
  const fontClass = project.fontTheme.toLowerCase().replace(/[^a-z]+/g, "-");
  return <main className="editor-layout">
    <aside className="chapters"><header><p className="eyebrow">BOOK STRUCTURE</p><button onClick={onAddChapter} aria-label="Add chapter">＋</button></header><div className="front-matter"><span>FM</span><div><b>Front matter</b><small>Cover · Contents · Preface</small></div></div>{project.chapters.map((chapter) => <button className={chapter.id === activeId ? "chapter active" : "chapter"} onClick={() => onSelect(chapter.id)} key={chapter.id}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small>{chapter.pages} pages · {chapter.status}</small></div><i>{chapter.locked ? "◆" : ""}</i></button>)}<div className="page-budget"><span><b>{allocated}</b> planned pages</span><small>No fixed maximum page limit</small></div></aside>
    <section className="canvas"><nav className="editor-tools"><div><button onClick={() => document.execCommand("bold")}><b>B</b></button><button onClick={() => document.execCommand("italic")}><i>I</i></button><button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button><button onClick={() => document.execCommand("insertUnorderedList")}>• List</button></div><div className="chapter-meter"><span>{active.pages} target pages</span><i><b style={{ width: active.status === "planned" ? "18%" : "67%" }}/></i><button onClick={onToggleLock}>{active.locked ? "◆ Locked" : "◇ Lock"}</button></div></nav><div className="page-stage"><article className={`paper font-${fontClass} world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")} age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}${active.imageUrl ? " has-chapter-image" : ""}`}><header><span>{project.title}</span><span>{project.audience}</span></header><div className="ornament">✦</div><div key={active.id} ref={editorRef} className="book-copy" contentEditable={!active.locked} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: active.body }}/>{active.imageUrl && <figure className="chapter-image"><img src={active.imageUrl} alt={active.imageAlt || active.imageCaption || active.title}/><figcaption>{active.imageCaption || active.title}</figcaption></figure>}<footer><span>{project.source}</span><span>{active.id}</span></footer></article></div><button className="save-float" onClick={onSaveBody}>✓ Save chapter</button></section>
    <aside className="assistant"><nav><button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>✦<span>AI EDIT</span></button><button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>◈<span>DESIGN</span></button><button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>⌕<span>SOURCES</span></button></nav><div className="assistant-body">
      {tab === "ai" && <><div className="assistant-title"><span>✦</span><div><b>Editorial assistant</b><small>Select text, then choose an action.</small></div></div>{!active.locked && <button className="draft-chapter-button" disabled={draftBusy} onClick={onDraft}>{draftBusy ? "Reading the source…" : chapterWordCount(active) < 350 ? "✦ Build this full chapter" : "↻ Rebuild full chapter from source"}</button>}<p className="selection-tip">This chapter has <b>{chapterWordCount(active).toLocaleString()} words</b>. The full chapter builder uses the uploaded source; the guided edit actions can then refine the writing in ChatGPT.</p><div className="ai-list">{["Simplify language", "Shorten selection", "Expand with examples", "Make age-appropriate", "Improve storytelling", "Check against source", "Suggest an illustration"].map((action) => <button onClick={() => onAi(action)} key={action}><span>✦</span>{action}<i>→</i></button>)}</div><div className="memory-box"><p className="eyebrow">EDITORIAL MEMORY</p><p>{project.editorialPreferences.length ? project.editorialPreferences.join(" · ") : "No saved preferences yet"}</p><button onClick={() => onRemember("book")}>＋ Remember for this book</button><button onClick={() => onRemember("designer")}>＋ Remember for future books</button></div></>}
      {tab === "design" && <><div className="assistant-title"><span>◈</span><div><b>Book design</b><small>One child-friendly world controls colour, type and illustration style.</small></div></div><div className="design-controls"><div className="visual-status"><b>✓ Chapter visual ready</b><span>{active.visualType === "uploaded" ? "Your uploaded image" : `${active.visualType || "context"} visual generated from this chapter`}</span></div><label>Book world<select value={project.aesthetic} onChange={(e) => onPatchProject(designWorldPatch(e.target.value))}>{childDesignWorlds.map((world) => <option key={world.value}>{world.value}</option>)}</select></label><div className="design-summary"><b>{project.illustrationStyle}</b><span>{project.fontTheme} · {project.imageFrequency}</span></div><label className="image-upload">Replace chapter image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}/></label>{active.imageUrl && <label>Image caption<input value={active.imageCaption || ""} onChange={(e) => onUpdateChapter(active.id, { imageCaption: e.target.value })}/></label>}</div></>}
      {tab === "sources" && <><div className="assistant-title"><span>⌕</span><div><b>Source evidence</b><small>{active.sourceRefs.length} reference{active.sourceRefs.length === 1 ? "" : "s"} linked to this chapter.</small></div></div><div className="source-list">{active.sourceRefs.length ? active.sourceRefs.map((ref, index) => <article key={`${ref.title}-${index}`}><span>PAGE {ref.page || "—"}</span><b>{ref.title}</b><p>{ref.excerpt}</p></article>) : <p className="empty">No source reference is linked yet. Prepare this chapter to attach the closest extracted section.</p>}</div><div className="source-policy"><b>{project.citationStyle}</b><p>Verify important names, dates and quotations before marking the chapter approved.</p></div></>}
    </div></aside>
  </main>;
}

function AiRoundTrip({ request, onChange, onClose, onApply }: { request: { action: string; prompt: string; selection: string; result: string }; onChange: (value: string) => void; onClose: () => void; onApply: () => void }) {
  const openChatGPT = async () => {
    try { await navigator.clipboard.writeText(request.prompt); } catch { /* clipboard permission can be unavailable */ }
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(request.prompt)}`, "_blank", "noopener,noreferrer");
  };
  return <div className="modal-backdrop"><section className="ai-modal"><header><div><p className="eyebrow">CHATGPT EDIT</p><h2>{request.action}</h2></div><button onClick={onClose}>×</button></header><ol><li><button className="primary" onClick={openChatGPT}>Open this edit in ChatGPT ↗</button><small>The instruction is also copied automatically.</small></li><li><label>Paste ChatGPT’s revised text here<textarea value={request.result} onChange={(e) => onChange(e.target.value)} placeholder="Paste the approved revision…"/></label></li></ol><footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!request.result.trim()} onClick={onApply}>Apply and save revision</button></footer></section></div>;
}

function Preview({ project, draftBusy, onFill, onRefresh, onClose, onPrint }: { project: Project; draftBusy: boolean; onFill: () => void; onRefresh: () => void; onClose: () => void; onPrint: () => void }) {
  const thinChapters = project.chapters.filter((chapter) => chapterWordCount(chapter) < 350 && !chapter.locked);
  const selectedProfile = generationProfileKey(project.audience, project.tone, project.language);
  const staleChapters = project.chapters.filter((chapter) => !chapter.locked && chapterWordCount(chapter) >= 350 && chapter.generationProfile !== selectedProfile);
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  const worldClass = `world-${normalizedTitle(project.aesthetic).replace(/[^a-z]+/g, "-")}`;
  const ageClass = `age-${project.audience.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return <div className="modal-backdrop"><section className="preview-modal"><header><div><p className="eyebrow">FINAL CHILDREN’S BOOK PREVIEW</p><h2>{project.title}</h2></div><div>{staleChapters.length > 0 ? <button className="fill-chapters" disabled={draftBusy} onClick={onRefresh}>{draftBusy ? "Rewriting chapters…" : `Apply ${project.tone} writing`}</button> : thinChapters.length > 0 && <button className="fill-chapters" disabled={draftBusy} onClick={onFill}>{draftBusy ? "Building chapters…" : `Fill ${thinChapters.length} short chapter${thinChapters.length === 1 ? "" : "s"}`}</button>}<button onClick={onPrint}>Print / Save PDF</button><button onClick={onClose}>×</button></div></header>{(staleChapters.length > 0 || thinChapters.length > 0 || printable.duplicatesRemoved > 0) && <div className="preview-warning"><b>{staleChapters.length > 0 ? `${staleChapters.length} chapter${staleChapters.length === 1 ? " needs" : "s need"} the selected writing style.` : thinChapters.length > 0 ? `${thinChapters.length} chapter${thinChapters.length === 1 ? " is" : "s are"} still too short.` : "Repeated content repaired."}</b><span>{staleChapters.length > 0 ? `Rebuild the writing as ${project.tone.toLowerCase()} for ${project.audience.toLowerCase()}; locked chapters will stay unchanged.` : printable.duplicatesRemoved > 0 ? `${printable.duplicatesRemoved} repeated paragraph${printable.duplicatesRemoved === 1 ? " was" : "s were"} omitted from this preview and PDF.` : "Fill the short chapters from the uploaded source before exporting."}</span></div>}<div className="preview-scroll"><article className={`preview-cover ${worldClass}`}><p>{project.bookType} · {project.audience}</p><h1>{project.title}</h1><span>Adapted from {project.source}</span><b>✦</b></article><article className={`preview-page contents-page ${worldClass}`}><span>CONTENTS</span><h2>Inside this book</h2><ol>{printable.chapters.map((chapter, index) => <li key={chapter.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{chapter.title}</span><i>{chapter.pages} pages</i></li>)}</ol></article>{printable.chapters.map((chapter) => <article className={`preview-page chapter-preview ${worldClass} ${ageClass}${chapter.imageUrl ? " has-chapter-image" : ""}`} key={chapter.id}><header className="print-chapter-header"><span>CHAPTER {chapter.id}</span><span>{project.tone.toUpperCase()}</span></header><h2>{chapter.title}</h2><div className="preview-body" dangerouslySetInnerHTML={{ __html: chapter.body }}/>{chapter.imageUrl && <figure className="chapter-image"><img src={chapter.imageUrl} alt={chapter.imageAlt || chapter.imageCaption || chapter.title}/><figcaption>{chapter.imageCaption || chapter.title}</figcaption></figure>}{chapter.sourceRefs.length > 0 && <div className="preview-sources"><b>EDITOR’S SOURCE NOTES</b>{chapter.sourceRefs.map((ref, index) => <p key={`${ref.title}-${index}`}>{ref.title}, p. {ref.page || "—"}</p>)}</div>}</article>)}<article className={`preview-page backmatter ${worldClass}`}><span>EDITORIAL NOTES</span><h2>References and production brief</h2><p>Adapted from <b>{project.source}</b>. Citation approach: {project.citationStyle}.</p><p>Designed in the {project.aesthetic.toLowerCase()} book world with {project.illustrationStyle.toLowerCase()} visuals for {project.audience.toLowerCase()}.</p><h3>Remembered editorial decisions</h3><ul>{project.editorialPreferences.map((preference) => <li key={preference}>{preference}</li>)}</ul></article></div></section></div>;
}

function Versions({ versions, onCreate, onRestore, onClose }: { versions: { label: string; date: string; snapshot: Project }[]; onCreate: () => void; onRestore: (project: Project) => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="versions-modal"><header><div><p className="eyebrow">VERSION HISTORY</p><h2>Editorial checkpoints</h2></div><button onClick={onClose}>×</button></header><button className="primary full" onClick={onCreate}>＋ Create checkpoint</button>{versions.length === 0 ? <p className="empty">No checkpoints yet. Create one before a major edit.</p> : versions.map((version) => <div className="version" key={version.date}><span>↺</span><div><b>{version.label}</b><small>{version.date}</small></div><button onClick={() => onRestore(version.snapshot)}>Restore</button></div>)}</section></div>;
}
