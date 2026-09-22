import type { Region } from './template-layouts.ts';
/** Percent coordinates remain portable across preview, print and differently sized screens. */
export function parseTextPositions(value:unknown,count:number):Region[]|undefined {
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length!==count)throw Error('Text positions must match the spread’s text boxes.');
 return value.map(v=>{
  if(!v||typeof v!=='object'||!['x','y','w','h'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])))throw Error('Invalid text position.');
  const {x,y,w,h}=v;
  if(x<0||y<0||w<1||h<1||x+w>100.001||y+h>100.001)throw Error('Text boxes must stay within the page.');
  return {x,y,w,h};
 });
}
export function moveTextBox(box:Region,dx:number,dy:number,resize=false):Region {
 const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
 return resize?{...box,w:clamp(box.w+dx,1,100-box.x),h:clamp(box.h+dy,1,100-box.y)}:{...box,x:clamp(box.x+dx,0,100-box.w),y:clamp(box.y+dy,0,100-box.h)};
}
/** Measure in unscaled layout pixels, so browser zoom does not alter the saved result. */
export function fitTextPositions(spread:HTMLElement,boxes:Region[]):Region[]{
 return boxes.map((box,i)=>{
  const el=spread.querySelector<HTMLElement>(`[data-text-region="${i+1}"]`);
  if(!el||!spread.clientHeight||!spread.clientWidth)return box;
  if(el.scrollHeight<=el.clientHeight+2&&el.scrollWidth<=el.clientWidth+2)return box;
  const w=Math.min(100,Math.max(box.w,(el.scrollWidth+2)/spread.clientWidth*100));
  const h=Math.min(100,Math.max(box.h,(el.scrollHeight+3)/spread.clientHeight*100));
  return {x:Math.min(box.x,100-w),y:Math.min(box.y,100-h),w,h};
 });
}
