export type ChildAgeBand = "7-9" | "10-12" | "13-15";

export function childAgeBand(audience = ""): ChildAgeBand {
  if (/7\s*[–-]\s*9|7\s*[-–]\s*10/i.test(audience)) return "7-9";
  if (/13\s*[–-]\s*15|15\s*[–-]\s*18/i.test(audience)) return "13-15";
  return "10-12";
}

export function generationProfileKey(audience = "", language = "English") {
  return `child-adaptation-v9:nemotron-efficient:authorial:${childAgeBand(audience)}:${language.toLowerCase()}:story-thread`;
}

export const AUTHORIAL_READER_INSTRUCTION = "Write as the author of the children’s book. Present ideas directly and confidently. Never mention an uploaded book, source, original text, adaptation process, citation, reference, evidence page, or page number in reader-facing prose.";

function removeEditorialProcessCommentary(value: string) {
  const editorialLanguage = /\b(?:this|the) adaptation\b|\badapt(?:ed|ing) (?:this|the) (?:chapter|book|source)\b|\b(?:reader-facing|editor(?:ial)? note|suitable for children today|avoiding claims (?:that|which))\b/i;
  const withoutBlocks = value.replace(/<(p|div|aside|section)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => editorialLanguage.test(block.replace(/<[^>]+>/g, " ")) ? "" : block);
  return withoutBlocks.replace(/(^|[.!?]\s+)(?:(?:This|The) adaptation|This adapted (?:chapter|book))\b[^.!?]*[.!?](?:\s+|$)/gi, "$1");
}

function sentenceCaseReaderHtml(value: string) {
  return value.replace(/(^|[.!?]\s+|>\s*)(this chapter|the teaching)\b/gim, (_match, prefix: string, phrase: string) => `${prefix}${phrase[0].toUpperCase()}${phrase.slice(1).toLowerCase()}`);
}

export function readerFacingChapterTitle(value = "") {
  const normalized = value.trim().replace(/\s+/g, " ");
  const replacements = new Map<string, string>([
    ["the four castes", "Varna: Roles and Responsibilities"],
    ["virtues and vices in relation to superiors", "Duties in Relationships of Guidance"],
    ["virtues and vices in relation to equals", "Virtues Among Peers"],
    ["virtues and vices in relation to inferiors", "Duties Toward Those in Our Care"],
    ["the re-action of virtues and vices on each other", "How Virtues and Vices Affect One Another"],
    ["ethical science, what it is", "What Is Ethical Science?"],
  ]);
  return replacements.get(normalized.toLowerCase()) ?? normalized;
}

function teachingReplacement(match: string) {
  return /^[A-Z]/.test(match) ? "The teaching" : "the teaching";
}

/**
 * Keeps provenance available as chapter metadata while ensuring manuscript
 * HTML reads as a finished book rather than as notes about another book.
 */
export function authorialReaderHtml(value = "") {
  return sentenceCaseReaderHtml(removeEditorialProcessCommentary(value)
    .replace(/<div\b[^>]*class=["'][^"']*source-draft-notice[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<p\b[^>]*class=["'][^"']*source-note[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<h([1-6])\b[^>]*>\s*IN THIS CHAPTER\s*<\/h\1>/gi, "")
    .replace(/<h([1-6])\b[^>]*>\s*CHECK YOUR UNDERSTANDING\s*<\/h\1>/gi, (_heading, level: string) => `<h${level}>THINK IT THROUGH</h${level}>`)
    .replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (heading, level: string, attributes: string, innerHtml: string) => {
      const plainTitle = innerHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
      const readerTitle = readerFacingChapterTitle(plainTitle);
      return readerTitle === plainTitle ? heading : `<h${level}${attributes}>${readerTitle}</h${level}>`;
    })
    .replace(/<h[1-6]\b[^>]*>\s*CHAPTER RECAP\s*<\/h[1-6]>[\s\S]*$/gi, "")
    .replace(/This chapter explains the source clearly/gi, "The main ideas come into focus here")
    .replace(/This chapter develops the source[’']s main argument/gi, "The central argument develops step by step")
    .replace(/the source[’']s main argument/gi, "the central argument")
    .replace(/in this part of the source/gi, "here")
    .replace(/evidence from the source/gi, "the relevant details")
    .replace(/source connections/gi, "idea connections")
    .replace(/grounded in (?:the )?source evidence/gi, "shaped by the chapter’s central ideas")
    .replace(/\b(?:private|uploaded|reviewed|original) source(?: material| workflow| document| pages?)?\b/gi, teachingReplacement)
    .replace(/\bsource (?:workflow|material|document|pages?)\b/gi, teachingReplacement)
    .replace(/from the (?:uploaded|reviewed|original) (?:book|source|text|source material)(?:\s+in\s+[^.<]+)?/gi, "here")
    .replace(/according to (?:(?:the|this|an?)\s+)?(?:original\s+)?(?:source|text|book|work),?\s*/gi, "")
    .replace(/\b(?:the|this|an?) (?:original\s+)?(?:source|text|book|work)\b/gi, teachingReplacement)
    .replace(/\bthe subject\b/gi, teachingReplacement)
    .replace(/\bThis chapter (?:explores|examines)\s+/gi, (phrase) => /explores/i.test(phrase) ? "Let us explore " : "Let us examine ")
    .replace(/\bThis chapter introduces\s+/gi, "Here we meet ")
    .replace(/\bThis chapter presents\s+/gi, "Here we encounter ")
    .replace(/\bThis chapter gives special attention to\s+/gi, "Special attention goes to ")
    .replace(/\bThis chapter uses a similar idea\b/gi, "A similar idea appears here")
    .replace(/\bThis chapter wants us to\s+/gi, "We are invited to ")
    .replace(/\s+([,.;:!?])/g, "$1"));
}

function cleanEvidence(value: string) {
  return authorialReaderHtml(value)
    .replace(/\b\d{1,4}\s*\[\d+(?:\.\d+)?\]/g, " ")
    .replace(/\[(?:p(?:age)?\.?\s*)?\d+(?:[.:,-]\d+)*\]/gi, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const youngerReplacements: Array<[RegExp, string]> = [
  [/\bin conformity with\b/gi, "following"],
  [/\bnotwithstanding\b/gi, "even so"],
  [/\bconsequently\b/gi, "so"],
  [/\bpredominantly\b/gi, "mostly"],
  [/\bconstitutes?\b/gi, "forms"],
  [/\bcommence(?:s|d)?\b/gi, "begin"],
  [/\bendeavou?r(?:s|ed)?\b/gi, "try"],
  [/\bbespeaks?\b/gi, "shows"],
  [/\bwhereby\b/gi, "by which"],
  [/\btherefore\b/gi, "so"],
  [/\bnevertheless\b/gi, "still"],
  [/\butili[sz](?:e|es|ed|ing)\b/gi, "use"],
];

const middleReplacements: Array<[RegExp, string]> = [
  [/\bin conformity with\b/gi, "in line with"],
  [/\bnotwithstanding\b/gi, "despite this"],
  [/\bpredominantly\b/gi, "mainly"],
  [/\bbespeaks?\b/gi, "shows"],
  [/\bwhereby\b/gi, "through which"],
];

function sentenceChunks(value: string, maximumWords: number) {
  const clauses = value.split(/(?<=[,;:])\s+|(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const clause of clauses) {
    const words = clause.split(/\s+/).filter(Boolean);
    if (words.length <= maximumWords) {
      chunks.push(clause);
      continue;
    }
    for (let index = 0; index < words.length; index += maximumWords) {
      chunks.push(words.slice(index, index + maximumWords).join(" "));
    }
  }
  return chunks.map((chunk) => {
    const cleaned = chunk.replace(/[,;:]$/, "").trim();
    if (!cleaned) return "";
    return `${cleaned[0].toUpperCase()}${cleaned.slice(1)}${/[.!?]$/.test(cleaned) ? "" : "."}`;
  }).filter(Boolean).join(" ");
}

export function adaptEvidenceForAge(sentence: string, audience = "") {
  const age = childAgeBand(audience);
  let adapted = cleanEvidence(sentence);
  const replacements = age === "7-9" ? youngerReplacements : age === "10-12" ? middleReplacements : [];
  for (const [pattern, replacement] of replacements) adapted = adapted.replace(pattern, replacement);
  return sentenceChunks(adapted, age === "7-9" ? 16 : age === "10-12" ? 26 : 40);
}

export function ageEvidenceOrder<T extends { page: number; sentence: string }>(evidence: T[], audience = "", keywords: string[] = []) {
  const age = childAgeBand(audience);
  if (age === "7-9") {
    return [...evidence].sort((a, b) => a.page - b.page || a.sentence.length - b.sentence.length);
  }
  if (age === "13-15") {
    return [...evidence].sort((a, b) => {
      const aText = a.sentence.toLowerCase();
      const bText = b.sentence.toLowerCase();
      const aHits = keywords.reduce((total, word) => total + (aText.includes(word) ? 1 : 0), 0);
      const bHits = keywords.reduce((total, word) => total + (bText.includes(word) ? 1 : 0), 0);
      return a.page - b.page || bHits - aHits;
    });
  }
  return [...evidence].sort((a, b) => a.page - b.page);
}

export function ageParagraphText({ sentence, audience, focus, related, chapterTitle, paragraphIndex }: {
  sentence: string;
  audience: string;
  focus: string;
  related: string;
  chapterTitle: string;
  paragraphIndex: number;
}) {
  const evidence = adaptEvidenceForAge(sentence, audience);
  const age = childAgeBand(audience);

  if (age === "7-9") {
    const openings = [
      `${focus} is an important idea in ${chapterTitle}.`,
      `Now we can connect ${focus} with ${related}.`,
      `This part helps us understand ${focus}.`,
    ];
    return `${openings[paragraphIndex % openings.length]} ${evidence}`;
  }

  if (age === "13-15") {
    const openings = [
      `${chapterTitle} introduces ${focus} as a concept that must be understood in its wider context.`,
      `The relationship between ${focus} and ${related} becomes clearer here.`,
      `A closer reading of ${focus} reveals both its purpose and its wider consequences.`,
    ];
    return `${openings[paragraphIndex % openings.length]} ${evidence}`;
  }

  const openings = [
    `${chapterTitle} begins by explaining ${focus}.`,
    `The next important connection is between ${focus} and ${related}.`,
    `To understand this idea clearly, we need to look at ${focus} in context.`,
  ];
  return `${openings[paragraphIndex % openings.length]} ${evidence}`;
}
