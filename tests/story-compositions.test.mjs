import test from 'node:test';
import assert from 'node:assert/strict';
import {storyCompositions,storyCompositionAt,storyTextBlocks,splitStoryText} from '../lib/story-compositions.ts';
import {parseTemplateBook,renderTemplateBook,continuationPrompt} from '../lib/template-book.ts';
import {templateReferenceEntries} from '../lib/template-reference-package.ts';
import {templateReferenceApi} from '../worker/template-reference.ts';
const fixture=composition=>({format:'iks-template-book-v1',projectId:'book',templateId:'beanstalk-adventure',title:'Prayer',language:'Hindi',characterGuide:'Simplified expressive figures',pages:[{id:'one',image:'one.png',layout:'story-scene',composition,title:'Passage',original:'तुम ही हो सब घट घट वासी।\nविनती यही हमारी खासी॥\n\nKeep every word, including  spaces.',meaning:'A reflection.',sourceReference:'Page 1',scene:'Two acts of kindness',fontSize:16,imageScale:100}]});
test('three distinct blueprints retain exact Unicode and whitespace through split and import',()=>{
 assert.equal(new Set(Array.from({length:3},(_,i)=>storyCompositionAt(i))).size,3);
 for(const composition of Object.keys(storyCompositions)){
  const book=parseTemplateBook(fixture(composition));assert.equal(book.pages[0].composition,composition);
  const blocks=storyTextBlocks(book.pages[0]);assert.equal(blocks.filter(b=>b.role==='original').map(b=>b.text).join(''),book.pages[0].original);
  assert.equal(blocks.find(b=>b.role==='meaning').text,'A reflection.');
  assert.equal(splitStoryText(book.pages[0].original).join(''),book.pages[0].original);
  assert.match(continuationPrompt(book,[]),new RegExp('SPREAD BLUEPRINT: '+composition));
  const html=renderTemplateBook(book);assert.match(html,/height:210mm/);assert.match(html,/class="story-text/);assert.doesNotMatch(html,/<div class="copy">/);
 }
 const invalid=fixture('__proto__');assert.throws(()=>parseTemplateBook(invalid),/Unknown story composition/);
 assert.equal(parseTemplateBook(fixture(undefined)).pages[0].composition,undefined);
});
test('reference package includes actual images, attribution and blueprint guides, never scene assets',async()=>{
 const requests=[];const entries=await templateReferenceEntries('beanstalk-adventure',async url=>{requests.push(url);return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}})});
 assert.equal(requests.length,4);assert.equal(Object.keys(entries).filter(n=>n.endsWith('.jpg')).length,4);
 assert.equal(Object.keys(entries).filter(n=>n.endsWith('.svg')).length,3);
 assert.ok(Object.keys(entries).every(n=>n.startsWith('template-references/')));
 await assert.rejects(templateReferenceEntries('beanstalk-adventure',async()=>new Response('bad',{status:502})),/Could not package/);
});
test('reference endpoint fetches only catalog entries and rejects upstream surprises',async()=>{
 let calls=0;const fetcher=async url=>{calls++;assert.match(url,/^https:\/\/mir-s3-cdn-cf.behance.net\//);return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/jpeg'}})};
 const request=(query)=>new Request('https://studio.test/api/template-reference?'+query);
 assert.equal((await templateReferenceApi(request('template=beanstalk-adventure&index=2'),fetcher)).status,200);
 for(const query of ['template=http://localhost&index=0','template=beanstalk-adventure&index=-1','template=beanstalk-adventure&index=99','template=beanstalk-adventure&index=0.5']) assert.equal((await templateReferenceApi(request(query),fetcher)).status,404);
 assert.equal(calls,1);
 assert.equal((await templateReferenceApi(request('template=beanstalk-adventure&index=1'),async()=>new Response('<html>oops</html>',{headers:{'content-type':'text/html'}}))).status,502);
 assert.equal((await templateReferenceApi(new Request('https://studio.test/api/template-reference',{method:'POST'}),fetcher)).status,405);
});
test('template sample cannot override selected art direction with a generic painting style',async()=>{
 const {samplePrompt}=await import('../lib/chatgpt-handoff.ts');
 const prompt=samplePrompt({templateId:'beanstalk-adventure',title:'Prayer',language:'Hindi',visualDirection:{notes:'Detailed painting',characters:'Lakshmi',audience:'Families'}});
 assert.match(prompt,/ART LOCK: Flat stylised/);
 assert.match(prompt,/diagonal-scenes/);
 assert.doesNotMatch(prompt,/template must not override|LAYOUT ONLY/);
});
