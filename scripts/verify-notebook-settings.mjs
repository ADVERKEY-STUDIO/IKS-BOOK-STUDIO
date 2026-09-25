/** Run against a local app; seeds only an isolated test browser's IndexedDB. */
import assert from 'node:assert/strict';
import {inspectRenderedBook} from '../lib/template-layouts.ts';
import {renderLayoutSample} from '../lib/template-layout-sample.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.IKS_LOCAL_URL||'http://127.0.0.1:5186';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use a local app.');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto(origin+'/template-studio');
 await page.getByText('Loading…',{exact:true}).waitFor({state:'hidden'});
 await page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('iks-template-studio',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('books','readwrite');tx.objectStore('books').put({id:'notebook-settings-test',templateId:'iks-notes',title:'Notebook settings test',language:'English',images:{},source:new File(['Test source'],'source.pdf'),updated:Date.now()});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};}));
 await page.goto(origin+'/template-studio?book=notebook-settings-test');
 const count=page.getByRole('spinbutton',{name:'Number of content pages'});
 await count.fill('20');await page.getByRole('combobox',{name:'Notebook content'}).selectOption('summary');
 const prompt=page.locator('.ts-source textarea[readonly]');
 await page.waitForFunction(()=>document.querySelector('.ts-source textarea[readonly]')?.value.includes('Exactly 20 content pages'));
 assert.match(await prompt.inputValue(),/SELECTED CONTENT MODE: DETAILED SUMMARY/);
 await page.getByRole('button',{name:'Save book now',exact:true}).click();
 await page.reload();await count.waitFor();assert.equal(await count.inputValue(),'20');
 assert.equal(await page.getByRole('combobox',{name:'Notebook content'}).inputValue(),'summary');
 await count.fill('');await page.waitForFunction(()=>document.querySelector('.ts-source textarea[readonly]')?.value.includes('PAGE COUNT: Automatic'));
 await page.getByRole('combobox',{name:'Notebook content'}).selectOption('full');
 assert.match(await prompt.inputValue(),/SELECTED CONTENT MODE: FULL BOOK/);
 const proof=await browser.newPage({viewport:{width:700,height:1050}});
 await proof.goto(origin);await proof.setContent(renderLayoutSample('iks-notes','reference-notes-dense-examples'));
 await proof.evaluate(()=>document.fonts.ready);
 const check=inspectRenderedBook.toString();
 const warnings=await proof.evaluate(source=>new Function('doc',`return (${source})(doc)`)(document),check);
 assert.ok(warnings.some(w=>/sparse section/.test(w)),'detects underfilled sections in a real browser');
 await proof.locator('.original').evaluateAll(els=>els.forEach(e=>{e.style.height='auto'}));
 const compact=await proof.evaluate(source=>new Function('doc',`return (${source})(doc)`)(document),check);
 assert.ok(!compact.some(w=>/sparse/.test(w)),'does not flag a region fitted to its text');
 console.log('Page count + mode update, save/reload, Automatic reset, and rendered density warnings passed.');
}finally{await browser.close();}
