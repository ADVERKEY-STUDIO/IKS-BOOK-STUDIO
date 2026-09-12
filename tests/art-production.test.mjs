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
const { newEdition, applyEditionAction: apply } = load(resolve('lib/devotional-edition.ts'));
const { proposeArtDirections, artDirectionBrief } = load(resolve('lib/art-direction.ts'));
const { emptyReferenceSpec, approvedReference, referenceManifest, inspectReferenceImage } = load(resolve('lib/visual-references.ts'));
let serial=0;const act=(e,a)=>apply(e,a,'2026-09-12T04:00:00Z',()=>`ref-${++serial}`);
function edition(){let e=act(newEdition(),{type:'add',text:'Approved original',location:'Test',provenance:'user-provided'});e=act(e,{type:'approve',id:e.passages[0].id,field:'original'});e=act(e,{type:'save-art-guide',guide:proposeArtDirections(e)[0],reason:'Guide'});return act(e,{type:'approve-art-guide',version:1});}

const {blankSpread}=load(resolve('lib/storyboard.ts'));
const {approvedArt,artStatus,editionImages}=load(resolve('lib/art-production.ts'));
const {initialComposition,layerDefaults,compositionIssues}=load(resolve('lib/spread-composition.ts'));
function fixture(){let e=edition();e=act(e,{type:'save-spread',plan:{...blankSpread(),title:'Scene',purpose:'Read',concept:'A quiet setting',textArea:'Left upper',allocations:[{passageId:e.passages[0].id,fields:['original'],start:0,end:e.passages[0].fields.original.text.length}]}});e=act(e,{type:'approve-spread',id:e.storyboard[0].id});return e;}
const image={id:'art1',key:'edition-art/test/a.png',name:'scene.png',mime:'image/png',width:6000,height:4000,view:'environment',caption:'Scene',credit:'QA',provenance:'uploaded',uploadedAt:'today'};
function request(e){return act(e,{type:'create-art-request',planId:e.storyboard[0].id,note:'Paint a quiet scene'});}
function imported(){let e=request(fixture());return act(e,{type:'import-art-result',requestId:e.artProduction.requests[0].id,image,note:'Initial art'});}
test('production snapshots record approved direction and print dimensions',()=>{const e=request(fixture()),r=e.artProduction.requests[0];assert.ok(r.prompt.includes('artGuideVersion=1'));assert.ok(r.prompt.includes('Left upper'));assert.ok(r.width>4000);assert.ok(r.height>2000);});
test('new imported result preserves approved identity and source',()=>{let e=imported();const source=structuredClone(e.passages),id=e.storyboard[0].id,first=e.artProduction.spreads[0].versions[0].id;e=act(e,{type:'approve-art',planId:id,versionId:first});e=act(e,{type:'import-art-result',requestId:e.artProduction.requests[0].id,image:{...image,id:'art2',key:'edition-art/test/b.png'},note:'New expression'});assert.equal(approvedArt(e,id).id,first);assert.deepEqual(e.passages,source);assert.equal(editionImages(e).length,2);});
test('restore selects an earlier version and retains newer versions and approval history',()=>{let e=imported(),id=e.storyboard[0].id,first=e.artProduction.spreads[0].versions[0].id;e=act(e,{type:'import-art-result',requestId:e.artProduction.requests[0].id,image:{...image,id:'art2',key:'edition-art/test/b.png'},note:'Second'});const second=e.artProduction.spreads[0].versions[1].id;e=act(e,{type:'approve-art',planId:id,versionId:second});e=act(e,{type:'approve-art',planId:id,versionId:first});assert.equal(approvedArt(e,id).id,first);assert.equal(e.artProduction.spreads[0].versions.length,2);assert.equal(e.artProduction.spreads[0].approvals.length,2);});
test('upstream edits mark approval stale without changing saved request',()=>{let e=imported();const id=e.storyboard[0].id;e=act(e,{type:'approve-art',planId:id,versionId:e.artProduction.spreads[0].versions[0].id});const request=structuredClone(e.artProduction.requests[0]);e=act(e,{type:'save-spread',plan:{...e.storyboard[0],concept:'New setting'}});assert.equal(artStatus(e,id),'Artwork needs review');assert.deepEqual(e.artProduction.requests[0],request);});
test('unapproved production artwork blocks designer proof and approval clears it',()=>{let e=imported(),id=e.storyboard[0].id,c=initialComposition(e,e.storyboard[0]),l=layerDefaults('image','image');l.imageKey=image.key;l.x=230;l.width=150;c.layers.push(l);assert.ok(compositionIssues(e,c).some(i=>i.includes('production artwork')));e=act(e,{type:'approve-art',planId:id,versionId:e.artProduction.spreads[0].versions[0].id});assert.ok(!compositionIssues(e,c).some(i=>i.includes('production artwork')));});
test('missing requests, foreign approvals and invalid provenance are rejected',()=>{const e=imported();assert.throws(()=>act(e,{type:'import-art-result',requestId:'foreign',image,note:'test'}),/saved production/);assert.throws(()=>act(e,{type:'approve-art',planId:e.storyboard[0].id,versionId:'foreign'}),/saved artwork/);assert.throws(()=>act(e,{type:'import-art-result',requestId:e.artProduction.requests[0].id,image:{...image,provenance:'fake'},note:'test'}),/provenance/);});
