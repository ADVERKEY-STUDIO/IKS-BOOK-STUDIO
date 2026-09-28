'use client';
import {ToolPanel} from './editor-tools';
import {textBackgroundShapes,type TextBackgrounds,type TextBackground} from '../../lib/text-backgrounds';
const names={none:'None (show illustration)',cloud:'Cloud',speech:'Speech bubble',rounded:'Rounded panel',parchment:'Parchment'};
export default function TextBackgroundEditor({value,onChange}:{value:TextBackgrounds|undefined;onChange:(value:TextBackgrounds|undefined)=>void}){
 const update=(role:'original'|'meaning',patch:Partial<TextBackground>)=>onChange({...value,[role]:{shape:'none',color:'#fff8e8',...value?.[role],...patch}});
 return <ToolPanel title="Backgrounds" className="ts-page-controls">
  <p>Add a shape behind a passage to separate it from the illustration. Move and resize it together with the text using Move text.</p>
  <div className="ts-fields">{(['original','meaning'] as const).map(role=><fieldset key={role}><legend>{role==='original'?'Read first / original passage':'Meaning / explanation'}</legend>
   <label>Background shape<select aria-label={`${role} background shape`} value={value?.[role]?.shape??'none'} onChange={e=>update(role,{shape:e.target.value as TextBackground['shape']})}>{textBackgroundShapes.map(shape=><option key={shape} value={shape}>{names[shape]}</option>)}</select></label>
   <label>Background colour<input aria-label={`${role} background colour`} type="color" style={{height:44,padding:6}} value={value?.[role]?.color??'#fff8e8'} disabled={!value?.[role]||value[role]?.shape==='none'} onChange={e=>update(role,{color:e.target.value})}/></label>
  </fieldset>)}</div>
  <button type="button" onClick={()=>onChange(undefined)}>Remove backgrounds from this spread</button>
  <p className="ts-help">Shapes save with the book and appear in previews and exports. They cover the illustration beneath them; allow extra space inside the shape for your text.</p>
 </ToolPanel>;
}
