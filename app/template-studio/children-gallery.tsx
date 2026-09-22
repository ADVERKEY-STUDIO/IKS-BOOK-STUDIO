'use client';
import TemplateLayoutSamples from './template-layout-samples';
import {useEffect,useRef,useState} from 'react';
import {childrenTemplates} from '../../lib/children-templates';
import type {TemplateId} from '../../lib/template-book';
export default function ChildrenGallery({onChoose,disabled}:{onChoose:(id:TemplateId)=>void;disabled:boolean}){
 const [opened,setOpened]=useState<typeof childrenTemplates[number]>();
 const [page,setPage]=useState(0);
 const [showLayout,setShowLayout]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(opened){dialog.current?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};}dialog.current?.close();},[opened]);
 return <section className="ts-literary children-gallery" aria-labelledby="children-templates">
 <p className="children-eyebrow">FROM ORIGINAL CHILDREN’S BOOKS</p><h2 id="children-templates">Children’s books, full of character.</h2><p className="ts-literary-intro">Explore the original books. Choose their visual direction for your own story.</p>
 <div className="ts-literary-grid">{childrenTemplates.map(t=><article key={t.id}>
 <button className="children-reference" onClick={()=>{setPage(0);setShowLayout(false);setOpened(t);}} aria-label={`Look inside ${t.reference}`}><img src={t.demo} alt={`${t.reference} — original book reference`} loading="lazy"/><span>{'previewLabel' in t ? t.previewLabel : `${t.images.length} previews`} · View original book ↗</span></button>
 <div className="ts-literary-info"><small>{t.creator}</small><h3>{t.reference}</h3><p>{t.description}</p><div className="ts-literary-actions"><button onClick={()=>{setPage(0);setShowLayout(true);setOpened(t);}}>App layout samples</button><button disabled={disabled} onClick={()=>onChoose(t.id)}>Use template</button></div></div>
 </article>)}</div>
 <p className="ts-help">Original book previews are credited to their creators. Templates apply the layout and palette to your source; reference artwork is not imported into your book.</p>
 <dialog ref={dialog} className="ts-sample-dialog" onCancel={()=>setOpened(undefined)} onClose={()=>setOpened(undefined)}>{opened&&<>
 <div className="ts-sample-toolbar"><div><strong>{opened.reference}</strong><span>{opened.creator}</span></div><button autoFocus onClick={()=>setOpened(undefined)}>Close</button></div>
 <div className="children-preview-actions"><button onClick={()=>setShowLayout(false)} aria-pressed={!showLayout}>Original book reference</button><button onClick={()=>setShowLayout(true)} aria-pressed={showLayout}>App layout samples</button></div>
 {showLayout ? <TemplateLayoutSamples key={opened.id} id={opened.id}/> : <><div className="children-preview"><img src={opened.images[page]} alt={`${opened.reference} original preview ${page+1}`}/></div>
 <div className="children-preview-actions"><button disabled={page===0} onClick={()=>setPage(page-1)}>← Previous</button><span>{page+1} / {opened.images.length}</span><button disabled={page===opened.images.length-1} onClick={()=>setPage(page+1)}>Next →</button></div></>}
 <div className="children-preview-footer"><div><a href={opened.source} target="_blank" rel="noreferrer">Original book & creator ↗</a>{'pin' in opened && <> · <a href={opened.pin} target="_blank" rel="noreferrer">Pinterest ↗</a></>} · <a href={opened.images[page]} target="_blank" rel="noreferrer">View full-size spread ↗</a><p>{opened.name} · {opened.description}</p></div><button disabled={disabled} onClick={()=>{onChoose(opened.id);setOpened(undefined);}}>Use template</button></div>
 </>}</dialog>
 <style>{`.children-gallery{scroll-margin-top:30px}.ts-template-layout-samples{padding:20px;overflow:auto;flex:1}.ts-template-layout-samples p{font-size:13px}.ts-template-layout-samples label{display:block}.ts-template-layout-samples select{padding:10px;margin:10px;max-width:90%}.children-eyebrow{font:11px Arial,sans-serif;letter-spacing:.16em;color:#8e5033;margin-top:35px}.children-reference{display:block!important;width:100%;border:0!important;border-radius:0!important;padding:24px!important;background:#eeeade!important;cursor:pointer;color:#234139!important;text-align:left!important}.children-reference img{display:block;width:100%;height:280px;object-fit:contain}.children-reference span{display:block;font-size:11px;margin-top:18px}.children-preview{background:#f1eee6;padding:24px;text-align:center}.children-preview img{max-width:100%;height:55vh;object-fit:contain}.children-preview-actions{display:flex;justify-content:center;gap:24px;align-items:center;padding:15px}.children-preview-footer{padding:20px 28px;display:flex;align-items:center;gap:24px;justify-content:space-between;border-top:1px solid #ddd}.children-preview-footer p{max-width:650px;font-size:13px}.children-preview-footer a{font-size:13px}.children-preview-footer>button{flex-shrink:0;background:#234139;color:white}@media(max-width:650px){.children-preview-footer{display:block}.children-reference img{height:240px}.children-preview img{height:40vh}}`}</style>
 </section>
}
