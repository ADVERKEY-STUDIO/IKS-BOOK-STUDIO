import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync, strToU8} from 'fflate';
const require=createRequire(import.meta.url), appUrl=process.env.IKS_APP_URL;

test('Chalisa content reference, saved request, bilingual import and missing-image recovery', {skip:!appUrl,timeout:120000}, async()=>{
 const {chromium}=require(process.env.IKS_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${appUrl}/template-studio`);
  await page.getByText('Your books will appear here. Saved on this browser; download a ZIP for backup.',{exact:true}).waitFor();
  await page.locator('.children-gallery article').filter({hasText:'The Never Starting Tale of Jack and the Beanstalk'}).getByRole('button',{name:'Use template',exact:true}).click();
  assert.equal(await page.getByLabel('Passage grouping',{exact:true}).inputValue(),'chalisa');
  assert.equal(await page.getByLabel('Reader age / audience',{exact:true}).inputValue(),'Ages 9–14');
  await page.getByLabel('Book title',{exact:true}).fill('Durga Chalisa test');
  await page.getByLabel('Choose your PDF or DOCX').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:Buffer.from('Original chaupais')});
  await page.getByLabel('Book content reference (optional)',{exact:true}).setInputFiles({name:'reference.pdf',mimeType:'application/pdf',buffer:Buffer.from('Prepared meanings and morals')});
  assert.match(await page.getByLabel('Detailed book prompt').inputValue(),/COPY, DO NOT REWRITE/);
  await page.getByRole('button',{name:'Save book now',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'Durga Chalisa test · 0 spreads',exact:true}).click();
  await page.getByRole('button',{name:'Remove content reference',exact:true}).waitFor();
  async function request() {
   const downloading=page.waitForEvent('download');
   await page.getByRole('button',{name:'Download request ZIP',exact:true}).click();
   return unzipSync(new Uint8Array(await readFile(await (await downloading).path())));
  }
  const referenceEntries=await request();
  assert.equal(new TextDecoder().decode(referenceEntries['content-reference/reference.pdf']),'Prepared meanings and morals');
  assert.equal(new TextDecoder().decode(referenceEntries['START-HERE.txt']),await page.getByLabel('Detailed book prompt').inputValue());
  await page.getByRole('button',{name:'Remove content reference',exact:true}).click();
  const entries=await request(), prompt=new TextDecoder().decode(entries['START-HERE.txt']);
  assert.ok(!entries['content-reference/reference.pdf']);
  assert.match(prompt,/NO CONTENT REFERENCE/);
  assert.match(prompt,/batches of at most FOUR/);
  const id=prompt.match(/"projectId": "([^"]+)"/)[1];
  const meaning='हिंदी अर्थ:\nमाँ सुख देती हैं।\nमाँ दुख दूर करती हैं।\n\nEnglish meaning:\nMother brings happiness.\nMother takes away sorrow.\n\nहिंदी नैतिक शिक्षा:\nदूसरों की मदद करो।\n\nEnglish moral:\nHelp others.';
  const book={format:'iks-template-book-v1',projectId:id,templateId:'beanstalk-adventure',title:'Durga Chalisa test',language:'Hindi and English',characterGuide:'The chosen Durga sheet',pages:[1,2].map(n=>({id:`spread-${n}`,title:`Chaupai ${n}`,original:'नमो नमो दुर्गे सुख करनी।\nनमो नमो अम्बे दुःख हरनी॥',meaning,sourceReference:`Chaupai ${n}`,scene:`Durga comforts devotees for chaupai ${n}`,image:`spread-${n}.png`,layout:'story-scene',fontSize:16,imageScale:100}))};
  const upload=async data=>page.getByLabel('Import ChatGPT’s ZIP or book.json').setInputFiles({name:'book.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await upload({...book,pages:book.pages.map(p=>({...p,meaning:'Only one English meaning'}))});
  await page.getByRole('alert').filter({hasText:'required labels'}).waitFor();
  const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#fbf6e8';ctx.fillRect(0,0,1200,600);return c.toDataURL().split(',')[1];}),'base64');
  await page.getByLabel('Import ChatGPT’s ZIP or book.json').setInputFiles({name:'checkpoint.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'book.json':strToU8(JSON.stringify(book)),'images/spread-1.png':image,'passage-map.txt':strToU8('Saved passage map'),'progress.txt':strToU8('Pending spread-2.png')}))});
  await page.getByRole('button',{name:'Read book',exact:true}).waitFor();
  await page.getByRole('button',{name:'Artwork & imports',exact:true}).click();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download images prompt',exact:true}).click();
  const continuation=await readFile(await (await downloading).path(),'utf8');
  assert.match(continuation,/images\/spread-2.png/);assert.doesNotMatch(continuation,/images\/spread-1.png/);
  assert.match(continuation,/Meaning and moral context:/);assert.match(continuation,/UP TO 4 PER REQUEST/);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
