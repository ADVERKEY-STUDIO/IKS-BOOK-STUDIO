import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseTemplateBook} from '../lib/template-book.ts';
import {layoutIssues} from '../lib/template-layouts.ts';
import {zipSync,strToU8} from 'fflate';
import {readTemplateArchive} from '../lib/template-archive.ts';
const fixture=()=>({format:'iks-template-book-v1',projectId:'draft-test',templateId:'painted',title:'Draft',language:'Hindi',characterGuide:'',pages:[{id:'p1',title:'Passage',original:'जय हनुमान',meaning:'Meaning',sourceReference:'Page 1',scene:'Forest',image:'p1.png',layout:'art-right',fontSize:22,imageScale:100}]});
test('unfinished source edits survive editable ZIP round trip with an actionable warning',()=>{
 for(const original of ['', '  \n']){
  const book=fixture();book.pages[0].original=original;
  const archive=readTemplateArchive(zipSync({'book.json':strToU8(JSON.stringify(book))}));
  const restored=parseTemplateBook(JSON.parse(new TextDecoder().decode(archive['book.json'])));
  assert.equal(restored.pages[0].original,original);
  assert.equal(restored.pages[0].meaning,'Meaning');
  assert.ok(layoutIssues(restored).some(note=>/Spread 1: original text is empty/.test(note)));
 }
 const images=fixture();images.contentMode='images';images.pages[0].original='';
 assert.ok(!layoutIssues(parseTemplateBook(images)).some(note=>/original text is empty/.test(note)));
});
// Exercise the actual component handler without duplicating its decision tree.
const source=readFileSync(new URL('../app/template-studio/page.tsx',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('    function chooseTemplate('),source.indexOf('    function editPage('));
const compiled=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function choose(draft,id){
 let next=draft,error='';
 const fn=new Function('draft','chosenImages','patch','setDraft','setStep','setError','window',compiled+';return chooseTemplate;');
 fn(draft,[],p=>{next={...next,...p};},v=>{next=v;},()=>{},v=>{error=v;},{scrollTo(){}})(id);
 return {next,error};
}
test('changing an unassembled template preserves identity, source, references and reader settings',()=>{
 const draft={id:'existing-draft',templateId:'beanstalk-adventure',title:'My source',language:'Hindi',source:new File(['source'],'source.pdf'),images:{},references:{'reference.png':new Blob(['reference'])},visualDirection:{audience:'7–10',characters:'Hanuman',notes:'Warm colours'},updated:1,cloud:{email:'reader@example.test',revision:2,savedUpdated:1}};
 const {next,error}=choose(draft,'little-explorers');
 assert.equal(error,'');assert.equal(next.templateId,'little-explorers');
 for(const key of ['id','title','language','source','references','visualDirection','cloud'])assert.deepEqual(next[key],draft[key],key);
});
test('template selection still starts new books and protects assembled ones',()=>{
 assert.equal(choose(undefined,'painted').next.templateId,'painted');
 const draft={id:'assembled',book:fixture()};
 const result=choose(draft,'poetry');assert.equal(result.next,draft);assert.match(result.error,/Start another book/);
});
