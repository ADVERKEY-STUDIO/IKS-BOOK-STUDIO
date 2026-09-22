import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageFirstBook, imageDevelopmentPrompt } from '../lib/image-first-book.ts';
import { parseTemplateBook, renderTemplateBook, selectableTemplates } from '../lib/template-book.ts';

const files = () => [new File(['first'], 'same photo.PNG', { type: 'image/png' }), new File(['second'], 'same photo.PNG', { type: 'image/png' })];
test('selected images retain order and identity, with blank editable text and no sample artwork', async () => {
  for (const template of selectableTemplates) {
    const input = files();
    const { book, images } = createImageFirstBook('fresh-project', template.id, input);
    assert.deepEqual(Object.values(images), input);
    assert.equal(new Set(book.pages.map(page => page.image)).size, 2);
    assert.ok(book.pages.every(page => page.original === '' && page.title === ''));
    assert.deepEqual(parseTemplateBook(JSON.parse(JSON.stringify(book))), book);
    const html = renderTemplateBook(book, Object.fromEntries(Object.keys(images).map(name => [name, `images/${name}`])));
    assert.doesNotMatch(html, /src="\/(?:pilot|templates)\//);
    assert.match(html, /images\/spread-01.png/);
    assert.match(html, /images\/spread-02.png/);
    assert.equal(await images['spread-01.png'].text(), 'first');
  }
});
test('image-only empty text permission does not weaken source book validation', () => {
  const { book } = createImageFirstBook('new', 'panorama', files());
  delete book.contentMode;
  assert.throws(() => parseTemplateBook(book), /no original text/);
});
test('selection bounds and file formats are enforced', () => {
  assert.throws(() => createImageFirstBook('new', 'panorama', []), /1 and 80/);
  assert.throws(() => createImageFirstBook('new', 'panorama', Array(81).fill(files()[0])), /1 and 80/);
  assert.throws(() => createImageFirstBook('new', 'panorama', [new File(['x'], 'unsafe.svg')]), /PNG/);
});
test('development prompt requests references and exact replacement filenames without rewriting text', () => {
  const { book } = createImageFirstBook('new', 'immersive', files());
  book.pages[0].scene = 'Make the sky blue.';
  const prompt = imageDevelopmentPrompt(book);
  assert.match(prompt, /ask me to attach them/);
  assert.match(prompt, /left 40% quiet/);
  assert.match(prompt, /images\/spread-01.png/);
  assert.match(prompt, /images\/spread-02.png/);
  assert.match(prompt, /Make the sky blue/);
  assert.match(prompt, /Do not add new story text or rewrite book.json/);
});
