import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => name.startsWith('.') ? load(resolve(dirname(path), name)) : require(name), module, module.exports);
  return module.exports;
}
const {fontCoverage,missingGlyphs,PROOF_FONT_SHA256}=load(resolve('lib/font-coverage.ts'));
const {createHash}=await import('node:crypto');
test('bundled proof font identity and Devanagari coverage are verified',()=>{
 const bytes=readFileSync('public/fonts/book-sanskrit.ttf');assert.equal(createHash('sha256').update(bytes).digest('hex'),PROOF_FONT_SHA256);
 const supports=fontCoverage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));assert.ok(supports(0x915));assert.ok(supports(0x41));assert.ok(!supports(0x10ffff));assert.deepEqual(missingGlyphs('कर्म ॐ',supports),[]);assert.deepEqual(missingGlyphs('A\n\t\u200d'+String.fromCodePoint(0x10ffff),supports),[String.fromCodePoint(0x10ffff)]);
});
test('format 12 supplementary ranges distinguish missing glyph zero',()=>{
 const a=new ArrayBuffer(80),v=new DataView(a);v.setUint16(4,1);v.setUint32(12,0x636d6170);v.setUint32(20,28);v.setUint32(24,52);v.setUint16(30,1);v.setUint16(32,3);v.setUint16(34,10);v.setUint32(36,12);
 v.setUint16(40,12);v.setUint32(44,40);v.setUint32(52,2);v.setUint32(56,65);v.setUint32(60,65);v.setUint32(64,0);v.setUint32(68,0x1f600);v.setUint32(72,0x1f601);v.setUint32(76,5);
 const supports=fontCoverage(a);assert.ok(supports(0x1f600));assert.ok(supports(0x1f601));assert.ok(!supports(65));assert.ok(!supports(0x1f602));
});
test('truncated font data fails explicitly',()=>{assert.throws(()=>fontCoverage(new ArrayBuffer(5)),/Truncated/);});
test('format 4 glyph-array zero stays missing even with a nonzero delta',()=>{
 const a=new ArrayBuffer(74),v=new DataView(a);v.setUint16(4,1);v.setUint32(12,0x636d6170);v.setUint32(20,28);v.setUint32(24,46);v.setUint16(30,1);v.setUint16(32,3);v.setUint16(34,1);v.setUint32(36,12);
 v.setUint16(40,4);v.setUint16(42,34);v.setUint16(46,4);v.setUint16(54,65);v.setUint16(56,0xffff);v.setUint16(60,65);v.setUint16(62,0xffff);v.setUint16(64,2);v.setUint16(66,1);v.setUint16(68,4);
 assert.equal(fontCoverage(a)(65),false);v.setUint16(72,5);assert.equal(fontCoverage(a)(65),true);assert.equal(fontCoverage(a)(66),false);assert.equal(fontCoverage(a)(0xffff),false);
});
