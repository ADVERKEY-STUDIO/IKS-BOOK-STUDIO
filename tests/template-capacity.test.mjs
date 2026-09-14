import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBookArtwork, MiB, BOOK_ARTWORK_BYTES} from '../lib/template-capacity.ts';
import {readTemplateArchive} from '../lib/template-archive.ts';
import {zipSync} from 'fflate';
const images = count => Object.fromEntries(Array.from({length:count},(_,i)=>[`spread-${i}.png`,{size:3.3*MiB}]));
test('matching the thirteenth illustration and completing a 26-spread book preserves all artwork',()=>{
 const existing=images(12);
 assert.doesNotThrow(()=>validateBookArtwork({...existing,'spread-12.png':{size:3.3*MiB}}));
 assert.doesNotThrow(()=>validateBookArtwork(images(26)));
 assert.equal(Object.keys(existing).length,12);
});
test('replacement counts only the replacement and rejects a genuinely oversized book',()=>{
 assert.doesNotThrow(()=>validateBookArtwork({...images(26),'spread-0.png':{size:MiB}}));
 assert.throws(()=>validateBookArtwork({oversized:{size:BOOK_ARTWORK_BYTES+1}}),/Book artwork/);
});
test('a 26-illustration exported ZIP can be restored above the old 40 MB ceiling',()=>{
 const entries=Object.fromEntries(Array.from({length:26},(_,i)=>[`images/spread-${i}.png`,new Uint8Array(2*MiB)]));
 const archive=zipSync(entries,{level:0});
 const restored=readTemplateArchive(archive);
 assert.equal(Object.keys(restored).length,26);
 assert.equal(restored['images/spread-25.png'].length,2*MiB);
});
