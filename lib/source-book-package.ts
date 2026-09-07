import type { ExternalManuscriptResult, ExternalIllustrationSlot } from './external-manuscript';
export const SOURCE_PACKAGE_FORMAT = 'iks-source-assets-v1';
export type SourceImage = {id:string;sourcePage:number;originalPath?:string;cleanedPath?:string;caption:string;alt:string;status:'available'|'unavailable';reason?:string;placements:{id:string;sectionNumber:number;anchorText:string;reason:string}[]};
export type SourceVerse = {id:string;sectionNumber:number;sourcePage:number;reference:string;sanskrit:string;transliteration?:string;translation?:string;explanation?:string;status:'verified'|'uncertain';reviewNote?:string};
export type SourceBookManifest = {format:typeof SOURCE_PACKAGE_FORMAT;sourceImages:SourceImage[];verses:SourceVerse[];extractionNotes:string[]};
export type SourceArchiveAsset = {path:string;key:string;url:string};
const record=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
const required=(v:unknown,name:string)=>{if(typeof v!=='string'||!v.trim())throw new Error(`Source manifest: ${name} is required.`);return v;};
const optional=(v:unknown)=>typeof v==='string'?v:undefined;
const positive=(v:unknown,name:string)=>{if(!Number.isInteger(v)||Number(v)<1)throw new Error(`Source manifest: ${name} must be a positive integer.`);return Number(v);};
const path=(v:unknown,folder:string)=>{if(v===undefined)return undefined;const p=required(v,'image path');if(!new RegExp(`^${folder}/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)$`,'i').test(p))throw new Error(`Source manifest: invalid ${folder} path.`);return p;};
export function parseSourceBookManifest(input:unknown):SourceBookManifest {
  const raw=record(input);if(raw.format!==SOURCE_PACKAGE_FORMAT)throw new Error(`Source manifest format must be ${SOURCE_PACKAGE_FORMAT}.`);
  if(!Array.isArray(raw.sourceImages)||!Array.isArray(raw.verses)||!Array.isArray(raw.extractionNotes))throw new Error('Source manifest needs sourceImages, verses and extractionNotes arrays.');
  if(raw.sourceImages.length>200||raw.verses.length>500)throw new Error('Source manifest is too large.');
  const seen=new Set<string>();const id=(v:unknown)=>{const s=required(v,'id');if(!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(s)||seen.has(s))throw new Error(`Source manifest: invalid or duplicate id ${s}.`);seen.add(s);return s;};
  const paths=new Set<string>();
  const sourceImages=raw.sourceImages.map(v=>{const r=record(v);const image:SourceImage={id:id(r.id),sourcePage:positive(r.sourcePage,'sourcePage'),originalPath:path(r.originalPath,'source-images'),cleanedPath:path(r.cleanedPath,'cleaned-source-images'),caption:required(r.caption,'caption'),alt:required(r.alt,'alt'),status:r.status==='unavailable'?'unavailable':'available',reason:optional(r.reason),placements:[]};
    if(!['available','unavailable'].includes(String(r.status)))throw new Error('Source image status must be available or unavailable.');
    if(image.status==='available'&&!image.originalPath)throw new Error('Available source images require an originalPath.');
    if(image.status==='unavailable'&&!image.reason?.trim())throw new Error('An unavailable source image needs an extraction failure reason.');
    if(image.status==='unavailable'&&(image.originalPath||image.cleanedPath))throw new Error('Unavailable images must not claim extracted files.');
    for(const p of [image.originalPath,image.cleanedPath])if(p){if(paths.has(p.toLowerCase()))throw new Error(`Duplicate source image path ${p}.`);paths.add(p.toLowerCase());}
    if(!Array.isArray(r.placements))throw new Error('Each source image needs a placements array, empty when unplaced.');
    if(image.status==='unavailable'&&r.placements.length)throw new Error('Unavailable images cannot have active placements.');
    image.placements=r.placements.map(v=>{const p=record(v);return {id:id(p.id),sectionNumber:positive(p.sectionNumber,'sectionNumber'),anchorText:required(p.anchorText,'anchorText'),reason:required(p.reason,'placement relevance reason')};});return image;});
  const verses=raw.verses.map(v=>{const r=record(v);const verse:SourceVerse={id:id(r.id),sectionNumber:positive(r.sectionNumber,'sectionNumber'),sourcePage:positive(r.sourcePage,'sourcePage'),reference:required(r.reference,'verse reference'),sanskrit:required(r.sanskrit,'Sanskrit text'),transliteration:optional(r.transliteration),translation:optional(r.translation),explanation:optional(r.explanation),status:r.status==='uncertain'?'uncertain':'verified',reviewNote:optional(r.reviewNote)};
    if(!['verified','uncertain'].includes(String(r.status)))throw new Error('Verse status must be verified or uncertain.');
    if(!/[\u0900-\u097f]/u.test(verse.sanskrit))throw new Error(`Verse ${verse.id} needs Sanskrit in Devanagari.`);
    if(verse.status==='uncertain'&&!verse.reviewNote?.trim())throw new Error('Uncertain verses need a review note; never reconstruct missing words.');return verse;});
  return {format:SOURCE_PACKAGE_FORMAT,sourceImages,verses,extractionNotes:raw.extractionNotes.map(v=>required(v,'extraction note'))};
}
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const comparable=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
export function attachSourceBookManifest(result:ExternalManuscriptResult,manifest:SourceBookManifest):ExternalManuscriptResult {
  const sections=result.sections.map(s=>({...s,issues:[...s.issues]}));
  const section=(n:number)=>{if(!sections[n-1])throw new Error(`Source manifest section ${n} is not in this manuscript.`);return sections[n-1];};
  for(const verse of manifest.verses){const s=section(verse.sectionNumber);let marker=`<p>{{SLOKA:${verse.id}}}</p>`;
    const block=s.html.match(new RegExp(`<div data-source-verse-block="${verse.id}">([\\s\\S]*?)</div>`));
    if(block){if(comparable(block[1].replace(/<br>/g," "))!==comparable(escape(verse.sanskrit)))throw new Error(`Sanskrit block ${verse.id} does not match the source manifest. Review the source text.`);marker=block[0];}
    if(s.html.split(marker).length!==2)throw new Error(`Place one :::sloka ${verse.id} block in section ${verse.sectionNumber}.`);
    const html=`<section class="source-verse" data-source-verse="${verse.id}" data-source-page="${verse.sourcePage}" data-review-status="${verse.status}"><p class="verse-reference">${escape(verse.reference)}</p><p lang="sa" class="sanskrit-verse">${escape(verse.sanskrit).replace(/\r?\n/g,'<br>')}</p>${[['Transliteration',verse.transliteration],['Translation',verse.translation],['Explanation',verse.explanation]].filter(([,v])=>v).map(([label,v])=>`<p class="verse-${label!.toLowerCase()}"><strong>${label}:</strong> ${escape(v!)}</p>`).join('')}</section>`;
    s.html=s.html.replace(marker,html);if(verse.status==='uncertain')s.issues.push(`Verse ${verse.id} needs source review: ${verse.reviewNote}`);
  }
  for(const image of manifest.sourceImages)for(const placement of image.placements){const s=section(placement.sectionNumber);let hits=0;const anchorId=manifest.sourceImages.flatMap(i=>i.placements).find(p=>p.sectionNumber===placement.sectionNumber&&comparable(p.anchorText)===comparable(placement.anchorText))!.id;s.html=s.html.replace(/<(p|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g,(full,tag,attrs,body)=>{if(comparable(body)!==comparable(placement.anchorText))return full;hits++;if(attrs.includes(`data-book-anchor="${anchorId}"`))return full;return `<${tag}${attrs} data-book-anchor="${anchorId}">${body}</${tag}>`;});if(hits!==1)throw new Error(`Source image ${image.id}: anchorText must exactly match one paragraph or heading in section ${placement.sectionNumber}.`);}
  if(sections.some(s=>/\{\{SLOKA:|data-source-verse-block=/.test(s.html)))throw new Error('A verse marker has no source manifest entry.');
  sections.forEach(s=>{s.wordCount=comparable(s.html).split(/\s+/).filter(Boolean).length;});
  return {...result,sections,words:sections.reduce((sum,s)=>sum+s.wordCount,0),sourceManifest:manifest,issues:[...result.issues,...manifest.extractionNotes,...manifest.sourceImages.filter(i=>i.status==='unavailable').map(i=>`${i.id}: ${i.reason}`)]};
}
export function sourceImageSlots(manifest:SourceBookManifest,sections:{title:string}[]):ExternalIllustrationSlot[]{
  return manifest.sourceImages.flatMap(image=>image.status==='unavailable'?[]:image.placements.map((p,index)=>({id:p.id,sourceImageId:image.id,sourcePage:image.sourcePage,role:'chapter' as const,chapterId:p.sectionNumber,chapterTitle:sections[p.sectionNumber-1].title,filename:image.cleanedPath||image.originalPath!,sceneBrief:p.reason,altText:image.alt,caption:image.caption,imageIndex:100+index,placement:'chapter-middle' as const,anchorId:manifest.sourceImages.flatMap(i=>i.placements).find(a=>a.sectionNumber===p.sectionNumber&&comparable(a.anchorText)===comparable(p.anchorText))!.id,status:'pending' as const})));
}
export function sourceManifestContract(){return `SOURCE PACKAGE CONTRACT (private metadata, never reader prose)
Return a manuscript ZIP with numbered Markdown chapter files and source-manifest.json at its root. Keep notes only in the JSON, not extra Markdown files.
source-manifest.json must have this structure (replace examples with real source evidence):
{"format":"iks-source-assets-v1","sourceImages":[{"id":"SRC01","sourcePage":12,"originalPath":"source-images/SRC01.png","cleanedPath":"cleaned-source-images/SRC01.png","caption":"Accurate reader caption","alt":"Description of the actual source image","status":"available","placements":[{"id":"SRC01_P1","sectionNumber":2,"anchorText":"An exact full paragraph or heading from the returned manuscript.","reason":"Explain why this picture teaches the nearby concept."}]}],"verses":[{"id":"V01","sectionNumber":2,"sourcePage":15,"reference":"Actual work and verse number","sanskrit":"Exact source verse in Devanagari, with \\n between lines","transliteration":"Only if requested","translation":"Only if requested","explanation":"Only if requested","status":"verified"}],"extractionNotes":[]}
sectionNumber counts EVERY returned section in order, including introduction, conclusion and glossary, starting at 1. All image, placement and verse IDs must be unique. Use multiple placements with distinct IDs to reuse one relevant image in different passages. There is no one-source-image-per-chapter limit.
For each verse include the actual Sanskrit in the Markdown, at its relevant passage, using this block: a line :::sloka V01, followed by the exact Sanskrit lines, followed by a closing ::: line. The Sanskrit must match the manifest. The importer preserves that text and adds its reference and requested companions. Do not repeat the verse outside its block. Every declared verse needs exactly one block; legacy {{SLOKA:V01}} markers are also accepted.
If source words are unclear, retain only legible source text, set status:"uncertain" and reviewNote; never fill gaps from memory. If an image cannot be extracted, set status:"unavailable", give reason, omit both file paths and use placements:[]; never fabricate a replacement original. Unplaced extracted images use placements:[]. Omit cleanedPath when no actual cleaned file exists. Empty arrays are valid when the source has no relevant verses or images.
Put original image files in source-images/, cleaned copies in cleaned-source-images/ and normal generated illustrations in images/. Keep originals unchanged. These folders accompany the image ZIP; retain unplaced source images there. No URLs, SVGs or fake placeholders. Supported files: PNG, JPG, WebP. Return explicit extractionNotes for missing capabilities or incomplete coverage. If file creation is unavailable, explain that limitation instead of claiming a ZIP exists.`;}
