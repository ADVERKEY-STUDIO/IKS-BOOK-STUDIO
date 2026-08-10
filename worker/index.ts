/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { AlignmentType, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, TextRun } from "docx";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

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

function analyseText(text: string) {
  const compact = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ");
  const words = compact.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  const lines = compact.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const contentsIndex = lines.findIndex((line) => /^contents$/i.test(line));
  const contentsHeadings = contentsIndex < 0 ? [] : lines.slice(contentsIndex + 1, contentsIndex + 180)
    .map((line) => line.match(/^(\d{1,2})\.\s+(?!\d)(.+?)(?:\s+\d+\s*[-–]\s*\d+)?$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[2].replace(/\s+\d+\s*[-–]\s*\d+\s*$/, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 100);
  const structuralHeadings = lines.filter((line) => line.length >= 4 && line.length <= 90 && (
    /^(chapter|unit|part|section|book)\s+[\divxlc]+\b/i.test(line)
    || (/^[A-Z\d][A-Z\d :,'’&-]+$/.test(line) && line.split(/\s+/).length <= 10)
  )).filter((line, index, array) => array.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index).slice(0, 18);
  const headings = (contentsHeadings.length >= 2 ? contentsHeadings : structuralHeadings)
    .filter((line, index, array) => array.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index)
    .slice(0, 18);
  const frequency = new Map<string, number>();
  for (const raw of words) {
    const word = raw.toLowerCase().replace(/^['’-]+|['’-]+$/g, "");
    if (word.length < 5 || stopWords.has(word) || /^\d+$/.test(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const terms = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
  return { words: words.length, headings, terms, preview: compact.slice(0, 12000) };
}

function makeSections(headings: string[], pageTexts: string[], fallbackText: string) {
  const compactPages = pageTexts.map((page) => page.replace(/\s+/g, " ").trim());
  const fallbackSentences = fallbackText.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 55 && sentence.length < 500);
  return headings.map((title, index) => {
    const words = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3);
    const matchedPage = compactPages.findIndex((page) => words.length > 0 && words.filter((word) => page.toLowerCase().includes(word)).length >= Math.min(2, words.length));
    const pageIndex = matchedPage >= 0 ? matchedPage : Math.min(compactPages.length - 1, Math.floor(index * Math.max(1, compactPages.length) / Math.max(1, headings.length)));
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
    const project = await request.json() as { id?: string; title?: string; source?: string };
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
  const project = await request.json() as { title?: string; source?: string; audience?: string; citationStyle?: string; chapters?: Array<{ title?: string; body?: string; imageCaption?: string; sourceRefs?: Array<{ title?: string; page?: number }> }> };
  if (!project.title || !project.chapters?.length) return json({ error: "The book has no chapters" }, 400);
  const children: Paragraph[] = [
    new Paragraph({ text: project.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 360 } }),
    new Paragraph({ text: `Adapted from ${project.source || "uploaded source"}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Prepared for ${project.audience || "the selected reader"}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 36 })], pageBreakBefore: true, spacing: { after: 260 } }),
    ...project.chapters.map((chapter, index) => new Paragraph({ text: `${index + 1}. ${chapter.title || `Chapter ${index + 1}`}` })),
  ];
  project.chapters.forEach((chapter, index) => {
    children.push(new Paragraph({ text: chapter.title || `Chapter ${index + 1}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    children.push(...manuscriptParagraphs(chapter.body || ""));
    if (chapter.imageCaption) children.push(new Paragraph({ children: [new TextRun({ text: `Illustration: ${chapter.imageCaption}`, italics: true, color: "7B6748" })], spacing: { before: 180, after: 180 } }));
    if (chapter.sourceRefs?.length) {
      children.push(new Paragraph({ text: "Source notes", heading: HeadingLevel.HEADING_2 }));
      chapter.sourceRefs.forEach((ref) => children.push(new Paragraph({ text: `${ref.title || "Source"}, p. ${ref.page || "—"}`, bullet: { level: 0 } })));
    }
  });
  const document = new Document({
    creator: "IKS Book Studio",
    title: project.title,
    description: `Adapted from ${project.source || "an uploaded source"}`,
    styles: { default: { document: { run: { font: "Aptos", size: 22 }, paragraph: { spacing: { line: 300 } } } } },
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
  if (!(file instanceof File)) return json({ error: "Choose a source file" }, 400);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) return json({ error: "Use a PDF, DOCX, TXT or MD file" }, 415);
  if (file.size > 30 * 1024 * 1024) return json({ error: "The source must be smaller than 30 MB" }, 413);
  const bytes = await file.arrayBuffer();
  let text = "";
  let pages = 0;
  let pageTexts: string[] = [];
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: false });
    pageTexts = typeof extracted.text === "string" ? [extracted.text] : extracted.text;
    text = pageTexts.join("\n\n");
    pages = extracted.totalPages;
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
    pageTexts = [text];
  } else {
    text = new TextDecoder().decode(bytes);
    pageTexts = [text];
  }
  const analysis = analyseText(text);
  const sections = makeSections(analysis.headings, pageTexts, text);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const objectKey = `sources/${ownerKey(request)}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  await env.BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { originalName: file.name } });
  return json({ source: { name: file.name, size: file.size, objectKey, pages, ...analysis, sections, quality: analysis.words > 200 ? "Good" : "Needs review — OCR may be required" } });
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
      if (url.pathname === "/api/image") return await imageApi(request, env);
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
