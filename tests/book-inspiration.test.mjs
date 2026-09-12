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
const { inspirationBooks, applyInspiration, inspirationBrief, normalizeInspiration } = load(resolve('lib/book-inspiration.ts'));
const { personaById, materializePersona } = load(resolve('lib/book-persona.ts'));
const { buildExternalIllustrationSlotPrompt } = load(resolve('lib/external-manuscript.ts'));
const original = materializePersona(personaById('wisdom-and-ideas'), 'Original');

test('mixing references changes only the chosen aspects and does not mutate a book persona', () => {
  const before = structuredClone(original);
  const choice = { references: { typography: 'ganesha-sweet-tooth', palette: 'waterlife' }, notes: 'Keep verses intact.' };
  const next = applyInspiration(original, choice);
  assert.equal(next.fontTheme, 'Friendly Rounded');
  assert.deepEqual(next.bookPersona.palette, inspirationBooks.find(book => book.id === 'waterlife').palette);
  assert.equal(next.illustrationStyle, original.illustrationStyle);
  assert.equal(next.pageAesthetic, original.pageAesthetic);
  assert.deepEqual(original, before);
  assert.equal(next.inspiration.notes, choice.notes);
});

test('saved selections round-trip and unknown or malformed references cannot enter prompts', () => {
  const next = normalizeInspiration({ references: { typography: 'waterlife', palette: 'not-a-book', layout: '<script>', illustration: 4 }, notes: 'a'.repeat(2100) });
  assert.deepEqual(next.references, { typography: 'waterlife' });
  assert.equal(next.notes.length, 2000);
  assert.deepEqual(normalizeInspiration(JSON.parse(JSON.stringify(next))), next);
  assert.equal(inspirationBrief(null), '');
  assert.equal(inspirationBrief({ references: { layout: 'invented' } }), '');
});

test('reference catalogue identifies originals and distinguishes cover-only and manuscript evidence', () => {
  assert.equal(new Set(inspirationBooks.map(book => book.id)).size, inspirationBooks.length);
  for (const book of inspirationBooks) {
    assert.ok(book.creators && book.publisher && book.edition && book.rights);
    assert.equal(new URL(book.sourceUrl).protocol, 'https:');
    for (const image of book.images) assert.equal(new URL(image.url).protocol, 'https:');
  }
  assert.equal(inspirationBooks.find(book => book.id === 'gita-mewar').images[0].kind, 'Cover');
  assert.equal(inspirationBooks.find(book => book.id === 'penn-bhagavadgita').category, 'Historical manuscripts');
});

test('selected design guidance reaches the actual per-image production prompt without importing reference images', () => {
  const inspiration = { references: { illustration: 'waterlife', layout: 'sitas-ramayana' }, notes: 'Use quiet verse areas.' };
  const prompt = buildExternalIllustrationSlotPrompt({ title: 'Prayer anthology', audience: 'Families', readingLevel: 'Clear', language: 'Hindi', bookType: 'Devotional', aesthetic: 'Young Scholar', illustrationStyle: 'Painting', learningFeatures: [], inspiration, chapters: [{ id: 1, title: 'Opening prayer', body: '<p>Approved passage</p>' }], slots: [] }, { id: 'CH-01-IMG-01', role: 'chapter', chapterId: 1, chapterTitle: 'Opening prayer', filename: 'images/CH-01-IMG-01.png', sceneBrief: 'A quiet morning', caption: 'Morning prayer', placement: 'after-opening' });
  assert.match(prompt, /Waterlife/);
  assert.match(prompt, /Sita’s Ramayana/);
  assert.match(prompt, /Use quiet verse areas/);
  assert.match(prompt, /Preserve approved scripture exactly/);
  assert.doesNotMatch(prompt, /Waterlife_Spread|sitas_ramayana_2/);
});
