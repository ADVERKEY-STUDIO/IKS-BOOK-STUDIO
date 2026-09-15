import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadDraft } from '../lib/template-storage.ts';
test('repeat saves transfer metadata only; changed artwork uploads once',async()=>{
 const original=globalThis.fetch;const stored=new Set();let uploads=0;let revision=0;
 globalThis.fetch=async(path,options)=>{
  if(path==='/api/library/books')return Response.json({revision:++revision});
  if(options.method==='HEAD')return new Response(null,{status:stored.has(path)?200:404});
  uploads++;stored.add(path);return Response.json({});
 };
 try {
  let draft={id:'test',templateId:'wild',title:'Test',language:'English',images:{'one.png':new Blob(['art'],{type:'image/png'})},updated:1};
  draft=await uploadDraft(draft,'test@example.com');assert.equal(uploads,1);
  draft=await uploadDraft({...draft,title:'Edited'},'test@example.com');assert.equal(uploads,1);assert.equal(draft.cloud.revision,2);
  await uploadDraft({...draft,images:{'one.png':new Blob(['new art'],{type:'image/png'})}},'test@example.com');assert.equal(uploads,2);
 }finally{globalThis.fetch=original;}
});
test('authorization failures do not upload files or commit the book',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(null,{status:401});};
 try{await assert.rejects(uploadDraft({images:{a:new Blob(['a'])}},'test@example.com'));assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('unreadable artwork identifies the file instead of a generic abort',async()=>{
 const broken=new Blob(['art']);
 broken.arrayBuffer=async()=>{throw new DOMException('The operation was aborted.','AbortError');};
 await assert.rejects(uploadDraft({images:{'spread-07.png':broken}},'test@example.com'),/spread-07.png.*could not be read/);
});
