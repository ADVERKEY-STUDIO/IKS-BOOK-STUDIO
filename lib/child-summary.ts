export type ChildAgeBand = "7-9" | "10-12" | "13-15";

export function childAgeBand(audience = ""): ChildAgeBand {
  if (/7\s*[–-]\s*9|7\s*[-–]\s*10/i.test(audience)) return "7-9";
  if (/13\s*[–-]\s*15|15\s*[–-]\s*18/i.test(audience)) return "13-15";
  return "10-12";
}

export function generationProfileKey(audience = "", language = "English") {
  return `child-adaptation-v7:gemini-pedagogy:authorial:${childAgeBand(audience)}:${language.toLowerCase()}`;
}

export const AUTHORIAL_READER_INSTRUCTION = "Write as the author of the children’s book. Present ideas directly and confidently. Never mention an uploaded book, source, original text, adaptation process, citation, reference, evidence page, or page number in reader-facing prose.";

/**
 * Keeps provenance available as chapter metadata while ensuring manuscript
 * HTML reads as a finished book rather than as notes about another book.
 */
export function authorialReaderHtml(value = "") {
  return value
    .replace(/<div\b[^>]*class=["'][^"']*source-draft-notice[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<p\b[^>]*class=["'][^"']*source-note[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/This chapter explains the source clearly/gi, "This chapter introduces the main ideas clearly")
    .replace(/This chapter develops the source[’']s main argument/gi, "This chapter develops the central argument")
    .replace(/the source[’']s main argument/gi, "the central argument")
    .replace(/in this part of the source/gi, "in this part of the chapter")
    .replace(/evidence from the source/gi, "details in the chapter")
    .replace(/source connections/gi, "idea connections")
    .replace(/grounded in (?:the )?source evidence/gi, "shaped by the chapter’s central ideas")
    .replace(/from the (?:uploaded|reviewed|original) (?:book|source|text|source material)(?:\s+in\s+[^.<]+)?/gi, "for this chapter")
    .replace(/according to (?:(?:the|this|an?)\s+)?(?:original\s+)?(?:source|text|book|work),?\s*/gi, "")
    .replace(/\b(?:the|this|an?) (?:original\s+)?(?:source|text|book|work)\b/gi, "this chapter")
    .replace(/\s+([,.;:!?])/g, "$1");
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
