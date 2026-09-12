import type { Edition } from './devotional-edition.ts';
import { artDirectionBrief } from './art-direction.ts';
import { referenceManifest, type ReferenceImage } from './visual-references.ts';
import { compositionFormat } from './spread-composition.ts';
import { spreadStatus } from './storyboard.ts';

export type ArtRequest = { id:string; planId:string; createdAt:string; note:string; context:string; prompt:string; width:number; height:number; referenceImages:ReferenceImage[] };
export type ArtVersion = { id:string; requestId:string; image:ReferenceImage; createdAt:string; note:string };
export type SpreadArt = { planId:string; versions:ArtVersion[]; approvedId?:string; approvals:{versionId:string;at:string;context:string}[] };
export type ArtProduction = { requests:ArtRequest[]; spreads:SpreadArt[] };
export type ProductionAction =
 | {type:'create-art-request';planId:string;note:string}
 | {type:'import-art-result';requestId:string;image:ReferenceImage;note:string}
 | {type:'approve-art';planId:string;versionId:string};
export function artContext(edition:Edition,planId:string):string {
 const plan=edition.storyboard?.find(p=>p.id===planId),composition=edition.compositions?.find(c=>c.planId===planId);
 return JSON.stringify({plan,guide:edition.artDirection,source:plan?.allocations.map(a=>edition.passages.find(p=>p.id===a.passageId)),references:edition.visualReferences?.filter(r=>!r.archived).map(r=>[r.id,r.approvedVersion]),format:compositionFormat(edition,composition),textAreas:composition?.layers.filter(l=>l.kind==='text').map(l=>({x:l.x,y:l.y,width:l.width,height:l.height,hidden:l.hidden}))});
}
export function approvedArt(edition:Edition,planId:string):ArtVersion|undefined {const art=edition.artProduction?.spreads.find(s=>s.planId===planId);return art?.versions.find(v=>v.id===art.approvedId);}
export function artStatus(edition:Edition,planId:string):string {
 const art=edition.artProduction?.spreads.find(s=>s.planId===planId);if(!art?.approvedId)return 'No approved artwork';
 const approval=art.approvals.at(-1);return approval?.context===artContext(edition,planId)?'Approved artwork':'Artwork needs review';
}
export function productionImages(edition:Edition):ReferenceImage[] {return edition.artProduction?.spreads.flatMap(s=>s.versions.map(v=>v.image))||[];}
export function editionImages(edition:Edition):ReferenceImage[] {return [...(edition.visualReferences||[]).flatMap(r=>r.versions.flatMap(v=>v.images)),...productionImages(edition)];}
export function applyProductionAction(edition:Edition,action:ProductionAction,at:string,makeId:()=>string):void {
 const production=edition.artProduction ||= {requests:[],spreads:[]};
 if(action.type==='create-art-request'){
  const plan=edition.storyboard?.find(p=>p.id===action.planId);if(!plan)throw new Error('Choose a storyboard plan.');
  if(spreadStatus(edition,plan)!=='Approved plan')throw new Error('Approve the current storyboard plan first.');
  if(typeof action.note!=='string'||!action.note.trim()||action.note.length>4000)throw new Error('Add a production or revision note up to 4,000 characters.');
  if(production.requests.length>=500)throw new Error('This book has reached 500 production requests.');
  const guide=artDirectionBrief(edition),version=edition.artDirection!.versions.at(-1)!.version,refs=referenceManifest(edition,version);
  const composition=edition.compositions?.find(c=>c.planId===plan.id),format=compositionFormat(edition,composition);
  const width=Math.ceil((format.width*(plan.kind==='spread'?2:1)+2*format.bleed)/25.4*300),height=Math.ceil((format.height+2*format.bleed)/25.4*300);
  const content=plan.allocations.map(a=>{const p=edition.passages.find(p=>p.id===a.passageId)!;return {passageId:p.id,fields:Object.fromEntries(a.fields.map(field=>{const range=field==='original'?a:a.ranges?.[field]||{start:0,end:p.fields[field].text.length};return [field,p.fields[field].text.slice(range.start,range.end)];}))};});
  const request:ArtRequest={id:makeId(),planId:plan.id,createdAt:at,note:action.note,context:artContext(edition,plan.id),width,height,referenceImages:structuredClone(refs.flatMap(r=>r.images)),prompt:`${guide}\n\nSPREAD PRODUCTION REQUEST\n${JSON.stringify(plan,null,2)}\nApproved passage context (do not draw text): ${JSON.stringify(content)}\nRequired print pixels at 300 dpi including bleed: ${width} × ${height}.\nReserved text areas: ${plan.textArea}\nPhysical text boxes in millimetres from trim origin: ${JSON.stringify(composition?.layers.filter(l=>l.kind==='text').map(l=>({x:l.x,y:l.y,width:l.width,height:l.height,hidden:l.hidden}))||[])}\nRevision direction: ${action.note}\nProduce finished artwork only. Do not render letters, scripture, page numbers, or captions in the image. Keep text regions quiet. Preserve approved identifying features. Return an image for human review; this request never approves artwork automatically.`};
  production.requests.push(request);
 }else if(action.type==='import-art-result'){
  const request=production.requests.find(r=>r.id===action.requestId);if(!request)throw new Error('Choose a saved production request.');
  if(typeof action.note!=='string'||!action.note.trim()||action.note.length>4000)throw new Error('Describe the imported revision.');
  if(!['uploaded','external-generation'].includes(action.image.provenance))throw new Error('Choose a valid artwork provenance.');
  for(const key of ['credit','caption'] as const)if(typeof action.image[key]!=='string'||!action.image[key].trim()||action.image[key].length>2000)throw new Error('Add a caption and source credit up to 2,000 characters.');
  let art=production.spreads.find(s=>s.planId===request.planId);if(!art){art={planId:request.planId,versions:[],approvals:[]};production.spreads.push(art);}
  if(art.versions.length>=100)throw new Error('This spread has reached 100 artwork versions.');
  art.versions.push({id:makeId(),requestId:request.id,image:action.image,note:action.note,createdAt:at});
 }else{
  const art=production.spreads.find(s=>s.planId===action.planId),version=art?.versions.find(v=>v.id===action.versionId),plan=edition.storyboard?.find(p=>p.id===action.planId);
  if(!art||!version||!plan)throw new Error('Select a saved artwork version for an active spread.');
  if(spreadStatus(edition,plan)!=='Approved plan')throw new Error('Approve the current storyboard plan before artwork.');
  artDirectionBrief(edition);
  art.approvedId=version.id;art.approvals.push({versionId:version.id,at,context:artContext(edition,plan.id)});
 }
}
