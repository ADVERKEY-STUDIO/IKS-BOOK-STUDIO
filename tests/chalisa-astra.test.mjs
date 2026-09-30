import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBookPrompt,sourceRequestEntries,parseVisualDirection,validateChalisaAstraBook} from '../lib/visual-direction.ts';
const meaning='हिंदी अनुवाद: अनुवाद।\n\nEnglish translation: Translation.\n\nहिंदी नैतिक शिक्षा: शिक्षा।\n\nEnglish moral: Lesson.';
const page=(ref='Chaupai 1-2',original='पहला पूर्ण पद। दोनों भाग॥\nदूसरा पूर्ण पद। दोनों भाग॥')=>({sourceReference:ref,original,meaning,scene:'A scene specific to the verses.'});
test('Astra persists, overrides language and ships the same full prompt in ZIP',async()=>{
 for(const title of ['Laxmi','Ganesh','Ram','Krishna','Another Chalisa']) {
  const d={id:'test',templateId:'beanstalk-adventure',title,language:'English only',source:new File(['source'],'input.pdf'),visualDirection:{passageMode:'chalisa-astra',audience:'9–14',characters:'',notes:''}};
  assert.equal(parseVisualDirection(d.visualDirection).passageMode,'chalisa-astra');
  const p=sourceBookPrompt(d);
  for(const text of ['TWO consecutive COMPLETE chaupais','हिंदी अनुवाद:','English translation:','हिंदी नैतिक शिक्षा:','English moral:','ASTRA CHECKPOINT','passage-map.txt','FOUR different character']) assert.ok(p.includes(text),text);
  assert.doesNotMatch(p,/STRICT TWO-LINE SPREADS|Language: English only/);
  assert.equal(new TextDecoder().decode((await sourceRequestEntries(d))['START-HERE.txt']),p);
  assert.doesNotMatch(sourceBookPrompt({...d,templateId:'iks-notes'}),/CHALISA ASTRA/);
 }
});
test('Astra accepts pairs, section boundaries and final odd verses',()=>{
 validateChalisaAstraBook({pages:[page('Doha 1'),page(),page('Chaupai 3','पूरा पद। दोनों भाग॥'),page('Soratha 1'),page('Doha 2')]});
});
test('Astra rejects omitted, duplicate, oversized and prematurely single groups',()=>{
 for(const pages of [[page('Chaupai 2-3')],[page(),page()],[page('Chaupai 1-4')],[page('Chaupai 1','one'),page('Chaupai 2-3')],[page('Doha 2')],[page('Doha 1-2')],[page('Chaupai 1-2','one')]]) assert.throws(()=>validateChalisaAstraBook({pages}),/Chalisa Astra/);
});
test('Astra rejects missing or empty bilingual content and missing scene',()=>{
 for(const label of ['हिंदी अनुवाद:','English translation:','हिंदी नैतिक शिक्षा:','English moral:']) assert.throws(()=>validateChalisaAstraBook({pages:[{...page(),meaning:meaning.replace(label,'') }]}),/required labels/);
 assert.throws(()=>validateChalisaAstraBook({pages:[{...page(),meaning:meaning.replace('Lesson.','')}]}),/required labels/);
 assert.throws(()=>validateChalisaAstraBook({pages:[{...page(),scene:''}]}),/illustration/);
});
