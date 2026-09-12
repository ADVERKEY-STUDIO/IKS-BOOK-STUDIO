import { gitaPilot, pilotAssets, pilotStudies, pilotCredits } from './gita-pilot';
import { emptyReferenceSpec } from './visual-references';
import type { Edition, EditionAction } from './devotional-edition';

/** Uses the same owner-scoped API and revision guards as ordinary editing. No approvals. */
export async function createGitaPilotDraft(onCreated:(id:string)=>void):Promise<string> {
 let owner=localStorage.getItem('iks-book-studio-owner');
 if(!owner){owner=crypto.randomUUID();localStorage.setItem('iks-book-studio-owner',owner);}
 const id=crypto.randomUUID(),headers={'x-book-studio-owner':owner};
 async function send(path:string,body:unknown|FormData):Promise<Edition>{
  const multipart=body instanceof FormData;
  const response=await fetch(path,{method:'POST',headers:multipart?headers:{...headers,'content-type':'application/json'},body:multipart?body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save the pilot draft.');return result.project.edition;
 }
 let e=await send('/api/projects',{id,title:gitaPilot.metadata.title,source:'Gita Supersite · three-verse review pilot',chapters:[],edition:{}});onCreated(id);
 const action=async(a:EditionAction)=>{e=await send('/api/edition',{projectId:id,expectedRevision:e.revision,action:a});};
 await action({type:'metadata',metadata:gitaPilot.metadata});
 await action({type:'save-print-format',format:gitaPilot.printFormat!});
 const passageIds:Record<string,string>={},planIds:Record<string,string>={},imageKeys:Record<string,string>={};
 for(const p of gitaPilot.passages){
  await action({type:'add',text:p.fields.original.text,location:p.location,provenance:'extracted'});
  const saved=e.passages.at(-1)!;passageIds[p.id]=saved.id;
  await action({type:'edit',id:saved.id,field:'translation',text:p.fields.translation.text,location:p.location,provenance:'generated',reason:'Original pilot paraphrase; editorial review pending.'});
 }
 for(const [i,study] of pilotStudies.entries()){
  await action({type:'save-reference',spec:{...emptyReferenceSpec(),kind:'environment',name:pilotCredits[i].title,role:'Historic artwork for pilot review',features:study.caption,colors:'Preserve original artwork colors',culturalNotes:study.intent},imageIds:[],reason:'Public-domain museum asset; review pending.'});
  const ref=e.visualReferences!.at(-1)!;
  const response=await fetch(pilotAssets[study.image]);if(!response.ok)throw new Error('Could not load museum artwork.');
  const form=new FormData();form.set('projectId',id);form.set('expectedRevision',String(e.revision));form.set('referenceId',ref.id);form.set('view','environment');form.set('caption',study.caption);form.set('credit',pilotCredits[i].note+' '+pilotCredits[i].url);form.set('provenance','uploaded');form.set('file',await response.blob(),study.image+'.jpg');
  e=await send('/api/edition/reference-image',form);imageKeys[study.image]=e.visualReferences!.find(r=>r.id===ref.id)!.versions.at(-1)!.images.at(-1)!.key;
 }
 for(const p of gitaPilot.storyboard!){await action({type:'save-spread',plan:{...p,id:'',allocations:p.allocations.map(a=>({...a,passageId:passageIds[a.passageId]}))}});planIds[p.id]=e.storyboard!.at(-1)!.id;}
 for(const c of gitaPilot.compositions!)await action({type:'save-composition',composition:{...c,planId:planIds[c.planId],revision:0,layers:c.layers.map(l=>({...l,binding:l.binding?{...l.binding,passageId:passageIds[l.binding.passageId]}:undefined,imageKey:l.kind==='image'?imageKeys[l.imageKey]:l.imageKey}))}});
 return id;
}
