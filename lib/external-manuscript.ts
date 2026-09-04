import { authorialReaderHtml, readerFacingChapterTitle } from "./child-summary.ts";
import { readerSafeImageCaption } from "./publication.ts";

export type ExternalManuscriptSettings = {
  title: string;
  sourceName: string;
  audience: string;
  readingLevel: string;
  language: string;
  bookType: string;
  aesthetic: string;
  illustrationStyle: string;
  learningFeatures: string[];
};

export type ExternalManuscriptSection = {
  kind: "introduction" | "chapter" | "conclusion" | "glossary" | "appendix";
  title: string;
  raw: string;
  html: string;
  wordCount: number;
  illustrationBrief?: string;
  issues: string[];
};

export type ExternalManuscriptResult = {
  title: string;
  sections: ExternalManuscriptSection[];
  issues: string[];
  words: number;
};

export type ExternalIllustrationSlot = {
  id: string;
  role: "cover" | "chapter";
  chapterId?: number;
  chapterTitle: string;
  filename: string;
  sceneBrief: string;
  altText: string;
  caption: string;
  imageIndex: number;
  placement: "cover" | "after-opening" | "chapter-middle" | "before-reflection";
  status: "pending" | "ready" | "missing" | "failed" | "skipped";
  imageKey?: string;
  imageUrl?: string;
  sourcePath?: string;
  error?: string;
};

export type ExternalIllustrationPromptProject = ExternalManuscriptSettings & {
  chapters: Array<{ id: number; title: string; body: string; context?: string }>;
  slots: ExternalIllustrationSlot[];
};

export type ExternalIllustrationArchiveEntry = {
  path: string;
  bytes: Uint8Array;
};

export type ExternalIllustrationArchiveMatch = {
  slotId: string;
  sourcePath?: string;
  bytes?: Uint8Array;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  error?: string;
};

export type ExternalIllustrationArchiveResult = {
  matches: ExternalIllustrationArchiveMatch[];
  issues: string[];
};

export type ExternalPlacedReaderPage = {
  body: string;
  illustrationSlotId?: string;
  imageKey?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
};

function cleanLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function words(value: string) {
  return value.replace(/[#*_>`~-]/g, " ").match(/[\p{L}\p{N}’'-]+/gu) ?? [];
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function manuscriptMarkdownToHtml(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    output.push(`</${list}>`);
    list = null;
  };
  for (const sourceLine of lines) {
    const line = cleanLine(sourceLine);
    if (!line) { flushParagraph(); closeList(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(3, heading[1].length + 1);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextList = bullet ? "ul" : "ol";
      if (list !== nextList) { closeList(); list = nextList; output.push(`<${list}>`); }
      output.push(`<li>${inlineMarkdown((bullet || numbered)![1])}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  return output.join("");
}

function sectionKind(label: string): ExternalManuscriptSection["kind"] {
  if (/^introduction\b/i.test(label)) return "introduction";
  if (/^conclusion\b/i.test(label)) return "conclusion";
  if (/^glossary\b/i.test(label)) return "glossary";
  if (/^(appendix|activities|references)\b/i.test(label)) return "appendix";
  return "chapter";
}

function sectionTitle(label: string, kind: ExternalManuscriptSection["kind"]) {
  if (kind !== "chapter") return cleanLine(label.replace(/^\d+[.:\s-]*/, ""));
  const title = label.replace(/^chapter\s*(?:\d+|[ivxlcdm]+)?\s*[:.\-–—]?\s*/i, "").trim();
  return title || "Untitled chapter";
}

function removePrivateProductionTail(raw: string) {
  const heading = /^#{1,6}\s*(?:MANUSCRIPT FILE MANIFEST|PACKAGE MANIFEST|DELIVERY MANIFEST|MANUSCRIPT PACKAGE NOTES?)\b.*$/im;
  const match = heading.exec(raw);
  if (!match) return { reader: raw, removedPrivateMetadata: false };
  return { reader: raw.slice(0, match.index).trim(), removedPrivateMetadata: true };
}

function separatePrivateSections(raw: string) {
  const production = removePrivateProductionTail(raw);
  const privateHeading = /^##+\s*(ILLUSTRATION BRIEF|SOURCE COVERAGE NOTES?|PRIVATE SOURCE NOTES?)\s*$/im;
  const match = privateHeading.exec(production.reader);
  if (!match) return { reader: production.reader.trim(), illustrationBrief: undefined, removedPrivateMetadata: production.removedPrivateMetadata };
  const reader = production.reader.slice(0, match.index).trim();
  const tail = production.reader.slice(match.index);
  const nextHeading = tail.slice(match[0].length).search(/^##+\s+/m);
  const privateBody = nextHeading >= 0 ? tail.slice(match[0].length, match[0].length + nextHeading) : tail.slice(match[0].length);
  return { reader, illustrationBrief: /illustration/i.test(match[1]) ? cleanLine(privateBody.replace(/\n+/g, " ")) : undefined, removedPrivateMetadata: production.removedPrivateMetadata };
}

function minimumWords(audience: string) {
  if (/7.?9/.test(audience)) return 260;
  if (/13.?15/.test(audience)) return 440;
  return 340;
}

export function parseExternalManuscript(value: string, audience: string): ExternalManuscriptResult {
  const normalized = value.replace(/\r\n?/g, "\n").replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const titleMatch = normalized.match(/^#\s+(?!INTRODUCTION|CHAPTER|CONCLUSION|GLOSSARY|APPENDIX)(.+)$/im);
  const title = cleanLine(titleMatch?.[1] || "Imported book");
  const boundary = /^#{1,2}\s*((?:INTRODUCTION|CHAPTER\s*(?:\d+|[IVXLCDM]+)\s*[:.\-–—]?[^\n]*|CONCLUSION[^\n]*|GLOSSARY[^\n]*|APPENDIX[^\n]*|ACTIVITIES[^\n]*|REFERENCES[^\n]*))\s*$/gim;
  const matches = [...normalized.matchAll(boundary)];
  let removedPrivateMetadata = false;
  const sections: ExternalManuscriptSection[] = matches.map((match, index) => {
    const label = cleanLine(match[1]);
    const kind = sectionKind(label);
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const privateSplit = separatePrivateSections(normalized.slice(start, end));
    removedPrivateMetadata ||= privateSplit.removedPrivateMetadata;
    const readerHtml = authorialReaderHtml(manuscriptMarkdownToHtml(privateSplit.reader));
    const wordCount = words(readerHtml.replace(/<[^>]+>/g, " ")).length;
    const issues: string[] = [];
    if (wordCount < (kind === "chapter" ? minimumWords(audience) : 90)) issues.push(`${kind === "chapter" ? "Chapter" : "Section"} is short (${wordCount} words).`);
    if (kind === "chapter") {
      const opening = privateSplit.reader.split(/^##+\s+/m)[0];
      if (words(opening).length < 35 && !/^##+\s*IN THIS CHAPTER\b/im.test(privateSplit.reader)) issues.push("Missing a substantial narrative opening before the recurring learning blocks.");
      if (!/^##+\s*(KEY TERMS|WORD HELPER|GLOSSARY)\b/im.test(privateSplit.reader)) issues.push("Missing key-term explanation.");
      if (!/^##+\s*(ACTIVITY|TRY IT|THINK ABOUT IT|REFLECT|CHECK YOUR UNDERSTANDING)\b/im.test(privateSplit.reader)) issues.push("Missing activity or comprehension check.");
      const repeatedChapterOpenings = (privateSplit.reader.match(/(?:^|[.!?]\s+)this chapter\b/gim) ?? []).length;
      if (repeatedChapterOpenings > 1) issues.push(`Mechanical “This chapter…” wording repeats ${repeatedChapterOpenings} times.`);
      if (/\b(?:this|the) adaptation\b|\breader-facing\b|\bavoiding claims (?:that|which)\b/i.test(privateSplit.reader)) issues.push("Editorial adaptation commentary was removed from reader-facing prose.");
    }
    return { kind, title: readerFacingChapterTitle(sectionTitle(label, kind)), raw: privateSplit.reader, html: readerHtml, wordCount, illustrationBrief: privateSplit.illustrationBrief, issues };
  });
  const issues: string[] = [];
  if (removedPrivateMetadata) issues.push("Private production metadata was removed from the reader-facing manuscript.");
  if (!sections.some((section) => section.kind === "introduction")) issues.push("Introduction is missing.");
  if (!sections.some((section) => section.kind === "chapter")) issues.push("No chapter headings were detected. Use headings such as # CHAPTER 01: Title.");
  if (!sections.some((section) => section.kind === "conclusion")) issues.push("Conclusion is missing.");
  if (sections.filter((section) => section.kind === "chapter").length !== new Set(sections.filter((section) => section.kind === "chapter").map((section) => section.title.toLowerCase())).size) issues.push("Two or more chapters have the same title.");
  return { title, sections, issues, words: sections.reduce((sum, section) => sum + section.wordCount, 0) };
}

function illustrationSceneBrief(section: ExternalManuscriptSection, imageIndex: number, imageCount: number) {
  const placementFocus = imageCount === 1 || imageIndex === 1 ? "the opening situation and central question" : imageIndex === imageCount ? "the chapter’s later application or reflective turning point" : "a distinct middle-chapter action that develops the idea";
  const plain = cleanLine(section.html.replace(/<[^>]+>/g, " ").replace(/[#*_>`~-]/g, " "));
  const start = Math.max(0, Math.round((plain.length - 700) * ((imageIndex - 1) / Math.max(1, imageCount - 1))));
  const context = plain.slice(start, start + 700);
  const supplied = imageIndex === 1 ? section.illustrationBrief : undefined;
  return supplied || `Create image ${imageIndex} of ${imageCount} for “${section.title}”, focusing on ${placementFocus}. Show a specific narrative moment with real people, a believable place, purposeful action, relevant objects, a clear focal point and meaningful background details grounded in this passage: ${context}`;
}

export function createExternalIllustrationSlots(result: ExternalManuscriptResult, fallbackTitle: string): ExternalIllustrationSlot[] {
  return [
    {
      id: "COVER",
      role: "cover",
      chapterTitle: "Front cover",
      filename: "images/cover.jpg",
      sceneBrief: `A richly rendered portrait cover that introduces ${result.title || fallbackTitle} through a specific setting, human-scale action and culturally grounded details. No text inside the image.`,
      altText: `Front-cover illustration for ${result.title || fallbackTitle}`,
      caption: "Front cover",
      imageIndex: 1,
      placement: "cover",
      status: "pending",
    },
    ...result.sections.flatMap((section, sectionIndex) => {
      if (!(["introduction", "chapter", "conclusion"] as ExternalManuscriptSection["kind"][]).includes(section.kind)) return [];
      const imageCount = 1;
      const placements = ["chapter-middle"];
      return Array.from({ length: imageCount }, (_, imageIndex) => {
        const slotId = `CH-${String(sectionIndex + 1).padStart(2, "0")}-IMG-${String(imageIndex + 1).padStart(2, "0")}`;
        const placement = placements[imageIndex] as ExternalIllustrationSlot["placement"];
        return {
          id: slotId,
          role: "chapter" as const,
          chapterId: sectionIndex + 1,
          chapterTitle: section.title,
          filename: `images/${slotId}.jpg`,
          sceneBrief: illustrationSceneBrief(section, imageIndex + 1, imageCount),
          altText: `Narrative illustration ${imageIndex + 1} for ${section.title}`,
          // The supplied illustration brief is private production input. Keep
          // it in sceneBrief and give the printed book a short reader caption.
          caption: section.title,
          imageIndex: imageIndex + 1,
          placement,
          status: "pending" as const,
        };
      });
    }),
  ];
}

export function upgradeExternalIllustrationSlots(
  chapters: Array<{ id: number; title: string; body?: string; wordCount?: number }>,
  existingSlots: ExternalIllustrationSlot[],
) {
  const cover = existingSlots.find((slot) => slot.role === "cover");
  const upgraded: ExternalIllustrationSlot[] = cover ? [{
    ...cover,
    caption: readerSafeImageCaption(cover.caption, "Front cover"),
    altText: readerSafeImageCaption(cover.altText, "Front-cover illustration"),
    imageIndex: cover.imageIndex || 1,
    placement: "cover",
  }] : [];
  for (const chapter of chapters) {
    if (/^(?:glossary|appendix|activities|references|bibliography|index)\b/i.test(chapter.title.trim())) continue;
    const existing = existingSlots.filter((slot) => slot.role === "chapter" && slot.chapterId === chapter.id).sort((left, right) => (left.imageIndex || 1) - (right.imageIndex || 1));
    const plain = cleanLine((chapter.body || "").replace(/<[^>]+>/g, " "));
    const approvedExtras = existing.slice(1).filter((slot) => slot.status === "ready" && slot.imageUrl);
    const imageCount = 1 + approvedExtras.length;
    const placements = imageCount === 1 ? ["chapter-middle"] : imageCount === 2 ? ["after-opening", "before-reflection"] : ["after-opening", "chapter-middle", "before-reflection"];
    const retained = existing.length ? [existing[0], ...approvedExtras] : [];
    const prefix = retained[0]?.id.match(/^(CH-\d+)-IMG-/i)?.[1] || `CH-${String(chapter.id).padStart(2, "0")}`;
    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const prior = retained[imageIndex];
      const id = `${prefix}-IMG-${String(imageIndex + 1).padStart(2, "0")}`;
      const placement = placements[imageIndex] as ExternalIllustrationSlot["placement"];
      const start = Math.max(0, Math.round((plain.length - 700) * (imageIndex / Math.max(1, imageCount - 1))));
      upgraded.push(prior ? {
        ...prior,
        caption: readerSafeImageCaption(prior.caption, chapter.title),
        altText: readerSafeImageCaption(prior.altText, `Illustration for ${chapter.title}`),
        id,
        imageIndex: imageIndex + 1,
        placement,
      } : {
        id,
        role: "chapter",
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        filename: `images/${id}.jpg`,
        sceneBrief: `Create image ${imageIndex + 1} of ${imageCount} for “${chapter.title}”, showing a distinct text-grounded narrative moment for the ${placement.replace(/-/g, " ")} position: ${plain.slice(start, start + 700)}`,
        altText: `Narrative illustration ${imageIndex + 1} for ${chapter.title}`,
        caption: chapter.title,
        imageIndex: imageIndex + 1,
        placement,
        status: "pending",
      });
    }
  }
  return upgraded;
}

export function assignIllustrationsToReaderPages(textPages: string[], slots: ExternalIllustrationSlot[]): ExternalPlacedReaderPage[] {
  const bodies = textPages.length ? textPages : [""];
  const buckets = new Map<number, ExternalIllustrationSlot[]>();
  const pageIndexFor = (placement: ExternalIllustrationSlot["placement"]) => {
    if (placement === "after-opening") return 0;
    if (placement === "before-reflection") return bodies.length - 1;
    return Math.floor((bodies.length - 1) / 2);
  };
  for (const slot of slots.filter((item) => item.role === "chapter" && item.status === "ready" && item.imageUrl).sort((left, right) => (left.imageIndex || 1) - (right.imageIndex || 1))) {
    const target = pageIndexFor(slot.placement || "chapter-middle");
    buckets.set(target, [...(buckets.get(target) ?? []), slot]);
  }
  return bodies.flatMap((body, pageIndex) => {
    const illustrations = buckets.get(pageIndex) ?? [];
    if (!illustrations.length) return [{ body }];
    return illustrations.map((slot, illustrationIndex) => ({
      body: illustrationIndex === 0 ? body : "",
      illustrationSlotId: slot.id,
      imageKey: slot.imageKey,
      imageUrl: slot.imageUrl,
      imageCaption: readerSafeImageCaption(slot.caption, slot.chapterTitle),
      imageAlt: readerSafeImageCaption(slot.altText, `Illustration for ${slot.chapterTitle}`),
    }));
  });
}

function normalizedArchivePath(value: string) {
  const path = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("\0") || /(^|\/)\.\.(\/|$)/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path)) return "";
  return path.replace(/\/{2,}/g, "/");
}

function rasterMimeType(bytes: Uint8Array): ExternalIllustrationArchiveMatch["mimeType"] | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return undefined;
}

export function matchExternalIllustrationArchive(entries: ExternalIllustrationArchiveEntry[], slots: ExternalIllustrationSlot[]): ExternalIllustrationArchiveResult {
  if (entries.length > 100) return { matches: slots.map((slot) => ({ slotId: slot.id, error: "Archive contains too many files" })), issues: ["The ZIP contains too many files (maximum 100)."] };
  const unpackedBytes = entries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0);
  if (unpackedBytes > 100 * 1024 * 1024) return { matches: slots.map((slot) => ({ slotId: slot.id, error: "Archive exceeds safe unpacked size" })), issues: ["The unpacked ZIP is larger than the safe 100 MB limit."] };

  const safeEntries = entries.flatMap((entry) => {
    const path = normalizedArchivePath(entry.path);
    return path && !path.startsWith("__MACOSX/") && !path.endsWith("/") ? [{ ...entry, path }] : [];
  });
  const issues: string[] = entries.length === safeEntries.length ? [] : ["Unsafe or system ZIP paths were ignored."];
  const used = new Set<string>();
  const matches = slots.map((slot): ExternalIllustrationArchiveMatch => {
    const expectedStem = normalizedArchivePath(slot.filename).replace(/\.(?:jpe?g|png|webp)$/i, "").toLowerCase();
    const candidates = safeEntries.filter((entry) => /\.(?:jpe?g|png|webp)$/i.test(entry.path) && entry.path.replace(/\.(?:jpe?g|png|webp)$/i, "").toLowerCase() === expectedStem);
    if (!candidates.length) return { slotId: slot.id, error: `Missing ${slot.filename}` };
    if (candidates.length > 1) return { slotId: slot.id, error: `More than one file matches ${slot.filename}` };
    const entry = candidates[0];
    used.add(entry.path);
    if (entry.bytes.byteLength > 10 * 1024 * 1024) return { slotId: slot.id, sourcePath: entry.path, error: "Image is larger than 10 MB" };
    const mimeType = rasterMimeType(entry.bytes);
    if (!mimeType) return { slotId: slot.id, sourcePath: entry.path, error: "File extension says image, but its contents are not a supported JPG, PNG or WebP image" };
    return { slotId: slot.id, sourcePath: entry.path, bytes: entry.bytes, mimeType };
  });

  for (const entry of safeEntries) {
    if (/\.svg$/i.test(entry.path)) issues.push(`SVG rejected: ${entry.path}`);
    else if (/\.(?:jpe?g|png|webp)$/i.test(entry.path) && !used.has(entry.path)) issues.push(`Unused file ignored: ${entry.path}`);
  }
  return { matches, issues };
}

export function buildExternalAiPrompt(settings: ExternalManuscriptSettings) {
  return `# IKS BOOK STUDIO — EXTERNAL AI MANUSCRIPT REQUEST

You are the author and developmental editor of a source-faithful illustrated children’s book.

## PROJECT
- Working title: ${settings.title}
- Source file: ${settings.sourceName}
- Reader: ${settings.audience} (${settings.readingLevel})
- Language: ${settings.language}
- Book type: ${settings.bookType}
- Book world: ${settings.aesthetic}
- Illustration direction: ${settings.illustrationStyle}
- Learning features: ${settings.learningFeatures.join(", ")}

## YOUR TASK
Read the entire uploaded source before writing. Identify its real Parts, introduction, chapters, conclusion and important appendices. Create a coherent adaptation—not a summary and not generic filler. Preserve the source’s important ideas, sequence, names and culturally specific terms, while explaining them naturally for ${settings.audience.toLowerCase()}.

Write like the book’s author. Never tell the child that text came from an uploaded source, prompt, PDF or AI. Do not invent missing facts. If a passage is unreadable or uncertain, omit the uncertain claim rather than guessing.

Choose the shortest complete structure that explains the source well. Keep genuine chapters in logical order, but combine tiny source subsections when that improves the child’s book. Every chapter must have its own narrative purpose, concrete moments and examples. This first request creates the complete reader manuscript plus a private scene brief for each chapter; Book Studio will turn those briefs into separately runnable image prompts after approval.

## REQUIRED OUTPUT
Return one complete Markdown manuscript. Do not return JSON. If the complete manuscript is too large for one response, create a downloadable ZIP containing 00-Introduction.md, numbered chapter files, Conclusion.md and Glossary.md. Do not shorten later chapters to fit a response limit.

Use this exact heading system:

# [BOOK TITLE]

# INTRODUCTION
[A genuine, inviting opening that prepares the child for the whole book. Do not discuss the adaptation process.]

# CHAPTER 01: [SOURCE-LED TITLE]
[Open directly with a short concrete scene, question, moment of dialogue or sensory detail that connects to the chapter’s real subject. Do not add an “In This Chapter” heading.]
## [MEANINGFUL SUBTOPIC]
[Connected explanatory prose that carries the opening situation or guide voice forward]
## [ANOTHER MEANINGFUL SUBTOPIC]
[Connected explanatory prose, an age-appropriate example and a natural transition]
## KEY TERMS
[Explain unfamiliar IKS, Sanskrit and specialist words]
## THINK IT THROUGH
[Three to five useful questions or one meaningful activity]
## ILLUSTRATION BRIEF
[PRIVATE — one specific narrative scene with people, place, action, objects, mood and culturally grounded visual details. This section will never print.]
[Repeat the complete chapter structure for every chapter.]

# CONCLUSION
[Connect the book’s major ideas without merely repeating chapter summaries]

# GLOSSARY
[Important terms in alphabetical order]

## QUALITY RULES
- Each chapter must be substantial enough for approximately 2–5 designed pages.
- Keep paragraphs connected; do not write disconnected bullet-point filler.
- Introduce ideas before using difficult terminology.
- Use accurate examples that clarify the source rather than replacing it.
- Make vocabulary, sentence length and teaching depth appropriate for ${settings.audience}.
- Make the illustrated scenes and prose belong to the same book. Use the recurring learners Anaya, Kabir, and Acharya Mira in every narrative section, while varying the setting, action, objects, mood and central question. They observe and ask; never put invented historical claims or sacred quotations in their mouths.
- Frame historically loaded social labels with care. Prefer “Varna: Roles and Responsibilities”, “relationships of guidance”, “peers”, and “those in our care” in reader-facing headings; explain original terms accurately inside the discussion.
- Avoid the mechanical subject “This chapter…”. State ideas directly and vary sentence openings. Never begin a sentence with lowercase “this chapter”.
- Never include commentary about preserving, modernising, adapting, sanitising or making the source suitable for children. Those are editor decisions, not reader prose.
- Do not generate or embed images in this manuscript response. Include only the private ILLUSTRATION BRIEF requested above; do not include image links, SVG artwork, diagrams or visible illustration placeholders.
- Do not include citations inside child-facing prose. If useful, add a final private heading “## SOURCE COVERAGE NOTES” inside each chapter; Book Studio will remove it from the printed book.
- Use only two recurring learning blocks—KEY TERMS and THINK IT THROUGH. Do not add “In This Chapter”, “You Will Learn” or “Chapter Recap” blocks.
- Check the complete manuscript for missing chapters, repeated “This chapter” openings, editorial commentary, contradictions and abrupt endings before returning it.

Begin by silently reading and planning from the complete source. Then return only the finished manuscript or downloadable manuscript ZIP.`;
}

function plainReaderText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function buildExternalIllustrationPrompt(project: ExternalIllustrationPromptProject) {
  const requests = project.slots.map((slot, index) => {
    const chapter = project.chapters.find((item) => item.id === slot.chapterId);
    const context = plainReaderText(chapter?.body || chapter?.context || "").slice(0, 1800);
    const dimensions = slot.role === "cover" ? "portrait A4, 2480 × 3508 px, full bleed" : "landscape 4:3, 2400 × 1800 px";
    return `## ${index + 1}. ${slot.id} — ${slot.role === "cover" ? "FRONT COVER" : slot.chapterTitle}
- Exact ZIP path: ${slot.filename}
- Automatic book placement: ${(slot.placement || (slot.role === "cover" ? "cover" : "chapter-middle")).replace(/-/g, " ")}
- Format: ${dimensions}
- Scene: ${slot.sceneBrief}
${slot.role === "cover" ? `- Book subject: ${project.title}` : `- Chapter context: ${context}`}
- Caption intent: ${slot.caption}`;
  }).join("\n\n");
  const zipTree = project.slots.map((slot) => `- ${slot.filename}`).join("\n");
  const zipName = `${project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "book"}-illustrations.zip`;
  return `# IKS BOOK STUDIO — SEQUENTIAL ILLUSTRATION MANIFEST

The manuscript for “${project.title}” is complete and approved. This file is the art bible and destination manifest. Do not attempt the complete queue in one response. Open the separate prompt file for each destination and perform one real image-generation operation at a time. Download every result with its exact filename, then place all completed files in one \`images\` folder and ZIP that folder for automatic placement by Book Studio.

## BOOK ART BIBLE
- Reader: ${project.audience} (${project.readingLevel})
- Language and cultural context: ${project.language}
- Book world: ${project.aesthetic}
- Required illustration direction: ${project.illustrationStyle}
- Keep recurring people, clothing, architecture, materials, palette and rendering style consistent throughout the entire package.
- Every scene must show a specific place, people, action, focal point, lighting and meaningful background details grounded in its chapter context.
- Use culturally and historically respectful details. Do not invent sacred symbols, historical claims or costumes that the chapter does not support.

## ABSOLUTE QUALITY RULES
- Produce detailed, publication-quality JPG, PNG or WebP raster illustrations.
- Do NOT produce SVG, clip art, stick figures, flat diagrams, infographics, maps, charts, UI panels, random circles or boxes, abstract placeholder people, noisy texture collages, or schematic educational graphics.
- Do NOT imitate the simple diagram-like placeholder artwork previously shown by Book Studio. Every requested file must be a fully rendered editorial illustration with believable depth, light, materials, faces, hands and environment.
- Do NOT place text, captions, labels, page numbers, watermarks, logos, borders or mock book layouts inside an image.
- Do NOT return image links or hotlinked web assets. Return the actual image files.
- Preserve faces and hands carefully. Keep children age-appropriate and scenes emotionally safe.
- Make every chapter image visually distinct while keeping one coherent book style.
- Every image must depict its own requested chapter scene. Do not reuse the same composition, landscape, people or background with minor changes.
- Before packaging, visually inspect every image at full size. Regenerate any result that looks like a placeholder, icon, diagram, unfinished draft, corrupted file, repeated scene or generic stock landscape.

## IMAGE QUEUE

${requests}

## REQUIRED ZIP TREE

Create exactly these image paths at the root of the ZIP:

${zipTree}

## REQUIRED SEQUENTIAL WORKFLOW
- Read this art bible once, then open each numbered prompt file in order.
- Generate each prompt as a separate image operation. Never combine multiple destinations into one generation operation.
- Download each result immediately using the exact destination filename. Reuse earlier approved results only as style references.
- Save each full-resolution raster image at its exact path above. When all prompts are complete, package them. The ZIP root must contain the \`images\` folder directly; do not add an enclosing project folder.
- A JPG slot may instead use the same path stem with \`.png\` or \`.webp\` when the image tool cannot export JPG. Do not change any other part of the filename.
- Do not create substitute files, thumbnails, icons, diagrams, contact sheets, SVGs, text descriptions or fake image placeholders.
- Open and visually inspect each result before moving to the next prompt. Confirm that it is a distinct, complete editorial illustration matching its destination.
- Put only the requested finished images in one ZIP named \`${zipName}\`.
- The external image tool returns one image per prompt; the designer creates the final ZIP only after every required file exists.

Use the numbered prompt files now. When the queue is complete, package the exact files as \`${zipName}\` and upload it to Book Studio for automatic placement.`;
}

export function buildExternalIllustrationSlotPrompt(project: ExternalIllustrationPromptProject, slot: ExternalIllustrationSlot) {
  const chapter = project.chapters.find((item) => item.id === slot.chapterId);
  const context = plainReaderText(chapter?.body || chapter?.context || "").slice(0, 3200);
  const dimensions = slot.role === "cover" ? "portrait A4 composition, 2480 × 3508 px, full bleed" : "landscape 4:3 composition, 2400 × 1800 px";
  return `Generate exactly ONE finished illustration for the children’s book “${project.title}”. Use your image-generation tool now and return the actual full-resolution image—not code, SVG, a description, a mockup, a contact sheet or a ZIP.

DESTINATION: ${slot.id} — ${slot.role === "cover" ? "FRONT COVER" : slot.chapterTitle}
EXACT OUTPUT FILENAME: ${slot.filename}
BOOK PLACEMENT: ${(slot.placement || (slot.role === "cover" ? "cover" : "chapter-middle")).replace(/-/g, " ")}
FORMAT: ${dimensions}
STYLE: ${project.illustrationStyle}; ${project.aesthetic}; coherent with the same book’s previously approved images.
READER: ${project.audience} (${project.readingLevel})
SCENE: ${slot.sceneBrief}
${slot.role === "cover" ? `BOOK SUBJECT: ${project.title}` : `CHAPTER CONTEXT: ${context}`}
CAPTION INTENT: ${slot.caption}

COMPOSITION REQUIREMENTS
- Show one specific, believable moment with a clear focal subject, purposeful action, foreground, middle ground, background, natural lighting and culturally grounded material detail.
- Render people, faces, hands, clothing, architecture and objects with publication-quality detail and believable depth.
- Keep recurring characters, palette, materials and rendering style consistent with earlier approved images in this same conversation.
- Leave useful breathing room for page design, but do not add a frame or book layout.

STRICTLY FORBIDDEN
- SVG, clip art, stick figures, flat diagrams, infographics, maps, charts, icons, random circles or boxes, abstract placeholder people, noisy texture collages, schematic educational graphics or the simple mountain-and-shape placeholder style.
- Text, title lettering, captions, labels, page numbers, logos, watermarks, borders or UI inside the image.
- Multiple alternatives, thumbnails, contact sheets, other chapters or fabricated files.

Generate only ${slot.id} now. Return the image itself at the requested orientation and quality.`;
}

export function buildExternalIllustrationPromptPack(project: ExternalIllustrationPromptProject) {
  const manifest = buildExternalIllustrationPrompt(project);
  const prompts = project.slots.map((slot, index) => ({
    slotId: slot.id,
    path: `prompts/${String(index + 1).padStart(3, "0")}-${slot.id}.md`,
    content: buildExternalIllustrationSlotPrompt(project, slot),
  }));
  return { manifest, prompts };
}
