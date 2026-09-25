import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBookCompletion,bookArtworkFiles} from '../lib/book-completion.ts';
import {bookPrompt,continuationPrompt,parseTemplateBook,renderTemplateBook,renderTemplatePage} from '../lib/template-book.ts';
import {sourceBookPrompt} from '../lib/visual-direction.ts';
const fixture=()=>({format:'iks-template-book-v1',templateRevision:2,projectId:'cover-test',templateId:'beanstalk-adventure',title:'Hanuman’s Courage',language:'Hindi',characterGuide:'Source-specific characters',completion:defaultBookCompletion(),pages:[{id:'spread-1',title:'Beginning',original:'जय हनुमान ज्ञान गुन सागर।',meaning:'A child-friendly meaning.',sourceReference:'Page 1',scene:'A peaceful forest',blueprint:'reference-beanstalk-landscape',layoutReason:'Open sky for text',image:'spread-01.png',layout:'story-scene',fontSize:16,imageScale:100}]});
test('completion metadata round-trips while legacy books remain unchanged',()=>{
 const book=fixture();book.completion.isbn='978-1-23456-789-0';book.completion.mrp='₹250';book.completion.credits='Illustrations: supplied credit\nEdition: 1';
 assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))),book);
 const legacy=fixture();delete legacy.completion;assert.deepEqual(parseTemplateBook(legacy),legacy);
 assert.deepEqual(bookArtworkFiles(book),['spread-01.png','front-cover.png','back-cover.png']);
 assert.equal(defaultBookCompletion(['front-cover.png']).frontCover.image,'front-cover-2.png');
});
test('cover assets reject traversal, collisions with interiors and duplicate front/back destinations',()=>{
 for(const image of ['../cover.png','spread-01.png','front-cover.png']){const book=fixture();book.completion.backCover.image=image;assert.throws(()=>parseTemplateBook(book),/Covers need unique/);}
 const book=fixture();book.completion.isbn=123;assert.throws(()=>parseTemplateBook(book),/ISBN/);
});
test('initial and source prompts request all completion assets without fabricated publishing facts',()=>{
 for(const prompt of [bookPrompt('id','beanstalk-adventure','Book','source.pdf','Hindi'),sourceBookPrompt({id:'id',templateId:'beanstalk-adventure',title:'Book',language:'Hindi'})]){
  assert.match(prompt,/front-cover.png/);assert.match(prompt,/back-cover.png/);assert.match(prompt,/"completion"/);assert.match(prompt,/title\/credits/);assert.match(prompt,/story-related motif/);assert.match(prompt,/Never invent an ISBN/);assert.match(prompt,/Attach the approved character sheet/);assert.match(prompt,/representative finished interior illustrations as actual visual inputs/);assert.match(prompt,/Compare each cover side by side/);assert.match(prompt,/bottom y=76–100%/);
 }
});
test('continuation requests only missing covers when all interior paintings are present',()=>{
 const book=fixture(),prompt=continuationPrompt(book,['spread-01.png','front-cover.png']);
 assert.match(prompt,/images\/back-cover.png/);assert.doesNotMatch(prompt,/images\/front-cover.png/);assert.doesNotMatch(prompt,/images\/spread-01.png\nComposition:/);assert.match(prompt,/finished interior references: images\/spread-01.png/);assert.doesNotMatch(prompt,/No further generation needed/);assert.match(prompt,/square 210 × 210 mm/);
 assert.match(continuationPrompt(book,bookArtworkFiles(book)),/No further generation needed/);
});
test('portable book includes front, title/credits, untouched interiors, then back with blank ISBN/MRP space',()=>{
 const book=fixture();book.completion.blurb='<script>bad()</script>';book.completion.easterEgg='Find the tiny leaf.';
 const urls=Object.fromEntries(bookArtworkFiles(book).map(n=>[n,'images/'+n]));const html=renderTemplateBook(book,urls);
 assert.ok(html.indexOf('aria-label="Front cover"')<html.indexOf('aria-label="Title and credits"'));
 assert.ok(html.indexOf('aria-label="Title and credits"')<html.indexOf('data-spread="1"'));
 assert.ok(html.indexOf('data-spread="1"')<html.indexOf('aria-label="Back cover"'));
 assert.match(html,/Reserved blank barcode space/);assert.match(html,/>ISBN</);assert.match(html,/>MRP</);assert.match(html,/Find the tiny leaf/);assert.doesNotMatch(html,/<script>bad/);
 assert.equal((html.match(/data-print-width="210"/g)||[]).length,3);
 assert.match(html,/@page completion\{size:210mm 210mm/);
 const page=renderTemplatePage(book,0,urls);assert.doesNotMatch(page,/aria-label="Front cover"|aria-label="Back cover"|aria-label="Title and credits"/);assert.match(page,/data-spread="1"/);
});

test('editable ZIP and account storage keep cover files and completion metadata together',async()=>{
 const {zipSync,strToU8}=await import('fflate');const {readTemplateArchive}=await import('../lib/template-archive.ts');
 const {uploadDraft,downloadDraft}=await import('../lib/template-storage.ts');
 const book=fixture(),files=Object.fromEntries(bookArtworkFiles(book).map(name=>['images/'+name,strToU8(name)]));
 const unpacked=readTemplateArchive(zipSync({'book.json':strToU8(JSON.stringify(book)),...files}));
 assert.deepEqual(parseTemplateBook(JSON.parse(new TextDecoder().decode(unpacked['book.json']))),book);
 for(const name of bookArtworkFiles(book))assert.deepEqual(unpacked['images/'+name],files['images/'+name]);
 const original=globalThis.fetch,assets=new Map();let saved;
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/library/books'){saved=JSON.parse(options.body);saved.book=parseTemplateBook(saved.book,saved.id);return Response.json({revision:1});}
  if(options.method==='HEAD')return new Response(null,{status:assets.has(path)?200:404});
  if(options.method==='PUT'){assets.set(path,options.body);return Response.json({});}
  return new Response(assets.get(path));
 };
 try{
  const images=Object.fromEntries(bookArtworkFiles(book).map(name=>[name,new Blob([name],{type:'image/png'})]));
  await uploadDraft({id:book.projectId,templateId:book.templateId,title:book.title,language:book.language,book,images,updated:1},'reader@example.com');
  const restored=await downloadDraft({...saved,revision:1},'reader@example.com');
  assert.deepEqual(restored.book,book);
  for(const name of bookArtworkFiles(book))assert.equal(await restored.images[name].text(),name);
 }finally{globalThis.fetch=original;}
});
