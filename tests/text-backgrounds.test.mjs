import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTextBackgrounds,textBackgroundStyle,textBackgroundShapes} from '../lib/text-backgrounds.ts';
import {parseTemplateBook,renderTemplateBook,renderTemplatePage} from '../lib/template-book.ts';
import {zipSync,strToU8} from 'fflate';
import {readTemplateArchive} from '../lib/template-archive.ts';
const fixture=()=>({format:'iks-template-book-v1',templateRevision:2,projectId:'background-test',templateId:'beanstalk-adventure',title:'Book',language:'Hindi',characterGuide:'',pages:[{id:'p1',title:'Story',original:'जय हनुमान',meaning:'A meaning',sourceReference:'Page 1',scene:'Forest',image:'p1.png',blueprint:'reference-beanstalk-landscape',layoutReason:'Sky',layout:'story-scene',fontSize:16,imageScale:100,textPositions:[{x:50,y:10,w:30,h:25},{x:50,y:40,w:30,h:25}]}]});
test('all background shapes survive ZIP restore and render behind unchanged editable text',()=>{
 for(const shape of textBackgroundShapes.filter(s=>s!=='none')){
  const book=fixture();book.pages[0].textBackgrounds={original:{shape,color:'#fff8e8'},meaning:{shape:'rounded',color:'#ffffff'}};
  const files=readTemplateArchive(zipSync({'book.json':strToU8(JSON.stringify(book))}));
  const restored=parseTemplateBook(JSON.parse(new TextDecoder().decode(files['book.json'])));
  assert.deepEqual(restored.pages[0].textBackgrounds,book.pages[0].textBackgrounds);
  assert.deepEqual(restored.pages[0].textPositions,book.pages[0].textPositions);
  for(const html of [renderTemplateBook(restored),renderTemplatePage(restored,0)]){
   assert.ok(html.includes('text-background-'+shape));assert.ok(html.includes('data:image/svg+xml,'));
   assert.ok(html.includes('जय हनुमान'));assert.ok(html.includes('A meaning'));assert.ok(html.includes('Read first'));assert.ok(html.includes('2 · Meaning'));
  }
 }
});
test('removal and old books preserve transparent text; untrusted shapes and colours are rejected',()=>{
 assert.equal(textBackgroundStyle(undefined),'');assert.equal(textBackgroundStyle({shape:'none',color:'#fff8e8'}),'');
 const book=parseTemplateBook(fixture());assert.equal(book.pages[0].textBackgrounds,undefined);
 assert.doesNotMatch(renderTemplatePage(book,0),/class="planned-text [^"]*text-background /);
 for(const value of [null,[],{caption:{shape:'cloud',color:'#ffffff'}},{original:{shape:'remote',color:'#ffffff'}},{meaning:{shape:'cloud',color:'red;url(https://bad)'}},{original:{shape:'cloud',color:123}}])assert.throws(()=>parseTextBackgrounds(value));
});
test('background adjustments persist and invalid geometry is rejected',()=>{
 const book=fixture();book.pages[0].textBackgrounds={original:{shape:'cloud',color:'#ffffff',offsetX:-10,offsetY:-8,width:120,height:130,padding:2}};
 const restored=parseTemplateBook(JSON.parse(JSON.stringify(book)));
 assert.deepEqual(restored.pages[0].textBackgrounds,book.pages[0].textBackgrounds);
 const html=renderTemplatePage(restored,0);assert.ok(html.includes('--bg-x:-10%'));assert.ok(html.includes('--bg-width:120%'));assert.ok(html.includes('--bg-padding:2em'));
 for(const adjustment of [{width:0},{height:201},{offsetX:Infinity},{padding:-1}])assert.throws(()=>parseTextBackgrounds({original:{shape:'cloud',color:'#ffffff',...adjustment}}));
});
test('reading labels can be hidden independently without removing passages',()=>{
 for(const key of ['showReadFirst','showMeaning']){
  const book=fixture();book.typography={font:'template',alignment:'template',[key]:false};
  const restored=parseTemplateBook(JSON.parse(JSON.stringify(book)));assert.equal(restored.typography[key],false);
  for(const html of [renderTemplatePage(restored,0),renderTemplateBook(restored)]){
   assert.ok(html.includes('जय हनुमान'));assert.ok(html.includes('A meaning'));
   assert.ok(html.includes(`.planned-spread .${key==='showReadFirst'?'original':'meaning'}.reading-label::before{display:none;content:none}`));
  }
 }
});

test('bulk background appearance supports every shape and None without moving or mutating text',async()=>{
 const {applyTextBackgroundsToPages}=await import('../lib/text-backgrounds.ts');
 const book=fixture();
 book.pages.push({...book.pages[0],id:'p2',image:'p2.png',textBackgrounds:{original:{shape:'rounded',color:'#abcdef',offsetX:12,width:140,padding:2},meaning:{shape:'speech',color:'#123456',height:120}}});
 for(const shape of textBackgroundShapes){
  const original=structuredClone(book.pages);
  const source={original:{shape,color:'#ffffff',offsetX:-30,width:180},meaning:{shape,color:'#fff8e8'}};
  const pages=applyTextBackgroundsToPages(book.pages,source);
  assert.deepEqual(book.pages,original);
  assert.equal(pages[1].textBackgrounds.original.offsetX,12);assert.equal(pages[1].textBackgrounds.original.width,140);
  assert.equal(pages[0].textBackgrounds.original.offsetX,undefined);
  for(const page of pages){assert.equal(page.textBackgrounds.original.shape,shape);assert.equal(page.textBackgrounds.meaning.shape,shape);assert.equal(page.original,book.pages[0].original);}
  const restored=parseTemplateBook({...book,pages});
  for(let i=0;i<pages.length;i++){
   const html=renderTemplatePage(restored,i);
   if(shape!=='none')assert.ok(html.includes('text-background-'+shape));
   else assert.doesNotMatch(html,/class="planned-text [^"]*text-background /);
  }
  assert.deepEqual(pages[1].textPositions,original[1].textPositions);
 }
 const oneRole=applyTextBackgroundsToPages(book.pages,undefined,['original']);
 assert.equal(oneRole[1].textBackgrounds.original.shape,'none');
 assert.deepEqual(oneRole[1].textBackgrounds.meaning,book.pages[1].textBackgrounds.meaning);
});
