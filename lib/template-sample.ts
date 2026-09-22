import { planTemplateBook } from './template-layouts.ts';
import { literaryTemplates } from './literary-templates.ts';
import { renderTemplateBook, type TemplateBook, type TemplateId } from './template-book.ts';
/** One front cover plus one facing-page spread (two interior pages). */
export function templateSample(id: TemplateId): TemplateBook {
 const t=literaryTemplates.find(t=>t.id===id);
 if(!t)throw Error('No literary sample for this template.');
 return planTemplateBook({format:'iks-template-book-v1',projectId:'sample-'+id,templateId:id,title:t.sampleTitle,language:'Essays on attention & everyday wisdom',characterGuide:'Editorial sample; no recurring characters.',pages:[{
 id:'sample-spread',title:id==='wild'?'The life around us':id==='fragments'?'What objects remember':id==='chromatic'?'A different perspective':id==='echo'?'Learning to notice':id==='haze'?'An unhurried moment':'Begin with attention',
 original:'A leaf turns toward the light.\nA river finds its way through stone.\n\nAttention is where learning begins.',
 meaning:'Look closely\n\nNotice a shape, a sound, or the work of someone’s hands. Let the details lead you toward a question.\n\nWhat did you notice today?',
 sourceReference:'Original demonstration text',scene:'Illustrative sample artwork',image:'sample.png',layout:'art-right',fontSize:22,imageScale:100}]});
}
export function renderTemplateSample(id:TemplateId){
 const t=literaryTemplates.find(t=>t.id===id)!;
 const book=templateSample(id);
 return renderTemplateBook(book,{'sample.png':t.demo},'/fonts/book-sanskrit.ttf').replace(/contenteditable="true"/g,'').replace('</style>',`
 body{background:#ece8df;padding:4%;container-type:inline-size}
 .toolbar{display:none}.spread{width:100%;height:auto;aspect-ratio:420/250;margin:5% auto;zoom:1!important;container-type:inline-size;box-shadow:0 3px 16px #0002;font-size:2.2cqw}
 .spread.cover{width:52%;aspect-ratio:210/250;padding:4%!important;margin-top:0}
 .copy,.art{padding:5%;min-width:0}.copy h2{font-size:2.5cqw;margin:0 0 5%;line-height:1.25}.copy .original{font-size:2cqw!important;line-height:1.65}.copy .meaning{font-size:1.8cqw;line-height:1.6;margin-top:5%}.folio{font-size:1.25cqw;bottom:3%;left:6%}
 .manifesto .copy h2{font-size:5cqw}.chromatic .copy h2{font-size:6cqw}.wild .folio{left:auto;right:5%}.echo .copy .original{font-size:2.7cqw!important}.haze .copy .meaning{margin-top:0}
 .sample-label{font:12px Arial,sans-serif;text-align:center;color:#514e47;margin:0}
 @media print{body{padding:0}.sample-label{display:none}}
 </style>`).replace('</section><section', '</section><p class="sample-label">Inside the book · pages 2–3</p><section');
}
