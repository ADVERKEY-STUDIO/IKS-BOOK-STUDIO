import test from 'node:test';
import assert from 'node:assert/strict';
import {facingBook} from './fixtures/chalisa-facing-pages.mjs';
import {parseTemplateBook, renderTemplateBook, continuationPrompt} from '../lib/template-book.ts';
import {plannedTextBlocks,blueprintFor,planTemplateBook} from '../lib/template-layouts.ts';
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
 assert.equal(planTemplateBook(book).pages[0].blueprint,'chalisa-facing-pages');
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
test('request packages the dedicated facing-page guide and continuation keeps side-specific context',async()=>{
 const entries=await sourceRequestEntries({id:'facing',title:'Durga',templateId:'beanstalk-adventure',language:'Hindi',source:new File(['pdf'],'source.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'Durga',notes:''}});
 assert.ok(entries['template-references/chalisa-facing-pages-layout.svg']);
 assert.equal(JSON.parse(new TextDecoder().decode(entries['template-references/chalisa-facing-pages.json'])).original.length,2);
 const prompt=new TextDecoder().decode(entries['START-HERE.txt']);
 assert.match(prompt,/41 entries = 21 spread artworks, not 41/);
 assert.match(prompt,/"chalisaPages"/);assert.doesNotMatch(prompt,/Never combine four verse lines/);
 const continuation=continuationPrompt(parseTemplateBook(facingBook(3)),[],undefined,4);
 assert.match(continuation,/LEFT PHYSICAL PAGE/);assert.match(continuation,/RIGHT PHYSICAL PAGE/);
 assert.match(continuation,/return ONE full-spread artwork/);
});
