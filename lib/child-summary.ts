export type ChildAgeBand = "7-9" | "10-12" | "13-15";

export function childAgeBand(audience = ""): ChildAgeBand {
  if (/7\s*[–-]\s*9|7\s*[-–]\s*10/i.test(audience)) return "7-9";
  if (/13\s*[–-]\s*15|15\s*[–-]\s*18/i.test(audience)) return "13-15";
  return "10-12";
}

export function generationProfileKey(audience = "", language = "English") {
  return `child-adaptation-v5:natural:${childAgeBand(audience)}:${language.toLowerCase()}`;
}

function cleanEvidence(value: string) {
  return value
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
    return `${openings[paragraphIndex % openings.length]} ${evidence} This means ${focus} and ${related} are connected.`;
  }

  if (age === "13-15") {
    const openings = [
      `${chapterTitle} introduces ${focus} as a concept that must be understood in its wider context.`,
      `The relationship between ${focus} and ${related} becomes clearer in this part of the source.`,
      `A closer reading of ${focus} reveals both its purpose and its wider consequences.`,
    ];
    return `${openings[paragraphIndex % openings.length]} ${evidence} This evidence helps explain how ${focus} shapes, and is shaped by, ${related}.`;
  }

  const openings = [
    `${chapterTitle} begins by explaining ${focus}.`,
    `The next important connection is between ${focus} and ${related}.`,
    `To understand this idea clearly, we need to look at ${focus} in context.`,
  ];
  return `${openings[paragraphIndex % openings.length]} ${evidence} Together, these ideas show why ${focus} matters in the chapter.`;
}
