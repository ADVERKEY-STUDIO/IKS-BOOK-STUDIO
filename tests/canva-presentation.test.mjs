import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {buildCanvaPresentation} from '../lib/canva-presentation.ts';
const run=text=>({text,fontSize:16,bold:false,italic:false,underline:false,color:'292723'});
const page=()=>({width:420/25.4,height:210/25.4,background:'FFF8E8',name:'Interior 1',elements:[
 {kind:'image',x:0,y:0,w:16,h:8,name:'Separate painting',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='},
 {kind:'shape',shape:'cloud',x:5,y:1,w:5,h:2,color:'FFFFFF',lineColor:'88775F'},
 {kind:'text',x:5.2,y:1.2,w:4.6,h:1.6,name:'original passage',fontFace:'Noto Sans Devanagari',align:'left',lineSpacingMultiple:1.6,runs:[run('1 · पाठ / Read first\nजय हनुमान ज्ञान गुण सागर।')]},
 {kind:'text',x:5,y:4,w:5,h:2,name:'meaning passage',fontFace:'Noto Sans Devanagari',align:'center',lineSpacingMultiple:1.8,runs:[run('2 · Meaning\nWisdom & courage <remain editable>.')]}
]});
test('Canva package has native Unicode text, editable shapes, pictures and physical page dimensions',async()=>{
 const bytes=await buildCanvaPresentation([page()],'Book');const files=unzipSync(bytes),xml=strFromU8(files['ppt/slides/slide1.xml']);
 assert.ok(xml.includes('जय हनुमान ज्ञान गुण सागर।'));assert.ok(xml.includes('Wisdom &amp; courage &lt;remain editable&gt;.'));
 assert.match(xml,/<p:pic>/);assert.match(xml,/<a:prstGeom prst="cloud"/);assert.match(xml,/Noto Sans Devanagari/);assert.match(xml,/<p:txBody>/);
 assert.match(strFromU8(files['ppt/presentation.xml']),/cx="15120000" cy="7560000"/);
 assert.ok(Object.keys(files).some(name=>name.startsWith('ppt/media/')));
});
test('mixed dimensions cannot silently stretch square covers into wide spreads',async()=>{
 await assert.rejects(()=>buildCanvaPresentation([page(),{...page(),width:210/25.4}],'Book'),/separate presentations/);
 await assert.rejects(()=>buildCanvaPresentation([],'Empty'),/no pages/);
 const cover={...page(),width:210/25.4,elements:[]};const files=unzipSync(await buildCanvaPresentation([cover],'Cover'));
 assert.match(strFromU8(files['ppt/presentation.xml']),/cx="7560000" cy="7560000"/);
});
