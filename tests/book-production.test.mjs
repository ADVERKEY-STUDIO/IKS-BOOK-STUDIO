import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => name.startsWith('.') ? load(resolve(dirname(path), name)) : require(name), module, module.exports);
  return module.exports;
}
const {newEdition,applyEditionAction:apply}=load(resolve('lib/devotional-edition.ts'));
const {proposeArtDirections}=load(resolve('lib/art-direction.ts'));
const {blankSpread}=load(resolve('lib/storyboard.ts'));
const {initialComposition}=load(resolve('lib/spread-composition.ts'));
const {productionState,productionReadiness}=load(resolve('lib/book-production.ts'));
let n=0;const act=(e,a)=>apply(e,a,'2026-09-12T12:00:00Z',()=>`h-${++n}`);
const checks={meaning:true,artwork:true,textFit:true};
function fixture(){
 let e=act(newEdition(),{type:'add',text:'Source A',location:'A',provenance:'user-provided'});
 e=act(e,{type:'add',text:'Source B',location:'B',provenance:'user-provided'});
 for(const p of e.passages)e=act(e,{type:'approve',id:p.id,field:'original'});
 e=act(e,{type:'save-art-guide',guide:proposeArtDirections(e)[0],reason:'Test guide'});e=act(e,{type:'approve-art-guide',version:1});
 for(const p of e.passages)e=act(e,{type:'save-spread',plan:{...blankSpread(),title:p.location,purpose:'Read',concept:'Quiet text',textArea:'Left',allocations:[{passageId:p.id,fields:['original'],start:0,end:p.fields.original.text.length}]}});
 for(const p of e.storyboard){e=act(e,{type:'approve-spread',id:p.id});e=act(e,{type:'save-composition',composition:initialComposition(e,p)});}
 return e;
}
function approve(e,id){return act(e,{type:'review-production-spread',planId:id,kind:'approve',note:'Reviewed',checks});}
test('batch ownership validation, archive and restoration prevent conflicting active work',()=>{
 let e=fixture(),ids=e.storyboard.map(p=>p.id);
 e=act(e,{type:'save-production-batch',name:'First',planIds:[ids[0]]});
 assert.throws(()=>act(e,{type:'save-production-batch',name:'Duplicate',planIds:[ids[0]]}),/another active/);
 assert.throws(()=>act(e,{type:'save-production-batch',name:'Foreign',planIds:['absent']}),/active plans/);
 const old=e.bookProduction.batches[0].id;e=act(e,{type:'archive-production-batch',id:old,archived:true});
 e=act(e,{type:'save-production-batch',name:'Next',planIds:[ids[0]]});
 assert.throws(()=>act(e,{type:'archive-production-batch',id:old,archived:false}),/two active/);
});
test('targeted rework and composition edits preserve unrelated approvals',()=>{
 let e=fixture();const [a,b]=e.storyboard.map(p=>p.id);e=approve(approve(e,a),b);
 assert.equal(productionState(e,a),'Approved');assert.equal(productionState(e,b),'Approved');
 const c=structuredClone(e.compositions.find(c=>c.planId===a));c.layers[0].x+=1;e=act(e,{type:'save-composition',composition:c});
 assert.equal(productionState(e,a),'Stale');assert.equal(productionState(e,b),'Approved');
 e=act(e,{type:'review-production-spread',planId:a,kind:'rework',note:'Adjust only this spread'});
 assert.equal(productionState(e,a),'Draft');assert.equal(productionState(e,b),'Approved');assert.equal(e.bookProduction.reviews.length,3);
});
test('review queue and approvals require current source and explicit reviewer checks',()=>{
 let e=fixture();const id=e.storyboard[0].id;
 e=act(e,{type:'review-production-spread',planId:id,kind:'submit',note:'Ready for reviewer'});
 assert.equal(productionState(e,id),'Awaiting review');
 assert.throws(()=>act(e,{type:'review-production-spread',planId:id,kind:'approve',note:'x'}),/Confirm/);
 const p=e.passages[0];e=act(e,{type:'edit',id:p.id,field:'original',text:'Changed',location:p.location,reason:'Correction',provenance:'user-provided'});
 assert.equal(productionState(e,id),'Stale');assert.throws(()=>approve(e,id),/review|approve/i);
});
test('book matter is explicit, inherits identity, and preserves scripture',()=>{
 let e=fixture();const source=JSON.stringify(e.passages);
 assert.throws(()=>act(e,{type:'add-book-part',role:'Title page',title:'Title',body:''}),/Section text/);
 e=act(e,{type:'add-book-part',role:'Title page',title:'Our edition',body:'Prepared by the reader'});
 const id=e.bookProduction.parts[0].planId;assert.equal(e.storyboard[0].id,id);assert.equal(e.storyboard[0].kind,'single');
 const c=e.compositions.find(c=>c.planId===id);assert.equal(c.paper,e.artDirection.versions[0].guide.palette.paper);assert.equal(c.layers[1].text,'Prepared by the reader');assert.equal(productionState(e,id),'Draft');assert.equal(JSON.stringify(e.passages),source);
 assert.throws(()=>act(e,{type:'add-book-part',role:'Title page',title:'Duplicate',body:'Text'}),/already exists/);
});
test('printer cover requirements reject guessed/missing references and impossible geometry',()=>{
 let e=fixture();const cover={printer:'Selected printer',templateReference:'Template supplied by printer',flatWidth:380,flatHeight:236,spineWidth:14,bleed:3,notes:'No flaps'};
 assert.throws(()=>act(e,{type:'save-printer-cover',cover:{...cover,templateReference:''}}),/reference/);
 assert.throws(()=>act(e,{type:'save-printer-cover',cover:{...cover,flatWidth:90,spineWidth:100}}),/Check printer/);
 e=act(e,{type:'save-printer-cover',cover});assert.deepEqual(e.bookProduction.cover,cover);
});

test('unapproved reference images block review even if the source is approved',()=>{
 let e=fixture();const id=e.storyboard[0].id,c=e.compositions[0];
 const {layerDefaults}=load(resolve('lib/spread-composition.ts'));
 const {emptyReferenceSpec}=load(resolve('lib/visual-references.ts'));
 e=act(e,{type:'save-reference',spec:{...emptyReferenceSpec(),name:'Object',role:'Object',features:'Shape',colors:'Gold',culturalNotes:'Review'},imageIds:[],reason:'Reference'});
 const ref=e.visualReferences[0].id;
 e=act(e,{type:'reference-image',id:ref,image:{id:'asset',key:'asset-key',name:'asset.png',mime:'image/png',width:4000,height:4000,view:'detail',caption:'Object',credit:'Owner',provenance:'uploaded',uploadedAt:'now'}});
 e=act(e,{type:'save-composition',composition:{...c,layers:[...c.layers,{...layerDefaults('image','image'),imageKey:'asset-key',x:220,y:20,width:100,height:100}]}});
 assert.ok(productionReadiness(e,id).some(i=>i.includes('approve this reference')));
 assert.throws(()=>approve(e,id),/reference/);
});
test('adding another unapproved production version does not stale a reviewed exact asset',()=>{
 let e=fixture(),id=e.storyboard[0].id;
 const {layerDefaults}=load(resolve('lib/spread-composition.ts'));
 e=act(e,{type:'create-art-request',planId:id,note:'Artwork'});const rid=e.artProduction.requests[0].id;
 const image={id:'art-1',key:'art-one',name:'one.png',mime:'image/png',width:4000,height:4000,view:'environment',caption:'Scene',credit:'Owner',provenance:'uploaded',uploadedAt:'now'};
 e=act(e,{type:'import-art-result',requestId:rid,image,note:'First'});
 e=act(e,{type:'save-composition',composition:{...e.compositions[0],layers:[...e.compositions[0].layers,{...layerDefaults('image','image'),imageKey:image.key,x:220,y:20,width:100,height:100}]}});
 e=act(e,{type:'approve-art',planId:id,versionId:e.artProduction.spreads[0].versions[0].id});e=approve(e,id);
 e=act(e,{type:'import-art-result',requestId:rid,image:{...image,id:'art-2',key:'art-two'},note:'Unreviewed alternate'});
 assert.equal(productionState(e,id),'Approved');
});
