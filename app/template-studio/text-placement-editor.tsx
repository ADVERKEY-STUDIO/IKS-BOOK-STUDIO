'use client';
import {useRef,useState} from 'react';
import type {TemplateBook} from '../../lib/template-book';
import {blueprintFor,plannedTextBlocks,type Region} from '../../lib/template-layouts';
import {moveTextBox,fitTextPositions} from '../../lib/text-placement';
import {BookSpreadPreview} from './layout-review';
export default function TextPlacementEditor({book,index,images,onChange,onLoad}:{book:TemplateBook;index:number;images:Record<string,Blob>;onChange:(positions:Region[]|undefined)=>void;onLoad:(doc:Document)=>void}){
 const [editing,setEditing]=useState(false),[selected,setSelected]=useState(0),[moving,setMoving]=useState<Region[]|null>(null);
 const documentRef=useRef<Document|null>(null);
 const surface=useRef<HTMLDivElement>(null);
 const drag=useRef<{index:number;x:number;y:number;boxes:Region[];resize:boolean}|null>(null);
 const page=book.pages[index];
 if(!book.templateRevision)return <BookSpreadPreview book={book} index={index} images={images} onLoad={onLoad}/>;
 const blocks=plannedTextBlocks(page,blueprintFor(book,page));
 const boxes=moving||blocks.map(({x,y,w,h})=>({x,y,w,h}));
 const commit=(next:Region[])=>{setMoving(null);onChange(next);};
 return <div className="text-placement-editor">
 <div className="ts-actions"><button type="button" aria-pressed={editing} onClick={()=>setEditing(!editing)}>{editing?'Done placing text':'Move text'}</button>{editing&&<button type="button" disabled={!page.textPositions} onClick={()=>{setMoving(null);onChange(undefined);}}>Reset text positions</button>}<button type="button" onClick={()=>{const spread=documentRef.current?.querySelector<HTMLElement>(".planned-spread");if(spread)commit(fitTextPositions(spread,boxes));}}>Fit text boxes</button></div>
 {editing&&<p>Select a text box and drag it anywhere on the spread. Drag its corner to resize. Arrow keys move it; Shift moves farther. Changes save automatically.</p>}
 <div ref={surface} style={{position:'relative',lineHeight:0}}>
 <BookSpreadPreview book={moving?{...book,pages:book.pages.map((p,j)=>j===index?{...p,textPositions:moving}:p)}:book} index={index} images={images} onLoad={doc=>{documentRef.current=doc;onLoad(doc);}}/>
 {editing&&<div style={{position:'absolute',inset:0}}>{blocks.map((block,i)=>{const box=boxes[i];return <div key={i} role="button" tabIndex={0} aria-label={`Move ${block.role} text box ${i+1}`} aria-pressed={selected===i}
 style={{position:'absolute',left:box.x+'%',top:box.y+'%',width:box.w+'%',height:box.h+'%',outline:selected===i?'2px solid #b65f32':'1px dashed #234139',background:'transparent',cursor:'move',touchAction:'none',lineHeight:1.4,color:'#233e36',fontSize:'clamp(9px,1vw,16px)',whiteSpace:'pre-wrap',userSelect:'none'}}
 onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();setSelected(i);drag.current={index:i,x:e.clientX,y:e.clientY,boxes:boxes.map(b=>({...b})),resize:(e.target as HTMLElement).dataset.resize==='true'};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current,r=surface.current?.getBoundingClientRect();if(!d||!r)return;const next=d.boxes.map((b,j)=>j===d.index?moveTextBox(b,(e.clientX-d.x)/r.width*100,(e.clientY-d.y)/r.height*100,d.resize):b);setMoving(next);}}
 onPointerUp={e=>{const d=drag.current,r=surface.current?.getBoundingClientRect();if(!d||!r)return;drag.current=null;commit(d.boxes.map((b,j)=>j===d.index?moveTextBox(b,(e.clientX-d.x)/r.width*100,(e.clientY-d.y)/r.height*100,d.resize):b));}}
 onPointerCancel={()=>{drag.current=null;setMoving(null);}}
 onKeyDown={e=>{const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!directions[e.key])return;e.preventDefault();setSelected(i);const [x,y]=directions[e.key],step=e.shiftKey?2:.25;commit(boxes.map((b,j)=>j===i?moveTextBox(b,x*step,y*step):b));}}>

 <span data-resize="true" aria-hidden="true" style={{position:'absolute',right:-6,bottom:-6,width:14,height:14,background:'#b65f32',border:'2px solid white',cursor:'nwse-resize'}}/>
 </div>;})}</div>}
 </div>
 </div>;
}
