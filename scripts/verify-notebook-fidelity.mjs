/** Render the actual notebook HTML through the PDF export canvas engine. */
import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';
import {renderTemplateBook} from '../lib/template-book.ts';
import {templateBlueprints} from '../lib/template-layouts.ts';
import {notebookOriginal} from '../lib/notebook-content.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const font=await fs.readFile(new URL('../public/fonts/book-hand.ttf',import.meta.url));
const out=new URL('../tmp/pdfs/notebook-fix/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1200}});
 for(const blueprint of templateBlueprints('iks-notes')){
  const noteSections=blueprint.original.map((r,i)=>({heading:`Section ${i+1}`,body:r.w<25?'Record the evidence before drawing a conclusion.':'• **Observe carefully and record the evidence before interpreting the result.**\n• Compare the observations. Explain what changed and what stayed the same.\n• State the limitations of the comparison.',sourceReference:'Original QA fixture'}));
  const book={format:'iks-template-book-v1',templateRevision:2,projectId:'qa',templateId:'iks-notes',title:'Notebook export QA',language:'English',characterGuide:'',pages:[{id:'p1',title:'OBSERVATION & EVIDENCE',blueprint:blueprint.id,layoutReason:'QA',noteSections,original:notebookOriginal(noteSections),meaning:blueprint.id.endsWith('roles')?'':'Explain the evidence.',sourceReference:'QA',scene:'No generated artwork in this typography test.',image:'missing.png',layout:'study',fontSize:10.5,imageScale:100}]};
  await page.setContent(renderTemplateBook(book,{},`data:font/ttf;base64,${font.toString('base64')}`).replace('</style>','.spread{zoom:1!important}.cover,.toolbar{display:none}</style>'));
  await page.evaluate(()=>document.fonts.ready);
  const failures=await page.locator('.planned-text').evaluateAll(els=>els.filter(e=>e.scrollHeight>e.clientHeight+2).map(e=>e.dataset.textRegion));
  assert.deepEqual(failures,[],blueprint.id+' text overflow');
  assert.ok(await page.locator('mark').count()>1);
  assert.equal(await page.locator('mark').first().evaluate(e=>getComputedStyle(e).display),'inline-block');
  await page.addScriptTag({path:new URL('../node_modules/html2canvas/dist/html2canvas.min.js',import.meta.url).pathname});
  const png=await page.evaluate(async()=>{const canvas=await window.html2canvas(document.querySelector('.planned-spread'),{scale:1.5,logging:false});return canvas.toDataURL().split(',')[1];});
  await fs.writeFile(new URL(blueprint.id+'.png',out),Buffer.from(png,'base64'));
  console.log(blueprint.id+': no overflow; canvas rendered');
 }
}finally{await browser.close();}
