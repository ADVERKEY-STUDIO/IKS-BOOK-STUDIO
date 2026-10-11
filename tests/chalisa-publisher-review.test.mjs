import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTemplateBook,renderTemplateBook,renderTemplatePage,continuationPrompt} from '../lib/template-book.ts';
import {parseBookSections,bookSectionsMarkdown,sectionColumns} from '../lib/book-sections.ts';
import {defaultBookCompletion,bookArtworkFiles,coverArtworkPrompt} from '../lib/book-completion.ts';
import {sourceBookPrompt} from '../lib/visual-direction.ts';
import {singleBook} from './fixtures/chalisa-single-spread.mjs';

const sections=[
 {kind:'copyright',title:'Credits',body:'Publisher supplied rights text.\n\nEdition notes.',sourceReference:'Copyright.pdf'},
 {kind:'introduction',title:'Introduction',body:'हिंदी परिचय।\n\nEnglish introduction.',sourceReference:'Introduction.pdf'},
 {kind:'aarti',title:'Aarti',body:'A complete supplied verse.\n\nIts bilingual meanings.',sourceReference:'Source.pdf page 42'}
];
test('publisher sections survive import/export and keep section order without increasing artwork count',()=>{
 const raw=singleBook(2);raw.bookSections=sections;raw.completion=defaultBookCompletion();raw.glossary=[{term:'शक्ति',hindi:'शक्ति।',english:'Power.',sourceReference:'Chaupai 1'}];
 const book=parseTemplateBook(raw);assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))),book);
 assert.equal(book.pages.length,2);assert.equal(bookArtworkFiles(book).length,4);
 const html=renderTemplateBook(book),markers=['aria-label="Front cover"','aria-label="Title and credits"','data-section-kind="copyright"','data-section-kind="introduction"','data-spread="1"','data-section-kind="aarti"','class="spread glossary-spread"','aria-label="Back cover"'];
 for(let i=1;i<markers.length;i++)assert.ok(html.indexOf(markers[i-1])<html.indexOf(markers[i]),markers[i]);
 assert.doesNotMatch(renderTemplatePage(book,0),/data-section-kind/);
 assert.match(bookSectionsMarkdown(book.bookSections,'back'),/bilingual meanings/);
 assert.doesNotMatch(bookSectionsMarkdown(book.bookSections,'front'),/A complete supplied verse/);
 assert.equal(sectionColumns(sections[1].body).join(''),sections[1].body);
});
test('publisher section validation rejects unsupported content and safely renders source text',()=>{
 assert.throws(()=>parseBookSections({}),/Book sections/);
 assert.throws(()=>parseBookSections([{...sections[0],kind:'script'}]),/Invalid/);
 assert.throws(()=>parseBookSections([{...sections[0],body:'x'.repeat(2401)}]),/body/);
 assert.throws(()=>parseBookSections(Array(41).fill(sections[0])),/at most/);
 const raw=singleBook(1);raw.bookSections=[{...sections[0],body:'<script>alert(1)</script>'}];
 const html=renderTemplateBook(parseTemplateBook(raw));assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);
});
test('supplied long back-cover copy round-trips and reserves a larger reading area',()=>{
 const raw=singleBook(1);raw.completion=defaultBookCompletion();raw.completion.blurb='Publisher copy. '.repeat(80);
 const book=parseTemplateBook(raw);assert.equal(book.completion.blurb,raw.completion.blurb);
 assert.match(renderTemplateBook(book),/back-copy long-blurb/);
 assert.match(coverArtworkPrompt(book.completion),/y=6–72% quiet/);
 raw.completion.blurb='x'.repeat(1601);assert.throws(()=>parseTemplateBook(raw),/Back-cover blurb/);
});
test('initial and resumed production both carry the publisher corrections',()=>{
 const prompt=sourceBookPrompt({id:'review',title:'Durga',templateId:'beanstalk-adventure',language:'Hindi',source:new File(['source'],'source.pdf'),contentReference:new File(['reference'],'scan.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'',notes:''}});
 const continuation=continuationPrompt(parseTemplateBook(singleBook(1)),[]);
 for(const p of [prompt,continuation])for(const phrase of ['REFERENCE TEXT LOCK','DEVOTIONAL MORALS','bookSections','saffron head drape','fallen still figures','exact URL and access date','publisher-review.txt','omits Aarti by default','remove Aarti promises','WHOLE-BOOK FOOT AUDIT','one distinct inward big toe and four progressively smaller toes','verify no toe remains exposed'])assert.ok(p.includes(phrase),phrase);
});
