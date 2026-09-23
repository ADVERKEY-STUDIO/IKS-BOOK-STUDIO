import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const appUrl=process.env.IKS_APP_URL;
test('notebook scope selection survives saving and reopening and updates the prompt',{skip:!appUrl,timeout:60000},async()=>{
 const {chromium}=require(process.env.IKS_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto(`${appUrl}/template-studio`);
  await page.getByText('Loading…',{exact:true}).waitFor({state:'hidden'});
  await page.locator('.notes-gallery article').getByRole('button',{name:'Use template',exact:true}).click();
  await page.getByLabel('Notebook content',{exact:true}).selectOption('summary');
  await page.getByLabel('Book title',{exact:true}).fill('Notebook mode check');
  assert.match(await page.getByLabel('Detailed book prompt').inputValue(),/SELECTED CONTENT MODE: DETAILED SUMMARY/);
  await page.getByRole('button',{name:'Save book now',exact:true}).click();
  await page.getByRole('button',{name:'My saved books',exact:true}).click();
  await page.getByRole('button',{name:/Notebook mode check · 0/}).click();
  assert.equal(await page.getByLabel('Notebook content',{exact:true}).inputValue(),'summary');
  await page.getByLabel('Notebook content',{exact:true}).selectOption('full');
  assert.match(await page.getByLabel('Detailed book prompt').inputValue(),/SELECTED CONTENT MODE: FULL BOOK/);
 }finally{await browser.close();}
});
