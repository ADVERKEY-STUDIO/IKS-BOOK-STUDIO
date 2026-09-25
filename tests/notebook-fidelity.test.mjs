import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTemplateBook,bookPrompt} from '../lib/template-book.ts';
import {layoutIssues} from '../lib/template-layouts.ts';
const book={format:'iks-template-book-v1',templateRevision:2,projectId:'test',templateId:'iks-notes',title:'Notes',language:'English',characterGuide:'',pages:[{id:'p1',title:'Mathematics',blueprint:'reference-notes-dense-roles',layoutReason:'Four concepts',noteSections:Array.from({length:4},()=>({heading:'Key concept',body:'A **short marked phrase** explains this topic.',sourceReference:'Page 1'})),original:'',meaning:'',sourceReference:'Page 1',scene:'',image:'p.png',layout:'study',fontSize:10.5,imageScale:100}]};
test('notebook emphasis uses separate bounded inline boxes for canvas export',()=>{
 const html=renderTemplateBook(book);
 assert.match(html,/<mark>short<\/mark> <mark>marked<\/mark> <mark>phrase<\/mark>/);
 assert.match(html,/mark\{[^}]*display:inline-block/);
});
test('current dense layouts retain reference dividers and question callout',()=>{
 const html=renderTemplateBook(book);
 assert.match(html,/reference-notes-dense-roles["\]]/);
 assert.match(html,/reference-notes-dense-concept["\]][^}]*data-text-region="3"/);
});
test('sparse notebook sections are flagged for review without deleting source text',()=>{
 assert.ok(layoutIssues(book).some(s=>/sparse/i.test(s)));
});
test('generation distinguishes finished diagrams from layout guides',()=>{
 const prompt=bookPrompt('test','iks-notes','Notes','source.pdf','English');
 assert.match(prompt,/Never rasterise SVG layout guides/);
 assert.match(prompt,/REFERENCE STUDY/);
});
test('single-page previews retain the actual page number for density review',async()=>{
 const {renderTemplatePage}=await import('../lib/template-book.ts');
 const twoPages={...book,pages:[book.pages[0],{...book.pages[0],id:'p2'}]};
 assert.match(renderTemplatePage(twoPages,1),/data-spread="2"/);
});
