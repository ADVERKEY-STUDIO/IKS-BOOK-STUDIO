import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectManuscriptArchive,manuscriptRepairRequest} from '../lib/manuscript-import.ts';
const encode=s=>new TextEncoder().encode(s);
const manuscript='# INTRODUCTION\n\nA beginning.\n\n# CHAPTER 01: Motion\n\nObjects move.';
const manifest={format:'iks-source-assets-v1',sourceImages:[],verses:[{id:'V02',sectionNumber:2,sourcePage:3,reference:'Source verse',sanskrit:'सत्यं वद ।',status:'verified'},{id:'V03',sectionNumber:2,sourcePage:3,reference:'Source verse',sanskrit:'धर्मं चर ।',status:'verified'}],extractionNotes:[]};
test('missing verses retain chapter discovery and report every absent block',()=>{
 const result=inspectManuscriptArchive({'01.md':encode(manuscript),'source-manifest.json':encode(JSON.stringify(manifest))},'Ages 10–12');
 assert.equal(result.result.sections.length,2);assert.match(result.errors.join(' '),/V02/);assert.match(result.errors.join(' '),/V03/);
 assert.match(manuscriptRepairRequest(result.errors),/Do not invent Sanskrit/);
});
test('Finder-wrapped ZIPs ignore metadata and use the nested manifest',()=>{
 const text=manuscript+'\n\n:::sloka V02\nसत्यं वद ।\n:::\n\n:::sloka V03\nधर्मं चर ।\n:::';
 const result=inspectManuscriptArchive({'Book/01.md':encode(text),'Book/._01.md':encode('# CHAPTER 99: Garbage'),'__MACOSX/Book/._01.md':encode('garbage'),'Book/source-manifest.json':encode(JSON.stringify(manifest))},'Ages 10–12');
 assert.deepEqual(result.errors,[]);assert.equal(result.result.sections.length,2);assert.match(result.result.sections[1].html,/data-source-verse="V03"/);
});
test('ambiguous manifests and malformed JSON keep sections visible but cannot be accepted',()=>{
 for(const files of [{'source-manifest.json':encode('{')},{'a/source-manifest.json':encode('{}'),'b/source-manifest.json':encode('{}')}]){
 const result=inspectManuscriptArchive({'01.md':encode(manuscript),...files},'Ages 10–12');assert.equal(result.result.sections.length,2);assert.equal(result.errors.length,1);
 }
});
