/** Local-only IndexedDB regression: uses a fresh isolated browser profile. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.IKS_LOCAL_URL||'http://127.0.0.1:5187';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use a local app.');
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(origin+'/template-studio');
 const result=await page.evaluate(async()=>{
  const {storage}=await import('/lib/template-storage.ts');
  const draft={id:'persistence-test',templateId:'panorama',title:'Imported book',language:'English',updated:100,images:{'page.png':new Blob(['persistent artwork'],{type:'image/png'})},book:{pages:[{image:'page.png',original:'Preserve these words'}]}};
  await storage('write',draft);
  const rejected=[];
  for(const damaged of [{...draft,updated:99,title:'Stale tab'},{...draft,updated:101,images:{}},{...draft,updated:101,book:undefined}]){
   try{await storage('write',damaged);rejected.push(false)}catch{rejected.push(true)}
  }
  const saved=(await storage('read')).find(b=>b.id===draft.id);
  return {rejected,text:await saved.images['page.png'].text(),title:saved.title};
 });
 assert.deepEqual(result,{rejected:[true,true,true],text:'persistent artwork',title:'Imported book'});
 await page.reload();
 const reopened=await page.evaluate(async()=>{const {storage}=await import('/lib/template-storage.ts');const draft=(await storage('read')).find(b=>b.id==='persistence-test');return {image:await draft.images['page.png'].text(),text:draft.book.pages[0].original}});
 assert.deepEqual(reopened,{image:'persistent artwork',text:'Preserve these words'});
 console.log('IndexedDB retains image bytes across reload and rejects stale/incomplete overwrites.');
}finally{await browser.close()}
