'use client';
import type {TemplateBook} from '../../lib/template-book';
import type {BookTypography} from '../../lib/book-typography';
export default function TypographyEditor({book,busy,onChange}:{book:TemplateBook;busy:boolean;onChange:(typography:BookTypography|undefined)=>void}){
 const current:BookTypography=book.typography??{font:'template',alignment:'template'};
 return <section className="ts-panel"><h3>Book typography</h3>
  <p>Choose the font for the whole book and the spacing and alignment of its passages. Changes save automatically and carry into previews and exports.</p>
  <fieldset disabled={busy} className="ts-fields"><legend>Text appearance</legend>
   <label>Book font<select value={current.font} onChange={e=>onChange({...current,font:e.target.value as BookTypography['font']})}>
    <option value="template">Template default</option><option value="serif">Classic serif — Noto Serif Devanagari</option><option value="sans">Clear sans serif — Noto Sans Devanagari</option>
   </select><span className="ts-help">Both Noto fonts support Hindi and English.</span></label>
   <label>Passage line spacing<select value={current.lineHeight??'template'} onChange={e=>onChange({...current,lineHeight:e.target.value==='template'?undefined:Number(e.target.value)})}>
    <option value="template">Template default</option>{[1.2,1.4,1.6,1.8,2].map(n=><option key={n} value={n}>{n} ×</option>)}
   </select></label>
   <label>Passage alignment<select value={current.alignment} onChange={e=>onChange({...current,alignment:e.target.value as BookTypography['alignment']})}>
    <option value="template">Template default</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option>
   </select></label>
   <label>Read first label<select value={current.showReadFirst===false?'hide':'show'} onChange={e=>onChange({...current,showReadFirst:e.target.value==='show'})}><option value="show">Show in book</option><option value="hide">Hide in book</option></select></label>
   <label>Meaning label<select value={current.showMeaning===false?'hide':'show'} onChange={e=>onChange({...current,showMeaning:e.target.value==='show'})}><option value="show">Show in book</option><option value="hide">Hide in book</option></select></label>
   <button type="button" style={{alignSelf:'start'}} onClick={()=>onChange(undefined)}>Reset typography to template</button>
  </fieldset>
  <p className="ts-help">Use the Text size control below for individual spreads. Changing typography can affect text fit; review the pages and use Auto-place text where available.</p>
 </section>;
}
