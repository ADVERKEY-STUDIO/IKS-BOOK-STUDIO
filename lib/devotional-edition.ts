import { artGuideProofCss, validateGuide, guideContext, latestGuide, type ArtDirection, type ArtGuide } from './art-direction.ts';
/** Protected editorial content is changed only through explicit revision commands. */
export const editionTypes = ['Original verses', 'Scripture with commentary', 'Illustrated devotional edition', 'Devotional narrative or retelling', 'Children’s or family adaptation'] as const;
export const editionAudiences = ['Adults', 'Families', 'Children'] as const;
export const passageFields = ['original', 'transliteration', 'translation', 'commentary', 'notes'] as const;
export type PassageField = typeof passageFields[number];
export type Provenance = 'user-provided' | 'extracted' | 'generated';
export type EditorialField = { text: string; provenance: Provenance; status: 'draft' | 'approved' | 'stale'; approvedAt?: string };
export type PassageSnapshot = { revision: number; fields: Record<PassageField, EditorialField>; location: string; reason: string; at: string };
export type Passage = { id: string; revision: number; location: string; fields: Record<PassageField, EditorialField>; history: PassageSnapshot[]; derivedFrom: string[]; retired?: boolean };
export type EditionMetadata = { title: string; type: typeof editionTypes[number]; audience: typeof editionAudiences[number]; sourceEdition: string; attribution: string; translator: string; language: string; script: string; sourceLocation: string };
export type Edition = { version: 1; revision: number; artDirection?: ArtDirection; artGuideUsage?: { targetId: string; version: number }[]; metadata: EditionMetadata; metadataHistory?: { metadata: EditionMetadata; at: string; revision: number }[]; passages: Passage[]; sources: { key: string; name: string; size: number; importedAt: string }[]; affectedTargets: { passageId: string; targetId: string; at: string }[]; bindings: { passageId: string; targetId: string }[] };
export type EditionAction =
  | { type: 'save-art-guide'; guide: ArtGuide; reason: string }
  | { type: 'approve-art-guide'; version: number }
  | { type: 'metadata'; metadata: EditionMetadata }
  | { type: 'add'; text: string; location: string; provenance: Provenance }
  | { type: 'edit'; id: string; field: PassageField; text: string; provenance: Provenance; reason: string; location: string }
  | { type: 'approve'; id: string; field: PassageField }
  | { type: 'split'; id: string; offset: number; reason: string }
  | { type: 'merge'; id: string; nextId: string; reason: string }
  | { type: 'import'; pages: string[]; source: Edition['sources'][number] };
export function newEdition(): Edition {
  return { version: 1, revision: 0, metadata: { title: 'Untitled devotional edition', type: 'Original verses', audience: 'Adults', sourceEdition: '', attribution: '', translator: '', language: 'Sanskrit', script: 'Devanagari', sourceLocation: '' }, passages: [], sources: [], affectedTargets: [], bindings: [] };
}
function bounded(value: unknown, label: string, max = 50000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function provenance(value: unknown): Provenance {
  if (value !== 'user-provided' && value !== 'extracted' && value !== 'generated') throw new Error('Choose a valid field provenance.');
  return value;
}
function field(text = '', source: Provenance = 'user-provided'): EditorialField { return { text, provenance: source, status: 'draft' }; }
function passage(text: string, location: string, source: Provenance, id: string): Passage {
  return { id, revision: 1, location, fields: { original: field(text, source), transliteration: field(), translation: field(), commentary: field(), notes: field() }, history: [], derivedFrom: [] };
}
export function editionExportIssues(edition: Edition): string[] {
  const active = edition.passages.filter(p => !p.retired);
  if (!active.length) return ['Add and approve at least one passage.'];
  return active.flatMap((p, i) => passageFields.filter(f => f !== 'notes' && ((f === 'original' && !p.fields[f].text.trim()) || (p.fields[f].text && p.fields[f].status !== 'approved'))).map(f => `Passage ${i + 1}: review and approve ${f}.`));
}
export function applyEditionAction(current: Edition, action: EditionAction, at = new Date().toISOString(), makeId = () => crypto.randomUUID()): Edition {
  const next = structuredClone(current);
  function find(id: string) { const p = next.passages.find(p => p.id === id && !p.retired); if (!p) throw new Error('Passage no longer exists. Reload the edition.'); return p; }
  function revise(p: Passage, reason: string) {
    if (!bounded(reason, 'Revision reason', 2000).trim()) throw new Error('Explain the source correction.');
    p.history.push({ revision: p.revision, fields: structuredClone(p.fields), location: p.location, reason, at }); p.revision++;
  }
  function invalidate(p: Passage) {
    for (const f of ['transliteration', 'translation', 'commentary'] as const) if (p.fields[f].text) { p.fields[f].status = 'stale'; delete p.fields[f].approvedAt; }
    for (const binding of next.bindings.filter(b => b.passageId === p.id)) next.affectedTargets.push({ ...binding, at });
  }
  if (action.type === 'save-art-guide') {
    if (!next.passages.some(p => !p.retired)) throw new Error('Add source passages before proposing a visual direction.');
    const guide = validateGuide(action.guide);
    if (!bounded(action.reason, 'Guide revision reason', 2000).trim()) throw new Error('Describe this guide revision.');
    const versions = next.artDirection?.versions || [];
    if (versions.length >= 100) throw new Error('This edition has reached the 100 art-guide version limit.');
    next.artDirection = { versions: [...versions, { version: (versions.at(-1)?.version || 0)+1, guide, sourceContext: guideContext(next), createdAt: at, reason: action.reason }] };
  } else if (action.type === 'approve-art-guide') {
    const version = latestGuide(next);
    if (!version || version.version !== action.version) throw new Error('Only the latest saved guide can be approved.');
    if (version.sourceContext !== guideContext(next)) throw new Error('The manuscript changed. Save a reviewed guide version before approval.');
    if (next.passages.some(p => !p.retired && p.fields.original.status !== 'approved')) throw new Error('Approve original passages in the source desk before approving the art guide.');
    version.approvedAt = at;
  } else if (action.type === 'metadata') {
    const m = action.metadata;
    if (!editionTypes.includes(m.type) || !editionAudiences.includes(m.audience)) throw new Error('Choose a valid edition type and audience.');
    for (const key of Object.keys(newEdition().metadata) as (keyof EditionMetadata)[]) bounded(m[key], key, 2000);
    if (!m.title.trim() || !m.language.trim() || !m.script.trim()) throw new Error('Title, language, and script are required.');
    next.metadataHistory = [...(next.metadataHistory || []), { metadata: structuredClone(next.metadata), at, revision: next.revision }];
    next.metadata = { title: m.title, type: m.type, audience: m.audience, sourceEdition: m.sourceEdition, attribution: m.attribution, translator: m.translator, language: m.language, script: m.script, sourceLocation: m.sourceLocation };
  } else if (action.type === 'add') {
    const text = bounded(action.text, 'Original passage'); if (!text.trim()) throw new Error('Enter original text.');
    next.passages.push(passage(text, bounded(action.location, 'Source location', 2000), provenance(action.provenance), makeId()));
  } else if (action.type === 'import') {
    if (!action.pages.length || !action.pages.some(p => p.trim())) throw new Error('No readable text found. A scanned source needs transcription or OCR before import.');
    if (next.sources.some(s => s.key === action.source.key)) throw new Error('This source is already imported.');
    action.pages.forEach((text, i) => {
      if (text.trim()) next.passages.push(passage(bounded(text, 'Source page'), `${action.source.name} · extraction segment ${i + 1}`, 'extracted', makeId()));
    });
    next.sources.push(action.source);
  } else if (action.type === 'edit') {
    if (!passageFields.includes(action.field)) throw new Error('Unknown passage field.');
    const p = find(action.id), text = bounded(action.text, 'Passage text');
    const location = bounded(action.location, 'Source location', 2000);
    if (action.field === 'original' && !text.trim()) throw new Error('Original text cannot be empty.');
    revise(p, action.reason);
    if (action.field === 'original' || location !== p.location) invalidate(p);
    p.fields[action.field] = field(text, provenance(action.provenance)); p.location = location;
  } else if (action.type === 'approve') {
    if (!passageFields.includes(action.field)) throw new Error('Unknown passage field.');
    const p = find(action.id);
    if (!p.fields[action.field].text.trim()) throw new Error('An empty field cannot be approved.');
    if (action.field !== 'original' && p.fields.original.status !== 'approved') throw new Error('Approve the original before supplementary text.');
    revise(p, `Approved ${action.field}`);
    p.fields[action.field].status = 'approved'; p.fields[action.field].approvedAt = at;
  } else if (action.type === 'split') {
    const p = find(action.id), text = p.fields.original.text;
    if (!Number.isInteger(action.offset) || action.offset <= 0 || action.offset >= text.length) throw new Error('Place the cursor inside the original text to split it.');
    const left = text.slice(0, action.offset), right = text.slice(action.offset);
    if (!left.trim() || !right.trim() || /[\uD800-\uDBFF]$/.test(left)) throw new Error('Choose a split between complete passages.');
    revise(p, action.reason); invalidate(p); p.retired = true;
    const pieces = [left, right].map(t => ({ ...passage(t, p.location, p.fields.original.provenance, makeId()), derivedFrom: [p.id] }));
    next.passages.splice(next.passages.indexOf(p) + 1, 0, ...pieces);
  } else if (action.type === 'merge') {
    const p = find(action.id), q = find(action.nextId), active = next.passages.filter(p => !p.retired);
    if (active[active.indexOf(p) + 1]?.id !== q.id) throw new Error('Only adjacent passages can be merged.');
    revise(p, action.reason); revise(q, action.reason); invalidate(p); invalidate(q); p.retired = true; q.retired = true;
    const merged = passage(bounded(`${p.fields.original.text}\n\n${q.fields.original.text}`, 'Merged passage'), `${p.location}; ${q.location}`, p.fields.original.provenance === q.fields.original.provenance ? p.fields.original.provenance : 'user-provided', makeId());
    merged.derivedFrom = [p.id, q.id]; next.passages.splice(next.passages.indexOf(p) + 1, 0, merged);
  } else throw new Error('Unknown edition action.');
  if (next.passages.length > 2000) throw new Error('This edition has reached the 2,000 passage limit.');
  next.revision++;
  return next;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function editionHtml(edition: Edition, fontUrl: string): string {
  const issues = editionExportIssues(edition); if (issues.length) throw new Error(issues.join('\n'));
  const m = edition.metadata;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(m.title)}</title><style>@font-face{font-family:Edition;src:url('${escape(fontUrl)}')}@page{size:A4;margin:22mm}body{max-width:170mm;margin:30px auto;padding:20px;font:16px/1.8 Edition,serif;color:#203d34}h1{font-size:30px}article{margin:24px 0;border-top:1px solid #ddd;padding-top:20px}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}.original{font-size:22px;line-height:2}h2{font-size:14px}small{color:#52645c}@media print{body{margin:0;padding:0}h2{break-after:avoid}}${artGuideProofCss(edition, "body")}</style></head><body><h1>${escape(m.title)}</h1><p>${escape([m.sourceEdition,m.attribution,m.translator].filter(Boolean).join('\n'))}</p>${edition.passages.filter(p => !p.retired).map(p => `<article><small>${escape(p.location)}</small>${passageFields.filter(f => f !== 'notes' && p.fields[f].text).map(f => `${f === 'original' ? '' : `<h2>${f[0].toUpperCase()+f.slice(1)}</h2>`}<p class="${f}" ${f === 'original' ? `lang="${escape(m.language === 'Sanskrit' ? 'sa' : m.language === 'Hindi' ? 'hi' : 'und')}"` : ''}>${escape(p.fields[f].text)}</p>`).join('')}</article>`).join('')}</body></html>`;
}
