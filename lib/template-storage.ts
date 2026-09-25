import {SOURCE_CHUNK_BYTES,validateSourceFile} from './template-capacity.ts';
import type { VisualDirection } from './visual-direction';
import type { TemplateBook, TemplateId } from './template-book';
export type Draft = { id: string; templateId: TemplateId; title: string; language: string; source?: File; visualDirection?: VisualDirection; references?: Record<string, Blob>; book?: TemplateBook; images: Record<string, Blob>; updated: number; cloud?: { email: string; revision: number; savedUpdated: number } };
let persistenceRequest:Promise<boolean>|undefined;
export function requestPersistentStorage(){
 if(typeof navigator==='undefined'||!navigator.storage?.persist)return Promise.resolve(false);
 return persistenceRequest ??= navigator.storage.persisted().then(saved=>saved||navigator.storage.persist()).catch(()=>false);
}
export async function storage(mode: 'read' | 'write' | 'delete', value?: Draft): Promise<Draft[]> {
  if(mode==='write')void requestPersistentStorage();
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('iks-template-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Book Studio tabs and retry saving.'));
  });
  return new Promise((resolve, reject) => {
    const tx = database.transaction('books', mode === 'read' ? 'readonly' : 'readwrite');
    const store=tx.objectStore('books');
    const request = mode === 'read' ? store.getAll() : mode === 'delete' ? store.delete(value!.id) : store.get(value!.id);
    let saveError:Error|undefined;
    if(mode==='write')request.onsuccess=()=>{
      const previous=request.result as Draft|undefined;
      const used=new Set(value!.book?.pages.map(page=>page.image)||Object.keys(previous?.images||{}));
      if(previous && previous.updated>value!.updated)saveError=Error('A newer browser copy exists. Reopen it before saving from this tab.');
      else if(previous?.book&&!value!.book)saveError=Error('This copy is missing the saved manuscript. Reopen the saved book before overwriting it.');
      else if(previous&&Object.keys(previous.images).some(name=>used.has(name)&&!Object.hasOwn(value!.images,name)))saveError=Error('This copy is missing saved artwork. Reopen the saved book before overwriting it.');
      if(saveError){tx.abort();return;}
      store.put(value!);
    };
    tx.oncomplete = () => { database.close(); resolve(mode === 'read' ? request.result as Draft[] : []); };
    tx.onerror = tx.onabort = () => { database.close(); reject(saveError || tx.error || new Error('Browser save was interrupted.')); };
  });
}
type Asset = { hash: string; type: string; name?: string };
export type CloudBook = Omit<Draft, 'source' | 'images' | 'references' | 'cloud'> & { revision: number; source?: Asset | {chunks:Asset[];name:string;type:string}; references?: Record<string, Asset>; images: Record<string, Asset> };
export async function cloudRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Cloud library is unavailable. Your browser copy is still here.'); }
  return response;
}
// Cache hashes by immutable Blob identity, without retaining discarded artwork.
const assetHashes = new WeakMap<Blob, Promise<string>>();
async function assetRequest(path: string, options: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try { response = await fetch(path, options); }
    catch (error) {
      if (attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      continue;
    }
    if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      continue;
    }
    return response;
  }
}
export async function uploadDraft(draft: Draft, email: string): Promise<Draft> {
  async function upload(blob: Blob, name: string): Promise<Asset> {
    let hashing = assetHashes.get(blob);
    if (!hashing) {
      hashing = blob.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes)).then(hash => Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join(''));
      assetHashes.set(blob, hashing);
      void hashing.catch(() => assetHashes.delete(blob));
    }
    let hash: string;
    try { hash = await hashing; } catch { throw new Error(`“${name}” could not be read from browser storage. Re-add this file from your original ZIP or image, then save again. Keep this tab open until you have recovered the book.`); }
    const path = `/api/library/asset?hash=${hash}`;
    // The server checks existence within the authenticated account, never globally.
    const existing = await assetRequest(path, { method: 'HEAD', headers:{'x-library-account':email} }).catch(() => { throw new Error(`Connection interrupted while checking “${name}”. Retry saving.`); });
    if (existing.status === 404) {
      const response = await assetRequest(path, { method: 'PUT', body: blob, headers:{'x-library-account':email} }).catch(() => { throw new Error(`Upload interrupted for “${name}”. Retry saving; completed uploads will be reused.`); });
      if (!response.ok) throw new Error('Artwork could not be uploaded. Retry saving to resume.');
    } else if (!existing.ok) throw new Error('Could not check account artwork. Retry saving.');
    return { hash, type: blob.type || 'image/png' };
  }
  const images: Record<string, Asset> = {};
  for (const [name, blob] of Object.entries(draft.images)) images[name] = await upload(blob, name);
  const references: Record<string, Asset> = {};
  for (const [name, blob] of Object.entries(draft.references || {})) references[name] = await upload(blob, name);
  let source:CloudBook['source'];
  if(draft.source){
    validateSourceFile(draft.source);
    if(draft.source.size>SOURCE_CHUNK_BYTES){
      const chunks:Asset[]=[];
      for(let offset=0;offset<draft.source.size;offset+=SOURCE_CHUNK_BYTES)chunks.push(await upload(draft.source.slice(offset,offset+SOURCE_CHUNK_BYTES),`${draft.source.name} part ${chunks.length+1}`));
      source={chunks,name:draft.source.name,type:draft.source.type};
    }else source={...await upload(draft.source,draft.source.name),name:draft.source.name,type:draft.source.type};
  }
  const response = await cloudRequest('/api/library/books', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-library-account':email }, body: JSON.stringify({ ...draft, images, references, source, cloud: undefined, revision: draft.cloud?.email === email ? draft.cloud.revision : 0 }) });
  const { revision } = await response.json();
  return { ...draft, cloud: { email, revision, savedUpdated: draft.updated } };
}
export async function downloadDraft(book: CloudBook, email: string): Promise<Draft> {
  async function get(asset: Asset) {
    const response = await assetRequest(`/api/library/asset?hash=${asset.hash}`,{headers:{'x-library-account':email}});
    if(!response.ok)throw Error('An account file could not be restored. Retry opening the book; the saved copy has not been changed.');
    const bytes=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==asset.hash)throw Error('An account file failed its integrity check. Retry opening the book; no damaged copy was saved.');
    return new Blob([bytes],{type:asset.type});
  }
  const images: Record<string, Blob> = {};
  for (const [name, asset] of Object.entries(book.images)) images[name] = await get(asset);
  const references: Record<string, Blob> = {};
  for (const [name, asset] of Object.entries(book.references || {})) references[name] = await get(asset);
  let source:File|undefined;
  if(book.source){const parts:Blob[]=[];for(const asset of ('chunks' in book.source?book.source.chunks:[book.source]))parts.push(await get(asset));source=new File(parts,book.source.name||'source.pdf',{type:book.source.type});}

  return { ...book, images, references, source, cloud: { email, revision: book.revision, savedUpdated: book.updated } };
}
