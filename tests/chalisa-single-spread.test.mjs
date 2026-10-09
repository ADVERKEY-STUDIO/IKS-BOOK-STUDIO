import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {singleBook} from './fixtures/chalisa-single-spread.mjs';
import {parseTemplateBook,renderTemplateBook,continuationPrompt} from '../lib/template-book.ts';
import {chalisaSingleBlueprints,blueprintFor,plannedTextBlocks,planTemplateBook} from '../lib/template-layouts.ts';
import {validateChalisaBook,sourceBookPrompt,sourceRequestEntries} from '../lib/visual-direction.ts';
import {templateReferenceEntries} from '../lib/template-reference-package.ts';
import {samplePrompt} from '../lib/chatgpt-handoff.ts';

const draft={id:'single',title:'Durga Chalisa',templateId:'beanstalk-adventure',language:'Hindi',source:new File(['source'],'source.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'Durga',notes:''}};
test('all 41 chaupais survive import, editable rendering and restore as 41 two-page spreads',()=>{
 const book=parseTemplateBook(singleBook());
 assert.equal(book.pages.length,41);
 assert.doesNotThrow(()=>validateChalisaBook(book,{bilingual:true,facingPages:true}));
 assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))),book);
 assert.deepEqual(planTemplateBook(book).pages.map(p=>p.blueprint),book.pages.map(p=>p.blueprint));
 for(const page of book.pages){
  const blueprint=blueprintFor(book,page),blocks=plannedTextBlocks(page,blueprint).filter(b=>b.text);
  assert.equal(page.chalisaPages.length,1);assert.equal(blueprint.original.length,1);
  assert.deepEqual(blueprint.art,[{x:0,y:0,w:100,h:100}]);
  assert.equal(blocks.length,1);
  assert.ok(blocks[0].text.includes(page.chalisaPages[0].original));
  for(const label of ['हिंदी अर्थ:','English meaning:','हिंदी नैतिक शिक्षा:','English moral:'])assert.ok(blocks[0].text.includes(label));
 }
 const html=renderTemplateBook(book,{});
 assert.equal((html.match(/data-text-region="1"/g)||[]).length,41);
 assert.doesNotMatch(html,/<div[^>]*data-text-region="3"/);
 const invalid=singleBook(2);invalid.pages[0].chalisaPages.push(invalid.pages[1].chalisaPages[0]);
 assert.throws(()=>parseTemplateBook(invalid),/exactly one/);
 assert.throws(()=>validateChalisaBook(invalid,{facingPages:true}),/exactly ONE/);
});
test('copied, sample, ZIP and continuation prompts agree on one verse, clouds, source matching and bounded batches',async()=>{
 const entries=await sourceRequestEntries(draft),prompt=sourceBookPrompt(draft);
 assert.equal(new TextDecoder().decode(entries['START-HERE.txt']),prompt);
 for(const value of [prompt,samplePrompt(draft),continuationPrompt(parseTemplateBook(singleBook(2)),[])]){
  assert.match(value,/ONE (?:COMPLETE CHAUPAI|CHAUPAI|complete two-line chaupai|chaupai)/);
  assert.match(value,/cloud behind/);
  assert.match(value,/cut-paper/);
  assert.doesNotMatch(value,/ceil\(N \/ 2\)|two consecutive chaupais|LEFT PHYSICAL PAGE|RIGHT PHYSICAL PAGE|LEFT chaupai|RIGHT chaupai|Never give one chaupai an entire/);
 }
 const continuation=continuationPrompt(parseTemplateBook(singleBook(3)),['spread-1.png']);
 assert.doesNotMatch(continuation,/images\/spread-1.png/);
 assert.match(continuation,/images\/spread-2.png/);
 assert.match(continuation,/UP TO 4 PER REQUEST/);
 assert.match(prompt,/41 source entries = 41 spread artworks and 82 physical content pages/);
});
test('request ZIP carries approved actual samples and only single-verse layout specifications',async()=>{
 const fetched=[];
 const refs=await templateReferenceEntries(draft.templateId,async url=>{
  fetched.push(url);return new Response(await readFile(new URL('../public'+url,import.meta.url)),{headers:{'content-type':'image/png'}});
 },true);
 assert.equal(fetched.length,2);
 for(const name of ['approved-cloud-right.png','approved-cloud-left.png'])assert.ok(refs['template-references/'+name].length>1000);
 const spec=JSON.parse(new TextDecoder().decode(refs['template-references/template-specification.json']));
 assert.ok(spec.blueprints.every(b=>b.original.length===1));
 assert.doesNotMatch(new TextDecoder().decode(refs['template-references/LAYOUT-INSTRUCTIONS.txt']),/LEFT chaupai|RIGHT chaupai|SELECTED SPREAD BLUEPRINT: reference-beanstalk/);
});
test('reference-based single spreads retain supplied meanings but require two short morals in both languages',()=>{
 const book=singleBook(2);
 book.pages[0].chalisaPages[0].meaning=book.pages[0].chalisaPages[0].meaning.replace('English meaning:\n','English meaning:\nAn extra supplied meaning line.\n');
 assert.doesNotThrow(()=>validateChalisaBook(book,{bilingual:true,preserveReference:true}));
 book.pages[0].chalisaPages[0].meaning=book.pages[0].chalisaPages[0].meaning.replace('English moral:','Missing label:');
 assert.throws(()=>validateChalisaBook(book,{bilingual:true,preserveReference:true}),/required labels/);
});
