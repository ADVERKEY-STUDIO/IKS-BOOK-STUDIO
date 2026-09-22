import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,selectableTemplates,templateLayout,parseTemplateBook,importTemplateManuscript,bookPrompt,continuationPrompt,renderTemplateBook} from '../lib/template-book.ts';
import {readTemplateArchive} from '../lib/template-archive.ts';
import {zipSync,strToU8} from 'fflate';
const fixture=()=>({format:'iks-template-book-v1',projectId:'test-book',templateId:'painted',title:'Devotion',language:'Awadhi',characterGuide:'Golden Hanuman',pages:[{id:'spread-01',title:'Invocation',original:'श्री गुरु चरन',meaning:'A prayer',sourceReference:'PDF page 1',scene:'Hanuman by a river',image:'spread-01.png',layout:'art-right',fontSize:22,imageScale:100},{id:'spread-02',title:'Courage',original:'जय हनुमान',meaning:'',sourceReference:'PDF page 2',scene:'Mountain flight',image:'spread-02.png',layout:'art-left',fontSize:22,imageScale:100}]});
test('partial books are accepted and continuation only requests missing images',()=>{const b=parseTemplateBook(fixture(),'test-book');const p=continuationPrompt(b,['spread-01.png']);assert.match(p,/spread-02.png/);assert.doesNotMatch(p,/spread-01.png/);});
test('reject another project, duplicate destinations and unsafe image paths',()=>{assert.throws(()=>parseTemplateBook(fixture(),'another'));for(const change of [b=>b.pages[1].id=b.pages[0].id,b=>b.pages[1].image=b.pages[0].image,b=>b.pages[0].image='../escape.png',b=>b.pages[0].original='']){const b=fixture();change(b);assert.throws(()=>parseTemplateBook(b));}});
test('every template generates a matching detailed resumable contract',()=>{for(const t of templates){const p=bookPrompt('a',t.id,'Title','source.pdf','Awadhi');assert.match(p,new RegExp(t.id));assert.match(p,/Unicode/);assert.match(p,/missing images are allowed/);assert.match(p,/projectId/);}});
test('render preserves original and meaning, escapes untrusted HTML and marks missing art',()=>{const b=fixture();b.title='<script>alert(1)</script>';b.pages[0].original='<img onerror=alert(1)>';const html=renderTemplateBook(parseTemplateBook(b),{'spread-01.png':'images/spread-01.png'});assert.doesNotMatch(html,/<script>|<img onerror/);assert.match(html,/&lt;img/);assert.match(html,/Artwork pending: spread-02.png/);assert.match(html,/contenteditable/);assert.match(html,/art-left/);});
test('archive accepts partial manifest and ignores executable content',()=>{const files=readTemplateArchive(zipSync({'book.json':strToU8(JSON.stringify(fixture())),'evil.js':strToU8('alert(1)')}));assert.deepEqual(Object.keys(files),['book.json']);assert.equal(parseTemplateBook(JSON.parse(new TextDecoder().decode(files['book.json']))).pages.length,2);});
test('archive rejects traversal and bounded decompression rejects huge JSON',()=>{assert.throws(()=>readTemplateArchive(zipSync({'../book.json':strToU8('{}')})),/Unsafe/);assert.throws(()=>readTemplateArchive(zipSync({'book.json':new Uint8Array(3*1024*1024)})),/size limit/);});

test('twenty-nine distinct templates retain identity through import, prompt and export',()=>{
 assert.equal(templates.length,29);
 assert.equal(new Set(templates.map(t=>t.id)).size,29);
 assert.equal(new Set(templates.map(t=>t.art)).size,29);
 for(const t of templates){const input=fixture();input.templateId=t.id;const b=parseTemplateBook(input);const html=renderTemplateBook(b);assert.ok(html.includes(`spread cover ${t.id}`));assert.ok(html.includes(`art-right ${t.id}`));assert.ok(bookPrompt('test',t.id,'Book','source.pdf','Awadhi').includes(t.art));}
});

test('structural templates carry their primary composition through prompt, import and export',()=>{for(const id of ['panorama','immersive','poetry','study']){const input=fixture();input.templateId=id;input.pages[0].layout=templateLayout(id);const book=parseTemplateBook(input);assert.match(renderTemplateBook(book),new RegExp('composition-'+id));assert.ok(bookPrompt('test',id,'Book','source.pdf','Hindi').includes('"layout": "'+id+'"'));}const input=fixture();input.pages[0].layout='unknown';assert.throws(()=>parseTemplateBook(input),/allowed layout/);});

test('literary samples contain a cover and exactly two interior pages, using valid importable books',async()=>{
 const {literaryTemplates}=await import('../lib/literary-templates.ts');
 const {templateSample,renderTemplateSample}=await import('../lib/template-sample.ts');
 for(const t of literaryTemplates){
  const book=parseTemplateBook(templateSample(t.id));
  assert.equal(book.pages.length,1);
  const html=renderTemplateSample(t.id);
  assert.equal((html.match(/<section class="spread /g)||[]).length,2);
  assert.match(html,/Inside the book · pages 2–3/);
  assert.ok(html.includes(t.demo));
  assert.doesNotMatch(html,/contenteditable|<script/);
  const unsafe={...book,title:'<script>bad()</script>',language:'<img onerror=x>'};
  const output=renderTemplateBook(unsafe,{'sample.png':'images/safe.png'});
  assert.doesNotMatch(output,/<script>|<img onerror/);
  assert.match(output,/&lt;script&gt;/);
  assert.match(output,/images\/safe.png/);
 }
});


test('chooser retires repetitive variants without breaking existing saved books',()=>{
 assert.deepEqual(selectableTemplates.map(t=>t.id),['manifesto','wild','fragments','chromatic','echo','haze','little-explorers','bedtime-skies','paper-play','beanstalk-adventure','flower-festival','snowy-friends','bedtime-play','treehouse-days','colourful-journey','painted-memories','panorama','immersive','poetry','study']);
 for(const id of ['painted','heritage','quiet','moonlit','botanical','vermilion','storybook','archive','festival']){
  const input=fixture();input.templateId=id;
  assert.equal(parseTemplateBook(input).templateId,id);
  assert.ok(renderTemplateBook(parseTemplateBook(input)).includes(`spread cover ${id}`));
 }
});


test('a fresh workspace accepts a manuscript from an earlier request without changing the source object',()=>{
 const input=fixture();
 const imported=importTemplateManuscript(input,'fresh-workspace','painted');
 assert.equal(imported.projectId,'fresh-workspace');
 assert.equal(input.projectId,'test-book');
 assert.deepEqual(imported.pages,input.pages);
});
test('manuscript import preserves template and existing-book safeguards',()=>{
 const input=fixture();
 assert.throws(()=>importTemplateManuscript(input,'fresh-workspace','panorama'),/template/i);
 assert.throws(()=>importTemplateManuscript(input,'fresh-workspace','painted',input),/another book/);
 assert.deepEqual(importTemplateManuscript(input,'test-book','painted',input),input);
 const changed=fixture();changed.pages[0].original='Changed verse';
 assert.throws(()=>importTemplateManuscript(changed,'test-book','painted',input),/already saved/);
});

 test('new children books include at least three distinct preview images', async()=>{const {childrenTemplates}=await import('../lib/children-templates.ts');for(const id of ['beanstalk-adventure','flower-festival']){const t=childrenTemplates.find(t=>t.id===id);assert.ok(t);assert.ok(new Set(t.images).size>=3);assert.ok(t.source.startsWith('https://'));}});

test("five additional children templates have three interior text previews",async()=>{const {childrenTemplates}=await import("../lib/children-templates.ts");for(const id of ["snowy-friends","bedtime-play","treehouse-days","colourful-journey","painted-memories"]){const t=childrenTemplates.find(t=>t.id===id);assert.ok(t);assert.equal(new Set(t.images).size,3);assert.ok(!t.images.includes(t.demo));assert.match(t.previewLabel,/text & illustration/);}});

test('storybook adventure renders integrated art rather than a panorama band',()=>{
 const b=fixture(); b.templateId='beanstalk-adventure'; b.pages.forEach(p=>p.layout=templateLayout(b.templateId));
 assert.equal(b.pages[0].layout,'story-scene');
 const html=renderTemplateBook(parseTemplateBook(b));
 assert.match(html,/spread story-scene beanstalk-adventure composition-story-scene/);
 assert.match(bookPrompt('a',b.templateId,'Book','source.pdf','Hindi'),/Reserve x=7–43%, y=8–64%/);
});
test('continuation retains template art when character notes are supplied',()=>{
 const b=fixture();b.templateId='beanstalk-adventure';b.pages.forEach(p=>p.layout='story-scene');
 const prompt=continuationPrompt(parseTemplateBook(b),['spread-01.png'],'Keep the red scarf');
 assert.match(prompt,/textured gouache/);assert.match(prompt,/Keep the red scarf/);assert.match(prompt,/story-scene/);
 assert.doesNotMatch(prompt,/images\/spread-01.png/);
});
test('source request uses only its selected composition and retains art direction',async()=>{
 const {sourceBookPrompt}=await import('../lib/visual-direction.ts');
 const prompt=sourceBookPrompt({id:'book',templateId:'beanstalk-adventure',title:'Book',language:'Hindi',visualDirection:{audience:'Families',characters:'A child',notes:'Red scarf'}});
 assert.match(prompt,/ART DIRECTION: Original children/);assert.match(prompt,/story-scene/);assert.doesNotMatch(prompt,/For Ocean discovery use panorama/);
});
