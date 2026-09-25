import test from 'node:test';
import assert from 'node:assert/strict';
import { saveWithFallback } from '../lib/template-save.ts';
test('account save succeeds when browser storage is full', async()=>{
 let uploaded=false;
 const result=await saveWithFallback({id:'book'},async()=>{throw new DOMException('Full','QuotaExceededError');},async value=>{uploaded=true;return {...value,revision:1};});
 assert.equal(uploaded,true);assert.equal(result.value.revision,1);assert.equal(result.localError.name,'QuotaExceededError');
});
test('local-only failure remains visible and account failure is not reported as success',async()=>{
 await assert.rejects(saveWithFallback({},async()=>{throw Error('local');}),/local/);
 await assert.rejects(saveWithFallback({},async()=>{},async()=>{throw Error('cloud');}),/cloud/);
});
test('network or account failure still writes the only local recovery copy',async()=>{
 let local;
 const draft={id:'imported',images:{'page.png':new Blob(['artwork'])}};
 await assert.rejects(saveWithFallback(draft,async value=>{local=value},async()=>{throw Error('offline')}),/offline/);
 assert.equal(local,draft);
 assert.equal(await local.images['page.png'].text(),'artwork');
});
