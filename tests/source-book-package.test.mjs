import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceBookManifest,attachSourceBookManifest,sourceImageSlots} from '../lib/source-book-package.ts';
import {parseExternalManuscript,upgradeExternalIllustrationSlots,buildExternalAiPrompt,buildExternalIllustrationPromptPack} from '../lib/external-manuscript.ts';
import {normalizeSourceBookOptions} from '../lib/source-book-options.ts';
import {createExternalIllustrationSlots} from '../lib/external-manuscript.ts';
test('structured extraction notes preserve information without blocking chapters',()=>{
 const m={format:'iks-source-assets-v1',sourceImages:[],verses:[],extractionNotes:[{type:'ocr',note:'Source text could not be extracted.'},'',null,{message:'Review source pages.'}]};
 assert.deepEqual(parseSourceBookManifest(m).extractionNotes,['Source text could not be extracted.','Review source pages.']);
});
test('source-first planning and reopen retain source placements and generate only uncovered chapters',()=>{
 const result=parseExternalManuscript('# INTRODUCTION\n\nWelcome.\n\n# CHAPTER 01: Seeds\n\nObserve seeds.\n\n# CHAPTER 02: Trees\n\nObserve trees.','Ages 10–12');
 result.sourceManifest={format:'iks-source-assets-v1',verses:[],extractionNotes:[],sourceImages:[{id:'SRC1',sourcePage:1,originalPath:'source-images/SRC1.png',caption:'Seeds',alt:'Seeds',status:'available',placements:[{id:'P1',sectionNumber:2,anchorText:'Observe seeds.',reason:'Shows the discussed seeds'}]}]};
 const slots=[...createExternalIllustrationSlots(result,'Book',true),...sourceImageSlots(result.sourceManifest,result.sections)];
 assert.equal(slots.filter(s=>s.chapterId===2).length,1);assert.equal(slots.find(s=>s.chapterId===2).sourceImageId,'SRC1');assert.ok(slots.some(s=>s.chapterId===3&&!s.sourceImageId));
 const reopened=upgradeExternalIllustrationSlots(result.sections.map((s,i)=>({id:i+1,title:s.title})),slots,true);
 assert.equal(reopened.filter(s=>s.chapterId===2).length,1);
});
const verse='सत्यं वद ।\nधर्मं चर ।';
const data=()=>({format:'iks-source-assets-v1',sourceImages:[{id:'SRC01',sourcePage:3,originalPath:'source-images/SRC01.png',cleanedPath:'cleaned-source-images/SRC01.png',caption:'Seeds in the source book',alt:'Seeds',status:'available',placements:[{id:'P1',sectionNumber:1,anchorText:'Observe the seeds carefully.',reason:'Shows the seeds being discussed.'},{id:'P2',sectionNumber:1,anchorText:'Observe the seeds carefully.',reason:'Another view linked to the same passage.'}]}],verses:[{id:'V01',sectionNumber:1,sourcePage:4,reference:'Source fixture verse',sanskrit:verse,translation:'Speak truth; practise dharma.',status:'verified'}],extractionNotes:[]});
test('Roman-only verse errors identify all source pages before status validation',()=>{
 const input=data();input.verses[0].sanskrit='satyam vada';input.verses[0].status='verified-transliteration-only';input.verses.push({...input.verses[0],id:'V02',sourcePage:9});
 assert.throws(()=>parseSourceBookManifest(input),error=>/V01.*page 4/s.test(error.message)&&/V02.*page 9/s.test(error.message)&&/read that page visually or use OCR/.test(error.message));
});
test('unusual status on actual Devanagari is retained as uncertain, never silently verified',()=>{
 const input=data();input.verses[0].status='checked';const parsed=parseSourceBookManifest(input);
 assert.equal(parsed.verses[0].status,'uncertain');assert.match(parsed.verses[0].reviewNote,/checked/);assert.equal(parsed.verses[0].sanskrit,verse);
});
test('mixed restyled source pictures receive an aesthetic and derivative destinations',()=>{
 const settings={title:'Garden',sourceName:'Garden.pdf',audience:'Ages 10–12',readingLevel:'Reader',language:'English',bookType:'Book',aesthetic:'Calm',illustrationStyle:'Soft ink and earth colours',learningFeatures:[],sourceBookOptions:normalizeSourceBookOptions({imageMode:'hybrid',enhancement:'restyle',preserveSlokas:true})};
 const prompt=buildExternalAiPrompt(settings);assert.match(prompt,/never Roman text in the sanskrit field/);assert.match(prompt,/child-friendly translation/);assert.match(prompt,/declare originalPath.*cleanedPath/);
 const pack=buildExternalIllustrationPromptPack({...settings,chapters:[],slots:[]});const source=pack.prompts.at(-1).content;
 assert.match(source,/Generate the normal new illustrations AND/);assert.match(source,/Every source image selected for placement/);assert.match(source,/Source artwork aesthetic: Soft ink and earth colours/);assert.match(source,/exact anchorText and a relevance reason/);
});
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
