import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceBookPrompt, sourceRequestEntries, parseVisualDirection, validateChalisaBook } from '../lib/visual-direction.ts';
import { samplePrompt } from '../lib/chatgpt-handoff.ts';
const draft = () => ({id:'chalisa-series',templateId:'beanstalk-adventure',title:'Ganesh Chalisa',language:'Original language with English meanings',source:new File(['source'],'chalisa.pdf'),visualDirection:{passageMode:'chalisa',audience:'9–14',characters:'Ganesha',notes:''}});
test('Chalisa selection survives parsing and drives copied, ZIP and sample prompts',async()=>{
 const d=draft();
 assert.equal(parseVisualDirection(d.visualDirection).passageMode,'chalisa');
 const prompt=sourceBookPrompt(d);
 for(const text of ['EXACTLY TWO','Never combine four','opening and closing dohas','ONE passage-specific illustration','beanstalk-adventure','FINAL CHALISA CHECK']) assert.ok(prompt.includes(text),text);
 assert.equal(new TextDecoder().decode((await sourceRequestEntries(d))['START-HERE.txt']),prompt);
 assert.match(samplePrompt(d),/EXACTLY TWO/);
 assert.match(samplePrompt(d),/SAMPLE ONLY/);
 assert.throws(()=>parseVisualDirection({...d.visualDirection,passageMode:'four'}),/passage mode/);
});
test('standard and notebook prompts do not opt into Chalisa based on title',()=>{
 const d=draft();delete d.visualDirection.passageMode;
 const standard=sourceBookPrompt(d);
 assert.doesNotMatch(standard,/CHALISA SERIES/);
 d.visualDirection.passageMode='standard';
 assert.equal(sourceBookPrompt(d),standard);
 d.templateId='iks-notes';d.visualDirection.passageMode='chalisa';
 assert.doesNotMatch(sourceBookPrompt(d),/CHALISA SERIES/);
});
test('Chalisa import rejects four lines, empty lines, missing meanings and missing scene briefs',()=>{
 const page={original:'जय गणेश\nजय गजानन',meaning:'Praise to Ganesha.',scene:'Ganesha blessing a devotee'};
 assert.doesNotThrow(()=>validateChalisaBook({pages:[page]}));
 assert.doesNotThrow(()=>validateChalisaBook({pages:[{...page,original:'पहली पंक्ति\r\nदूसरी पंक्ति'}]}));
 for(const original of ['one\ntwo\nthree\nfour','one','one\n\ntwo']) assert.throws(()=>validateChalisaBook({pages:[{...page,original}]}),/exactly two/);
 for(const field of ['meaning','scene']) assert.throws(()=>validateChalisaBook({pages:[{...page,[field]:''}]}),/meaning and matching/);
});
