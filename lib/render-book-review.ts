import type { Edition } from './devotional-edition';
import type { RenderResult } from './book-review';
import { compositionDocument, compositionMarkup, layerText } from './spread-composition';
import { fontCoverage, missingGlyphs, PROOF_FONT_SHA256 } from './font-coverage';

/** Browser evidence only: does not certify complex-script shaping or a printer's PDF output. */
export async function renderBookReview(e:Edition,onImage:(key:string)=>Promise<Blob>,progress:(n:number,total:number)=>void):Promise<RenderResult[]> {
 const compositions=(e.compositions||[]).filter(c=>e.storyboard?.some(p=>p.id===c.planId));
 const results:RenderResult[]=[];let face:FontFace|undefined,supports:((cp:number)=>boolean)|undefined,fontError='';
 const holder=document.createElement('div');holder.setAttribute('aria-hidden','true');holder.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none;';document.body.appendChild(holder);
 try{
  try{const response=await fetch('/fonts/book-sanskrit.ttf');if(!response.ok)throw new Error('Bundled proof font could not be loaded.');const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==PROOF_FONT_SHA256)throw new Error('Proof font changed; update font review identity before certifying coverage.');supports=fontCoverage(bytes);face=new FontFace('BookProof',bytes);await face.load();document.fonts.add(face);}catch(error){fontError=error instanceof Error?error.message:'Font unavailable.';}
  for(const [index,c] of compositions.entries()){
   const result:RenderResult={planId:c.planId,problems:[]},assets:Record<string,string>={},urls:string[]=[];
   try{
    if(fontError)result.problems.push({code:'font',message:fontError});
    for(const layer of c.layers.filter(l=>!l.hidden&&l.kind==='image')){
     try{
      if(!assets[layer.imageKey]){const blob=await onImage(layer.imageKey);const url=URL.createObjectURL(blob);urls.push(url);const image=new Image();image.src=url;await image.decode();if(!image.naturalWidth)throw new Error('Empty image');assets[layer.imageKey]=url;}
     }catch{result.problems.push({code:'image',layerId:layer.id,message:`${layer.id}: image could not be retrieved or decoded.`});}
    }
    holder.innerHTML=compositionMarkup(e,c,assets);
    if(face?.status==='loaded')await document.fonts.ready;
    for(const el of holder.querySelectorAll<HTMLElement>('[data-text]'))if(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)result.problems.push({code:'overflow',layerId:el.dataset.text,message:`${el.dataset.text}: text overflows its region in the physical renderer.`});
    if(supports)for(const layer of c.layers.filter(l=>!l.hidden&&l.kind==='text')){
     const missing=missingGlyphs(layerText(e,layer),supports);if(missing.length)result.problems.push({code:'glyph',layerId:layer.id,message:`${layer.id}: proof font lacks ${missing.slice(0,8).map(char=>`U+${char.codePointAt(0)!.toString(16).toUpperCase()} (${char})`).join(', ')}${missing.length>8?' and more':''}.`});
    }
    const proof=new DOMParser().parseFromString(compositionDocument(e,c,assets,'/fonts/book-sanskrit.ttf'),'text/html');
    if(proof.querySelector('.spread-sheet')?.outerHTML!==holder.querySelector('.spread-sheet')?.outerHTML)result.problems.push({code:'parity',message:'Preview and exported proof markup differ.'});
   }finally{holder.innerHTML='';urls.forEach(url=>URL.revokeObjectURL(url));}
   results.push(result);progress(index+1,compositions.length);
  }
  return results;
 }finally{holder.remove();if(face)document.fonts.delete(face);}
}
