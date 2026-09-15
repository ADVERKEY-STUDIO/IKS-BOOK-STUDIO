import type { TemplateBook, TemplateId } from './template-book';
export type Draft = { id: string; templateId: TemplateId; title: string; language: string; source?: File; book?: TemplateBook; images: Record<string, Blob>; updated: number; cloud?: { email: string; revision: number; savedUpdated: number } };
export async function storage(mode: 'read' | 'write' | 'delete', value?: Draft): Promise<Draft[]> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('iks-template-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Book Studio tabs and retry saving.'));
  });
  return new Promise((resolve, reject) => {
    const tx = database.transaction('books', mode === 'read' ? 'readonly' : 'readwrite');
    const request = mode === 'read' ? tx.objectStore('books').getAll() : mode === 'delete' ? tx.objectStore('books').delete(value!.id) : tx.objectStore('books').put(value!);
    tx.oncomplete = () => { database.close(); resolve(mode === 'read' ? request.result as Draft[] : []); };
    tx.onerror = tx.onabort = () => { database.close(); reject(tx.error || new Error('Browser save was interrupted.')); };
  });
}
type Asset = { hash: string; type: string; name?: string };
export type CloudBook = Omit<Draft, 'source' | 'images' | 'cloud'> & { revision: number; source?: Asset; images: Record<string, Asset> };
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
    const existing = await assetRequest(path, { method: 'HEAD' }).catch(() => { throw new Error(`Connection interrupted while checking “${name}”. Retry saving.`); });
    if (existing.status === 404) {
      const response = await assetRequest(path, { method: 'PUT', body: blob }).catch(() => { throw new Error(`Upload interrupted for “${name}”. Retry saving; completed uploads will be reused.`); });
      if (!response.ok) throw new Error('Artwork could not be uploaded. Retry saving to resume.');
    } else if (!existing.ok) throw new Error('Could not check account artwork. Retry saving.');
    return { hash, type: blob.type || 'image/png' };
  }
  const images: Record<string, Asset> = {};
  for (const [name, blob] of Object.entries(draft.images)) images[name] = await upload(blob, name);
  const source = draft.source ? { ...await upload(draft.source, draft.source.name), type: draft.source.type, name: draft.source.name } : undefined;
  const response = await cloudRequest('/api/library/books', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, images, source, cloud: undefined, revision: draft.cloud?.email === email ? draft.cloud.revision : 0 }) });
  const { revision } = await response.json();
  return { ...draft, cloud: { email, revision, savedUpdated: draft.updated } };
}
export async function downloadDraft(book: CloudBook, email: string): Promise<Draft> {
  async function get(asset: Asset) { const response = await cloudRequest(`/api/library/asset?hash=${asset.hash}`); return new Blob([await response.arrayBuffer()], { type: asset.type }); }
  const images: Record<string, Blob> = {};
  for (const [name, asset] of Object.entries(book.images)) images[name] = await get(asset);
  const source = book.source ? new File([await get(book.source)], book.source.name || 'source.pdf', { type: book.source.type }) : undefined;
  return { ...book, images, source, cloud: { email, revision: book.revision, savedUpdated: book.updated } };
}
