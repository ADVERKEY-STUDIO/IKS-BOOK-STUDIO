import test from 'node:test';
import assert from 'node:assert/strict';
import { illustrationBatchPrompt } from '../lib/illustration-batching.ts';
import { bookPrompt, continuationPrompt } from '../lib/template-book.ts';
import { notebookArtworkRequest } from '../lib/notebook-prompt.ts';
import { imageDevelopmentPrompt } from '../lib/image-first-book.ts';

const pages = Array.from({length: 25}, (_, i) => ({
  id: `p${i + 1}`, image: `scene-${i + 1}.png`, title: `Scene ${i + 1}`,
  original: `Passage ${i + 1}`, meaning: '', scene: `Draw passage ${i + 1}`,
  sourceReference: `Page ${i + 1}`, layout: 'art-right', fontSize: 16, imageScale: 100,
}));
const book = { format: 'iks-template-book-v1', projectId: 'test', templateId: 'painted',
  title: 'Book', language: 'English', characterGuide: 'Consistent characters', pages };

test('batch queues preserve every filename and handle short and exact final batches', () => {
  for (const count of [0, 1, 10, 20, 25, 32]) {
    const names = Array.from({length: count}, (_, i) => `scene-${i + 1}.png`);
    const prompt = illustrationBatchPrompt('Complete.zip', names);
    const rows = prompt.split('\n').filter(line => /^Batch \d+:/.test(line));
    assert.equal(rows.length, Math.ceil(count / 10));
    assert.deepEqual(rows.flatMap(row => row.split(': ')[1].split(', ')), names.map(name => `images/${name}`));
    assert.ok(rows.every(row => row.split(': ')[1].split(', ').length <= 10));
  }
});

test('real continuation prompts resume only the missing queue, including the final five', () => {
  for (const done of [0, 10, 20, 25]) {
    const prompt = continuationPrompt(book, pages.slice(0, done).map(p => p.image));
    assert.match(prompt, new RegExp(`There are ${25 - done} illustrations`));
    for (const p of pages.slice(0, done)) assert.ok(!prompt.includes(`images/${p.image}`));
    for (const p of pages.slice(done)) assert.ok(prompt.includes(`images/${p.image}`));
    assert.doesNotMatch(prompt, /Complete all remaining scenes in this one request/);
  }
});

test('all multi-image prompt paths use checkpoints and final automatic packaging', () => {
  const prompts = [
    bookPrompt('test', 'painted', 'Book', 'source.pdf', 'English'),
    bookPrompt('test', 'iks-notes', 'Book', 'source.pdf', 'English'),
    continuationPrompt(book, []), imageDevelopmentPrompt(book),
    notebookArtworkRequest({...book, templateId: 'iks-notes', templateRevision: 2, pages: pages.map(p => ({...p, blueprint: 'reference-notes-dense-concept'}))}, []),
  ];
  for (const prompt of prompts) {
    assert.match(prompt, /UP TO 10 PER REQUEST/);
    assert.match(prompt, /STOP until that next request/);
    assert.match(prompt, /FINAL BATCH: In the same response, automatically create/);
    assert.match(prompt, /request the previous batch ZIPs/);
    assert.doesNotMatch(prompt, /COMPLETE IN ONE GO/);
  }
});


test('missing covers share the ten-image budget with interiors', () => {
  const completion = {frontCover: {image: 'front-cover.png', scene: 'Front'}, backCover: {image: 'back-cover.png', scene: 'Back'}, easterEgg: 'Leaf'};
  const prompt = continuationPrompt({...book, pages: pages.slice(0, 9), completion}, []);
  const rows = prompt.split('\n').filter(line => /^Batch \d+:/.test(line));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].split(': ')[1].split(', ').length, 10);
  assert.equal(rows[1], 'Batch 2: images/back-cover.png');
  assert.match(prompt, /Covers use their separate square dimensions/);
});


test('Chalisa four-image continuation keeps the complete queue and source meanings',()=>{
 const chalisa={...book,pages:pages.map(p=>({...p,meaning:'Hindi and English meaning and moral for '+p.id}))};
 const prompt=continuationPrompt(chalisa,pages.slice(0,4).map(p=>p.image),undefined,4);
 const rows=prompt.split('\n').filter(line=>/^Batch \d+:/.test(line));
 assert.equal(rows.length,6);
 assert.ok(rows.every(row=>row.split(': ')[1].split(', ').length<=4));
 assert.deepEqual(rows.flatMap(row=>row.split(': ')[1].split(', ')),pages.slice(4).map(p=>`images/${p.image}`));
 assert.match(prompt,/UP TO 4 PER REQUEST/);
 assert.doesNotMatch(prompt,/UP TO 10 PER REQUEST/);
 assert.match(prompt,/Meaning and moral context: Hindi and English meaning and moral for p5/);
 assert.match(prompt,/STOP until that next request/);
});
