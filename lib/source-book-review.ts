import type { SourceBookManifest, SourceArchiveAsset, SourceImage, SourceVerse } from './source-book-package';
export type SourceBookReview = {
  images: Record<string,{signature:string;variant:'original'|'cleaned';approvedAt:string}>;
  verses: Record<string,{signature:string;sourceText:string;sourceFile:string;method:'pdf-text'|'manual';approvedAt:string}>;
};
export type SourceReviewProject = {sourceManifest?:SourceBookManifest;sourceAssets?:SourceArchiveAsset[];sourceReview?:SourceBookReview};
export const normalizeVerseText=(text:string)=>text.normalize('NFC').replace(/\s+/gu,'');
export function compareSourceVerse(verse:string,sourceText:string){
  const expected=normalizeVerseText(verse),actual=normalizeVerseText(sourceText);
  return Boolean(expected && actual.includes(expected));
}
export function sourceImageSignature(image:SourceImage,assets:SourceArchiveAsset[]=[]){return JSON.stringify([image,assets.filter(a=>a.path===image.originalPath||a.path===image.cleanedPath).map(a=>[a.path,a.key,a.url]).sort()]);}
export function sourceVerseSignature(verse:SourceVerse){return JSON.stringify(verse);}
export function sourceReviewIssues(project:SourceReviewProject){
  const issues:{id:string;kind:'image'|'verse';message:string}[]=[];
  for(const image of project.sourceManifest?.sourceImages??[]){
    if(image.status==='unavailable'){issues.push({id:image.id,kind:'image',message:`${image.id}: source image unavailable — ${image.reason}`});continue;}
    if(!image.placements.length)continue;
    const review=project.sourceReview?.images?.[image.id];
    if(!review||review.signature!==sourceImageSignature(image,project.sourceAssets))issues.push({id:image.id,kind:'image',message:`${image.id}: review source fidelity and placement relevance.`});
  }
  for(const verse of project.sourceManifest?.verses??[]){
    const review=project.sourceReview?.verses?.[verse.id];
    if(!review||review.signature!==sourceVerseSignature(verse)||!compareSourceVerse(verse.sanskrit,review.sourceText))issues.push({id:verse.id,kind:'verse',message:`${verse.id}: compare the Sanskrit with source page ${verse.sourcePage}${verse.status==='uncertain'?` — ${verse.reviewNote}`:''}.`});
  }
  return issues;
}
/** Inspect live edited pages as well as imports; approvals never hide later edits. */
export function inspectRenderedSourceVerses(roots:HTMLElement[],manifest?:SourceBookManifest){
  const issues:{id:string;message:string}[]=[];
  for(const verse of manifest?.verses??[]){
    const blocks=roots.flatMap(root=>Array.from(root.querySelectorAll<HTMLElement>('[data-source-verse]')).filter(n=>n.dataset.sourceVerse===verse.id));
    if(blocks.length!==1){issues.push({id:verse.id,message:`${verse.id}: verse is missing or duplicated in the current pages.`});continue;}
    for(const [field,value] of [['reference',verse.reference],['transliteration',verse.transliteration],['translation',verse.translation],['explanation',verse.explanation]]){
      const companion=blocks[0].querySelector(`.verse-${field}`)?.cloneNode(true) as HTMLElement|undefined;
      if(field!=='reference')companion?.querySelector('strong')?.remove();
      if(normalizeVerseText(companion?.textContent??'')!==normalizeVerseText(value??''))issues.push({id:verse.id,message:`${verse.id}: the ${field} differs from the reviewed source details.`});
    }
    const node=blocks[0].querySelector<HTMLElement>('.sanskrit-verse');
    const copy=node?.cloneNode(true) as HTMLElement|undefined;
    copy?.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));
    const text=copy?.textContent??'';
    if(normalizeVerseText(text)!==normalizeVerseText(verse.sanskrit))issues.push({id:verse.id,message:`${verse.id}: edited Sanskrit differs from the imported source text.`});
    if(node && node.querySelectorAll('br').length!==verse.sanskrit.split(/\r?\n/).length-1)issues.push({id:verse.id,message:`${verse.id}: source verse line breaks have changed.`});
    if(node && !getComputedStyle(node).fontFamily.includes('Book Sanskrit'))issues.push({id:verse.id,message:`${verse.id}: the Sanskrit typeface has been overridden.`});
  }
  return issues;
}

export function inspectRenderedSourceImages(roots:HTMLElement[],project:SourceReviewProject){
  const issues:{id:string;message:string}[]=[];
  for(const image of project.sourceManifest?.sourceImages??[]){
    if(image.status==='unavailable')continue;
    const review=project.sourceReview?.images?.[image.id];
    const asset=review && project.sourceAssets?.find(a=>a.path===(review.variant==='original'?image.originalPath:image.cleanedPath));
    for(const placement of image.placements){
      const nodes=roots.flatMap(root=>Array.from(root.querySelectorAll<HTMLImageElement>('img[data-illustration-slot]')).filter(n=>n.dataset.illustrationSlot===placement.id));
      if(nodes.length!==1)issues.push({id:placement.id,message:`${placement.id}: source image placement is missing or duplicated.`});
      else if(asset && nodes[0].src!==new URL(asset.url,nodes[0].baseURI).href)issues.push({id:placement.id,message:`${placement.id}: the current image differs from the approved source version.`});
    }
  }
  return issues;
}
