import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceBookPrompt, sourceRequestEntries, parseVisualDirection } from '../lib/visual-direction.ts';
import { templateLayout, renderTemplateBook } from '../lib/template-book.ts';
import { uploadDraft, downloadDraft } from '../lib/template-storage.ts';
const fixture = () => ({ id:'chapter-test', templateId:'bedtime-skies', title:'Chanakya for kids', language:'Sanskrit, Hindi and English', source:new File(['chapter content'],'chapter.docx'), images:{}, references:{'reference-style.png':new Blob(['reference'],{type:'image/png'})}, visualDirection:{audience:'9–14',characters:'A boy, a girl and Chanakya',notes:'Soft textured painting, warm light'},updated:1 });
test('request combines chapter and visual direction without treating references as pages',async()=>{
 const draft=fixture();const prompt=sourceBookPrompt(draft);
 for(const text of ['9–14','A boy, a girl and Chanakya','references/reference-style.png','character-reference.png','same sheet','single test chapter','separately labelled paragraphs','separate white reading band']) assert.ok(prompt.includes(text),text);
 assert.match(prompt,/ART DIRECTION: Original children’s discovery/);
 const entries=await sourceRequestEntries(draft);
 assert.deepEqual(Object.keys(entries).sort(),['START-HERE.txt','references/reference-style.png','source/chapter.docx']);
 assert.equal(new TextDecoder().decode(entries['references/reference-style.png']),'reference');
 assert.equal(new TextDecoder().decode(entries['source/chapter.docx']),'chapter content');
 assert.deepEqual(draft.images,{});
});
test('requests require source and title, validate metadata and reject unsafe reference paths',async()=>{
 await assert.rejects(sourceRequestEntries({...fixture(),source:undefined}),/source document/);
 await assert.rejects(sourceRequestEntries({...fixture(),title:' '}),/title/);
 await assert.rejects(sourceRequestEntries({...fixture(),references:{'../escape.png':new Blob()}}),/filename/);
 assert.throws(()=>parseVisualDirection({audience:42}),/Invalid/);
 assert.throws(()=>parseVisualDirection({...fixture().visualDirection,characters:'a'.repeat(4001)}),/characters/);
 assert.equal(parseVisualDirection(undefined),undefined);
});
test('new Ocean discovery books use panorama and explicit white reading-band styling',()=>{
 assert.equal(templateLayout('bedtime-skies'),'panorama');
 const html=renderTemplateBook({format:'iks-template-book-v1',projectId:'test',templateId:'bedtime-skies',title:'Test',language:'English',characterGuide:'',pages:[{id:'spread-01',title:'',original:'Lesson',meaning:'',sourceReference:'',scene:'',image:'spread-01.png',layout:'panorama',fontSize:22,imageScale:100}]},{'spread-01.png':'images/spread-01.png'});
 assert.match(html,/composition-panorama/);assert.match(html,/bedtime-skies\.composition-panorama \.copy\{[^}]*background:#fff;/);
});
test('account round trip preserves references and direction without adding references to artwork',async()=>{
 const original=globalThis.fetch;let metadata;const assets=new Map();
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/library/books'){metadata=JSON.parse(options.body);return Response.json({revision:1});}
  if(options.method==='HEAD')return new Response(null,{status:assets.has(path)?200:404});
  if(options.method==='PUT'){assets.set(path,options.body);return new Response(null);}
  return new Response(assets.get(path));
 };
 try{const draft=fixture();await uploadDraft(draft,'test@example.com');
  assert.deepEqual(metadata.images,{});assert.equal(Object.keys(metadata.references).length,1);
  const restored=await downloadDraft({...metadata,revision:1},'test@example.com');
  assert.deepEqual(restored.visualDirection,draft.visualDirection);
  assert.equal(await restored.references['reference-style.png'].text(),'reference');
  assert.equal(await restored.source.text(),'chapter content');
 }finally{globalThis.fetch=original;}
});
