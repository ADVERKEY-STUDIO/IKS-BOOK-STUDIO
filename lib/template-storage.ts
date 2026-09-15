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
export async function uploadDraft(draft: Draft, email: string): Promise<Draft> {
  async function upload(blob: Blob): Promise<Asset> {
    const bytes = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
    await cloudRequest(`/api/library/asset?hash=${hash}`, { method: 'PUT', body: bytes });
    return { hash, type: blob.type || 'image/png' };
  }
  const images: Record<string, Asset> = {};
  for (const [name, blob] of Object.entries(draft.images)) images[name] = await upload(blob);
  const source = draft.source ? { ...await upload(draft.source), type: draft.source.type, name: draft.source.name } : undefined;
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
