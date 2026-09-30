import test from 'node:test';
import assert from 'node:assert/strict';
import { characterStyles, characterOptionName, seriesReferenceName, parseSeriesArt } from '../lib/series-art.ts';
import { sourceBookPrompt, sourceRequestEntries, parseVisualDirection } from '../lib/visual-direction.ts';
import { uploadDraft, downloadDraft } from '../lib/template-storage.ts';
const fixture=()=>({id:'series-test',title:'Lakshmi Chalisa',templateId:'beanstalk-adventure',language:'Hindi and English',source:new File(['source'],'source.pdf'),references:{},images:{},visualDirection:{audience:'9–14',characters:'Lakshmi',notes:'Keep the template style',passageMode:'chalisa'},updated:1});
test('one prompt contains four fixed images, an in-chat choice, and the complete production contract',async()=>{
 for(const title of ['Lakshmi Chalisa','Ganesh Chalisa']){
  const d={...fixture(),title},prompt=sourceBookPrompt(d);
  for(const style of characterStyles){assert.ok(prompt.includes(style.description));assert.ok(prompt.includes('character-option-'+style.id+'.png'));}
  assert.match(prompt,/STOP and WAIT for the user's reply in this ChatGPT conversation/);
  assert.match(prompt,/proceed directly with the FULL BOOK INSTRUCTIONS/);
  assert.match(prompt,/No website upload, website approval, new ZIP request or repeated confirmation/);
  assert.match(prompt,/"projectId": "series-test"/);
  assert.match(prompt,/"format": "iks-template-book-v1"/);
  assert.match(prompt,/EXACTLY TWO/);
  assert.match(prompt,/Completed-Book.zip/);
  assert.doesNotMatch(prompt,/CONSISTENCY: First create|Generate an actual character reference image first/);
  const entries=await sourceRequestEntries(d);
  assert.equal(new TextDecoder().decode(entries['START-HERE.txt']),prompt);
  assert.ok(entries['source/source.pdf']);
 }
});
test('old incomplete or approved website choices never block or decide the ChatGPT choice',async()=>{
 for(const art of [{version:1},{version:1,option:4,approved:false},{version:1,option:2,approved:true}]){
  const d=fixture();d.visualDirection.seriesArt=art;
  d.references[seriesReferenceName(4)]=new Blob(['master'],{type:'image/png'});
  d.references[characterOptionName(4)]=new Blob(['old option'],{type:'image/png'});
  d.references['reference-user.png']=new Blob(['user reference'],{type:'image/png'});
  const prompt=sourceBookPrompt(d);
  assert.match(prompt,/PHASE 1 — SHOW FOUR OPTIONS AND WAIT/);
  assert.match(prompt,/Any saved option or website approval metadata is not the user's choice/);
  assert.doesNotMatch(prompt,/APPROVED CHARACTER STYLE|references\/reference-character-option/);
  const entries=await sourceRequestEntries(d);
  assert.ok(entries['references/reference-user.png']);
  assert.equal(entries['references/'+characterOptionName(4)],undefined);
  assert.equal(entries['references/'+seriesReferenceName(4)],undefined);
  assert.equal(Object.keys(d.references).length,3); // Kept in saved data for backward compatibility.
 }
});
test('notebook requests keep their original generation flow and saved metadata remains readable',()=>{
 const d=fixture();d.visualDirection.seriesArt={version:1,option:2,approved:false};
 assert.deepEqual(parseVisualDirection(d.visualDirection),d.visualDirection);
 d.templateId='iks-notes';assert.doesNotMatch(sourceBookPrompt(d),/CHARACTER CHOICE IN CHATGPT/);
 for(const value of [null,[],{version:2},{version:1,option:5},{version:1,approved:'yes'}])assert.throws(()=>parseSeriesArt(value));
});
test('existing cloud drafts retain their uploaded files without needing a website approval',async()=>{
 const original=globalThis.fetch;const assets=new Map();let metadata;
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/library/books'){metadata=JSON.parse(options.body);return Response.json({revision:1});}
  if(options.method==='HEAD')return new Response(null,{status:assets.has(path)?200:404});
  if(options.method==='PUT'){assets.set(path,options.body);return new Response(null);}
  return new Response(assets.get(path));
 };
 try{
  const d=fixture();d.visualDirection.seriesArt={version:1,option:4,approved:false};
  d.references[characterOptionName(4)]=new Blob(['saved option'],{type:'image/png'});
  await uploadDraft(d,'reader@example.com');
  const restored=await downloadDraft({...metadata,revision:1},'reader@example.com');
  assert.deepEqual(restored.visualDirection.seriesArt,d.visualDirection.seriesArt);
  assert.equal(await restored.references[characterOptionName(4)].text(),'saved option');
  assert.match(sourceBookPrompt(restored),/FULL BOOK INSTRUCTIONS/);
 }finally{globalThis.fetch=original;}
});
