export type BookSection = {kind:'copyright'|'introduction'|'aarti';title:string;body:string;sourceReference:string};
const kinds=['copyright','introduction','aarti'];
export function parseBookSections(value:unknown):BookSection[]|undefined {
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length>40)throw Error('Book sections must contain at most 40 spreads.');
 return value.map(item=>{
  if(!item||typeof item!=='object'||!kinds.includes(item.kind))throw Error('Invalid book section kind.');
  for(const [key,max] of [['title',120],['body',2400],['sourceReference',200]] as const)
   if(typeof item[key]!=='string'||item[key].length>max)throw Error(`Book section ${key} exceeds ${max} characters or is not text.`);
  return {kind:item.kind,title:item.title,body:item.body,sourceReference:item.sourceReference};
 });
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Separate column elements keep their geometry in editable Canva exports. */
export function sectionColumns(body:string):string[] {
 const breaks=[...body.matchAll(/\n\s*\n/g)].map(m=>m.index!);
 const candidates=breaks.length?breaks:[...body.matchAll(/\s+/g)].map(m=>m.index!);
 if(!candidates.length)return [body];
 const mid=candidates.reduce((a,b)=>Math.abs(b-body.length/2)<Math.abs(a-body.length/2)?b:a);
 return [body.slice(0,mid),body.slice(mid)];
}
export function renderBookSections(entries:BookSection[]=[],part:'front'|'back') {
 return entries.filter(e=>part==='front'?e.kind!=='aarti':e.kind==='aarti').map(e=>`<section class="spread book-section" data-section-kind="${e.kind}" aria-label="${esc(e.title)}"><h1 contenteditable="true">${esc(e.title)}</h1><div class="book-section-body">${sectionColumns(e.body).map(s=>`<div class="book-section-column" contenteditable="true">${esc(s.trim())}</div>`).join('')}</div><small contenteditable="true">${esc(e.sourceReference)}</small></section>`).join('');
}
export function bookSectionsMarkdown(entries:BookSection[]=[],part:'front'|'back') {
 return entries.filter(e=>part==='front'?e.kind!=='aarti':e.kind==='aarti').map(e=>`\n\n## ${e.title}\n\n${e.body}\n\nSource: ${e.sourceReference}`).join('');
}
export function bookSectionsCss(){return `.spread.book-section{display:block;padding:14mm 20mm;container-type:inline-size;background:#fffbed;color:#292723}.book-section h1{font-size:2.4cqw;line-height:1.3;color:#8b3628;margin:0 0 3%}.book-section-body{display:grid;grid-template-columns:1fr 1fr;gap:10%;height:80%}.book-section-column{white-space:pre-wrap;overflow-wrap:anywhere;font-size:1.4cqw;line-height:1.5}.book-section>small{position:absolute;bottom:6mm;left:20mm;right:20mm;font-size:1cqw}`;}
