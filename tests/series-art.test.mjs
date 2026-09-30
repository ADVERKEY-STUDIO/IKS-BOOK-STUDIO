import test from 'node:test';
import assert from 'node:assert/strict';
import { characterStyles, characterOptionName, seriesReferenceName, clearCharacterOptions, parseSeriesArt, seriesArtReady } from '../lib/series-art.ts';
import { sourceBookPrompt, sourceRequestEntries, parseVisualDirection } from '../lib/visual-direction.ts';
import { samplePrompt, canApproveSample, chapterPrompt } from '../lib/chatgpt-handoff.ts';
import { uploadDraft, downloadDraft } from '../lib/template-storage.ts';
const fixture=()=>({id:'series-test',title:'Lakshmi Chalisa',templateId:'beanstalk-adventure',language:'Hindi and English',source:new File(['source'],'source.pdf'),references:{},images:{},visualDirection:{audience:'9–14',characters:'Lakshmi',notes:'Keep the template style',seriesArt:{version:1},passageMode:'chalisa'},updated:1});
function sheets(d){
 for(const {id} of characterStyles){d.references[characterOptionName(id)]=new Blob(['current-'+id],{type:'image/png'});d.references[seriesReferenceName(id)]=new Blob(['master-'+id],{type:'image/png'});}
 return d;
}
test('all four numbered treatments stay fixed across subjects; initial request stops before production',async()=>{
 const d=fixture(),next={...d,title:'Ganesh Chalisa',visualDirection:{...d.visualDirection,characters:'Ganesha'}};
 for(const request of [sourceBookPrompt(d),sourceBookPrompt(next),samplePrompt(d)]){
  for(const s of characterStyles){assert.ok(request.includes(s.description));assert.ok(request.includes('character-option-'+s.id+'.png'));}
  assert.match(request,/STOP and ask the user to choose/);
  assert.doesNotMatch(request,/COMPLETE IN ONE GO|iks-template-book-v1/);
 }
 const entries=await sourceRequestEntries(d);
 assert.equal(new TextDecoder().decode(entries['START-HERE.txt']),sourceBookPrompt(d));
 assert.equal(canApproveSample(d),false);
});
test('every option requires four current sheets and explicit approval; approved requests retain two-line grouping',async()=>{
 for(const {id} of characterStyles){
  const d=sheets(fixture());d.visualDirection.seriesArt.option=id;
  assert.equal(seriesArtReady(d),false);
  d.visualDirection.seriesArt.approved=true;assert.equal(seriesArtReady(d),true);
  const prompt=sourceBookPrompt(d);
  assert.match(prompt,/EXACTLY TWO/);assert.ok(prompt.includes('Option '+id));assert.ok(prompt.includes('references/'+characterOptionName(id)));
  assert.match(prompt,/do not redesign it/);assert.doesNotMatch(prompt,/First create images\/character-reference|Generate an actual character reference image first/);
  const entries=await sourceRequestEntries(d);
  for(const s of characterStyles)assert.equal(new TextDecoder().decode(entries['references/'+seriesReferenceName(s.id)]),'master-'+s.id);
  const missing={...d,references:{...d.references}};delete missing.references[characterOptionName(4)];
  assert.equal(seriesArtReady(missing),false);assert.match(sourceBookPrompt(missing),/CHARACTER OPTIONS ONLY/);
  d.visualDirection.handoff='approved';d.images={'character-reference.png':d.references[characterOptionName(id)],'style-sample.png':new Blob(['sample'])};
  assert.match(chapterPrompt(d),new RegExp('Option '+id));
 }
});
test('reuse preserves all four masters while discarding previous story character sheets',()=>{
 const d=sheets(fixture());d.references['reference-extra.png']=new Blob(['extra']);
 const kept=clearCharacterOptions(d.references);
 assert.equal(Object.keys(kept).length,5);
 for(const s of characterStyles){assert.equal(kept[seriesReferenceName(s.id)],d.references[seriesReferenceName(s.id)]);assert.equal(kept[characterOptionName(s.id)],undefined);}
 assert.deepEqual(Object.keys(clearCharacterOptions(d.references,true)),['reference-extra.png']);
});
test('metadata validation rejects unknown catalogue versions and options; legacy and notebook prompts stay compatible',()=>{
 for(const v of [null,[],{version:2},{version:1,option:5},{version:1,option:'1'},{version:1,approved:true},{version:1,approved:'yes'}])assert.throws(()=>parseSeriesArt(v));
 const d=fixture();assert.deepEqual(parseVisualDirection(d.visualDirection),d.visualDirection);
 delete d.visualDirection.seriesArt;assert.match(sourceBookPrompt(d),/COMPLETE IN ONE GO/);
 d.templateId='iks-notes';d.visualDirection.seriesArt={version:1};assert.doesNotMatch(sourceBookPrompt(d),/CHARACTER OPTIONS ONLY/);
});
test('cloud round trip preserves the four masters, current sheets, and chosen option',async()=>{
 const fetch=globalThis.fetch;const assets=new Map();let metadata;
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/library/books'){metadata=JSON.parse(options.body);return Response.json({revision:1});}
  if(options.method==='HEAD')return new Response(null,{status:assets.has(path)?200:404});
  if(options.method==='PUT'){assets.set(path,options.body);return new Response(null);}
  return new Response(assets.get(path));
 };
 try{
  const d=sheets(fixture());d.visualDirection.seriesArt={version:1,option:4,approved:true};
  await uploadDraft(d,'reader@example.com');
  const restored=await downloadDraft({...metadata,revision:1},'reader@example.com');
  assert.deepEqual(restored.visualDirection.seriesArt,d.visualDirection.seriesArt);
  assert.equal(Object.keys(restored.references).length,8);assert.equal(seriesArtReady(restored),true);
  assert.equal(await restored.references[seriesReferenceName(4)].text(),'master-4');
 }finally{globalThis.fetch=fetch;}
});
