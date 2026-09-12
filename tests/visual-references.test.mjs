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
const spec=()=>({...emptyReferenceSpec(),name:'Recurring figure',role:'Narrative companion',features:'Reviewed facial features',colors:'Saffron and white',culturalNotes:'Technical sample, not asserted iconography'});
const image={id:'image-1',key:'edition-references/test/image-1.png',name:'test.png',mime:'image/png',width:500,height:600,view:'front',caption:'Front study',credit:'Test fixture',provenance:'uploaded',uploadedAt:'today'};
function reference(){let e=edition();e=act(e,{type:'save-reference',spec:spec(),imageIds:[],reason:'Initial identity'});const id=e.visualReferences[0].id;e=act(e,{type:'reference-image',id,image});return act(e,{type:'approve-reference',id,version:2});}
test('draft revisions retain the approved identity and original passages',()=>{let e=reference();const before=structuredClone(e.passages),id=e.visualReferences[0].id;e=act(e,{type:'save-reference',id,spec:{...spec(),features:'New proposed expression'},imageIds:['image-1'],reason:'Expression study'});assert.equal(e.visualReferences[0].approvedVersion,2);assert.equal(approvedReference(e.visualReferences[0]).spec.features,'Reviewed facial features');assert.equal(referenceManifest(e,1)[0].version,2);assert.deepEqual(e.passages,before);});
test('approval requires images and the current approved guide',()=>{let e=edition();e=act(e,{type:'save-reference',spec:spec(),imageIds:[],reason:'Initial'});const id=e.visualReferences[0].id;assert.throws(()=>act(e,{type:'approve-reference',id,version:1}),/at least one/);e=act(e,{type:'reference-image',id,image});e=act(e,{type:'save-art-guide',guide:proposeArtDirections(e)[1],reason:'Guide update'});assert.throws(()=>act(e,{type:'approve-reference',id,version:2}),/current art guide/);});
test('unknown images cannot be attached and old versions cannot silently become approved',()=>{const e=reference(),id=e.visualReferences[0].id;assert.throws(()=>act(e,{type:'save-reference',id,spec:spec(),imageIds:['other-book-image'],reason:'Attempt'}),/does not belong/);assert.throws(()=>act(e,{type:'approve-reference',id,version:1}),/latest/);});
test('production instructions identify exact approved reference and image versions',()=>{const e=JSON.parse(JSON.stringify(reference()));const brief=artDirectionBrief(e);assert.ok(brief.includes('APPROVED VISUAL REFERENCES'));assert.ok(brief.includes('VERSION 2'));assert.ok(brief.includes('image-1'));assert.ok(brief.includes('Reviewed facial features'));});
test('new guides invalidate production references until reviewed; archive preserves history',()=>{let e=reference();e=act(e,{type:'save-art-guide',guide:proposeArtDirections(e)[1],reason:'New guide'});e=act(e,{type:'approve-art-guide',version:2});assert.throws(()=>artDirectionBrief(e),/Review Recurring figure/);const id=e.visualReferences[0].id;e=act(e,{type:'archive-reference',id,archived:true});assert.deepEqual(referenceManifest(e,2),[]);assert.equal(e.visualReferences[0].versions.length,2);e=act(e,{type:'archive-reference',id,archived:false});assert.throws(()=>artDirectionBrief(e),/Review/);});
test('raster metadata is detected from bytes, not filename, and non-images are rejected',()=>{const bytes=readFileSync('public/illustrations/rasa-bhava.png');const m=inspectReferenceImage(bytes);assert.equal(m.mime,'image/png');assert.ok(m.width>0&&m.height>0);assert.throws(()=>inspectReferenceImage(new TextEncoder().encode('<svg>not a raster</svg>')),/valid PNG/);});
