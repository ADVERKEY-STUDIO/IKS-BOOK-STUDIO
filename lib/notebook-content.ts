export type NoteSection={heading:string;body:string;sourceReference:string};
export function parseNoteSections(value:unknown,count:number):NoteSection[]|undefined{
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length!==count)throw Error(`Notebook page needs exactly ${count} text sections, one for each numbered text area.`);
 return value.map(v=>{
  if(!v||typeof v!=='object'||typeof v.heading!=='string'||!v.heading.trim()||v.heading.length>90||typeof v.body!=='string'||!v.body.trim()||v.body.length>12000||typeof v.sourceReference!=='string'||!v.sourceReference.trim()||v.sourceReference.length>1000)throw Error('Every notebook section needs a short heading, body and source reference.');
  return {heading:v.heading,body:v.body,sourceReference:v.sourceReference};
 });
}
export function notebookOriginal(sections:NoteSection[]){return sections.map(s=>s.heading+'\n'+s.body).join('\n\n');}
