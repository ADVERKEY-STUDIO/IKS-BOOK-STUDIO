import { parseVisualDirection } from '../lib/visual-direction.ts';
import { verifyClerkIdentity, clerkConfigured, type ClerkEnvironment } from './clerk-identity.ts';
import { verifyFirebaseIdentity, firebaseConfigured, type FirebaseEnvironment } from './firebase-identity.ts';
import { parseTemplateBook, templates } from '../lib/template-book.ts';
import { BOOK_ARTWORK_BYTES, IMAGE_BYTES, SOURCE_BYTES, SOURCE_CHUNK_BYTES, MiB } from '../lib/template-capacity.ts';
type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes?: number } }> };
export type LibraryEnv = ClerkEnvironment & FirebaseEnvironment & { DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> }; BUCKET: { put(key: string, bytes: ArrayBuffer, options?: unknown): Promise<unknown>; get(key: string): Promise<{ body: ReadableStream } | null>; head(key: string): Promise<{ size: number } | null> }; };
const reply = (data: unknown, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
export async function digest(value: string | ArrayBuffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value))).map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function librarySchema(env: LibraryEnv) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_accounts (email TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_firebase_users (user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_clerk_users (user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS library_books (owner TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(owner,id))'),
  ]);
}
export async function libraryUser(request: Request, env: LibraryEnv, verify = firebaseConfigured(env) ? verifyFirebaseIdentity : verifyClerkIdentity): Promise<string | null> {
  const identity = await verify(request, env);
  if (!identity) return null;
  const table = firebaseConfigured(env) ? 'library_firebase_users' : 'library_clerk_users';
  // The original email remains the storage identity if the Clerk user changes email.
  const existing = await env.DB.prepare(`SELECT email FROM ${table} WHERE user_id=?`).bind(identity.userId).first<{ email: string }>();
  if (existing) return existing.email;
  await env.DB.prepare(`INSERT OR IGNORE INTO ${table}(user_id,email) VALUES (?,?)`).bind(identity.userId, identity.email).run();
  const linked = await env.DB.prepare(`SELECT email FROM ${table} WHERE user_id=?`).bind(identity.userId).first<{ email: string }>();
  if (!linked) throw new Error('This email is already linked to another library account. Use the original account.');
  return linked.email;
}
export async function libraryOwner(email: string, env: LibraryEnv) {
  const row = await env.DB.prepare('SELECT owner FROM library_accounts WHERE email=?').bind(email).first<{ owner: string }>();
  return row?.owner || 'account-' + await digest(email);
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
export async function libraryApi(request: Request, env: LibraryEnv, verify = firebaseConfigured(env) ? verifyFirebaseIdentity : verifyClerkIdentity): Promise<Response> {
  await librarySchema(env);
  const url = new URL(request.url), path = url.pathname;
  if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return reply({ error: 'Open this action from Book Studio.' }, 403);
  if (path === '/api/account/config' && request.method === 'GET') return reply({ firebase: firebaseConfigured(env) ? { apiKey: env.FIREBASE_API_KEY, projectId: env.FIREBASE_PROJECT_ID, authDomain: `${env.FIREBASE_PROJECT_ID}.firebaseapp.com` } : null });
  if (path === '/api/account/firebase-session' && request.method === 'DELETE') return reply({ email: null }, 200, { 'set-cookie': 'iks_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' + (url.protocol === 'https:' ? '; Secure' : '') });
  if (path === '/api/account/firebase-session' && request.method === 'POST') {
    const identity = await verifyFirebaseIdentity(request, env);
    if (!identity) return reply({ error: 'Sign in with a verified email address.' }, 401);
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token || token.length > 8192) return reply({ error: 'Invalid sign-in token.' }, 401);
    return reply({ email: identity.email }, 200, { 'set-cookie': `iks_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${url.protocol === 'https:' ? '; Secure' : ''}` });
  }
  if (['/api/account/request','/api/account/verify','/api/account/logout'].includes(path)) return reply({ error: 'Use Clerk sign-in and account controls.' }, 410);
  const email = await libraryUser(request, env, verify);
  if (path === '/api/account/session' && request.method === 'GET') return reply({ email, configured: firebaseConfigured(env) || clerkConfigured(env) });
  if (!email) return reply({ error: 'Sign in to save and open books across browsers.' }, 401);
  const expectedAccount=request.headers.get('x-library-account');
  if(expectedAccount&&expectedAccount!==email)return reply({error:'The signed-in account changed. Reopen the book in the correct account before saving.'},409);
  if (path === '/api/account/link' && request.method === 'POST') {
    const body = JSON.parse(new TextDecoder().decode(await readLimited(request, 4096)));
    const owner = typeof body.browserOwner === 'string' && /^[a-zA-Z0-9-]{24,100}$/.test(body.browserOwner) ? body.browserOwner : 'account-' + await digest(email);
    const result = await env.DB.prepare('INSERT OR IGNORE INTO library_accounts(email,owner) VALUES (?,?)').bind(email, owner).run();
    // A browser already linked to a different account must not expose that library.
    await env.DB.prepare('INSERT OR IGNORE INTO library_accounts(email,owner) VALUES (?,?)').bind(email, 'account-' + await digest(email)).run();
    return reply({ email, linked: Boolean(result.meta.changes) });
  }
  const owner = await digest(email), prefix = `library/${owner}/`;
  if (path === '/api/library/asset') {
    const hash = url.searchParams.get('hash') || '';
    if (!/^[a-f0-9]{64}$/.test(hash)) return reply({ error: 'Invalid artwork key.' }, 400);
    if (request.method === 'HEAD') {
      const object = await env.BUCKET.head(prefix + hash);
      return new Response(null, { status: object ? 200 : 404, headers: { 'cache-control': 'private, no-store' } });
    }
    if (request.method === 'PUT') {
      const size = Number(request.headers.get('content-length'));
      if (size > SOURCE_CHUNK_BYTES) return reply({ error: 'File exceeds 25 MB.' }, 413);
      const bytes = await readLimited(request, SOURCE_CHUNK_BYTES);
      if (bytes.byteLength > SOURCE_CHUNK_BYTES || await digest(bytes) !== hash) return reply({ error: 'Invalid file or file exceeds 25 MB.' }, 400);
      await env.BUCKET.put(prefix + hash, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
      return reply({ hash });
    }
    if (request.method === 'GET') {
      const object = await env.BUCKET.get(prefix + hash);
      return object ? new Response(object.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } }) : reply({ error: 'Saved file not found.' }, 404);
    }
  }
  if (path === '/api/library/books') {
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id') || '';
      const revision = Number(url.searchParams.get('revision'));
      if (!/^[\w-]{1,100}$/.test(id) || !Number.isSafeInteger(revision) || revision < 1) return reply({ error: 'Invalid book deletion request.' }, 400);
      const result = await env.DB.prepare('DELETE FROM library_books WHERE owner=? AND id=? AND revision=?').bind(owner, id, revision).run();
      if (!result.meta.changes) return reply({ error: 'This account book changed or was already removed. Reload the library before deleting.' }, 409);
      // Assets may be shared by other books; deleting a book must not remove them.
      return reply({ deleted: id });
    }

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
      // A damaged/local-only image map must never erase still-used account artwork.
      const previous = await env.DB.prepare('SELECT data,revision FROM library_books WHERE owner=? AND id=?').bind(owner,data.id).first<{data:string;revision:number}>();
      if(previous && previous.revision === data.revision){
        const saved=JSON.parse(previous.data);
        if(saved.book&&!data.book)return reply({error:'This copy is missing the saved manuscript. Open the account copy before saving. Your account book has not been changed.'},409);
        const used=new Set<string>(data.book?.pages.map((page:{image:string})=>page.image) || Object.keys(saved.images || {}));
        const lost=Object.keys(saved.images || {}).filter(name=>used.has(name)&&!Object.hasOwn(data.images,name));
        if(lost.length)return reply({error:'This copy is missing previously saved artwork. Open the account copy to recover the images before saving. Your account book has not been changed.'},409);
      }
      let total = 0;
      for (const [name, value] of Object.entries(data.images)) {
        const asset = value as { hash: string; type: string };
        if (!/^[\w .-]{1,180}$/.test(name) || !/^[a-f0-9]{64}$/.test(asset.hash) || !['image/png','image/jpeg','image/webp'].includes(asset.type)) return reply({ error: 'Invalid artwork entry.' }, 400);
        const head = await env.BUCKET.head(prefix + asset.hash);
        if (!head) return reply({ error: 'Artwork upload is incomplete. Retry saving.' }, 400);
        if(head.size>IMAGE_BYTES)return reply({error:'Each artwork image must be under 25 MB.'},413);
        total += head.size;
      }
      if (total > BOOK_ARTWORK_BYTES) return reply({ error: `Book artwork exceeds ${BOOK_ARTWORK_BYTES/MiB} MB.` }, 413);
      if (data.source) {
        if(typeof data.source.name!=='string'||data.source.name.length>250||!['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',''].includes(data.source.type))return reply({error:'Invalid source file.'},400);
        const parts=data.source.chunks===undefined?[data.source]:data.source.chunks;
        if(!Array.isArray(parts)||!parts.length||parts.length>Math.ceil(SOURCE_BYTES/SOURCE_CHUNK_BYTES))return reply({error:'Invalid source chunks.'},400);
        let sourceSize=0;
        for(const part of parts){
          if(!part||typeof part.hash!=='string'||!/^[a-f0-9]{64}$/.test(part.hash))return reply({error:'Invalid source file.'},400);
          const head=await env.BUCKET.head(prefix+part.hash);
          if(!head||head.size>SOURCE_CHUNK_BYTES)return reply({error:'Source upload missing or too large.'},400);
          sourceSize+=head.size;
        }
        if(sourceSize>SOURCE_BYTES)return reply({error:'Source file exceeds 500 MB.'},413);
      }
      const visualDirection = parseVisualDirection(data.visualDirection);
      const references = data.references ?? {};
      if (!references || typeof references !== 'object' || Array.isArray(references) || Object.keys(references).length > 3) return reply({ error: 'Choose up to three style references.' }, 400);
      for (const [name, value] of Object.entries(references)) {
        const asset = value as { hash: string; type: string };
        if (!/^reference-[\w-]+\.(png|jpe?g|webp)$/i.test(name) || !asset || !/^[a-f0-9]{64}$/.test(asset.hash) || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.type)) return reply({ error: 'Invalid style reference.' }, 400);
        const head = await env.BUCKET.head(prefix + asset.hash);
        if (!head || head.size > 25 * 1024 * 1024) return reply({ error: 'Style reference upload missing or too large.' }, 400);
      }
      const revision = data.revision + 1;
      const clean = { id: data.id, title: data.title, language: data.language, templateId: data.templateId, book: data.book, visualDirection, references, images: data.images, source: data.source, updated: Date.now() };
      const result = data.revision === 0
        ? await env.DB.prepare('INSERT OR IGNORE INTO library_books(owner,id,revision,data) VALUES (?,?,?,?)').bind(owner, data.id, revision, JSON.stringify(clean)).run()
        : await env.DB.prepare('UPDATE library_books SET revision=?,data=? WHERE owner=? AND id=? AND revision=?').bind(revision, JSON.stringify(clean), owner, data.id, data.revision).run();
      if (!result.meta.changes) return reply({ error: 'This book changed in another browser. Open the cloud copy before saving again; your local changes are kept.' }, 409);
      return reply({ revision });
    }
  }
  return reply({ error: 'Not found' }, 404);
}
