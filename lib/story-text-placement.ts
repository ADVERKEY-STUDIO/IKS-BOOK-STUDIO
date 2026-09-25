import type {BookPage,TemplateBook} from './template-book.ts';
import {renderTemplatePage} from './template-book.ts';
import {blueprintFor,plannedTextBlocks,type Region} from './template-layouts.ts';

/** Analyse a small, temporary raster. The original image and its saved bytes are never changed. */
function clearPaper(spread:HTMLElement,image:HTMLImageElement) {
 const canvas=spread.ownerDocument.createElement('canvas');canvas.width=300;canvas.height=150;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Image analysis is unavailable.');
 ctx.fillStyle='#fffdf4';ctx.fillRect(0,0,300,150);
 const scale=Math.min(300/image.naturalWidth,150/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
 ctx.drawImage(image,(300-w)/2,(150-h)/2,w,h);
 const pixels=ctx.getImageData(0,0,300,150).data,integral=new Uint32Array(301*151);
 for(let y=0;y<150;y++)for(let x=0;x<300;x++){
  const k=(y*300+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];
  const busy=Math.min(r,g,b)<160||(.2126*r+.7152*g+.0722*b)<218||Math.max(r,g,b)-Math.min(r,g,b)>95?1:0;
  const n=(y+1)*301+x+1;integral[n]=busy+integral[n-1]+integral[n-301]-integral[n-302];
 }
 return (r:Region)=>{
  // Include a quiet border around letters, not just the text box itself.
  const x=Math.max(0,Math.floor((r.x-.6)*3)),y=Math.max(0,Math.floor((r.y-1)*1.5));
  const right=Math.min(300,Math.ceil((r.x+r.w+.6)*3)),bottom=Math.min(150,Math.ceil((r.y+r.h+1)*1.5));
  return (integral[bottom*301+right]-integral[y*301+right]-integral[bottom*301+x]+integral[y*301+x])/((right-x)*(bottom-y));
 };
}
const overlaps=(a:Region,b:Region)=>a.x<b.x+b.w+1&&a.x+a.w+1>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;

/** Fit the whole passage first and its meaning second, at the reader's existing font size. */
export async function placeStoryText(spread:HTMLElement,page:BookPage,boxes:Region[]):Promise<Pick<BookPage,'readingOrder'|'textPositions'>|null>{
 const doc=spread.ownerDocument;await doc.fonts.ready;await doc.fonts.load('16px Book',page.original||page.meaning);
 const image=spread.querySelector<HTMLImageElement>('.planned-art');if(!image)return null;
 await image.decode();
 if(!spread.clientWidth||!spread.clientHeight)return null;
 const quiet=clearPaper(spread,image),original=spread.querySelector<HTMLElement>('.planned-text.original'),meaning=spread.querySelector<HTMLElement>('.planned-text.meaning');
 if(!original||!meaning)return null;
 const sourceProbe=original.cloneNode(false) as HTMLElement,meaningProbe=meaning.cloneNode(false) as HTMLElement;
 for(const probe of [sourceProbe,meaningProbe]){probe.classList.add('continuous-reading');probe.removeAttribute('data-text-region');probe.removeAttribute('contenteditable');probe.style.cssText+=';display:block;visibility:hidden;left:0;top:0;height:auto;';spread.append(probe);}
 sourceProbe.textContent=page.original;meaningProbe.textContent=page.meaning;
 const measure=(el:HTMLElement,width:number)=>{el.style.width=width+'%';return (el.scrollHeight+4)/spread.clientHeight*100;};
 type Candidate={source:Region;meaning:Region;score:number};
 let best:Candidate|undefined;
 try {
  // Search a shared column first: a single unambiguous top-to-bottom reading path.
  for(let width=24;width<=56;width+=2){
   const sh=page.original?measure(sourceProbe,width):0,mh=page.meaning?measure(meaningProbe,width):0,total=sh+mh+(sh&&mh?3:0);
   if(total>90)continue;
   for(let y=5;y+total<=95;y+=2)for(let x=4;x+width<=96;x+=2){
    const area={x,y,w:width,h:total};if(quiet(area)>0)continue;
    const score=total+Math.abs(width-36)*.6+y*.12;
    if(!best||score<best.score)best={source:{x,y,w:width,h:Math.max(1,sh)},meaning:{x,y:y+sh+(sh&&mh?3:0),w:width,h:Math.max(1,mh)},score};
   }
  }
  // Two quiet islands may be needed. Never split the source passage between them.
  if(!best){
   const candidates=(probe:HTMLElement,text:string)=>{
    const results:Region[]=[];
    if(!text)return results;
    for(let width=24;width<=52;width+=2){const h=measure(probe,width);if(h>90)continue;
     for(let y=5;y+h<=95;y+=2)for(let x=4;x+width<=96;x+=2){const r={x,y,w:width,h};if(quiet(r)===0)results.push(r);}
    }
    return results.sort((a,b)=>(a.h+Math.abs(a.w-36)*.6+a.y*.12)-(b.h+Math.abs(b.w-36)*.6+b.y*.12));
   };
   const sources=candidates(sourceProbe,page.original),meanings=candidates(meaningProbe,page.meaning);
   for(const source of sources){
    const meaning=meanings.find(m=>!overlaps(source,m));
    if(meaning){best={source,meaning,score:0};break;}
   }
  }
  if(!best)return null;
  return {readingOrder:'continuous',textPositions:boxes.map((box,i)=>i===0?best!.source:i===boxes.length-1?best!.meaning:box)};
 }finally{sourceProbe.remove();meaningProbe.remove();}
}

/** Run the same measured layout for imports and existing books; preserve manual placements on import. */
export async function autoPlaceStoryBook(book:TemplateBook,images:Record<string,Blob>,force=false):Promise<{book:TemplateBook;unplaced:number[]}>{
 if(book.templateId!=='beanstalk-adventure'||!book.templateRevision)return {book,unplaced:[]};
 const pages=[...book.pages],unplaced:number[]=[];
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-20000px;top:0;width:1200px;height:600px;border:0;visibility:hidden';
 frame.setAttribute('sandbox','allow-same-origin');document.body.append(frame);
 try{
  for(let i=0;i<pages.length;i++){
   const page=pages[i],blob=images[page.image];if(!blob||(!force&&page.textPositions))continue;
   const url=URL.createObjectURL(blob);
   try{
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Text preview took too long to load.')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=renderTemplatePage(book,i,{[page.image]:url});});
    const spread=frame.contentDocument?.querySelector<HTMLElement>('.planned-spread');
    const positions=spread?await placeStoryText(spread,page,plannedTextBlocks(page,blueprintFor(book,page)).map(({x,y,w,h})=>({x,y,w,h}))):null;
    if(positions)pages[i]={...page,...positions};else unplaced.push(i+1);
   }catch{unplaced.push(i+1);}finally{URL.revokeObjectURL(url);}
  }
 }finally{frame.remove();}
 return {book:{...book,pages},unplaced};
}
