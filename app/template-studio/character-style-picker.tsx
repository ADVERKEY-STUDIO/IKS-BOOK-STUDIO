'use client';
import { useEffect, useState } from 'react';
import type { Draft } from '../../lib/template-storage';
import { characterStyles, seriesReferenceName, characterOptionName, hasFourCharacterOptions, seriesArtReady, type CharacterOption } from '../../lib/series-art';

function Sheet({ blob, alt }: { blob?: Blob; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) { queueMicrotask(() => setUrl('')); return; }
    const next = URL.createObjectURL(blob); queueMicrotask(() => setUrl(next));
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? <img src={url} alt={alt} style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }}/> : null;
}
type Props = {
  draft: Draft; saved: Draft[]; busy: boolean;
  onEnable: () => void; onChoose: (option: CharacterOption) => void;
  onUpload: (option: CharacterOption, file: File) => void;
  onReuse: (draft: Draft) => void; onApprove: () => void;
};
export default function CharacterStylePicker({ draft, saved, busy, onEnable, onChoose, onUpload, onReuse, onApprove }: Props) {
  const art = draft.visualDirection?.seriesArt;
  if (!art) return <section className="ts-panel"><h2>Four character options</h2><p>Preview four fixed character styles before making this book, and reuse all four styles across your series.</p><button disabled={busy} onClick={onEnable}>Choose from four character styles</button></section>;
  const reusable = saved.filter(d => d.id !== draft.id && d.templateId === draft.templateId && characterStyles.every(s => d.references?.[seriesReferenceName(s.id)]));
  return <section className="ts-panel">
    <h2>Choose your character style</h2>
    <p>First send the request ZIP to ChatGPT. It will return four separate character sheets and stop. Upload all four below, choose one, then approve it to prepare the book request.</p>
    <p className="ts-help">Options 1–4 always use the same four character treatments within this template. Your first sheets become the series masters. Reuse the same masters for later books; characters adapt to each story. Generated artwork still needs a visual consistency check.</p>
    <label>Reuse all four styles from a saved book<select aria-label="Reuse four character styles" disabled={busy} value="" onChange={e => { const previous = reusable.find(d => d.id === e.target.value); if (previous) onReuse(previous); }}>
      <option value="">Choose a book in this template</option>
      {reusable.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
    </select></label>
    <p className="ts-help">For a book saved only in your account, open its cloud copy first so its master sheets are available here. Reusing masters starts a fresh four-sheet request for this book.</p>
    <div className="ts-character-options">{characterStyles.map(style => <fieldset key={style.id}>
      <legend>Option {style.id} · {style.name}</legend>
      <p className="ts-help">{style.description}</p>
      <Sheet blob={draft.references?.[characterOptionName(style.id)] || draft.references?.[seriesReferenceName(style.id)]} alt={`Option ${style.id} character reference`}/>
      {draft.references?.[seriesReferenceName(style.id)] && <small>Series master saved</small>}
      <label>Upload character-option-{style.id}.png<input aria-label={`Upload character option ${style.id}`} disabled={busy} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onUpload(style.id, file); }}/></label>
      <label><input type="radio" name="character-style" disabled={busy || !draft.references?.[characterOptionName(style.id)]} checked={art.option === style.id} onChange={() => onChoose(style.id)}/> Choose Option {style.id}</label>
    </fieldset>)}</div>
    <button disabled={busy || !hasFourCharacterOptions(draft) || !art.option || seriesArtReady(draft)} onClick={onApprove}>Approve Option {art.option || '…'} & prepare book request</button>
    <p role="status">{seriesArtReady(draft) ? `Option ${art.option} approved. The request now uses this character sheet for the book.` : 'Book generation is paused until all four sheets are uploaded and you approve your choice.'}</p>
  </section>;
}
