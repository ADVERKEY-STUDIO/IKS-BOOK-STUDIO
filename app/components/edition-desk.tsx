"use client";
import { useEffect, useRef, useState } from 'react';
import { artGuideProofCss } from "../../lib/art-direction";
import { VisualReferenceWorkspace, type ReferenceUpload } from "./visual-reference-workspace";
import { ArtDirectionWorkspace } from "./art-direction-workspace";
import type { BookInspiration } from "../../lib/book-inspiration";
import { editionTypes, editionAudiences, passageFields, editionExportIssues, type Edition, type EditionAction, type Passage, type PassageField, type Provenance } from '../../lib/devotional-edition';

type Props = { onReferenceUpload: (input: ReferenceUpload) => Promise<void>; onReferenceImage: (key: string) => Promise<Blob>; onReferencePackage: (id: string) => Promise<void>; inspiration?: BookInspiration; onInspiration: () => void; onBrief: () => Promise<string>; edition: Edition; onAction: (action: EditionAction) => Promise<void>; onUpload: (file: File) => Promise<void>; onDownload: (key: string, name: string) => Promise<void>; onExport: () => Promise<string>; onBack: () => void; onReload: () => Promise<void> };
export function EditionDesk({ onReferenceUpload, onReferenceImage, onReferencePackage, inspiration, onInspiration, onBrief, edition, onAction, onUpload, onDownload, onExport, onBack, onReload }: Props) {
  const [tab, setTab] = useState<'setup' | 'source' | 'art' | 'references' | 'proof'>(edition.passages.length ? 'source' : 'setup');
  const [metadata, setMetadata] = useState(edition.metadata);
  const [newText, setNewText] = useState('');
  const [location, setLocation] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passageDirty, setPassageDirty] = useState(false);
  const metadataDirty = JSON.stringify(metadata) !== JSON.stringify(edition.metadata);
  const dirty = passageDirty || metadataDirty || !!newText || !!location;
  useEffect(() => { setMetadata(edition.metadata); }, [edition.metadata]);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const passages = edition.passages.filter(p => !p.retired);
  const passage = passages.find(p => p.id === selected) || passages[0];
  const issues = editionExportIssues(edition);
  async function run(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); setMessage(success); return true; } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your changes remain here.'); return false; } finally { setBusy(false); }
  }
  async function exportProof(print: boolean) {
    let html = await onExport();
    const fontResponse = await fetch('/fonts/book-sanskrit.ttf');
    if (!fontResponse.ok) throw new Error('The proof font is unavailable. Please try again.');
    const font = await fontResponse.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not package the proof font.')); reader.readAsDataURL(font); });
    html = html.replace(`${window.location.origin}/fonts/book-sanskrit.ttf`, dataUrl);
    if (!print) { const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${edition.metadata.title.replace(/[^\p{L}\p{N}\s-]/gu, '') || 'edition'}-proof.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); return; }
    const frame = document.createElement('iframe'); frame.title = 'Edition print proof'; frame.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;left:0;border:0'; document.body.appendChild(frame);
    frame.onload = async () => { await frame.contentDocument?.fonts.ready; frame.contentWindow?.focus(); frame.contentWindow?.print(); };
    frame.srcdoc = html;
    setTimeout(() => frame.remove(), 300000);
  }
  return <main className="edition-desk">
    <header><button disabled={busy || dirty} onClick={onBack}>← Library</button><strong>{edition.metadata.title}</strong><span>Saved revision {edition.revision}</span></header>
    <nav aria-label="Edition workspace">{(['setup', 'source', 'art', 'references', 'proof'] as const).map(t => <button key={t} disabled={busy || dirty} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{t === 'setup' ? 'Edition setup' : t === 'source' ? 'Source desk' : t === 'art' ? 'Art direction' : t === 'references' ? 'Visual references' : 'Reading proof'}</button>)}</nav>
    {dirty && <p role="status">Save or cancel your edits before switching workspaces.</p>}
    {error && <div role="alert" className="edition-error">{error}<button disabled={busy} onClick={() => void run(onReload, 'Latest saved edition loaded.')}>Reload saved edition</button></div>}
    {message && <p role="status">{message}</p>}
    {tab === 'setup' && <section className="edition-panel"><h1>Define your edition</h1><p>Choose the reading purpose independently from the audience. Original passages stay separate from interpretation.</p><form onSubmit={e => { e.preventDefault(); void run(() => onAction({ type: 'metadata', metadata }), 'Edition details saved.'); }}><fieldset disabled={busy} className="edition-fields">
      <label>Book title<input required value={metadata.title} maxLength={2000} onChange={e => setMetadata({ ...metadata, title: e.target.value })}/></label>
      <label>Edition type<select value={metadata.type} onChange={e => setMetadata({ ...metadata, type: e.target.value as typeof metadata.type })}>{editionTypes.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Audience<select value={metadata.audience} onChange={e => setMetadata({ ...metadata, audience: e.target.value as typeof metadata.audience })}>{editionAudiences.map(t => <option key={t}>{t}</option>)}</select></label>
      {([['sourceEdition','Source edition'],['attribution','Author or traditional attribution'],['translator','Editor / translator'],['language','Original language'],['script','Original script'],['sourceLocation','Source location / catalogue reference']] as const).map(([key,label]) => <label key={key}>{label}<input required={key === 'language' || key === 'script'} maxLength={2000} value={metadata[key]} onChange={e => setMetadata({ ...metadata, [key]: e.target.value })}/></label>)}
      <button className="edition-primary" type="submit">Save edition details</button><button type="button" onClick={() => setMetadata(edition.metadata)}>Revert unsaved details</button>
    </fieldset></form><details><summary>Edition details history ({edition.metadataHistory?.length || 0})</summary>{[...(edition.metadataHistory || [])].reverse().map(h => <article key={h.revision}><h3>Revision {h.revision}</h3><small>{h.at}</small><dl>{Object.entries(h.metadata).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl></article>)}</details></section>}
    {tab === 'source' && <><section className="edition-panel"><h1>Review the source</h1><p>Import TXT, DOCX, or a text PDF up to 10 MB. Extraction creates draft passages. Check them against the original file before approving.</p><label className="edition-upload">Import original source<input type="file" accept=".txt,.docx,.pdf" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => onUpload(file), 'Source preserved and extracted passages added.'); e.target.value = ''; }}/></label>
      {edition.sources.map(s => <p key={s.key}><button disabled={busy} onClick={() => void run(() => onDownload(s.key,s.name), 'Original source downloaded.')}>{s.name} · Download original</button></p>)}
      <details><summary>Add a passage manually</summary><form onSubmit={e => { e.preventDefault(); void run(async () => { await onAction({ type:'add', text:newText, location, provenance:'user-provided' }); setNewText(''); setLocation(''); }, 'Passage added for review.'); }}><label>Original text<textarea required value={newText} onChange={e => setNewText(e.target.value)} maxLength={50000}/></label><label>Source location<input value={location} maxLength={2000} onChange={e => setLocation(e.target.value)}/></label><button disabled={busy || !newText.trim()}>Add passage</button><button type="button" disabled={busy} onClick={() => { setNewText(''); setLocation(''); }}>Clear unsaved passage</button></form></details>
    </section><div className="edition-source-grid"><aside className="edition-panel"><h2>{passages.length} active passages</h2>{passages.map((p,i) => <button key={p.id} disabled={busy || passageDirty} aria-current={passage?.id === p.id ? 'true' : undefined} onClick={() => setSelected(p.id)}><strong>Passage {i+1}</strong><small>{p.fields.original.status} · revision {p.revision}</small><span>{p.fields.original.text.slice(0,65)}</span></button>)}</aside>{passage ? <PassageEditor key={`${passage.id}-${passage.revision}`} passage={passage} onDirty={setPassageDirty} next={passages[passages.indexOf(passage)+1]} busy={busy} onAction={async action => { await run(() => onAction(action), 'Passage revision saved.'); }} /> : <section className="edition-panel"><h2>Your source desk is ready</h2><p>Import a source or add your first passage to begin.</p></section>}</div>
      <details className="edition-panel"><summary>Retired passages and lineage ({edition.passages.filter(p => p.retired).length})</summary>{edition.passages.filter(p => p.retired).map(p => <article key={p.id}><h3>{p.location || p.id}</h3><p className="edition-original">{p.fields.original.text}</p><p>Retired by a split or merge. Earlier translations and notes remain in this record.</p>{passageFields.filter(f => f !== 'original' && p.fields[f].text).map(f => <p key={f}>{f}: {p.fields[f].text}</p>)}</article>)}</details></>}
    {tab === 'art' && <ArtDirectionWorkspace edition={edition} inspiration={inspiration} busy={busy} onDirty={setPassageDirty} onInspiration={onInspiration} onBrief={onBrief} onAction={action => run(() => onAction(action), action.type === 'approve-art-guide' ? 'Art guide approved for production.' : 'Art guide version saved.')} />}
    {tab === 'references' && <VisualReferenceWorkspace edition={edition} busy={busy} onDirty={setPassageDirty} onAction={action => run(() => onAction(action), 'Reference version saved.')} onUpload={input => run(() => onReferenceUpload(input), 'Image added as a new draft.')} onImage={onReferenceImage} onPackage={async id => { await run(() => onReferencePackage(id), 'Reference request package downloaded.'); }} />}
    {tab === 'proof' && <section className="edition-panel"><h1>Reading proof</h1><p>This is a text proof for source review. Spread design and finished illustrations follow in later phases. Private editorial notes are excluded.</p>{issues.length > 0 && <div className="edition-error"><strong>Before export</strong><ul>{issues.map(i => <li key={i}>{i}</li>)}</ul></div>}<div className="edition-actions"><button disabled={busy || !!issues.length} onClick={() => void run(() => exportProof(true), 'Print proof opened. Choose Save as PDF in the print dialog.')}>Print / Save as PDF</button><button disabled={busy || !!issues.length} onClick={() => void run(() => exportProof(false), 'Reading proof downloaded.')}>Download HTML proof</button></div><style>{artGuideProofCss(edition)}</style><div className="edition-proof"><h2>{edition.metadata.title}</h2><p>{[edition.metadata.sourceEdition,edition.metadata.attribution,edition.metadata.translator].filter(Boolean).join(' · ')}</p>{passages.map(p => <article key={p.id}><small>{p.location}</small>{passageFields.filter(f => f !== 'notes' && p.fields[f].text).map(f => <div key={f}>{f !== 'original' && <h3>{f}</h3>}<p className={f === 'original' ? 'edition-original' : f}>{p.fields[f].text}</p></div>)}</article>)}</div></section>}
    {!!edition.affectedTargets.length && <section className="edition-panel"><h2>Dependent work needs review</h2>{edition.affectedTargets.map((t,i) => <p key={i}>{t.targetId} · source passage {t.passageId} changed</p>)}</section>}
  </main>;
}
function PassageEditor({ passage: p, next, busy, onAction, onDirty }: { onDirty: (dirty: boolean) => void; passage: Passage; next?: Passage; busy: boolean; onAction: (action: EditionAction) => Promise<void> }) {
  const [field, setField] = useState<PassageField>('original');
  const [text, setText] = useState(p.fields.original.text);
  const [origin, setOrigin] = useState<Provenance>(p.fields.original.provenance);
  const [location, setLocation] = useState(p.location);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => { onDirty(editing); return () => onDirty(false); }, [editing, onDirty]);
  const input = useRef<HTMLTextAreaElement>(null);
  const [offset, setOffset] = useState(0);
  function changeField(f: PassageField) { setField(f); setText(p.fields[f].text); setOrigin(p.fields[f].provenance); setEditing(false); setReason(''); }
  return <section className="edition-panel"><h2>Passage review</h2><p>{p.location || 'Location not yet specified'} · Revision {p.revision}</p><fieldset disabled={busy}>
    <label>Text layer<select disabled={editing} value={field} onChange={e => changeField(e.target.value as PassageField)}>{passageFields.map(f => <option key={f}>{f}</option>)}</select></label><p><strong>{p.fields[field].status}</strong> · {p.fields[field].provenance}</p>
    <label>{field}<textarea ref={input} className={field === 'original' ? 'edition-original' : ''} readOnly={!editing} value={text} maxLength={50000} onChange={e => setText(e.target.value)} onSelect={e => setOffset(e.currentTarget.selectionStart)}/></label>
    {editing ? <><label>Source location<input value={location} maxLength={2000} onChange={e => setLocation(e.target.value)}/></label><label>Text origin<select value={origin} onChange={e => setOrigin(e.target.value as Provenance)}><option>user-provided</option><option>extracted</option><option>generated</option></select></label><label>Reason for revision<input value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="Describe the correction or addition"/></label><p>Changing original text returns it to draft and marks supplementary text for review.</p><div className="edition-actions"><button disabled={!reason.trim()} onClick={() => void onAction({type:'edit',id:p.id,field,text,location,provenance:origin,reason})}>Save revision</button><button onClick={() => changeField(field)}>Cancel edit</button></div></> : <div className="edition-actions"><button onClick={() => setEditing(true)}>Edit with revision</button><button disabled={!text.trim() || p.fields[field].status === 'approved'} onClick={() => void onAction({type:'approve',id:p.id,field})}>Approve {field}</button></div>}
    {!editing && field === 'original' && <details><summary>Split or merge passages</summary><p>Place the cursor between passages above, then split. Supplementary text remains in the retired source record for reassignment.</p><label>Reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={2000}/></label><div className="edition-actions"><button disabled={!reason.trim() || !offset || offset >= text.length} onClick={() => void onAction({type:'split',id:p.id,offset,reason})}>Split at cursor</button><button disabled={!next || !reason.trim()} onClick={() => next && void onAction({type:'merge',id:p.id,nextId:next.id,reason})}>Merge with next passage</button></div></details>}
  </fieldset><details><summary>Revision history ({p.history.length})</summary>{[...p.history].reverse().map(h => <article key={h.revision}><h3>Revision {h.revision} · {h.reason}</h3><small>{h.at}</small><p>Previous {field} ({h.fields[field].status})</p><p className={field === 'original' ? 'edition-original' : ''}>{h.fields[field].text || '(empty)'}</p><p>Current {field}</p><p className={field === 'original' ? 'edition-original' : ''}>{p.fields[field].text || '(empty)'}</p></article>)}</details>{p.derivedFrom.length > 0 && <p>Derived from: {p.derivedFrom.join(', ')}</p>}</section>;
}
