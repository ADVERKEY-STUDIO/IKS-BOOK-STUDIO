"use client";

import { useEffect, useRef, useState } from 'react';
import { gitaPilot, pilotAssets, pilotStudies, pilotCredits } from '../../lib/gita-pilot';
import { compositionDocument, compositionMarkup } from '../../lib/spread-composition';
import './pilot.css';
import { createGitaPilotDraft } from '../../lib/create-gita-pilot-draft';

export default function PilotPage() {
  const [selected, setSelected] = useState(0);
  const [scale, setScale] = useState(.7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [overflows, setOverflows] = useState<string[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const study = pilotStudies[selected];
  const composition = gitaPilot.compositions![selected];
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, element.clientWidth / (366 * 96 / 25.4))));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    document.fonts.ready.then(() => {
      if (!active) return;
      setOverflows(Array.from(viewport.current?.querySelectorAll<HTMLElement>('[data-text]') || []).filter(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map(el => el.dataset.text!));
    });
    return () => { active = false; };
  }, [selected]);
  async function downloadProof() {
    setBusy(true); setError('');
    try {
      const dataUrl = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('A proof asset could not be loaded. Try again.');
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not package the proof.')); reader.readAsDataURL(blob);
        });
      };
      const usedKeys = new Set(composition.layers.filter(layer => layer.kind === 'image').map(layer => layer.imageKey));
      const entries = await Promise.all(Object.entries(pilotAssets).filter(([key]) => usedKeys.has(key)).map(async ([key,url]) => [key, await dataUrl(url)] as const));
      const html = compositionDocument(gitaPilot, composition, Object.fromEntries(entries), await dataUrl('/fonts/book-sanskrit.ttf'));
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `gita-pilot-${selected+1}-review.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not package proof.'); }
    finally { setBusy(false); }
  }
  return <main className="pilot-page">
    <header className="pilot-header"><a href="/">← Book Studio</a><span>PHASE G / DESIGN REVIEW</span><span>01—03</span></header>
    <section className="pilot-intro"><div><p className="pilot-eyebrow">A HERITAGE READING EDITION</p><h1>The Bhagavad Gita</h1><p>Action. Attention. Radiance.</p></div><div><p>Three different reading moments, held together by warm paper, vermilion accents, original Sanskrit, and historic Indian art.</p><small>Draft pilot · not an approved edition. English meanings are original editorial paraphrases for review. Artwork is contextual, not a claim to illustrate the exact narrated event.</small></div></section>
    <section className="pilot-draft"><button disabled={busy||!!draftId} onClick={async()=>{setBusy(true);setError('');try{await createGitaPilotDraft(setDraftId);setDraftReady(true);}catch(e){setError(e instanceof Error?e.message:'Could not create the draft.');}finally{setBusy(false);}}}>{busy?'Working…':'Create editable draft in my library'}</button><p>{draftReady?'Draft saved with three sources, artwork, storyboard plans, and editable layouts.':draftId?'A partial draft is saved. Open the library to inspect it; no approvals were added.':'Creates your own draft using the normal source, reference, and Designer workflow. Nothing is marked approved.'} {draftId&&<a href="/">Open library →</a>}</p>{error&&<p role="alert">{error}</p>}</section>
    <nav className="pilot-tabs" aria-label="Pilot spreads">{pilotStudies.map((item,i) => <button key={item.ref} aria-pressed={selected===i} onClick={() => setSelected(i)}><span>0{i+1}</span> {item.title}<small>Gita {item.ref}</small></button>)}</nav>
    <div className="pilot-preview" ref={viewport} style={{height:236*96/25.4*scale}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}} dangerouslySetInnerHTML={{__html:compositionMarkup(gitaPilot,composition,pilotAssets)}} /></div>
    <section className="pilot-review"><div><p className="pilot-eyebrow">COMPOSITION INTENT</p><h2>{study.title}</h2><p>{study.intent}</p><a href={study.source} target="_blank" rel="noreferrer">Read the Sanskrit source at IIT Kanpur ↗</a></div><div><h2>Review this spread</h2><p>Check the meaning, readability, artwork relevance, and balance between the facing pages. Each page trims to 180 × 230 mm; the spread with bleed is 366 × 236 mm.</p>{overflows.length>0 && <p role="alert">Text overflow detected: {overflows.join(', ')}</p>}<button disabled={busy || overflows.length>0} onClick={() => void downloadProof()}>{busy?'Packaging…':'Download review proof'}</button><p className="pilot-small">Self-contained HTML using the Designer renderer. Print at 100%, zero margins, backgrounds on, headers off. Set paper to 366 × 236 mm. Final print approval is pending.</p>{error && <p role="alert">{error}</p>}</div></section>
    <section className="pilot-credits"><h2>Sources and artwork</h2><p>The Sanskrit follows Gita Supersite. Historic objects and paintings are reproduced with their museum credits. No paid image generation was used.</p>{pilotCredits.map(credit=><p key={credit.url}><a href={credit.url} target="_blank" rel="noreferrer">{credit.title}</a> — {credit.note}</p>)}</section>
  </main>;
}
