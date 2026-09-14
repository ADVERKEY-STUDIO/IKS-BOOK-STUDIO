import { parseTemplateBook, templates } from '../lib/template-book.ts';
import { BOOK_ARTWORK_BYTES, IMAGE_BYTES } from '../lib/template-capacity.ts';
type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes?: number } }> };
export type LibraryEnv = { DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> }; BUCKET: { put(key: string, bytes: ArrayBuffer, options?: unknown): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream } | null>; head(key: string): Promise<{ size: number } | null> }; RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string };
const reply = (data: unknown, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
export async function digest(value: string | ArrayBuffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value))).map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function librarySchema(env: LibraryEnv) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_accounts (email TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_codes (email TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_sessions (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_rates (key TEXT PRIMARY KEY, count INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_books (owner TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(owner,id))'),
  ]);
}
function cookie(request: Request, token: string, age: number) { return `iks_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
export async function libraryUser(request: Request, env: LibraryEnv): Promise<string | null> {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)iks_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  const row = await env.DB.prepare('SELECT email FROM library_sessions WHERE hash = ? AND expires > ?').bind(await digest(token), Date.now()).first<{ email: string }>();
  return row?.email || null;
}
export async function libraryOwner(email: string, env: LibraryEnv) {
  const row = await env.DB.prepare('SELECT owner FROM library_accounts WHERE email=?').bind(email).first<{ owner: string }>();
  return row?.owner || 'account-' + await digest(email);
}
async function limited(env: LibraryEnv, key: string, max: number) {
  const row = await env.DB.prepare('INSERT INTO library_rates(key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key).first<{ count: number }>();
  return !row || row.count > max;
}
async function readLimited(request: Request, max: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get('content-length')) > max) throw new Error('Upload is too large.');
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > max) { await reader.cancel(); throw new Error('Upload is too large.'); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result.buffer;
}
export async function libraryApi(request: Request, env: LibraryEnv, send: typeof fetch = fetch): Promise<Response> {
  await librarySchema(env);
  const url = new URL(request.url), path = url.pathname;
  if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return reply({ error: 'Open this action from Book Studio.' }, 403);
  if (path === '/api/account/request' && request.method === 'POST') {
    if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) return reply({ error: 'Email sign-in is not configured yet. Your browser saves still work.' }, 503);
    const { email: raw } = JSON.parse(new TextDecoder().decode(await readLimited(request, 4096))) as { email?: string };
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Enter a valid email address.' }, 400);
    const hour = Math.floor(Date.now() / 3600000);
    if (await limited(env, `ip:${request.headers.get('cf-connecting-ip') || 'local'}:${hour}`, 20) || await limited(env, `email:${email}:${hour}`, 5)) return reply({ error: 'Too many requests. Try again in an hour.' }, 429);
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(bytes).map(v => String(v % 10)).join('');
    await env.DB.prepare('INSERT INTO library_codes(email,hash,expires,attempts) VALUES (?,?,?,0) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,expires=excluded.expires,attempts=0').bind(email, await digest(`${email}:${code}`), Date.now() + 600000).run();
    const result = await send('https://api.resend.com/emails', { signal: AbortSignal.timeout(15000), method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.AUTH_EMAIL_FROM, to: [email], subject: 'Your Book Studio sign-in code', text: `Your Book Studio code is ${code}. It expires in 10 minutes. Enter it only in Book Studio. If you did not request this code, ignore this email.` }) });
    if (!result.ok) return reply({ error: 'The verification email could not be sent. Please try again later.' }, 502);
    return reply({ sent: true });
  }
  if (path === '/api/account/verify' && request.method === 'POST') {
    const body = JSON.parse(new TextDecoder().decode(await readLimited(request, 4096))) as { email?: string; code?: string; browserOwner?: string };
    const email = String(body.email || '').trim().toLowerCase(), code = String(body.code || '');
    if (!/^\d{8}$/.test(code)) return reply({ error: 'Enter the eight-digit email code.' }, 400);
    const row = await env.DB.prepare('UPDATE library_codes SET attempts=attempts+1 WHERE email=? AND expires>? AND attempts<5 RETURNING hash').bind(email, Date.now()).first<{ hash: string }>();
    if (!row || row.hash !== await digest(`${email}:${code}`)) return reply({ error: 'Invalid or expired code. Request a new one.' }, 401);
    const consumed = await env.DB.prepare('DELETE FROM library_codes WHERE email=? AND hash=?').bind(email, row.hash).run();
    if (!consumed.meta.changes) return reply({ error: 'This code was already used.' }, 401);
    const owner = typeof body.browserOwner === 'string' && /^[a-zA-Z0-9-]{24,100}$/.test(body.browserOwner) ? body.browserOwner : 'account-' + await digest(email);
    await env.DB.prepare('INSERT OR IGNORE INTO library_accounts(email,owner) VALUES (?,?)').bind(email, owner).run();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO library_sessions(hash,email,expires) VALUES (?,?,?)').bind(await digest(token), email, Date.now() + 30 * 86400000).run();
    return reply({ email }, 200, { 'set-cookie': cookie(request, token, 30 * 86400) });
  }
  const email = await libraryUser(request, env);
  if (path === '/api/account/session' && request.method === 'GET') return reply({ email, configured: Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM) });
  if (path === '/api/account/logout' && request.method === 'POST') {
    const token = request.headers.get('cookie')?.match(/iks_session=([a-f0-9]{64})/)?.[1];
    if (token) await env.DB.prepare('DELETE FROM library_sessions WHERE hash=?').bind(await digest(token)).run();
    return reply({ signedOut: true }, 200, { 'set-cookie': cookie(request, '', 0) });
  }
  if (!email) return reply({ error: 'Sign in to save and open books across browsers.' }, 401);
  const owner = await digest(email), prefix = `library/${owner}/`;
  if (path === '/api/library/asset') {
    const hash = url.searchParams.get('hash') || '';
    if (!/^[a-f0-9]{64}$/.test(hash)) return reply({ error: 'Invalid artwork key.' }, 400);
    if (request.method === 'PUT') {
      const size = Number(request.headers.get('content-length'));
      if (size > IMAGE_BYTES) return reply({ error: 'File exceeds 25 MB.' }, 413);
      const bytes = await readLimited(request, IMAGE_BYTES);
      if (bytes.byteLength > IMAGE_BYTES || await digest(bytes) !== hash) return reply({ error: 'Invalid file or file exceeds 25 MB.' }, 400);
      await env.BUCKET.put(prefix + hash, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
      return reply({ hash });
    }
    if (request.method === 'GET') {
      const object = await env.BUCKET.get(prefix + hash);
      return object ? new Response(object.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } }) : reply({ error: 'Saved file not found.' }, 404);
    }
  }
  if (path === '/api/library/books') {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare('SELECT data,revision FROM library_books WHERE owner=?').bind(owner).all<{ data: string; revision: number }>();
      return reply({ books: rows.results.map((row: { data: string; revision: number }) => ({ ...JSON.parse(row.data), revision: row.revision })) });
    }
    if (request.method === 'PUT') {
      const text = new TextDecoder().decode(await readLimited(request, 2 * 1024 * 1024));
      if (text.length > 2 * 1024 * 1024) return reply({ error: 'Book text is too large.' }, 413);
      const data = JSON.parse(text);
      if (!/^[\w-]{1,100}$/.test(data.id) || !templates.some(t => t.id === data.templateId) || typeof data.title !== 'string' || data.title.length > 500 || typeof data.language !== 'string' || data.language.length > 500 || !Number.isSafeInteger(data.revision) || data.revision < 0) return reply({ error: 'Invalid book metadata.' }, 400);
      if (data.book) data.book = parseTemplateBook(data.book, data.id);
      if (!data.images || typeof data.images !== 'object' || Array.isArray(data.images) || Object.keys(data.images).length > 250) return reply({ error: 'Invalid artwork manifest.' }, 400);
      let total = 0;
      for (const [name, value] of Object.entries(data.images)) {
        const asset = value as { hash: string; type: string };
        if (!/^[\w .-]{1,180}$/.test(name) || !/^[a-f0-9]{64}$/.test(asset.hash) || !['image/png','image/jpeg','image/webp'].includes(asset.type)) return reply({ error: 'Invalid artwork entry.' }, 400);
        const head = await env.BUCKET.head(prefix + asset.hash);
        if (!head) return reply({ error: 'Artwork upload is incomplete. Retry saving.' }, 400);
        total += head.size;
      }
      if (total > BOOK_ARTWORK_BYTES) return reply({ error: 'Book artwork exceeds 512 MB.' }, 413);
      if (data.source) {
        if (!/^[a-f0-9]{64}$/.test(data.source.hash) || typeof data.source.name !== 'string' || data.source.name.length > 250 || !['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',''].includes(data.source.type)) return reply({ error: 'Invalid source file.' }, 400);
        const head = await env.BUCKET.head(prefix + data.source.hash);
        if (!head || head.size > 20 * 1024 * 1024) return reply({ error: 'Source upload missing or too large.' }, 400);
      }
      const revision = data.revision + 1;
      const clean = { id: data.id, title: data.title, language: data.language, templateId: data.templateId, book: data.book, images: data.images, source: data.source, updated: Date.now() };
      const result = data.revision === 0
        ? await env.DB.prepare('INSERT OR IGNORE INTO library_books(owner,id,revision,data) VALUES (?,?,?,?)').bind(owner, data.id, revision, JSON.stringify(clean)).run()
        : await env.DB.prepare('UPDATE library_books SET revision=?,data=? WHERE owner=? AND id=? AND revision=?').bind(revision, JSON.stringify(clean), owner, data.id, data.revision).run();
      if (!result.meta.changes) return reply({ error: 'This book changed in another browser. Open the cloud copy before saving again; your local changes are kept.' }, 409);
      return reply({ revision });
    }
  }
  return reply({ error: 'Not found' }, 404);
}
