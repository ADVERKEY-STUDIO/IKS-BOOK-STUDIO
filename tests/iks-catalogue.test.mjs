import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionPack, webUrl } from '../lib/iks-catalogue.ts';
test('selection export includes only selected sources and their content, without embedding PDF bytes', () => {
 const state = {books: [{id:'a',title:'First',pdf:new Blob(['%PDF-'])},{id:'b',title:'Second'}], selected:['a'], cards:[{id:'1',bookId:'a',pages:'12–13'},{id:'2',bookId:'b',pages:'20'}]};
 const pack = selectionPack(state);
 assert.equal(pack.books.length, 1); assert.equal(pack.books[0].attachedPdf,true); assert.equal('pdf' in pack.books[0],false); assert.deepEqual(pack.content,[state.cards[0]]);
});
test('catalogue links accept only web protocols', () => {
 assert.equal(webUrl('javascript:alert(1)'), ''); assert.equal(webUrl('data:text/html,hello'), ''); assert.equal(webUrl('https://archive.org/details/book'),'https://archive.org/details/book');
});

import { readFileSync } from 'node:fs';
import { mergeCatalogue, filterBooks, kidsCategories, readerAges } from '../lib/iks-catalogue.ts';
const seed = JSON.parse(readFileSync(new URL('../lib/iks-catalogue-seed.json', import.meta.url)));
test('all 458 clean sources are bundled with distinct PDFs, supported categories and edition evidence', () => {
 assert.equal(seed.length,458);
 assert.equal(new Set(seed.map(b=>b.id)).size,458);
 assert.equal(new Set(seed.map(b=>b.pdfUrl)).size,458);
 assert.equal(kidsCategories.length,13);
 for (const b of seed) {
  assert.ok(Number(b.year)<=1925 && Number(b.year)>=1810);
  assert.ok(webUrl(b.pdfUrl).startsWith('https://archive.org/download/'));
  assert.ok(webUrl(b.dateEvidenceUrl));
  assert.ok(b.categories.length && b.categories.every(c=>kidsCategories.includes(c)));
  assert.ok(readerAges.includes(b.age));
 }
});
test('existing libraries gain the collection once without losing edits, attachments, cards or selections', () => {
 const edited = {...seed[0], title:'My edited title',pdf:new Blob(['%PDF-']),pdfName:'local.pdf'};
 const saved = {books:[edited,{id:'personal',title:'Personal source'}], cards:[{id:'note',bookId:edited.id}],selected:[edited.id,'personal']};
 const merged = mergeCatalogue(saved,seed);
 assert.equal(merged.books.length,459);
 assert.equal(merged.books[0],edited);
 assert.deepEqual(merged.cards,saved.cards);
 assert.deepEqual(merged.selected,saved.selected);
 assert.deepEqual(mergeCatalogue(merged,seed),merged);
 assert.equal(mergeCatalogue(undefined,seed).books.length,458);
});
test('every category is browsable and search and adaptation-age filters compose', () => {
 for (const c of kidsCategories) assert.ok(filterBooks(seed,[], '',c,'').length>0);
 const book = seed[0];
 assert.ok(filterBooks(seed,[],`  ${book.title.toUpperCase()}  `,book.categories[0],book.age).some(b=>b.id===book.id));
 assert.equal(filterBooks(seed,[],'no-such-book-xyz','','').length,0);
});
