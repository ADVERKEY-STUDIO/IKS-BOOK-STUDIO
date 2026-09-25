import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSaveQueue,recoverDraftImages} from '../lib/template-backup.ts';
import {downloadDraft} from '../lib/template-storage.ts';
const fixture=()=>({id:'book',templateId:'panorama',title:'Book',language:'English',images:{},updated:1});
test('automatic and manual backups serialize and reuse only acknowledged revisions',async()=>{
 let revision=0,active=0;const observed=[];
 const queue=accountSaveQueue(async(draft,email)=>{assert.equal(active++,0);observed.push(draft.cloud?.revision||0);await Promise.resolve();active--;return {...draft,cloud:{email,revision:++revision,savedUpdated:draft.updated}};});
 const a=fixture(),b={...a,updated:2};
 const results=await Promise.all([queue(a,'a@example.com'),queue(b,'a@example.com')]);
 assert.deepEqual(observed,[0,1]);assert.equal(results[1].cloud.savedUpdated,2);
 await queue(a,'b@example.com');assert.equal(observed[2],0);
});
test('a failed upload does not block retries or advance revision',async()=>{
 let count=0;
 const queue=accountSaveQueue(async(draft,email)=>{if(++count===1)throw Error('offline');assert.equal(draft.cloud,undefined);return {...draft,cloud:{email,revision:1,savedUpdated:1}}});
 await assert.rejects(queue(fixture(),'a'),/offline/);assert.equal((await queue(fixture(),'a')).cloud.revision,1);
});
test('cloud recovery restores missing images without replacing local manuscript or edited artwork',async()=>{
 const bytes=new TextEncoder().encode('saved artwork');const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const account={...fixture(),revision:3,images:{'missing.png':{hash,type:'image/png'},'edited.png':{hash,type:'image/png'}}};
 const local={...fixture(),book:{pages:[{original:'New local writing'}]},images:{'edited.png':new Blob(['edited artwork'])}};
 const original=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url,options)=>{requests.push([url,options]);return new Response(bytes)};
 try{
 const restored=await recoverDraftImages(local,account,'a@example.com');
 assert.equal(await restored.images['missing.png'].text(),'saved artwork');assert.equal(restored.book,local.book);assert.equal(restored.images['edited.png'],local.images['edited.png']);assert.equal(requests.length,1);
 assert.equal(requests[0][1].headers['x-library-account'],'a@example.com');
 assert.equal(await recoverDraftImages({...local,cloud:{email:'other'}},account,'a@example.com').then(v=>v.images['missing.png']),undefined);
 }finally{globalThis.fetch=original;}
});
test('truncated account downloads are rejected instead of persisted as lost images',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('truncated');
 try{await assert.rejects(downloadDraft({...fixture(),revision:1,images:{'image.png':{hash:'a'.repeat(64),type:'image/png'}}},'a'),/integrity check/);}finally{globalThis.fetch=original;}
});
