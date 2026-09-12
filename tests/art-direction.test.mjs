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
const { newEdition, applyEditionAction:apply, editionHtml } = load(resolve('lib/devotional-edition.ts'));
const { proposeArtDirections, guideStatus, artDirectionBrief, outdatedGuideWork, validateGuide } = load(resolve('lib/art-direction.ts'));
const { buildExternalIllustrationSlotPrompt } = load(resolve('lib/external-manuscript.ts'));
let n=0; const act=(e,a)=>apply(e,a,'2026-09-12T01:00:00Z',()=>`p-${++n}`);
function source(text='ॐ अग्निमीळे पुरोहितं') { let e=act(newEdition(),{type:'add',text,location:'Review sample',provenance:'user-provided'}); return act(e,{type:'approve',id:e.passages[0].id,field:'original'}); }
function saved(e=source()) { return act(e,{type:'save-art-guide',guide:proposeArtDirections(e)[0],reason:'Initial direction'}); }
function approved() {const e=saved();return act(e,{type:'approve-art-guide',version:1});}
test('proposals respond to manuscript imagery, audience, density, and references',()=>{
 const fire=source(),water=source('गंगा नदी जल water river');
 const a=proposeArtDirections(fire),b=proposeArtDirections(water);assert.equal(a.length,3);assert.notDeepEqual(a[0].palette,b[0].palette);assert.notEqual(a[0].environments,b[0].environments);
 water.metadata.audience='Families';assert.equal(proposeArtDirections(water)[0].typography.original.size,24);
 const c=proposeArtDirections(fire,{version:1,references:{illustration:'waterlife'},notes:'Restrained ornaments'});assert.ok(c[0].references.notes.includes('Restrained'));assert.notEqual(c[0].medium,a[0].medium);assert.deepEqual(proposeArtDirections(newEdition()),[]);
});
test('guide changes never change original passages and older approved versions are retained',()=>{
 let e=approved(),original=structuredClone(e.passages);const guide=structuredClone(e.artDirection.versions[0].guide);guide.tone='A revised contemplative tone';e=act(e,{type:'save-art-guide',guide,reason:'Refine tone'});
 assert.equal(guideStatus(e),'draft');assert.equal(e.artDirection.versions.length,2);assert.ok(e.artDirection.versions[0].approvedAt);assert.deepEqual(e.passages,original);assert.throws(()=>artDirectionBrief(e),/Approve/);
});
test('source edits invalidate approval and block production until a new guide is reviewed',()=>{
 let e=approved();e.artGuideUsage=[{targetId:'spread-1',version:1}];e=act(e,{type:'edit',id:e.passages[0].id,field:'original',text:'Corrected original',location:'Review sample',reason:'Source correction',provenance:'user-provided'});
 assert.equal(guideStatus(e),'needs-review');assert.throws(()=>artDirectionBrief(e),/Approve/);assert.throws(()=>act(e,{type:'approve-art-guide',version:1}),/manuscript changed/);assert.equal(outdatedGuideWork(e)[0].targetId,'spread-1');
});
test('approval requires original approval and only the latest saved version can be approved',()=>{
 let e=act(newEdition(),{type:'add',text:'Original draft',location:'',provenance:'extracted'});e=saved(e);assert.throws(()=>act(e,{type:'approve-art-guide',version:1}),/Approve original/);
 let a=approved();a=act(a,{type:'save-art-guide',guide:proposeArtDirections(a)[1],reason:'Second direction'});assert.throws(()=>act(a,{type:'approve-art-guide',version:1}),/latest/);
});
test('approved guide survives serialization and reaches proof and image production prompt',()=>{
 const e=JSON.parse(JSON.stringify(approved()));assert.equal(guideStatus(e),'approved');assert.ok(artDirectionBrief(e).includes('artGuideVersion=1'));assert.ok(editionHtml(e,'font').includes(e.artDirection.versions[0].guide.palette.paper));
 const slot={id:'test',role:'chapter',chapterId:1,chapterTitle:'Invocation',filename:'test.png',sceneBrief:'A quiet image',altText:'',caption:'',imageIndex:1,placement:'chapter-middle',anchorId:'test',status:'pending'};
 const prompt=buildExternalIllustrationSlotPrompt({edition:e,title:'Book',sourceName:'Source',audience:'Adults',readingLevel:'Adult',language:'Sanskrit',bookType:'Devotional',aesthetic:'Quiet',illustrationStyle:'Ink',learningFeatures:[],chapters:[],slots:[slot]},slot);assert.ok(prompt.includes('APPROVED ART GUIDE — VERSION 1'));
});
test('invalid contrast, CSS values, and typography cannot enter an approved guide',()=>{
 const guide=proposeArtDirections(source())[0];guide.palette.ink=guide.palette.paper;assert.throws(()=>validateGuide(guide),/contrast/);guide.palette.ink='red;display:none';assert.throws(()=>validateGuide(guide),/six-digit/);guide.palette.ink='#222222';guide.typography.original.size=0;assert.throws(()=>validateGuide(guide),/typography/);
});
