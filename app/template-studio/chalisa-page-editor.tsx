'use client';
import type { ChalisaPage } from '../../lib/chalisa-pages';
export default function ChalisaPageEditor({pages,onChange}:{pages:ChalisaPage[];onChange:(pages:ChalisaPage[])=>void}) {
 const change=(index:number,key:keyof ChalisaPage,value:string)=>onChange(pages.map((page,i)=>i===index?{...page,[key]:value}:page));
 return <div>{pages.map((page,i)=><fieldset key={i}>
  <legend>{i===0?'Left page':'Right page'} · one chaupai</legend>
  <label>{i===0?'Left':'Right'} chaupai<textarea aria-label={`${i===0?'Left':'Right'} chaupai`} value={page.original} onChange={e=>change(i,'original',e.target.value)}/></label>
  <label>{i===0?'Left':'Right'} meanings and morals<textarea aria-label={`${i===0?'Left':'Right'} meanings and morals`} value={page.meaning} onChange={e=>change(i,'meaning',e.target.value)}/></label>
  <label>{i===0?'Left':'Right'} source reference<input aria-label={`${i===0?'Left':'Right'} source reference`} value={page.sourceReference} onChange={e=>change(i,'sourceReference',e.target.value)}/></label>
  <label>{i===0?'Left':'Right'} illustration context<textarea aria-label={`${i===0?'Left':'Right'} illustration context`} value={page.scene} onChange={e=>change(i,'scene',e.target.value)}/></label>
 </fieldset>)}{pages.length===1&&<p className="ts-help">The final right page has no verse. Keep it as quiet decorative space.</p>}</div>;
}
