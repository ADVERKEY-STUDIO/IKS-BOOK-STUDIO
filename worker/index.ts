/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

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
const stopWords = new Set("about after again also among and are because been before being between book can chapter could did does each for from had has have into its may more most not other our out over page pages part should some such than that the their them then there these they this through under use used using very was were what when where which while who will with would your".split(" "));
let schemaReady: Promise<void> | null = null;

function ensureSchema(env: Env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS book_projects (id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL, title TEXT NOT NULL, source_name TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS book_projects_owner_updated_idx ON book_projects (owner_key, updated_at)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS book_project_versions (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, owner_key TEXT NOT NULL, label TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (project_id) REFERENCES book_projects(id) ON DELETE CASCADE)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS book_versions_project_created_idx ON book_project_versions (project_id, created_at)"),
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
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    text = typeof extracted.text === "string" ? extracted.text : extracted.text.join("\n\n");
    pages = extracted.totalPages;
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ arrayBuffer: bytes })).value;
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const analysis = analyseText(text);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const objectKey = `sources/${ownerKey(request)}/${projectId}/${crypto.randomUUID()}-${safeName}`;
  await env.BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { originalName: file.name } });
  return json({ source: { name: file.name, size: file.size, objectKey, pages, ...analysis, quality: analysis.words > 200 ? "Good" : "Needs review" } });
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
      if (url.pathname === "/api/source") return await sourceApi(request, env);
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
