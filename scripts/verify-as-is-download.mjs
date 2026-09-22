import assert from 'node:assert/strict';
import {planTemplateBook} from '../lib/template-layouts.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/template-studio');await page.getByText('Loading…',{exact:true}).waitFor({state:'hidden'});
 const book=planTemplateBook({format:'iks-template-book-v1',projectId:'as-is-download-test',templateId:'beanstalk-adventure',title:'Overflow export test',language:'English',characterGuide:'Test',pages:[{id:'spread-1',title:'Test',original:'Preserve every word. '.repeat(200),meaning:'Test',sourceReference:'Test',scene:'Test',image:'spread.png',layout:'story-scene',fontSize:16,imageScale:100}]});
 await page.evaluate(async book=>{const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#fffbed';ctx.fillRect(0,0,2000,1000);const blob=await new Promise(r=>canvas.toBlob(r));await new Promise((resolve,reject)=>{const q=indexedDB.open('iks-template-studio',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('books','readwrite');tx.objectStore('books').put({id:book.projectId,templateId:book.templateId,title:book.title,language:book.language,book,images:{'spread.png':blob},updated:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);};});},book);
 await page.goto('http://127.0.0.1:5173/template-studio?book=as-is-download-test');await page.getByRole('button',{name:'Read book',exact:true}).click();
 await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.getByRole('dialog',{name:'Book reading preview'}).getByRole('alert').filter({hasText:'text overflow'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download as-is',exact:true}).click();const file=await download;assert.ok(file.suggestedFilename().endsWith('.pdf'));assert.equal(await file.failure(),null);
 console.log({normalExportBlocked:true,asIsDownloadSucceeded:true});
}finally{await browser.close();}
