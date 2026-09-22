import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {zipSync,unzipSync,strToU8} from 'fflate';
const require=createRequire(import.meta.url),appUrl=process.env.IKS_APP_URL;
test('reference-first ChatGPT handoff, approval, resume, import and individual image paste',{skip:!appUrl,timeout:120000},async()=>{
 const {chromium}=require(process.env.IKS_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${appUrl}/template-studio`);
 await page.getByText('Your books will appear here. Saved on this browser; download a ZIP for backup.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Start with visual references',exact:true}).click();
 await page.getByLabel('Upload visual references').waitFor();
 assert.equal(await page.locator('.children-gallery').count(),0);
 const buffer=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=100;c.getContext('2d').fillRect(0,0,240,100);return c.toDataURL().split(',')[1];}),'base64');
 const image={name:'reference.png',mimeType:'image/png',buffer};
 await page.getByLabel('Upload visual references').setInputFiles(image);
 await page.getByRole('button',{name:'Remove visual reference 1',exact:true}).waitFor();
 async function request(name){const wait=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return unzipSync(new Uint8Array(await readFile(await (await wait).path())));}
 const analysis=await request('Download reference analysis request');
 assert.equal(Object.keys(analysis).length,2);assert.match(new TextDecoder().decode(analysis['START-HERE.txt']),/Do not generate a book/);
 await page.getByLabel('Art direction from ChatGPT',{exact:true}).fill('Flat dry gouache with pencil texture, simple faces, teal and ochre. Avoid gloss.');
 await page.getByRole('button',{name:'Save book now',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'My illustrated book · 0 spreads',exact:true}).click();
 assert.equal(await page.getByLabel('Art direction from ChatGPT',{exact:true}).inputValue(),'Flat dry gouache with pencil texture, simple faces, teal and ochre. Avoid gloss.');
 await page.getByRole('button',{name:'Choose a book layout →',exact:true}).click();
 await page.locator('.children-gallery article').filter({hasText:'Razia Learns to Swim'}).getByRole('button',{name:'Use template',exact:true}).click();
 await page.getByLabel('Book title',{exact:true}).fill('Handoff chapter');
 await page.getByLabel('Choose your PDF or DOCX').setInputFiles({name:'chapter.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('Chapter 1 only')});
 const sample=await request('Download sample request');assert.match(new TextDecoder().decode(sample['START-HERE.txt']),/STOP after these two images/);
 assert.equal(await page.getByRole('button',{name:'Approve characters & sample',exact:true}).isEnabled(),false);
 await page.getByLabel('Upload character sheet').setInputFiles(image);
 await page.getByAltText('Character sheet for approval').waitFor();
 await page.getByLabel('Upload sample scene').setInputFiles(image);
 await page.getByAltText('Sample scene for approval').waitFor();
 await page.getByRole('button',{name:'Approve characters & sample',exact:true}).click();
 await page.getByRole('button',{name:'Download chapter request',exact:true}).waitFor();
 // A source/title change clears approval but retains both images for review.
 await page.getByLabel('Book title',{exact:true}).fill('Handoff chapter revised');
 await page.getByRole('button',{name:'Approve characters & sample',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download chapter request',exact:true}).count(),0);
 await page.getByRole('button',{name:'Approve characters & sample',exact:true}).click();
 await page.getByRole('button',{name:'Save book now',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Handoff chapter revised · 0 spreads',exact:true}).click();
 const chapter=await request('Download chapter request');assert.ok(chapter['approved/character-reference.png']);assert.ok(chapter['approved/style-sample.png']);
 const prompt=new TextDecoder().decode(chapter['START-HERE.txt']);assert.match(prompt,/Do not generate a replacement character sheet/);
 await page.evaluate(()=>{window.__opened='';window.open=url=>{window.__opened=url;return null;};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});});
 await page.getByRole('button',{name:'Copy prompt & open ChatGPT ↗',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>({url:window.__opened,copied:window.__copied})),{url:'https://chatgpt.com/',copied:prompt});
 // Importing a request ZIP explains the mistake rather than losing the draft.
 await page.getByLabel('Import ChatGPT’s ZIP or book.json').setInputFiles({name:'request.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(chapter))});
 await page.getByRole('alert').filter({hasText:'request for ChatGPT, not a completed book'}).waitFor();
 const id=prompt.match(/"projectId": "([^"]+)"/)[1];
 const book={format:'iks-template-book-v1',projectId:id,templateId:'bedtime-skies',title:'Handoff chapter revised',language:'English',characterGuide:'Fixed trio',pages:[1,2].map(n=>({id:`spread-${n}`,title:`Lesson ${n}`,original:'Source words',meaning:'Explanation',sourceReference:'Chapter 1',scene:'An original scene',image:`spread-${n}.png`,layout:'panorama',fontSize:22,imageScale:100}))};
 await page.getByLabel('Import ChatGPT’s ZIP or book.json').setInputFiles({name:'complete.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'book.json':strToU8(JSON.stringify(book)),'images/spread-1.png':buffer,'images/spread-2.png':buffer}))});
 await page.getByRole('button',{name:'Read book',exact:true}).waitFor();
 assert.equal(await page.locator('.ts-editor aside button').count(),2);
 const before=await page.locator('.ts-editor aside img').evaluateAll(es=>es.map(e=>e.src));
 await page.getByLabel('Paste image for selected page').evaluate(async el=>{const c=document.createElement('canvas');c.width=240;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,240,100);const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'paste.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await page.waitForFunction(old=>document.querySelector('.ts-editor aside img')?.src!==old,before[0]);
 assert.equal(await page.locator('.ts-editor aside img').nth(1).getAttribute('src'),before[1]);
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
