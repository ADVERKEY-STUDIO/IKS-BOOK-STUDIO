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
const { newEdition, applyEditionAction: apply, editionHtml, editionExportIssues } = load(resolve('lib/devotional-edition.ts'));
let serial = 0;
const act = (e,a) => apply(e,a,'2026-09-11T12:00:00Z',() => `passage-${++serial}`);
const original = 'ॐ अग्निमीळे पुरोहितं\nअ॒ग्निम् क्ष ज्ञ श्र ।';
function sample() { return act(newEdition(),{type:'add',text:original,location:'RV 1.1',provenance:'user-provided'}); }
test('adult metadata and exact original characters survive serialization and approved export', () => {
 let e=sample(); e=act(e,{type:'metadata',metadata:{...e.metadata,type:'Scripture with commentary',audience:'Adults'}});
 const id=e.passages[0].id; e=act(e,{type:'approve',id,field:'original'});
 e=JSON.parse(JSON.stringify(e)); assert.equal(e.passages[0].fields.original.text,original); assert.equal(e.metadata.audience,'Adults');
 assert.deepEqual(editionExportIssues(e),[]); const html=editionHtml(e,'/fonts/book-sanskrit.ttf'); assert.ok(html.includes(original)); assert.ok(!html.includes('activities'));
});
test('original correction records previous approval and invalidates supplementary approvals and bound work', () => {
 let e=sample(),id=e.passages[0].id; e=act(e,{type:'approve',id,field:'original'});
 e=act(e,{type:'edit',id,field:'translation',text:'Translation for review',location:'RV 1.1',reason:'Add translation',provenance:'generated'});
 e=act(e,{type:'approve',id,field:'translation'}); e.bindings=[{passageId:id,targetId:'spread-1'}];
 const before=structuredClone(e); e=act(e,{type:'edit',id,field:'original',text:original+'\n॥',location:'RV 1.1',reason:'Correct punctuation',provenance:'user-provided'});
 assert.equal(e.passages[0].fields.original.status,'draft'); assert.equal(e.passages[0].fields.translation.status,'stale');
 assert.equal(e.passages[0].history.at(-1).fields.original.text,original); assert.equal(e.affectedTargets[0].targetId,'spread-1'); assert.equal(before.passages[0].fields.original.status,'approved');
 assert.throws(()=>editionHtml(e,'font'),/review and approve/);
});
test('supplementary approval cannot precede original approval and cannot overwrite original', () => {
 let e=sample(), id=e.passages[0].id; e=act(e,{type:'edit',id,field:'commentary',text:'<script>comment</script>',location:'RV 1.1',reason:'Commentary added',provenance:'generated'});
 assert.throws(()=>act(e,{type:'approve',id,field:'commentary'}),/Approve the original/);
 e=act(e,{type:'approve',id,field:'original'}); e=act(e,{type:'approve',id,field:'commentary'});
 assert.equal(e.passages[0].fields.original.text,original); assert.ok(editionHtml(e,'font').includes('&lt;script&gt;'));
});
test('split and merge retain text and retired supplementary records with stable lineage', () => {
 let e=sample(),id=e.passages[0].id;
 e=act(e,{type:'split',id,offset:original.indexOf('\n'),reason:'Separate verses'});
 let active=e.passages.filter(p=>!p.retired); assert.equal(active.map(p=>p.fields.original.text).join(''),original); assert.equal(e.passages[0].retired,true); assert.deepEqual(active[0].derivedFrom,[id]);
 e=act(e,{type:'merge',id:active[0].id,nextId:active[1].id,reason:'Keep this invocation together'});
 active=e.passages.filter(p=>!p.retired); assert.equal(active.length,1); assert.equal(active[0].derivedFrom.length,2); assert.equal(e.passages.filter(p=>p.retired).length,3);
});
test('invalid actions do not mutate the saved source', () => {
 const e=sample(), before=structuredClone(e), id=e.passages[0].id;
 assert.throws(()=>act(e,{type:'edit',id,field:'original',text:'changed',location:'',reason:'',provenance:'user-provided'}),/Explain/);
 assert.throws(()=>act(e,{type:'split',id,offset:0,reason:'split'}),/cursor/); assert.deepEqual(e,before);
});
test('import retains extraction provenance and separate original file metadata', () => {
 const e=act(newEdition(),{type:'import',pages:[original],source:{key:'sources/owner/book/original.txt',name:'original.txt',size:100,importedAt:'today'}});
 assert.equal(e.passages[0].fields.original.provenance,'extracted'); assert.equal(e.passages[0].fields.original.status,'draft'); assert.equal(e.sources[0].name,'original.txt');
 assert.throws(()=>act(e,{type:'import',pages:[' '],source:{key:'x',name:'x',size:1,importedAt:'today'}}),/No readable text/);
});
