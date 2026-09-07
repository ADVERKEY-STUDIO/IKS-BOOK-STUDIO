import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(resolve('package.json'));
const appUrl = process.env.IKS_APP_URL;

test('source selection and real manuscript/image ZIP uploads produce a publishable saved book', {skip:!appUrl,timeout:120000}, async()=>{
  const {zipSync,strToU8}=require('fflate');
  const {PDFDocument}=require('pdf-lib');
  const browser=await require(process.env.IKS_PLAYWRIGHT_MODULE || 'playwright')[process.env.IKS_BROWSER || 'chromium'].launch({headless:true});
  const page=await browser.newPage({viewport:{width:1536,height:1050}});
  let project; const assets=new Map(); let uploads=0;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.route('**/api/preferences',r=>r.fulfill({json:{preferences:[]}}));
    await page.route('**/api/projects',async r=>{if(r.request().method()==='POST')project=r.request().postDataJSON();await r.fulfill({json:r.request().method()==='POST'?{project}:{projects:project?[project]:[]}});});
    await page.route('**/api/image',async r=>{
      const request=r.request();const form=await new Request(request.url(),{method:'POST',headers:{'content-type':request.headers()['content-type']},body:request.postDataBuffer()}).formData();
      const file=form.get('file');assert.ok(file?.size>0);assert.equal(form.get('projectId'),project.id);
      const key=`test-art-${++uploads}`;assets.set(key,Buffer.from(await file.arrayBuffer()));
      await r.fulfill({json:{image:{key,url:`${appUrl}/api/asset?key=${key}`}}});
    });
    await page.route('**/api/asset?*',r=>r.fulfill({contentType:'image/png',body:assets.get(new URL(r.request().url()).searchParams.get('key'))}));
    await page.goto(appUrl);await page.waitForLoadState('networkidle');
    await page.getByRole('button',{name:'＋ New book',exact:true}).click();
    await page.getByRole('button',{name:/Use ChatGPT, Claude or DeepSeek/}).click();
    const source=await PDFDocument.create();source.addPage().drawText('A garden teaches careful observation, patience and thoughtful action.');
    await page.locator('.wizard-main input[type=file]').setInputFiles({name:'Garden source.pdf',mimeType:'application/pdf',buffer:Buffer.from(await source.save())});
    await page.getByLabel('New book title').fill('Garden ZIP workflow');
    for(let i=0;i<3;i++)await page.getByRole('button',{name:'Continue →',exact:true}).click();
    await page.getByRole('button',{name:'Create AI manuscript request →',exact:true}).click();
    const story=Array.from({length:10},(_,i)=>`Observation ${i}. ${'Children compare seeds, record what they see and consider how the garden changes. '.repeat(5)}`).join('\n\n');
    const manuscript=zipSync({
      '01-introduction.md':strToU8('# Introduction\n\nWelcome to the garden. Observe carefully and record what changes.\n\nWe will explore seeds and growing plants together.'),
      '02-garden.md':strToU8('# Chapter 1: A growing garden\n\n'+story+'\n\n## Reflection\n\nWhat did you learn from the garden?'),
      '03-conclusion.md':strToU8('# Conclusion\n\nThoughtful observation helps us understand growing things.\n\nContinue caring for the plants and comparing your findings.'),
      '04-glossary.md':strToU8('# Glossary\n\nSeed — a new beginning.')
    });
    await page.locator('.external-manuscript-upload input[type=file]').setInputFiles({name:'garden-manuscript.zip',mimeType:'application/zip',buffer:Buffer.from(manuscript)});
    await page.getByRole('button',{name:'Accept manuscript & create image prompt',exact:true}).click();
    await page.locator('.bulk-image-upload input[type=file]').waitFor({state:'attached'});
    assert.equal(project.title,'Garden ZIP workflow');assert.equal(project.chapters.length,4);
    const slots=project.externalIllustrations.slots;
    const art=await page.evaluate(count=>Array.from({length:count},(_,i)=>{const c=document.createElement('canvas');c.width=i%2?1800:2200;c.height=i%2?2200:1600;const x=c.getContext('2d');x.fillStyle=['#c0a779','#88a86c','#9bacc9','#c99c88'][i%4];x.fillRect(0,0,c.width,c.height);x.fillStyle='#244233';x.fillRect(100,100,150,200);return c.toDataURL();}),slots.length);
    const images=Object.fromEntries(slots.map((slot,i)=>[slot.filename.replace(/\.jpe?g$/i,'.png'),Buffer.from(art[i].split(',')[1],'base64')]));
    await page.locator('.bulk-image-upload input[type=file]').setInputFiles({name:'garden-images.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(images))});
    await page.getByRole('button',{name:'Open Designer',exact:true}).click();
    await page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText));
    assert.equal(uploads,slots.length);assert.equal(project.designerLayoutSnapshot,true);
    for(const chapter of project.chapters)for(const imported of chapter.importedPages||[])if(imported.imageUrl){const slot=slots.find(s=>s.id===imported.illustrationSlotId);assert.ok(slot);assert.equal(imported.illustrationPlacement,slot.placement);}
    const count=project.designerPages.filter(p=>!p.deleted).length;
    await page.getByRole('button',{name:'Preview & PDF',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.book-preflight-results'));
    assert.match(await page.locator('.book-preflight-results').textContent(),/0 blocking pages/);
    assert.equal(await page.locator('.pdf-render-stack figure img').count(),slots.filter(s=>s.role==='chapter').length);
    const downloadPromise=page.waitForEvent('download',{timeout:90000});
    await page.getByRole('button',{name:'Download publication PDF',exact:true}).click();
    const download=await downloadPromise;const file=await download.path();
    const pdf=await PDFDocument.load(readFileSync(file));assert.equal(pdf.getPageCount(),count);
    if(process.env.IKS_EVIDENCE_DIR){mkdirSync(process.env.IKS_EVIDENCE_DIR,{recursive:true});await download.saveAs(resolve(process.env.IKS_EVIDENCE_DIR,'zip-workflow.pdf'));}
    await page.reload();await page.getByRole('button',{name:/CHAPTERS.*Garden ZIP workflow/}).click();await page.locator('.designer-flow-page').first().waitFor();
    assert.equal(await page.locator('.designer-flow-page').count(),count);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
