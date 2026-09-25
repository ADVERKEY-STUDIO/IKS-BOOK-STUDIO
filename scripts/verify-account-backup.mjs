/** Local browser integration with an in-memory account API; no real sign-in or account writes. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.IKS_LOCAL_URL||'http://127.0.0.1:5187';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use a local app.');
const browser=await chromium.launch({headless:true});
const objects=new Map();let saved,fail=false,stubbed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/app/components/account-panel.tsx*',async route=>{
  const response=await route.fetch(),body=await response.text();
  const needle='function AccountPanel(props) {';
  if(!body.includes(needle))throw Error('Account test seam changed');
  stubbed=true;
  await route.fulfill({response,body:body.replace(needle,needle+' useEffect(()=>{props.onSession?.("backup-test@example.com")},[props.onSession]);')});
 });
 await page.route('**/api/library/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/books')){
   if(req.method()==='GET')return route.fulfill({json:{books:saved?[saved]:[]}});
   if(fail)return route.fulfill({status:503,json:{error:'Simulated offline account'}});
   const body=req.postDataJSON();assert.equal(body.revision,saved?.revision||0);
   saved={...body,revision:body.revision+1,updated:Date.now()};return route.fulfill({json:{revision:saved.revision}});
  }
  const hash=url.searchParams.get('hash');
  if(req.method()==='PUT'){objects.set(hash,req.postDataBuffer());return route.fulfill({json:{hash}});}
  if(req.method()==='HEAD')return route.fulfill({status:objects.has(hash)?200:404,body:''});
  return route.fulfill({body:objects.get(hash),contentType:'application/octet-stream'});
 });
 await page.goto(origin+'/template-studio');await page.getByText('Loading…',{exact:true}).waitFor({state:'hidden'});
 await page.evaluate(async()=>{
  const {storage}=await import('/lib/template-storage.ts');
  const book={format:'iks-template-book-v1',projectId:'backup-test',templateId:'panorama',title:'Auto backup',language:'English',characterGuide:'',pages:[{id:'p1',title:'Page',original:'Keep these words',meaning:'',sourceReference:'Test',scene:'Test',image:'page.png',layout:'panorama',fontSize:22,imageScale:100}]};
  await storage('write',{id:'backup-test',templateId:'panorama',title:book.title,language:'English',book,updated:Date.now(),images:{'page.png':new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0))],{type:'image/png'})}});
 });
 await page.goto(origin+'/template-studio?book=backup-test');
 await page.getByText('Account backup is up to date, including imported images.',{exact:true}).waitFor();
 assert.ok(stubbed);assert.equal(objects.size,1);assert.ok(saved.images['page.png']);
 const backupResponse=page.waitForResponse(response=>response.url().endsWith('/api/library/books')&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Back up all browser books',exact:true}).click();await backupResponse;
 await page.waitForFunction(()=>!document.querySelector('main fieldset').disabled);assert.equal(saved.revision,2);
 // Simulate browser eviction, then open the same bookmarked book from the account.
 await page.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('iks-template-studio',1);q.onsuccess=()=>{const tx=q.result.transaction('books','readwrite');tx.objectStore('books').clear();tx.oncomplete=()=>{q.result.close();resolve()}}}));
 await page.reload();await page.getByText('Account backup is up to date, including imported images.',{exact:true}).waitFor();
 await page.waitForFunction(async()=>{const {storage}=await import('/lib/template-storage.ts');return (await storage('read')).some(b=>b.id==='backup-test'&&b.images['page.png']?.size>0)});
 // Simulate loss of just the local image map while retaining a synchronized marker.
 await page.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('iks-template-studio',1);q.onsuccess=()=>{const tx=q.result.transaction('books','readwrite'),store=tx.objectStore('books'),get=store.get('backup-test');get.onsuccess=()=>store.put({...get.result,images:{}});tx.oncomplete=()=>{q.result.close();resolve()}}}));
 await page.reload();await page.waitForFunction(async()=>{const {storage}=await import('/lib/template-storage.ts');return (await storage('read')).some(b=>b.images['page.png']?.size>0)});
 fail=true;
 await page.getByRole('button',{name:'2. Source & prompt',exact:true}).click();
 await page.getByLabel('Book title',{exact:true}).fill('Offline edit preserved');
 await page.getByText(/Account backup needs attention: Simulated offline account/).waitFor();
 const restored=await page.evaluate(async()=>{const {storage}=await import('/lib/template-storage.ts');const draft=(await storage('read'))[0];return {title:draft.title,image:draft.images['page.png'].size,text:draft.book.pages[0].original}});
 assert.equal(restored.title,'Offline edit preserved');assert.ok(restored.image>0);assert.equal(restored.text,'Keep these words');
 assert.deepEqual(errors,[]);
 console.log('Automatic image backup, browser eviction recovery, image-only recovery, and offline local preservation passed.');
}finally{await browser.close()}
