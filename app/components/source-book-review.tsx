"use client";
import {useEffect,useState} from 'react';
import {compareSourceVerse,sourceImageSignature,sourceVerseSignature,type SourceReviewProject} from '../../lib/source-book-review';

type Props={project:SourceReviewProject;onClose:()=>void;onImage:(id:string,variant:'original'|'cleaned')=>Promise<void>;onVerse:(id:string,text:string,file:string,method:'pdf-text'|'manual')=>Promise<void>};
export function SourceBookReviewPanel({project,onClose,onImage,onVerse}:Props){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [pdfUrl,setPdfUrl]=useState(''),[sourceFile,setSourceFile]=useState('');
  const [pageTexts,setPageTexts]=useState<string[]>([]),[sourcePage,setSourcePage]=useState(1);
  const [manual,setManual]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState<Record<string,boolean>>({});
  useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await action();setMessage('Review saved.');}catch(error){setMessage(error instanceof Error?error.message:'Review could not be saved.');}finally{setBusy(false);}};
  const choosePdf=async(file:File)=>{
    setBusy(true);setMessage('');setPageTexts([]);setManual({});setConfirmed({});setSourceFile(file.name);setPdfUrl(URL.createObjectURL(file));
    try{const {extractText}=await import('unpdf');const result=await extractText(new Uint8Array(await file.arrayBuffer()),{mergePages:false});setPageTexts(result.text);setMessage(result.text.some(t=>t.trim())?'Source PDF loaded locally. Compare each verse on its cited page.':'This PDF has no extractable text. Read the displayed source and enter the verse manually for comparison.');}
    catch{setMessage('Automatic text extraction is unavailable. Read the displayed PDF and enter the source verse manually.');}finally{setBusy(false);}
  };
  const assets=project.sourceAssets??[];
  return <div className="modal-backdrop source-review-backdrop"><section className="source-review-panel" role="dialog" aria-modal="true" aria-labelledby="source-review-title">
    <header><div><p className="eyebrow">SOURCE FIDELITY & CONTEXT</p><h2 id="source-review-title">Review source images and Sanskrit</h2></div><button onClick={onClose} disabled={busy} aria-label="Close source review">Close</button></header>
    <p>Approvals record your source check. Changed files or verse details need review again. Downloads remain available.</p>
    {message && <p role="status">{message}</p>}
    <div className="source-review-images">{project.sourceManifest?.sourceImages.map(image=>{
      const original=assets.find(a=>a.path===image.originalPath),cleaned=assets.find(a=>a.path===image.cleanedPath);
      const approval=project.sourceReview?.images[image.id];const current=approval?.signature===sourceImageSignature(image,assets);
      return <article key={image.id} aria-label={`Review image ${image.id}`}><h3>{image.id} · source page {image.sourcePage}</h3><p>{image.caption}</p>
        {image.status==='unavailable'?<p>Extraction unavailable: {image.reason}</p>:<>
          <div className="source-image-comparison"><SourceImagePreview label="Original" url={original?.url}/><SourceImagePreview label="Cleaned / style-adapted" url={cleaned?.url}/></div>
          <p>{current?`Approved: ${approval.variant}.`:'Source and placement review pending.'}</p>
          {image.placements.length?<ul>{image.placements.map(p=><li key={p.id}><b>Section {p.sectionNumber}</b><blockquote>{p.anchorText}</blockquote><p>Why it belongs here: {p.reason}</p></li>)}</ul>:<p>Kept in the source-image folder; not placed in the book.</p>}
          <label><input type="checkbox" checked={Boolean(confirmed[image.id])} onChange={e=>setConfirmed(c=>({...c,[image.id]:e.target.checked}))}/>I checked the source details, labels and relevance to the surrounding text.</label>
          <div className="source-review-actions"><button disabled={busy||!original||!confirmed[image.id]} onClick={()=>void run(()=>onImage(image.id,'original'))}>Use original</button><button disabled={busy||!cleaned||!confirmed[image.id]} onClick={()=>void run(()=>onImage(image.id,'cleaned'))}>Approve cleaned image</button></div>
          <small>Choosing either version updates every placement and preserves its existing image frame. Final-size resolution and overflow checks are shown in Preview.</small>
        </>}
      </article>;
    })}</div>
    {Boolean(project.sourceManifest?.verses.length)&&<section className="source-verse-review"><h3>Compare Sanskrit with the source PDF</h3><label>Choose source PDF for local comparison<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void choosePdf(file);}}/></label><p>This selection stays in your browser and does not replace or re-upload the book.</p>
      {pdfUrl&&<iframe key={`${pdfUrl}-${sourcePage}`} src={`${pdfUrl}#page=${sourcePage}`} title={`Source PDF page ${sourcePage}`}/>}
      {project.sourceManifest?.verses.map(verse=>{
        const sourceText=manual[verse.id]??pageTexts[verse.sourcePage-1]??'';const matches=compareSourceVerse(verse.sanskrit,sourceText);
        const review=project.sourceReview?.verses[verse.id];const approved=review?.signature===sourceVerseSignature(verse);
        return <article key={verse.id} aria-label={`Review verse ${verse.id}`}><h4>{verse.reference} · source page {verse.sourcePage}</h4><p className="sanskrit-verse" lang="sa">{verse.sanskrit}</p>
          {verse.transliteration&&<p>Transliteration: {verse.transliteration}</p>}{verse.translation&&<p>Translation: {verse.translation}</p>}{verse.explanation&&<p>Explanation: {verse.explanation}</p>}
          {verse.reviewNote&&<p>Import note: {verse.reviewNote}</p>}
          <button disabled={!pdfUrl} onClick={()=>setSourcePage(verse.sourcePage)}>Show source page {verse.sourcePage}</button>
          <label>Source text for {verse.id}<textarea value={sourceText} rows={4} onChange={e=>{setManual(m=>({...m,[verse.id]:e.target.value}));setConfirmed(c=>({...c,[verse.id]:false}));}}/></label>
          <p>{approved?'Source review saved.':matches?'Sanskrit matches the supplied source text.':'No matching source text yet. Check the cited page; do not guess missing words.'}</p>
          <label><input type="checkbox" checked={Boolean(confirmed[verse.id])} onChange={e=>setConfirmed(c=>({...c,[verse.id]:e.target.checked}))}/>I checked the source page, attribution, line breaks and companion text.</label>
          <button disabled={busy||!matches||!confirmed[verse.id]} onClick={()=>void run(()=>onVerse(verse.id,sourceText,sourceFile||'Manually supplied source text',manual[verse.id]===undefined?'pdf-text':'manual'))}>Approve source verse</button>
        </article>;
      })}
    </section>}
  </section></div>;
}
function SourceImagePreview({label,url}:{label:string;url?:string}){
  const [size,setSize]=useState<{width:number;height:number}|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{setSize(null);setFailed(false);},[url]);
  return <figure><figcaption>{label}</figcaption>{url?<img src={url} alt={`${label} source artwork`} onLoad={e=>setSize({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} onError={()=>setFailed(true)}/>:<p>No file supplied.</p>}{failed&&<p>Image could not load. Do not approve until it is available.</p>}{size&&<p>{size.width} × {size.height} px{Math.min(size.width,size.height)<600?' · Low resolution: inspect at the intended print size.':''}</p>}</figure>;
}
