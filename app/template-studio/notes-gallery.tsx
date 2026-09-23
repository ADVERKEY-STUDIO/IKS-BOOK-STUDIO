'use client';
import {useEffect,useRef,useState} from 'react';
import type {TemplateId} from '../../lib/template-book';
import TemplateLayoutSamples from './template-layout-samples';
const references=['/templates/references/iks-notes/reference-1.jpg','/templates/references/iks-notes/reference-2.jpg'];
export default function NotesGallery({onChoose,disabled}:{onChoose:(id:TemplateId)=>void;disabled:boolean}){
 const [opened,setOpened]=useState(false),[page,setPage]=useState(0),[layouts,setLayouts]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(opened){dialog.current?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};}dialog.current?.close();},[opened]);
 const open=()=>{setPage(0);setLayouts(false);setOpened(true);};
 const choose=()=>{onChoose('iks-notes');setOpened(false);};
 return <section className="ts-literary notes-gallery" aria-labelledby="notes-heading">
 <h2 id="notes-heading">Handwritten study notes</h2><p className="ts-literary-intro">Illustrated notebook pages for learning, revision and discovery.</p>
 <div className="ts-literary-grid"><article>
 <button className="children-reference" onClick={open} aria-label="Look inside B5 handwritten study notes"><img src={references[0]} alt="Handwritten study-note reference with yellow highlights and small pen illustrations" loading="lazy"/><span>2 references · B5 portrait · 176 × 250 mm</span></button>
 <div className="ts-literary-info"><small>ILLUSTRATED STUDY NOTES</small><h3>IKS handwritten notes</h3><p>Ruled paper, highlighted headings, small diagrams and red pen callouts, arranged across four B5 page layouts.</p><div className="ts-literary-actions"><button onClick={open}>Look inside</button><button disabled={disabled} onClick={choose}>Use template</button></div></div>
 </article></div>
 <dialog ref={dialog} className="ts-sample-dialog" aria-label="B5 handwritten notes preview" onCancel={()=>setOpened(false)} onClose={()=>setOpened(false)}>{opened&&<>
 <div className="ts-sample-toolbar"><div><strong>IKS handwritten notes</strong><span>B5 portrait · 176 × 250 mm</span></div><button autoFocus onClick={()=>setOpened(false)}>Close</button></div>
 <div className="children-preview-actions"><button aria-pressed={!layouts} onClick={()=>setLayouts(false)}>Original references</button><button aria-pressed={layouts} onClick={()=>setLayouts(true)}>App layout samples</button></div>
 {layouts?<div className="notes-layout-preview"><TemplateLayoutSamples id="iks-notes"/></div>:<><div className="children-preview"><img src={references[page]} alt={`Handwritten notebook reference ${page+1}`}/></div><div className="children-preview-actions"><button disabled={page===0} onClick={()=>setPage(page-1)}>← Previous</button><span>{page+1} / 2</span><button disabled={page===1} onClick={()=>setPage(page+1)}>Next →</button></div></>}
 <div className="children-preview-footer"><p>Handwritten-style notes with editable text and diagrams. Each generated page uses B5 portrait dimensions.</p><button disabled={disabled} onClick={choose}>Use template</button></div>
 </>}</dialog>
 <style>{`.notes-layout-preview{overflow:auto;min-height:0}.notes-layout-preview .ts-template-layout-samples>iframe{display:block;max-width:480px;margin:16px auto}.notes-gallery .children-reference img{height:280px}`}</style>
 </section>;
}
