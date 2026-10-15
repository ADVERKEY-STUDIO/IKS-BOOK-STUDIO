import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { selectedCategoryGroups, prepareCataloguePdf } from '../lib/catalogue-source.ts';
import { cataloguePdfDownload } from '../lib/catalogue-pdf-download.ts';
const book = (id,categories,pdf) => ({id,title:id,sourceUrl:`https://archive.org/details/${id}`,pdfUrl:`https://archive.org/download/${id}/${id}.pdf`,categories,pdf});
async function pdf(pages) { const document = await PDFDocument.create(); for(let i=0;i<pages;i++) document.addPage(); return new Blob([await document.save()],{type:'application/pdf'}); }
test('selection is grouped across categories without adding unselected books or repeating a book',()=>{
 const a=book('a',['Math','Stories','Math']),b=book('b',['Math']),c=book('c',['Art']);
 assert.deepEqual(selectedCategoryGroups([a,b,c],['a','b']).map(g=>[g.category,g.books.map(b=>b.id)]),[['Math',['a','b']],['Stories',['a']]]);
 assert.deepEqual(selectedCategoryGroups([a],[]),[]);
});
test('multiple saved PDFs form a real source with exact original-to-combined page ranges',async()=>{
 const a=book('a',['Math'],await pdf(2)),b=book('b',['Math'],await pdf(3));
 const result=await prepareCataloguePdf([a,b],'Math',()=>{},()=>{throw new Error('Saved PDFs should not be downloaded');});
 assert.equal((await PDFDocument.load(await result.file.arrayBuffer())).getPageCount(),5);
 assert.deepEqual(result.sources.map(s=>[s.id,s.startPage,s.endPage]),[['a',1,2],['b',3,5]]);
});
test('remote source uses ID endpoint and rejects a failed/non-PDF response without a partial project',async()=>{
 const a=book('a',['Math']);
 await assert.rejects(prepareCataloguePdf([a],'Math',()=>{},async url=>{assert.equal(url,'/api/catalogue/pdf?id=a');return Response.json({error:'Archive unavailable'},{status:502});}),/Archive unavailable/);
 await assert.rejects(prepareCataloguePdf([a],'Math',()=>{},async()=>new Response('<html>login</html>')),/not a PDF/);
});
test('download endpoint rejects unknown IDs and redirects outside the archive',async()=>{
 let called=false;
 assert.equal((await cataloguePdfDownload(new Request('https://studio.test/api/catalogue/pdf?id=unknown'),[book('a',[])],async()=>{called=true;})).status,404);
 assert.equal(called,false);
 const result=await cataloguePdfDownload(new Request('https://studio.test/api/catalogue/pdf?id=a'),[book('a',[])],async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}}));
 assert.equal(result.status,502);
 assert.match(await result.text(),/Unexpected archive/);
});
test('download endpoint streams a successful archive response',async()=>{
 const result=await cataloguePdfDownload(new Request('https://studio.test/api/catalogue/pdf?id=a'),[book('a',[])],async()=>new Response('%PDF-test'));
 assert.equal(result.status,200); assert.equal(await result.text(),'%PDF-test');
});
