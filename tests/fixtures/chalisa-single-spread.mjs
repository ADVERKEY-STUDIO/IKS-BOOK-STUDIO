import {facingBook} from './chalisa-facing-pages.mjs';
import {chalisaSingleBlueprints} from '../../lib/template-layouts.ts';
export function singleBook(count=41) {
 const old=facingBook(count),leaves=old.pages.flatMap(p=>p.chalisaPages);
 return {...old,pages:leaves.map((leaf,i)=>({...old.pages[0],id:`spread-${i+1}`,image:`spread-${i+1}.png`,blueprint:chalisaSingleBlueprints[i%3].id,chalisaPages:[leaf]}))};
}
