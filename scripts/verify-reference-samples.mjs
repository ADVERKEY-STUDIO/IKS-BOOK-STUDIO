import assert from 'node:assert/strict';
import {templates} from '../lib/template-book.ts';
import {templateBlueprints} from '../lib/template-layouts.ts';
import {renderLayoutSample} from '../lib/template-layout-sample.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}});let count=0;const failures=[];
 for(const t of templates)for(const b of templateBlueprints(t.id)){
  await page.setContent(renderLayoutSample(t.id,b.id).replace('<head>','<head><base href="http://127.0.0.1:5173/">'));
  await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.locator('.planned-text').evaluateAll(els=>els.filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2).map(el=>el.getAttribute('data-text-region')));
  if(overflow.length)failures.push({template:t.id,blueprint:b.id,overflow});
  count++;
 }
 console.log(JSON.stringify({samples:count,failures},null,2));assert.deepEqual(failures,[]);
}finally{await browser.close();}
