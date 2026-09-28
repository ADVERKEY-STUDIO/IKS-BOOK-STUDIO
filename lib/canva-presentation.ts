import PptxGenJS from 'pptxgenjs';
export type CanvaBox={x:number;y:number;w:number;h:number}; // inches
export type CanvaTextRun={text:string;fontSize:number;bold:boolean;italic:boolean;underline:boolean;color:string;highlight?:string};
export type CanvaElement=
 | ({kind:'image';data:string;name:string}&CanvaBox)
 | ({kind:'shape';shape:'rect'|'roundRect'|'cloud'|'wedgeRoundRectCallout'|'wave';color:string;lineColor?:string}&CanvaBox)
 | ({kind:'text';runs:CanvaTextRun[];fontFace:string;align:'left'|'center'|'right'|'justify';lineSpacingMultiple:number;name:string}&CanvaBox);
export type CanvaPage={width:number;height:number;background:string;name:string;elements:CanvaElement[]};
/** Keep text, pictures and decorative shapes as separate native PowerPoint objects. */
export async function buildCanvaPresentation(pages:CanvaPage[],title:string):Promise<Uint8Array>{
 if(!pages.length)throw Error('There are no pages to export.');
 const {width,height}=pages[0];
 if(pages.some(p=>p.width!==width||p.height!==height))throw Error('Different page sizes must be exported as separate presentations.');
 const pptx=new PptxGenJS();pptx.defineLayout({name:'BOOK',width,height});pptx.layout='BOOK';pptx.title=title;pptx.subject='Editable book for Canva';
 for(const page of pages){
  const slide=pptx.addSlide();slide.background={color:page.background};slide.addNotes(page.name);
  for(const el of page.elements){
   const box={x:el.x,y:el.y,w:Math.max(.01,el.w),h:Math.max(.01,el.h)};
   if(el.kind==='image')slide.addImage({...box,data:el.data,altText:el.name});
   else if(el.kind==='shape')slide.addShape(pptx.ShapeType[el.shape],{...box,fill:{color:el.color},line:{color:el.lineColor??el.color,width:el.lineColor?0.5:0}});
   else slide.addText(el.runs.map(r=>({text:r.text,options:{fontSize:r.fontSize,bold:r.bold,italic:r.italic,underline:r.underline?{style:'sng'}:undefined,color:r.color,highlight:r.highlight}})),{...box,fontFace:el.fontFace,margin:0,paraSpaceAfter:0,paraSpaceBefore:0,lineSpacingMultiple:el.lineSpacingMultiple,align:el.align,valign:'top',breakLine:false,wrap:true,fit:'none',objectName:el.name});
  }
 }
 const output=await pptx.write({outputType:'uint8array',compression:true});
 return output as Uint8Array;
}
