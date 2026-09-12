import type { Edition } from './devotional-edition.ts';
import { editionImages } from './art-production.ts';
export const BACKUP_LIMIT=40*1024*1024;
export type BackupManifest={format:'iks-edition-backup';version:1;revision:number;createdAt:string;project:{title:string;source:string;edition:Edition};assets:{key:string;path:string;mime:string;sha256:string;size:number}[]};
export const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(b=>b.toString(16).padStart(2,'0')).join('');
/** Only registered edition assets, never external inspiration URLs or project-level previews. */
export function backupKeys(e:Edition):string[]{return [...new Set([...e.sources.map(s=>s.key),...editionImages(e).map(i=>i.key),...(e.artProduction?.requests||[]).flatMap(r=>r.referenceImages.map(i=>i.key))])];}
export function restoredEdition(e:Edition,keys:Map<string,string>):Edition {
 const remap=(v:unknown,field=''):unknown=>typeof v==='string'?(['key','imageKey'].includes(field)?keys.get(v)||v:v):Array.isArray(v)?v.map(item=>remap(item)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,val])=>[k,remap(val,k)])):v;
 const copy=remap(e) as Edition;
 // A restored archive is historical evidence, never a fresh sign-off. Preserve records but stale their contexts.
 if(copy.bookReview){if(copy.bookReview.render)copy.bookReview.render.context='restored: review required';for(const d of copy.bookReview.decisions)d.context='restored: review required';for(const h of copy.bookReview.human)h.context='restored: review required';}
 if(copy.bookProduction)for(const r of copy.bookProduction.reviews)r.context='restored: review required';
 copy.revision=1;
 return copy;
}
