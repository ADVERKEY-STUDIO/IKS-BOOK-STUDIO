import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSourceVerse,sourceImageSignature,sourceVerseSignature,sourceReviewIssues} from '../lib/source-book-review.ts';
const verse={id:'V1',sectionNumber:1,sourcePage:5,reference:'Source',sanskrit:'सत्यं वद ।\nधर्मं चर ।',status:'verified'};
const image={id:'S1',sourcePage:3,originalPath:'source-images/S1.png',cleanedPath:'cleaned-source-images/S1.png',caption:'Seeds',status:'available',placements:[{id:'P1',sectionNumber:1,anchorText:'Seeds grow.',reason:'Shows seeds'}]};
const assets=[{path:image.originalPath,key:'original',url:'/original.png'},{path:image.cleanedPath,key:'cleaned',url:'/cleaned.png'}];
const project=()=>({sourceManifest:{sourceImages:[structuredClone(image)],verses:[structuredClone(verse)]},sourceAssets:structuredClone(assets),sourceReview:{images:{S1:{signature:sourceImageSignature(image,assets),variant:'original',approvedAt:'now'}},verses:{V1:{signature:sourceVerseSignature(verse),sourceText:verse.sanskrit,method:'manual',sourceFile:'Source.pdf',approvedAt:'now'}}}});
test('verse comparison tolerates PDF whitespace but preserves words, marks and punctuation',()=>{
 assert.ok(compareSourceVerse(verse.sanskrit,'Page 5\nसत्यं वद । धर्मं चर ।\nFooter'));
 assert.equal(compareSourceVerse(verse.sanskrit,'सत्य वद । धर्मं चर ।'),false);
 assert.equal(compareSourceVerse(verse.sanskrit,'सत्यं वद धर्मं चर'),false);
 assert.equal(compareSourceVerse('',''),false);
});
test('AI verified status does not replace human review',()=>{
 const p=project();delete p.sourceReview;assert.equal(sourceReviewIssues(p).length,2);
 assert.equal(sourceReviewIssues(project()).length,0);
});
test('changed assets, context or verse companions require fresh review',()=>{
 for(const edit of [p=>p.sourceAssets[0].key='new',p=>p.sourceManifest.sourceImages[0].placements[0].anchorText='Different context',p=>p.sourceManifest.verses[0].translation='Changed translation',p=>p.sourceReview.verses.V1.sourceText='Different verse']){
 const p=project();edit(p);assert.equal(sourceReviewIssues(p).length,1);
 }
});
test('unplaced originals remain archival while extraction failures remain visible',()=>{
 const p=project();p.sourceManifest.sourceImages[0].placements=[];delete p.sourceReview.images.S1;assert.equal(sourceReviewIssues(p).length,0);
 p.sourceManifest.sourceImages[0].status='unavailable';p.sourceManifest.sourceImages[0].reason='Unreadable scan';assert.match(sourceReviewIssues(p)[0].message,/Unreadable scan/);
});
