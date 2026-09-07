import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSourceBookOptions } from '../lib/source-book-options.ts';

test('older projects retain generation defaults and do not request verse processing',()=>{
  const a=normalizeSourceBookOptions();assert.equal(a.imageMode,'generate');assert.equal(a.preserveSlokas,false);assert.equal(a.imageStyle,'book');
  a.chapterStyles['1']='ink';assert.deepEqual(normalizeSourceBookOptions().chapterStyles,{});
});
test('source preferences survive normalization without mutating chapter exceptions',()=>{
  const saved={imageMode:'reuse',enhancement:'restyle',imageStyle:'custom',customStyle:'Gentle ink and watercolour',preserveSlokas:true,transliteration:true,translation:false,explanation:false,chapterStyles:{'1':'ink','2':'miniature'}};
  const result=normalizeSourceBookOptions(saved);assert.deepEqual(result,saved);result.chapterStyles['1']='collage';assert.equal(saved.chapterStyles['1'],'ink');
});
test('invalid stored choices fall back safely and custom instructions are bounded',()=>{
  const result=normalizeSourceBookOptions({imageMode:'invalid',enhancement:'invalid',imageStyle:'invalid',customStyle:'x'.repeat(800),chapterStyles:{'1':'invalid','2':'book','bad':'ink'}});
  assert.equal(result.imageMode,'generate');assert.equal(result.enhancement,'original');assert.equal(result.imageStyle,'book');assert.equal(result.customStyle.length,600);assert.deepEqual(result.chapterStyles,{});
});
