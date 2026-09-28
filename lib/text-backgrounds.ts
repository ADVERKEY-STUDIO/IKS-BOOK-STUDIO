export const textBackgroundShapes=['none','cloud','speech','rounded','parchment'] as const;
export type TextBackground={shape:typeof textBackgroundShapes[number];color:string;offsetX?:number;offsetY?:number;width?:number;height?:number;padding?:number};
export type TextBackgrounds=Partial<Record<'original'|'meaning',TextBackground>>;
export function parseTextBackgrounds(value:unknown):TextBackgrounds|undefined {
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid text backgrounds.');
 const result:TextBackgrounds={};
 for(const [role,raw] of Object.entries(value)){
  if(!['original','meaning'].includes(role)||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid text background.');
  const v=raw as Record<string,unknown>;
  if(!textBackgroundShapes.includes(v.shape as TextBackground['shape'])||typeof v.color!=='string'||!/^#[0-9a-f]{6}$/i.test(v.color))throw Error('Choose a supported text background and colour.');
  for(const [key,min,max] of [['offsetX',-50,50],['offsetY',-50,50],['width',50,200],['height',50,200],['padding',0,4]] as const){
   if(v[key]!==undefined&&(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max))throw Error('Invalid background adjustment.');
  }
  result[role as keyof TextBackgrounds]={shape:v.shape as TextBackground['shape'],color:v.color,...Object.fromEntries(['offsetX','offsetY','width','height','padding'].filter(k=>v[k]!==undefined).map(k=>[k,v[k]]))};
 }
 return result;
}
export function textBackgroundStyle(background:TextBackground|undefined){
 if(!background||background.shape==='none')return '';
 parseTextBackgrounds({original:background});
 const paths={
  cloud:'M18 16 C3 16 1 31 8 39 C0 49 2 65 14 69 C6 84 19 96 36 90 C45 101 65 98 73 92 C88 101 108 98 116 92 C135 102 150 96 155 90 C177 99 195 85 186 72 C200 68 203 49 192 40 C201 24 190 10 174 14 C169 1 150 0 137 9 C125 -1 104 0 96 8 C79 -1 60 1 53 10 C35 0 18 3 18 16 Z',
  speech:'M14 3 H186 Q197 3 197 14 V75 Q197 86 186 86 H48 L25 98 L30 86 H14 Q3 86 3 75 V14 Q3 3 14 3 Z',
  rounded:'M16 3 H184 Q197 3 197 16 V84 Q197 97 184 97 H16 Q3 97 3 84 V16 Q3 3 16 3 Z',
  parchment:'M10 3 L52 5 L100 2 L148 5 L191 3 L197 28 L194 52 L198 77 L190 97 L147 94 L100 98 L52 95 L9 97 L3 74 L6 50 L2 25 Z'
 };
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" preserveAspectRatio="none"><path d="${paths[background.shape]}" fill="${background.color}" stroke="#88775f" stroke-width="0.7"/></svg>`;
 return `--bg-x:${background.offsetX??0}%;--bg-y:${background.offsetY??0}%;--bg-width:${background.width??100}%;--bg-height:${background.height??100}%;--bg-padding:${background.padding??1.3}em;--text-background:url(&quot;data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,'%27')}&quot;);`;
}
export function textBackgroundCss(){return `
.planned-spread .planned-text.text-background{isolation:isolate;padding:var(--bg-padding,.9em)!important;background:transparent!important;outline:0!important}
.planned-spread .planned-text.text-background::after{content:"";position:absolute;left:var(--bg-x,0%);top:var(--bg-y,0%);width:var(--bg-width,100%);height:var(--bg-height,100%);z-index:-1;background-image:var(--text-background);background-size:100% 100%;background-repeat:no-repeat;pointer-events:none}
.planned-spread .planned-text.text-background-speech{padding-bottom:calc(var(--bg-padding,1.3em) + .5em)!important}
`;}
