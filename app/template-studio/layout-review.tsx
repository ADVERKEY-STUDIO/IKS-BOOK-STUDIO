'use client';
import { useEffect, useState } from 'react';
import type { TemplateBook } from '../../lib/template-book';
import { renderTemplatePage, templates } from '../../lib/template-book';
import { blueprintSvg, templateBlueprints, templateSize, planTemplateBook, layoutIssues } from '../../lib/template-layouts';

export function BookSpreadPreview({ book, index, images, onLoad }: { book:TemplateBook; index:number; images:Record<string,Blob>; onLoad?:(doc:Document)=>void }) {
 const [urls,setUrls]=useState<Record<string,string>>({});
 const image=images[book.pages[index].image],name=book.pages[index].image;
 useEffect(()=>{
  const url=image?URL.createObjectURL(image):undefined;
  queueMicrotask(()=>setUrls(url?{[name]:url}:{}));
  return ()=>{if(url)URL.revokeObjectURL(url);};
 },[image,name]);
 const size=templateSize(book.templateId);
 return <iframe className="ts-spread-frame" title={`Spread ${index+1}: ${book.pages[index].title}`} sandbox="allow-same-origin" style={{aspectRatio:`${size.width}/${size.height}`}} srcDoc={renderTemplatePage(book,index,urls)} onLoad={e=>{const doc=e.currentTarget.contentDocument;if(doc)void doc.fonts.ready.then(()=>onLoad?.(doc));}}/>;
}
export function LayoutDiagram({templateId,blueprint}:{templateId:string;blueprint:string}){
 const b=templateBlueprints(templateId).find(v=>v.id===blueprint)!;
 const t=templates.find(v=>v.id===templateId)!;const size=templateSize(templateId);
 return <img className="ts-layout-diagram" alt={`${b.name}: ${b.intent}`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(blueprintSvg(b,t.paper,'#a4c5b8',1000*size.height/size.width))}`}/>;
}
export default function LayoutReview({book,busy,onClose,onCreate}:{book:TemplateBook;busy:boolean;onClose:()=>void;onCreate:(book:TemplateBook)=>Promise<void>}){
 const [planned,setPlanned]=useState(()=>planTemplateBook(book));
 const options=templateBlueprints(book.templateId),issues=layoutIssues(planned);
 return <section className="ts-panel ts-layout-review" aria-label="Review spread layout plan">
  <div className="ts-actions"><h2>Plan the whole book</h2><button onClick={onClose}>Close layout plan</button></div>
  <p>Each spread has its own arrangement. Compare the sequence and choose layouts that suit the passages. Coloured areas show separate scenes; pale areas hold editable words. New illustrations must follow these positions.</p>
  <p>Your current book stays unchanged. Creating the redesign saves a separate copy with the same text and empty artwork slots, then downloads the matching generation request.</p>
  <div className="ts-layout-grid">{planned.pages.map((p,i)=><article key={p.id}>
   <LayoutDiagram templateId={book.templateId} blueprint={p.blueprint!}/>
   <strong>{i+1}. {p.title}</strong><label>Spread arrangement<select value={p.blueprint} onChange={e=>setPlanned({...planned,pages:planned.pages.map((v,j)=>j===i?{...v,blueprint:e.target.value,layoutReason:'Selected during whole-book layout review.'}:v)})}>{options.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <p className="ts-help">{p.layoutReason}</p><details><summary>Passage and scene</summary><p>{p.original}</p><p>{p.scene}</p></details>
  </article>)}</div>
  {issues.length>0&&<details open><summary>Layout review notes ({issues.length})</summary>{issues.map((note,i)=><p key={i}>{note}</p>)}</details>}
  <button disabled={busy} onClick={()=>void onCreate(planned)}>Create redesign copy & download request</button>
 </section>;
}
