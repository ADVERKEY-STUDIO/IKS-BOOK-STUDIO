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
const { blankSpread, storyboardPages, storyboardIssues, spreadStatus } = load(resolve('lib/storyboard.ts'));
let serial=0;const act=(e,a)=>apply(e,a,'2026-09-12',()=>`id-${++serial}`);
function fixture(){let e=act(newEdition(),{type:'add',text:'abcdefghij',location:'Verse 1',provenance:'user-provided'});return act(e,{type:'approve',id:e.passages[0].id,field:'original'});}
function add(e,start=0,end=10,kind='spread'){return act(e,{type:'save-spread',plan:{...blankSpread(),title:'Plan',kind,purpose:'Read',concept:'Quiet',textArea:'Upper half',allocations:[{passageId:e.passages[0].id,fields:['original'],start,end}]}});}
test('facing pairs preserve even-left parity with explicit blanks and unnumbered covers',()=>{const p=k=>({...blankSpread(),kind:k});assert.deepEqual(storyboardPages([p('cover'),p('single'),p('spread'),p('single'),p('spread')]).map(p=>[p.pages,p.blankBefore]),[[[],undefined],[[1],undefined],[[2,3],undefined],[[4],undefined],[[6,7],5]]);});
test('continuation ranges cover long text without duplication or source mutation',()=>{let e=fixture();const source=structuredClone(e.passages);e=add(e,0,5);assert.equal(storyboardIssues(e).filter(i=>i.blocking).length,1);e=add(e,5,10);assert.equal(storyboardIssues(e).length,0);assert.deepEqual(e.passages,source);assert.equal(e.bindings.length,2);});
test('overlapping ranges are blocked for approval and missing text is visible',()=>{let e=add(add(fixture(),0,6),5,10);assert.ok(storyboardIssues(e).some(i=>i.message.includes('Duplicate')));assert.throws(()=>act(e,{type:'approve-spread',id:e.storyboard[0].id}),/Resolve/);});
test('reordering retains stable allocations and invalidates approval and rejects malformed permutations',()=>{let e=add(add(fixture(),0,5),5,10);e=act(e,{type:'approve-spread',id:e.storyboard[0].id});const old=e.storyboard[0];assert.equal(spreadStatus(e,old),'Approved plan');e=act(e,{type:'reorder-spreads',ids:e.storyboard.map(p=>p.id).reverse()});assert.deepEqual(e.storyboard[1].allocations,old.allocations);assert.equal(spreadStatus(e,e.storyboard[1]),'Needs review');assert.throws(()=>act(e,{type:'reorder-spreads',ids:[old.id,old.id]}),/every plan/);});
test('source corrections identify registered spread targets and stale approval',()=>{let e=add(fixture());const id=e.storyboard[0].id;e=act(e,{type:'approve-spread',id});e=act(e,{type:'edit',id:e.passages[0].id,field:'original',text:'changed source',location:'Verse 1',reason:'Correction',provenance:'user-provided'});assert.equal(e.affectedTargets[0].targetId,id);assert.equal(spreadStatus(e,e.storyboard[0]),'Needs review');});
test('deleting a plan releases allocation and removes downstream bindings',()=>{let e=add(fixture());e=act(e,{type:'delete-spread',id:e.storyboard[0].id});assert.equal(e.bindings.length,0);assert.ok(storyboardIssues(e).some(i=>i.blocking));});
test('invalid text fields, ranges, and forged approval are rejected or discarded',()=>{let e=fixture();const plan={...blankSpread(),title:'bad',allocations:[{passageId:e.passages[0].id,fields:['notes'],start:0,end:10}]};assert.throws(()=>act(e,{type:'save-spread',plan}),/valid public/);e=act(e,{type:'save-spread',plan:{...plan,allocations:[],approvedContext:'forged'}});assert.equal(e.storyboard[0].approvedContext,undefined);});
test('supplementary text duplication is detected across original continuation ranges',()=>{let e=fixture();e=act(e,{type:'edit',id:e.passages[0].id,field:'translation',text:'Peace',location:'Verse 1',reason:'Translation',provenance:'user-provided'});e=act(e,{type:'approve',id:e.passages[0].id,field:'translation'});e=add(add(e,0,5),5,10);for(const p of [...e.storyboard])e=act(e,{type:'save-spread',plan:{...p,allocations:p.allocations.map(a=>({...a,fields:['original','translation']}))}});assert.ok(storyboardIssues(e).some(i=>i.message.includes('Duplicate translation')));});
test('guide usage keeps the version used to save a plan across reorder',()=>{let e=fixture();e.artDirection={versions:[{version:1}]};e=add(e);e.artDirection.versions.push({version:2});e=act(e,{type:'reorder-spreads',ids:e.storyboard.map(p=>p.id)});assert.equal(e.artGuideUsage[0].version,1);});
test('long commentary continues across plans with independent ranges and gap checks',()=>{let e=fixture();e=act(e,{type:'edit',id:e.passages[0].id,field:'commentary',text:'abcdefghijklmnopqrst',location:'Verse 1',reason:'Commentary',provenance:'user-provided'});e=act(e,{type:'approve',id:e.passages[0].id,field:'commentary'});e=add(add(e,0,5),5,10);for(const [index,p] of [...e.storyboard].entries())e=act(e,{type:'save-spread',plan:{...p,allocations:p.allocations.map(a=>({...a,fields:['original','commentary'],ranges:{commentary:{start:index*10,end:(index+1)*10}}}))}});assert.equal(storyboardIssues(e).length,0);const p=e.storyboard[1];e=act(e,{type:'save-spread',plan:{...p,allocations:p.allocations.map(a=>({...a,ranges:{commentary:{start:11,end:20}}}))}});assert.ok(storyboardIssues(e).some(i=>i.message.includes('Missing commentary')));});
