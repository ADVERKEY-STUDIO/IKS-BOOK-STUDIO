import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chalisaEditions,parseChalisaEdition,chalisaEditionPrompt,chalisaSeriesReferences} from '../lib/chalisa-editions.ts';
import {sourceBookPrompt,sourceRequestEntries,parseVisualDirection} from '../lib/visual-direction.ts';
import {parseTemplateBook,continuationPrompt,renderTemplateBook} from '../lib/template-book.ts';
import {defaultBookCompletion,coverArtworkPrompt} from '../lib/book-completion.ts';
import {templateReferenceEntries} from '../lib/template-reference-package.ts';
import {samplePrompt} from '../lib/chatgpt-handoff.ts';
import {singleBook} from './fixtures/chalisa-single-spread.mjs';

function draft(id){return {id:'edition-test',templateId:'beanstalk-adventure',title:chalisaEditions.find(e=>e.id===id).label+' for Young Minds',language:'Hindi and English',source:new File(['source'],id+'.pdf'),images:{},visualDirection:{passageMode:'chalisa',chalisaEdition:id,audience:'Ages 9–14',characters:'',notes:''}};}
test('all ten requested editions have stable validated IDs and survive saved direction parsing',()=>{
 assert.deepEqual(chalisaEditions.map(e=>e.id),['shiva','hanuman','ganesh','krishna','ram','vishnu','durga','lakshmi','saraswati','gayatri']);
 assert.equal(parseChalisaEdition(undefined),undefined);assert.throws(()=>parseChalisaEdition('other'),/valid Chalisa/);
 for(const e of chalisaEditions)assert.equal(parseVisualDirection(draft(e.id).visualDirection).chalisaEdition,e.id);
});
test('each copied and packaged prompt selects only its intended subject and fixed series style',async()=>{
 for(const e of chalisaEditions){
  const d=draft(e.id),p=sourceBookPrompt(d),entries=await sourceRequestEntries(d);
  assert.equal(new TextDecoder().decode(entries['START-HERE.txt']),p);
  assert.match(p,new RegExp('PRIMARY SUBJECT: '+e.subject.replaceAll('.','\\.')));
  assert.ok(p.includes(`"chalisaEdition": "${e.id}"`));
  assert.ok(p.includes(chalisaEditionPrompt(e.id)));
  assert.doesNotMatch(p,/PHASE 1 — SHOW FOUR OPTIONS AND WAIT|Hide one tiny leaf/);
  assert.match(p,/Durga reference is NOT a content-reference/);
  assert.match(p,/Do not force every title to 40 pictures/);
  assert.match(p,/Flag variants with evidence/i);
  assert.match(samplePrompt(d),/SAMPLE SCOPE OVERRIDE/);
 }
});
test('edition metadata round-trips in book JSON and reaches resumed art and matching covers',()=>{
 for(const e of chalisaEditions){
  const raw=singleBook(1);raw.chalisaEdition=e.id;raw.title=e.label+' for Young Minds';raw.completion=defaultBookCompletion([],e.id);
  const b=parseTemplateBook(raw);assert.equal(parseTemplateBook(JSON.parse(JSON.stringify(b))).chalisaEdition,e.id);
  assert.match(continuationPrompt(b,[]),new RegExp('SELECTED CHALISA EDITION: '+e.label));
  assert.equal(b.completion.easterEgg,'');
  const covers=coverArtworkPrompt(b.completion,[],[],e.id);assert.match(covers,/upper 30% quiet/);assert.doesNotMatch(covers,/small hidden motif/);
  const html=renderTemplateBook(b);assert.ok(html.includes(e.hindi));assert.match(html,/class="series-line">for Young Minds/);
  assert.doesNotMatch(html,/Can you find the tiny leaf/);
 }
 const invalid=singleBook(1);invalid.chalisaEdition='fake';assert.throws(()=>parseTemplateBook(invalid),/valid Chalisa/);
});
test('non-Chalisa and notebook requests ignore a stale selection instead of changing their workflow',()=>{
 const d=draft('shiva');d.visualDirection.passageMode='standard';assert.doesNotMatch(sourceBookPrompt(d),/SELECTED CHALISA EDITION/);
 d.templateId='iks-notes';d.visualDirection.passageMode='chalisa';assert.doesNotMatch(sourceBookPrompt(d),/SELECTED CHALISA EDITION/);
 const legacy=singleBook(1);assert.equal(parseTemplateBook(legacy).chalisaEdition,undefined);
});
test('request bundle carries real final-reference cover, interior, glossary and editorial examples',async()=>{
 const refs=await templateReferenceEntries('beanstalk-adventure',async url=>new Response(await readFile(new URL('../public'+url,import.meta.url))),true);
 for(const name of chalisaSeriesReferences){const bytes=refs['template-references/chalisa-series-v14/'+name];assert.ok(bytes.length>10000);assert.equal(bytes[0],255);assert.equal(bytes[1],216);}
 const examples=JSON.parse(new TextDecoder().decode(refs['template-references/chalisa-series-v14/editorial-examples.json']));
 assert.equal(examples.examples.length,5);assert.ok(examples.examples.every(e=>e.original&&e.hindiMeaning&&e.englishMeaning&&e.hindiMoral&&e.englishMoral));
 await assert.rejects(()=>templateReferenceEntries('beanstalk-adventure',async()=>new Response(null,{status:404}),true),/v14 series references/);
});
