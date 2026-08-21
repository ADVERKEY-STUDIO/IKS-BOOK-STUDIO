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

function separatePrivateSections(raw: string) {
  const privateHeading = /^##+\s*(ILLUSTRATION BRIEF|SOURCE COVERAGE NOTES?|PRIVATE SOURCE NOTES?)\s*$/im;
  const match = privateHeading.exec(raw);
  if (!match) return { reader: raw.trim(), illustrationBrief: undefined };
  const reader = raw.slice(0, match.index).trim();
  const tail = raw.slice(match.index);
  const nextHeading = tail.slice(match[0].length).search(/^##+\s+/m);
  const privateBody = nextHeading >= 0 ? tail.slice(match[0].length, match[0].length + nextHeading) : tail.slice(match[0].length);
  return { reader, illustrationBrief: /illustration/i.test(match[1]) ? cleanLine(privateBody.replace(/\n+/g, " ")) : undefined };
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
  const sections: ExternalManuscriptSection[] = matches.map((match, index) => {
    const label = cleanLine(match[1]);
    const kind = sectionKind(label);
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const privateSplit = separatePrivateSections(normalized.slice(start, end));
    const wordCount = words(privateSplit.reader).length;
    const issues: string[] = [];
    if (wordCount < (kind === "chapter" ? minimumWords(audience) : 90)) issues.push(`${kind === "chapter" ? "Chapter" : "Section"} is short (${wordCount} words).`);
    if (kind === "chapter") {
      if (!/^##+\s*IN THIS CHAPTER\b/im.test(privateSplit.reader)) issues.push("Missing “In This Chapter”.");
      if (!/^##+\s*(KEY TERMS|WORD HELPER|GLOSSARY)\b/im.test(privateSplit.reader)) issues.push("Missing key-term explanation.");
      if (!/^##+\s*(ACTIVITY|TRY IT|THINK ABOUT IT|REFLECT|CHECK YOUR UNDERSTANDING)\b/im.test(privateSplit.reader)) issues.push("Missing activity or comprehension check.");
      if (!privateSplit.illustrationBrief) issues.push("Missing private illustration brief.");
    }
    return { kind, title: sectionTitle(label, kind), raw: privateSplit.reader, html: manuscriptMarkdownToHtml(privateSplit.reader), wordCount, illustrationBrief: privateSplit.illustrationBrief, issues };
  });
  const issues: string[] = [];
  if (!sections.some((section) => section.kind === "introduction")) issues.push("Introduction is missing.");
  if (!sections.some((section) => section.kind === "chapter")) issues.push("No chapter headings were detected. Use headings such as # CHAPTER 01: Title.");
  if (!sections.some((section) => section.kind === "conclusion")) issues.push("Conclusion is missing.");
  if (sections.filter((section) => section.kind === "chapter").length !== new Set(sections.filter((section) => section.kind === "chapter").map((section) => section.title.toLowerCase())).size) issues.push("Two or more chapters have the same title.");
  return { title, sections, issues, words: sections.reduce((sum, section) => sum + section.wordCount, 0) };
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

Choose the shortest complete structure that explains the source well. Keep genuine chapters in logical order, but combine tiny source subsections when that improves the child’s book. Every chapter must have its own purpose, examples and illustration concept.

## REQUIRED OUTPUT
Return one complete Markdown manuscript. Do not return JSON. If the complete manuscript is too large for one response, create a downloadable ZIP containing 00-Introduction.md, numbered chapter files, Conclusion.md and Glossary.md. Do not shorten later chapters to fit a response limit.

Use this exact heading system:

# [BOOK TITLE]

# INTRODUCTION
[A genuine introduction that prepares the child for the whole book]

# CHAPTER 01: [SOURCE-LED TITLE]
## IN THIS CHAPTER
[A clear chapter promise]
## [MEANINGFUL SUBTOPIC]
[Connected explanatory prose]
## [ANOTHER MEANINGFUL SUBTOPIC]
[Connected explanatory prose and an age-appropriate example]
## KEY TERMS
[Explain unfamiliar IKS, Sanskrit and specialist words]
## CHECK YOUR UNDERSTANDING
[Three to five useful questions or one meaningful activity]
## CHAPTER RECAP
[A concise recap]
## ILLUSTRATION BRIEF
[PRIVATE — one unique narrative scene showing the chapter’s people, place, objects and central action. No map, Venn diagram or generic infographic. Historically and culturally respectful, age-safe, landscape 4:3, suitable for a printed A4 book.]

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
- Give every chapter a distinct context and distinct illustration brief.
- Do not include citations inside child-facing prose. If useful, add a final private heading “## SOURCE COVERAGE NOTES” inside each chapter; Book Studio will remove it from the printed book.
- Check the complete manuscript for missing chapters, repetition, contradictions and abrupt endings before returning it.

Begin by silently reading and planning from the complete source. Then return only the finished manuscript or downloadable manuscript ZIP.`;
}
