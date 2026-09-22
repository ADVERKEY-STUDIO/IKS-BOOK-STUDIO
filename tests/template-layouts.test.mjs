import test from 'node:test';
import assert from 'node:assert/strict';
import { templates,parseTemplateBook,renderTemplateBook,renderTemplatePage,bookPrompt,continuationPrompt } from '../lib/template-book.ts';
import {templateBlueprints,templateSize,templatePrintSize,planTemplateBook,plannedTextBlocks,layoutIssues,imageGeometryIssue} from '../lib/template-layouts.ts';
const fixture=()=>({format:'iks-template-book-v1',projectId:'test',templateId:'beanstalk-adventure',title:'Test',language:'Hindi',characterGuide:'Lakshmi',pages:Array.from({length:8},(_,i)=>({id:`spread-${i}`,title:['Opening','Family prayer','A journey','Two acts of service','A quiet encounter','Across the seasons','An offering','A humble ending'][i],original:'मातु लक्ष्मी करि कृपा।\nकरो हृदय में वास॥\n\nKeep  whitespace exactly.\n',meaning:'A small act of kindness.',sourceReference:'Source page 1',scene:['Village sunrise','Family offering','Travel through the hills','First helping a child then a parent','Comfort a devotee','Seasons change','Two people offer flowers','A humble poet prays'][i],image:`spread-${i}.png`,layout:'story-scene',fontSize:16,imageScale:100}))});
test('planning preserves every source byte and produces varied content-aware layouts without mutating legacy book',()=>{
 const before=fixture(),copy=structuredClone(before),b=planTemplateBook(before);
 assert.deepEqual(before,copy);assert.equal(b.templateRevision,1);assert.ok(new Set(b.pages.map(p=>p.blueprint)).size>=4);
 assert.equal(b.pages[0].blueprint,'landscape-opening');assert.equal(b.pages.at(-1).blueprint,'quiet-ending');
 for(let i=0;i<b.pages.length;i++){
  assert.equal(b.pages[i].original,before.pages[i].original);assert.equal(b.pages[i].meaning,before.pages[i].meaning);
  const blueprint=templateBlueprints(b.templateId).find(v=>v.id===b.pages[i].blueprint);
  assert.equal(plannedTextBlocks(b.pages[i],blueprint).filter(v=>v.role==='original').map(v=>v.text).join(''),before.pages[i].original);
  if(i)assert.notEqual(b.pages[i].blueprint,b.pages[i-1].blueprint);
 }
 assert.notDeepEqual(planTemplateBook({...before,pages:before.pages.slice().reverse()}).pages.map(p=>p.blueprint),b.pages.map(p=>p.blueprint));
});
test('new books require valid template-specific blueprint and supported revision; legacy remains intact',()=>{
 const b=planTemplateBook(fixture());assert.deepEqual(parseTemplateBook(b),b);
 for(const mutate of [v=>delete v.pages[0].blueprint,v=>delete v.pages[0].layoutReason,v=>v.pages[0].blueprint='__proto__',v=>v.pages[0].blueprint='inset-left',v=>v.templateRevision=99]){const invalid=structuredClone(b);mutate(invalid);assert.throws(()=>parseTemplateBook(invalid));}
 assert.equal(parseTemplateBook(fixture()).templateRevision,undefined);assert.match(layoutIssues(fixture())[0],/Legacy/);
});
test('every catalogue template has bounded non-overlapping text regions and renders its own plan',()=>{
 for(const t of templates){
  const options=templateBlueprints(t.id);assert.ok(options.length>=2);
  const b=planTemplateBook({...fixture(),templateId:t.id});parseTemplateBook(b);
  for(const blueprint of options){
   for(const a of [...blueprint.art,...blueprint.original,blueprint.meaning])assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=100&&a.y+a.h<=100,t.id);
   const texts=[...blueprint.original,blueprint.meaning];
   for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i],c=texts[j];assert.ok(a.x+a.w<=c.x||c.x+c.w<=a.x||a.y+a.h<=c.y||c.y+c.h<=a.y,blueprint.id);}
  }
  const html=renderTemplateBook(b);assert.match(html,new RegExp(`data-blueprint="${b.pages[0].blueprint}"`));
  assert.equal((html.match(/class="spread planned-spread/g)||[]).length,8);
 }
});
test('full book, editor and prompt agree on blueprint and page dimensions',()=>{
 const b=planTemplateBook(fixture());const p=b.pages[1];
 for(const html of [renderTemplateBook(b),renderTemplatePage(b,1)]){assert.match(html,new RegExp(`data-blueprint="${p.blueprint}"`));assert.match(html,/height:210mm/);}
 const editor=renderTemplatePage(b,1);assert.equal((editor.match(/class="spread planned-spread/g)||[]).length,1);assert.doesNotMatch(editor,/<section class="spread cover/);
 const prompt=continuationPrompt({...b,pages:[p]},[]);assert.match(prompt,new RegExp('SELECTED SPREAD BLUEPRINT: '+p.blueprint));
 assert.equal((prompt.match(/SELECTED SPREAD BLUEPRINT:/g)||[]).length,1);
 assert.match(bookPrompt('a',b.templateId,'Title','s.pdf','Hindi'),/not a mechanical cycle/);
 assert.deepEqual(templateSize(b.templateId),{width:420,height:210});
 assert.equal(imageGeometryIssue(b,p,2000,1000),undefined);assert.match(imageGeometryIssue(b,p,1536,1024),/requires/);
});
test('repetition and overly long text are reviewable; untrusted source cannot inject markup',()=>{
 const b=planTemplateBook(fixture());b.pages.forEach(p=>p.blueprint='diagonal-scenes');b.pages[0].original='<script>alert(1)</script>'+ 'long '.repeat(2000);
 assert.ok(layoutIssues(b).some(s=>s.includes('same arrangement')));assert.ok(layoutIssues(b).some(s=>s.includes('long original')));
 assert.doesNotMatch(renderTemplateBook(b),/<script>/);assert.match(renderTemplateBook(b),/&lt;script&gt;/);
});

test('changing a blueprint leaves an explicit stale-art warning until replacement',()=>{
 const b=planTemplateBook(fixture());b.pages[0].artworkBlueprint=b.pages[0].blueprint;b.pages[0].blueprint='paired-scenes';
 assert.ok(layoutIssues(b).some(s=>s.includes('artwork belongs')));
 const parsed=parseTemplateBook(b);assert.equal(parsed.pages[0].artworkBlueprint,'landscape-opening');
 b.pages[0].artworkBlueprint=b.pages[0].blueprint;assert.ok(!layoutIssues(b).some(s=>s.includes('artwork belongs')));
 assert.equal(planTemplateBook(b).pages[0].artworkBlueprint,undefined);
});

test('literary portrait covers retain their geometry instead of stretching into landscape spreads',()=>{
 assert.deepEqual(templatePrintSize('manifesto',true),{width:210,height:250});
 assert.deepEqual(templatePrintSize('manifesto',false),{width:420,height:250});
 assert.deepEqual(templatePrintSize('beanstalk-adventure',true),{width:420,height:210});
});

test('website-generated prompts carry automatic composition and artwork correction instructions',()=>{
 for(const template of templates){
  const prompt=bookPrompt('prompt-test',template.id,'New manuscript','source.pdf','Hindi');
  assert.match(prompt,/approved sample locks character identity and illustration style, NOT one composition/);
  assert.match(prompt,/edit or regenerate the image/);
  assert.match(prompt,/pass ONLY that spread's blueprint/);
  assert.match(prompt,/do not ask the user to write replacement prompts/);
  for(const b of templateBlueprints(template.id))assert.ok(prompt.includes(b.id));
  const book=planTemplateBook({...fixture(),templateId:template.id});
  assert.match(continuationPrompt(book,[]),/AUTOMATIC GENERATION AND REVIEW/);
 }
 assert.match(bookPrompt('test','beanstalk-adventure','Title','source.pdf','Hindi'),/3% canvas clearance/);
});

test('all 29 templates have unique interior geometry, shared by sample and prompt',async()=>{
 const {renderLayoutSample}=await import('../lib/template-layout-sample.ts');
 const fingerprints=new Set();
 for(const t of templates){
  const options=templateBlueprints(t.id),b=options[0];
  const fingerprint=JSON.stringify([b.art,b.original,b.meaning]);
  assert.ok(!fingerprints.has(fingerprint),`Duplicate composition: ${t.id}`);fingerprints.add(fingerprint);
  for(const option of options){
   const sample=renderLayoutSample(t.id,option.id);
   assert.ok(sample.includes(`data-blueprint="${option.id}"`));
   assert.ok(bookPrompt('test',t.id,'New book','source.pdf','Hindi').includes(option.id));
  }
 }
 assert.equal(fingerprints.size,29);
});
test('saved revision-one generic layouts keep their original coordinates',()=>{
 const book=planTemplateBook({...fixture(),templateId:'snowy-friends'});
 book.pages[0].blueprint='band-below';
 assert.doesNotThrow(()=>parseTemplateBook(book));
 assert.match(renderTemplatePage(book,0),/data-blueprint="band-below"/);
 assert.ok(templateBlueprints('snowy-friends').every(b=>b.id.startsWith('snowy-friends-')));
});
