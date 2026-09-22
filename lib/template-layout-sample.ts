import {referencePalette} from './template-reference-contracts.ts';
import { templates, templateLayout, renderTemplatePage, type TemplateId, type TemplateBook } from './template-book.ts';
import { TEMPLATE_REVISION, templateBlueprints, templateSize, type Blueprint } from './template-layouts.ts';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Illustration placement guides, not finished artwork. Text uses the actual book renderer. */
export function sampleArtwork(id:TemplateId,b:Blueprint){
 const t=referencePalette(id,templates.find(t=>t.id===id)!);const size=templateSize(id),h=1000*size.height/size.width;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${h}"><rect width="1000" height="${h}" fill="${t.paper}"/>${b.art.map((r,i)=>{
 const x=r.x*10,y=r.y*h/100,w=r.w*10,height=r.h*h/100;
 const soft=['flower-festival','quiet','haze','treehouse-days','botanical'].includes(id);
 const shape=soft?`<ellipse cx="${x+w/2}" cy="${y+height/2}" rx="${w/2}" ry="${height/2}" fill="${t.accent}" opacity=".22"/>`:`<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="${['storybook','beanstalk-adventure'].includes(id)?24:0}" fill="${t.accent}" opacity=".22"/>`;
 const label=b.art.length===1?'Illustration':`Scene ${['diagonal-scenes','reference-beanstalk-diagonal'].includes(b.id)&&i>0?2:i+1}`;
 return shape+(w>120&&height>70?`<text x="${x+w/2}" y="${y+height/2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="15" fill="${t.ink}">${label}</text>`:'');
 }).join('')}</svg>`;
}
export function renderLayoutSample(id:TemplateId,blueprintId?:string){
 const b=templateBlueprints(id).find(b=>b.id===blueprintId)||templateBlueprints(id)[0];
 const compact=b.original.some(r=>r.h<25);
 const book:TemplateBook={format:'iks-template-book-v1',templateRevision:TEMPLATE_REVISION,projectId:'sample-'+id,templateId:id,title:'A moment of kindness',language:'Hindi and English',characterGuide:'Original demonstration',pages:[{id:'sample',title:'A moment of kindness',original:compact?'एक पौधा लगाया।':'सुबह की धूप आँगन में आई।\nबच्चे ने एक पौधा लगाया।\n\nसबने मिलकर उसे पानी दिया।\nछोटी-सी कोशिश से बगीचा खिल उठा।',meaning:b.meaning.h<15?'A little care.':'A small act of care becomes something everyone can share.',sourceReference:'Original demonstration text; not scripture',scene:b.intent,image:'sample.png',layout:templateLayout(id),blueprint:b.id,layoutReason:b.intent,fontSize:16,imageScale:100}]};
 return renderTemplatePage(book,0,{'sample.png':`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleArtwork(id,b))}`}).replace('<title>',`<title>${esc(templates.find(t=>t.id===id)!.name)} · `);
}
