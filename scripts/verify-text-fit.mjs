import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readTemplateArchive} from '../lib/template-archive.ts';
import {parseTemplateBook,renderTemplateBook} from '../lib/template-book.ts';
import {fitTextPositions} from '../lib/text-placement.ts';
import {blueprintFor,plannedTextBlocks} from '../lib/template-layouts.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const files=readTemplateArchive(fs.readFileSync(process.argv[2]));
const book=parseTemplateBook(JSON.parse(new TextDecoder().decode(files['book.json'])));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 const render=async b=>{await page.setContent(renderTemplateBook(b,{},'http://127.0.0.1:5173/fonts/book-sanskrit.ttf'));await page.evaluate(()=>document.fonts.ready);};
 const overflow=()=>page.locator('.planned-text').evaluateAll(es=>es.filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).length);
 await render(book);const before=await overflow();assert.ok(before>0,'fixture must reproduce overflow');
 const boxes=book.pages.map(p=>plannedTextBlocks(p,blueprintFor(book,p)).map(({x,y,w,h})=>({x,y,w,h})));
 const positions=await page.evaluate(({source,boxes})=>{const fit=eval('('+source+')');return [...document.querySelectorAll('.planned-spread')].map((s,i)=>fit(s,boxes[i]));},{source:fitTextPositions.toString(),boxes});
 const next=parseTemplateBook({...book,pages:book.pages.map((p,i)=>({...p,textPositions:positions[i]}))});
 await render(next);assert.equal(await overflow(),0);
 assert.deepEqual(next.pages.map(p=>[p.original,p.meaning,p.fontSize]),book.pages.map(p=>[p.original,p.meaning,p.fontSize]));
 console.log({before,after:0,sourceAndFontPreserved:true});
}finally{await browser.close();}
