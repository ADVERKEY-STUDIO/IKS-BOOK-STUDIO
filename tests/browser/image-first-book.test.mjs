import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const appUrl = process.env.IKS_APP_URL;
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
test('image-first books preserve selected artwork through edit, prompt and ZIP round trip', { skip: !appUrl, timeout: 120000 }, async () => {
const { chromium } = require(process.env.IKS_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto(`${appUrl}/template-studio`);
 await page.getByText('Your books will appear here. Saved on this browser; download a ZIP for backup.', {exact:true}).waitFor();
 await page.getByText('Have finished illustrations? Use them directly',{exact:true}).click();
 const buffer = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; canvas.getContext('2d').fillRect(0,0,120,80); return canvas.toDataURL().split(',')[1]; }), 'base64');
 await page.locator('.ts-image-start input[type=file]').setInputFiles([{name:'My first image.png',mimeType:'image/png',buffer},{name:'My second image.png',mimeType:'image/png',buffer}]);
 await page.getByText('2 images · one per spread. Choose a template below to continue.').waitFor({timeout:5000}).catch(async e => { console.log(await page.locator('.ts-error').allTextContents()); console.log(await page.locator('.ts-image-start').innerText()); throw e; });
 await page.getByRole('button',{name:'Move image 2 earlier',exact:true}).click();
 assert.match(await page.locator('.ts-chosen-images>div').first().innerText(),/My second image/);
 await page.getByRole('button',{name:'Choose Landscape journey',exact:true}).click();
 await page.getByRole('heading',{name:'My picture book'}).waitFor();
 assert.equal(await page.locator('.ts-editor aside button').count(),2);
 await page.getByRole('button',{name:'2. Book details',exact:true}).click();
 await page.getByLabel('Book title',{exact:true}).fill('Our picture story');
 await page.getByRole('button',{name:'Continue editing',exact:true}).click();
 await page.getByLabel('Original text',{exact:true}).fill('A day by the river.');
 await page.getByText('Optional: develop these images with ChatGPT',{exact:true}).click();
 const dl=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download image development request',exact:true}).click();
 const request=unzipSync(new Uint8Array(await readFile(await (await dl).path())));
 assert.deepEqual(Object.keys(request).sort(),['START-HERE.txt','book.json','images/spread-01.png','images/spread-02.png']);
 assert.match(new TextDecoder().decode(request['START-HERE.txt']),/A day by the river/);
 await page.getByRole('button',{name:'Save book now',exact:true}).click();
 await page.getByText('Saved in this browser',{exact:true}).waitFor();
 await page.reload();
 // Restore from the existing browser library.
 await page.getByRole('button',{name:/Our picture story · 2 spreads/}).click();
 await page.getByRole('heading',{name:'Our picture story'}).waitFor({timeout:5000}).catch(async e => { console.log((await page.locator('body').innerText()).slice(-4000)); throw e; });
 assert.equal(await page.locator('.ts-fields textarea').nth(0).inputValue(),'A day by the river.');
 await page.getByRole('button',{name:'Read book',exact:true}).click();
 const frame=page.frameLocator('iframe[title="Your assembled book"]');
 await frame.locator('.art img').first().waitFor();
 assert.equal(await frame.locator('.art img').count(),2);
 await page.getByRole('button',{name:'Close book preview',exact:true}).click();
 const zipDownload=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download editable ZIP',exact:true}).click();
 const zipPath=await (await zipDownload).path();
 const zip=unzipSync(new Uint8Array(await readFile(zipPath)));
 assert.equal(JSON.parse(new TextDecoder().decode(zip['book.json'])).contentMode,'images');
 await page.getByRole('button',{name:'My saved books',exact:true}).click();
 await page.getByLabel('Restore an editable book ZIP').setInputFiles({name:'book.zip',mimeType:'application/zip',buffer:await readFile(zipPath)});
 await page.getByRole('heading',{name:'Our picture story'}).waitFor();
 assert.equal(await page.locator('.ts-editor aside button').count(),2);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'mobile page should not overflow');
 assert.deepEqual(errors,[]);

} finally {await browser.close();}

});
