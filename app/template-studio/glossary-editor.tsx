'use client';
import type {GlossaryEntry} from '../../lib/book-glossary';
export default function GlossaryEditor({entries=[],onChange}:{entries?:GlossaryEntry[];onChange:(entries:GlossaryEntry[])=>void}){
 const change=(i:number,key:keyof GlossaryEntry,value:string)=>onChange(entries.map((e,n)=>n===i?{...e,[key]:value}:e));
 return <fieldset><legend>Word meanings at the end of the book</legend><p className="ts-help">Short Hindi and English definitions keep the illustrated pages uncluttered.</p>{entries.map((entry,i)=><fieldset key={i}><legend>Word {i+1}</legend>{(['term','hindi','english','sourceReference'] as const).map((key,n)=><label key={key}>{['Word','Hindi meaning','English meaning','Chaupai reference'][n]}<input aria-label={`Glossary ${i+1} ${key}`} maxLength={key==='term'?60:160} value={entry[key]} onChange={e=>change(i,key,e.target.value)}/></label>)}<button onClick={()=>onChange(entries.filter((_,n)=>n!==i))}>Remove word {i+1}</button></fieldset>)}<button disabled={entries.length>=160} onClick={()=>onChange([...entries,{term:'',hindi:'',english:'',sourceReference:''}])}>Add glossary word</button></fieldset>;
}
