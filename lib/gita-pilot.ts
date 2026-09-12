import { newEdition, type Edition, type EditorialField } from './devotional-edition.ts';
import { blankSpread } from './storyboard.ts';
import { layerDefaults, type CompositionLayer, type SpreadComposition } from './spread-composition.ts';

/** Review-only specimen. No production/source approvals are synthesized. */
export const pilotStudies = [
  {ref:'2.47',title:'The work before you',family:'Quiet verse' as const,source:'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=2&field_nsutra_value=47',original:'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि।।2.47।।',meaning:'Give your care to the work before you. Do not make its reward your reason for acting, and do not turn away from action.',intent:'A verse-led opening faces a whole manuscript painting. The unhurried text page gives the eye a place to rest before entering the landscape.',image:'journey',caption:'Folio from a Bhagavata Purana series. Nepal, ca. 1775–1800. A related Krishna narrative, not the Gita teaching scene. The Met, 2019.65. Public domain.'},
  {ref:'6.19',title:'A steady attention',family:'Close detail' as const,source:'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=6&field_nsutra_value=19',original:'यथा दीपो निवातस्थो नेङ्गते सोपमा स्मृता।\nयोगिनो यतचित्तस्य युञ्जतो योगमात्मनः।।6.19।।',meaning:'A flame sheltered from the wind stays steady. It offers an image of the disciplined mind, gathered in meditation on the Self.',intent:'An intimate object study changes the scale and pace. The lamp is a contextual association with the metaphor; its museum identification is preserved.',image:'lamp',caption:'Element of a Lamp. Attributed to India, 18th–19th century; bronze. The Met, 21.153. Public domain. An object study, not the lamp described by the verse.'},
  {ref:'11.12',title:'Beyond familiar forms',family:'Image and commentary' as const,source:'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=11&field_nsutra_value=12',original:'दिवि सूर्यसहस्रस्य भवेद्युगपदुत्थिता।\nयदि भाः सदृशी सा स्याद्भासस्तस्य महात्मनः।।11.12।।',meaning:'Imagine a thousand suns rising together. Their light might suggest the radiance of the divine form revealed to Arjuna.',intent:'A comparative art spread pairs the radiance verse with another historic conception of Krishna’s universal form. The caption names the distinction, rather than treating separate traditions as one scene.',image:'composite',caption:'Navagunjara, a Universal Form of Krishna. India, ca. 1835. The Met, 2006.240. Public domain. A distinct composite iconography, not a literal illustration of Gita 11.12.'},
];
export const pilotCredits = [
 {title:'Folio from a Bhagavata Purana series',url:'https://www.metmuseum.org/art/collection/search/819647',note:'Nepal, ca. 1775–1800. The Metropolitan Museum of Art, Purchase, Friends of Asian Art Gifts, 2019. Public domain.'},
 {title:'Element of a Lamp',url:'https://www.metmuseum.org/art/collection/search/447421',note:'Attributed to India, 18th–19th century. The Metropolitan Museum of Art, Gift of Joseph Brummer, 1921. Public domain.'},
 {title:'Navagunjara, a Universal Form of Krishna',url:'https://www.metmuseum.org/art/collection/search/73296',note:'India, ca. 1835. The Metropolitan Museum of Art, Purchase, Evelyn Kranes Kossak Gift, 2006. Public domain.'},
];
export const pilotAssets:Record<string,string> = Object.fromEntries(['journey','lamp','composite'].map(key=>[key,`/pilot/gita/${key}.jpg`]));
const field = (text:string, generated=false):EditorialField => ({text,status:'draft',provenance:generated?'generated':'extracted'});
const ink='#2b3831',accent='#9b462e';
function text(id:string,value:string,x:number,y:number,width:number,height:number,size=12,color=ink):CompositionLayer {return {...layerDefaults(id,'text'),text:value,x,y,width,height,fontSize:size,lineHeight:1.6,inset:0,color};}
function rule(id:string,x:number,y:number,width:number):CompositionLayer {return {...layerDefaults(id,'ornament'),x,y,width,height:1,color:accent,background:accent};}
function build():Edition {
 const e=newEdition();e.metadata={...e.metadata,title:'Selected verses from the Bhagavad Gita — review pilot',type:'Illustrated devotional edition',sourceEdition:'IIT Kanpur Gita Supersite, displayed Sanskrit',attribution:'Historic artwork: The Metropolitan Museum of Art. See individual credits.',translator:'Original English paraphrases drafted for review',sourceLocation:'2.47; 6.19; 11.12'};e.printFormat={width:180,height:230,bleed:3,margin:15,gutter:8};
 e.passages=pilotStudies.map((s,i)=>({id:`pilot-${i+1}`,revision:1,location:`Bhagavad Gita ${s.ref} · ${s.source}`,fields:{original:field(s.original),translation:field(s.meaning,true),transliteration:field(''),commentary:field(''),notes:field('Editorial and user review pending.')},history:[],derivedFrom:[]}));
 e.storyboard=pilotStudies.map((s,i)=>({...blankSpread(),id:`study-${i+1}`,revision:1,title:s.title,family:s.family,purpose:s.intent,concept:s.caption,textArea:'See saved physical composition',allocations:[{passageId:e.passages[i].id,fields:['original','translation'],start:0,end:s.original.length}]}));
 e.compositions=pilotStudies.map((s,i):SpreadComposition=>{
  const right=i===1||i===2,tx=right?198:18,ax=right?18:198;
  const layers:CompositionLayer[]=[text('running','SELECTED VERSES / BHAGAVAD GITA',18,16,140,8,8,accent),text('review','DESIGN PILOT · REVIEW COPY',198,16,140,8,8,accent)];
  layers.push(text('title',s.title,tx,37,140,30,26),rule('rule',tx,77,20));
  const original=text('original','',tx,90,144,56,18);original.binding={passageId:e.passages[i].id,field:'original',start:0,end:s.original.length};layers.push(original);
  layers.push(text('meaning-label','READING AID / DRAFT ENGLISH MEANING',tx,153,144,9,8,accent));
  const meaning=text('translation','',tx,167,140,35,12);meaning.binding={passageId:e.passages[i].id,field:'translation',start:0,end:s.meaning.length};layers.push(meaning);
  layers.push({...layerDefaults('artwork','image'),imageKey:s.image,x:i===1?43:ax,y:i===1?74:43,width:i===1?95:144,height:i===1?80:132,fit:'contain'});
  layers.push(text('caption',s.caption,ax,i===1?165:179,144,30,8));
  layers.push(text('folio-left',`${i*2+2}`,18,210,20,5,8),text('folio-right',`${i*2+3}`,325,210,20,5,8));
  return {planId:e.storyboard![i].id,planRevision:1,revision:1,guideVersion:0,paper:i===2?'#eee5d3':'#f8f2e6',layers};
 });return e;
}
export const gitaPilot=build();
