import type { CatalogueState } from './iks-catalogue';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('iks-source-catalogue', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catalogue');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function catalogueStorage(value?: CatalogueState): Promise<CatalogueState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('catalogue', value ? 'readwrite' : 'readonly');
    const request = value ? tx.objectStore('catalogue').put(value, 'current') : tx.objectStore('catalogue').get('current');
    tx.oncomplete = () => { db.close(); resolve(value || request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Catalogue storage failed')); };
  });
}
