import {renderTemplateBook,templateFont,type TemplateBook} from './template-book.ts';
import {bookArtworkFiles} from './book-completion.ts';
import {templatePrintSize} from './template-layouts.ts';
import {buildCanvaPresentation,type CanvaPage,type CanvaBox,type CanvaElement,type CanvaTextRun} from './canva-presentation.ts';
import {zipSync,strToU8} from 'fflate';
const color=(css:string,fallback='292723')=>{const m=css.match(/[\d.]+/g);return m&&m.length>=3&&!(m.length===4&&Number(m[3])===0)?m.slice(0,3).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join(''):fallback;};
const fontName=(book:TemplateBook)=>templateFont(book)==='book-hand.ttf'?'Patrick Hand':templateFont(book)==='book-sans.ttf'?'Noto Sans Devanagari':'Noto Serif Devanagari';
const blobData=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read an illustration.'));reader.readAsDataURL(blob);});
const shapeNames={cloud:'cloud',speech:'wedgeRoundRectCallout',rounded:'roundRect',parchment:'wave'} as const;
/** Read final, font-loaded DOM geometry, including manual positions and typography. */
export function captureCanvaPage(section:HTMLElement,book:TemplateBook,index:number):CanvaPage{
 const view=section.ownerDocument.defaultView!;
 const cs=(el:Element,pseudo?:string)=>view.getComputedStyle(el,pseudo);
 const bounds=section.getBoundingClientRect();
 const size=section.classList.contains('completion-page')?{width:210,height:210}:templatePrintSize(book.templateId,section.classList.contains('cover'),book.templateRevision||1);
 const width=size.width/25.4,height=size.height/25.4,sx=width/bounds.width,sy=height/bounds.height;
 const box=(el:Element):CanvaBox=>{const r=el.getBoundingClientRect();return {x:(r.left-bounds.left)*sx,y:(r.top-bounds.top)*sy,w:r.width*sx,h:r.height*sy};};
 const visible=(el:Element)=>cs(el).display!=='none'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
 const elements:CanvaElement[]=[];
 // Preserve illustration cropping without flattening any text into the picture.
 for(const image of section.querySelectorAll<HTMLImageElement>('img')){
  if(!visible(image))continue;
  const rect=image.getBoundingClientRect(),style=cs(image),fit=style.objectFit;
  const scale=fit==='cover'?Math.max(rect.width/image.naturalWidth,rect.height/image.naturalHeight):fit==='contain'?Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight):0;
  const iw=scale?image.naturalWidth*scale:rect.width,ih=scale?image.naturalHeight*scale:rect.height;
  const ix=rect.left+(rect.width-iw)/2,iy=rect.top+(rect.height-ih)/2;
  let left=Math.max(rect.left,ix,bounds.left),top=Math.max(rect.top,iy,bounds.top),right=Math.min(rect.right,ix+iw,bounds.right),bottom=Math.min(rect.bottom,iy+ih,bounds.bottom);
  for(let parent=image.parentElement;parent&&parent!==section;parent=parent.parentElement)if(['hidden','clip'].includes(cs(parent).overflow)){const r=parent.getBoundingClientRect();left=Math.max(left,r.left);top=Math.max(top,r.top);right=Math.min(right,r.right);bottom=Math.min(bottom,r.bottom);}
  if(right<=left||bottom<=top)continue;
  if(/^data:image\/(png|jpe?g);/i.test(image.src)&&Math.abs(left-ix)<.1&&Math.abs(top-iy)<.1&&Math.abs(right-left-iw)<.1&&Math.abs(bottom-top-ih)<.1){
   elements.push({kind:'image',data:image.src,name:image.alt||'Book illustration',x:(left-bounds.left)*sx,y:(top-bounds.top)*sy,w:(right-left)*sx,h:(bottom-top)*sy});continue;
  }
  const canvas=section.ownerDocument.createElement('canvas'),sw=(right-left)/iw*image.naturalWidth,sh=(bottom-top)/ih*image.naturalHeight;
  canvas.width=Math.max(1,Math.ceil(sw));canvas.height=Math.max(1,Math.ceil(sh));
  const context=canvas.getContext('2d');if(!context)throw Error('Image export is unavailable.');
  context.drawImage(image,(left-ix)/iw*image.naturalWidth,(top-iy)/ih*image.naturalHeight,sw,sh,0,0,canvas.width,canvas.height);
  elements.push({kind:'image',data:canvas.toDataURL('image/png'),name:image.alt||'Book illustration',x:(left-bounds.left)*sx,y:(top-bounds.top)*sy,w:(right-left)*sx,h:(bottom-top)*sy});canvas.width=0;canvas.height=0;
 }
 // Notebook rules and publishing areas are native shapes, not pixels.
 for(const el of section.querySelectorAll<HTMLElement>('.note-rules i,.barcode-space,.completion-imprint,.planned-panel:not(.text-background)')){
  if(!visible(el))continue;
  const b=box(el),style=cs(el);elements.push({kind:'shape',shape:'rect',...b,h:Math.max(b.h,.005),color:color(el.matches('.note-rules i')?style.borderTopColor:style.backgroundColor,'FFFFFF')});
 }
 const textSelector='.planned-text,.story-text,.copy h2,.copy .original,.copy .meaning,.notes-title span,.notes-title h2,.cover h1,.cover>p,.cover>small,.completion-copy>*,.completion-author,.completion-imprint span,.completion-imprint p,.folio';
 for(const el of section.querySelectorAll<HTMLElement>(textSelector)){
  if(!visible(el)||!el.textContent?.trim())continue;
  const style=cs(el),b=box(el),padding={left:parseFloat(style.paddingLeft)||0,top:parseFloat(style.paddingTop)||0,right:parseFloat(style.paddingRight)||0,bottom:parseFloat(style.paddingBottom)||0};
  const role=el.classList.contains('meaning')?'meaning':'original',page=book.pages[index];
  const background=el.classList.contains('text-background')?page?.textBackgrounds?.[role]:undefined;
  if(background&&background.shape!=='none')elements.push({kind:'shape',shape:shapeNames[background.shape],...b,x:b.x+b.w*(background.offsetX??0)/100,y:b.y+b.h*(background.offsetY??0)/100,w:b.w*(background.width??100)/100,h:b.h*(background.height??100)/100,color:background.color.slice(1),lineColor:'88775F'});
  b.x+=padding.left*sx;b.y+=padding.top*sy;b.w-=(padding.left+padding.right)*sx;b.h-=(padding.top+padding.bottom)*sy;
  const align=['left','center','right','justify'].includes(style.textAlign)?style.textAlign as 'left'|'center'|'right'|'justify':'left';
  const fontFace=style.fontFamily.includes('Book')?fontName(book):style.fontFamily.split(',')[0].replace(/["']/g,'');
  const label=cs(el,'::before'),labelText=label.content.replace(/^["']|["']$/g,'');
  if(el.classList.contains('reading-label')&&label.display!=='none'&&labelText&&labelText!=='none'){
   const labelHeight=(parseFloat(label.lineHeight)||parseFloat(label.fontSize)*1.4)*sy;
   elements.push({kind:'text',...b,h:labelHeight,fontFace,align,lineSpacingMultiple:1,runs:[{text:labelText,fontSize:parseFloat(label.fontSize)*sx*72,bold:false,italic:false,underline:false,color:color(label.color)}],name:'Reading label'});
   const offset=labelHeight+(parseFloat(label.marginBottom)||0)*sy;b.y+=offset;b.h-=offset;
  }
  const runs:CanvaTextRun[]=[];
  const walk=(node:Node)=>{
   if(node.nodeType===3){if(!node.textContent)return;const s=cs(node.parentElement!);runs.push({text:node.textContent,fontSize:parseFloat(s.fontSize)*sx*72,bold:Number(s.fontWeight)>=600,italic:s.fontStyle==='italic',underline:s.textDecorationLine.includes('underline'),color:color(s.color),...(node.parentElement?.tagName==='MARK'?{highlight:color(s.backgroundColor,'FFF37A')}:{})});}
   else if(node.nodeType===1){const element=node as HTMLElement;if(!visible(element))return;if(element.tagName==='BR'){if(runs.length)runs.push({...runs[runs.length-1],text:'\n'});return;}for(const child of node.childNodes)walk(child);if(node!==el&&['block','inline-block'].includes(cs(element).display)&&element.matches('.note-heading')){if(runs.length)runs.push({...runs[runs.length-1],text:'\n'});}}
  };walk(el);
  if(runs.length)elements.push({kind:'text',...b,h:Math.max(.05,b.h),fontFace,align,lineSpacingMultiple:(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.4)/parseFloat(style.fontSize),runs,name:el.classList.contains('planned-text')?`${role} passage`:'Book text'});
 }
 return {width,height,background:color(cs(section).backgroundColor,'FFFDF4'),name:section.getAttribute('aria-label')||`Spread ${index+1}`,elements};
}
export async function exportCanvaBook(book:TemplateBook,images:Record<string,Blob>):Promise<Uint8Array>{
 const missing=bookArtworkFiles(book).filter(name=>!images[name]);if(missing.length)throw Error('Add the missing illustrations before Canva export: '+missing.join(', '));
 const urls:Record<string,string>={};for(const name of bookArtworkFiles(book))urls[name]=await blobData(images[name]);
 const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-25000px;width:2000px;height:1000px;visibility:hidden;border:0';document.body.append(frame);
 try{
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Canva export preview took too long to load.')),30000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=renderTemplateBook(book,urls,'/fonts/'+templateFont(book)).replace('</style>','.spread{zoom:1!important}</style>');});
  const doc=frame.contentDocument;if(!doc)throw Error('Could not prepare the book for export.');await doc.fonts.ready;await Promise.all(Array.from(doc.images).map(image=>image.decode()));
  const groups=new Map<string,CanvaPage[]>(),order:string[]=[];let index=0;
  for(const section of doc.querySelectorAll<HTMLElement>('.spread')){
   const cover=section.classList.contains('cover');const page=captureCanvaPage(section,book,cover?-1:index++),key=`${Math.round(page.width*25.4)}x${Math.round(page.height*25.4)}mm`;
   order.push(`Book-${key}.pptx — slide ${(groups.get(key)?.length||0)+1}: ${page.name}`);
   groups.set(key,[...(groups.get(key)||[]),page]);
  }
  const entries:Record<string,Uint8Array>={};
  for(const [size,pages] of groups)entries[`Book-${size}.pptx`]=await buildCanvaPresentation(pages,book.title);
  entries['START-HERE.txt']=strToU8(`CANVA EDITABLE BOOK\n\n1. Extract this ZIP.\n2. In Canva, upload each .pptx file to import it as an editable design.\n3. Review every page for fonts, line wrapping and shapes after import.\n\nFiles are grouped by physical size: square covers/title pages and wide interior spreads are separate designs. Pages remain in book order within each size group.\n\nFULL BOOK ORDER\n${order.join('\n')}\n\nEditable: source passages, meanings, reading labels, titles, credits, ISBN/MRP text, supported backgrounds and individual illustration images. Cloud/bubble/parchment shapes use the nearest PowerPoint shape and may look different in Canva. Illustration images remain flattened paintings: characters and objects inside them cannot be edited separately. Complex template decoration may differ. Canva may substitute fonts; choose the matching font when available.\n\nFonts used: ${fontName(book)}. Keep the original editable Book Studio ZIP as your backup. Canva edits do not sync back to Book Studio. This export is a working design, not a print-ready proof.\n`);
  return zipSync(entries,{level:0});
 }finally{frame.remove();}
}
