import {chalisaEditions,type ChalisaEditionId} from '../../lib/chalisa-editions';

export default function ChalisaEditionPicker({value,onChange,disabled=false}:{value?:ChalisaEditionId;onChange:(id:ChalisaEditionId|undefined)=>void;disabled?:boolean}) {
  return <label>Chalisa edition
    <select aria-label="Chalisa edition" value={value||''} disabled={disabled} onChange={e=>onChange(e.target.value as ChalisaEditionId||undefined)}>
      <option value="">Choose an edition</option>
      {chalisaEditions.map(e=><option value={e.id} key={e.id}>{e.label}</option>)}
    </select>
    <span className="ts-help">The reviewed Durga book guides the cover, illustrations, bilingual meanings and life lessons. Upload the selected Chalisa’s own source text.</span>
  </label>;
}
