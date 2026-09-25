import type {TemplateBook} from './template-book.ts';

export type BookCompletion = {
 frontCover:{image:string;scene:string};
 backCover:{image:string;scene:string};
 subtitle:string;
 author:string;
 credits:string;
 blurb:string;
 easterEgg:string;
 isbn:string;
 mrp:string;
};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function defaultBookCompletion(used:string[]=[]):BookCompletion {
 const filename=(base:string)=>{let name=base+'.png',n=2;while(used.includes(name))name=`${base}-${n++}.png`;return name;};
 return {
  frontCover:{image:filename('front-cover'),scene:'A welcoming cover scene with the main character and one recognisable motif from the source. Match the interior illustrations.'},
  backCover:{image:filename('back-cover'),scene:'A quiet closing scene connected to the story. Hide one tiny leaf among the painted details as a find-and-seek Easter egg.'},
  subtitle:'',author:'',credits:'',blurb:'',easterEgg:'Can you find the tiny leaf hidden in this picture?',isbn:'',mrp:''
 };
}
export function parseBookCompletion(value:unknown,used:Set<string>):BookCompletion|undefined {
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid book completion details.');
 const v=value as Record<string,unknown>;
 const text=(value:unknown,label:string,max:number)=>{if(typeof value!=='string'||value.length>max)throw Error(`${label} must be text under ${max} characters.`);return value;};
 const cover=(key:string)=>{
  const c=v[key];if(!c||typeof c!=='object'||Array.isArray(c))throw Error(`Missing ${key}.`);
  const item=c as Record<string,unknown>,image=text(item.image,'Cover image filename',100);
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,90}\.(png|jpe?g|webp)$/i.test(image)||used.has(image))throw Error('Covers need unique PNG, JPEG or WebP filenames without folders.');
  used.add(image);return {image,scene:text(item.scene,'Cover scene',2000)};
 };
 return {frontCover:cover('frontCover'),backCover:cover('backCover'),subtitle:text(v.subtitle??'','Subtitle',120),author:text(v.author??'','Author / publisher',120),credits:text(v.credits??'','Credits',800),blurb:text(v.blurb??'','Back-cover blurb',450),easterEgg:text(v.easterEgg??'','Easter egg clue',160),isbn:text(v.isbn??'','ISBN',40),mrp:text(v.mrp??'','MRP',40)};
}
export function bookArtworkFiles(book:TemplateBook):string[]{
 return [...book.pages.map(p=>p.image),...(book.completion?[book.completion.frontCover.image,book.completion.backCover.image]:[])];
}
export function coverArtworkPrompt(completion:BookCompletion,names:string[]=[],interiorImages:string[]=[]):string {
 return (['frontCover','backCover'] as const).filter(key=>!names.includes(completion[key].image)).map(key=>{
  const front=key==='frontCover',cover=completion[key];
  return `images/${cover.image}\n${front?'FRONT':'BACK'} COVER: a separate square 210 × 210 mm page, 2480 × 2480 pixels at 300 dpi. Not a facing-page spread or wraparound mockup. COVER STYLE MATCH: Use the same character designs, proportions, palette, brushwork, paper grain, textures, lighting and level of detail as the finished interior. Establish the interior look first, then create the covers. Attach the approved character sheet and one or two representative finished interior illustrations as actual visual inputs to EACH cover-generation call, alongside the template references. ${interiorImages.length?'Use these finished interior references: '+interiorImages.slice(0,2).map(name=>'images/'+name).join(', ')+'.':'Choose representative interior images produced in this same book request.'} Compare each cover side by side with the interior before accepting it and correct any style drift. Change only the composition to suit a cover; do not introduce a different cover aesthetic. Scene: ${cover.scene}\n${front?'Keep x=8–92%, y=6–34% quiet for the editable title and subtitle; x=8–92%, y=88–96% quiet for the author/publisher. Compose the main illustration between y=36–85%.':'Keep x=8–92%, y=6–34% quiet for the editable blurb and Easter egg clue. Place the small hidden motif within the central illustration at y=38–72%. Leave the entire bottom y=76–100% plain and unpainted for ISBN, a future barcode and MRP. Easter egg clue: '+completion.easterEgg}\nNo lettering, numbers, ISBN, price, barcode or publisher logo painted into the image. The app places editable text and reserves a blank barcode area.`;
 }).join('\n\n');
}
export function bookCompletionPrompt():string {
 return `COMPLETE BOOK PACKAGE: In addition to every interior spread, create separate front-cover.png and back-cover.png illustrations. Covers and the app-generated title/credits page are extra; they must not replace or shorten any source passage. Include the completion object from the schema. Write a concise source-grounded back-cover blurb and a playful find-and-seek clue for one small story-related motif hidden in the back illustration. Make its scene and clue agree. Keep the interior's established illustration style. Supply author/publisher and credits only when provided by the user or source; otherwise leave them empty. Leave isbn and mrp empty unless the user supplied real values. Never invent an ISBN, barcode, price, publisher, rights claim or attribution. The app adds the editable title/credits page and back-cover ISBN/MRP spaces.\n${coverArtworkPrompt(defaultBookCompletion())}`;
}
/** Separate physical cover/title pages; interior artwork and page numbering are untouched. */
export function renderBookCompletion(book:TemplateBook,part:'front'|'back',urls:Record<string,string>):string {
 const c=book.completion;if(!c)return '';
 const cover=part==='front'?c.frontCover:c.backCover;
 const art=urls[cover.image]?`<img class="completion-art" data-image="${esc(cover.image)}" src="${esc(urls[cover.image])}" alt="${esc(cover.scene)}">`:`<div class="missing">Artwork pending: ${esc(cover.image)}</div>`;
 const section=(kind:string,contents:string)=>`<section class="spread cover completion-page completion-${kind}" data-print-width="210" data-print-height="210" aria-label="${kind==='front'?'Front cover':kind==='back'?'Back cover':'Title and credits'}">${contents}</section>`;
 if(part==='back')return section('back',`${art}<div class="completion-copy back-copy"><p>${esc(c.blurb)}</p><p class="egg-clue">${esc(c.easterEgg)}</p></div><div class="completion-imprint"><div class="price"><span>MRP</span><p>${esc(c.mrp)||'________________'}</p></div><div class="isbn"><span>ISBN</span><p>${esc(c.isbn)||'________________________'}</p><div class="barcode-space" aria-label="Reserved blank barcode space"></div></div></div>`);
 return section('front',`${art}<div class="completion-copy front-copy"><h1>${esc(book.title)}</h1><p>${esc(c.subtitle)}</p></div><p class="completion-author">${esc(c.author)}</p>`)+section('credits',`<div class="completion-copy credits-copy"><small>ILLUSTRATED READING EDITION</small><h1>${esc(book.title)}</h1><p>${esc(c.subtitle)}</p><p>${esc(c.author)}</p><p class="edition-credits">${esc(c.credits)}</p><p class="reading-note">Read the original passage first, then its meaning. Explore the pictures together.</p></div>`);
}
export function bookCompletionCss(paper='#fffbed',ink='#292723'):string {return `
.spread.completion-page{width:210mm;height:210mm;display:block;border:0;box-shadow:none;container-type:inline-size;background:${paper};color:${ink};page:completion}
.completion-page .completion-art{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.completion-page .completion-copy{position:absolute;left:8%;width:84%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;font-size:2.2cqw;text-align:center}
.completion-page .front-copy{top:6%;height:28%}.completion-page h1{font-size:5cqw;line-height:1.2;margin:0 0 2%;max-width:100%}.completion-page .front-copy h1{font-size:7cqw}.completion-page p{margin:1.5% 0}
.completion-page .completion-author{position:absolute;left:8%;width:84%;top:88%;height:8%;text-align:center;font-size:2cqw;overflow-wrap:anywhere}
.completion-page .back-copy{top:6%;height:28%;text-align:left;font-size:2.2cqw}.completion-page .egg-clue{font-style:italic;margin-top:4%}
.completion-page .completion-imprint{position:absolute;left:8%;right:8%;top:79%;bottom:5%;display:flex;justify-content:space-between;gap:5%;font-size:1.6cqw;text-align:left;overflow-wrap:anywhere;background:${paper}}
.completion-imprint .price{width:35%;padding:2%}.completion-imprint .isbn{width:55%;padding:2%}.completion-imprint span{font-size:1.4cqw;letter-spacing:.08em}.completion-imprint .barcode-space{height:17mm;width:100%;background:white}
.completion-page .credits-copy{top:10%;height:80%;font-size:2cqw}.completion-page .edition-credits{margin-top:7%;white-space:pre-wrap}.completion-page .reading-note{margin-top:7%;font-style:italic}
@page completion{size:210mm 210mm;margin:0}
`;}
