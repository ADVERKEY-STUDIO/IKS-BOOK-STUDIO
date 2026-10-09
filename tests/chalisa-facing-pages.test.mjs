import test from 'node:test';
import assert from 'node:assert/strict';
import {facingBook} from './fixtures/chalisa-facing-pages.mjs';
import {parseTemplateBook, renderTemplateBook, continuationPrompt} from '../lib/template-book.ts';
import {plannedTextBlocks,blueprintFor,planTemplateBook,chalisaSingleBlueprints,chalisaFullSpreadBlueprints,blueprintPrompt,blueprintSvg} from '../lib/template-layouts.ts';
import {validateChalisaBook,sourceRequestEntries} from '../lib/visual-direction.ts';
import {chalisaSpreadText} from '../lib/chalisa-pages.ts';

test('41 physical pages use 21 artwork files, with only the final right page empty',()=>{
 for(const count of [1,2,3,40,41]) {
  const book=parseTemplateBook(facingBook(count));
  assert.equal(book.pages.length,Math.ceil(count/2));
  assert.equal(book.pages.reduce((n,p)=>n+p.chalisaPages.length,0),count);
  assert.equal(new Set(book.pages.map(p=>p.image)).size,Math.ceil(count/2));
  assert.doesNotThrow(()=>validateChalisaBook(book,{bilingual:true,facingPages:true}));
  assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))),book);
 }
});
test('left and right explanations stay with their own chaupai through rendering and editing',()=>{
 const book=parseTemplateBook(facingBook()),spread=book.pages[0];
 const blocks=plannedTextBlocks(spread,blueprintFor(book,spread)).filter(b=>b.text);
 assert.equal(blocks.length,2);assert.ok(blocks[0].x+blocks[0].w<50);assert.ok(blocks[1].x>50);
 assert.ok(blocks[0].text.includes('Mother Durga'));assert.ok(!blocks[0].text.includes('three worlds'));
 assert.ok(blocks[1].text.includes('three worlds'));assert.ok(!blocks[1].text.includes('Mother Durga'));
 const edited=spread.chalisaPages.map((p,i)=>i===1?{...p,meaning:p.meaning.replace('three worlds','all three worlds')}:p);
 const restored=parseTemplateBook({...book,pages:[{...spread,chalisaPages:edited,...chalisaSpreadText(edited)}]});
 assert.equal(restored.pages[0].chalisaPages[0].meaning,spread.chalisaPages[0].meaning);
 assert.match(restored.pages[0].chalisaPages[1].meaning,/all three worlds/);
 assert.equal(planTemplateBook(book).pages[0].blueprint,'chalisa-full-spread');
 const html=renderTemplateBook(book,{'spread-1.png':'test.png'});
 assert.equal((html.match(/class="planned-art"/g)||[]).length,1);
 assert.doesNotMatch(html,/class="planned-text original reading-label/);
});
test('invalid grouping and conflicting aggregate fields are rejected; supplied reference prose is preserved',()=>{
 const raw=facingBook(3);raw.pages[0].chalisaPages.pop();
 assert.throws(()=>validateChalisaBook(raw,{facingPages:true}),/LEFT and RIGHT/);
 assert.throws(()=>parseTemplateBook({...facingBook(),pages:[{...facingBook().pages[0],meaning:'A shared moral'}]}),/conflicting explanation/);
 const reference=facingBook();reference.pages[0].chalisaPages.forEach(p=>p.meaning='Supplied paragraph retained exactly.');
 const book=parseTemplateBook(reference);
 assert.doesNotThrow(()=>validateChalisaBook(book,{facingPages:true,bilingual:true,preserveReference:true}));
 assert.throws(()=>validateChalisaBook(book,{facingPages:true,bilingual:true}),/required labels/);
 const wrong=facingBook();wrong.pages[0].chalisaPages[1].sourceReference=wrong.pages[0].chalisaPages[0].sourceReference;
 assert.throws(()=>validateChalisaBook(wrong,{facingPages:true}),/unique sourceReference/);
});
test('new requests package single-chaupai guides while saved facing-page continuation keeps its context',async()=>{
 const entries=await sourceRequestEntries({id:'facing',title:'Durga',templateId:'beanstalk-adventure',language:'Hindi',source:new File(['pdf'],'source.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'Durga',notes:''}});
 assert.ok(entries['template-references/chalisa-facing-pages-layout.svg']);
 assert.equal(JSON.parse(new TextDecoder().decode(entries['template-references/chalisa-full-spread-options.json'])).length,3);
 for(const b of chalisaSingleBlueprints)assert.ok(entries[`template-references/${b.id}-layout.svg`]);
 assert.equal(JSON.parse(new TextDecoder().decode(entries['template-references/chalisa-facing-pages.json'])).original.length,1);
 const prompt=new TextDecoder().decode(entries['START-HERE.txt']);
 assert.match(prompt,/41 source entries = 41 spread artworks and 82 physical content pages/);
 assert.match(prompt,/"chalisaPages"/);assert.doesNotMatch(prompt,/Never combine four verse lines/);
 const continuation=continuationPrompt(parseTemplateBook(facingBook(3)),[],undefined,4);
 assert.match(continuation,/LEFT PHYSICAL PAGE/);assert.match(continuation,/RIGHT PHYSICAL PAGE/);
 assert.match(continuation,/return ONE full-spread artwork/);
 assert.match(prompt,/ACTUAL selected template images and approved character sheet/);
 assert.doesNotMatch(prompt,/SELECTED SPREAD BLUEPRINT: reference-beanstalk-diagonal|roughly 44%|smaller or repositioned scenes/);
 assert.doesNotMatch(continuation,/smaller or repositioned scenes/);
});

test('full-spread guides permit painted backgrounds behind words; all reading arrangements round-trip',()=>{
 for(const b of chalisaFullSpreadBlueprints){
  assert.deepEqual(b.art,[{x:0,y:0,w:100,h:100}]);
  assert.ok(b.original[0].x+b.original[0].w<50);assert.ok(b.original[1].x>50);
  const raw=facingBook();raw.pages[0].blueprint=b.id;
  const book=parseTemplateBook(raw);
  assert.equal(planTemplateBook(book).pages[0].blueprint,b.id);
  const prompt=continuationPrompt(book,[],undefined,4);
  assert.match(prompt,/continuous edge-to-edge illustrated environment/);
  assert.match(prompt,/NOT the painted background/);
  assert.doesNotMatch(blueprintPrompt(b.id),/roughly 44%|LEFT SCENE:|further 3% canvas clearance/);
  const guide=blueprintSvg(b);
  assert.match(guide,/ONE connected illustration/);
  assert.doesNotMatch(guide,/Scene 1|Scene 2|>Meaning</);
 }
});
test('old strip and diagonal books retain coordinates until explicit full-spread rebuild',()=>{
 for(const id of ['chalisa-facing-pages','chalisa-illustrated-facing-pages']){
  const raw=facingBook();raw.pages[0].blueprint=id;
  raw.pages[0].artworkBlueprint=id;
  raw.pages[0].textPositions=[{x:14,y:7,w:33,h:80},{x:64,y:7,w:33,h:80},{x:48,y:94,w:2,h:2}];
  const old=parseTemplateBook(raw);
  assert.equal(blueprintFor(old,old.pages[0]).art[0].w,id==='chalisa-facing-pages'?13:50);
  assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(old))),old);
  const planned=planTemplateBook(old);
  assert.equal(planned.pages[0].blueprint,'chalisa-full-spread');
  assert.equal(planned.pages[0].textPositions,undefined);
  assert.equal(planned.pages[0].artworkBlueprint,undefined);
  assert.deepEqual(planned.pages[0].chalisaPages,old.pages[0].chalisaPages);
  assert.equal(old.pages[0].textPositions[0].w,33);
 }
});
