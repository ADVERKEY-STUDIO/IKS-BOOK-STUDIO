import { normalizeInspiration, inspirationBrief, inspirationBook, type BookInspiration } from './book-inspiration.ts';
import type { Edition } from './devotional-edition.ts';

export const guideTextFields = ['name', 'purpose', 'tone', 'medium', 'texture', 'linework', 'detail', 'spacing', 'ornaments', 'environments', 'culturalNotes', 'avoidances'] as const;
export const guideLayers = ['original', 'transliteration', 'translation', 'commentary', 'caption'] as const;
export type ArtGuide = Record<typeof guideTextFields[number], string> & {
  layout: 'quiet' | 'parallel' | 'framed';
  palette: { paper: string; ink: string; accent: string; support: string };
  typography: Record<typeof guideLayers[number], { size: number; lineHeight: number; family: 'serif' | 'sans' }>;
  references: BookInspiration;
};
export type GuideVersion = { version: number; guide: ArtGuide; sourceContext: string; createdAt: string; approvedAt?: string; reason: string };
export type ArtDirection = { versions: GuideVersion[] };
/** A stable editorial snapshot: approvals alone do not invalidate an art direction. */
export function guideContext(edition: Edition): string {
  const content = JSON.stringify({ metadata: edition.metadata, passages: edition.passages.filter(p => !p.retired).map(p => ({ id: p.id, location: p.location, fields: Object.fromEntries(Object.entries(p.fields).filter(([f]) => f !== 'notes').map(([f,v]) => [f,v.text])) })) });
  // Compact change detection, not a security hash; source protection is enforced separately.
  // Avoid duplicating a full manuscript in every guide version stored in D1.
  const words = [0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
  for (let i=0;i<content.length;i++) for(let j=0;j<words.length;j++) words[j]=Math.imul(words[j]^content.charCodeAt(i),16777619+j*2);
  return `context-1:${content.length}:${words.map(w=>(w>>>0).toString(16).padStart(8,'0')).join('')}`;
}
export function latestGuide(edition: Edition): GuideVersion | undefined { return edition.artDirection?.versions.at(-1); }
export function guideStatus(edition: Edition, version = latestGuide(edition)): 'none' | 'draft' | 'approved' | 'needs-review' {
  if (!version) return 'none';
  if (version.sourceContext !== guideContext(edition)) return 'needs-review';
  return version.approvedAt ? 'approved' : 'draft';
}
export function validateGuide(input: ArtGuide): ArtGuide {
  if (!input || typeof input !== 'object') throw new Error('A complete art guide is required.');
  const guide = structuredClone(input);
  for (const key of guideTextFields) if (typeof guide[key] !== 'string' || guide[key].length > 3000 || !guide[key].trim()) throw new Error(`Complete ${key} using at most 3,000 characters.`);
  if (!['quiet','parallel','framed'].includes(guide.layout)) throw new Error('Choose a supported sample composition.');
  for (const key of ['paper','ink','accent','support'] as const) if (!/^#[0-9a-f]{6}$/i.test(guide.palette?.[key])) throw new Error(`Choose a six-digit ${key} color.`);
  for (const layer of guideLayers) {
    const type = guide.typography?.[layer];
    if (!type || !Number.isFinite(type.size) || type.size < 12 || type.size > 36 || !Number.isFinite(type.lineHeight) || type.lineHeight < 1.3 || type.lineHeight > 2.4 || !['serif','sans'].includes(type.family)) throw new Error(`Check ${layer} typography: 12–36 pt, line height 1.3–2.4.`);
  }
  // Reject low-contrast reading palettes before they reach a proof.
  const luminance = (hex: string) => { const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; };
  const a=luminance(guide.palette.paper), b=luminance(guide.palette.ink);
  if ((Math.max(a,b)+.05)/(Math.min(a,b)+.05) < 4.5) throw new Error('Reading text needs stronger contrast against the paper color.');
  guide.references = normalizeInspiration(guide.references);
  return guide;
}
export function proposeArtDirections(edition: Edition, references?: BookInspiration): ArtGuide[] {
  const active = edition.passages.filter(p => !p.retired);
  if (!active.length) return [];
  const m = edition.metadata;
  const commentary = active.some(p => p.fields.commentary.text || p.fields.translation.text);
  const longest = Math.max(...active.map(p => p.fields.original.text.length));
  const family = m.audience !== 'Adults';
  const sourceText = [m.title,...active.map(p => Object.values(p.fields).map(f=>f.text).join(' '))].join(' ');
  const motif = /अग्नि|agni|fire|ज्योति|jyoti/i.test(sourceText) ? {label:'light and fire',paper:'#fff8ee',ink:'#432e28',accent:'#a34824',support:'#b69a72'}
    : /जल|नदी|गंगा|water|river|ganga/i.test(sourceText) ? {label:'water and rivers',paper:'#f3f9fb',ink:'#243b49',accent:'#306981',support:'#89aaa9'}
    : /वन|वृक्ष|forest|tree/i.test(sourceText) ? {label:'trees and landscape',paper:'#f7f9f1',ink:'#283c30',accent:'#476945',support:'#a0ac80'}
    : {label:'the work’s own imagery',paper:'#fffdf7',ink:'#263c34',accent:'#985332',support:'#8a9574'};
  const refs = normalizeInspiration(references);
  const paletteRef = inspirationBook(refs.references.palette);
  const imageRef = inspirationBook(refs.references.illustration);
  const typeRef = inspirationBook(refs.references.typography);
  const layoutRef = inspirationBook(refs.references.layout);
  const base: ArtGuide = {
    name: `${m.title} · Reading edition`, purpose: `${m.type} for ${m.audience.toLowerCase()}; ${active.length} source passage${active.length === 1 ? '' : 's'}. Preserve ${m.language} in ${m.script}.`,
    tone: family ? 'Welcoming, clear, and respectful; allow time for shared reading.' : 'Contemplative, clear, and dignified; support sustained reading.',
    medium: imageRef?.direction.illustration || `Restrained original ink vignettes; review ${motif.label} in context before using it as a visual motif.`,
    texture: 'Subtle paper texture in illustration areas; clean backgrounds behind text.', linework: 'Deliberate hand-drawn lines with a consistent weight.', detail: longest > 600 ? 'Low detail around long passages; reserve detailed imagery for separate areas.' : 'Moderate detail with an uncluttered reading area.',
    spacing: `${longest > 600 ? 'Use additional pages for long passages.' : 'Leave generous space around each verse.'} ${typeRef?.direction.typography || 'Keep original text visually distinct from explanation.'} ${layoutRef?.direction.layout || ''}`,
    ornaments: 'Restrained opening and closing rules; no repeating decorative border on every page.', environments: `The manuscript suggests ${motif.label}. Confirm whether references are literal, symbolic, or philosophical before depicting them; do not invent sacred attributes.`, culturalNotes: `Confirm details against ${m.sourceEdition || 'the chosen source edition'} and ${m.attribution || 'the credited tradition'}. Language and script do not establish iconography.`, avoidances: 'No generated lettering inside artwork, copied publisher illustrations, decorative clutter, or changes to approved scripture.', layout: 'quiet',
    palette: paletteRef ? {...paletteRef.palette} : {paper:motif.paper,ink:motif.ink,accent:motif.accent,support:motif.support},
    typography: {original:{size:family?24:22,lineHeight:1.9,family:'serif'},transliteration:{size:14,lineHeight:1.7,family:'serif'},translation:{size:16,lineHeight:1.7,family:'serif'},commentary:{size:14,lineHeight:1.7,family:'serif'},caption:{size:12,lineHeight:1.5,family:'sans'}}, references: refs,
  };
  return [base, {...structuredClone(base),name:`${m.title} · ${commentary ? 'Verse and interpretation' : 'Open verse'}`,layout:'parallel',spacing:commentary?'Place the original and its interpretation in separate, clearly labeled reading zones. Let long commentary continue naturally.':'Separate successive passages with generous space; do not invent explanations to fill the page.',palette:{paper:'#f6f9fb',ink:'#233744',accent:'#355e79',support:'#8ba6af'},ornaments:'Use a fine separating rule and restrained page furniture; no ornamental frame.'}, {...structuredClone(base),name:`${m.title} · Illustrated frame`,layout:'framed',medium:imageRef?.direction.illustration || 'Original painted vignettes with soft edges; artwork follows the passage rather than filling a fixed slot.',spacing:'A protected reading area with artwork planned around its edges. Alternate framed moments with open reading pages.',palette:{paper:'#fff8ef',ink:'#482f29',accent:'#a4462b',support:'#b3a175'},ornaments:'A restrained frame on selected passages; omit it when a scene needs open space.'}];
}
export function artDirectionBrief(edition: Edition): string {
  const version = latestGuide(edition);
  if (!version || guideStatus(edition,version) !== 'approved') throw new Error('Approve the latest art guide against the current manuscript before production.');
  const g=version.guide;
  return `APPROVED ART GUIDE — VERSION ${version.version}\nBook: ${edition.metadata.title}\nAudience: ${edition.metadata.audience}\nApproved: ${version.approvedAt}\nManuscript context: ${version.sourceContext}\n\n${guideTextFields.map(key => `${key.toUpperCase()}: ${g[key]}`).join('\n\n')}\n\nPALETTE\n${JSON.stringify(g.palette)}\n\nTYPOGRAPHY (points)\n${guideLayers.map(l => `${l}: ${g.typography[l].family}, ${g.typography[l].size} pt, line height ${g.typography[l].lineHeight}`).join('\n')}\n\nSAMPLE COMPOSITION: ${g.layout}\n\n${inspirationBrief(g.references)}\n\nPRODUCTION REQUIREMENTS\nRecord artGuideVersion=${version.version} on produced assets and spread compositions. Keep source passages as separately typeset text. Treat this brief as design guidance, never as authorization to rewrite the source. Review this guide again after manuscript changes.`;
}
export function outdatedGuideWork(edition: Edition): {targetId:string;version:number}[] {
  const current=latestGuide(edition);
  return (edition.artGuideUsage || []).filter(u => !current || u.version !== current.version || guideStatus(edition) !== 'approved');
}
/** Shared CSS for reading proof and export; only approved, current guides apply. */
export function artGuideProofCss(edition: Edition, root = '.edition-proof'): string {
  const current=latestGuide(edition);
  if (!current || guideStatus(edition)!=='approved') return '';
  const g=validateGuide(current.guide);
  const family=(layer:typeof guideLayers[number]) => g.typography[layer].family==='sans'?"system-ui,'Book Sanskrit',Edition,sans-serif":"'Book Sanskrit',Edition,Georgia,serif";
  return `${root}{background:${g.palette.paper};color:${g.palette.ink};padding:24px}${root} article{border-color:${g.palette.support}}${root} h2,${root} h3{color:${g.palette.ink}}${guideLayers.map(l=>`${root} .${l==='original'?'edition-original, '+root+' .original':l}{font-size:${g.typography[l].size}pt;line-height:${g.typography[l].lineHeight};font-family:${family(l)}}`).join('')} ${root} small{color:${g.palette.ink};font-size:${g.typography.caption.size}pt;line-height:${g.typography.caption.lineHeight};font-family:${family('caption')}}${g.layout==='framed'?`${root} article{border:1px solid ${g.palette.accent};padding:20px}`:''}`;
}
