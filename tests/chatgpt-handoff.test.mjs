import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {analysisPrompt,samplePrompt,chapterPrompt,handoffEntries,canApproveSample,draftStep} from '../lib/chatgpt-handoff.ts';
import {parseVisualDirection} from '../lib/visual-direction.ts';
import {readTemplateArchive} from '../lib/template-archive.ts';
const fixture=()=>({id:'test',templateId:'bedtime-skies',title:'Chapter 1',language:'English',source:new File(['Only chapter 1'],'chapter.docx'),references:{'reference-style.png':new Blob(['ref'])},images:{'character-reference.png':new Blob(['characters']),'style-sample.png':new Blob(['sample'])},visualDirection:{audience:'9–14',characters:'Boy, girl, teacher',notes:'Flat gouache and pencil',handoff:'sample'},updated:1});
test('analysis and sample requests stop before chapter production',async()=>{
 const d=fixture();const analysis=await handoffEntries({...d,source:undefined},'analysis');
 assert.deepEqual(Object.keys(analysis).sort(),['START-HERE.txt','references/reference-style.png']);
 assert.match(analysisPrompt(),/Describe only what you can see/);
 assert.match(analysisPrompt(),/Do not generate a book or images yet/);
 assert.doesNotMatch(samplePrompt(d),/COMPLETE IN ONE GO|iks-template-book-v1/);
 assert.match(samplePrompt(d),/STOP after these two images/);
 assert.match(samplePrompt({...d,visualDirection:{...d.visualDirection,feedback:'Less gloss'}}),/REVISION REQUEST: Less gloss/);
 const entries=await handoffEntries(d,'sample');
 assert.ok(entries['source/chapter.docx']);assert.ok(entries['previous/style-sample.png']);assert.equal(entries['book.json'],undefined);
});
test('chapter generation needs approval and both images, then reuses rather than redesigns them',async()=>{
 const d=fixture();assert.equal(canApproveSample(d),true);
 assert.throws(()=>chapterPrompt(d),/Approve/);
 assert.equal(canApproveSample({...d,images:{}}),false);
 const approved={...d,visualDirection:{...d.visualDirection,handoff:'approved'}};
 assert.throws(()=>chapterPrompt({...approved,images:{}}),/Approve/);
 const text=chapterPrompt(approved);assert.match(text,/approved\/style-sample.png/);
 assert.doesNotMatch(text,/CONSISTENCY: First create|Generate an actual character reference image first/);
 const entries=await handoffEntries(approved,'chapter');assert.equal(new TextDecoder().decode(entries['approved/character-reference.png']),'characters');
 assert.ok(entries['approved/style-sample.png']);assert.ok(entries['references/reference-style.png']);
});
test('handoff metadata validates and resumes stages without changing legacy drafts',()=>{
 const d=fixture();assert.deepEqual(parseVisualDirection(d.visualDirection),d.visualDirection);
 assert.throws(()=>parseVisualDirection({...d.visualDirection,handoff:'invalid'}),/stage/);
 assert.throws(()=>parseVisualDirection({...d.visualDirection,feedback:'a'.repeat(4001)}),/feedback/);
 assert.equal(draftStep(d),1);assert.equal(draftStep({...d,visualDirection:{...d.visualDirection,handoff:'references'}}),0);
 assert.equal(draftStep({...d,book:{}}),2);
});
test('import explains mistaken request bundles and accepts completed books with extra instructions',()=>{
 const request=zipSync({'START-HERE.txt':strToU8('request'),'references/reference-a.png':new Uint8Array([1])});
 assert.throws(()=>readTemplateArchive(request),/request for ChatGPT, not a completed book/);
 const completed=zipSync({'START-HERE.txt':strToU8('notes'),'book.json':strToU8('{}')});
 assert.ok(readTemplateArchive(completed)['book.json']);
});
