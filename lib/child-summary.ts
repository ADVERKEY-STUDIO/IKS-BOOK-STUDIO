export type ChildWritingMode = "friendly-guide" | "story-journey" | "curious-explorer";
export type ChildAgeBand = "7-9" | "10-12" | "13-15";

export function childWritingMode(tone = ""): ChildWritingMode {
  const key = tone.toLowerCase();
  if (key.includes("story")) return "story-journey";
  if (key.includes("friendly") || key.includes("warm") || key.includes("clear")) return "friendly-guide";
  return "curious-explorer";
}

export function childAgeBand(audience = ""): ChildAgeBand {
  if (/7\s*[–-]\s*9|7\s*[-–]\s*10/i.test(audience)) return "7-9";
  if (/13\s*[–-]\s*15|15\s*[–-]\s*18/i.test(audience)) return "13-15";
  return "10-12";
}

export function generationProfileKey(audience = "", tone = "", language = "English") {
  return `child-adaptation-v4:${childAgeBand(audience)}:${childWritingMode(tone)}:${language.toLowerCase()}`;
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
  return sentenceChunks(adapted, age === "7-9" ? 18 : age === "10-12" ? 28 : 42);
}

function evidenceSteps(value: string) {
  return value.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
}

function lowerFirst(value: string) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function friendlyEvidence(value: string) {
  return evidenceSteps(value).map((step, index) => index === 0 ? step : `Next, ${lowerFirst(step)}`).join(" ");
}

function storyEvidence(value: string) {
  const transitions = ["Our first discovery is that", "Then we learn that", "The next moment shows that"];
  return evidenceSteps(value).map((step, index) => `${transitions[index % transitions.length]} ${lowerFirst(step)}`).join(" ");
}

function explorerEvidence(value: string) {
  return evidenceSteps(value).map((step, index) => `Clue ${index + 1}: ${step}`).join(" ");
}

export function modeEvidenceOrder<T extends { page: number; sentence: string }>(evidence: T[], tone: string, keywords: string[]) {
  const mode = childWritingMode(tone);
  if (mode === "friendly-guide") return [...evidence].sort((a, b) => a.page - b.page);
  if (mode === "story-journey") {
    const ordered = [...evidence].sort((a, b) => a.page - b.page);
    if (ordered.length < 4) return ordered;
    return [...ordered.filter((_, index) => index % 2 === 0), ...ordered.filter((_, index) => index % 2 === 1)];
  }
  return [...evidence].sort((a, b) => {
    const aText = a.sentence.toLowerCase();
    const bText = b.sentence.toLowerCase();
    const aHits = keywords.reduce((total, word) => total + (aText.includes(word) ? 1 : 0), 0);
    const bHits = keywords.reduce((total, word) => total + (bText.includes(word) ? 1 : 0), 0);
    return bHits - aHits || a.sentence.length - b.sentence.length || a.page - b.page;
  });
}

export function modeParagraphParts({ sentence, tone, audience, focus, related, chapterTitle, paragraphIndex }: {
  sentence: string;
  tone: string;
  audience: string;
  focus: string;
  related: string;
  chapterTitle: string;
  paragraphIndex: number;
}) {
  const evidence = adaptEvidenceForAge(sentence, audience);
  const age = childAgeBand(audience);
  const mode = childWritingMode(tone);

  if (mode === "story-journey") {
    const leads = ["Picture the scene:", "The next discovery:", "The journey changes:"];
    return {
      lead: leads[paragraphIndex % leads.length],
      setup: paragraphIndex === 0 ? `Imagine stepping into the world of ${chapterTitle}. Watch for ${focus} as the ideas unfold.` : `Our journey now follows ${focus} and looks for its connection with ${related}.`,
      evidence: storyEvidence(evidence),
      response: age === "7-9" ? "Pause and picture this moment. What would you notice first?" : "This discovery gives the journey a new direction. Keep it in mind as the next part unfolds.",
    };
  }

  if (mode === "curious-explorer") {
    const leads = ["Question:", "Clue:", "Test the clue:"];
    return {
      lead: leads[paragraphIndex % leads.length],
      setup: `What does this evidence show us about ${focus}?`,
      evidence: explorerEvidence(evidence),
      response: age === "13-15" ? `Compare this clue with the chapter’s other evidence. Does ${related} strengthen or challenge your first answer?` : `Circle the words that connect ${focus} and ${related}, then explain the link in one sentence.`,
    };
  }

  const leads = ["Start with this:", "In simpler words:", "Now connect it:"];
  return {
    lead: leads[paragraphIndex % leads.length],
    setup: age === "7-9" ? `We can understand ${focus} one small step at a time.` : `Let’s unpack how ${focus} works before connecting it with ${related}.`,
    evidence: friendlyEvidence(evidence),
    response: age === "13-15" ? `The key point is the relationship between ${focus} and ${related}; use the evidence above to state that relationship precisely.` : `The helpful idea is that ${focus} and ${related} belong in the same explanation.`,
  };
}
