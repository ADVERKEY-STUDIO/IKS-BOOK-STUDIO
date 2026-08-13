/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { AlignmentType, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, TextRun } from "docx";
import { authorialReaderHtml, generationProfileKey } from "../lib/child-summary";
import { allocatePagesWithinBudget, CHAPTER_PAGE_BUDGET, recommendedAdaptationPages } from "../lib/adaptation-pages";
import { efficientChapterPrompt, evaluateChapterOneGate, evaluateTeachingChapter, normalizeTeachingChapter, renderTeachingChapter, reviewPrompt, type ChapterBlueprint, type ChapterOneGate, type PedagogyQuality, type PedagogyScores, type TeachingChapter } from "../lib/pedagogy";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type DraftChapterInput = {
  id: number;
  title: string;
  pages: number;
  sourceStartPage?: number;
  sourceEndPage?: number;
  sourcePageCount?: number;
  sourceWordCount?: number;
  complexityScore?: number;
  locked?: boolean;
  body?: string;
  pedagogyQuality?: PedagogyQuality;
};

type ChapterContextPlan = {
  title: string;
  sourceStartPage: number;
  sourceEndPage: number;
  sourcePageCount: number;
  sourceWordCount: number;
  complexityScore: number;
  complexity: "Accessible" | "Layered" | "Concept-rich" | "Dense";
  keyTerms: string[];
  context: string;
  recommendedPages: number;
  pageReason: string;
};

type DraftProjectInput = {
  source: string;
  sourceObjectKey: string;
  audience?: string;
  readingLevel?: string;
  language?: string;
  adaptation?: string;
  learningFeatures?: string[];
  aesthetic?: string;
  illustrationStyle?: string;
  imageFrequency?: string;
  sourceTerms?: string[];
  chapters: DraftChapterInput[];
  chapterIds: number[];
  repairOnly?: boolean;
  phase7ChapterOneOnly?: boolean;
};

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const allowedExtensions = new Set(["pdf", "docx", "txt", "md"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const stopWords = new Set("about after again also among and are because been before being between book can chapter could did does each for from had has have into its may more most not other our out over page pages part should some such than that the their them then there these they this through under use used using very was were what when where which while who will with would your".split(" "));
let schemaReady: Promise<void> | null = null;

function ensureSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS book_projects (id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL, title TEXT NOT NULL, source_name TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS book_projects_owner_updated_idx ON book_projects (owner_key, updated_at)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS book_project_versions (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, owner_key TEXT NOT NULL, label TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (project_id) REFERENCES book_projects(id) ON DELETE CASCADE)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS book_versions_project_created_idx ON book_project_versions (project_id, created_at)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS designer_preferences (owner_key TEXT PRIMARY KEY NOT NULL, preferences_json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
    ]).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function ownerKey(request: Request) {
  return request.headers.get("oai-authenticated-user-email")
    ?? request.headers.get("x-book-studio-owner")
    ?? "owner";
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function sourceExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function extractSourcePages(bytes: ArrayBuffer, extension: string) {
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: false });
    const pageTexts = typeof extracted.text === "string" ? [extracted.text] : extracted.text;
    return { text: pageTexts.join("\n\n"), pageTexts, pages: extracted.totalPages };
  }
  if (extension === "docx") {
    const text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
    return { text, pageTexts: [text], pages: 0 };
  }
  const text = new TextDecoder().decode(bytes);
  return { text, pageTexts: [text], pages: 0 };
}

function cleanSourceText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, "$1$2")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(\d{1,4}|contents|index|copyright|all rights reserved)$/i.test(line))
    .filter((line) => !/z[ -]?library|singlelogin|isbn|cataloguing in publication|no part of this book may be reproduced/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function usefulSentences(value: string) {
  return cleanSourceText(value)
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ“‘])/u)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 55 && sentence.length <= 700)
    .filter((sentence) => (sentence.match(/[\p{L}]/gu) ?? []).length >= 40)
    .filter((sentence) => !/^(chapter|figure|table)\s+[\divxlc]+\b/i.test(sentence));
}

function contentWords(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}’'-]+/gu) ?? [];
}

function isChapterLabel(value: string) {
  return /^chapter\s+(?:\d{1,3}|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[:.\-–—]?$/i.test(value.trim());
}

function chapterTitlesFromLabels(lines: string[]) {
  const titles: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isChapterLabel(lines[index])) continue;
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 7); cursor += 1) {
      const candidate = lines[cursor]
        .replace(/^\s*\d{1,3}\s*[.·-]?\s*/, "")
        .replace(/\s+\d+\s*$/, "")
        .trim();
      if (!candidate) continue;
      if (isChapterLabel(candidate)) break;
      if (/^(contents|preface|foreword|references|bibliography|index)$/i.test(candidate)) continue;
      const words = candidate.split(/\s+/);
      const looksLikeTitle = candidate.length >= 4
        && candidate.length <= 120
        && words.length <= 16
        && !/[.!?]$/.test(candidate)
        && (candidate === candidate.toUpperCase() || /^[A-Z][\p{L}\p{N} &'’,:()\-–—]+$/u.test(candidate));
      if (!looksLikeTitle) continue;
      titles.push(candidate.replace(/\s+/g, " "));
      break;
    }
  }
  return titles.filter((title, index, all) => all.findIndex((item) => item.toLowerCase() === title.toLowerCase()) === index);
}

function chapterTitlesFromContents(lines: string[], contentsIndex: number) {
  if (contentsIndex < 0) return [];
  const titles: string[] = [];
  let started = false;
  for (let index = contentsIndex + 1; index < Math.min(lines.length, contentsIndex + 260); index += 1) {
    const line = lines[index].replace(/\s+/g, " ").trim();
    if (started && /^(foreword|preface|acknowledgements?)\b/i.test(line)) break;
    const match = line.match(/^(\d{1,2})\.\s+(?!\d)(.+?)(?:\s+\d+\s*[-–—]\s*\d+)?\s*$/u);
    if (!match) continue;
    started = true;
    const title = match[2].replace(/\s+\d+\s*[-–—]\s*\d+\s*$/u, "").trim();
    if (title.length < 3 || title.length > 180) continue;
    titles.push(title);
  }
  return titles.filter((title, index, all) => all.findIndex((item) => item.toLocaleLowerCase() === title.toLocaleLowerCase()) === index);
}

function evidenceSignature(value: string) {
  return contentWords(value).slice(0, 42).join(" ");
}

function existingEvidence(body = "") {
  const plain = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#039);/g, " ")
    .replace(/\s+/g, " ");
  return usefulSentences(plain).map(evidenceSignature).filter((signature) => signature.length > 45);
}

function chapterKeywords(title: string, terms: string[]) {
  const titleWords = contentWords(title).filter((word) => word.length > 3 && !stopWords.has(word));
  return [...new Set([...titleWords, ...terms.filter((term) => term.length > 3).slice(0, 4)])];
}

function sentenceScore(sentence: string, keywords: string[]) {
  const lower = sentence.toLowerCase();
  const matches = keywords.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  const usefulLength = Math.min(sentence.length, 360) / 360;
  return matches * 8 + usefulLength;
}

function chapterSpecificTerms(value: string, title: string) {
  const titleWords = new Set(contentWords(title));
  const frequency = new Map<string, number>();
  for (const raw of contentWords(value)) {
    const word = raw.toLowerCase().replace(/^['’-]+|['’-]+$/g, "");
    if (word.length < 5 || stopWords.has(word) || titleWords.has(word) || /^\d+$/.test(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([word]) => word);
}

function fitDraftChaptersToBookLimit(chapters: DraftChapterInput[]) {
  const pages = allocatePagesWithinBudget(chapters.map((chapter) => chapter.pages || 1));
  return chapters.map((chapter, index) => ({ ...chapter, pages: pages[index] }));
}

function chapterContextPlans(headings: string[], pageTexts: string[], audience = "Ages 10–12"): ChapterContextPlan[] {
  const cleanedPages = pageTexts.map(cleanSourceText);
  const contentsPage = cleanedPages.findIndex((page, index) => index < Math.min(20, cleanedPages.length) && /\bcontents\b/i.test(page));
  // A chapter title often appears first in the contents, forewords, or preface.
  // Start chapter matching only after the final clearly labelled front-matter
  // page so those mentions cannot become the chapter's source range.
  const frontMatterLimit = Math.min(35, cleanedPages.length);
  const lastFrontMatterPage = cleanedPages.reduce((last, page, pageIndex) => {
    if (pageIndex >= frontMatterLimit) return last;
    const opening = page.slice(0, 700);
    return /\b(?:foreword|preface|acknowledg(?:e)?ments?)\b/i.test(opening) ? pageIndex : last;
  }, contentsPage);
  const firstBodyPage = Math.max(0, contentsPage + 1, lastFrontMatterPage + 1);
  const anchors: number[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const title = headings[index];
    const words = contentWords(title).filter((word) => word.length > 3 && !stopWords.has(word)).slice(0, 9);
    const normalized = contentWords(title).join(" ");
    const minimumPage = index === 0 ? firstBodyPage : Math.min(cleanedPages.length - 1, anchors[index - 1] + 1);
    const candidates = cleanedPages.map((page, pageIndex) => {
      if (pageIndex < minimumPage || !page) return null;
      const pageWords = contentWords(page).join(" ");
      const hits = words.filter((word) => pageWords.includes(word)).length;
      const exact = normalized.length > 8 && pageWords.includes(normalized);
      return { pageIndex, exact, hits, score: (exact ? 100 : 0) + hits * 10 - Math.max(0, pageIndex - minimumPage) * .03 };
    }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .filter((entry) => entry.exact || (words.length > 0 && entry.hits >= Math.max(1, Math.ceil(words.length * .6))))
      .sort((a, b) => b.score - a.score || a.pageIndex - b.pageIndex);
    const distributed = Math.min(cleanedPages.length - 1, Math.floor(index * Math.max(1, cleanedPages.length) / Math.max(1, headings.length)));
    anchors.push(candidates[0]?.pageIndex ?? Math.max(minimumPage, distributed));
  }

  const rawPlans = headings.map((title, index) => {
    const start = Math.max(0, anchors[index] ?? 0);
    const nextStart = anchors[index + 1] ?? cleanedPages.length;
    const end = Math.max(start, Math.min(cleanedPages.length - 1, nextStart - 1));
    const segmentPages = cleanedPages.slice(start, end + 1);
    const segment = segmentPages.join(" ");
    const words = contentWords(segment);
    const sentences = usefulSentences(segment);
    const sentenceLengths = sentences.map((sentence) => contentWords(sentence).length).filter(Boolean);
    const averageSentenceWords = sentenceLengths.length ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length : 18;
    const averageWordLength = words.length ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 5;
    const keyTerms = chapterSpecificTerms(segment, title);
    const complexityScore = Math.max(0, Math.min(1,
      Math.max(0, averageSentenceWords - 16) / 28 * .5
      + Math.max(0, averageWordLength - 5) / 3 * .25
      + Math.min(1, keyTerms.length / 5) * .25,
    ));
    const complexity: ChapterContextPlan["complexity"] = complexityScore >= .76 ? "Dense" : complexityScore >= .54 ? "Concept-rich" : complexityScore >= .3 ? "Layered" : "Accessible";
    const sourcePageCount = Math.max(1, end - start + 1);
    const sourceWordCount = words.length;
    const contextTerms = keyTerms.slice(0, 3);
    const context = contextTerms.length
      ? `Centres on ${contextTerms.join(", ")} across ${sourcePageCount} source page${sourcePageCount === 1 ? "" : "s"}.`
      : `Develops the central ideas of ${title} across ${sourcePageCount} source page${sourcePageCount === 1 ? "" : "s"}.`;
    const base = { title, sourceStartPage: start + 1, sourceEndPage: end + 1, sourcePageCount, sourceWordCount, complexityScore, complexity, keyTerms, context };
    const recommendedPages = recommendedAdaptationPages(base, audience);
    const pageReason = `${complexity} chapter · ${sourceWordCount.toLocaleString()} source words reviewed · shortest clear treatment for the selected age, including essential ideas, an example, one unique visual and an activity.`;
    return { ...base, recommendedPages, pageReason };
  });
  const requestedTotal = rawPlans.reduce((sum, plan) => sum + plan.recommendedPages, 0);
  const allocations = allocatePagesWithinBudget(rawPlans.map((plan) => plan.recommendedPages));
  return rawPlans.map((plan, index) => ({
    ...plan,
    recommendedPages: allocations[index],
    pageReason: requestedTotal > CHAPTER_PAGE_BUDGET
      ? `${plan.pageReason} Reduced only because the combined plan exceeded the 100-page safety ceiling.`
      : plan.pageReason,
  }));
}

function selectChapterPages(pageTexts: string[], chapter: DraftChapterInput, index: number, total: number, terms: string[]) {
  const keywords = chapterKeywords(chapter.title, terms);
  const cleanedPages = pageTexts.map(cleanSourceText);
  const sourceStart = chapter.sourceStartPage ? Math.max(0, chapter.sourceStartPage - 1) : 0;
  const sourceEnd = chapter.sourceEndPage ? Math.min(cleanedPages.length - 1, chapter.sourceEndPage - 1) : cleanedPages.length - 1;
  const exactWords = contentWords(chapter.title).filter((word) => word.length > 3).slice(0, 6);
  const exactMatches = cleanedPages
    .map((page, pageIndex) => ({ pageIndex, hits: exactWords.filter((word) => page.toLowerCase().includes(word)).length }))
    .filter((entry) => entry.pageIndex >= sourceStart && entry.pageIndex <= sourceEnd)
    .filter((entry) => exactWords.length > 0 && entry.hits >= Math.max(1, Math.ceil(exactWords.length * .6)));
  const distributedAnchor = chapter.sourceStartPage
    ? Math.floor((sourceStart + sourceEnd) / 2)
    : Math.min(cleanedPages.length - 1, Math.floor((index + .5) * cleanedPages.length / Math.max(1, total)));
  const anchor = exactMatches.length ? exactMatches[exactMatches.length - 1].pageIndex : distributedAnchor;
  const availableSourcePages = Math.max(1, sourceEnd - sourceStart + 1);
  const wantedPages = Math.max(1, Math.min(availableSourcePages, Math.ceil(chapter.pages * .9)));
  const candidates = cleanedPages.map((page, pageIndex) => {
    if (pageIndex < sourceStart || pageIndex > sourceEnd) return { pageIndex, page, score: -Infinity };
    const keywordHits = keywords.reduce((sum, word) => sum + Math.min(5, page.toLowerCase().split(word).length - 1), 0);
    const distance = Math.abs(pageIndex - anchor);
    const proximity = Math.max(0, wantedPages * 1.5 - distance);
    return { pageIndex, page, score: keywordHits * 5 + proximity };
  }).filter((entry) => entry.page.length > 120);
  const selected = candidates.sort((a, b) => b.score - a.score).slice(0, wantedPages).sort((a, b) => a.pageIndex - b.pageIndex);
  return { selected, keywords };
}

class TeachingEngineError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly code = "chapter-failed",
    readonly retryable = false,
    readonly quota = false,
    readonly requestCount = 0,
  ) {
    super(message);
  }
}

const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

async function openRouterStatusApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const openRouterApiKey = typeof env.OPENROUTER_API_KEY === "string"
    ? env.OPENROUTER_API_KEY.trim()
    : "";
  if (!openRouterApiKey) {
    return json({ connected: false, error: "OPENROUTER_API_KEY is not configured as a server secret." }, 503);
  }

  const authHeaders = {
    authorization: `Bearer ${openRouterApiKey}`,
    "content-type": "application/json",
    "http-referer": "https://iks-book-studio.gaurav-gupta-6041.chatgpt.site",
    "x-openrouter-title": "IKS Book Studio",
  };
  const model = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

  const keyResponse = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { authorization: authHeaders.authorization },
  });
  if (!keyResponse.ok) {
    const status = keyResponse.status === 401 || keyResponse.status === 403 ? 401 : 502;
    return json({ connected: false, model, error: status === 401 ? "The OpenRouter key was rejected." : "OpenRouter key verification is temporarily unavailable." }, status);
  }
  const keyData = await keyResponse.json() as { data?: { is_free_tier?: boolean; limit_remaining?: number | null; usage_daily?: number } };

  const testResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only the requested word. Do not explain." },
        { role: "user", content: "Reply exactly: READY" },
      ],
      max_tokens: 12,
      temperature: 0,
      reasoning: { effort: "none", exclude: true },
      stream: false,
    }),
  });
  if (!testResponse.ok) {
    const detail = (await testResponse.text()).slice(0, 400);
    const message = testResponse.status === 429
      ? "The key is valid, but the free-model request limit or provider capacity is currently unavailable."
      : testResponse.status === 404
        ? "The configured Nemotron model is not currently available to this key."
        : `The key is valid, but Nemotron could not complete the connection test (${testResponse.status}).`;
    return json({ connected: false, authenticated: true, model, error: message, detail: detail.replace(/sk-or-[\w-]+/gi, "[redacted]") }, testResponse.status === 429 ? 429 : 502);
  }

  const testData = await testResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; reasoning_tokens?: number };
  };
  const answer = testData.choices?.[0]?.message?.content?.trim() ?? "";
  return json({
    connected: /^READY\.?$/i.test(answer),
    authenticated: true,
    model,
    test: /^READY\.?$/i.test(answer) ? "passed" : "unexpected-response",
    usage: {
      inputTokens: testData.usage?.prompt_tokens ?? 0,
      outputTokens: testData.usage?.completion_tokens ?? 0,
      totalTokens: testData.usage?.total_tokens ?? 0,
      reasoningTokens: testData.usage?.reasoning_tokens ?? 0,
    },
    account: {
      freeTier: Boolean(keyData.data?.is_free_tier),
      creditLimitRemaining: keyData.data?.limit_remaining ?? null,
      dailyCreditUsage: keyData.data?.usage_daily ?? 0,
    },
  });
}

type AiUsage = { inputTokens: number; outputTokens: number; totalTokens: number; reasoningTokens: number; requests: number };

function addUsage(left: AiUsage, right: AiUsage): AiUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    requests: left.requests + right.requests,
  };
}

function chapterSourceMaterial(pageTexts: string[], chapter: DraftChapterInput, index: number, total: number, project: DraftProjectInput) {
  const { selected } = selectChapterPages(pageTexts, chapter, index, total, project.sourceTerms ?? []);
  const material = selected.map((entry) => {
    const cleaned = cleanSourceText(entry.page).slice(0, 3000);
    return cleaned ? `[PRIVATE PAGE ${entry.pageIndex + 1}]\n${cleaned}` : "";
  }).filter(Boolean).join("\n\n");
  return material.length <= 24000 ? material : `${material.slice(0, 12000)}\n\n[PRIVATE MATERIAL CONTINUES]\n\n${material.slice(-11500)}`;
}

function parseJsonObject<T>(value: string): T {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("invalid JSON");
  }
}

async function openRouterStructured<T>(env: Env, prompt: string, maxCompletionTokens: number) {
  const key = typeof env.OPENROUTER_API_KEY === "string" ? env.OPENROUTER_API_KEY.trim() : "";
  if (!key) throw new TeachingEngineError("The OpenRouter teaching engine is not connected yet. Ask the site owner to finish AI setup.", 503, "missing-key");
  const model = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "http-referer": "https://iks-book-studio.gaurav-gupta-6041.chatgpt.site",
        "x-openrouter-title": "IKS Book Studio",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return only valid JSON matching the requested schema. Do not include markdown or hidden reasoning." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: maxCompletionTokens,
        temperature: 0.2,
        reasoning: { effort: "none", exclude: true },
        stream: false,
      }),
    });
  } catch {
    throw new TeachingEngineError("The provider connection was interrupted. The website may retry this chapter once after a short delay.", 502, "temporary-network", true, false, 1);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500).replace(/sk-or-[\w-]+/gi, "[redacted]");
    if (response.status === 429) throw new TeachingEngineError("Nemotron reached the current free-model request or daily quota limit. Generation stopped immediately; resume the book after the quota resets.", 429, "quota-exhausted", false, true, 1);
    if (response.status === 402) throw new TeachingEngineError("The OpenRouter account or key spending limit needs attention. Generation stopped immediately; completed chapters remain saved.", 402, "quota-exhausted", false, true, 1);
    if (response.status === 401 || response.status === 403) throw new TeachingEngineError("The OpenRouter key was rejected. Completed chapters remain saved.", 503, "authentication", false, false, 1);
    if (response.status === 408 || response.status >= 500) throw new TeachingEngineError(`Nemotron is temporarily unavailable (${response.status}). The website may retry this chapter once after a short delay.`, 502, "provider-temporary", true, false, 1);
    throw new TeachingEngineError(`Nemotron could not prepare this chapter (${response.status}). ${detail}`, 502, "provider-rejected", false, false, 1);
  }
  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; reasoning_tokens?: number };
  };
  const content = result.choices?.[0]?.message?.content ?? "";
  let data: T;
  try {
    data = parseJsonObject<T>(content);
  } catch {
    throw new TeachingEngineError("Nemotron returned malformed chapter data. The previous chapter was kept unchanged; use targeted repair instead of regenerating automatically.", 422, "malformed-output", false, false, 1);
  }
  return {
    data,
    model,
    usage: {
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
      reasoningTokens: result.usage?.reasoning_tokens ?? 0,
      requests: 1,
    } satisfies AiUsage,
  };
}

function normalizedScores(value: unknown): PedagogyScores {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<PedagogyScores>;
  const score = (item: unknown) => Math.max(0, Math.min(100, Number(item) || 0));
  return { context: score(raw.context), coherence: score(raw.coherence), ageFit: score(raw.ageFit), pedagogy: score(raw.pedagogy), sourceFidelity: score(raw.sourceFidelity) };
}

function privateChapterRefs(pageTexts: string[], chapter: DraftChapterInput, index: number, total: number, project: DraftProjectInput) {
  const { selected, keywords } = selectChapterPages(pageTexts, chapter, index, total, project.sourceTerms ?? []);
  return selected.flatMap((entry) => usefulSentences(entry.page)
    .map((sentence) => ({ sentence, score: sentenceScore(sentence, keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map((item) => ({ title: chapter.title, page: entry.pageIndex + 1, excerpt: item.sentence.slice(0, 520) }))).slice(0, 8);
}

async function buildPedagogicalDraft(env: Env, pageTexts: string[], chapter: DraftChapterInput, index: number, total: number, project: DraftProjectInput) {
  const sourceMaterial = chapterSourceMaterial(pageTexts, chapter, index, total, project);
  if (contentWords(sourceMaterial).length < 120) throw new TeachingEngineError("This chapter does not contain enough readable text. OCR or a clearer source file may be required.", 422);
  const audience = project.audience || "Ages 10–12";
  const language = project.language || "English";
  const initial = await openRouterStructured<{ chapter: TeachingChapter; scores: PedagogyScores; summary: string; checks: string[] }>(
    env,
    efficientChapterPrompt({ title: chapter.title, audience, language, targetPages: chapter.pages, sourceMaterial }),
    3600,
  );
  let review = initial.data;
  let draft = normalizeTeachingChapter(review.chapter, chapter.title);
  let scores = normalizedScores(review.scores);
  let deterministic = evaluateTeachingChapter(draft, audience, sourceMaterial, chapter.pages);
  let revisionPasses = 0;
  let usage = initial.usage;
  // Formatting cleanup happens locally in normalizeTeachingChapter. Spend one
  // additional model request only when the meaningful quality gate truly fails.
  if (!deterministic.passed || Object.values(scores).some((score) => score < 80)) {
    const blueprint: ChapterBlueprint = { centralQuestion: "Repair the complete chapter", readerHook: "Preserve the strongest child-friendly opening", essentialIdeas: [], conceptOrder: [], requiredVocabulary: [], historicalContext: "Use the supplied material", sensitiveContext: "Keep mature material age-appropriate", avoidRepeating: [] };
    let repair;
    try {
      repair = await openRouterStructured<{ chapter: TeachingChapter; scores: PedagogyScores; summary: string; checks: string[] }>(env, reviewPrompt({
        title: chapter.title,
        audience,
        language,
        targetPages: chapter.pages,
        sourceMaterial,
        blueprint,
        draft,
        failures: [...deterministic.failures, ...Object.entries(scores).filter(([, score]) => score < 80).map(([name, score]) => `${name} score ${score} is below 80`)],
      }), 3600);
    } catch (error) {
      if (error instanceof TeachingEngineError) {
        throw new TeachingEngineError(error.message, error.status, error.code, error.retryable, error.quota, initial.usage.requests + error.requestCount);
      }
      throw error;
    }
    review = repair.data;
    usage = addUsage(usage, repair.usage);
    draft = normalizeTeachingChapter(review.chapter, chapter.title);
    scores = normalizedScores(review.scores);
    deterministic = evaluateTeachingChapter(draft, audience, sourceMaterial, chapter.pages);
    revisionPasses = 1;
  }
  if (!deterministic.passed || Object.values(scores).some((score) => score < 80)) {
    throw new TeachingEngineError(`This chapter did not pass the children’s textbook quality gate: ${[...deterministic.failures, ...Object.entries(scores).filter(([, score]) => score < 80).map(([name]) => `${name} needs improvement`)].join("; ")}. The previous chapter was kept unchanged.`, 422, "quality-review", false, false, usage.requests);
  }
  const pedagogyQuality: PedagogyQuality = {
    status: "passed",
    engine: initial.model,
    scores,
    revisionPasses,
    summary: typeof review.summary === "string" ? review.summary : "This chapter passed the teaching-quality review.",
    checks: [...new Set([...(Array.isArray(review.checks) ? review.checks.filter((item): item is string => typeof item === "string") : []), `Readable lesson: ${deterministic.totalWords} words`, `Age-fit sentence average: ${deterministic.averageSentenceWords} words`, `Chapter concepts used: ${deterministic.sourceTermOverlap.slice(0, 6).join(", ")}`])].slice(0, 9),
    learningGoals: draft.learningGoals,
  };
  const body = authorialReaderHtml(renderTeachingChapter(draft, index + 1, escapeHtml));
  return { chapter: {
      ...chapter,
      status: "draft" as const,
      body,
      sourceRefs: privateChapterRefs(pageTexts, chapter, index, total, project),
      wordCount: contentWords(body.replace(/<[^>]+>/g, " ")).length,
      generationProfile: generationProfileKey(project.audience, project.language),
      pedagogyQuality,
  }, usage };
}

async function buildTargetedRepair(env: Env, pageTexts: string[], chapter: DraftChapterInput, index: number, total: number, project: DraftProjectInput) {
  const sourceMaterial = chapterSourceMaterial(pageTexts, chapter, index, total, project);
  const currentText = authorialReaderHtml(chapter.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 22000);
  if (contentWords(currentText).length < 80) throw new TeachingEngineError("There is not enough chapter text to repair. Improve the chapter first.", 422, "repair-unavailable");
  const audience = project.audience || "Ages 10–12";
  const language = project.language || "English";
  const repair = await openRouterStructured<{ chapter: TeachingChapter; scores: PedagogyScores; summary: string; checks: string[] }>(env, `You are making one targeted repair to an existing children’s textbook chapter for ${audience} in ${language}.

CHAPTER: ${chapter.title}
TARGET PAGES: ${chapter.pages}

Repair only genuine teaching, coherence, age-fit, or factual weaknesses. Preserve sound wording and the chapter’s meaning. Fix formatting locally in the returned structure; do not invent facts, add padding, mention AI, or discuss this instruction. This is the single permitted repair request, so return the complete corrected lesson as valid JSON with exactly: chapter, scores, summary, checks. The chapter object must contain title, chapterPromise, learningGoals, introduction, sections, quickCheck, activity, and recap.

CURRENT CHAPTER:
${currentText}

PRIVATE FACTUAL MATERIAL:
${sourceMaterial}`, 3600);
  const draft = normalizeTeachingChapter(repair.data.chapter, chapter.title);
  const scores = normalizedScores(repair.data.scores);
  const deterministic = evaluateTeachingChapter(draft, audience, sourceMaterial, chapter.pages);
  if (!deterministic.passed || Object.values(scores).some((score) => score < 80)) {
    throw new TeachingEngineError(`The one targeted repair still needs review: ${[...deterministic.failures, ...Object.entries(scores).filter(([, score]) => score < 80).map(([name]) => `${name} needs improvement`)].join("; ")}. The original remains available.`, 422, "repair-review", false, false, repair.usage.requests);
  }
  const pedagogyQuality: PedagogyQuality = {
    status: "passed",
    engine: repair.model,
    scores,
    revisionPasses: 1,
    summary: typeof repair.data.summary === "string" ? repair.data.summary : "The targeted repair passed the teaching-quality review.",
    checks: [...new Set([...(Array.isArray(repair.data.checks) ? repair.data.checks.filter((item): item is string => typeof item === "string") : []), `Readable lesson: ${deterministic.totalWords} words`, `Age-fit sentence average: ${deterministic.averageSentenceWords} words`])].slice(0, 9),
    learningGoals: draft.learningGoals,
  };
  const body = authorialReaderHtml(renderTeachingChapter(draft, index + 1, escapeHtml));
  return { chapter: {
    ...chapter,
    status: "draft" as const,
    body,
    sourceRefs: privateChapterRefs(pageTexts, chapter, index, total, project),
    wordCount: contentWords(body.replace(/<[^>]+>/g, " ")).length,
    generationProfile: generationProfileKey(project.audience, project.language),
    pedagogyQuality,
  }, usage: repair.usage };
}

function analyseText(text: string) {
  const compact = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ");
  const words = compact.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  const lines = compact.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const contentsIndex = lines.findIndex((line) => /^contents$/i.test(line));
  const contentsHeadings = chapterTitlesFromContents(lines, contentsIndex);
  const labelledChapterTitles = chapterTitlesFromLabels(lines);
  const structuralHeadings = lines.filter((line) => line.length >= 4 && line.length <= 90 && (
    /^(chapter|unit|part|section|book)\s+[\divxlc]+\b/i.test(line)
    || (/^[A-Z\d][A-Z\d :,'’&-]+$/.test(line) && line.split(/\s+/).length <= 10)
  )).filter((line, index, array) => array.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index).slice(0, 18);
  const headings = (contentsHeadings.length >= 2 ? contentsHeadings : labelledChapterTitles.length ? labelledChapterTitles : structuralHeadings)
    .filter((line, index, array) => array.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index)
    .slice(0, 60);
  const frequency = new Map<string, number>();
  for (const raw of words) {
    const word = raw.toLowerCase().replace(/^['’-]+|['’-]+$/g, "");
    if (word.length < 5 || stopWords.has(word) || /^\d+$/.test(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const terms = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
  return { words: words.length, headings, terms, preview: compact.slice(0, 12000) };
}

function makeSections(headings: string[], pageTexts: string[], fallbackText: string, chapterPlans: ChapterContextPlan[]) {
  const compactPages = pageTexts.map((page) => page.replace(/\s+/g, " ").trim());
  const fallbackSentences = fallbackText.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 55 && sentence.length < 500);
  return headings.map((title, index) => {
    const words = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3);
    const matchedPage = compactPages.findIndex((page) => words.length > 0 && words.filter((word) => page.toLowerCase().includes(word)).length >= Math.min(2, words.length));
    const plannedStart = chapterPlans[index]?.sourceStartPage ? chapterPlans[index].sourceStartPage - 1 : -1;
    const pageIndex = plannedStart >= 0 ? plannedStart : matchedPage >= 0 ? matchedPage : Math.min(compactPages.length - 1, Math.floor(index * Math.max(1, compactPages.length) / Math.max(1, headings.length)));
    const pageText = compactPages[pageIndex] || fallbackText;
    const sentences = pageText.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 55 && sentence.length < 500);
    return {
      title,
      page: pageIndex >= 0 ? pageIndex + 1 : 0,
      excerpt: (sentences.slice(0, 4).join(" ") || fallbackSentences.slice(index * 2, index * 2 + 4).join(" ") || `Source material connected to ${title}.`).slice(0, 1800),
    };
  });
}

async function projectsApi(request: Request, env: Env) {
  const owner = ownerKey(request);
  if (request.method === "GET") {
    const result = await env.DB.prepare("SELECT data_json FROM book_projects WHERE owner_key = ? ORDER BY updated_at DESC").bind(owner).all<{ data_json: string }>();
    return json({ projects: result.results.map((row) => JSON.parse(row.data_json)) });
  }
  if (request.method === "POST") {
    const incoming = await request.json() as { id?: string; title?: string; source?: string; chapters?: DraftChapterInput[] } & Record<string, unknown>;
    const project = { ...incoming, chapters: incoming.chapters ? fitDraftChaptersToBookLimit(incoming.chapters) : incoming.chapters };
    if (!project.id || !project.title || !project.source) return json({ error: "Incomplete book project" }, 400);
    const saved = { ...project, updatedAt: "Just now" };
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO book_projects (id, owner_key, title, source_name, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, source_name = excluded.source_name,
      data_json = excluded.data_json, updated_at = excluded.updated_at
      WHERE book_projects.owner_key = excluded.owner_key`)
      .bind(project.id, owner, project.title, project.source, JSON.stringify(saved), now, now).run();
    return json({ project: saved });
  }
  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "Project id is required" }, 400);
    await env.DB.prepare("DELETE FROM book_projects WHERE id = ? AND owner_key = ?").bind(id, owner).run();
    return json({ deleted: true });
  }
  return json({ error: "Method not allowed" }, 405);
}

async function versionsApi(request: Request, env: Env) {
  const owner = ownerKey(request);
  if (request.method === "GET") {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return json({ error: "Project id is required" }, 400);
    const result = await env.DB.prepare("SELECT id, label, snapshot_json, created_at FROM book_project_versions WHERE project_id = ? AND owner_key = ? ORDER BY created_at DESC")
      .bind(projectId, owner).all<{ id: string; label: string; snapshot_json: string; created_at: string }>();
    return json({ versions: result.results.map((row) => ({ id: row.id, label: row.label, date: row.created_at, snapshot: JSON.parse(row.snapshot_json) })) });
  }
  if (request.method === "POST") {
    const payload = await request.json() as { projectId?: string; label?: string; snapshot?: unknown };
    if (!payload.projectId || !payload.label || !payload.snapshot) return json({ error: "Incomplete version" }, 400);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO book_project_versions (id, project_id, owner_key, label, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, payload.projectId, owner, payload.label, JSON.stringify(payload.snapshot), createdAt).run();
    return json({ version: { id, label: payload.label, date: createdAt, snapshot: payload.snapshot } }, 201);
  }
  return json({ error: "Method not allowed" }, 405);
}

async function preferencesApi(request: Request, env: Env) {
  const owner = ownerKey(request);
  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT preferences_json FROM designer_preferences WHERE owner_key = ?").bind(owner).first<{ preferences_json: string }>();
    return json({ preferences: row ? JSON.parse(row.preferences_json) : [] });
  }
  if (request.method === "POST") {
    const payload = await request.json() as { preferences?: string[] };
    const preferences = (payload.preferences ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100);
    await env.DB.prepare(`INSERT INTO designer_preferences (owner_key, preferences_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(owner_key) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`)
      .bind(owner, JSON.stringify(preferences), new Date().toISOString()).run();
    return json({ preferences });
  }
  return json({ error: "Method not allowed" }, 405);
}

async function imageApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || "unassigned").replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!(file instanceof File)) return json({ error: "Choose an image" }, 400);
  if (!allowedImageTypes.has(file.type)) return json({ error: "Use a JPG, PNG or WebP image" }, 415);
  if (file.size > 10 * 1024 * 1024) return json({ error: "The image must be smaller than 10 MB" }, 413);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `images/${projectId}/${crypto.randomUUID()}.${extension}`;
  await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "private, max-age=86400" }, customMetadata: { originalName: file.name, owner: ownerKey(request) } });
  return json({ image: { key, url: `/api/asset?key=${encodeURIComponent(key)}` } }, 201);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function titleLines(value: string, limit = 34) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > limit) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.slice(0, 3);
}

function visualPalette(aesthetic: string) {
  const key = aesthetic.toLowerCase();
  if (key.includes("storybook")) return { background: "#FFF0D2", paper: "#FFF9EC", ink: "#284338", accent: "#C7523C", gold: "#E5A93F", muted: "#64776E" };
  if (key.includes("bright explorer")) return { background: "#EAF7F1", paper: "#FFFFFF", ink: "#173F4C", accent: "#F06449", gold: "#F2BB3D", muted: "#5E7980" };
  if (key.includes("young scholar")) return { background: "#EEF1E8", paper: "#FCFBF5", ink: "#263D38", accent: "#8C5947", gold: "#BE9848", muted: "#68766F" };
  if (key.includes("modern") || key.includes("minimal")) return { background: "#F2F5F3", paper: "#FFFFFF", ink: "#173A33", accent: "#C96845", gold: "#D4A84F", muted: "#6A7C75" };
  if (key.includes("children") || key.includes("playful")) return { background: "#FFF3DE", paper: "#FFFCF5", ink: "#24463D", accent: "#E66B50", gold: "#F1B94B", muted: "#697A72" };
  return { background: "#EEE4D2", paper: "#FAF6EC", ink: "#173A33", accent: "#A64E35", gold: "#D8A94F", muted: "#66766F" };
}

function visualDiagram(type: string, terms: string[], palette: ReturnType<typeof visualPalette>) {
  const labels = [...terms, "Context", "Meaning", "Connection", "Practice"].slice(0, 5).map((term) => escapeXml(term.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())));
  const label = (x: number, y: number, value: string, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${palette.ink}">${value}</text>`;
  if (type === "map") return `<path d="M170 285 C250 205 345 242 410 192 C495 127 582 190 638 156 C729 102 831 169 964 130 L1000 420 C894 468 814 430 716 485 C622 538 530 470 452 513 C344 573 246 515 168 548 Z" fill="${palette.paper}" stroke="${palette.ink}" stroke-width="4"/><path d="M215 455 C340 373 430 425 532 319 C632 215 727 355 930 210" fill="none" stroke="${palette.accent}" stroke-width="9" stroke-linecap="round" stroke-dasharray="13 16"/><circle cx="248" cy="432" r="18" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="4"/><circle cx="542" cy="309" r="18" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="4"/><circle cx="914" cy="221" r="18" fill="${palette.gold}" stroke="${palette.ink}" stroke-width="4"/>${label(248,488,labels[0])}${label(542,365,labels[1])}${label(914,277,labels[2])}`;
  if (type === "venn") return `<circle cx="440" cy="325" r="165" fill="${palette.accent}" fill-opacity=".28" stroke="${palette.accent}" stroke-width="4"/><circle cx="650" cy="325" r="165" fill="${palette.gold}" fill-opacity=".34" stroke="${palette.gold}" stroke-width="4"/><circle cx="545" cy="470" r="165" fill="${palette.ink}" fill-opacity=".14" stroke="${palette.ink}" stroke-width="4"/>${label(360,290,labels[0])}${label(730,290,labels[1])}${label(545,545,labels[2])}${label(545,390,labels[3])}`;
  if (type === "tree") return `<path d="M600 520 V386 M600 386 L325 240 M600 386 L600 210 M600 386 L875 240" fill="none" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round"/><rect x="455" y="500" width="290" height="88" rx="44" fill="${palette.ink}"/>${label(600,555,labels[0]).replace(`fill="${palette.ink}"`,`fill="${palette.paper}"`)}<rect x="180" y="180" width="290" height="95" rx="28" fill="${palette.paper}" stroke="${palette.accent}" stroke-width="4"/>${label(325,238,labels[1])}<rect x="455" y="120" width="290" height="95" rx="28" fill="${palette.paper}" stroke="${palette.gold}" stroke-width="4"/>${label(600,178,labels[2])}<rect x="730" y="180" width="290" height="95" rx="28" fill="${palette.paper}" stroke="${palette.accent}" stroke-width="4"/>${label(875,238,labels[3])}`;
  if (type === "timeline") return `<path d="M155 360 H1045" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round"/>${[235,475,715,955].map((x, index) => `<circle cx="${x}" cy="360" r="30" fill="${index % 2 ? palette.gold : palette.accent}" stroke="${palette.paper}" stroke-width="7"/><path d="M${x} ${index % 2 ? 330 : 390} V${index % 2 ? 245 : 475}" stroke="${palette.muted}" stroke-width="3"/>${label(x,index % 2 ? 218 : 520,labels[index])}`).join("")}`;
  if (type === "cycle") return `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.accent}"/></marker></defs><path d="M600 165 A205 205 0 0 1 795 505" fill="none" stroke="${palette.accent}" stroke-width="10" marker-end="url(#arrow)"/><path d="M775 530 A205 205 0 0 1 392 500" fill="none" stroke="${palette.gold}" stroke-width="10" marker-end="url(#arrow)"/><path d="M380 475 A205 205 0 0 1 570 165" fill="none" stroke="${palette.ink}" stroke-width="10" marker-end="url(#arrow)"/>${label(600,145,labels[0])}${label(850,535,labels[1])}${label(345,535,labels[2])}<circle cx="600" cy="370" r="92" fill="${palette.paper}" stroke="${palette.ink}" stroke-width="4"/>${label(600,378,labels[3])}`;
  return `<circle cx="600" cy="360" r="116" fill="${palette.ink}"/>${label(600,369,labels[0]).replace(`fill="${palette.ink}"`,`fill="${palette.paper}"`)}${[[250,210],[950,210],[250,520],[950,520]].map(([x,y], index) => `<path d="M600 360 L${x} ${y}" stroke="${index % 2 ? palette.gold : palette.accent}" stroke-width="5"/><circle cx="${x}" cy="${y}" r="92" fill="${palette.paper}" stroke="${index % 2 ? palette.gold : palette.accent}" stroke-width="4"/>${label(x,y+8,labels[index+1])}`).join("")}`;
}

async function visualApi(request: Request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const title = (url.searchParams.get("title") || "Chapter visual").slice(0, 180);
  const terms = (url.searchParams.get("terms") || "Context|Meaning|Connection").split("|").map((term) => term.trim()).filter(Boolean).slice(0, 5);
  const requestedType = url.searchParams.get("type") || "concept";
  const type = new Set(["map", "venn", "tree", "timeline", "cycle", "concept"]).has(requestedType) ? requestedType : "concept";
  const style = (url.searchParams.get("style") || "Editorial illustration").slice(0, 80);
  const aesthetic = (url.searchParams.get("aesthetic") || "Classical Indian").slice(0, 80);
  const chapter = Math.max(1, Math.min(99, Number(url.searchParams.get("chapter")) || 1));
  const palette = visualPalette(`${aesthetic} ${style}`);
  const titleMarkup = titleLines(title).map((line, index) => `<text x="70" y="${94 + index * 48}" font-family="Georgia, serif" font-size="40" font-weight="700" fill="${palette.ink}">${escapeXml(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(title)}</title><desc id="desc">A ${escapeXml(type)} visual based on the chapter concepts ${escapeXml(terms.join(", "))}</desc><rect width="1200" height="760" fill="${palette.background}"/><path d="M0 0 H1200 V28 H0 Z" fill="${palette.accent}"/><text x="70" y="62" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="${palette.accent}">CHAPTER ${String(chapter).padStart(2, "0")} · ${escapeXml(type.toUpperCase())} VISUAL</text>${titleMarkup}<g transform="translate(0 110)">${visualDiagram(type, terms, palette)}</g><text x="70" y="718" font-family="Arial, sans-serif" font-size="15" letter-spacing="2" fill="${palette.muted}">${escapeXml(style.toUpperCase())} · GENERATED FROM THE CHAPTER CONTEXT</text><circle cx="1120" cy="700" r="26" fill="${palette.gold}"/><path d="M1120 683 V717 M1103 700 H1137" stroke="${palette.ink}" stroke-width="4"/></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

async function assetApi(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !/^images\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(png|jpe?g|webp)$/.test(key)) return json({ error: "Invalid image" }, 400);
  const object = await env.BUCKET.get(key);
  if (!object) return json({ error: "Image not found" }, 404);
  const headers = new Headers({ "cache-control": "private, max-age=86400", etag: object.httpEtag });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function manuscriptParagraphs(html: string) {
  const blocks = [...html.matchAll(/<(h1|h2|h3|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi)];
  if (!blocks.length) return [new Paragraph(decodeHtml(html))];
  return blocks.map((match) => {
    const tag = match[1].toLowerCase();
    const text = decodeHtml(match[2]);
    if (tag === "h1") return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 160 } });
    if (tag === "h2" || tag === "h3") return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 } });
    if (tag === "blockquote") return new Paragraph({ children: [new TextRun({ text, italics: true, color: "6E5839" })], indent: { left: 520 }, spacing: { before: 140, after: 140 } });
    if (tag === "li") return new Paragraph({ text, bullet: { level: 0 } });
    return new Paragraph({ text, spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED });
  }).filter((paragraph) => Boolean(paragraph));
}

async function exportDocxApi(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const project = await request.json() as { title?: string; source?: string; audience?: string; citationStyle?: string; fontTheme?: string; chapters?: Array<{ title?: string; body?: string; imageCaption?: string; sourceRefs?: Array<{ title?: string; page?: number }> }> };
  if (!project.title || !project.chapters?.length) return json({ error: "The book has no chapters" }, 400);
  const docxFont = /storybook|serif|literary/i.test(project.fontTheme || "")
    ? "Georgia"
    : /friendly|rounded/i.test(project.fontTheme || "")
      ? "Trebuchet MS"
      : "Aptos";
  const children: Paragraph[] = [
    new Paragraph({ text: project.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 360 } }),
    new Paragraph({ text: `An illustrated book for ${project.audience || "young readers"}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 36 })], pageBreakBefore: true, spacing: { after: 260 } }),
    ...project.chapters.map((chapter, index) => new Paragraph({ text: `${index + 1}. ${chapter.title || `Chapter ${index + 1}`}` })),
  ];
  project.chapters.forEach((chapter, index) => {
    children.push(new Paragraph({ text: chapter.title || `Chapter ${index + 1}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    children.push(...manuscriptParagraphs(authorialReaderHtml(chapter.body || "")));
    if (chapter.imageCaption) children.push(new Paragraph({ children: [new TextRun({ text: `Illustration: ${chapter.imageCaption}`, italics: true, color: "7B6748" })], spacing: { before: 180, after: 180 } }));
  });
  const document = new Document({
    creator: "IKS Book Studio",
    title: project.title,
    description: `An illustrated children’s book for ${project.audience || "young readers"}`,
    styles: { default: { document: { run: { font: docxFont, size: 22 }, paragraph: { spacing: { line: 300 } } } } },
    sections: [{ properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["IKS Book Studio · ", PageNumber.CURRENT] })] })] }) }, children }],
  });
  const blob = await Packer.toBlob(document);
  return new Response(blob, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="book.docx"`, "cache-control": "no-store" } });
}

async function sourceApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || crypto.randomUUID());
  const audience = String(form.get("audience") || "Ages 10–12");
  if (!(file instanceof File)) return json({ error: "Choose a source file" }, 400);
  const extension = sourceExtension(file.name);
  if (!allowedExtensions.has(extension)) return json({ error: "Use a PDF, DOCX, TXT or MD file" }, 415);
  if (file.size > 30 * 1024 * 1024) return json({ error: "The source must be smaller than 30 MB" }, 413);
  const bytes = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const objectKey = `sources/${ownerKey(request)}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  // Persist before PDF parsing because some PDF engines transfer/detach the
  // supplied ArrayBuffer while loading the document.
  await env.BUCKET.put(objectKey, bytes.slice(0), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { originalName: file.name } });
  const { text, pageTexts, pages } = await extractSourcePages(bytes, extension);
  const analysis = analyseText(text);
  const chapterPlans = chapterContextPlans(analysis.headings, pageTexts, audience);
  const sections = makeSections(analysis.headings, pageTexts, text, chapterPlans);
  return json({ source: { name: file.name, size: file.size, objectKey, pages, ...analysis, sections, chapterPlans, quality: analysis.words > 200 ? "Good" : "Needs review — OCR may be required" } });
}

async function reanalyseSourceApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const payload = await request.json() as { source?: string; sourceObjectKey?: string; audience?: string };
  if (!payload.source || !payload.sourceObjectKey) return json({ error: "The stored source is missing" }, 400);
  const ownerPrefix = `sources/${ownerKey(request)}/`;
  if (!payload.sourceObjectKey.startsWith(ownerPrefix)) return json({ error: "The source does not belong to this project" }, 403);
  const source = await env.BUCKET.get(payload.sourceObjectKey);
  if (!source) return json({ error: "The original source file is unavailable. Upload it again to re-detect chapters." }, 404);
  const extension = sourceExtension(payload.source);
  if (!allowedExtensions.has(extension)) return json({ error: "This source format cannot be analysed" }, 415);
  const extracted = await extractSourcePages(await source.arrayBuffer(), extension);
  const analysis = analyseText(extracted.text);
  const chapterPlans = chapterContextPlans(analysis.headings, extracted.pageTexts, payload.audience);
  const sections = makeSections(analysis.headings, extracted.pageTexts, extracted.text, chapterPlans);
  return json({ source: { pages: extracted.pages, ...analysis, sections, chapterPlans, quality: analysis.words > 200 ? "Good" : "Needs review — OCR may be required" } });
}

async function downloadSourceApi(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const key = new URL(request.url).searchParams.get("key") || "";
  const ownerPrefix = `sources/${ownerKey(request)}/`;
  if (!key.startsWith(ownerPrefix)) return json({ error: "The source does not belong to this project" }, 403);
  const source = await env.BUCKET.get(key);
  if (!source) return json({ error: "The original source file is unavailable. Upload it again." }, 404);
  const headers = new Headers({
    "content-type": source.httpMetadata?.contentType || "application/octet-stream",
    "cache-control": "private, no-store",
    "content-disposition": `attachment; filename="${(source.customMetadata?.originalName || "source-book").replace(/[\"\\\r\n]/g, "-")}"`,
    "x-content-type-options": "nosniff",
  });
  return new Response(source.body, { headers });
}

async function draftApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const incoming = await request.json() as DraftProjectInput;
  const project = { ...incoming, chapters: fitDraftChaptersToBookLimit(incoming.chapters ?? []) };
  if (!project.sourceObjectKey || !project.source || !project.chapters.length || !project.chapterIds?.length) {
    return json({ error: "This project is missing its source or chapter plan" }, 400);
  }
  const ownerPrefix = `sources/${ownerKey(request)}/`;
  if (!project.sourceObjectKey.startsWith(ownerPrefix)) return json({ error: "The source does not belong to this project" }, 403);
  const source = await env.BUCKET.get(project.sourceObjectKey);
  if (!source) return json({ error: "The original source file is unavailable. Upload it again to rebuild chapters." }, 404);
  const bytes = await source.arrayBuffer();
  const extension = sourceExtension(project.source);
  if (!allowedExtensions.has(extension)) return json({ error: "This source format cannot be drafted" }, 415);
  const extracted = await extractSourcePages(bytes, extension);
  const requested = new Set(project.chapterIds.map(Number));
  if (requested.size > 1) return json({ error: "For safe progress saving, request exactly one chapter at a time." }, 400);
  if (project.phase7ChapterOneOnly && (requested.size !== 1 || !requested.has(1))) {
    return json({ error: "Phase 7 is locked to Chapter 1 until its measured evaluation passes.", code: "chapter-one-gate" }, 423);
  }
  const chapters = [];
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, requests: 0 };
  const startedAt = Date.now();
  try {
    for (let index = 0; index < project.chapters.length; index += 1) {
      const chapter = project.chapters[index];
      if (!requested.has(chapter.id) || chapter.locked) continue;
      const built = project.repairOnly
        ? await buildTargetedRepair(env, extracted.pageTexts, chapter, index, project.chapters.length, project)
        : await buildPedagogicalDraft(env, extracted.pageTexts, chapter, index, project.chapters.length, project);
      chapters.push(built.chapter);
      usage = addUsage(usage, built.usage);
    }
  } catch (error) {
    if (error instanceof TeachingEngineError) return json({
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      quota: error.quota,
      requestCount: error.requestCount,
    }, error.status);
    throw error;
  }
  if (!chapters.length) return json({ error: "No unlocked chapters were selected" }, 400);
  const durationMs = Date.now() - startedAt;
  let phase7Evaluation: ChapterOneGate | undefined;
  if (project.phase7ChapterOneOnly) {
    const chapter = chapters[0];
    phase7Evaluation = evaluateChapterOneGate({
      usage,
      durationMs,
      wordCount: chapter.wordCount || contentWords(chapter.body?.replace(/<[^>]+>/g, " ") || "").length,
      quality: chapter.pedagogyQuality,
    });
  }
  return json({ chapters, sourcePages: extracted.pages, usage, durationMs, phase7Evaluation });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) await ensureSchema(env);
      if (url.pathname === "/api/projects") return await projectsApi(request, env);
      if (url.pathname === "/api/versions") return await versionsApi(request, env);
      if (url.pathname === "/api/preferences") return await preferencesApi(request, env);
      if (url.pathname === "/api/source") return await sourceApi(request, env);
      if (url.pathname === "/api/source/download") return await downloadSourceApi(request, env);
      if (url.pathname === "/api/source/reanalyse") return await reanalyseSourceApi(request, env);
      if (url.pathname === "/api/ai/status") return await openRouterStatusApi(request, env);
      if (url.pathname === "/api/draft") return await draftApi(request, env);
      if (url.pathname === "/api/image") return await imageApi(request, env);
      if (url.pathname === "/api/visual") return await visualApi(request);
      if (url.pathname === "/api/asset") return await assetApi(request, env);
      if (url.pathname === "/api/export/docx") return await exportDocxApi(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "The request could not be completed" }, 500);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
