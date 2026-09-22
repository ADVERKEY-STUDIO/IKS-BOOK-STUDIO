import test from 'node:test';
import assert from 'node:assert/strict';
import { templates,parseTemplateBook,renderTemplateBook,renderTemplatePage,bookPrompt,continuationPrompt } from '../lib/template-book.ts';
import {templateBlueprints,templateSize,templatePrintSize,planTemplateBook,plannedTextBlocks,layoutIssues,imageGeometryIssue} from '../lib/template-layouts.ts';
const fixture=()=>({format:'iks-template-book-v1',projectId:'test',templateId:'beanstalk-adventure',title:'Test',language:'Hindi',characterGuide:'Lakshmi',pages:Array.from({length:8},(_,i)=>({id:`spread-${i}`,title:['Opening','Family prayer','A journey','Two acts of service','A quiet encounter','Across the seasons','An offering','A humble ending'][i],original:'मातु लक्ष्मी करि कृपा।\nकरो हृदय में वास॥\n\nKeep  whitespace exactly.\n',meaning:'A small act of kindness.',sourceReference:'Source page 1',scene:['Village sunrise','Family offering','Travel through the hills','First helping a child then a parent','Comfort a devotee','Seasons change','Two people offer flowers','A humble poet prays'][i],image:`spread-${i}.png`,layout:'story-scene',fontSize:16,imageScale:100}))});
test('planning preserves every source byte and uses observed content-aware layouts without mutating legacy book',()=>{
 const before=fixture(),copy=structuredClone(before),b=planTemplateBook(before);
 assert.deepEqual(before,copy);assert.equal(b.templateRevision,2);assert.ok(b.pages.every(p=>p.blueprint.startsWith("reference-beanstalk-")));
 assert.equal(b.pages[0].blueprint,'reference-beanstalk-opening');
 for(let i=0;i<b.pages.length;i++){
  assert.equal(b.pages[i].original,before.pages[i].original);assert.equal(b.pages[i].meaning,before.pages[i].meaning);
  const blueprint=templateBlueprints(b.templateId).find(v=>v.id===b.pages[i].blueprint);
  assert.equal(plannedTextBlocks(b.pages[i],blueprint).filter(v=>v.role==='original').map(v=>v.text).join(''),before.pages[i].original);

 }
 assert.deepEqual(planTemplateBook(before),b); // Stable planning; no forced variation.
});
test('new books require valid template-specific blueprint and supported revision; legacy remains intact',()=>{
 const b=planTemplateBook(fixture());assert.deepEqual(parseTemplateBook(b),b);
 for(const mutate of [v=>delete v.pages[0].blueprint,v=>delete v.pages[0].layoutReason,v=>v.pages[0].blueprint='__proto__',v=>v.pages[0].blueprint='inset-left',v=>v.templateRevision=99]){const invalid=structuredClone(b);mutate(invalid);assert.throws(()=>parseTemplateBook(invalid));}
 assert.equal(parseTemplateBook(fixture()).templateRevision,undefined);assert.match(layoutIssues(fixture())[0],/Legacy/);
});
test('every catalogue template has bounded non-overlapping text regions and renders its own plan',()=>{
 for(const t of templates){
  const options=templateBlueprints(t.id);assert.ok(options.length>=1);
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
 const b=planTemplateBook(fixture());b.pages.forEach(p=>p.blueprint='reference-beanstalk-diagonal');b.pages[0].original='<script>alert(1)</script>'+ 'long '.repeat(2000);
 assert.ok(!layoutIssues(b).some(s=>s.includes('same arrangement')));assert.ok(layoutIssues(b).some(s=>s.includes('long original')));
 assert.doesNotMatch(renderTemplateBook(b),/<script>/);assert.match(renderTemplateBook(b),/&lt;script&gt;/);
});

test('changing a blueprint leaves an explicit stale-art warning until replacement',()=>{
 const b=planTemplateBook(fixture());b.pages[0].artworkBlueprint=b.pages[0].blueprint;b.pages[0].blueprint='reference-beanstalk-diagonal';
 assert.ok(layoutIssues(b).some(s=>s.includes('artwork belongs')));
 const parsed=parseTemplateBook(b);assert.equal(parsed.pages[0].artworkBlueprint,'reference-beanstalk-opening');
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
  assert.match(prompt,/Repeating an observed composition is allowed/);
  assert.match(prompt,/edit or regenerate the image/);
  assert.match(prompt,/pass ONLY that spread's blueprint/);
  assert.match(prompt,/do not ask the user to write replacement prompts/);
  for(const b of templateBlueprints(template.id))assert.ok(prompt.includes(b.id));
  const book=planTemplateBook({...fixture(),templateId:template.id});
  assert.match(continuationPrompt(book,[]),/AUTOMATIC GENERATION AND REVIEW/);
 }
 assert.match(bookPrompt('test','beanstalk-adventure','Title','source.pdf','Hindi'),/Do not move or mirror scenes or text/);
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
 book.templateRevision=1;book.pages.forEach(p=>p.blueprint='band-below');
 assert.doesNotThrow(()=>parseTemplateBook(book));
 assert.match(renderTemplatePage(book,0),/data-blueprint="band-below"/);
 assert.ok(templateBlueprints('snowy-friends').every(b=>b.id.startsWith('reference-snow-')));
});

test('reference layouts retain observed proportions and never fabricate mirror variants',async()=>{
 const {referenceContracts,referenceCoverage}=await import('../lib/template-reference-contracts.ts');
 for(const [id,c] of Object.entries(referenceContracts)){
  assert.ok(Math.abs(templateSize(id).width/templateSize(id).height-c.ratio)<1e-8);
  assert.ok(templateBlueprints(id).every(b=>Number.isInteger(b.referenceIndex)&&!b.id.endsWith('response')));
  assert.match(bookPrompt('test',id,'Test','source.pdf','Hindi'),/Never invent or mirror/);
 }
 assert.equal(templateBlueprints('bedtime-skies')[0].art[0].h,80);
 assert.equal(templateBlueprints('snowy-friends')[0].art[0].h,82);
 assert.match(referenceCoverage('manifesto'),/Cover-inspired/);
 assert.match(referenceCoverage('flower-festival'),/Artwork reference only/);
});
test('old books retain all version-one layouts and dimensions; new sans books embed sans fonts',async()=>{
 const {templateFont}=await import('../lib/template-book.ts');
 for(const t of templates)for(const option of templateBlueprints(t.id,1)){
  const old={...fixture(),templateId:t.id,templateRevision:1,pages:[{...fixture().pages[0],blueprint:option.id,layoutReason:'Saved layout'}]};
  assert.doesNotThrow(()=>parseTemplateBook(old));
  assert.match(renderTemplatePage(old,0),new RegExp(`height:${t.id==='beanstalk-adventure'?210:250}mm`));
 }
 const current=planTemplateBook({...fixture(),templateId:'bedtime-skies'});
 assert.equal(templateFont(current),'book-sans.ttf');
 assert.match(renderTemplatePage(current,0),/\/fonts\/book-sans.ttf/);
 assert.match(renderTemplatePage(current,0),/text-align:center/);
 current.templateRevision=1;assert.equal(templateFont(current),'book-sanskrit.ttf');
 const bo=bookPrompt('test','bedtime-play','Bo','source.pdf','English');
 assert.match(bo,/flat background colour/);assert.doesNotMatch(bo,/blank pale paper|3% canvas clearance/);
});
test('reference ZIP includes the same detailed prompt and per-spread source mapping',async()=>{
 const {templateReferenceEntries}=await import('../lib/template-reference-package.ts');
 const entries=await templateReferenceEntries('bedtime-skies',async()=>new Response(new Uint8Array([1]),{headers:{'content-type':'image/webp'}}));
 const spec=JSON.parse(new TextDecoder().decode(entries['template-references/template-specification.json']));
 assert.equal(spec.templateRevision,2);assert.equal(spec.typography.font,'Noto Sans Devanagari');
 assert.deepEqual(spec.blueprints.map(b=>b.referenceIndex),[0,1,2]);
 assert.match(spec.prompt,/Thin rough dark outlines/);
 assert.equal(spec.typography.exactReferenceFontVerified,false);
});

test('versioned import ignores obsolete composition metadata when its blueprint is valid',()=>{
 const book=planTemplateBook(fixture());book.pages[0].blueprint='reference-beanstalk-diagonal';book.pages[0].composition='diagonal-two-scenes';
 const parsed=parseTemplateBook(book);
 assert.equal(parsed.pages[0].blueprint,'reference-beanstalk-diagonal');
 assert.equal(parsed.pages[0].composition,undefined);
 assert.equal(parsed.pages[0].original,book.pages[0].original);
 assert.match(renderTemplatePage(parsed,0),/data-blueprint="reference-beanstalk-diagonal"/);
});

test('custom text positions survive import and render without changing words or other spreads',()=>{
 const book=planTemplateBook(fixture()),before=structuredClone(book);
 const boxes=plannedTextBlocks(book.pages[0],templateBlueprints(book.templateId)[0]);
 book.pages[0].textPositions=boxes.map(({x,y,w,h})=>({x,y,w,h}));
 book.pages[0].textPositions[0]={x:20,y:40,w:35,h:25};
 const parsed=parseTemplateBook(JSON.parse(JSON.stringify(book)));
 assert.deepEqual(parsed.pages[0].textPositions,book.pages[0].textPositions);
 assert.equal(parsed.pages[0].original,before.pages[0].original);
 assert.deepEqual(parsed.pages[1],before.pages[1]);
 assert.match(renderTemplatePage(parsed,0),/left:20%;top:40%;width:35%;height:25%/);
 assert.match(renderTemplateBook(parsed),/left:20%;top:40%;width:35%;height:25%/);
 for(const invalid of [[{x:99,y:0,w:20,h:20}],boxes.map(()=>({x:0,y:0,w:NaN,h:20})),boxes.map(()=>({x:-1,y:0,w:20,h:20}))]){
  assert.throws(()=>parseTemplateBook({...book,pages:[{...book.pages[0],textPositions:invalid}]}),/Text|text/);
 }
 assert.equal(planTemplateBook(parsed).pages[0].textPositions,undefined);
});
test('text drag and resize clamp to page edges',async()=>{
 const {moveTextBox}=await import('../lib/text-placement.ts');const b={x:20,y:20,w:30,h:30};
 assert.deepEqual(moveTextBox(b,100,-100),{x:70,y:0,w:30,h:30});
 assert.deepEqual(moveTextBox(b,100,-100,true),{x:20,y:20,w:80,h:1});
});
