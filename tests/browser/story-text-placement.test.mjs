import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.env.IKS_REPO_ROOT||process.cwd(),require=createRequire(resolve(root,'package.json'));
const {chromium}=require(process.env.IKS_PLAYWRIGHT_MODULE||'playwright');
const {outputFiles}=await require('esbuild').build({stdin:{contents:"export {autoPlaceStoryBook} from './lib/story-text-placement.ts';export {renderTemplatePage,parseTemplateBook} from './lib/template-book.ts';export {inspectRenderedBook} from './lib/template-layouts.ts';",resolveDir:root},bundle:true,write:false,format:'iife',globalName:'story'});
const browser=await chromium.launch({headless:true});after(()=>browser.close());
const original='नासै रोग हरै सब पीरा । जपत निरंतर हनुमत बीरा ॥\nसंकट तें हनुमान छुड़ावै । मन क्रम वचन ध्यान जो लावै ॥\n\nसब पर राम तपस्वी राजा । तिन के काज सकल तुम साजा ॥\nऔर मनोरथ जो कोई लावै । सोइ अमित जीवन फल पावै ॥';
const fixture=()=>({format:'iks-template-book-v1',projectId:'reading-test',templateId:'beanstalk-adventure',templateRevision:2,title:'Reading order',language:'Hindi',characterGuide:'Hanuman',pages:[{id:'spread-01',title:'Passage',original,meaning:'Remembering Hanuman gives people steadiness in hard times. He serves Rama’s work and inspires sincere hopes to become good actions.',sourceReference:'Page 2',scene:'A family in a forest',blueprint:'reference-beanstalk-diagonal',layoutReason:'Two scenes with clear sky',image:'spread-01.png',layout:'story-scene',fontSize:16,imageScale:100}]});
async function setup(){
 const page=await browser.newPage();
 await page.route('http://story.test/**',route=>{const path=new URL(route.request().url()).pathname;return path.startsWith('/fonts/')?route.fulfill({body:readFileSync(resolve(root,'public'+path)),contentType:'font/ttf'}):route.fulfill({body:'<html><body></body></html>',contentType:'text/html'});});
 await page.goto('http://story.test');await page.addScriptTag({content:outputFiles[0].text});return page;
}
test('automatic import uses clear artwork space, preserves source/art, and survives save/reload at different preview sizes',async()=>{
 const page=await setup();
 try{
  const result=await page.evaluate(async book=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#fff8e5';ctx.fillRect(0,0,1200,600);ctx.fillStyle='#234139';ctx.fillRect(0,0,600,600);ctx.fillRect(0,390,1200,210);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve)),images={'spread-01.png':blob},before=JSON.stringify(book),bytes=await blob.arrayBuffer();
   const result=await story.autoPlaceStoryBook(book,images);
   window.saved=story.parseTemplateBook(JSON.parse(JSON.stringify(result.book)));window.imageUrl=URL.createObjectURL(blob);
   return {unplaced:result.unplaced,page:window.saved.pages[0],unchanged:before===JSON.stringify(book),sameBlob:images['spread-01.png']===blob,sameBytes:Array.from(new Uint8Array(bytes)).join()===Array.from(new Uint8Array(await blob.arrayBuffer())).join(),frames:document.querySelectorAll('iframe').length};
  },fixture());
  assert.deepEqual(result.unplaced,[]);assert.equal(result.page.readingOrder,'continuous');assert.equal(result.page.original,original);
  assert.ok(result.unchanged&&result.sameBlob&&result.sameBytes);assert.equal(result.frames,0);
  for(const width of [420,1200,1587]){
   const rendered=await page.evaluate(async width=>{
    const frame=document.createElement('iframe');frame.style=`width:${width}px;height:${width/2}px;border:0`;document.body.append(frame);
    await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=story.renderTemplatePage(window.saved,0,{'spread-01.png':window.imageUrl});});
    const doc=frame.contentDocument;await doc.fonts.ready;await Promise.all([...doc.images].map(im=>im.decode()));
    const boxes=[...doc.querySelectorAll('.planned-text')].filter(el=>el.clientHeight&&el.textContent.trim());
    const source=boxes.filter(el=>el.classList.contains('original'));
    const issues=story.inspectRenderedBook(doc).filter(s=>/overflow|reading order/.test(s));
    const result={source:source.map(el=>el.textContent),issues,positions:boxes.map(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}))};frame.remove();return result;
   },width);
   assert.deepEqual(rendered.source,[original]);assert.deepEqual(rendered.issues,[],String(width));
   for(const r of rendered.positions){assert.ok(r.x>=50&&r.y+r.h<=65,'text must stay off the painted regions');}
   assert.ok(rendered.positions[0].y+rendered.positions[0].h<rendered.positions[1].y);
  }
 }finally{await page.close();}
});
test('no clear space is reported without changing layout, and imports preserve manual positions',async()=>{
 const page=await setup();try{
  const result=await page.evaluate(async book=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle='#123456';ctx.fillRect(0,0,1200,600);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve)),images={'spread-01.png':blob};
   const failed=structuredClone(await story.autoPlaceStoryBook(book,images));book.pages[0].textPositions=[{x:3,y:60,w:30,h:25},{x:60,y:5,w:30,h:25},{x:55,y:40,w:30,h:20}];
   const unreadable=await story.autoPlaceStoryBook(book,{'spread-01.png':new Blob(['not an image'])},true);
   const manual=await story.autoPlaceStoryBook(book,images);const missing=await story.autoPlaceStoryBook(book,{});
   return {failed,unreadable:unreadable.unplaced,manual:JSON.stringify(manual.book)===JSON.stringify(book),missing:JSON.stringify(missing.book)===JSON.stringify(book),frames:document.querySelectorAll('iframe').length};
  },fixture());assert.deepEqual(result.failed.unplaced,[1]);assert.deepEqual(result.unreadable,[1]);assert.deepEqual(result.failed.book,fixture());assert.ok(result.manual&&result.missing);assert.equal(result.frames,0);
 }finally{await page.close();}
});
test('print inspection catches collisions even when both boxes individually fit their text',async()=>{
 const page=await setup();try{
  const result=await page.evaluate(()=>{document.body.innerHTML='<section class="spread beanstalk-adventure" data-spread="8" style="position:relative;width:1200px;height:600px"><div class="planned-text original" style="position:absolute;left:20px;top:20px;width:300px;height:100px">Source</div><div class="planned-text meaning" style="position:absolute;left:20px;top:30px;width:300px;height:100px">Meaning</div></section>';return story.inspectRenderedBook(document);});
  assert.ok(result.some(note=>/Spread 8:.*overlap/.test(note)));
 }finally{await page.close();}
});
