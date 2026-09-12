import { PROOF_FONT_SHA256 } from './font-coverage.ts';
import type { Edition, PassageField } from './devotional-edition.ts';
import { storyboardIssues } from './storyboard.ts';
import { guideStatus } from './art-direction.ts';
import { compositionIssues } from './spread-composition.ts';
import { productionReadiness, productionState } from './book-production.ts';

export type ReviewTarget={workspace?:'art'|'storyboard';planId?:string;layerId?:string;passageId?:string;field?:PassageField};
export type ReviewFinding={id:string;severity:'blocking'|'suggestion';category:string;message:string;target:ReviewTarget;origin:'automatic'|'human'};
export const humanReviewCategories=['Meaning and translation','Cultural and iconographic accuracy','Character continuity and expression','Typography and reading rhythm','Actual-size printed proof'] as const;
export type HumanReviewCategory=typeof humanReviewCategories[number];
export const renderCodes=['overflow','glyph','font','image','parity'] as const;
export type RenderProblem={code:typeof renderCodes[number];message:string;layerId?:string};
export type RenderResult={planId:string;problems:RenderProblem[]};
export type BookReview={render?:{context:string;at:string;results:RenderResult[]};manual:ReviewFinding[];decisions:{issueId:string;context:string;note:string;at:string}[];human:{category:HumanReviewCategory;decision:'approved'|'changes-required';note:string;context:string;at:string}[]};
export type BookReviewAction=
 | {type:'save-render-review';context:string;results:RenderResult[]}
 | {type:'add-review-issue';severity:ReviewFinding['severity'];message:string;target:ReviewTarget}
 | {type:'resolve-review-issue';issueId:string;note:string}
 | {type:'record-human-review';category:HumanReviewCategory;decision:'approved'|'changes-required';note:string};
/** Review decisions are outside this snapshot; book edits invalidate old review evidence. */
export function reviewContext(e:Edition):string{return JSON.stringify({protocol:1,font:PROOF_FONT_SHA256,metadata:e.metadata,passages:e.passages,storyboard:e.storyboard,compositions:e.compositions,printFormat:e.printFormat,artDirection:e.artDirection,references:e.visualReferences,artProduction:e.artProduction,parts:e.bookProduction?.parts,cover:e.bookProduction?.cover});}
export function renderReviewCurrent(e:Edition):boolean{return !!e.bookReview?.render&&e.bookReview.render.context===reviewContext(e);}
function validTarget(e:Edition,t:ReviewTarget):boolean {
 if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['workspace','planId','layerId','passageId','field'].includes(k)))return false;
 if(t.workspace&&!['art','storyboard'].includes(t.workspace))return false;
 if(t.planId&&!e.storyboard?.some(p=>p.id===t.planId))return false;
 if(t.layerId&&(!t.planId||!e.compositions?.find(c=>c.planId===t.planId)?.layers.some(l=>l.id===t.layerId)))return false;
 if(t.passageId&&!e.passages.some(p=>p.id===t.passageId&&!p.retired))return false;
 if(t.field&&(!t.passageId||!['original','transliteration','translation','commentary','notes'].includes(t.field)))return false;
 return true;
}
export function reviewFindings(e:Edition):ReviewFinding[]{
 const findings:ReviewFinding[]=[];const add=(id:string,severity:ReviewFinding['severity'],category:string,message:string,target:ReviewTarget={})=>findings.push({id,severity,category,message,target,origin:'automatic'});
 for(const p of e.passages.filter(p=>!p.retired))for(const field of ['original','transliteration','translation','commentary'] as const){
  if((field==='original'||p.fields[field].text)&&p.fields[field].status!=='approved')add(`source:${p.id}:${field}`,'blocking','Source',`Review ${field} in ${p.location||p.id}.`,{passageId:p.id,field});
 }
 if(!e.passages.some(p=>!p.retired))add('source:empty','blocking','Source','No active source passages.');
 for(const [i,issue] of storyboardIssues(e).entries())if(issue.message!=='Allocated text needs source approval or is empty.')add(`allocation:${i}:${issue.target}`,issue.blocking?'blocking':'suggestion','Allocation',issue.message,e.storyboard?.some(p=>p.id===issue.target)?{planId:issue.target,workspace:'storyboard'}:{passageId:issue.target});
 if(!e.storyboard?.length)add('plans:empty','blocking','Layout','No storyboard plans.');
 if(guideStatus(e)!=='approved')add('guide:review','blocking','Production','Approve the current book art guide.',{workspace:'art'});
 for(const p of e.storyboard||[]){
  const c=e.compositions?.find(c=>c.planId===p.id);
  if(!c){add(`layout:${p.id}:missing`,'blocking','Layout','Save a composition for this plan.',{planId:p.id});continue;}
  for(const [i,message] of compositionIssues(e,c).entries()){
   if(message.endsWith(': source text needs review.'))continue;
   const layer=c.layers.find(l=>message.startsWith(l.id+':'));
   add(`layout:${p.id}:${i}`,'blocking','Layout',message,{planId:p.id,...(layer?{layerId:layer.id}: {})});
  }
  const geometry=new Set(compositionIssues(e,c));
  for(const [i,message] of productionReadiness(e,p.id).entries())if(!geometry.has(message)&&message!=='Approve the current book art guide.'){const layer=c.layers.find(l=>message.startsWith(l.id+':'));add(`readiness:${p.id}:${i}`,'blocking','Production',message,{planId:p.id,...(layer?{layerId:layer.id}:message.includes('storyboard plan')?{workspace:'storyboard' as const}:{})});}
  if(productionState(e,p.id)!=='Approved')add(`production:${p.id}`,'suggestion','Production',`Production state: ${productionState(e,p.id)}. Final release requires current production review.`,{planId:p.id});
 }
 if(!renderReviewCurrent(e))add('render:pending','blocking','Rendered checks',e.bookReview?.render?'Book changed since the last rendered audit. Run it again.':'Run the rendered audit to check fonts, images, text fit, and proof markup.');
 else for(const result of e.bookReview!.render!.results)for(const [i,p] of result.problems.entries())add(`render:${result.planId}:${i}`,'blocking','Rendered checks',p.message,{planId:result.planId,...(p.layerId?{layerId:p.layerId}: {})});
 findings.push(...(e.bookReview?.manual||[]));
 for(const category of humanReviewCategories){const last=e.bookReview?.human.filter(h=>h.category===category).at(-1);if(!last||last.context!==reviewContext(e)||last.decision!=='approved')add(`human:${category}`,last?.context===reviewContext(e)&&last.decision==='changes-required'?'blocking':'suggestion','Human review',`${category}: ${!last?'not reviewed':last.context!==reviewContext(e)?'review is stale':'changes requested'}.`);}
 return findings;
}
export function findingResolved(e:Edition,f:ReviewFinding):boolean {
 if(f.origin==='automatic'&&f.severity==='blocking')return false;
 const decision=e.bookReview?.decisions.filter(d=>d.issueId===f.id).at(-1);return decision?.context===reviewContext(e);
}
export function openReviewFindings(e:Edition):ReviewFinding[]{return reviewFindings(e).filter(f=>!findingResolved(e,f));}
/** Working spread proofs need current rendered evidence and cannot hide documented critical issues. */
export function proofReviewIssues(e:Edition,planId:string):string[]{
 return openReviewFindings(e).filter(f=>f.severity==='blocking'&&(f.category==='Rendered checks'||f.origin==='human')&&(!f.target.planId||f.target.planId===planId)&&(!f.target.passageId||e.storyboard?.find(p=>p.id===planId)?.allocations.some(a=>a.passageId===f.target.passageId))).map(f=>f.message);
}
export function releaseReviewIssues(e:Edition):string[]{
 const issues=openReviewFindings(e).filter(f=>f.severity==='blocking').map(f=>f.message);
 for(const category of humanReviewCategories){const h=e.bookReview?.human.filter(h=>h.category===category).at(-1);if(!h||h.context!==reviewContext(e)||h.decision!=='approved')issues.push(`${category}: current approval required for release.`);}
 for(const p of e.storyboard||[])if(productionState(e,p.id)!=='Approved')issues.push(`${p.title}: current production approval required for release.`);
 return [...new Set(issues)];
}
export function applyBookReviewAction(e:Edition,a:BookReviewAction,at:string,makeId:()=>string):void{
 const data=e.bookReview ||= {manual:[],decisions:[],human:[]};
 const note=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>4000)throw new Error('Provide a note of 1–4,000 characters.');};
 if(a.type==='save-render-review'){
  if(a.context!==reviewContext(e))throw new Error('The book changed during the audit. Run it again.');
  const ids=(e.compositions||[]).filter(c=>e.storyboard?.some(p=>p.id===c.planId)).map(c=>c.planId);
  if(!Array.isArray(a.results)||!ids.length||a.results.length!==ids.length||new Set(a.results.map(r=>r.planId)).size!==ids.length||a.results.some(r=>!ids.includes(r.planId)))throw new Error('Audit every active saved composition exactly once.');
  for(const r of a.results){if(!Array.isArray(r.problems)||r.problems.length>500)throw new Error('Invalid render problems.');for(const p of r.problems){if(!renderCodes.includes(p.code)||!validTarget(e,{planId:r.planId,...(p.layerId?{layerId:p.layerId}:{})}))throw new Error('Invalid render issue target.');note(p.message);}}
  data.render={context:a.context,at,results:structuredClone(a.results)};
 }else if(a.type==='add-review-issue'){
  if(!['blocking','suggestion'].includes(a.severity)||!validTarget(e,a.target))throw new Error('Choose a valid severity and target.');note(a.message);
  if(data.manual.length>=1000)throw new Error('This book has reached 1,000 manual findings.');
  data.manual.push({id:`manual:${makeId()}`,severity:a.severity,category:'Reviewer finding',message:a.message,target:structuredClone(a.target),origin:'human'});
 }else if(a.type==='resolve-review-issue'){
  note(a.note);const issue=reviewFindings(e).find(f=>f.id===a.issueId);if(!issue)throw new Error('Finding no longer exists.');
  if(issue.origin==='automatic'&&issue.severity==='blocking')throw new Error('Automatic blockers must be corrected and checked again; they cannot be waived.');
  if(issue.id.startsWith('human:'))throw new Error('Record a human review decision for this category.');
  if(data.decisions.length>=5000)throw new Error('This book has reached 5,000 resolution records.');
  data.decisions.push({issueId:issue.id,note:a.note,context:reviewContext(e),at});
 }else{
  note(a.note);if(!humanReviewCategories.includes(a.category)||!['approved','changes-required'].includes(a.decision))throw new Error('Choose a review category and decision.');
  if(data.human.length>=1000)throw new Error('This book has reached 1,000 human review decisions.');
  data.human.push({category:a.category,decision:a.decision,note:a.note,context:reviewContext(e),at});
 }
}
