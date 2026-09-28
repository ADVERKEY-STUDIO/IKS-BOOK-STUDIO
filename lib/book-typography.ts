export type BookTypography = {
 font: 'template' | 'serif' | 'sans';
 alignment: 'template' | 'left' | 'center' | 'right';
 lineHeight?: number;
};
export function parseBookTypography(value:unknown):BookTypography|undefined {
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid book typography.');
 const v=value as Record<string,unknown>;
 if(!['template','serif','sans'].includes(String(v.font))||!['template','left','center','right'].includes(String(v.alignment)))throw Error('Choose a supported book font and alignment.');
 if(v.lineHeight!==undefined&&(typeof v.lineHeight!=='number'||!Number.isFinite(v.lineHeight)||v.lineHeight<1.2||v.lineHeight>2))throw Error('Book line spacing must be between 1.2 and 2.');
 return {font:v.font as BookTypography['font'],alignment:v.alignment as BookTypography['alignment'],...(v.lineHeight===undefined?{}:{lineHeight:v.lineHeight as number})};
}
export function bookTypographyCss(value:BookTypography|undefined){
 const t=parseBookTypography(value);if(!t)return '';
 const font=t.font==='template'?'':'.spread,.spread *{font-family:Book,serif!important}';
 const rules=[t.lineHeight===undefined?'':`line-height:${t.lineHeight}!important`,t.alignment==='template'?'':`text-align:${t.alignment}!important`].filter(Boolean).join(';');
 return font+(rules?`.spread .original,.spread .meaning{${rules}}`:'');
}
