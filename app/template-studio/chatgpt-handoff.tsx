'use client';
import { useEffect, useState } from 'react';
import type { Draft } from '../../lib/template-storage';
import { analysisPrompt, samplePrompt, chapterPrompt, canApproveSample } from '../../lib/chatgpt-handoff';

function Picture({ blob, name }: { blob: Blob; name: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const value = URL.createObjectURL(blob); queueMicrotask(() => setUrl(value)); return () => URL.revokeObjectURL(value); }, [blob]);
  return url ? <img src={url} alt={name}/> : null;
}
type Props = {
  draft: Draft; busy: boolean; mode: 'references' | 'sample';
  patch: (value: Partial<Draft>) => void;
  onFiles: (files: File[], destination?: 'character-reference.png' | 'style-sample.png') => void;
  onDownload: (stage: 'analysis' | 'sample' | 'chapter') => void;
  onContinue: () => void;
};
export default function ChatGptHandoff({ draft, busy, mode, patch, onFiles, onDownload, onContinue }: Props) {
  const [message, setMessage] = useState('');
  const direction = draft.visualDirection!;
  const approved = direction.handoff === 'approved' && canApproveSample(draft);
  const stage = mode === 'references' ? 'analysis' : approved ? 'chapter' : 'sample';
  const prompt = stage === 'analysis' ? analysisPrompt() : stage === 'sample' ? samplePrompt(draft) : chapterPrompt(draft);
  const ready = Object.keys(draft.references || {}).length > 0 && (stage === 'analysis' || Boolean(draft.source && draft.title.trim() && direction.notes.trim()));
  async function openChatGPT() {
    // Open only from a user gesture. The website never submits a message on the user's behalf.
    const tab = window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
    void tab;
    try { await navigator.clipboard.writeText(prompt); setMessage('Prompt copied. Paste it in ChatGPT, attach the request ZIP, and send it. Return here with the result.'); }
    catch { setMessage('Copy the prompt below manually, then paste it in ChatGPT and attach the request ZIP.'); }
  }
  function updateNotes(notes: string) { patch({ visualDirection: { ...direction, notes, handoff: mode === 'references' ? 'references' : 'sample' } }); }
  return <section className="ts-panel ts-handoff">
    <h2>{mode === 'references' ? 'Start with visual references' : approved ? 'Approved — prepare your chapter' : 'Try the characters and one scene first'}</h2>
    <p>{mode === 'references' ? 'ChatGPT will inspect your images and write the art direction. This website prepares the request; it does not analyse images itself.' : approved ? 'The next request includes your approved images. ChatGPT will use them throughout the supplied chapter.' : 'Generate a character sheet and one sample scene in ChatGPT. Bring both back here before preparing the rest of the chapter.'}</p>
    {mode === 'references' && <>
      <label className="ts-upload">Upload visual references<input disabled={busy} type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) onFiles(files); }}/></label>
      <p className="ts-help">Up to three references. These guide the artwork; they do not become book pages.</p>
      <div className="ts-chosen-images">{Object.entries(draft.references || {}).map(([name, blob], i) => <div key={name}><Picture blob={blob} name={`Visual reference ${i + 1}`}/><button disabled={busy} onClick={() => { const references = { ...draft.references }; delete references[name]; patch({ references }); }}>Remove visual reference {i + 1}</button></div>)}</div>
    </>}
    <ol className="ts-help"><li>Download the request ZIP with the images and instructions.</li><li>Open ChatGPT, paste the copied prompt, attach that ZIP and send.</li><li>{stage === 'analysis' ? 'Paste ChatGPT’s art direction below.' : stage === 'sample' ? 'Upload the two generated images below.' : 'Import ChatGPT’s completed book ZIP below. Do not import the request ZIP.'}</li></ol>
    <div className="ts-actions"><button disabled={busy || !ready} onClick={() => onDownload(stage)}>{stage === 'analysis' ? 'Download reference analysis request' : stage === 'sample' ? 'Download sample request' : 'Download chapter request'}</button><button disabled={busy || !ready} onClick={() => void openChatGPT()}>Copy prompt & open ChatGPT ↗</button></div>
    {message && <p role="status">{message}</p>}
    <details><summary>View or copy the request prompt</summary><textarea aria-label="ChatGPT request prompt" readOnly value={prompt}/></details>
    {mode === 'references' ? <>
      <label>Art direction from ChatGPT<textarea aria-label="Art direction from ChatGPT" maxLength={4000} value={direction.notes} onChange={e => updateNotes(e.target.value)} placeholder="Paste ChatGPT’s image analysis here. You can edit it before continuing."/></label>
      <button disabled={busy || !direction.notes.trim() || !Object.keys(draft.references || {}).length} onClick={onContinue}>Choose a book layout →</button>
    </> : <>
      <div className="ts-sample-grid">{(['character-reference.png', 'style-sample.png'] as const).map((name, i) => <div key={name}>
        <label className="ts-upload">{i === 0 ? 'Upload character sheet' : 'Upload sample scene'}<input disabled={busy} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onFiles([file], name); }}/></label>
        {draft.images[name] && <><Picture blob={draft.images[name]} name={i === 0 ? 'Character sheet for approval' : 'Sample scene for approval'}/><button disabled={busy} onClick={() => { const images = { ...draft.images }; delete images[name]; patch({ images, visualDirection: { ...direction, handoff: 'sample' } }); }}>Remove {i === 0 ? 'character sheet' : 'sample scene'}</button></>}
      </div>)}</div>
      {!approved && <><label>Changes to request (optional)<textarea aria-label="Changes to request" maxLength={4000} value={direction.feedback || ''} placeholder="e.g. Simpler faces, flatter colours, less background detail." onChange={e => patch({ visualDirection: { ...direction, handoff: 'sample', feedback: e.target.value } })}/></label>
      <p className="ts-help">Compare faces, clothing, proportions, texture and lighting with your references. To revise, download another sample request with your feedback and current images.</p>
      <button disabled={busy || !canApproveSample(draft)} onClick={() => patch({ visualDirection: { ...direction, feedback: '', handoff: 'approved' } })}>Approve characters & sample</button></>}
      {approved && <p role="status">Characters and sample approved. You can now prepare the chapter request.</p>}
    </>}
  </section>;
}
