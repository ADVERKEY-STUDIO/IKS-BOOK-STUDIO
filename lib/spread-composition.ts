import type { Edition, PassageField } from './devotional-edition.ts';
import type { SpreadPlan } from './storyboard.ts';

export type PrintFormat = { width: number; height: number; bleed: number; margin: number; gutter: number };
export type CompositionLayer = {
  id: string; kind: 'text' | 'image' | 'ornament'; x: number; y: number; width: number; height: number;
  hidden: boolean; locked: boolean; opacity: number;
  binding?: { passageId: string; field: PassageField; start: number; end: number };
  text: string; imageKey: string; fontSize: number; fontFamily?: 'serif' | 'sans'; lineHeight: number; inset: number;
  color: string; background: string; align: 'left' | 'center' | 'right';
  fit: 'cover' | 'contain'; focalX: number; focalY: number; softEdge: number;
};
export type SpreadComposition = { planId: string; planRevision: number; revision: number; guideVersion: number; sourceContext?: string; format?: PrintFormat; paper: string; layers: CompositionLayer[] };
export type CompositionAction = { type: 'save-composition'; composition: SpreadComposition } | { type: 'save-print-format'; format: PrintFormat };
export const defaultPrintFormat: PrintFormat = { width: 210, height: 250, bleed: 3, margin: 15, gutter: 8 };
export function compositionFormat(edition: Edition, composition?: SpreadComposition): PrintFormat { return composition?.format || edition.printFormat || defaultPrintFormat; }
export function layerDefaults(id: string, kind: CompositionLayer['kind']): CompositionLayer {
  return { id, kind, x: 15, y: 20, width: 170, height: 70, hidden: false, locked: false, opacity: 1, text: '', imageKey: '', fontSize: 18, lineHeight: 1.7, inset: 3, color: '#263c34', background: '#ffffff', align: 'left', fit: 'contain', focalX: 50, focalY: 50, softEdge: 0 };
}
export function initialComposition(edition: Edition, plan: SpreadPlan): SpreadComposition {
  const f=compositionFormat(edition), guide=edition.artDirection?.versions.at(-1), layers:CompositionLayer[]=[];
  for(const a of plan.allocations) for(const field of a.fields) {
    const passage=edition.passages.find(p=>p.id===a.passageId), range=field==='original'?a:a.ranges?.[field]||{start:0,end:passage?.fields[field].text.length||0};
    const layer=layerDefaults(`text-${layers.length+1}`,'text');
    layer.binding={passageId:a.passageId,field,start:range.start,end:range.end};
    const style=field!=='notes'?guide?.guide.typography[field]:undefined;
    layer.fontFamily=style?.family||'serif';layer.fontSize=style?.size||18;layer.lineHeight=style?.lineHeight||1.7;layer.color=guide?.guide.palette.ink||layer.color;
    const perPage=Math.max(1,Math.ceil(plan.allocations.reduce((n,a)=>n+a.fields.length,0)/(plan.kind==='spread'?2:1)));
    const col=plan.kind==='spread'?Math.floor(layers.length/perPage):0;
    layer.x=col*f.width+f.margin;layer.width=f.width-2*f.margin;layer.height=(f.height-2*f.margin)/perPage;layer.y=f.margin+(layers.length%perPage)*layer.height;
    layers.push(layer);
  }
  return {planId:plan.id,planRevision:plan.revision,revision:0,guideVersion:guide?.version||0,paper:guide?.guide.palette.paper||'#fffdf7',sourceContext:sourceContext(edition,layers),layers};
}
function sourceContext(edition:Edition,layers:CompositionLayer[]):string { return JSON.stringify(layers.filter(l=>l.binding).map(l=>[l.binding,edition.passages.find(p=>p.id===l.binding!.passageId)?.fields[l.binding!.field].text])); }
export function layerText(edition: Edition, layer: CompositionLayer): string {
  if(!layer.binding)return layer.text;
  const b=layer.binding,p=edition.passages.find(p=>p.id===b.passageId&&!p.retired);
  return p?.fields[b.field].text.slice(b.start,b.end)||'';
}
export function validatePrintFormat(f: PrintFormat): PrintFormat {
  if(!f||(['width','height','bleed','margin','gutter'] as const).some(k=>typeof f[k]!=='number'||!Number.isFinite(f[k])))throw new Error('Use valid physical dimensions.');
  if(f.width<80||f.width>400||f.height<80||f.height>500||f.bleed<0||f.bleed>10||f.margin<5||f.margin>40||f.gutter<0||f.gutter>30||f.margin*2>=Math.min(f.width,f.height))throw new Error('Check trim size, bleed, margins, and gutter dimensions.');
  return {width:f.width,height:f.height,bleed:f.bleed,margin:f.margin,gutter:f.gutter};
}
export function applyCompositionAction(edition: Edition, action: CompositionAction): void {
  if(action.type==='save-print-format'){edition.printFormat=validatePrintFormat(action.format);return;}
  const c=structuredClone(action.composition),plan=edition.storyboard?.find(p=>p.id===c?.planId);
  if(!plan)throw new Error('Select an existing storyboard plan.');
  if(!Array.isArray(c.layers)||c.layers.length>100||new Set(c.layers.map(l=>l.id)).size!==c.layers.length)throw new Error('Use up to 100 uniquely identified layers.');
  if(c.format)c.format=validatePrintFormat(c.format);
  const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  if(!color(c.paper))throw new Error('Use a six-digit paper color.');
  for(const l of c.layers){
    if(typeof l.id!=='string'||!l.id||l.id.length>100||!['text','image','ornament'].includes(l.kind))throw new Error('Invalid layer identity.');
    for(const key of ['x','y','width','height','opacity','fontSize','lineHeight','inset','focalX','focalY','softEdge'] as const)if(typeof l[key]!=='number'||!Number.isFinite(l[key]))throw new Error('Layer dimensions must be finite numbers.');
    if(Math.abs(l.x)>1000||Math.abs(l.y)>1000||l.width<1||l.width>1000||l.height<1||l.height>1000||l.opacity<0||l.opacity>1||l.fontSize<6||l.fontSize>100||l.lineHeight<1||l.lineHeight>3||l.inset<0||l.inset>30||l.focalX<0||l.focalX>100||l.focalY<0||l.focalY>100||l.softEdge<0||l.softEdge>30)throw new Error('Layer settings exceed supported limits.');
    if(l.fontFamily && !['serif','sans'].includes(l.fontFamily))throw new Error('Choose a supported font family.');
    if(typeof l.hidden!=='boolean'||typeof l.locked!=='boolean'||!color(l.color)||!color(l.background)||!['left','center','right'].includes(l.align)||!['cover','contain'].includes(l.fit)||typeof l.text!=='string'||l.text.length>50000||typeof l.imageKey!=='string')throw new Error('Invalid layer settings.');
    if(l.kind==='image'&&!edition.visualReferences?.some(r=>r.versions.some(v=>v.images.some(i=>i.key===l.imageKey))))throw new Error('Choose artwork registered in this edition.');
    if(l.binding){const b=l.binding,p=edition.passages.find(p=>p.id===b.passageId&&!p.retired);if(l.kind!=='text'||!p||!['original','transliteration','translation','commentary'].includes(b.field)||!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<0||b.end<=b.start||b.end>p.fields[b.field].text.length)throw new Error('Invalid protected text binding.');}
  }
  if(c.planRevision!==plan.revision)throw new Error('Storyboard changed. Rebuild the composition from the current plan before saving.');
  const old=edition.compositions?.find(p=>p.planId===c.planId);
  const saved={planId:plan.id,planRevision:plan.revision,revision:(old?.revision||0)+1,guideVersion:edition.artDirection?.versions.at(-1)?.version||0,format:c.format,paper:c.paper,layers:c.layers,sourceContext:sourceContext(edition,c.layers)};
  const targetId=`composition:${plan.id}`;
  edition.bindings=edition.bindings.filter(b=>b.targetId!==targetId);
  for(const l of c.layers)if(l.binding)edition.bindings.push({targetId,passageId:l.binding.passageId});
  edition.artGuideUsage=[...(edition.artGuideUsage||[]).filter(u=>u.targetId!==targetId),{targetId,version:saved.guideVersion}];
  edition.compositions=[...(edition.compositions||[]).filter(p=>p.planId!==c.planId),saved];
}
export function compositionIssues(edition: Edition,c: SpreadComposition): string[] {
  const plan=edition.storyboard?.find(p=>p.id===c.planId),f=compositionFormat(edition,c),width=f.width*(plan?.kind==='spread'?2:1),issues:string[]=[];
  if(!plan)return ['Storyboard plan was removed.'];
  if(c.sourceContext && c.sourceContext!==sourceContext(edition,c.layers))issues.push('Source wording changed. Review all linked text positions and ranges.');
  if(c.planRevision!==plan.revision)issues.push('Storyboard changed. Review text allocation before saving this composition.');
  if(c.guideVersion!==(edition.artDirection?.versions.at(-1)?.version||0))issues.push('Art guide changed. Review this composition.');
  for(const l of c.layers.filter(l=>!l.hidden)){
    if(l.x< -f.bleed||l.y< -f.bleed||l.x+l.width>width+f.bleed||l.y+l.height>f.height+f.bleed)issues.push(`${l.id}: layer extends outside the bleed canvas.`);
    if(l.kind==='text'){
      if(l.x<f.margin||l.y<f.margin||l.x+l.width>width-f.margin||l.y+l.height>f.height-f.margin)issues.push(`${l.id}: text crosses the safe margin.`);
      if(plan.kind==='spread'&&l.x<f.width+f.gutter&&l.x+l.width>f.width-f.gutter)issues.push(`${l.id}: text crosses the gutter safety area.`);
      if(l.binding){const p=edition.passages.find(p=>p.id===l.binding!.passageId&&!p.retired);if(!p||l.binding.end>p.fields[l.binding.field].text.length||p.fields[l.binding.field].status!=='approved')issues.push(`${l.id}: source text needs review.`);}
    }
    if(l.kind==='image'){
      const image=edition.visualReferences?.flatMap(r=>r.versions.flatMap(v=>v.images)).find(i=>i.key===l.imageKey);
      if(plan.kind==='spread' && l.x+l.width*l.focalX/100>f.width-f.gutter && l.x+l.width*l.focalX/100<f.width+f.gutter)issues.push(`${l.id}: image focal point is in the gutter safety area. Adjust the crop or placement.`);
      if(!image)issues.push(`${l.id}: missing artwork.`);
      else if((l.fit==='cover'?Math.min:Math.max)(image.width/(l.width/25.4),image.height/(l.height/25.4))<300)issues.push(`${l.id}: image resolution is below 300 dpi at this size.`);
    }
  }
  for(const a of plan.allocations)for(const field of a.fields){const p=edition.passages.find(p=>p.id===a.passageId);const range=field==='original'?a:a.ranges?.[field]||{start:0,end:p?.fields[field].text.length||0};const matches=c.layers.filter(l=>!l.hidden&&l.binding?.passageId===a.passageId&&l.binding.field===field&&l.binding.start===range.start&&l.binding.end===range.end);if(matches.length!==1)issues.push(`${field}: expected one visible layer for the planned text range; found ${matches.length}.`);}
  return issues;
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Shared physical renderer: editor and exported proof use these exact elements and styles. */
export function compositionMarkup(edition: Edition,c:SpreadComposition,assets:Record<string,string>,guides=false):string {
  const plan=edition.storyboard?.find(p=>p.id===c.planId),f=compositionFormat(edition,c),w=f.width*(plan?.kind==='spread'?2:1);
  const layers=c.layers.filter(l=>!l.hidden).map(l=>{
    const style=`position:absolute;box-sizing:border-box;left:${l.x+f.bleed}mm;top:${l.y+f.bleed}mm;width:${l.width}mm;height:${l.height}mm;opacity:${l.opacity};overflow:hidden;`;
    const content=l.kind==='text'?`<div data-text="${escape(l.id)}" style="width:100%;height:100%;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;padding:${l.inset}mm;font:${l.fontSize}pt/${l.lineHeight} ${l.fontFamily==='sans'?'BookProof, sans-serif':'BookProof, serif'};text-align:${l.align};color:${l.color};">${escape(layerText(edition,l))}</div>`:l.kind==='image'?`<img alt="" src="${escape(assets[l.imageKey]||'')}" style="width:100%;height:100%;object-fit:${l.fit};object-position:${l.focalX}% ${l.focalY}%;${l.softEdge?`mask-image:radial-gradient(ellipse,black ${100-l.softEdge}%,transparent 100%);`:''}">`:`<div style="box-sizing:border-box;width:100%;height:100%;border:0.4mm solid ${l.color};background:${l.background}"></div>`;
    return `<div data-layer="${escape(l.id)}" style="${style}">${content}</div>`;
  }).join('');
  const guide=guides?`<div style="pointer-events:none;position:absolute;left:${f.bleed}mm;top:${f.bleed}mm;width:${w}mm;height:${f.height}mm;border:0.25mm dashed #c45340;box-sizing:border-box"></div>${Array.from({length:plan?.kind==='spread'?2:1},(_,i)=>`<div style="pointer-events:none;position:absolute;left:${f.bleed+i*f.width+f.margin}mm;top:${f.bleed+f.margin}mm;width:${f.width-2*f.margin}mm;height:${f.height-2*f.margin}mm;border:0.2mm dashed #668b7e;box-sizing:border-box"></div>`).join('')}${plan?.kind==='spread'?`<div style="pointer-events:none;position:absolute;left:${f.bleed+f.width-f.gutter}mm;top:${f.bleed}mm;width:${2*f.gutter}mm;height:${f.height}mm;background:#ba694b22;border-left:0.2mm dashed #ba694b;border-right:0.2mm dashed #ba694b"></div>`:''}`:'';
  return `<div class="spread-sheet" style="position:relative;overflow:hidden;width:${w+2*f.bleed}mm;height:${f.height+2*f.bleed}mm;background:${c.paper}">${layers}${guide}</div>`;
}
export function compositionDocument(edition: Edition,c:SpreadComposition,assets:Record<string,string>,font:string):string {
  const f=compositionFormat(edition,c),plan=edition.storyboard?.find(p=>p.id===c.planId),w=f.width*(plan?.kind==='spread'?2:1)+2*f.bleed;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(plan?.title||'Spread proof')}</title><style>@font-face{font-family:BookProof;src:url('${escape(font)}')}@page{size:${w}mm ${f.height+2*f.bleed}mm;margin:0}html,body{margin:0;padding:0}@media print{html,body{height:1px!important}.spread-sheet{position:fixed!important;left:0;top:0}}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${compositionMarkup(edition,c,assets)}</body></html>`;
}
