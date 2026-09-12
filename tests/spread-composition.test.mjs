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
const {blankSpread}=load(resolve('lib/storyboard.ts'));
const {initialComposition,compositionMarkup,compositionDocument,compositionIssues,layerText,validatePrintFormat,layerDefaults}=load(resolve('lib/spread-composition.ts'));
let id=0;const act=(e,a)=>apply(e,a,'2026-09-12',()=>`e-${++id}`);
function fixture(){let e=act(newEdition(),{type:'add',text:'ॐ शान्तिः',location:'QA',provenance:'user-provided'});e=act(e,{type:'approve',id:e.passages[0].id,field:'original'});e=act(e,{type:'save-spread',plan:{...blankSpread(),title:'Quiet',allocations:[{passageId:e.passages[0].id,fields:['original'],start:0,end:e.passages[0].fields.original.text.length}]}});return e;}
test('composition save preserves source and stable physical data across serialization',()=>{let e=fixture();const text=structuredClone(e.passages),c=initialComposition(e,e.storyboard[0]);c.layers[0].x=18;e=act(e,{type:'save-composition',composition:c});assert.deepEqual(e.passages,text);assert.equal(JSON.parse(JSON.stringify(e)).compositions[0].layers[0].x,18);assert.ok(e.bindings.some(b=>b.targetId.startsWith('composition:')));});
test('editor and proof share exact physical renderer and escaped text',()=>{const e=fixture(),c=initialComposition(e,e.storyboard[0]);const l=layerDefaults('caption','text');l.text='<script>unsafe</script>';c.layers.push(l);const markup=compositionMarkup(e,c,{});assert.ok(compositionDocument(e,c,{},'/font.ttf').includes(markup));assert.ok(markup.includes('&lt;script&gt;'));assert.ok(markup.includes('width:426mm'));assert.equal(layerText(e,c.layers[0]),'ॐ शान्तिः');});
test('format validation rejects missing and nonfinite fields',()=>{assert.throws(()=>validatePrintFormat({width:210}),/valid physical/);assert.throws(()=>validatePrintFormat({width:NaN,height:250,margin:15,bleed:3,gutter:8}),/valid physical/);});
test('review catches unsafe text and missing or duplicate planned layers',()=>{const e=fixture(),c=initialComposition(e,e.storyboard[0]);c.layers[0].x=200;assert.ok(compositionIssues(e,c).some(i=>i.includes('gutter')));c.layers[0].hidden=true;assert.ok(compositionIssues(e,c).some(i=>i.includes('found 0')));});
test('stale plans cannot be silently acknowledged by saving old geometry',()=>{let e=fixture();const c=initialComposition(e,e.storyboard[0]);e=act(e,{type:'save-spread',plan:{...e.storyboard[0],title:'Revised'}});assert.throws(()=>act(e,{type:'save-composition',composition:c}),/Storyboard changed/);});
test('unregistered assets and private text bindings are rejected',()=>{const e=fixture(),c=initialComposition(e,e.storyboard[0]);c.layers[0].binding.field='notes';assert.throws(()=>act(e,{type:'save-composition',composition:c}),/protected text/);const image=layerDefaults('image','image');image.imageKey='foreign';c.layers=[image];assert.throws(()=>act(e,{type:'save-composition',composition:c}),/registered/);});
test('image crop, focal point, opacity and soft edge share proof markup',()=>{const e=fixture(),c=initialComposition(e,e.storyboard[0]),l=layerDefaults('art','image');l.imageKey='art';l.fit='cover';l.focalX=25;l.focalY=70;l.softEdge=12;l.opacity=.8;c.layers.push(l);const html=compositionMarkup(e,c,{art:'data:image/png;base64,AA=='});assert.ok(html.includes('object-fit:cover;object-position:25% 70%'));assert.ok(html.includes('mask-image:radial-gradient'));assert.ok(html.includes('opacity:0.8'));assert.ok(compositionDocument(e,c,{art:'data:image/png;base64,AA=='},'/font').includes(html));});
test('source changes remain visible after source reapproval',()=>{let e=fixture();e=act(e,{type:'save-composition',composition:initialComposition(e,e.storyboard[0])});e=act(e,{type:'edit',id:e.passages[0].id,field:'original',text:'ॐ शान्तिः ॥',location:'QA',reason:'Correction',provenance:'user-provided'});e=act(e,{type:'approve',id:e.passages[0].id,field:'original'});assert.ok(compositionIssues(e,e.compositions[0]).some(i=>i.includes('Source wording changed')));});
