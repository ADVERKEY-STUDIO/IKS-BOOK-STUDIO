import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceBookPrompt, sourceRequestEntries, parseVisualDirection, validateChalisaBook, chalisaTemplateDirection } from '../lib/visual-direction.ts';
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

const bilingualMeaning = 'हिंदी अर्थ:\nमाँ दुर्गा सुख देती हैं।\nमाँ अम्बा दुख दूर करती हैं।\n\nEnglish meaning:\nMother Durga brings happiness.\nMother Amba takes away sorrow.\n\nहिंदी नैतिक शिक्षा:\nदूसरों की मदद करो।\n\nEnglish moral:\nHelp others.';
test('new Beanstalk requests select one chaupai and ages 9–14 while retaining art direction',()=>{
 const direction = chalisaTemplateDirection('beanstalk-adventure',{audience:'',characters:'Durga',notes:'Keep the painted style',passageMode:'standard'});
 assert.equal(direction.passageMode,'chalisa'); assert.equal(direction.audience,'Ages 9–14');
 assert.equal(direction.characters,'Durga'); assert.equal(direction.notes,'Keep the painted style');
 assert.equal(chalisaTemplateDirection('panorama').passageMode,undefined);
});
test('without content reference every meaning is bilingual, short and tied to one whole chaupai',()=>{
 const d=draft(); d.visualDirection.audience='';
 const prompt=sourceBookPrompt(d);
 for (const text of ['ONE COMPLETE CHAUPAI','Children aged 9–14','हिंदी अर्थ:','English meaning:','हिंदी नैतिक शिक्षा:','English moral:','EXACTLY TWO short logical lines','encoded as \\n in JSON','side by side on one row','Hindi, not Sanskrit','PASSAGE-TO-IMAGE MATCH','FOUR different character reference sheet images','batches of at most FOUR','BEFORE generating interiors','passage-map.txt']) assert.ok(prompt.includes(text),text);
 assert.doesNotMatch(prompt,/SUPPLIED BOOK CONTENT/);
 assert.match(prompt,/UP TO 4 PER REQUEST/);
 assert.doesNotMatch(prompt,/UP TO 10 PER REQUEST/);
 assert.match(prompt,/STOP until that next request/);
});
test('content reference is copied faithfully and packaged separately from source and style images',async()=>{
 const d=draft(); d.contentReference=new File(['Supplied meanings and long moral'],'Durga chalisa -1.pdf');
 d.references={'reference-style.png':new Blob(['style'])};
 const entries=await sourceRequestEntries(d),decode=bytes=>new TextDecoder().decode(bytes);
 assert.equal(decode(entries['content-reference/Durga chalisa -1.pdf']),'Supplied meanings and long moral');
 assert.equal(decode(entries['source/chalisa.pdf']),'source');
 assert.equal(decode(entries['references/reference-style.png']),'style');
 assert.equal(decode(entries['START-HERE.txt']),sourceBookPrompt(d));
 assert.match(sourceBookPrompt(d),/COPY, DO NOT REWRITE/);
 assert.match(sourceBookPrompt(d),/do not silently shorten, translate, replace or add missing sections/);
 assert.doesNotMatch(sourceBookPrompt(d),/NO CONTENT REFERENCE — WRITE ALL FOUR/);
 assert.match(samplePrompt(d),/content-reference\/Durga chalisa -1.pdf/);
 delete d.contentReference;
 assert.ok(!Object.keys(await sourceRequestEntries(d)).some(name=>name.startsWith('content-reference/')));
});
test('new Chalisa imports require all four sections and two lines per meaning; reference text is preserved',()=>{
 const page={original:'नमो नमो दुर्गे सुख करनी।\nनमो नमो अम्बे दुःख हरनी॥',meaning:bilingualMeaning,scene:'Durga bringing comfort to a devotee'};
 const validate=meaning=>validateChalisaBook({pages:[{...page,meaning}]},{bilingual:true});
 assert.doesNotThrow(()=>validate(page.meaning));
 assert.doesNotThrow(()=>validate(page.meaning.replaceAll('\n','\r\n')));
 for(const label of ['हिंदी अर्थ:','English meaning:','हिंदी नैतिक शिक्षा:','English moral:']) assert.throws(()=>validate(page.meaning.replace(label,'')),/required labels/);
 assert.throws(()=>validate(page.meaning.replace('Mother Durga brings happiness.\nMother Amba','Mother Durga brings happiness. Mother Amba')),/two short lines/);
 assert.throws(()=>validate(page.meaning.replace('माँ दुर्गा सुख देती हैं।\n','')),/two short lines/);
 assert.throws(()=>validate(page.meaning.replace('Help others.','')),/required labels/);
 assert.throws(()=>validate(page.meaning+'\nEnglish moral:\nExtra'),/required labels/);
 assert.doesNotThrow(()=>validateChalisaBook({pages:[{...page,meaning:'Supplied English meaning and long moral unchanged.'}]},{bilingual:true,preserveReference:true}));
});
