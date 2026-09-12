'use client';
import { useState } from 'react';
import type { Edition } from '../../lib/devotional-edition';
import { bookDocument, bookExportIssues, bookPageSequence, type ExportMode } from '../../lib/book-export';
import { compositionFormat } from '../../lib/spread-composition';
import { PROOF_FONT_SHA256 } from '../../lib/font-coverage';
import { digest } from '../../lib/book-backup';
const dataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob);});
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
type Props={edition:Edition;onSnapshot:(final:boolean)=>Promise<Edition>;onBackup:()=>Promise<Blob>;onRestore:(file:File)=>Promise<void>;onImage:(key:string)=>Promise<Blob>;onReview:()=>void};
export function BookReleaseWorkspace({edition:e,onSnapshot,onBackup,onRestore,onImage,onReview}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[mode,setMode]=useState<ExportMode>('print');
 const blockers=bookExportIssues(e,true),proofBlockers=bookExportIssues(e),f=compositionFormat(e,e.compositions?.find(c=>c.planId===e.storyboard?.find(p=>p.kind!=='cover')?.id));
 async function run(work:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await work();}catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
 async function exportBook(final:boolean,print:boolean){await run(async()=>{
  const snapshot=await onSnapshot(final),fontResponse=await fetch('/fonts/book-sanskrit.ttf');if(!fontResponse.ok)throw new Error('Proof font unavailable.');
  const font=await fontResponse.blob();if(await digest(new Uint8Array(await font.arrayBuffer()))!==PROOF_FONT_SHA256)throw new Error('Proof font changed. Update the font review before export.');
  const keys=[...new Set((snapshot.compositions||[]).filter(c=>snapshot.storyboard?.some(p=>p.id===c.planId&&p.kind!=='cover')).flatMap(c=>c.layers.filter(l=>l.kind==='image'&&!l.hidden).map(l=>l.imageKey)))];
  const assets:Record<string,string>={};for(const key of keys)assets[key]=await dataUrl(await onImage(key));
  const html=bookDocument(snapshot,assets,await dataUrl(font),mode,final),name=`book-r${snapshot.revision}-${mode}-${final?'release':'working-proof'}`;
  if(!print){download(new Blob([html],{type:'text/html'}),name+'.html');setMessage(`Saved self-contained ${mode} HTML for revision ${snapshot.revision}.`);return;}
  document.querySelectorAll('iframe[title="Whole book print"]').forEach(el=>el.remove());
  const frame=document.createElement('iframe');frame.title='Whole book print';frame.style.cssText='position:fixed;bottom:0;width:1px;height:1px;border:0';document.body.appendChild(frame);
  try{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Print document loading timed out.')),60000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=html;});await frame.contentDocument!.fonts.ready;await Promise.all(Array.from(frame.contentDocument!.images).map(img=>img.decode()));frame.contentWindow!.focus();frame.contentWindow!.print();setMessage(`Opened revision ${snapshot.revision} in the print dialog. Choose Save as PDF. Inspect the saved PDF before recording approval.`);}finally{setTimeout(()=>frame.remove(),120000);}
 });}
 return <section className="edition-panel"><h1>Export and restore</h1><p>Revision {e.revision} · {bookPageSequence(e).length} interior pages. Each download uses one saved snapshot.</p>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <label>Output format<select disabled={busy} value={mode} onChange={event=>setMode(event.target.value as ExportMode)}><option value="print">Print interiors · single pages with bleed</option><option value="digital">Digital reading · single pages without bleed</option></select></label>
 <p>PDF paper: {f.width+(mode==='print'?2*f.bleed:0)} × {f.height+(mode==='print'?2*f.bleed:0)} mm. Use 100% scale, zero margins, backgrounds enabled, and headers/footers disabled. Text remains text through the browser print renderer. Verify the saved PDF’s dimensions and fonts; this is not PDF/X certification.</p>
 <div className="edition-actions"><button disabled={busy||!!proofBlockers.length} onClick={()=>void exportBook(false,true)}>Working PDF proof</button><button disabled={busy||!!proofBlockers.length} onClick={()=>void exportBook(false,false)}>Download working HTML</button><button disabled={busy||!!blockers.length} onClick={()=>void exportBook(true,true)}>Final release PDF</button><button onClick={onReview} disabled={busy}>Open Review desk</button></div>
 <p>{blockers.length?`${blockers.length} release requirements remain. Working proofs do not approve the book.`:'Current review records allow final release.'}</p>
 {!!proofBlockers.length&&<details><summary>Working proof requirements</summary><ul>{proofBlockers.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
 <p>Verified PDF path: Zen’s Save to PDF, at 100% scale with backgrounds enabled and headers/footers off. Safari can insert extra blank pages with custom paper sizes; use the downloaded HTML in Zen if your print preview does not show the expected page count.</p>
 <p>Covers are excluded from interiors. Export individual covers in Designer; a printer wrap with spine is not generated here.</p>
 <h2>Project backup</h2><p>Includes edition text and history, compositions, reference and artwork versions, and registered source files. Inspiration previews are excluded. Up to 40 MB of assets. Only package artwork you have permission to retain.</p>
 <button disabled={busy} onClick={()=>void run(async()=>{download(await onBackup(),`edition-r${e.revision}-backup.zip`);setMessage('Backup downloaded. Keep the ZIP unchanged for restoration.');})}>Download project backup</button>
 <h2>Restore a backup as a new book</h2><p>Use an unmodified backup from this installation and browser identity. Existing books stay intact. The server’s backup receipts must be retained in infrastructure backups; this is not a portable migration to another installation. Restored review evidence requires rechecking.</p>
 <label>Backup ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void run(()=>onRestore(file));}}/></label>
 </section>;
}
