"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

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
  wordCount?: number;
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
  maxPages: number;
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

function curatedIllustration(title: string) {
  return curatedChapterIllustrations[title.trim().toLowerCase().replace(/\s+/g, " ")];
}

const seedProject: Project = {
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
  audience: "Young adults (15–18)",
  readingLevel: "Accessible academic",
  tone: "Clear and engaging",
  language: "English",
  bookType: "Illustrated learning book",
  maxPages: 72,
  aesthetic: "Classical Indian",
  illustrationStyle: "Editorial watercolour",
  fontTheme: "Literary serif",
  imageFrequency: "Medium — 1 per 3 pages",
  adaptation: "Faithful, reader-friendly adaptation",
  citationStyle: "Source page notes",
  learningFeatures: ["Key takeaways", "Glossary"],
  editorialPreferences: ["Clear sentences", "Preserve specialist terms", "Explain Sanskrit words on first use"],
  briefApproved: true,
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
  audience: "General readers (18+)",
  readingLevel: "Clear and accessible",
  maxPages: 60,
  chapters: [
    { id: 1, title: "Opening chapter", pages: 10, status: "planned", locked: false, sourceRefs: [], body: `<p class="chapter-kicker">CHAPTER ONE</p><h1>Opening chapter</h1><p class="chapter-deck">Your generated chapter will appear here after the book brief is approved.</p>` },
  ],
  editorialPreferences: [],
  briefApproved: false,
};

const wizardSteps = ["Source", "Reader", "Writing", "Design", "Review"];

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
  const normalizedChapters = (saved.chapters ?? []).map((chapter, index) => {
    const title = chapter.title || `Chapter ${index + 1}`;
    return {
      id: chapter.id ?? index + 1,
      title,
      pages: chapter.pages || 6,
      status: chapter.status || "planned",
      locked: Boolean(chapter.locked),
      sourceRefs: chapter.sourceRefs ?? [],
      body: chapter.body || `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${title}</h1>`,
      imageKey: chapter.imageKey,
      imageUrl: chapter.imageUrl,
      imageCaption: chapter.imageCaption,
      wordCount: chapter.wordCount,
    };
  });
  const hierarchy = repairChapterHierarchy(normalizedChapters);
  // Chapter labels and their following titles are merged above. Attach curated
  // art only after that repair so every final chapter title receives its own
  // matching illustration, including already-saved projects.
  const illustratedChapters = hierarchy.chapters.map((chapter) => {
    const illustration = curatedIllustration(chapter.title);
    return {
      ...chapter,
      imageUrl: chapter.imageUrl || illustration?.url,
      imageCaption: chapter.imageCaption || illustration?.caption,
    };
  });
  return {
    ...emptyProject,
    ...saved,
    sourcePreview: saved.sourcePreview ?? "",
    sourceSections: saved.sourceSections ?? [],
    illustrationStyle: saved.illustrationStyle ?? "Editorial watercolour",
    fontTheme: saved.fontTheme ?? "Literary serif",
    citationStyle: saved.citationStyle ?? "Source page notes",
    learningFeatures: saved.learningFeatures ?? ["Key takeaways"],
    briefApproved: saved.briefApproved ?? false,
    sourceHeadings: hierarchy.repaired ? illustratedChapters.map((chapter) => chapter.title) : (saved.sourceHeadings ?? []),
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
  const first = escapeHtml(refSentences[0] || sentences[(index * 2) % sentences.length]);
  const second = escapeHtml(refSentences[1] || sentences[(index * 2 + 1) % sentences.length]);
  const term = escapeHtml(project.sourceTerms[index % Math.max(1, project.sourceTerms.length)] || "key idea");
  const nextTerm = escapeHtml(project.sourceTerms[(index + 1) % Math.max(1, project.sourceTerms.length)] || "context");
  const title = escapeHtml(chapter.title);
  const audience = escapeHtml(project.audience.toLowerCase());
  const visual = escapeHtml(`${project.illustrationStyle} in a ${project.aesthetic.toLowerCase()} direction, connecting ${chapter.title} with ${term}; ${project.imageFrequency.toLowerCase()}`);
  return {
    ...chapter,
    status: "draft",
    sourceRefs: sourceRef ? [sourceRef] : chapter.sourceRefs,
    body: `<p class="chapter-kicker">CHAPTER ${String(index + 1).padStart(2, "0")}</p><h1>${title}</h1><p class="chapter-deck">A ${escapeHtml(project.tone.toLowerCase())} exploration of this part of the source, shaped for ${audience}.</p><h2>The central idea</h2><p>${first}</p><p>${second}</p><blockquote>This draft remains anchored to the uploaded source and is ready for an editor to refine.</blockquote><h2>${term.charAt(0).toUpperCase() + term.slice(1)} in context</h2><p>This section connects <strong>${term}</strong> with <strong>${nextTerm}</strong>. Use the source-reference view during editing to verify names, dates, quotations and specialist terminology before approval.</p><div class="illustration"><span>ILLUSTRATION DIRECTION</span><strong>${title}</strong><small>${visual}</small></div><div class="takeaway"><b>KEY TAKEAWAYS</b><p>Review the source evidence, explain specialist language for the selected reader, and preserve the meaning while improving clarity.</p></div>${sourceRef ? `<p class="source-note">Source note: ${escapeHtml(sourceRef.title)}, p. ${sourceRef.page}</p>` : ""}`,
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
  const patchProject = (patch: Partial<Project>) => setProject((current) => ({ ...current, ...patch }));

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
      const response = await fetch("/api/source", { method: "POST", headers: ownerHeaders(), body: form });
      const data = await response.json() as { source?: { name: string; size: number; objectKey: string; pages: number; words: number; headings: string[]; terms: string[]; sections: SourceSection[]; preview: string; quality: string }; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Upload failed");
      const source = data.source;
      const headings = source.headings.length ? source.headings.slice(0, 10) : ["Opening chapter", "Core ideas", "Applications and examples", "Closing reflections"];
      const chapterBudget = Math.max(4, Math.floor((project.maxPages - 8) / headings.length));
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
        chapters: headings.map((title, index) => ({ id: index + 1, title, pages: chapterBudget, status: "planned", locked: false, sourceRefs: source.sections[index] ? [source.sections[index]] : [], body: `<p class="chapter-kicker">CHAPTER ${index + 1}</p><h1>${title}</h1><p class="chapter-deck">This chapter is ready for adaptation from the uploaded source.</p>` })),
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
      const response = await fetch("/api/source", { method: "POST", headers: ownerHeaders(), body: form });
      const data = await response.json() as { source?: { name: string; size: number; objectKey: string; pages: number; words: number; headings: string[]; terms: string[]; sections: SourceSection[]; preview: string; quality: string }; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Source upload failed");
      const source = data.source;
      const next = {
        ...project,
        source: source.name,
        sourceSize: source.size,
        sourceObjectKey: source.objectKey,
        sourcePages: source.pages,
        sourceWords: source.words,
        sourceQuality: source.quality,
        sourceHeadings: source.headings,
        sourceTerms: source.terms,
        sourceSections: source.sections,
        sourcePreview: source.preview,
      };
      setProject(next);
      await persistProject(next);
      notify("Source refreshed. You can now rebuild the full chapters.");
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

  async function saveChapterBody() {
    if (!active || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, body: html, status: "draft" as const } : chapter) };
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
    patchProject({ chapters: [...project.chapters, nextChapter] });
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
    const next = { ...project, chapters: project.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, imageKey: data.image?.key, imageUrl: data.image?.url, imageCaption: chapter.imageCaption || chapter.title } : chapter) };
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
        const fallback = project.chapters.map((chapter, index) => chapterIds.includes(chapter.id) ? createChapterDraft(project, chapter, index) : chapter);
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
          aesthetic: project.aesthetic,
          illustrationStyle: project.illustrationStyle,
          imageFrequency: project.imageFrequency,
          sourceTerms: project.sourceTerms,
          chapters: project.chapters.map(({ id, title, pages, locked, body }) => ({ id, title, pages, locked, body })),
          chapterIds,
        }),
      });
      const data = await response.json() as { chapters?: Chapter[]; error?: string };
      if (!response.ok || !data.chapters) throw new Error(data.error || "Chapter drafting failed");
      const replacements = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
      const next = { ...project, chapters: project.chapters.map((chapter) => replacements.has(chapter.id) ? { ...chapter, ...replacements.get(chapter.id)! } : chapter) };
      setProject(next);
      await persistProject(next);
      notify(scope === "all" || scope === "thin" ? `${data.chapters.length} full chapters prepared and saved` : "Full chapter prepared and saved");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not prepare the chapters");
    } finally {
      setDraftBusy(false);
    }
  }

  if (view === "dashboard") return <Dashboard projects={projects} onNew={startNewBook} onOpen={(selected) => { setProject(selected); setView("editor"); setActiveChapter(selected.chapters[0]?.id ?? 1); }} onDuplicate={duplicateProject} onDelete={deleteProject} />;

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
      {view === "analysis" && <Analysis project={project} onPatch={patchProject} onBack={() => { setView("wizard"); setWizardStep(4); }} onContinue={() => setView("brief")} />}
      {view === "brief" && <BookBrief project={project} allocated={allocatedPages} draftBusy={draftBusy} onBack={() => setView("analysis")} onUpdateChapter={updateChapter} onPrepare={prepareDraft} onContinue={() => { patchProject({ briefApproved: true }); setActiveChapter(project.chapters[0]?.id ?? 1); setView("editor"); }} />}
      {view === "editor" && <Editor project={project} active={active} activeId={activeChapter} allocated={allocatedPages} draftBusy={draftBusy} onSelect={setActiveChapter} onSaveBody={saveChapterBody} editorRef={editorRef} onAi={aiAction} onRemember={rememberPreference} onDraft={() => prepareDraft("active")} onToggleLock={() => patchProject({ chapters: project.chapters.map((chapter) => chapter.id === active?.id ? { ...chapter, locked: !chapter.locked } : chapter) })} onAddChapter={addChapter} onUploadImage={uploadChapterImage} onPatchProject={patchProject} onUpdateChapter={updateChapter} />}

      {showPreview && <Preview project={project} draftBusy={draftBusy} onFill={() => prepareDraft("thin")} onClose={() => setShowPreview(false)} onPrint={() => window.print()} />}
      {showVersions && <Versions versions={versions} onCreate={createVersion} onRestore={(snapshot) => { setProject(snapshot); setShowVersions(false); notify("Version restored"); }} onClose={() => setShowVersions(false)} />}
      {aiRequest && <AiRoundTrip request={aiRequest} onChange={(result) => setAiRequest({ ...aiRequest, result })} onClose={() => setAiRequest(null)} onApply={applyAiResult} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Dashboard({ projects, onNew, onOpen, onDuplicate, onDelete }: { projects: Project[]; onNew: () => void; onOpen: (project: Project) => void; onDuplicate: (project: Project) => void; onDelete: (project: Project) => void }) {
  return <main className="dashboard">
    <header><div className="brand"><span className="brand-mark">B</span><span><strong>IKS Book Studio</strong><small>Adapt · Design · Publish</small></span></div><button className="primary" onClick={onNew}>＋ New book</button></header>
    <section className="hero">
      <div><p className="eyebrow">YOUR AI-GUIDED EDITORIAL WORKSPACE</p><h1>Turn any source into a book<br/><em>made for its reader.</em></h1><p className="hero-copy">Upload a source, choose the audience and aesthetic, then shape every chapter in one beautiful workspace.</p><button className="hero-cta" onClick={onNew}>Start a new adaptation <span>→</span></button><small>PDF · DOCX · TXT · UP TO 100 PAGES</small></div>
      <div className="hero-books" aria-hidden="true"><div className="book back"><span>THE SOURCE</span></div><div className="book front"><span>THE ART OF</span><strong>WISE<br/>GOVERNANCE</strong><i>AN ILLUSTRATED GUIDE</i><b>✦</b></div></div>
    </section>
    <section className="library-section">
      <div className="section-title"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Continue where you left off</h2></div><span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span></div>
      <div className="project-grid">
        <button className="new-card" onClick={onNew}><b>＋</b><strong>New adaptation</strong><small>Begin with any source book</small></button>
        {projects.map((project) => <article className="project-card" key={project.id}><button className="project-open" onClick={() => onOpen(project)}><div className="mini-cover"><span>{project.chapters.length}</span><small>CHAPTERS</small></div><div><span className="status">IN EDITING</span><h3>{project.title}</h3><p>{project.source}</p><footer><span>{project.updatedAt}</span><strong>Open project →</strong></footer></div></button><div className="project-menu"><button onClick={() => onDuplicate(project)}>Duplicate</button>{project.id !== "arthashastra-sample" && <button onClick={() => onDelete(project)}>Delete</button>}</div></article>)}
      </div>
    </section>
    <section className="workflow"><div><span>01</span><b>Upload</b><small>Any source book</small></div><i>→</i><div><span>02</span><b>Shape</b><small>Audience and style</small></div><i>→</i><div><span>03</span><b>Edit</b><small>Text and visuals</small></div><i>→</i><div><span>04</span><b>Publish</b><small>PDF or editable file</small></div></section>
  </main>;
}

function Wizard({ step, project, sourceBusy, onPatch, onFile, onBack, onNext }: { step: number; project: Project; sourceBusy: boolean; onPatch: (patch: Partial<Project>) => void; onFile: (e: ChangeEvent<HTMLInputElement>) => void; onBack: () => void; onNext: () => void }) {
  return <div className="wizard-layout">
    <aside className="step-rail"><p>NEW BOOK</p>{wizardSteps.map((label, index) => <div className={index <= step ? "active" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><b>{label}</b></div>)}<blockquote>Every uploaded book starts a fresh project. Nothing is tied to Arthashastra.</blockquote></aside>
    <main className="wizard-main">
      <p className="eyebrow">STEP {step + 1} OF 5</p><h1>{["Choose the source.", "Who is the reader?", "Shape the writing.", "Choose the visual world.", "Review your brief."][step]}</h1><p className="lead">{["Upload the book you are authorised to adapt.", "The same source becomes a different book for a different reader.", "Set the voice, language and level of transformation.", "Give the whole book one consistent design direction.", "These choices guide every generated chapter and illustration."][step]}</p>
      {step === 0 && <section className="form-card"><label className={`upload ${sourceBusy ? "busy" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md" onChange={onFile} disabled={sourceBusy}/><span>{sourceBusy ? "…" : "↑"}</span><strong>{sourceBusy ? "Reading and analysing your book…" : project.source}</strong><small>{sourceBusy ? "Large PDFs can take a short while" : "Click to choose a PDF, DOCX or TXT book (maximum 30 MB)"}</small></label><div className="fields two"><label>New book title<input value={project.title} onChange={(e) => onPatch({ title: e.target.value })}/></label><label>Source book<input value={project.source} readOnly/></label></div></section>}
      {step === 1 && <section className="form-card"><div className="fields two"><label>Reader age<select value={project.audience} onChange={(e) => onPatch({ audience: e.target.value })}><option>Children (7–10)</option><option>Young readers (11–14)</option><option>Young adults (15–18)</option><option>General readers (18+)</option><option>University students</option></select></label><label>Reading level<select value={project.readingLevel} onChange={(e) => onPatch({ readingLevel: e.target.value })}><option>Very simple</option><option>Clear and accessible</option><option>Accessible academic</option><option>Advanced academic</option></select></label><label>Book type<select value={project.bookType} onChange={(e) => onPatch({ bookType: e.target.value })}><option>Illustrated learning book</option><option>Children’s story</option><option>Popular non-fiction</option><option>Academic guide</option><option>Training manual</option></select></label><label>Maximum pages <b>{project.maxPages}</b><input type="range" min="10" max="100" value={project.maxPages} onChange={(e) => onPatch({ maxPages: Number(e.target.value) })}/></label></div></section>}
      {step === 2 && <section className="form-card"><div className="fields two"><label>Writing tone<select value={project.tone} onChange={(e) => onPatch({ tone: e.target.value })}><option>Clear and engaging</option><option>Warm and conversational</option><option>Story-led</option><option>Formal and academic</option></select></label><label>Language<select value={project.language} onChange={(e) => onPatch({ language: e.target.value })}><option>English</option><option>Hindi</option><option>English + Hindi</option></select></label><label>Source notes<select value={project.citationStyle} onChange={(e) => onPatch({ citationStyle: e.target.value })}><option>Source page notes</option><option>Numbered endnotes</option><option>APA references</option><option>No visible citations</option></select></label><label>Learning features<select value={project.learningFeatures.join(", ")} onChange={(e) => onPatch({ learningFeatures: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}><option>Key takeaways, Glossary</option><option>Learning objectives, Exercises, Key takeaways</option><option>Case studies, Discussion questions</option><option>None</option></select></label><label className="wide">Adaptation style<select value={project.adaptation} onChange={(e) => onPatch({ adaptation: e.target.value })}><option>Faithful, reader-friendly adaptation</option><option>Concise illustrated summary</option><option>Creative reinterpretation</option><option>Teaching-focused adaptation</option></select></label></div></section>}
      {step === 3 && <section className="form-card"><div className="theme-grid">{["Classical Indian", "Modern academic", "Minimal editorial", "Warm children’s"].map((theme) => <button className={project.aesthetic === theme ? "selected" : ""} onClick={() => onPatch({ aesthetic: theme })} key={theme}><i/><i/><i/><strong>{theme}</strong></button>)}</div><div className="fields two"><label>Illustration style<select value={project.illustrationStyle} onChange={(e) => onPatch({ illustrationStyle: e.target.value })}><option>Editorial watercolour</option><option>Historical ink drawing</option><option>Modern flat illustration</option><option>Playful children’s art</option><option>Documentary photography</option></select></label><label>Typography<select value={project.fontTheme} onChange={(e) => onPatch({ fontTheme: e.target.value })}><option>Literary serif</option><option>Modern sans-serif</option><option>Academic classic</option><option>Friendly rounded</option></select></label><label className="wide">Illustration frequency<select value={project.imageFrequency} onChange={(e) => onPatch({ imageFrequency: e.target.value })}><option>Low — 1 per chapter</option><option>Medium — 1 per 3 pages</option><option>High — 1 per page</option></select></label></div></section>}
      {step === 4 && <section className="brief-review"><div><span>SOURCE</span><strong>{project.source}</strong></div><div><span>READER</span><strong>{project.audience}</strong></div><div><span>BOOK</span><strong>{project.bookType}</strong></div><div><span>VOICE</span><strong>{project.tone}</strong></div><div><span>DESIGN</span><strong>{project.aesthetic} · {project.illustrationStyle}</strong></div><div><span>LIMIT</span><strong>{project.maxPages} pages</strong></div></section>}
      <footer className="wizard-footer"><button className="secondary" onClick={onBack}>← Back</button><button className="primary" onClick={onNext} disabled={sourceBusy || (step === 0 && project.source === "No source selected")}>{step === 4 ? "Review source analysis" : "Continue"} →</button></footer>
    </main>
  </div>;
}

function Analysis({ project, onPatch, onBack, onContinue }: { project: Project; onPatch: (patch: Partial<Project>) => void; onBack: () => void; onContinue: () => void }) {
  const headings = project.sourceHeadings.length ? project.sourceHeadings : ["Opening chapter"];
  const renameHeading = (index: number, title: string) => onPatch({
    sourceHeadings: headings.map((heading, headingIndex) => headingIndex === index ? title : heading),
    chapters: project.chapters.map((chapter, chapterIndex) => chapterIndex === index ? { ...chapter, title } : chapter),
  });
  return <main className="analysis-page"><button className="text-button" onClick={onBack}>← Change setup</button><p className="eyebrow">SOURCE ANALYSIS</p><h1>Your source is ready.</h1><p className="lead">Review the structure detected from this uploaded book before building the new book plan.</p><section className="stats"><div><span>PAGES</span><strong>{project.sourcePages || "—"}</strong></div><div><span>WORDS</span><strong>{project.sourceWords ? project.sourceWords.toLocaleString() : "Pending"}</strong></div><div><span>QUALITY</span><strong>{project.sourceQuality}</strong></div><div><span>OUTPUT LIMIT</span><strong>{project.maxPages}</strong></div></section><div className="analysis-grid"><section className="analysis-card"><header><div><p className="eyebrow">DETECTED OUTLINE</p><h2>{headings.length} chapter candidates</h2></div><span className="good">✓ Reviewable</span></header>{headings.map((heading, index) => <div className="heading-row" key={`${index}-${heading}`}><span>{String(index + 1).padStart(2, "0")}</span><input value={heading} onChange={(event) => renameHeading(index, event.target.value)}/></div>)}</section><aside><div className="analysis-card"><p className="eyebrow">KEY TERMS</p><div className="tags">{(project.sourceTerms.length ? project.sourceTerms : ["analysis pending"]).map((term) => <span key={term}>{term}</span>)}</div></div><div className="analysis-card note"><p className="eyebrow">FRESH FOR EVERY BOOK</p><p>This analysis belongs only to <strong>{project.source}</strong>. Uploading another source begins again.</p></div></aside></div><footer className="analysis-footer"><span>You can rename any detected chapter now or later.</span><button className="primary" onClick={onContinue}>Build book plan →</button></footer></main>;
}

function BookBrief({ project, allocated, draftBusy, onBack, onUpdateChapter, onPrepare, onContinue }: { project: Project; allocated: number; draftBusy: boolean; onBack: () => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void; onPrepare: (scope: "sample" | "all" | "active") => void; onContinue: () => void }) {
  const drafted = project.chapters.filter((chapter) => chapter.status !== "planned").length;
  const first = project.chapters[0];
  const overBudget = allocated > project.maxPages;
  return <main className="brief-page">
    <button className="text-button" onClick={onBack}>← Back to source analysis</button>
    <header className="brief-hero"><div><p className="eyebrow">BOOK BRIEF & PAGE PLAN</p><h1>{project.title}</h1><p className="lead">A {project.bookType.toLowerCase()} for {project.audience.toLowerCase()}, adapted in a {project.tone.toLowerCase()} voice with a {project.aesthetic.toLowerCase()} visual direction.</p><div className="brief-chips"><span>{project.language}</span><span>{project.adaptation}</span><span>{project.imageFrequency}</span></div></div><aside><span>READER PROMISE</span><p>Make the source understandable, visually inviting and faithful enough for an editor to verify every important idea.</p></aside></header>
    <div className="brief-layout"><section className="plan-card"><header><div><p className="eyebrow">STRUCTURE</p><h2>Chapter and page plan</h2></div><div className={overBudget ? "budget-pill warning" : "budget-pill"}>{allocated} / {project.maxPages} pages</div></header><div className="plan-head"><span>CHAPTER</span><span>TITLE</span><span>PAGES</span><span>STATE</span></div>{project.chapters.map((chapter, index) => <div className="plan-row" key={chapter.id}><span>{String(index + 1).padStart(2, "0")}</span><input value={chapter.title} onChange={(event) => onUpdateChapter(chapter.id, { title: event.target.value })}/><input aria-label={`Pages for ${chapter.title}`} type="number" min="2" max="30" value={chapter.pages} onChange={(event) => onUpdateChapter(chapter.id, { pages: Math.max(2, Number(event.target.value) || 2) })}/><b className={`draft-state ${chapter.status}`}>{chapter.status}</b></div>)}<footer><span>Includes 8 reserved pages for cover, contents, preface and references.</span>{overBudget && <strong>Reduce {allocated - project.maxPages} pages before approval.</strong>}</footer></section>
      <aside className="generation-card"><p className="eyebrow">FULL CHAPTER BUILDER</p><h2>Prepare the manuscript</h2><p>Build substantial editable chapters from multiple relevant passages in the uploaded source. Page markers and source evidence are added automatically. Locked chapters are never overwritten.</p><div className="draft-progress"><span><b>{drafted}</b> of {project.chapters.length} drafted</span><i><b style={{ width: `${project.chapters.length ? drafted / project.chapters.length * 100 : 0}%` }}/></i></div><button className="secondary full" disabled={draftBusy} onClick={() => onPrepare("sample")}>{draftBusy ? "Reading the source…" : "Build full sample chapter"}</button><button className="primary full" disabled={draftBusy} onClick={() => onPrepare("all")}>{draftBusy ? "Building full chapters…" : "Build all full chapters"}</button><small>This source-grounded builder works without an AI key. Use the editorial assistant afterward when you want stylistic rewriting.</small></aside></div>
    {first && <section className="sample-spread"><div className="sample-copy"><p className="eyebrow">SAMPLE SPREAD</p><span>CHAPTER 01</span><h2>{first.title}</h2><p>{first.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 420)}</p><button className="text-button" onClick={() => onPrepare("sample")}>{first.status === "planned" ? "Create this sample" : "Refresh sample draft"} →</button></div>{first.imageUrl ? <figure className="sample-art sample-art-image"><img src={first.imageUrl} alt={curatedIllustration(first.title)?.alt || first.imageCaption || first.title}/><figcaption>{first.imageCaption || first.title}</figcaption></figure> : <div className="sample-art"><span>ILLUSTRATION DIRECTION</span><strong>{project.aesthetic}</strong><p>{first.title} · {project.imageFrequency}</p><b>✦</b></div>}</section>}
    <footer className="brief-actions"><div><b>{overBudget ? "Page plan needs attention" : "Ready for editorial review"}</b><span>{drafted ? `${drafted} chapter draft${drafted === 1 ? "" : "s"} prepared` : "Prepare at least one chapter now, or begin with a blank structure."}</span></div><button className="primary" disabled={overBudget} onClick={onContinue}>Approve brief & open studio →</button></footer>
  </main>;
}

function Editor({ project, active, activeId, allocated, draftBusy, onSelect, editorRef, onSaveBody, onAi, onRemember, onDraft, onToggleLock, onAddChapter, onUploadImage, onPatchProject, onUpdateChapter }: { project: Project; active?: Chapter; activeId: number; allocated: number; draftBusy: boolean; onSelect: (id: number) => void; editorRef: React.RefObject<HTMLDivElement | null>; onSaveBody: () => void; onAi: (action: string) => void; onRemember: (scope: "book" | "designer") => void; onDraft: () => void; onToggleLock: () => void; onAddChapter: () => void; onUploadImage: (file: File) => void; onPatchProject: (patch: Partial<Project>) => void; onUpdateChapter: (id: number, patch: Partial<Chapter>) => void }) {
  const [tab, setTab] = useState<"ai" | "design" | "sources">("ai");
  if (!active) return null;
  const fontClass = project.fontTheme.toLowerCase().replace(/[^a-z]+/g, "-");
  return <main className="editor-layout">
    <aside className="chapters"><header><p className="eyebrow">BOOK STRUCTURE</p><button onClick={onAddChapter} aria-label="Add chapter">＋</button></header><div className="front-matter"><span>FM</span><div><b>Front matter</b><small>Cover · Contents · Preface</small></div></div>{project.chapters.map((chapter) => <button className={chapter.id === activeId ? "chapter active" : "chapter"} onClick={() => onSelect(chapter.id)} key={chapter.id}><span>{String(chapter.id).padStart(2, "0")}</span><div><b>{chapter.title}</b><small>{chapter.pages} pages · {chapter.status}</small></div><i>{chapter.locked ? "◆" : ""}</i></button>)}<div className="page-budget"><span><b>{allocated}</b> / {project.maxPages} pages</span><i><b style={{ width: `${Math.min(100, allocated / project.maxPages * 100)}%` }}/></i><small>{Math.max(0, project.maxPages - allocated)} pages available</small></div></aside>
    <section className="canvas"><nav className="editor-tools"><div><button onClick={() => document.execCommand("bold")}><b>B</b></button><button onClick={() => document.execCommand("italic")}><i>I</i></button><button onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</button><button onClick={() => document.execCommand("insertUnorderedList")}>• List</button></div><div className="chapter-meter"><span>{active.pages} target pages</span><i><b style={{ width: active.status === "planned" ? "18%" : "67%" }}/></i><button onClick={onToggleLock}>{active.locked ? "◆ Locked" : "◇ Lock"}</button></div></nav><div className="page-stage"><article className={`paper font-${fontClass}${active.imageUrl ? " has-chapter-image" : ""}`}><header><span>{project.title}</span><span>{project.aesthetic}</span></header><div className="ornament">✦</div><div key={active.id} ref={editorRef} className="book-copy" contentEditable={!active.locked} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: active.body }}/>{active.imageUrl && <figure className="chapter-image"><img src={active.imageUrl} alt={curatedIllustration(active.title)?.alt || active.imageCaption || active.title}/><figcaption>{active.imageCaption || active.title}</figcaption></figure>}<footer><span>{project.source}</span><span>{active.id}</span></footer></article></div><button className="save-float" onClick={onSaveBody}>✓ Save chapter</button></section>
    <aside className="assistant"><nav><button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>✦<span>AI EDIT</span></button><button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>◈<span>DESIGN</span></button><button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>⌕<span>SOURCES</span></button></nav><div className="assistant-body">
      {tab === "ai" && <><div className="assistant-title"><span>✦</span><div><b>Editorial assistant</b><small>Select text, then choose an action.</small></div></div>{!active.locked && <button className="draft-chapter-button" disabled={draftBusy} onClick={onDraft}>{draftBusy ? "Reading the source…" : chapterWordCount(active) < 350 ? "✦ Build this full chapter" : "↻ Rebuild full chapter from source"}</button>}<p className="selection-tip">This chapter has <b>{chapterWordCount(active).toLocaleString()} words</b>. The full chapter builder uses the uploaded source; the guided edit actions can then refine the writing in ChatGPT.</p><div className="ai-list">{["Simplify language", "Shorten selection", "Expand with examples", "Make age-appropriate", "Improve storytelling", "Check against source", "Suggest an illustration"].map((action) => <button onClick={() => onAi(action)} key={action}><span>✦</span>{action}<i>→</i></button>)}</div><div className="memory-box"><p className="eyebrow">EDITORIAL MEMORY</p><p>{project.editorialPreferences.length ? project.editorialPreferences.join(" · ") : "No saved preferences yet"}</p><button onClick={() => onRemember("book")}>＋ Remember for this book</button><button onClick={() => onRemember("designer")}>＋ Remember for future books</button></div></>}
      {tab === "design" && <><div className="assistant-title"><span>◈</span><div><b>Book design</b><small>Changes update the current project.</small></div></div><div className="design-controls"><label>Aesthetic<select value={project.aesthetic} onChange={(e) => onPatchProject({ aesthetic: e.target.value })}><option>Classical Indian</option><option>Modern academic</option><option>Minimal editorial</option><option>Warm children’s</option></select></label><label>Typography<select value={project.fontTheme} onChange={(e) => onPatchProject({ fontTheme: e.target.value })}><option>Literary serif</option><option>Modern sans-serif</option><option>Academic classic</option><option>Friendly rounded</option></select></label><label>Illustration style<select value={project.illustrationStyle} onChange={(e) => onPatchProject({ illustrationStyle: e.target.value })}><option>Editorial watercolour</option><option>Historical ink drawing</option><option>Modern flat illustration</option><option>Playful children’s art</option><option>Documentary photography</option></select></label><label className="image-upload">Add chapter image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && onUploadImage(e.target.files[0])}/></label>{active.imageUrl && <label>Image caption<input value={active.imageCaption || ""} onChange={(e) => onUpdateChapter(active.id, { imageCaption: e.target.value })}/></label>}</div></>}
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

function Preview({ project, draftBusy, onFill, onClose, onPrint }: { project: Project; draftBusy: boolean; onFill: () => void; onClose: () => void; onPrint: () => void }) {
  const thinChapters = project.chapters.filter((chapter) => chapterWordCount(chapter) < 350 && !chapter.locked);
  const printable = useMemo(() => printableChapters(project.chapters), [project.chapters]);
  return <div className="modal-backdrop"><section className="preview-modal"><header><div><p className="eyebrow">FINAL BOOK PREVIEW</p><h2>{project.title}</h2></div><div>{thinChapters.length > 0 && <button className="fill-chapters" disabled={draftBusy} onClick={onFill}>{draftBusy ? "Building chapters…" : `Fill ${thinChapters.length} short chapter${thinChapters.length === 1 ? "" : "s"}`}</button>}<button onClick={onPrint}>Print / Save PDF</button><button onClick={onClose}>×</button></div></header>{(thinChapters.length > 0 || printable.duplicatesRemoved > 0) && <div className="preview-warning"><b>{thinChapters.length > 0 ? `${thinChapters.length} chapter${thinChapters.length === 1 ? " is" : "s are"} still too short.` : "Repeated content repaired."}</b><span>{printable.duplicatesRemoved > 0 ? `${printable.duplicatesRemoved} repeated paragraph${printable.duplicatesRemoved === 1 ? " was" : "s were"} omitted from this preview and PDF.` : "Fill the short chapters from the uploaded source before exporting."}</span></div>}<div className="preview-scroll"><article className="preview-cover"><p>{project.bookType}</p><h1>{project.title}</h1><span>Adapted from {project.source}</span><b>✦</b></article><article className="preview-page contents-page"><span>CONTENTS</span><h2>Inside this book</h2><ol>{printable.chapters.map((chapter, index) => <li key={chapter.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{chapter.title}</span><i>{chapter.pages} pages</i></li>)}</ol></article>{printable.chapters.map((chapter) => <article className={`preview-page chapter-preview${chapter.imageUrl ? " has-chapter-image" : ""}`} key={chapter.id}><header className="print-chapter-header"><span>CHAPTER {chapter.id}</span><span>{chapterWordCount(chapter).toLocaleString()} WORDS</span></header><h2>{chapter.title}</h2><div className="preview-body" dangerouslySetInnerHTML={{ __html: chapter.body }}/>{chapter.imageUrl && <figure className="chapter-image"><img src={chapter.imageUrl} alt={curatedIllustration(chapter.title)?.alt || chapter.imageCaption || chapter.title}/><figcaption>{chapter.imageCaption || chapter.title}</figcaption></figure>}{chapter.sourceRefs.length > 0 && <div className="preview-sources"><b>SOURCE NOTES</b>{chapter.sourceRefs.map((ref, index) => <p key={`${ref.title}-${index}`}>{ref.title}, p. {ref.page || "—"}</p>)}</div>}</article>)}<article className="preview-page backmatter"><span>EDITORIAL NOTES</span><h2>References and production brief</h2><p>Adapted from <b>{project.source}</b>. Citation approach: {project.citationStyle}.</p><p>Designed in the {project.aesthetic.toLowerCase()} aesthetic with {project.illustrationStyle.toLowerCase()} visuals.</p><h3>Remembered editorial decisions</h3><ul>{project.editorialPreferences.map((preference) => <li key={preference}>{preference}</li>)}</ul></article></div></section></div>;
}

function Versions({ versions, onCreate, onRestore, onClose }: { versions: { label: string; date: string; snapshot: Project }[]; onCreate: () => void; onRestore: (project: Project) => void; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="versions-modal"><header><div><p className="eyebrow">VERSION HISTORY</p><h2>Editorial checkpoints</h2></div><button onClick={onClose}>×</button></header><button className="primary full" onClick={onCreate}>＋ Create checkpoint</button>{versions.length === 0 ? <p className="empty">No checkpoints yet. Create one before a major edit.</p> : versions.map((version) => <div className="version" key={version.date}><span>↺</span><div><b>{version.label}</b><small>{version.date}</small></div><button onClick={() => onRestore(version.snapshot)}>Restore</button></div>)}</section></div>;
}
