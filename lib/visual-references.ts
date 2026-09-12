import type { Edition } from './devotional-edition.ts';

export const referenceKinds = ['character','environment','object'] as const;
export const referenceViews = ['front','side','three-quarter','expression','pose','environment','detail'] as const;
export const referenceSpecFields = ['name','role','features','proportions','clothing','ornaments','colors','objects','poses','expressions','culturalNotes'] as const;
export type ReferenceSpec = Record<typeof referenceSpecFields[number],string> & { kind: typeof referenceKinds[number] };
export type ReferenceImage = { id:string; key:string; name:string; mime:string; width:number; height:number; view:typeof referenceViews[number]; caption:string; credit:string; provenance:'uploaded'|'external-generation'; uploadedAt:string };
export type ReferenceVersion = { version:number; spec:ReferenceSpec; images:ReferenceImage[]; artGuideVersion:number; createdAt:string; reason:string; approvedAt?:string };
export type VisualReference = { id:string; versions:ReferenceVersion[]; approvedVersion?:number; archived?:boolean };
export type ReferenceAction =
 | { type:'save-reference'; id?:string; spec:ReferenceSpec; imageIds:string[]; reason:string }
 | { type:'approve-reference'; id:string; version:number }
 | { type:'archive-reference'; id:string; archived:boolean }
 | { type:'reference-image'; id:string; image:ReferenceImage };
export function emptyReferenceSpec():ReferenceSpec { return {kind:'character',name:'',role:'',features:'',proportions:'',clothing:'',ornaments:'',colors:'',objects:'',poses:'',expressions:'',culturalNotes:''}; }
export function approvedReference(ref:VisualReference):ReferenceVersion|undefined { return ref.versions.find(v=>v.version===ref.approvedVersion); }
export function validateReferenceSpec(value:ReferenceSpec):ReferenceSpec {
 if(!value||!referenceKinds.includes(value.kind))throw new Error('Choose character, environment, or object.');
 const spec=emptyReferenceSpec();spec.kind=value.kind;
 for(const key of referenceSpecFields){if(typeof value[key]!=='string'||value[key].length>3000)throw new Error(`${key} must contain at most 3,000 characters.`);spec[key]=value[key];}
 for(const key of ['name','role','features','colors','culturalNotes'] as const)if(!spec[key].trim())throw new Error(`Complete ${key} before saving the reference.`);
 return spec;
}
export function applyReferenceAction(edition:Edition,action:ReferenceAction,guideVersion:number,guideApproved:boolean,at:string,makeId:()=>string):void {
 const refs=edition.visualReferences ||= [];
 const get=(id:string)=>{const ref=refs.find(r=>r.id===id);if(!ref)throw new Error('Reference no longer exists. Reload the book.');return ref;};
 const append=(ref:VisualReference,spec:ReferenceSpec,images:ReferenceImage[],reason:string)=>{
  if(ref.archived)throw new Error('Restore this reference before revising it.');
  if(ref.versions.length>=100)throw new Error('This reference has reached 100 versions.');
  if(images.length>12)throw new Error('Keep at most 12 images in one reference version.');
  ref.versions.push({version:(ref.versions.at(-1)?.version||0)+1,spec,images:structuredClone(images),artGuideVersion:guideVersion,createdAt:at,reason});
 };
 if(action.type==='save-reference'){
  if(typeof action.reason!=='string'||!action.reason.trim()||action.reason.length>2000)throw new Error('Add a revision note of at most 2,000 characters.');
  const spec=validateReferenceSpec(action.spec);
  let ref=action.id?get(action.id):undefined;
  if(!Array.isArray(action.imageIds)||action.imageIds.length>12||new Set(action.imageIds).size!==action.imageIds.length)throw new Error('Choose up to 12 different reference images.');
  const known=ref?.versions.flatMap(v=>v.images)||[];
  const images=action.imageIds.map(id=>{const image=known.find(i=>i.id===id);if(!image)throw new Error('The selected image does not belong to this reference.');return image;});
  if(!ref){if(refs.length>=100)throw new Error('This book has reached 100 reference entries.');ref={id:makeId(),versions:[]};refs.push(ref);}
  append(ref,spec,images,action.reason);
 }else if(action.type==='reference-image'){
  const ref=get(action.id),previous=ref.versions.at(-1);
  if(!previous)throw new Error('Save the reference details before uploading images.');
  const image=action.image;
  if(!referenceViews.includes(image.view)||!['uploaded','external-generation'].includes(image.provenance))throw new Error('Choose a valid view and image origin.');
  for(const key of ['caption','credit'] as const)if(typeof image[key]!=='string'||!image[key].trim()||image[key].length>2000)throw new Error(`Provide ${key} of at most 2,000 characters.`);
  append(ref,structuredClone(previous.spec),[...previous.images,image],`Added ${image.view}: ${image.caption}`);
 }else if(action.type==='approve-reference'){
  const ref=get(action.id),version=ref.versions.at(-1);
  if(ref.archived||!version||version.version!==action.version)throw new Error('Only the latest active draft can be approved.');
  if(!guideApproved||version.artGuideVersion!==guideVersion)throw new Error('Approve the current art guide and save a reviewed reference version against it first.');
  if(!version.images.length)throw new Error('Add at least one reference image before approval.');
  validateReferenceSpec(version.spec);version.approvedAt ||= at;ref.approvedVersion=version.version;
 }else if(action.type==='archive-reference'){
  if(typeof action.archived!=='boolean')throw new Error('Choose a valid archive state.');get(action.id).archived=action.archived;
 }
}
export function referenceManifest(edition:Edition,guideVersion:number):{id:string;version:number;spec:ReferenceSpec;images:ReferenceImage[]}[]{
 return (edition.visualReferences||[]).filter(r=>!r.archived).map(ref=>{
  const version=approvedReference(ref);
  if(!version)throw new Error(`Approve ${ref.versions.at(-1)?.spec.name||'the reference'} or archive it before production.`);
  if(version.artGuideVersion!==guideVersion)throw new Error(`Review ${version.spec.name} against art guide ${guideVersion} before production.`);
  return {id:ref.id,version:version.version,spec:version.spec,images:version.images};
 });
}
export function referenceProductionBrief(edition:Edition,guideVersion:number):string {
 const refs=referenceManifest(edition,guideVersion);
 if(!refs.length)return '';
 return `\n\nAPPROVED VISUAL REFERENCES\n${refs.map(ref=>`REFERENCE ${ref.id} — VERSION ${ref.version}\n${referenceSpecFields.map(k=>`${k}: ${ref.spec[k]}`).join('\n')}\nImages:\n${ref.images.map(i=>`${i.id} (${i.view}, ${i.width}×${i.height}): ${i.caption}; credit: ${i.credit}`).join('\n')}`).join('\n\n')}\n\nUse these exact approved versions. Match identifying features, proportions, attire, ornaments and palette. A new scene or pose does not authorize changing the approved identity. If the scene needs a conflicting attribute, request editorial review. Compare each result against the included images before acceptance.`;
}
/** Metadata checks on supported raster formats, without trusting a supplied filename or MIME type. */
export function inspectReferenceImage(bytes:Uint8Array):{mime:string;extension:string;width:number;height:number}{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0,mime='',extension='';
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){width=view.getUint32(16);height=view.getUint32(20);mime='image/png';extension='png';}
 else if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216){
  mime='image/jpeg';extension='jpg';let at=2;
  while(at+4<bytes.length){if(bytes[at]!==255){at++;continue;}const marker=bytes[at+1];if(marker===216||marker===217){at+=2;continue;}if(marker===218)break;const length=view.getUint16(at+2);if(length<2||at+2+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=view.getUint16(at+5);width=view.getUint16(at+7);break;}at+=length+2;}
 }else if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
  mime='image/webp';extension='webp';const kind=String.fromCharCode(...bytes.slice(12,16));
  if(kind==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
  else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
  else if(kind==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
 }
 if(!width||!height||width>20000||height>20000||width*height>64000000)throw new Error('Use a valid PNG, JPEG, or WebP image up to 64 megapixels.');
 return {mime,extension,width,height};
}
