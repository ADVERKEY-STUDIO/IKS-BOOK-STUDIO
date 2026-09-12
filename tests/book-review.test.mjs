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
const {reviewContext,reviewFindings,openReviewFindings,findingResolved,releaseReviewIssues,proofReviewIssues,renderReviewCurrent}=load(resolve('lib/book-review.ts'));
function audited(e){return act(e,{type:'save-render-review',context:reviewContext(e),results:e.compositions.map(c=>({planId:c.planId,problems:[]}))});}
test('automatic blockers cannot be waived and audit coverage must be complete',()=>{
 let e=fixture();assert.throws(()=>act(e,{type:'resolve-review-issue',issueId:'render:pending',note:'Ignore'}),/cannot be waived/);
 assert.throws(()=>act(e,{type:'save-render-review',context:reviewContext(e),results:[]}),/every active/);
 e=audited(e);assert.equal(renderReviewCurrent(e),true);assert.ok(!openReviewFindings(e).some(f=>f.id==='render:pending'));
});
test('book edits invalidate rendered evidence and reject stale audit writes',()=>{
 let e=audited(fixture());const context=reviewContext(e),c=structuredClone(e.compositions[0]);c.layers[0].width-=5;e=act(e,{type:'save-composition',composition:c});
 assert.equal(renderReviewCurrent(e),false);assert.ok(proofReviewIssues(e,c.planId).some(s=>s.includes('changed')));
 assert.throws(()=>act(e,{type:'save-render-review',context,results:e.compositions.map(c=>({planId:c.planId,problems:[]}))}),/changed during/);
});
test('manual blocking issues can be resolved with history but reopen after edits',()=>{
 let e=audited(fixture());const id=e.storyboard[0].id;e=act(e,{type:'add-review-issue',severity:'blocking',message:'Review ornament attribution',target:{planId:id,layerId:e.compositions[0].layers[0].id}});
 const f=e.bookReview.manual[0];assert.ok(proofReviewIssues(e,id).includes(f.message));
 e=act(e,{type:'resolve-review-issue',issueId:f.id,note:'Checked source attribution'});assert.equal(findingResolved(e,f),true);
 const c=structuredClone(e.compositions[0]);c.layers[0].x+=1;e=act(e,{type:'save-composition',composition:c});assert.equal(findingResolved(e,f),false);assert.equal(e.bookReview.decisions.length,1);
});
test('render problems retain exact layer targets and prevent proof export',()=>{
 let e=fixture(),id=e.compositions[0].planId,layerId=e.compositions[0].layers[0].id;
 e=act(e,{type:'save-render-review',context:reviewContext(e),results:e.compositions.map((c,i)=>({planId:c.planId,problems:i?[]:[{code:'glyph',message:'Missing U+1F600',layerId}]}))});
 const f=reviewFindings(e).find(f=>f.message==='Missing U+1F600');assert.deepEqual(f.target,{planId:id,layerId});assert.ok(proofReviewIssues(e,id).includes(f.message));assert.ok(!proofReviewIssues(e,e.compositions[1].planId).includes(f.message));
 assert.throws(()=>act(e,{type:'resolve-review-issue',issueId:f.id,note:'Waive missing glyph'}),/cannot be waived/);
});
test('technical success never implies human sign-off or release readiness',()=>{
 let e=audited(fixture());assert.ok(releaseReviewIssues(e).some(s=>s.includes('Actual-size printed proof')));
 e=act(e,{type:'record-human-review',category:'Meaning and translation',decision:'approved',note:'Reviewer checked source witness'});
 assert.equal(e.bookReview.human.length,1);assert.ok(releaseReviewIssues(e).some(s=>s.includes('Cultural')));
 const c=structuredClone(e.compositions[0]);c.layers[0].x+=1;e=act(e,{type:'save-composition',composition:c});assert.ok(releaseReviewIssues(e).some(s=>s.includes('Meaning and translation')));
});
test('review detects altered approved text through saved composition source context',()=>{
 const e=fixture();e.passages[0].fields.original.text='Altered!';
 assert.ok(reviewFindings(e).some(f=>f.message.includes('Source wording changed')));
});

test('pending printed-proof sign-off blocks release without creating a working-proof deadlock',()=>{
 let e=audited(fixture());e=act(e,{type:'record-human-review',category:'Actual-size printed proof',decision:'changes-required',note:'Native PDF inspection remains pending'});
 assert.ok(releaseReviewIssues(e).some(s=>s.includes('Actual-size printed proof')));
 assert.deepEqual(proofReviewIssues(e,e.storyboard[0].id),[]);
});
