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
    for(let i=0;i<2;i++)await page.getByRole('button',{name:'Continue →',exact:true}).click();
    await page.getByLabel('Image source',{exact:true}).selectOption('hybrid');
    await page.getByLabel('Source image enhancement',{exact:true}).selectOption('clean');
    await page.getByLabel('Illustration style',{exact:true}).selectOption('custom');
    await page.getByLabel('Describe your custom style').fill('Fine ink outlines with muted earth colours.');
    await page.getByLabel('Preserve Sanskrit ślokas from the source').check();
    await page.getByLabel('Roman transliteration').check();
    await page.getByLabel('Child-friendly translation in the book’s language').uncheck();
    if(process.env.IKS_EVIDENCE_DIR){mkdirSync(process.env.IKS_EVIDENCE_DIR,{recursive:true});await page.locator('.source-book-options').screenshot({path:resolve(process.env.IKS_EVIDENCE_DIR,'source-options.png')});}
    await page.getByRole('button',{name:'Continue →',exact:true}).click();
    assert.match(await page.getByRole('region',{name:'Source image and Sanskrit choices'}).innerText(), /Fine ink outlines/);
    await page.getByRole('button',{name:'Create AI manuscript request →',exact:true}).click();
    const story=Array.from({length:10},(_,i)=>`Observation ${i}. ${'Children compare seeds, record what they see and consider how the garden changes. '.repeat(5)}`).join('\n\n');
    const sourceManifest={format:'iks-source-assets-v1',sourceImages:[{id:'SRC01',sourcePage:3,originalPath:'source-images/SRC01.png',cleanedPath:'cleaned-source-images/SRC01.png',caption:'Source seeds',alt:'Source seeds',status:'available',placements:[{id:'SRC01_P1',sectionNumber:2,anchorText:story.split('\n\n')[0],reason:'Supports the opening observation.'},{id:'SRC01_P2',sectionNumber:2,anchorText:story.split('\n\n')[2],reason:'Supports the later comparison.'}]},{id:'SRC02',sourcePage:4,originalPath:'source-images/SRC02.png',caption:'Unplaced source picture',alt:'Unplaced source picture',status:'available',placements:[]}],verses:[{id:'V01',sectionNumber:2,sourcePage:5,reference:'Test source verse',sanskrit:'सत्यं वद ।\nधर्मं चर ।',explanation:'Act with care and speak truthfully.',status:'verified'}],extractionNotes:[]};
    const manuscript=zipSync({
      'source-manifest.json':strToU8(JSON.stringify(sourceManifest)),
      '01-introduction.md':strToU8('# Introduction\n\nWelcome to the garden. Observe carefully and record what changes.\n\nWe will explore seeds and growing plants together.'),
      '02-garden.md':strToU8('# Chapter 1: A growing garden\n\n'+story+'\n\n:::sloka V01\nसत्यं वद ।\nधर्मं चर ।\n:::\n\n## Reflection\n\nWhat did you learn from the garden?'),
      '03-conclusion.md':strToU8('# Conclusion\n\nThoughtful observation helps us understand growing things.\n\nContinue caring for the plants and comparing your findings.'),
      '04-glossary.md':strToU8('# Glossary\n\nSeed — a new beginning.')
    });
    const broken=require('fflate').unzipSync(manuscript);
    broken['02-garden.md']=strToU8(new TextDecoder().decode(broken['02-garden.md']).replace(/:::sloka V01[\s\S]*?:::/,''));
    await page.locator('.external-manuscript-upload input[type=file]').setInputFiles({name:'garden-manuscript.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(broken))});
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(),/4 sections detected/);
    assert.match(await page.getByRole('alert').textContent(),/V01/);
    assert.equal(await page.locator('.manuscript-section-list article').count(),4);
    assert.equal(await page.getByRole('button',{name:'Accept manuscript & create image prompt',exact:true}).isEnabled(),false);
    const wrapped=Object.fromEntries(Object.entries(require('fflate').unzipSync(manuscript)).map(([name,data])=>['Garden/'+name,data]));
    wrapped['Garden/._02-garden.md']=strToU8('# CHAPTER 99: Finder metadata');
    await page.locator('.external-manuscript-upload input[type=file]').setInputFiles({name:'garden-manuscript.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(wrapped))});
    await page.getByRole('button',{name:'Accept manuscript & create image prompt',exact:true}).click();
    await page.locator('.bulk-image-upload input[type=file]').waitFor({state:'attached'});
    assert.equal(project.title,'Garden ZIP workflow');assert.equal(project.chapters.length,4);
    const choices={imageMode:'hybrid',enhancement:'clean',imageStyle:'custom',customStyle:'Fine ink outlines with muted earth colours.',preserveSlokas:true,transliteration:true,translation:false,explanation:true,chapterStyles:{}};
    assert.deepEqual(project.sourceBookOptions,choices);
    const slots=project.externalIllustrations.slots;
    const art=await page.evaluate(count=>Array.from({length:count},(_,i)=>{const c=document.createElement('canvas');c.width=i%2?1800:2200;c.height=i%2?2200:1600;const x=c.getContext('2d');x.fillStyle=['#c0a779','#88a86c','#9bacc9','#c99c88'][i%4];x.fillRect(0,0,c.width,c.height);x.fillStyle='#244233';x.fillRect(100,100,150,200);return c.toDataURL();}),slots.length);
    assert.equal(project.sourceManifest.verses[0].sanskrit,sourceManifest.verses[0].sanskrit);
    const images=Object.fromEntries(slots.map((slot,i)=>[slot.filename.replace(/\.jpe?g$/i,'.png'),Buffer.from(art[i].split(',')[1],'base64')]));
    images['source-images/SRC01.png']=Buffer.from(art[0].split(',')[1],'base64');
    images['source-images/SRC02.png']=Buffer.from(art[1].split(',')[1],'base64');
    images['source-manifest.json']=strToU8(JSON.stringify(sourceManifest));
    await page.locator('.bulk-image-upload input[type=file]').setInputFiles({name:'garden-images.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(images))});
    const sourceDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download source images',exact:true}).click();
    const sourceZip=require('fflate').unzipSync(readFileSync(await (await sourceDownload).path()));assert.ok(sourceZip['source-images/SRC02.png']);assert.ok(sourceZip['cleaned-source-images/SRC01.png']);
    await page.getByRole('button',{name:'Open Designer',exact:true}).click();
    await page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText));
    assert.equal(uploads,slots.length+3);assert.equal(project.sourceAssets.length,3);assert.equal(project.designerLayoutSnapshot,true);
    for(const chapter of project.chapters)for(const imported of chapter.importedPages||[])if(imported.imageUrl){const slot=slots.find(s=>s.id===imported.illustrationSlotId);assert.ok(slot);assert.equal(imported.illustrationPlacement,slot.placement);}
    const count=project.designerPages.filter(p=>!p.deleted).length;
    await page.getByRole('button',{name:'Preview & PDF',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.book-preflight-results'));
    assert.match(await page.locator('.book-preflight-results').textContent(),/0 blocking pages/);
    assert.equal(await page.locator('.pdf-render-stack figure img').count(),slots.filter(s=>s.role==='chapter').length);
    assert.equal(await page.locator('.pdf-render-stack [data-source-verse=V01]').count(),1);
    assert.equal(await page.locator('.pdf-render-stack [data-illustration-slot=SRC01_P1]').count(),1);assert.equal(await page.locator('.pdf-render-stack [data-illustration-slot=SRC01_P2]').count(),1);
    await page.getByRole('button',{name:/^Review sources/}).click();
    const imageReview=page.getByRole('article',{name:'Review image SRC01'});
    await imageReview.getByRole('checkbox').check();
    const frames=project.designerPages.map(p=>p.html.match(/<img[^>]*data-illustration-slot="SRC01_P[12]"[^>]*>/g)||[]).flat().map(html=>html.replace(/src="[^"]*"/,'src=""'));
    for(const variant of ['original','cleaned','original']){
      await imageReview.getByRole('button',{name:variant==='original'?'Use original':'Approve cleaned image',exact:true}).click();
      await page.waitForFunction(v=>document.querySelector('[aria-label="Review image SRC01"]').textContent.includes(`Approved: ${v}.`),variant);
      assert.equal(project.sourceReview.images.SRC01.variant,variant);
      const asset=project.sourceAssets.find(a=>a.path===(variant==='original'?'source-images/SRC01.png':'cleaned-source-images/SRC01.png'));
      assert.equal(project.externalIllustrations.slots.filter(s=>s.sourceImageId==='SRC01'&&s.imageUrl===asset.url).length,2);
    }
    assert.deepEqual(project.designerPages.map(p=>p.html.match(/<img[^>]*data-illustration-slot="SRC01_P[12]"[^>]*>/g)||[]).flat().map(html=>html.replace(/src="[^"]*"/,'src=""')),frames);
    const verseReview=page.getByRole('article',{name:'Review verse V01'});
    const comparison=await PDFDocument.create();for(let i=0;i<5;i++)comparison.addPage().drawText('Source comparison page '+(i+1));
    await page.getByLabel('Choose source PDF for local comparison').setInputFiles({name:'Comparison.pdf',mimeType:'application/pdf',buffer:Buffer.from(await comparison.save())});
    await page.getByText('Source PDF loaded locally. Compare each verse on its cited page.',{exact:true}).waitFor();
    assert.match(await verseReview.getByLabel('Source text for V01').inputValue(),/Source comparison page 5/);
    assert.equal(await verseReview.getByRole('button',{name:'Approve source verse',exact:true}).isEnabled(),false);

    await verseReview.getByLabel('Source text for V01').fill(sourceManifest.verses[0].sanskrit);
    await verseReview.getByRole('checkbox').check();
    await verseReview.getByRole('button',{name:'Approve source verse',exact:true}).click();
    await verseReview.getByText('Source review saved.',{exact:true}).waitFor();
    assert.equal(project.sourceReview.verses.V01.method,'manual');
    if(process.env.IKS_EVIDENCE_DIR)await page.locator('.source-review-panel').screenshot({path:resolve(process.env.IKS_EVIDENCE_DIR,'source-review.png')});
    await page.getByRole('button',{name:'Close source review',exact:true}).click();
    await page.waitForTimeout(300);
    assert.deepEqual(await page.locator('.source-preflight-results').allTextContents(),[]);
    assert.ok(await page.evaluate(()=>document.fonts.check('16px "Book Sanskrit"','धर्म')));
    const downloadPromise=page.waitForEvent('download',{timeout:90000});
    await page.getByRole('button',{name:'Download publication PDF',exact:true}).click();
    const download=await downloadPromise;const file=await download.path();
    const pdf=await PDFDocument.load(readFileSync(file));assert.equal(pdf.getPageCount(),count);
    if(process.env.IKS_EVIDENCE_DIR){mkdirSync(process.env.IKS_EVIDENCE_DIR,{recursive:true});await download.saveAs(resolve(process.env.IKS_EVIDENCE_DIR,'zip-workflow.pdf'));}
    await page.reload();await page.getByRole('button',{name:/CHAPTERS.*Garden ZIP workflow/}).click();await page.locator('.designer-flow-page').first().waitFor();
    assert.equal(await page.locator('.designer-flow-page').count(),count);assert.deepEqual(project.sourceBookOptions,choices);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
