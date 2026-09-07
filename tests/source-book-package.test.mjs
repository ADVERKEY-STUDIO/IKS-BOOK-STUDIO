import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceBookManifest,attachSourceBookManifest,sourceImageSlots} from '../lib/source-book-package.ts';
import {parseExternalManuscript,upgradeExternalIllustrationSlots,buildExternalAiPrompt,buildExternalIllustrationPromptPack} from '../lib/external-manuscript.ts';
import {normalizeSourceBookOptions} from '../lib/source-book-options.ts';
const verse='सत्यं वद ।\nधर्मं चर ।';
const data=()=>({format:'iks-source-assets-v1',sourceImages:[{id:'SRC01',sourcePage:3,originalPath:'source-images/SRC01.png',cleanedPath:'cleaned-source-images/SRC01.png',caption:'Seeds in the source book',alt:'Seeds',status:'available',placements:[{id:'P1',sectionNumber:1,anchorText:'Observe the seeds carefully.',reason:'Shows the seeds being discussed.'},{id:'P2',sectionNumber:1,anchorText:'Observe the seeds carefully.',reason:'Another view linked to the same passage.'}]}],verses:[{id:'V01',sectionNumber:1,sourcePage:4,reference:'Source fixture verse',sanskrit:verse,translation:'Speak truth; practise dharma.',status:'verified'}],extractionNotes:[]});
test('source package preserves verse line breaks and multiple image occurrences at one context anchor',()=>{
 const manifest=parseSourceBookManifest(data());const result=attachSourceBookManifest(parseExternalManuscript('# INTRODUCTION\n\nObserve the seeds carefully.\n\n{{SLOKA:V01}}','Ages 10–12'),manifest);
 assert.match(result.sections[0].html,/सत्यं वद ।<br>धर्मं चर ।/);assert.doesNotMatch(result.sections[0].html,/\{\{SLOKA/);
 const slots=sourceImageSlots(manifest,result.sections);assert.equal(slots.length,2);assert.equal(slots[0].anchorId,slots[1].anchorId);assert.notEqual(slots[0].id,slots[1].id);
 const upgraded=upgradeExternalIllustrationSlots([{id:1,title:'Introduction'}],slots);assert.equal(upgraded.filter(s=>s.sourceImageId).length,2);assert.equal(upgraded.find(s=>s.id==='P1').status,'pending');
});
test('source manifest rejects unsafe paths, duplicate identities, fabricated availability and unknown anchors',()=>{
 const bad=data();bad.sourceImages[0].originalPath='../source.png';assert.throws(()=>parseSourceBookManifest(bad),/invalid/);
 const duplicate=data();duplicate.verses[0].id='SRC01';assert.throws(()=>parseSourceBookManifest(duplicate),/duplicate/);
 const unavailable=data();unavailable.sourceImages[0].status='unavailable';assert.throws(()=>parseSourceBookManifest(unavailable),/failure reason/);
 const result=parseExternalManuscript('# INTRODUCTION\n\nDifferent paragraph.\n\n{{SLOKA:V01}}','Ages 10–12');assert.throws(()=>attachSourceBookManifest(result,parseSourceBookManifest(data())),/exactly match/);
});
test('uncertain verses remain unchanged and generate review notes',()=>{
 const input=data();input.verses[0].status='uncertain';input.verses[0].reviewNote='One source word is unclear.';const manifest=parseSourceBookManifest(input);
 const result=attachSourceBookManifest(parseExternalManuscript('# INTRODUCTION\n\nObserve the seeds carefully.\n\n{{SLOKA:V01}}','Ages 10–12'),manifest);
 assert.equal(manifest.verses[0].sanskrit,verse);assert.match(result.sections[0].issues.join(' '),/unclear/);
});
test('prompts request normal artwork plus source originals and cleaned copies, respecting verse companions and styles',()=>{
 const settings={title:'Garden',sourceName:'Garden.pdf',audience:'Ages 10–12',readingLevel:'Reader',language:'English',bookType:'Book',aesthetic:'Calm',illustrationStyle:'Existing style',learningFeatures:[],sourceBookOptions:normalizeSourceBookOptions({imageMode:'hybrid',enhancement:'clean',preserveSlokas:true,transliteration:true,translation:false,imageStyle:'watercolour',chapterStyles:{'1':'ink'}})};
 const prompt=buildExternalAiPrompt(settings);assert.match(prompt,/Roman transliteration: include/);assert.match(prompt,/Translation into English: omit/);assert.match(prompt,/There is no one-source-image-per-chapter limit/);assert.match(prompt,/never fill gaps from memory/);
 const pack=buildExternalIllustrationPromptPack({...settings,chapters:[{id:1,title:'Seeds',body:'Seeds grow.'}],slots:[{id:'CH-01-IMG-01',role:'chapter',chapterId:1,chapterTitle:'Seeds',filename:'images/CH-01-IMG-01.jpg',sceneBrief:'A garden',caption:'Seeds',altText:'Seeds',imageIndex:1,placement:'chapter-middle',status:'pending'}]});
 assert.match(pack.prompts[0].content,/STYLE: Ink drawing/);assert.match(pack.manifest,/cleaned-source-images/);assert.match(pack.prompts.at(-1).content,/Generate the normal new illustrations AND/);
});
test('readable Sanskrit manuscript blocks must match their manifest before import',()=>{
 const manifest=parseSourceBookManifest(data());const raw='# INTRODUCTION\n\nObserve the seeds carefully.\n\n:::sloka V01\n'+verse+'\n:::';
 const result=attachSourceBookManifest(parseExternalManuscript(raw,'Ages 10–12'),manifest);assert.match(result.sections[0].html,/class="sanskrit-verse"/);
 assert.throws(()=>attachSourceBookManifest(parseExternalManuscript(raw.replace('सत्यं','असत्यं'),'Ages 10–12'),manifest),/does not match/);
});
