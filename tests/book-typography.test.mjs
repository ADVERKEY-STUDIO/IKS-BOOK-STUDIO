import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBookTypography,bookTypographyCss} from '../lib/book-typography.ts';
import {parseTemplateBook,renderTemplateBook,renderTemplatePage,templateFont} from '../lib/template-book.ts';
import {defaultBookCompletion} from '../lib/book-completion.ts';
const fixture=()=>({format:'iks-template-book-v1',templateRevision:2,projectId:'typography',templateId:'beanstalk-adventure',title:'Book',language:'Hindi',characterGuide:'',completion:defaultBookCompletion(),pages:[{id:'p1',title:'Passage',original:'जय हनुमान',meaning:'A meaning',sourceReference:'Page 1',scene:'Forest',image:'p1.png',blueprint:'reference-beanstalk-landscape',layoutReason:'Sky',layout:'story-scene',fontSize:16,imageScale:100}]});
test('font, spacing and alignment survive manuscript serialization and appear in both renderers',()=>{
 for(const [font,file] of [['serif','book-sanskrit.ttf'],['sans','book-sans.ttf']]){
  const input={...fixture(),typography:{font,alignment:'center',lineHeight:1.8}};
  const restored=parseTemplateBook(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(restored.typography,input.typography);
  assert.equal(templateFont(restored),file);
  for(const html of [renderTemplateBook(restored),renderTemplatePage(restored,0)]){
   assert.ok(html.includes(file));assert.ok(html.includes('line-height:1.8!important'));assert.ok(html.includes('text-align:center!important'));
   assert.ok(html.includes('जय हनुमान'));assert.ok(html.includes('A meaning'));assert.ok(html.includes('Read first'));
  }
 }
});
test('legacy books keep defaults and reset removes all user typography overrides',()=>{
 const book=parseTemplateBook(fixture());assert.equal(book.typography,undefined);assert.equal(templateFont(book),'book-sanskrit.ttf');
 assert.equal(templateFont({templateId:'iks-notes'}),'book-hand.ttf');
 assert.equal(bookTypographyCss(undefined),'');
 assert.equal(bookTypographyCss({font:'template',alignment:'template'}),'');
 assert.equal(templateFont({...book,typography:{font:'template',alignment:'template'}}),templateFont(book));
});
test('typography import rejects invalid styles and CSS injection',()=>{
 for(const value of [null,[],{}, {font:'remote-url',alignment:'left'}, {font:'serif',alignment:'left;color:red'}, {font:'sans',alignment:'left',lineHeight:'1.5'}, {font:'sans',alignment:'left',lineHeight:Infinity}, {font:'sans',alignment:'left',lineHeight:0}, {font:'sans',alignment:'left',lineHeight:10}])assert.throws(()=>parseBookTypography(value));
});

test('justified alignment survives restore and reaches preview and full-book exports',()=>{
 const input={...fixture(),typography:{font:'template',alignment:'justify'}};
 const restored=parseTemplateBook(JSON.parse(JSON.stringify(input)));
 assert.equal(restored.typography.alignment,'justify');
 for(const html of [renderTemplateBook(restored),renderTemplatePage(restored,0)]){
  assert.ok(html.includes('text-align:justify!important'));
  assert.ok(html.includes('जय हनुमान'));assert.ok(html.includes('A meaning'));
 }
});
