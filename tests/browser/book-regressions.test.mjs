import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
const appUrl = process.env.IKS_APP_URL;
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const source = readFileSync(file, 'utf8') + (file.endsWith('/app/page.tsx') ? '\nexport { emptyProject, defaultDesignerRevision };' : '');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(resolve(dirname(file), /\.tsx?$/.test(name) ? name : name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const app = appUrl ? load(resolve('app/page.tsx')) : null;
const engine = appUrl ? require(process.env.IKS_PLAYWRIGHT_MODULE || 'playwright')[process.env.IKS_BROWSER || 'chromium'] : null;
const browser = engine ? await engine.launch({ headless: true }) : null;
after(async () => browser?.close());
const prose = Array.from({length:14},(_,i)=>`<p id="paragraph-${i}">Observation ${i}. ${'The children compare seeds, carefully record their findings and discuss what the garden teaches them. '.repeat(5)}</p>`).join('');
const chapter = (body, extra={}) => ({id:1,title:'Garden observations',body,pages:4,status:'approved',generationStatus:'Completed',manualApproved:true,locked:false,sourceRefs:[],...extra});
async function open(make) {
  const page = await browser.newPage({ viewport:{width:1536,height:1050} });
  const artwork = await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#779a51';x.fillRect(0,0,600,800);return c.toDataURL();});
  let project = {...app.emptyProject,id:'book-regression',title:'Book regression',source:'Garden.pdf',bookFormat:'7x10',briefApproved:true,adaptationPlanConfirmed:true,designerPages:[],designerPageOrder:[],designerLayoutSnapshot:false,...make(artwork)};
  await page.route('**/api/preferences',r=>r.fulfill({json:{preferences:[]}}));
  await page.route('**/api/projects',async r=>{if(r.request().method()==='POST')project=r.request().postDataJSON();await r.fulfill({json:r.request().method()==='POST'?{project}:{projects:[project]}});});
  await page.goto(appUrl);await page.getByRole('button',{name:/CHAPTERS.*Book regression/}).click();
  await page.locator('.designer-flow-page').first().waitFor();
  return {page, project:()=>project};
}
async function preview(page) {
  await page.getByRole('button',{name:'Preview & PDF',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.book-preflight-results'));
  return page.locator('.book-preflight-results').textContent();
}
const options = {skip:!appUrl,timeout:30000};
test('a short approved glossary does not prevent automatic layout', options, async()=>{
  const run=await open(()=>({chapters:[chapter(prose),chapter('<p>Dharma — thoughtful action.</p>',{id:2,title:'Glossary',sectionKind:'glossary'})]}));
  try {await run.page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText),{},{timeout:4000});assert.equal(run.project().designerLayoutSnapshot,true);assert.match(await preview(run.page),/0 blocking pages/);} finally {await run.page.close();}
});
test('ordinary nested reader sections paginate without overflow or lost text', options, async()=>{
  const run=await open(()=>({chapters:[chapter('<section class="story" style="color:rgb(30,60,40)">'+prose+'</section>')]}));
  try {await run.page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText));assert.match(await preview(run.page),/0 blocking pages/);const text=await run.page.locator('.pdf-render-stack .preview-body').allTextContents();for(let i=0;i<14;i++)assert.equal(text.join('').split(`Observation ${i}.`).length-1,1);} finally {await run.page.close();}
});
test('reused artwork keeps both slots and their captions at opening and reflection anchors', options, async()=>{
  const run=await open(artwork=>({chapters:[chapter(prose+'<h3>Reflection</h3><p>What did you learn?</p>',{visualType:'external-uploaded',importedPages:[{pageId:'p1',body:prose+'<h3>Reflection</h3><p>What did you learn?</p>',illustrationSlotId:'opening',illustrationPlacement:'after-opening',imageUrl:artwork,imageAlt:'Opening scene',imageCaption:'Opening caption'},{pageId:'p2',body:'',illustrationSlotId:'reflection',illustrationPlacement:'before-reflection',imageUrl:artwork,imageAlt:'Reflection scene',imageCaption:'Reflection caption'}]})]}));
  try {await run.page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText));assert.match(await preview(run.page),/0 blocking pages/);const stack=run.page.locator('.pdf-render-stack');assert.equal(await stack.locator('img').count(),2);assert.deepEqual(await stack.locator('figcaption').allTextContents(),['Opening caption','Reflection caption']);const text=(await stack.locator('.preview-body').allTextContents()).join('');assert.ok(text.indexOf('Opening caption')<text.indexOf('Observation 1.'));assert.ok(text.indexOf('Reflection caption')<text.indexOf('ReflectionWhat did'));} finally {await run.page.close();}
});
test('an existing saved oversized in-flow illustration is repaired above the footer', options, async()=>{
  const run=await open(artwork=>{
    const html='<header class="print-chapter-header"><span>CHAPTER 1</span><span>PAGE 1</span></header><h2>Garden observations</h2><div class="preview-body"><p>A teacher and children examine the garden.</p></div><figure class="chapter-image" style="height:1100px"><img style="width:100%;height:1100px" src="'+artwork+'" alt="Garden"><figcaption>The scene remains with its caption.</figcaption></figure><footer class="sheet-number"><span>Book regression</span><span>1</span></footer>';
    const saved={...app.defaultDesignerRevision(html),slotId:'chapter-1-page-1',kind:'chapter',chapterId:1,pageIndex:0,label:'Chapter 1 · page 1',history:[]};
    return {chapters:[chapter('<p>A teacher and children examine the garden.</p>',{imageUrl:artwork,visualType:'external-uploaded'})],designerPages:[saved],designerPageOrder:['cover','contents',saved.slotId,'back'],designerLayoutSnapshot:true};
  });
  try {await run.page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText),{},{timeout:5000});assert.match(await preview(run.page),/0 blocking pages/);assert.equal(await run.page.locator('.pdf-render-stack figure img').count(),1);assert.equal(await run.page.locator('.pdf-render-stack figcaption').textContent(),'The scene remains with its caption.');} finally {await run.page.close();}
});

test('page border None suppresses inherited ornamental borders in Designer and Preview', options, async()=>{
  const run=await open(()=>{
    const saved={...app.defaultDesignerRevision('<div class="preview-body"><p>A borderless saved page.</p></div>'),borderStyle:'none',slotId:'chapter-1-page-1',kind:'chapter',chapterId:1,pageIndex:0,label:'Chapter 1 · page 1',history:[]};
    return {bookBorder:'Lotus Arch',chapters:[chapter('<p>A borderless saved page.</p>')],designerPages:[saved],designerLayoutSnapshot:true};
  });
  const borders=async selector=>run.page.locator(selector).evaluate(node=>[null,'::before','::after'].map(p=>{const s=getComputedStyle(node,p);return s.display==='none'?0:parseFloat(s.borderTopWidth)+(node.closest('.designer-flow-page.selected') && !p ? 0 : (s.outlineStyle === "none" ? 0 : parseFloat(s.outlineWidth)));}));
  try {
    assert.deepEqual(await borders('.designer-flow-page [data-page-slot="chapter-1-page-1"]'),[0,0,0]);
    await preview(run.page);
    assert.deepEqual(await borders('.pdf-render-stack [data-page-slot="chapter-1-page-1"]'),[0,0,0]);
  } finally {await run.page.close();}
});

test('an older book keeps its explicit No Border choice when its theme is inferred', options, async()=>{
  const run=await open(()=>({bookPersona:undefined,bookBorder:'No Border',chapters:[chapter('<p>A short reader passage.</p>')]}));
  try {await run.page.waitForFunction(()=>/balanced locally|Layout balancing failed/.test(document.body.innerText));assert.equal(run.project().bookBorder,'No Border');} finally {await run.page.close();}
});
