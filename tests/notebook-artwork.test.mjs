import test from 'node:test';
import assert from 'node:assert/strict';
import {notebookArtworkRequest,notebookBookPrompt} from '../lib/notebook-prompt.ts';
import {continuationPrompt} from '../lib/template-book.ts';
const book={format:'iks-template-book-v1',templateRevision:2,templateId:'iks-notes',projectId:'test',title:'Science notes',language:'English',characterGuide:'',pages:[
 {id:'p1',title:'Solar eclipse',blueprint:'reference-notes-dense-concept',layoutReason:'Concept',original:'Moon between Sun and Earth.',meaning:'Compare the alignment.',sourceReference:'Source p12',scene:'Old unrelated house icon',image:'eclipse.png',layout:'study',fontSize:10.5,imageScale:100,noteSections:[{heading:'Solar alignment',body:'Moon between Sun and Earth.',sourceReference:'Source p12 figure 2'}]},
 {id:'p2',title:'Casting',blueprint:'reference-notes-dense-concept',layoutReason:'Concept',original:'Wax leaves a mould cavity.',meaning:'Follow the stages.',sourceReference:'Source p30',scene:'Old unrelated orbit icon',image:'casting.png',layout:'study',fontSize:10.5,imageScale:100}
]};
test('notebook initial and continuation requests require section-specific evidence and review',()=>{
 for(const prompt of [notebookBookPrompt('t','Science','source.pdf','English'),continuationPrompt(book,[])]){
  assert.match(prompt,/target noteSections heading/);
  assert.match(prompt,/learning objective/);
  assert.match(prompt,/artwork-review.md/);
  assert.match(prompt,/Reject and regenerate generic, incorrect or mismatched diagrams/);
  assert.doesNotMatch(prompt,/botanical sprigs with individual serrated leaves/);
 }
 const missing=continuationPrompt(book,['eclipse.png']);
 assert.match(missing,/FILE: images\/casting.png/);assert.doesNotMatch(missing,/FILE: images\/eclipse.png/);
 assert.match(missing,/Wax leaves a mould cavity/);assert.match(missing,/SOURCE REFERENCE: Source p30/);
});
test('correction targets all existing images and preserves manuscript with exact page evidence',()=>{
 const before=structuredClone(book),prompt=notebookArtworkRequest(book,['eclipse.png','casting.png'],true);
 assert.match(prompt,/REPLACE ALL NOTEBOOK ARTWORK/);
 assert.match(prompt,/FILE: images\/eclipse.png/);assert.match(prompt,/FILE: images\/casting.png/);
 assert.match(prompt,/Section 1: Solar alignment/);assert.match(prompt,/Source p12 figure 2/);
 assert.match(prompt,/Keep book.json, all wording, page order/);
 assert.match(prompt,/old scene briefs are untrusted suggestions/);
 assert.match(prompt,/Upload all images ZIP/);
 assert.deepEqual(book,before);
});
