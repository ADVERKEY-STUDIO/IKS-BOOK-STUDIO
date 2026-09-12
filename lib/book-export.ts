import type { Edition } from './devotional-edition.ts';
import { compositionFormat, compositionMarkup } from './spread-composition.ts';
import { storyboardPages } from './storyboard.ts';
import { proofReviewIssues, releaseReviewIssues } from './book-review.ts';

export type ExportMode = 'print' | 'digital';
export function bookExportIssues(e:Edition,final=false):string[] {
 const plans=(e.storyboard||[]).filter(p=>p.kind!=='cover');
 const issues=final?releaseReviewIssues(e):plans.flatMap(p=>proofReviewIssues(e,p.id));
 if(!plans.length)issues.push('Add interior pages before exporting.');
 const formats=plans.map(p=>compositionFormat(e,e.compositions?.find(c=>c.planId===p.id)));
 if(formats.some(f=>f.width!==formats[0].width||f.height!==formats[0].height||f.bleed!==formats[0].bleed))issues.push('Whole-book interiors require one trim size and bleed. Export custom cover compositions separately.');
 for(const p of plans)if(!e.compositions?.some(c=>c.planId===p.id))issues.push(`${p.title}: save a composition.`);
 return [...new Set(issues)];
}
export function bookPageSequence(e:Edition) {
 return storyboardPages(e.storyboard||[]).flatMap(a=>[
  ...(a.blankBefore?[{number:a.blankBefore,planId:'',side:0}]:[]),
  ...a.pages.map((number,side)=>({number,planId:a.id,side}))
 ]);
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Clip the shared spread renderer into single physical pages; keep source text as text. */
export function bookDocument(e:Edition,assets:Record<string,string>,font:string,mode:ExportMode,final=false):string {
 const issues=bookExportIssues(e,final);if(issues.length)throw new Error(issues.join('\n'));
 const first=e.compositions?.find(c=>c.planId===e.storyboard?.find(p=>p.kind!=='cover')?.id);
 const f=compositionFormat(e,first),b=mode==='print'?f.bleed:0,w=f.width+2*b,h=f.height+2*b;
 const pages=bookPageSequence(e).map(page=>{
  const c=e.compositions?.find(c=>c.planId===page.planId);
  const content=c?`<div style="position:absolute;left:${-page.side*f.width-(mode==='digital'?f.bleed:0)}mm;top:${mode==='digital'?-f.bleed:0}mm">${compositionMarkup(e,c,assets)}</div>`:'';
  return `<div class="page-flow"><section class="book-page" data-page="${page.number}" style="position:relative;overflow:hidden;width:${w}mm;height:${h}mm;background:${c?.paper||'#ffffff'}">${content}</section></div>`;
 }).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(e.metadata.title)} — ${final?'release':'WORKING PROOF'} — r${e.revision} — ${mode}</title><style>@font-face{font-family:BookProof;src:url('${escape(font)}')}@page{size:${w}mm ${h}mm;margin:0}*{box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact}html,body{margin:0;padding:0}.page-flow{position:relative;break-before:page;page-break-before:always}.page-flow:first-child{break-before:auto;page-break-before:auto}@media screen{body{background:#ddd}.book-page{margin:12px auto}}</style></head><body>${pages}</body></html>`;
}
