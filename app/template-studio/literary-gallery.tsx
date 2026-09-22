'use client';
import TemplateLayoutSamples from './template-layout-samples';
import { useEffect, useRef, useState } from 'react';
import { literaryTemplates, literaryReferenceUrl } from '../../lib/literary-templates';
import { renderTemplateSample } from '../../lib/template-sample';
import type { TemplateId } from '../../lib/template-book';
const samples = Object.fromEntries(literaryTemplates.map(t=>[t.id,renderTemplateSample(t.id)]));
export default function LiteraryGallery({onChoose,disabled}:{onChoose:(id:TemplateId)=>void;disabled:boolean}){
 const [opened,setOpened]=useState<typeof literaryTemplates[number]>();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(opened){dialog.current?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};}dialog.current?.close();},[opened]);
 return <section className="ts-literary" aria-labelledby="literary-heading">
 <h2 id="literary-heading">Six new ways into a book.</h2><p className="ts-literary-intro">Explore a cover and two interior pages before choosing. Original layouts inspired by your Literary Hub picks.</p>
 <div className="ts-literary-grid">{literaryTemplates.map(t=><article key={t.id}>
 <div className="ts-sample-frame"><iframe title={`${t.name}: cover and two interior pages`} srcDoc={samples[t.id]} sandbox="allow-same-origin" loading="lazy" tabIndex={-1}/></div>
 <div className="ts-literary-info"><h3>{t.name}</h3><p>{t.description}</p><small>Cover inspiration: <a href={literaryReferenceUrl} target="_blank" rel="noreferrer">{t.reference}</a> · {t.designer}</small><div className="ts-literary-actions"><button onClick={()=>setOpened(t)} aria-label={`Preview ${t.name}`}>Look inside</button><button disabled={disabled} onClick={()=>onChoose(t.id)} aria-label={`Choose ${t.name}`}>Use template</button></div></div>
 </article>)}</div>
 <p className="ts-help">Interior pages are original sample designs, not pages from the referenced books. Your source text and artwork replace the examples.</p>
 <dialog ref={dialog} className="ts-sample-dialog" onCancel={()=>setOpened(undefined)} onClose={()=>setOpened(undefined)}>
 {opened&&<><div className="ts-sample-toolbar"><div><strong>{opened.name}</strong><span>Cover + 2 interior pages</span></div><div className="ts-actions"><button disabled={disabled} onClick={()=>{onChoose(opened.id);setOpened(undefined);}}>Use template</button><button autoFocus onClick={()=>setOpened(undefined)} aria-label="Close template preview">Close</button></div></div><TemplateLayoutSamples key={opened.id} id={opened.id}/></>}
 </dialog>
 </section>
}
