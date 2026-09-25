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
