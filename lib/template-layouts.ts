import { referenceContracts, referencePalette } from './template-reference-contracts.ts';
import { signatureBlueprints } from './template-signatures.ts';
import type { BookPage, TemplateBook } from './template-book.ts';

/** Saved books pin geometry and proportions; revision 2 uses inspected reference compositions. */
export const TEMPLATE_REVISION = 2;
export type Region = { x: number; y: number; w: number; h: number };
export type Blueprint = { id: string; name: string; intent: string; art: Region[]; original: Region[]; meaning: Region; integrated?: boolean; panel?: boolean; referenceIndex?: number; coloured?: boolean };
const r = (x:number,y:number,w:number,h:number):Region => ({x,y,w,h});
const bp = (id:string,name:string,intent:string,art:Region[],original:Region[],meaning:Region,extra:Partial<Blueprint> = {}):Blueprint => ({id,name,intent,art,original,meaning,...extra});
export const blueprints: Record<string, Blueprint> = Object.fromEntries([
 bp('landscape-opening','Landscape & intimate scene','Establish a place with a low landscape, then a small human encounter at upper right.',[r(0,65,100,35),r(56,0,44,47)],[r(7,8,35,48)],r(61,49,32,17),{integrated:true}),
 bp('diagonal-scenes','Two diagonal story moments','Two separate narrative moments: an upper-left establishing scene and a lower-right close interaction. Irregular paper connects them.',[r(0,0,52,59),r(76,43,24,57),r(39,70,37,30)],[r(6,66,29,28),r(58,7,35,28)],r(55,40,19,26),{integrated:true}),
 bp('open-vignette','Close-up & distant vignette','An expressive left close-up and a smaller distant scene at lower right, separated by open paper.',[r(0,0,48,64),r(54,68,46,32)],[r(58,8,35,51)],r(7,72,35,21),{integrated:true}),
 bp('paired-scenes','Two scenes & central reflection','Two distinct scenes above their own passages; a short reflection links them below. No enclosing frames.',[r(3,3,42,43),r(55,3,42,43)],[r(7,49,36,28),r(57,49,36,28)],r(18,81,64,14),{integrated:true}),
 bp('journey-scenes','A journey in three moments','Three connected but visibly separate moments: a departure upper left, an encounter upper right, and arrival lower centre.',[r(0,0,45,35),r(57,0,43,34),r(33,70,36,30)],[r(5,38,37,29),r(58,38,37,29)],r(5,73,25,22),{integrated:true}),
 bp('quiet-ending','Quiet encounter & closing words','A small intimate interaction on the left and a distant closing vignette below; generous paper for reflection.',[r(3,8,43,53),r(8,77,29,19)],[r(57,10,36,49)],r(57,66,36,26),{integrated:true}),
 bp('art-right','Illustration right','One portrait narrative scene faces an open reading page.',[r(53,5,43,90)],[r(6,9,37,53)],r(6,67,37,25)),
 bp('art-left','Illustration left','A portrait narrative scene opens the spread; reading follows on the right.',[r(4,5,43,90)],[r(57,9,37,53)],r(57,67,37,25)),
 bp('paired-plates','Two illustration plates','Two related details or story moments face the reading page, with visible paper between them.',[r(55,6,40,40),r(55,54,40,40)],[r(6,9,37,53)],r(6,67,37,25)),
 bp('band-below','Landscape above text','A wide establishing scene above two separate reading areas.',[r(0,0,100,55)],[r(6,60,39,33)],r(56,60,38,33)),
 bp('band-above','Text above landscape','Read the passage first, then a wide concluding or travelling scene.',[r(0,46,100,54)],[r(6,7,39,32)],r(56,7,38,32)),
 bp('paired-band','Two moments above text','Two separate story moments above their connected passage and explanation.',[r(3,3,44,49),r(53,3,44,49)],[r(6,60,39,33)],r(56,60,38,33)),
 bp('inset-left','Scene with left reading area','Full spread scene with a quiet left reading inset. Main action on the right.',[r(49,0,51,100)],[r(7,10,33,48)],r(7,66,33,24),{integrated:true,panel:true}),
 bp('inset-right','Scene with right reading area','Full spread scene with a quiet right reading inset. Main action on the left.',[r(0,0,49,100)],[r(60,10,33,48)],r(60,66,33,24),{integrated:true,panel:true}),
 bp('inset-bottom','Scene with lower reading area','A panoramic encounter above two quiet reading insets.',[r(0,0,100,52)],[r(6,60,39,32)],r(56,60,38,32),{integrated:true,panel:true}),
 bp('verse-seal','Verse & closing vignette','Centered verse and explanation lead to a small closing illustration.',[r(35,78,30,18)],[r(19,7,62,43)],r(19,54,62,20)),
 bp('verse-pair','Verse between small vignettes','Two small symbolic illustrations flank a central reading area.',[r(3,20,20,52),r(77,20,20,52)],[r(28,9,44,49)],r(28,65,44,25)),
 bp('study-pair','Paired studies & commentary','Two distinct study illustrations above original text and separate commentary.',[r(5,4,40,30),r(55,4,40,30)],[r(6,40,39,53)],r(56,40,38,53)),
].map(b=>[b.id,b]));
// New named blueprints extend revision one; existing saved coordinates stay unchanged.
for(const options of Object.values(signatureBlueprints))for(const b of options)blueprints[b.id]=b;
for(const contract of Object.values(referenceContracts))for(const b of contract.layouts)blueprints[b.id]=b;
const story = ['landscape-opening','diagonal-scenes','open-vignette','paired-scenes','journey-scenes','quiet-ending'];
const band = ['band-below','band-above','paired-band'];
const inset = ['inset-left','inset-right','inset-bottom'];
const plates = ['art-right','art-left','paired-plates'];
/** Each catalogue entry has an explicit supported family, including retained legacy templates. */
const families:Record<string,string[]> = {
 'beanstalk-adventure':story, 'flower-festival':['open-vignette','paired-scenes','quiet-ending'], 'treehouse-days':['open-vignette','paired-scenes','journey-scenes','quiet-ending'],
 'bedtime-skies':band,'snowy-friends':band,panorama:band,
 'little-explorers':inset,'bedtime-play':inset,immersive:inset,
 'paper-play':['art-left','art-right','paired-plates'],'painted-memories':['art-left','paired-plates','art-right'],'colourful-journey':plates,
 manifesto:plates,wild:plates,fragments:['paired-plates','art-left','art-right'],chromatic:plates,echo:['verse-seal','verse-pair'],haze:['verse-seal','art-left','verse-pair'],
 poetry:['verse-seal','verse-pair'],study:['study-pair','band-below','paired-band'],painted:plates,heritage:plates,quiet:['open-vignette','quiet-ending','verse-seal'],moonlit:['verse-seal','verse-pair'],botanical:['open-vignette','paired-scenes','quiet-ending'],vermilion:plates,storybook:plates,archive:['study-pair','paired-plates','art-right'],festival:plates,
};
export function templateBlueprints(id:string,revision=2):Blueprint[] {
 const ids = families[id]; if(!ids) throw Error(`No layout specification for template ${id}.`);
 if(revision===2)return referenceContracts[id]?.layouts || (signatureBlueprints[id] || ids.map(key=>blueprints[key])).slice(0,1);
 return signatureBlueprints[id] || ids.map(key=>blueprints[key]);
}
export function templateSize(id:string,revision=2) { return {width:420,height:revision===2&&referenceContracts[id]?420/referenceContracts[id].ratio:id==='beanstalk-adventure'?210:250}; }
export function templatePrintSize(id:string,cover=false,revision=2) { const size=templateSize(id,revision);return {...size,width:cover&&['manifesto','wild','fragments','chromatic','echo','haze'].includes(id)?210:size.width}; }
export function blueprintFor(book:Pick<TemplateBook,'templateId'|'templateRevision'>,page:Pick<BookPage,'blueprint'>) {
 if(![1,2].includes(book.templateRevision||0)) throw Error('This book needs a supported template specification.');
 const found=[...templateBlueprints(book.templateId,book.templateRevision),...(book.templateRevision===1?(families[book.templateId]||[]).map(id=>blueprints[id]):[])].find(b=>b.id===page.blueprint);
 if(!found)throw Error(`Choose a supported spread blueprint for ${book.templateId}.`);
 return found;
}
export function blueprintPrompt(id:string) {
 const b=blueprints[id];if(!b)throw Error('Unknown blueprint.');
 if(b.referenceIndex!==undefined){
 const coord=(a:Region)=>`x=${a.x}%, y=${a.y}%, width=${a.w}%, height=${a.h}%`;
 return `SELECTED SPREAD BLUEPRINT: ${b.id} — ${b.name}\nUse template-references/spread-${b.referenceIndex+1} as the matching visual reference. Crop away any photographed table, outer margin, shadow or cover mockup; use the actual page artwork as the canvas. Coordinates are percentages of that canvas.\n${b.intent}\nART REGIONS: ${b.art.map(coord).join('; ')}. These are composition envelopes, not rectangular panels.\nTEXT-SAFE REGIONS: ${[...b.original,b.meaning].map(coord).join('; ')}. Keep these exact areas free of subjects and high-contrast detail. ${b.coloured?'Continue the reference’s flat background colour through the reading areas; do not add white or cream boxes.':'Retain the reference’s quiet paper/sky background in reading areas; do not add opaque text boxes.'} Narrow caption regions hold only one or two short lines; plan additional spreads for longer source material, never enlarge these regions. Match the reference edges and overlaps. Do not move or mirror scenes or text. Generate ONE composite full-spread image with no lettering; the app places editable text. Keep important faces clear of the gutter. Check placement against the guide before accepting.`;
 }
 const coords=(a:Region)=>`x=${a.x}%, y=${a.y}%, width=${a.w}%, height=${a.h}%`;
 return `SELECTED SPREAD BLUEPRINT: ${b.id} — ${b.name}\n${b.intent}\nART REGIONS: ${b.art.map((a,i)=>`Scene ${["diagonal-scenes","reference-beanstalk-diagonal"].includes(b.id) && i > 0 ? 2 : i+1} region: ${coords(a)}`).join('; ')}. ${b.art.length>1?'Create visibly distinct story moments, not one repeated scene or a wallpaper panorama. Regions belonging to the same diagonal scene may connect.':''}\nTEXT-SAFE REGIONS: ${[...b.original,b.meaning].map(coords).join('; ')}. ${b.integrated?'Generate ONE full-spread image with these regions left as blank pale paper, free of every object, leaf, branch, roof, ground edge, face and high-contrast mark. Leave a further 3% canvas clearance around each text-safe region; shrink or reposition artwork to achieve this, never shrink or move the text.':'Generate ONE full-spread canvas with illustrations ONLY in the art regions; keep all other areas unmarked paper.'} No text, borders, panel rectangles, labels, mockups or lettering in the image. The website adds editable words. Keep important subjects clear of the central gutter. Return one composite image per spread, not a contact sheet of pages.`;
}
/** Split at verse/paragraph boundaries first, preserving exact Unicode and whitespace. */
export function distributeText(text:string,count:number):string[] {
 if(count===1)return [text];
 const boundaries=[...text.matchAll(/\n+/g)].map(m=>m.index+m[0].length);
 const fallback=[...text.matchAll(/\s+/g)].map(m=>m.index+m[0].length);
 const choices=boundaries.length>=count-1?boundaries:fallback;
 const result:string[]=[];let start=0;
 for(let i=1;i<count;i++){
  const candidates=choices.filter(p=>p>start&&p<text.length);
  const target=text.length*i/count;
  const end=candidates.length?candidates.reduce((a,b)=>Math.abs(a-target)<Math.abs(b-target)?a:b):text.length;
  result.push(text.slice(start,end));start=end;
 }
 result.push(text.slice(start));return result;
}
export function plannedTextBlocks(page:BookPage,b:Blueprint) {
 const parts=distributeText(page.original,b.original.length);
 return [...b.original.map((a,i)=>({...a,role:'original' as const,text:parts[i]})),{...b.meaning,role:'meaning' as const,text:page.meaning}].map((block,i)=>({...block,...page.textPositions?.[i]}));
}
export function planTemplateBook(book:TemplateBook):TemplateBook {
 const options=templateBlueprints(book.templateId);
 const pages=book.pages.map((p,index)=>{
  const words=`${p.title} ${p.scene} ${p.meaning}`.toLowerCase();
  const ranked=options.map((b,order)=>{
   let score=-order*.01;
   if(index===0&&/opening|band-below|art-left/.test(b.id))score+=5;
   if(index===book.pages.length-1&&/ending|seal|band-above/.test(b.id))score+=6;
   if(/journey|travel|walk|across|through|seasons/.test(words)&&/journey|band/.test(b.id))score+=5;
   if(/family|care|comfort|prayer|humble|kind/.test(words)&&/vignette|ending|inset/.test(b.id))score+=4;
   if(/then|while|and|two|before|after|service|offer/.test(words)&&/diagonal|paired/.test(b.id))score+=3;
   // Long passages favour larger reading areas, never smaller type or deleted words.
   score+=b.original.reduce((sum,a)=>sum+a.w*a.h,0)*(p.original.length>300?.003:.0003);
   return {b,score};
  }).sort((a,b)=>b.score-a.score);
  const b=ranked[0].b;
  const planned={...p,blueprint:b.id,layoutReason:`${b.intent} Selected from the template’s supported arrangements; repetition is allowed.`,fontSize:Math.min(p.fontSize,18),imageScale:100};
  delete planned.artworkBlueprint;
  delete planned.textPositions;
  return planned;
 });
 return {...book,templateRevision:TEMPLATE_REVISION,pages};
}
export function layoutIssues(book:TemplateBook):string[] {
 const notes:string[]=[];
 if(!book.templateRevision){notes.push('Legacy book: layout specification is not pinned. Review a new layout plan before regenerating artwork.');return notes;}
 for(const [i,p] of book.pages.entries()){
  const b=blueprintFor(book,p);
  if(p.artworkBlueprint && p.artworkBlueprint!==p.blueprint)notes.push(`Spread ${i+1}: artwork belongs to another arrangement; regenerate or replace it before exporting.`);

  for(const block of plannedTextBlocks(p,b))if(block.text.length>block.w*block.h*.45)notes.push(`Spread ${i+1}: long ${block.role} text; check actual font fit or split at a source boundary.`);
 }
 return notes;
}
export function imageGeometryIssue(book:TemplateBook,page:BookPage,width:number,height:number) {
 if(!book.templateRevision)return undefined;
 const size=templateSize(book.templateId,book.templateRevision||1),expected=size.width/size.height;
 if(Math.abs(width/height/expected-1)>.025)return `${page.title}: image is ${width} × ${height}; this template requires a ${size.width}:${size.height} full-spread canvas. Regenerate or crop deliberately before import.`;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const position=(r:Region)=>`left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;`;
export function renderPlannedSpread(book:TemplateBook,page:BookPage,url:string|undefined,palette:{paper:string;ink:string;accent:string},index:number) {
 if(book.templateRevision===2)palette=referencePalette(book.templateId,palette);
 const b=blueprintFor(book,page),size=templateSize(book.templateId,book.templateRevision||1);
 return `<section class="spread planned-spread ${esc(book.templateId)}" data-revision="${book.templateRevision}" data-blueprint="${b.id}" data-spread="${index+1}" style="--paper:${palette.paper};--ink:${palette.ink};--accent:${palette.accent};width:${size.width}mm;height:${size.height}mm">${url?`<img class="planned-art" alt="${esc(page.scene)}" src="${esc(url)}">`:'<div class="missing">Artwork pending — '+esc(page.image)+'</div>'}${b.art.map(a=>`<div aria-hidden="true" class="planned-art-frame" style="${position(a)}"></div>`).join('')}${plannedTextBlocks(page,b).map((block,i)=>`<div class="planned-text ${block.role}${b.panel?' planned-panel':''}" data-text-region="${i+1}" style="${position(block)}${book.templateRevision===2?`font-family:${referenceContracts[book.templateId]?.sans?'Book,Arial,sans-serif':'Book,Georgia,serif'};text-align:${referenceContracts[book.templateId]?.centered?'center':'left'};font-style:${book.templateId==='beanstalk-adventure'&&block.role==='meaning'?'italic':'normal'};line-height:1.4;`:''}font-size:${(block.role==='meaning'?Math.max(14,page.fontSize*.875):page.fontSize)/11.9055}cqw" contenteditable="true">${esc(block.text)}</div>`).join('')}</section>`;
}
export function plannedSpreadCss(){return `
.planned-spread{container-type:inline-size;position:relative;isolation:isolate;background:var(--paper);color:var(--ink);font-family:Book,Georgia,serif}
.planned-spread .planned-art{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0}
.planned-spread .planned-text{position:absolute;z-index:1;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;margin:0;padding:0;border:0;background:transparent;color:var(--ink);font-family:Book,Georgia,serif;font-weight:400;text-align:left}
.planned-spread .meaning{font-style:italic}.planned-spread .planned-panel{background:var(--paper);outline:2mm solid var(--paper)}
.planned-spread .planned-art-frame{position:absolute;pointer-events:none;z-index:1}
.planned-spread.paper-play[data-revision="1"] .planned-text{outline:1px solid var(--accent);outline-offset:3mm}.planned-spread.paper-play .meaning{outline:0}
.planned-spread.heritage .planned-art-frame,.planned-spread.moonlit .planned-art-frame{border:1px solid var(--accent)}
.planned-spread.festival .planned-art-frame{border:2mm double var(--accent)}
.planned-spread.vermilion .planned-art-frame{border-bottom:2mm solid var(--accent)}
.planned-spread.archive .planned-art-frame{border:1px solid var(--accent)}
.planned-spread.echo .original,.planned-spread.poetry .original{text-align:center;line-height:1.8}
.planned-spread.manifesto .original{font-weight:700}.planned-spread.fragments .meaning{border-top:1px solid var(--accent);padding-top:2mm}
.planned-spread.paper-play[data-revision="2"]::after{content:"";position:absolute;left:57%;top:10%;width:36%;height:80%;border:1px solid #d2bd80;pointer-events:none}
.planned-spread .missing{position:absolute;right:5%;bottom:3%;font-size:12px;max-width:40%}
`;}
export function blueprintSvg(b:Blueprint,paper='#fff9e9',accent='#38766c',height=500) {
 const rect=(a:Region,fill:string,label:string)=>`<rect x="${a.x*10}" y="${a.y*height/100}" width="${a.w*10}" height="${a.h*height/100}" rx="12" fill="${fill}"/><text x="${a.x*10+12}" y="${a.y*height/100+22}" font-family="sans-serif" font-size="15" fill="#172e27">${label}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}"><rect width="1000" height="${height}" fill="${paper}"/>${b.art.map((a,i)=>rect(a,accent,`Scene ${["diagonal-scenes","reference-beanstalk-diagonal"].includes(b.id) && i > 0 ? 2 : i+1}`)).join('')}${b.original.map((a,i)=>rect(a,'#ede5d4',`Passage ${i+1}`)).join('')}${rect(b.meaning,'#e3eaf0','Meaning')}<path d="M500 0V${height}" stroke="#777" stroke-dasharray="5 8" opacity=".3"/></svg>`;
}
/** Run after document.fonts.ready and image.decode; shared by preview and download. */
export function inspectRenderedBook(doc:Document):string[]{
 const notes:string[]=[];
 doc.querySelectorAll<HTMLElement>('.spread:not(.cover)').forEach((spread,i)=>{
  if(spread.querySelector('.missing'))notes.push(`Spread ${i+1}: artwork did not load or is still missing.`);
  spread.querySelectorAll<HTMLElement>('.planned-text,.story-text,.copy').forEach(el=>{
   if(el.clientHeight&& (el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2))notes.push(`Spread ${i+1}: text overflow; split content or choose a larger reading region.`);
  });
  spread.querySelectorAll<HTMLImageElement>('.planned-art,.art img').forEach(im=>{
   if(!im.naturalWidth)notes.push(`Spread ${i+1}: artwork did not load.`);
   else if(im.clientWidth&&im.naturalWidth/im.clientWidth*96<300)notes.push(`Spread ${i+1}: artwork is below 300 dpi at placed size.`);
  });
 });
 return [...new Set(notes)];
}
