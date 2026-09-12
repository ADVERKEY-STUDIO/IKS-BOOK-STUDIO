import type { Edition } from './devotional-edition.ts';
import { guideStatus, latestGuide } from './art-direction.ts';
import { approvedReference } from './visual-references.ts';
import { approvedArt, artStatus } from './art-production.ts';
import { applyStoryboardAction, blankSpread, spreadStatus, storyboardPages } from './storyboard.ts';
import { applyCompositionAction, compositionFormat, compositionIssues, layerDefaults } from './spread-composition.ts';

export const productionStates = ['Draft', 'Awaiting review', 'Approved', 'Stale'] as const;
export type ProductionState = typeof productionStates[number];
export const bookPartRoles = ['Title page', 'Source credits', 'Introduction', 'Contents', 'Glossary', 'Notes', 'Colophon', 'Front cover', 'Back cover'] as const;
export type BookPartRole = typeof bookPartRoles[number];
export type ProductionBatch = { id:string; name:string; planIds:string[]; archived:boolean };
export type ProductionReview = { planId:string; kind:'submit'|'approve'|'rework'; at:string; note:string; context:string };
export type PrinterCover = { printer:string; templateReference:string; flatWidth:number; flatHeight:number; spineWidth:number; bleed:number; notes:string };
export type BookProduction = { batches:ProductionBatch[]; reviews:ProductionReview[]; parts:{planId:string;role:BookPartRole}[]; cover?:PrinterCover };
export type BookProductionAction =
 | {type:'save-production-batch';id?:string;name:string;planIds:string[]}
 | {type:'archive-production-batch';id:string;archived:boolean}
 | {type:'review-production-spread';planId:string;kind:ProductionReview['kind'];note:string;checks?:{meaning:boolean;artwork:boolean;textFit:boolean}}
 | {type:'add-book-part';role:BookPartRole;title:string;body:string}
 | {type:'save-printer-cover';cover:PrinterCover};
function record(e:Edition):BookProduction {return e.bookProduction ||= {batches:[],reviews:[],parts:[]};}
function nonempty(v:unknown,label:string,max=2000):asserts v is string {if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`${label} is required (up to ${max} characters).`);}
/** Deliberately excludes unrelated spreads and batch administration. */
export function productionContext(e:Edition,id:string):string {
 const plan=e.storyboard?.find(p=>p.id===id),c=e.compositions?.find(c=>c.planId===id);
 const keys=c?.layers.filter(l=>l.kind==='image'&&!l.hidden).map(l=>l.imageKey)||[];
 const refs=e.visualReferences?.filter(r=>r.versions.some(v=>v.images.some(i=>keys.includes(i.key)))).map(r=>({id:r.id,archived:r.archived,approved:r.approvedVersion,version:approvedReference(r)}));
 const art=e.artProduction?.spreads.filter(s=>s.versions.some(v=>keys.includes(v.image.key))).map(s=>({planId:s.planId,approvedId:s.approvedId,approval:s.approvals.at(-1),versions:s.versions.filter(v=>keys.includes(v.image.key))}));
 return JSON.stringify({plan,c,format:compositionFormat(e,c),source:plan?.allocations.map(a=>e.passages.find(p=>p.id===a.passageId)),guide:e.artDirection,refs,art,metadata:e.metadata,pages:storyboardPages(e.storyboard||[]).find(p=>p.id===id),cover:plan?.kind==='cover'?e.bookProduction?.cover:undefined});
}
export function productionReadiness(e:Edition,id:string):string[] {
 const p=e.storyboard?.find(p=>p.id===id),c=e.compositions?.find(c=>c.planId===id),issues:string[]=[];
 if(!p)return ['Plan no longer exists.'];
 if(!c)return ['Save a composition in Designer.'];
 if(!c.layers.some(l=>!l.hidden&&(l.kind==='image'||l.kind==='text'&&(l.binding||l.text.trim()))))issues.push('The composition has no visible text or artwork.');
 if(guideStatus(e)!=='approved')issues.push('Approve the current book art guide.');
 if(spreadStatus(e,p)!=='Approved plan')issues.push('Review and approve the current storyboard plan.');
 issues.push(...compositionIssues(e,c));
 for(const l of c.layers.filter(l=>l.kind==='image'&&!l.hidden)){
  const art=e.artProduction?.spreads.find(s=>s.versions.some(v=>v.image.key===l.imageKey));
  if(art){if(approvedArt(e,art.planId)?.image.key!==l.imageKey||artStatus(e,art.planId)!=='Approved artwork')issues.push(`${l.id}: approve the current production asset.`);continue;}
  const ref=e.visualReferences?.find(r=>r.versions.some(v=>v.images.some(i=>i.key===l.imageKey))),v=ref&&approvedReference(ref);
  if(!ref||ref.archived||!v?.images.some(i=>i.key===l.imageKey)||v.artGuideVersion!==latestGuide(e)?.version)issues.push(`${l.id}: review and approve this reference asset against the current guide.`);
 }
 return [...new Set(issues)];
}
export function productionState(e:Edition,id:string):ProductionState {
 const last=e.bookProduction?.reviews.filter(r=>r.planId===id).at(-1);
 if(!last||last.kind==='rework')return 'Draft';
 if(last.context!==productionContext(e,id))return 'Stale';
 if(last.kind==='submit')return 'Awaiting review';
 return productionReadiness(e,id).length?'Stale':'Approved';
}
export function applyBookProductionAction(e:Edition,a:BookProductionAction,at:string,makeId:()=>string):void {
 const data=record(e),plans=e.storyboard||[];
 if(a.type==='save-production-batch'){
  nonempty(a.name,'Batch name',200);
  if(!Array.isArray(a.planIds)||!a.planIds.length||a.planIds.length>50||new Set(a.planIds).size!==a.planIds.length||a.planIds.some(id=>!plans.some(p=>p.id===id)))throw new Error('Choose 1–50 distinct active plans.');
  if(data.batches.some(b=>!b.archived&&b.id!==a.id&&b.planIds.some(id=>a.planIds.includes(id))))throw new Error('A selected spread already belongs to another active batch.');
  const old=a.id?data.batches.find(b=>b.id===a.id):undefined;if(a.id&&!old)throw new Error('Batch no longer exists.');
  if(!old&&data.batches.length>=200)throw new Error('This book has reached 200 batches.');
  if(old){old.name=a.name;old.planIds=[...a.planIds];}else data.batches.push({id:makeId(),name:a.name,planIds:[...a.planIds],archived:false});
 }else if(a.type==='archive-production-batch'){
  const b=data.batches.find(b=>b.id===a.id);if(!b||typeof a.archived!=='boolean')throw new Error('Choose an existing batch.');
  if(!a.archived&&data.batches.some(other=>other.id!==b.id&&!other.archived&&other.planIds.some(id=>b.planIds.includes(id))))throw new Error('Restore would place a spread in two active batches.');b.archived=a.archived;
 }else if(a.type==='review-production-spread'){
  if(!plans.some(p=>p.id===a.planId)||!['submit','approve','rework'].includes(a.kind))throw new Error('Choose an active spread and review action.');
  nonempty(a.note,'Review or rework note');
  if(a.kind!=='rework'&&!e.compositions?.some(c=>c.planId===a.planId))throw new Error('Save a composition before requesting review.');
  if(a.kind==='approve'){
   if(a.checks?.meaning!==true||a.checks?.artwork!==true||a.checks?.textFit!==true)throw new Error('Confirm meaning, artwork continuity, and actual-size text fit.');
   const issues=productionReadiness(e,a.planId);if(issues.length)throw new Error(issues.join(' '));
  }
  if(data.reviews.length>=5000)throw new Error('This book has reached 5,000 production review events.');
  data.reviews.push({planId:a.planId,kind:a.kind,note:a.note,at,context:productionContext(e,a.planId)});
 }else if(a.type==='save-printer-cover'){
  const c=a.cover;if(!c)throw new Error('Enter printer-supplied cover requirements.');
  nonempty(c.printer,'Printer',200);nonempty(c.templateReference,'Printer template reference',2000);
  if(typeof c.notes!=='string'||c.notes.length>4000)throw new Error('Keep cover notes under 4,000 characters.');
  for(const k of ['flatWidth','flatHeight','spineWidth','bleed'] as const)if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<0)throw new Error('Enter finite printer dimensions in millimetres.');
  if(c.flatWidth<80||c.flatWidth>1500||c.flatHeight<80||c.flatHeight>1000||c.bleed>20||c.spineWidth>200||c.spineWidth+2*c.bleed>=c.flatWidth||2*c.bleed>=c.flatHeight)throw new Error('Check printer-supplied flat size, spine, and bleed.');
  data.cover={printer:c.printer,templateReference:c.templateReference,flatWidth:c.flatWidth,flatHeight:c.flatHeight,spineWidth:c.spineWidth,bleed:c.bleed,notes:c.notes};
 }else{
  if(!bookPartRoles.includes(a.role))throw new Error('Choose a book section.');nonempty(a.title,'Section title',200);nonempty(a.body,'Section text',10000);
  if(data.parts.some(p=>p.role===a.role&&plans.some(s=>s.id===p.planId)))throw new Error('This section already exists. Edit it in Designer or Storyboard.');
  const cover=a.role==='Front cover'||a.role==='Back cover';
  applyStoryboardAction(e,{type:'save-spread',plan:{...blankSpread(),title:a.title,kind:cover?'cover':'single',purpose:a.role,concept:'Use the current book identity; review the supplied editorial text.',textArea:'Title above, supplied text below; editable in Designer.'}},makeId);
  const p=e.storyboard!.at(-1)!;data.parts.push({planId:p.id,role:a.role});
  const front=['Title page','Source credits','Introduction','Contents','Front cover'].includes(a.role);
  if(front){const without=e.storyboard!.filter(s=>s.id!==p.id);const n=a.role==='Front cover'?0:without.findIndex(s=>!data.parts.some(part=>part.planId===s.id&&['Front cover','Title page','Source credits','Introduction','Contents'].includes(part.role)));without.splice(n<0?without.length:n,0,p);e.storyboard=without;}
  const f=compositionFormat(e),g=latestGuide(e)?.guide,titleHeight=Math.min(45,(f.height-2*f.margin)*.3);
  const title={...layerDefaults(makeId(),'text'),x:f.margin,y:f.margin,width:f.width-2*f.margin,height:titleHeight,text:a.title,fontSize:24,color:g?.palette.ink||'#263c34'};
  const body={...layerDefaults(makeId(),'text'),x:f.margin,y:f.margin+titleHeight+5,width:f.width-2*f.margin,height:f.height-2*f.margin-titleHeight-5,text:a.body,fontSize:14,color:g?.palette.ink||'#263c34'};
  applyCompositionAction(e,{type:'save-composition',composition:{planId:p.id,planRevision:p.revision,revision:0,guideVersion:latestGuide(e)?.version||0,paper:g?.palette.paper||'#fffdf7',layers:[title,body]}});
 }
}
