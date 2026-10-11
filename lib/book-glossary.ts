export type GlossaryEntry = { term: string; hindi: string; english: string; sourceReference: string };
export function parseBookGlossary(value: unknown): GlossaryEntry[] | undefined {
 if (value === undefined) return;
 if (!Array.isArray(value) || value.length > 160) throw Error('Glossary must contain at most 160 words.');
 return value.map(item => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Invalid glossary word.');
  const result = {} as GlossaryEntry;
  for (const key of ['term','hindi','english','sourceReference'] as const) {
   const limit = key === 'term' ? 60 : 160;
   if (typeof item[key] !== 'string' || item[key].length > limit) throw Error(`Glossary ${key} must be text under ${limit} characters.`);
   result[key] = item[key];
  }
  return result;
 });
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderBookGlossary(entries: GlossaryEntry[] = []) {
 const spreads=[];
 // Four entries per physical page leave room for readable bilingual definitions.
 for(let i=0;i<entries.length;i+=8) spreads.push(`<section class="spread glossary-spread" aria-label="Word meanings ${i/8+1}"><h1>शब्दार्थ · Word meanings</h1><div class="glossary-grid">${entries.slice(i,i+8).map(e=>`<div class="glossary-entry"><h2 contenteditable="true">${esc(e.term)}</h2><p contenteditable="true">${esc(e.hindi)}</p><p contenteditable="true">${esc(e.english)}</p><small contenteditable="true">${esc(e.sourceReference)}</small></div>`).join('')}</div></section>`);
 return spreads.join('');
}
export function glossaryMarkdown(entries: GlossaryEntry[] = []) {
 return entries.length ? '\n\n## शब्दार्थ · Word meanings\n\n'+entries.map(e=>`### ${e.term}\n\n${e.hindi}\n\n${e.english}\n\n${e.sourceReference}`).join('\n\n') : '';
}
export function bookGlossaryCss(){return `.spread.glossary-spread{display:block;padding:12mm 24mm;container-type:inline-size;background:#fffbed;color:#292723}.glossary-spread h1{font-size:2cqw;line-height:1.3;margin:0 0 2%}.glossary-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);grid-auto-flow:column;column-gap:10%;row-gap:2%;height:84%}.glossary-entry{min-width:0;overflow-wrap:anywhere}.glossary-entry h2{font-size:1.5cqw;color:#8b3628;margin:0 0 .2em}.glossary-entry p{font-size:1.2cqw;line-height:1.4;margin:.2em 0}.glossary-entry small{font:1cqw Book,serif;color:#57534a}`;}
