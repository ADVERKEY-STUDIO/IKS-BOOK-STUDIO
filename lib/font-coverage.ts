export const PROOF_FONT_SHA256='1191e07bfeb062d80e252eb85b0eafdfbda1e350707a2a60628668e8f677dbbb';
/** Unicode cmap formats 4/12. OpenType: https://learn.microsoft.com/en-us/typography/opentype/spec/cmap */
export function fontCoverage(buffer:ArrayBuffer):(codePoint:number)=>boolean {
 const v=new DataView(buffer);const fits=(o:number,n:number)=>o>=0&&o+n<=v.byteLength;
 const u16=(o:number)=>{if(!fits(o,2))throw new Error('Truncated font table.');return v.getUint16(o);};
 const u32=(o:number)=>{if(!fits(o,4))throw new Error('Truncated font table.');return v.getUint32(o);};
 let cmap=-1,cmapLength=0;
 const tables=u16(4);if(!fits(12,tables*16))throw new Error('Invalid font directory.');
 for(let i=0;i<tables;i++){const p=12+i*16;if(u32(p)===0x636d6170){cmap=u32(p+8);cmapLength=u32(p+12);}}
 if(cmap<0||!fits(cmap,cmapLength)||cmapLength<4)throw new Error('Unicode font map unavailable.');
 const maps=u16(cmap+2);if(4+maps*8>cmapLength)throw new Error('Invalid cmap directory.');
 const candidates:{start:number;format:number;length:number}[]=[];
 for(let i=0;i<maps;i++){
  const p=cmap+4+i*8,platform=u16(p),encoding=u16(p+2),s=cmap+u32(p+4);
  if(!(platform===0||platform===3&&(encoding===1||encoding===10)))continue;
  if(s<cmap||s+4>cmap+cmapLength)throw new Error('Invalid cmap offset.');
  const format=u16(s);if(format!==4&&format!==12)continue;
  const length=format===4?u16(s+2):u32(s+4);if(length<(format===4?16:16)||s+length>cmap+cmapLength)throw new Error('Invalid cmap length.');
  candidates.push({start:s,format,length});
 }
 const chosen=candidates.find(m=>m.format===12)||candidates.find(m=>m.format===4);if(!chosen)throw new Error('Supported Unicode cmap unavailable.');
 const {start:s,length}=chosen;
 if(chosen.format===12){
  const count=u32(s+12);if(16+12*count>length)throw new Error('Invalid Unicode range count.');
  return cp=>{let lo=0,hi=count-1;while(lo<=hi){const mid=(lo+hi)>>>1,p=s+16+mid*12,a=u32(p),b=u32(p+4);if(cp<a)hi=mid-1;else if(cp>b)lo=mid+1;else return u32(p+8)+cp-a!==0;}return false;};
 }
 const count=u16(s+6)/2;if(!Number.isInteger(count)||!count||16+8*count>length)throw new Error('Invalid BMP segment count.');
 return cp=>{
  if(cp<0||cp>0xffff)return false;
  for(let i=0;i<count;i++){
   const end=u16(s+14+2*i);if(cp>end)continue;
   const start=u16(s+16+2*count+2*i);if(cp<start)return false;
   const delta=u16(s+16+4*count+2*i),offsetPos=s+16+6*count+2*i,offset=u16(offsetPos);
   if(!offset)return ((cp+delta)&0xffff)!==0;
   const glyphPos=offsetPos+offset+2*(cp-start);if(glyphPos<s||glyphPos+2>s+length)throw new Error('Invalid glyph offset.');
   const glyph=u16(glyphPos);return glyph!==0&&((glyph+delta)&0xffff)!==0;
  }return false;
 };
}
export function missingGlyphs(text:string,supports:(cp:number)=>boolean):string[]{
 return [...new Set([...text].filter(c=>{const cp=c.codePointAt(0)!;return !/\s/u.test(c)&&![0x200c,0x200d,0xfeff,0xfe0e,0xfe0f].includes(cp)&&!supports(cp);} ))];
}
