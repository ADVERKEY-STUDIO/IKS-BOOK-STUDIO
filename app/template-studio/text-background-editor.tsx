'use client';
import {ToolPanel} from './editor-tools';
import {textBackgroundShapes,type TextBackgrounds,type TextBackground} from '../../lib/text-backgrounds';
const names={none:'None (show illustration)',cloud:'Cloud',speech:'Speech bubble',rounded:'Rounded panel',parchment:'Parchment'};
export default function TextBackgroundEditor({value,onChange,onApplyAll,onUndo}:{value:TextBackgrounds|undefined;onChange:(value:TextBackgrounds|undefined)=>void;onApplyAll?:(roles:('original'|'meaning')[])=>void;onUndo?:()=>void}){
 const update=(role:'original'|'meaning',patch:Partial<TextBackground>)=>onChange({...value,[role]:{shape:'none',color:'#fff8e8',...value?.[role],...patch}});
 return <ToolPanel title="Backgrounds" className="ts-page-controls">
  <p>Add a shape behind a passage to separate it from the illustration. Move and resize it together with the text using Move text.</p>
  <div className="ts-fields">{(['original','meaning'] as const).map(role=><fieldset key={role}><legend>{role==='original'?'Read first / original passage':'Meaning / explanation'}</legend>
   <label>Background shape<select aria-label={`${role} background shape`} value={value?.[role]?.shape??'none'} onChange={e=>update(role,{shape:e.target.value as TextBackground['shape']})}>{textBackgroundShapes.map(shape=><option key={shape} value={shape}>{names[shape]}</option>)}</select></label>
   <label>Background colour<input aria-label={`${role} background colour`} type="color" style={{height:44,padding:6}} value={value?.[role]?.color??'#fff8e8'} disabled={!value?.[role]||value[role]?.shape==='none'} onChange={e=>update(role,{color:e.target.value})}/></label>
   {onApplyAll&&<button type="button" onClick={()=>onApplyAll([role])}>Apply this shape & colour to all {role==='original'?'original passages':'meanings'}</button>}
   {value?.[role]&&value[role]?.shape!=='none'&&<>
    <p className="ts-help">Adjust the shape behind the text. Values are relative to its text box. Use Move text to move both together.</p>
    {([{key:'offsetX',label:'Horizontal position',min:-50,max:50,defaultValue:0},{key:'offsetY',label:'Vertical position',min:-50,max:50,defaultValue:0},{key:'width',label:'Shape width',min:50,max:200,defaultValue:100},{key:'height',label:'Shape height',min:50,max:200,defaultValue:100},{key:'padding',label:'Text padding',min:0,max:4,defaultValue:1.3}] as const).map(control=><label key={control.key}>{control.label}: {value[role]?.[control.key]??control.defaultValue}{control.key==='padding'?' em':'%'}<input aria-label={`${role} ${control.label}`} type="range" min={control.min} max={control.max} step={control.key==='padding'?.1:1} value={value[role]?.[control.key]??control.defaultValue} onChange={e=>update(role,{[control.key]:Number(e.target.value)})}/></label>)}
    <button type="button" onClick={()=>update(role,{offsetX:0,offsetY:0,width:100,height:100,padding:1.3})}>Reset shape adjustments</button>
   </>}
  </fieldset>)}</div>
  {onApplyAll&&<button type="button" onClick={()=>onApplyAll(['original','meaning'])}>Apply both shapes & colours to all pages</button>}
  {onUndo&&<button type="button" onClick={onUndo}>Undo apply to all pages</button>}
  <button type="button" onClick={()=>onChange(undefined)}>Remove backgrounds from this spread</button>
  <p className="ts-help">Apply to all includes None and preserves each page’s shape position, size and padding. Shapes save with the book and appear in previews and exports. They cover the illustration beneath them; allow extra space inside the shape for your text.</p>
 </ToolPanel>;
}
