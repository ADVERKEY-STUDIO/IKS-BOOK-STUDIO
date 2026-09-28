import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedTextBlocks,templateBlueprints} from '../lib/template-layouts.ts';
const original='नासै रोग हरै सब पीरा । जपत निरंतर हनुमत बीरा ॥\nसंकट तें हनुमान छुड़ावै । मन क्रम वचन ध्यान जो लावै ॥\n\nसब पर राम तपस्वी राजा । तिन के काज सकल तुम साजा ॥\nऔर मनोरथ जो कोई लावै । सोइ अमित जीवन फल पावै ॥';
test('continuous story reading keeps the whole Chalisa passage in one text area, in exact source order',()=>{
 const b=templateBlueprints('beanstalk-adventure').find(b=>b.id==='reference-beanstalk-diagonal');
 const blocks=plannedTextBlocks({original,meaning:'Remembering Hanuman gives people steadiness.',readingOrder:'continuous'},b);
 const visible=blocks.filter(b=>b.role==='original'&&b.text);
 assert.equal(visible.length,1);
 assert.equal(visible[0].text,original);
});

test('story labels remain present when placement fails or a saved page needs review',async()=>{
 const {renderPlannedSpread}=await import('../lib/template-layouts.ts');
 const base={id:'p',title:'Story',original,meaning:'Keep the explanation.',image:'p.png',scene:'Forest',blueprint:'reference-beanstalk-diagonal',layoutReason:'Two scenes',layout:'story-scene',fontSize:16,imageScale:100,sourceReference:'Page 1'};
 for(const readingOrder of [undefined,'continuous']){
  const page={...base,...(readingOrder?{readingOrder}:{} )};
  const html=renderPlannedSpread({templateId:'beanstalk-adventure',templateRevision:2},page,undefined,{paper:'#fff',ink:'#000',accent:'#333'},0);
  assert.equal((html.match(/original reading-label/g)||[]).length,1);
  assert.equal((html.match(/meaning reading-label/g)||[]).length,1);
  assert.ok(html.includes('Keep the explanation.'));
 }
});
