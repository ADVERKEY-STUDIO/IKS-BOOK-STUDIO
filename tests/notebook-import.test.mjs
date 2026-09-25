import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTemplateBook,importTemplateManuscript,renderTemplateBook} from '../lib/template-book.ts';
import {notebookOriginal} from '../lib/notebook-content.ts';
import {imageGeometryIssue} from '../lib/template-layouts.ts';
import {readTemplateArchive} from '../lib/template-archive.ts';
import {zipSync,strToU8} from 'fflate';
const fixture=()=>{const sections=Array.from({length:4},(_,i)=>({heading:`Concept ${i+1}`,body:'A complete source-grounded explanation.'}));return {format:'iks-template-book-v1',templateRevision:2,projectId:'generated',templateId:'iks-notes',title:'Study notes',language:'English',characterGuide:'Pen drawings',pages:[{id:'notes-01',title:'Language',blueprint:'reference-notes-dense-concept',sourceReference:'Source page 4',noteSections:sections,original:notebookOriginal(sections),meaning:'Study the relationships.',artSlots:[1,2].map(slot=>({slot,asset:'images/page-01.png',scene:'A diagram of relationships.',crop:'contain',geometry:{x:'79%'}}))}]};};
test('imports generated artSlots ZIP and preserves text and artwork destination',()=>{
 const input=fixture(),before=structuredClone(input);
 const archive=readTemplateArchive(zipSync({'book.json':strToU8(JSON.stringify(input)),'images/page-01.png':new Uint8Array([1])}));
 const book=importTemplateManuscript(JSON.parse(new TextDecoder().decode(archive['book.json'])),'local','iks-notes');
 assert.equal(book.pages[0].image,'page-01.png');assert.ok(archive['images/'+book.pages[0].image]);
 assert.equal(book.pages[0].original,input.pages[0].original);assert.deepEqual(input,before);
 assert.equal(book.pages[0].noteSections[0].sourceReference,'Source page 4');
 assert.equal(book.pages[0].artworkFit,'contain');assert.equal(book.pages[0].fontSize,10.5);
 assert.deepEqual(parseTemplateBook(book),book);
 assert.equal(imageGeometryIssue(book,book.pages[0],1024,1024),undefined);
 const html=renderTemplateBook(book,{'page-01.png':'images/page-01.png'});
 assert.equal((html.match(/class="note-slot-art"/g)||[]).length,2);
 assert.doesNotMatch(html,/left:-/);
});
test('rejects unsafe, ambiguous and incomplete slot declarations',()=>{
 for(const alter of [p=>p.artSlots[0].asset='../page.png',p=>p.artSlots[0].asset='images/../page.png',p=>p.artSlots[1].asset='images/other.png',p=>p.artSlots.pop(),p=>p.artSlots[1].slot=1,p=>p.artSlots[0].crop='cover']){
  const input=fixture();alter(input.pages[0]);assert.throws(()=>parseTemplateBook(input),/Spread 1/);
 }
});
test('missing and invalid canonical image fields give actionable page-specific errors',()=>{
 for(const image of [undefined,null,123,'x'.repeat(101)]){const input=fixture();delete input.pages[0].artSlots;input.pages[0].image=image;assert.throws(()=>parseTemplateBook(input),/Spread 1.*image/);}
});
test('canonical malformed fields and differing source text are not silently repaired',()=>{
 const input=fixture();input.pages[0].image=123;assert.throws(()=>parseTemplateBook(input),/Spread 1.*image/);
 const mismatch=fixture();mismatch.pages[0].original='Different text';assert.throws(()=>parseTemplateBook(mismatch),/exactly match/);
});
test('ordinary full-page notebook artwork keeps canvas bounds and slot recovery survives continuation',async()=>{
 const {continuationPrompt,bookPrompt}=await import('../lib/template-book.ts');
 const book=parseTemplateBook(fixture());
 assert.match(continuationPrompt(book,[]),/ARTWORK FIT: contain/);
 assert.match(bookPrompt('test','iks-notes','Study','source.pdf','English'),/Do not replace these fields with artSlots/);
 delete book.pages[0].artworkFit;
 const canonical=parseTemplateBook(book);
 assert.match(imageGeometryIssue(canonical,canonical.pages[0],1024,1024),/requires/);
 assert.match(renderTemplateBook(canonical,{'page-01.png':'images/page-01.png'}),/class="note-art-window"/);
});
