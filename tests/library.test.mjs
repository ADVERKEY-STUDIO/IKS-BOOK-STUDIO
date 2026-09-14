import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { libraryApi } from '../worker/library.ts';
function environment() {
 const db = new DatabaseSync(':memory:');
 const wrap = (sql, values=[]) => ({ bind: (...args) => wrap(sql,args), first: async () => db.prepare(sql).get(...values) || null, all: async () => ({ results: db.prepare(sql).all(...values) }), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }) });
 const objects = new Map();
 return { DB: { prepare: sql => wrap(sql), batch: async statements => Promise.all(statements.map(s=>s.run())) }, BUCKET: { put: async (key,bytes) => objects.set(key,new Uint8Array(bytes)), head: async key => objects.has(key) ? {size:objects.get(key).length} : null, get: async key => objects.has(key) ? {body:objects.get(key)} : null }, RESEND_API_KEY:'test-only', AUTH_EMAIL_FROM:'test@example.com' };
}
const req = (path, method='GET', data, cookie='') => new Request('https://studio.test'+path, {method,headers:{origin:'https://studio.test',cookie,'content-type':'application/json'},body:data === undefined ? undefined : JSON.stringify(data)});
async function signIn(env,email) {
 let code;
 const sent = await libraryApi(req('/api/account/request','POST',{email}),env,async (_,options)=>{code=JSON.parse(options.body).text.match(/code is (\d+)/)[1]; return Response.json({id:'test'});});
 assert.equal(sent.status,200);
 const verified=await libraryApi(req('/api/account/verify','POST',{email,code}),env);
 assert.equal(verified.status,200);
 assert.match(verified.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 return {cookie:verified.headers.get('set-cookie').split(';')[0],code};
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
 assert.equal((await libraryApi(req('/api/account/verify','POST',{email:'reader@example.com',code:b.code}),env)).status,401);
 await libraryApi(req('/api/account/logout','POST',{},b.cookie),env);
 assert.equal((await libraryApi(req('/api/library/books','GET',undefined,b.cookie),env)).status,401);
});
test('email setup failures and foreign-origin writes do not pretend to save',async()=>{
 const env=environment(); delete env.RESEND_API_KEY;
 assert.equal((await libraryApi(req('/api/account/request','POST',{email:'reader@example.com'}),env)).status,503);
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

test('verification attempt limits, expiry, and initial browser library mapping',async()=>{
 const { libraryOwner }=await import('../worker/library.ts');
 const env=environment(); let code;
 await libraryApi(req('/api/account/request','POST',{email:'owner@example.com'}),env,async(_,options)=>{code=JSON.parse(options.body).text.match(/code is (\d+)/)[1]; return Response.json({});});
 const browserOwner='browser-123456789012345678901234';
 const verified=await libraryApi(req('/api/account/verify','POST',{email:'owner@example.com',code,browserOwner}),env);
 assert.equal(verified.status,200);
 assert.equal(await libraryOwner('owner@example.com',env),browserOwner);
 await signIn(env,'owner@example.com');
 assert.equal(await libraryOwner('owner@example.com',env),browserOwner);
 await libraryApi(req('/api/account/request','POST',{email:'limited@example.com'}),env,async(_,options)=>{code=JSON.parse(options.body).text.match(/code is (\d+)/)[1]; return Response.json({});});
 const wrong=code==='00000000'?'11111111':'00000000';
 for(let i=0;i<5;i++) assert.equal((await libraryApi(req('/api/account/verify','POST',{email:'limited@example.com',code:wrong}),env)).status,401);
 assert.equal((await libraryApi(req('/api/account/verify','POST',{email:'limited@example.com',code}),env)).status,401);
 await env.DB.prepare('UPDATE library_codes SET expires=0,attempts=0 WHERE email=?').bind('limited@example.com').run();
 assert.equal((await libraryApi(req('/api/account/verify','POST',{email:'limited@example.com',code}),env)).status,401);
});
