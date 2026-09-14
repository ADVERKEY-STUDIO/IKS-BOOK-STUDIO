import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { libraryApi as api, libraryUser, libraryOwner } from '../worker/library.ts';
const identities = new Map();
const verifier = async request => identities.get(request.headers.get('cookie')) || null;
const libraryApi = (request, env) => api(request, env, verifier);
function environment() {
 const db = new DatabaseSync(':memory:');
 const wrap = (sql, values=[]) => ({ bind: (...args) => wrap(sql,args), first: async () => db.prepare(sql).get(...values) || null, all: async () => ({ results: db.prepare(sql).all(...values) }), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }) });
 const objects = new Map();
 return { DB: { prepare: sql => wrap(sql), batch: async statements => Promise.all(statements.map(s=>s.run())) }, BUCKET: { put: async (key,bytes) => objects.set(key,new Uint8Array(bytes)), head: async key => objects.has(key) ? {size:objects.get(key).length} : null, get: async key => objects.has(key) ? {body:objects.get(key)} : null } };
}
const req = (path, method='GET', data, cookie='') => new Request('https://studio.test'+path, {method,headers:{origin:'https://studio.test',cookie,'content-type':'application/json'},body:data === undefined ? undefined : JSON.stringify(data)});
async function signIn(env,email,userId='user-'+email) {
 const cookie=crypto.randomUUID(); identities.set(cookie,{userId,email});
 const session=await libraryApi(req('/api/account/session','GET',undefined,cookie),env);
 assert.equal(session.status,200);
 return {cookie};
}
test('email sessions restore the same saved book and bytes in a second browser, with isolation and conflict checks',async()=>{
 const env=environment();
 assert.equal((await libraryApi(req('/api/library/books'),env)).status,401);
 const a=await signIn(env,'reader@example.com');
 const bytes=new Uint8Array([1,2,3,4]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const assetReq=new Request('https://studio.test/api/library/asset?hash='+hash,{method:'PUT',headers:{origin:'https://studio.test',cookie:a.cookie},body:bytes});
 assert.equal((await libraryApi(assetReq,env)).status,200);
 const book={id:'saved-book',templateId:'panorama',title:'My saved book',language:'English',images:{'page.png':{hash,type:'image/png'}},revision:0};
 assert.equal((await libraryApi(req('/api/library/books','PUT',book,a.cookie),env)).status,200);
 const b=await signIn(env,'reader@example.com');
 const restored=await (await libraryApi(req('/api/library/books','GET',undefined,b.cookie),env)).json();
 assert.equal(restored.books[0].title,book.title);
 assert.equal(restored.books[0].revision,1);
 const image=await libraryApi(req('/api/library/asset?hash='+hash,'GET',undefined,b.cookie),env);
 assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 assert.equal((await libraryApi(req('/api/library/books','PUT',book,a.cookie),env)).status,409);
 const stranger=await signIn(env,'other@example.com');
 assert.deepEqual((await (await libraryApi(req('/api/library/books','GET',undefined,stranger.cookie),env)).json()).books,[]);
 assert.equal((await libraryApi(req('/api/library/asset?hash='+hash,'GET',undefined,stranger.cookie),env)).status,404);
 identities.delete(b.cookie);
 assert.equal((await libraryApi(req('/api/library/books','GET',undefined,b.cookie),env)).status,401);
});
test('retired email endpoints and foreign-origin writes cannot bypass Clerk',async()=>{
 const env=environment();
 assert.equal((await libraryApi(req('/api/account/request','POST',{email:'reader@example.com'}),env)).status,410);
 assert.equal((await libraryApi(new Request('https://studio.test/api/account/request',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}),env)).status,403);
});

test('client save and open round-trip manuscript, source file, artwork, and revision across sessions',async()=>{
 const { uploadDraft, downloadDraft } = await import('../lib/template-storage.ts');
 const env=environment(); let session=(await signIn(env,'book@example.com')).cookie;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(path,options={})=>{
  const headers=new Headers(options.headers); headers.set('origin','https://studio.test'); headers.set('cookie',session);
  return libraryApi(new Request(new URL(path,'https://studio.test'),{...options,headers}),env);
 };
 try {
  const draft={id:'cross-browser-book',templateId:'panorama',title:'Courage',language:'Awadhi',updated:123,source:new File(['source text'],'original.pdf',{type:'application/pdf'}),images:{'spread-01.png':new Blob(['original artwork'],{type:'image/png'})},book:{format:'iks-template-book-v1',projectId:'cross-browser-book',templateId:'panorama',title:'Courage',language:'Awadhi',characterGuide:'Consistent characters',pages:[{id:'spread-01',title:'Invocation',original:'श्री गुरु चरन',meaning:'A prayer',sourceReference:'PDF page 1',scene:'A quiet river',image:'spread-01.png',layout:'panorama',fontSize:22,imageScale:100}]}};
  const saved=await uploadDraft(draft,'book@example.com');
  assert.equal(saved.cloud.revision,1);
  session=(await signIn(env,'book@example.com')).cookie;
  const catalogue=await(await globalThis.fetch('/api/library/books')).json();
  const restored=await downloadDraft(catalogue.books[0],'book@example.com');
  assert.equal(restored.book.pages[0].original,'श्री गुरु चरन');
  assert.equal(await restored.images['spread-01.png'].text(),'original artwork');
  assert.equal(restored.source.name,'original.pdf');
  assert.equal(await restored.source.text(),'source text');
  const revised=await uploadDraft({...restored,title:'New title'},'book@example.com');
  assert.equal(revised.cloud.revision,2);
  await assert.rejects(uploadDraft(saved,'book@example.com'),/changed in another browser/);
 } finally { globalThis.fetch=originalFetch; }
});

test('Clerk account ID preserves storage identity across email changes and links the original browser library',async()=>{
 const env=environment();
 const a=await signIn(env,'original@example.com','user-stable');
 const browserOwner='browser-123456789012345678901234';
 assert.equal((await libraryApi(req('/api/account/link','POST',{browserOwner},a.cookie),env)).status,200);
 assert.equal(await libraryOwner('original@example.com',env),browserOwner);
 const b=await signIn(env,'changed@example.com','user-stable');
 assert.equal(await libraryUser(req('/api/account/session','GET',undefined,b.cookie),env,verifier),'original@example.com');
 const other=await signIn(env,'other@example.com');
 await libraryApi(req('/api/account/link','POST',{browserOwner},other.cookie),env);
 assert.notEqual(await libraryOwner('other@example.com',env),browserOwner);
 identities.delete(a.cookie);
 assert.equal(await libraryUser(req('/api/account/session','GET',undefined,a.cookie),env,verifier),null);
});
