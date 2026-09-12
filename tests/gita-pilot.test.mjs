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
const {gitaPilot, pilotStudies, pilotAssets} = load(resolve('lib/gita-pilot.ts'));
const {compositionDocument, layerText} = load(resolve('lib/spread-composition.ts'));
test('pilot retains exact source bindings and never fabricates approvals',()=>{
 assert.equal(gitaPilot.compositions.length,3);
 for(const [i,c] of gitaPilot.compositions.entries()) {
  const source=c.layers.find(l=>l.binding?.field==='original');
  assert.equal(layerText(gitaPilot,source),pilotStudies[i].original);
  assert.equal(gitaPilot.passages[i].fields.original.status,'draft');
  assert.equal(gitaPilot.passages[i].fields.translation.status,'draft');
  assert.equal(gitaPilot.storyboard[i].approvedContext,undefined);
 }
});
test('pilot keeps all text inside safe margins and outside gutter',()=>{
 for(const c of gitaPilot.compositions) for(const l of c.layers.filter(l=>l.kind==='text')) {
  assert.ok(l.x>=15&&l.y>=15&&l.x+l.width<=345&&l.y+l.height<=215,l.id);
  assert.ok(!(l.x<188&&l.x+l.width>172),l.id);
 }
});
test('pilot uses shared physical renderer with clearly marked review copies',()=>{
 for(const c of gitaPilot.compositions){
  const html=compositionDocument(gitaPilot,c,pilotAssets,'font-data');
  assert.ok(html.includes('size:366mm 236mm'));
  assert.ok(html.includes('DESIGN PILOT · REVIEW COPY'));
  assert.ok(html.includes('READING AID / DRAFT ENGLISH MEANING'));
  assert.ok(html.includes(layerText(gitaPilot,c.layers.find(l=>l.binding?.field==='original'))));
 }
});
