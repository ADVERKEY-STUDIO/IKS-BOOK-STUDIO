import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTemplateBook,renderTemplateBook,renderTemplatePage,continuationPrompt} from '../lib/template-book.ts';
import {parseBookGlossary,glossaryMarkdown} from '../lib/book-glossary.ts';
import {sourceBookPrompt} from '../lib/visual-direction.ts';
import {bookArtworkFiles} from '../lib/book-completion.ts';
import {singleBook} from './fixtures/chalisa-single-spread.mjs';

const entry={term:'ज्योति',hindi:'दिव्य प्रकाश।',english:'Divine light.',sourceReference:'Chaupai 2'};
test('glossary round-trips without changing source or illustration counts and renders only at book end',()=>{
 const raw=singleBook(2);raw.glossary=Array.from({length:9},(_,i)=>({...entry,term:entry.term+i}));
 const book=parseTemplateBook(raw);
 assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))),book);
 assert.equal(book.pages.length,2);assert.equal(bookArtworkFiles(book).length,2);
 const html=renderTemplateBook(book);
 assert.equal((html.match(/class="spread glossary-spread"/g)||[]).length,2);
 assert.ok(html.indexOf('class="spread glossary-spread"')>html.indexOf('data-spread="2"'));
 assert.match(html,/<span class="chalisa-verse">/);
 assert.match(html,/chalisa-verse\{color:#8b3628/);
 assert.doesNotMatch(renderTemplatePage(book,0),/class="spread glossary-spread"/);
 assert.match(glossaryMarkdown(book.glossary),/Divine light/);
});
test('glossary rejects invalid input and escapes untrusted source text',()=>{
 assert.throws(()=>parseBookGlossary({term:'x'}),/Glossary/);
 assert.throws(()=>parseBookGlossary([{...entry,english:'x'.repeat(161)}]),/english/);
 const book=parseTemplateBook({...singleBook(1),glossary:[{...entry,term:'<script>alert(1)</script>'}]});
 assert.match(renderTemplateBook(book),/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
test('initial prompts carry reviewed text, glossary and final overlay checks; continuation retains art corrections',()=>{
 const prompt=sourceBookPrompt({id:'test',title:'Durga',templateId:'beanstalk-adventure',language:'Hindi',source:new File(['source'],'source.pdf'),contentReference:new File(['ref'],'scan.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'',notes:''}});
 for(const phrase of ['DEVOTIONAL LANGUAGE','top-level glossary array','editorial-review.txt','human face and curved horns','clouds must not hide heads','Preserve supplied meanings unless the user authorizes adaptation'])assert.ok(prompt.includes(phrase),phrase);
 const continuation=continuationPrompt(parseTemplateBook(singleBook(1)),[]);
 assert.match(continuation,/human face and two curved horns/);
 assert.match(continuation,/cloud must never mask anatomy/);
});
