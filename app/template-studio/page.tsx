'use client';
import { useEffect, useRef, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import { templates, parseTemplateBook, bookPrompt, continuationPrompt, renderTemplateBook, assetName, type TemplateBook, type TemplateId, type BookPage } from '../../lib/template-book';
import { readTemplateArchive } from '../../lib/template-archive';
import './studio.css';
type Draft = {
    id: string;
    templateId: TemplateId;
    title: string;
    language: string;
    source?: File;
    book?: TemplateBook;
    images: Record<string, Blob>;
    updated: number;
};
function db(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const r = indexedDB.open('iks-template-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('books', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
async function storage(mode: 'read' | 'write', value?: Draft): Promise<Draft[]> { const d = await db(); return new Promise((resolve, reject) => { const tx = d.transaction('books', mode === 'read' ? 'readonly' : 'readwrite'); const s = tx.objectStore('books'); const r = mode === 'read' ? s.getAll() : s.put(value!); tx.oncomplete = () => { d.close(); resolve(mode === 'read' ? r.result as Draft[] : []); }; tx.onerror = () => { d.close(); reject(tx.error); }; }); }
function download(name: string, data: Blob) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function imageBlob(file: Blob) { if (file.size > 10 * 1024 * 1024)
    throw Error('Each image must be under 10 MB.'); const bitmap = await createImageBitmap(file); const pixels = bitmap.width * bitmap.height; bitmap.close(); if (pixels > 64000000)
    throw Error('Image exceeds 64 megapixels.'); return file; }
function PreviewImage({ blob, alt }: {
    blob?: Blob;
    alt: string;
}) { const [url, setUrl] = useState(''); useEffect(() => { if (!blob) {
    setUrl('');
    return;
} const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]); return url ? <img src={url} alt={alt}/> : <span className="ts-placeholder">Artwork pending</span>; }
export default function TemplateStudio() {
    const [draft, setDraft] = useState<Draft>();
    const [saved, setSaved] = useState<Draft[]>([]);
    const [ready, setReady] = useState(false);
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [pasted, setPasted] = useState('');
    const [selected, setSelected] = useState(0);
    const [preview, setPreview] = useState('');
    const previewFrame = useRef<HTMLIFrameElement>(null);
    const [proofWarnings, setProofWarnings] = useState<string[]>([]);
    const [unmatched, setUnmatched] = useState<File[]>([]);
    const [assignment, setAssignment] = useState('');
    const writeQueue = useRef(Promise.resolve());
    useEffect(() => { storage('read').then(setSaved).catch(() => setError('Browser storage could not be opened. Export a ZIP to keep your work.')).finally(() => setReady(true)); }, []);
    useEffect(() => { if (!draft)
        return; setNotice('Saving…'); writeQueue.current = writeQueue.current.catch(() => { }).then(async () => { await storage('write', draft); setSaved(old => [...old.filter(v => v.id !== draft.id), draft]); setNotice('Saved in this browser'); }).catch(() => setError('Could not save in browser storage. Download your working ZIP before closing.')); }, [draft]);
    function patch(p: Partial<Draft>) { setDraft(d => d ? { ...d, ...p, ...(d.book && !p.book && (p.title !== undefined || p.language !== undefined) ? {book:{...d.book, title:p.title ?? d.book.title, language:p.language ?? d.book.language}} : {}), updated: Date.now() } : d); }
    async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not complete this step.');
    }
    finally {
        setBusy(false);
    } }
    const template = templates.find(t => t.id === (draft?.templateId || 'painted'))!;
    const book = draft?.book;
    const page = book?.pages[selected];
    const names = Object.keys(draft?.images || {});
    const done = book?.pages.filter(p => names.includes(p.image)).length || 0;
    const prompt = draft ? bookPrompt(draft.id, draft.templateId, draft.title, draft.source?.name || 'source.pdf', draft.language) : '';
    function editPage(p: Partial<BookPage>) { if (book)
        patch({ book: { ...book, pages: book.pages.map((v, i) => i === selected ? { ...v, ...p } : v) } }); }
    async function importFiles(files: File[]) {
        if (!draft)
            return;
        if(files.reduce((n,f)=>n+f.size,0)>50*1024*1024)throw Error('Import batches must stay under 50 MB.');
        let next = book;
        const incoming: Record<string, Blob> = {};
        let extra: File[] = [];
        for (const file of files) {
            if (/\.zip$/i.test(file.name)) {
                const archive = readTemplateArchive(new Uint8Array(await file.arrayBuffer()));
                if (archive['book.json']) {
                    const parsed = parseTemplateBook(JSON.parse(new TextDecoder().decode(archive['book.json'])), draft.id);
                    if (parsed.templateId !== draft.templateId)
                        throw Error('Package template does not match your selected template.');
                    if (next && JSON.stringify(parsed) !== JSON.stringify(next))
                        throw Error('A manuscript is already saved. Upload image batches only, or start a new workspace for a replacement manuscript.');
                    next = parsed;
                }
                for (const [path, bytes] of Object.entries(archive))
                    if (path.startsWith('images/')) {
                        const name = path.slice(7);
                        incoming[name] = await imageBlob(new Blob([new Uint8Array(bytes)], { type: /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg' }));
                    }
            }
            else if (/\.json$/i.test(file.name)) {
                if (file.size > 2 * 1024 * 1024)
                    throw Error('Manuscript must be under 2 MB.');
                const parsed = parseTemplateBook(JSON.parse(await file.text()), draft.id);
                if (parsed.templateId !== draft.templateId)
                    throw Error('Template mismatch.');
                if (next && JSON.stringify(parsed) !== JSON.stringify(next))
                    throw Error('Manuscript already saved. Start a new workspace to replace it.');
                next = parsed;
            }
            else if (assetName(file.name)) {
                incoming[file.name] = await imageBlob(file);
            }
            else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
                await imageBlob(file);
                extra.push(file);
            }
            else
                throw Error('Choose book.json, a ZIP, or PNG/JPEG/WebP images.');
        }
        if (!next)
            throw Error('Import the manuscript first, or include book.json in this ZIP.');
        const images = { ...draft.images };
        for (const [name, blob] of Object.entries(incoming)) {
            if (next.pages.some(p => p.image === name) || name === 'character-reference.png')
                images[name] = blob;
            else
                extra.push(new File([blob], name, { type: blob.type }));
        }
        if (Object.values(images).reduce((n, b) => n + b.size, 0) > 40 * 1024 * 1024)
            throw Error('Book artwork must fit within 40 MB.');
        patch({ book: next, images });
        setUnmatched(u => [...u, ...extra]);
        setSelected(0);
        setStep(2);
    }
    async function openPreview() { if (!book || !draft)
        return; const urls: Record<string, string> = {}; for (const [name, blob] of Object.entries(draft.images))
        urls[name] = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); const font = await fetch('/fonts/book-sanskrit.ttf'); if (!font.ok)
        throw Error('Book font could not load.'); const fontBlob = await font.blob(); const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(fontBlob); }); setPreview(renderTemplateBook(book, urls, data)); }
    async function exportZip() { if (!book || !draft)
        return; const entries: Record<string, Uint8Array> = { 'book.json': strToU8(JSON.stringify(book, null, 2)), 'manuscript.md': strToU8(`# ${book.title}\n\n` + book.pages.map(p => `## ${p.title}\n\n${p.original}\n\n${p.meaning}\n\nSource: ${p.sourceReference}`).join('\n\n')), 'README.txt': strToU8('WORKING EDITABLE BOOK\nOpen preview.html in a browser to read or Print > Save as PDF. Text is editable for printing; save permanent changes in Book Studio. Reimport book.json and images in the matching workspace. Original text and explanations are separate. Layout/font/scale settings are in book.json. Paintings are raster assets, not editable vectors. Review original text, overflow and effective image resolution before publication. Template sample art is not included.\nMissing images: ' + book.pages.filter(p => !draft.images[p.image]).map(p => p.image).join(', ')) }; const urls: Record<string, string> = {}; for (const [name, blob] of Object.entries(draft.images)) {
        entries['images/' + name] = new Uint8Array(await blob.arrayBuffer());
        urls[name] = 'images/' + name;
    } entries['preview.html'] = strToU8(renderTemplateBook(book, urls)); const font = await fetch('/fonts/book-sanskrit.ttf'); if (!font.ok)
        throw Error('Font could not be packaged.'); entries['fonts/book-sanskrit.ttf'] = new Uint8Array(await font.arrayBuffer()); const license = await fetch('/fonts/OFL-NotoSerifDevanagari.txt'); if (!license.ok)
        throw Error('Font license could not be packaged.'); entries['fonts/OFL.txt'] = new Uint8Array(await license.arrayBuffer()); if (draft.source)
        entries['source/' + draft.source.name] = new Uint8Array(await draft.source.arrayBuffer()); download('Editable-Book.zip', new Blob([new Uint8Array(zipSync(entries))], { type: 'application/zip' })); }
    return <main className="ts"><header className="ts-header"><a href="/">← Book Studio</a><strong>Books, made your way.</strong><span role="status">{busy ? 'Working…' : notice}</span></header><nav aria-label="Book creation steps">{['Choose a template', 'Source & prompt', 'Assemble & edit'].map((label, i) => <button key={label} disabled={busy || !draft && i > 0 || i === 2 && !book} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</nav>{error && <p className="ts-error" role="alert">{error}</p>}
 {step === 0 && <><div className="ts-intro"><p>YOUR SOURCE. YOUR BOOK.</p><h1>Start with a book you can see.</h1><p>Choose a visual direction. Bring your PDF or DOCX. Get one detailed prompt and build the book at your own pace.</p></div><div className="ts-templates">{templates.map(t => <article key={t.id} style={{ background: t.paper, color: t.ink }}><div className={'ts-demo ' + t.id}><div className="ts-mini-cover"><small>AN ILLUSTRATED EDITION</small><h2>Wisdom<br />in every page</h2><span style={{ color: t.accent }}>A reading journey</span></div><img src={t.demo} alt={`${t.name} example artwork`}/></div><div className={'ts-mini-spread ' + t.id}><div>शान्तिः<br /><small>A quiet place<br />for the original words.</small></div><img src={t.demo} alt="Interior layout example"/></div><h2>{t.name}</h2><p>{t.description}</p><button disabled={busy} onClick={() => { if (draft?.book) {
        setError('Your current book is saved. Open a new template in a new workspace from the saved-books list below.');
        return;
    } const d: Draft = { id: crypto.randomUUID(), templateId: t.id, title: 'My illustrated book', language: 'Original language with English meanings', images: {}, updated: Date.now() }; setDraft(d); setStep(1); setError(''); }}>Choose {t.name}</button></article>)}</div><p className="ts-help">Original layout templates with public-domain example artwork, not reproductions of published books. <a href="/pilot/gita/credits.json">Artwork credits</a>. Your generated illustrations replace these examples.</p><section><h2>Your saved template books</h2><label className="ts-upload">Restore an editable book ZIP<input disabled={busy} type="file" accept=".zip" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)
        void run(async () => { const entries = readTemplateArchive(new Uint8Array(await f.arrayBuffer())); if (!entries['book.json'])
            throw Error('ZIP needs book.json.'); const restored = parseTemplateBook(JSON.parse(new TextDecoder().decode(entries['book.json']))); const id = crypto.randomUUID(); restored.projectId = id; const images: Record<string, Blob> = {}; for (const [path, bytes] of Object.entries(entries)) {
            if (path.startsWith('images/'))
                images[path.slice(7)] = await imageBlob(new Blob([new Uint8Array(bytes)], { type: /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg' }));
        } if(Object.values(images).reduce((n,b)=>n+b.size,0)>40*1024*1024)throw Error('Book artwork must fit within 40 MB.'); setDraft({ id, templateId: restored.templateId, title: restored.title, language: restored.language, book: restored, images, updated: Date.now() }); setSelected(0); setStep(2); }); }}/></label>{!ready ? <p>Loading…</p> : saved.length === 0 ? <p>Your books will appear here. Saved on this browser; download a ZIP for backup.</p> : [...saved].sort((a, b) => b.updated - a.updated).map(d => <button className="ts-saved" key={d.id} onClick={() => { setDraft(d); setStep(d.book ? 2 : 1); setSelected(0); setUnmatched([]); }}>{d.book?.title || d.title} · {d.book?.pages.length || 0} spreads</button>)}{draft && <button onClick={() => { setDraft(undefined); storage('read').then(setSaved).catch(() => { }); }}>Start another book</button>}</section></>}
 {step === 1 && draft && <section className="ts-source"><div><p>{template.name.toUpperCase()}</p><h1>Bring the words.<br />We’ll prepare the direction.</h1><p>The source stays in this browser. Attach it to ChatGPT with the prompt, or download the request ZIP containing both.</p><label>Book title<input value={draft.title} onChange={e => patch({ title: e.target.value })}/></label><label>Language and meanings<input value={draft.language} onChange={e => patch({ language: e.target.value })}/></label><label className="ts-upload">{draft.source?.name || 'Choose your PDF or DOCX'}<input disabled={busy} type="file" accept=".pdf,.docx" onChange={e => { const f = e.target.files?.[0]; if (f)
        void run(async () => { if (!/\.(pdf|docx)$/i.test(f.name) || f.size > 20 * 1024 * 1024)
            throw Error('Choose a PDF or DOCX under 20 MB.'); patch({ source: f }); }); }}/></label><p className="ts-help">No automatic source rewriting or paid generation. Old-font PDFs must be read visually and checked by the external AI.</p></div><div className="ts-panel"><h2>Your detailed book prompt</h2><textarea aria-label="Detailed book prompt" readOnly value={prompt}/><div className="ts-actions"><button disabled={!draft.source || !draft.title.trim() || busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(prompt); setNotice('Prompt copied. Attach your source in ChatGPT.'); })}>Copy prompt</button><button disabled={!draft.source || busy} onClick={() => void run(async () => { download('Book-Request.zip', new Blob([new Uint8Array(zipSync({ 'START-HERE.txt': strToU8(prompt), ['source/' + draft.source!.name]: new Uint8Array(await draft.source!.arrayBuffer()) }))], { type: 'application/zip' })); })}>Download request ZIP</button><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></div><p>Ask ChatGPT to read the request and attached source. Bring back its manuscript first; illustrations can follow later.</p><label className="ts-upload">Import ChatGPT’s ZIP or book.json<input disabled={busy} type="file" accept=".zip,.json" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void run(() => importFiles(files)); }}/></label><details><summary>ChatGPT returned text instead of a file?</summary><textarea aria-label="Paste book JSON" value={pasted} onChange={e => setPasted(e.target.value)}/><button disabled={busy || !pasted.trim()} onClick={() => void run(() => importFiles([new File([pasted.replace(/^```(?:json)?\s*|\s*```$/g, '')], 'book.json')]))}>Import pasted response</button></details></div></section>}
 {step === 2 && draft && book && <><div className="ts-bookbar"><div><h1>{book.title}</h1><p>{done} of {book.pages.length} illustrations added · {book.pages.length} editable spreads</p></div><div className="ts-actions"><button disabled={busy} onClick={() => void run(openPreview)}>Read book</button><button disabled={busy} onClick={() => void run(exportZip)}>Download editable ZIP</button></div></div><progress value={done} max={book.pages.length}/><section className="ts-importbar"><label className="ts-upload">Add image batch or ZIP<input disabled={busy} type="file" multiple accept=".zip,.png,.jpg,.jpeg,.webp" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void run(() => importFiles(files)); }}/></label><button disabled={busy || done === book.pages.length} onClick={() => void run(async () => { await navigator.clipboard.writeText(continuationPrompt(book, names)); setNotice('Continuation prompt copied. Use the same ChatGPT conversation and character reference.'); })}>Copy missing-artwork prompt</button><button disabled={busy || done === book.pages.length} onClick={() => download('Continue-artwork.txt', new Blob([continuationPrompt(book, names)], { type: 'text/plain' }))}>Download prompt</button></section>{unmatched.length > 0 && <section className="ts-panel"><h2>Match downloaded images</h2><p>ChatGPT sometimes changes filenames. Choose where each image belongs.</p><PreviewImage blob={unmatched[0]} alt={unmatched[0].name}/><p>{unmatched[0].name} · {unmatched.length} to match</p><select aria-label="Image destination" value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">Choose a destination</option><option value="character-reference.png">Character reference</option>{book.pages.map(p => <option key={p.id} value={p.image}>{p.title}{draft.images[p.image] ? ' (replace existing)' : ''}</option>)}</select><button disabled={!assignment || busy} onClick={() => { if (Object.values({ ...draft.images, [assignment]: unmatched[0] }).reduce((n, b) => n + b.size, 0) > 40 * 1024 * 1024) {
            setError('Book artwork must fit within 40 MB.');
            return;
        } patch({ images: { ...draft.images, [assignment]: unmatched[0] } }); setUnmatched(u => u.slice(1)); setAssignment(''); }}>Use image here</button><button onClick={() => setUnmatched(u => u.slice(1))}>Skip image</button></section>}
 <div className="ts-editor"><aside>{book.pages.map((p, i) => <button key={p.id} aria-current={i === selected ? 'page' : undefined} onClick={() => setSelected(i)}><PreviewImage blob={draft.images[p.image]} alt={p.title}/><span>{i + 1}. {p.title}</span></button>)}</aside>{page && <section className="ts-panel"><div className={'ts-live ' + page.layout} style={{ background: template.paper, color: template.ink }}><div><h2>{page.title}</h2><p style={{fontSize:`${page.fontSize * .6}px`}}>{page.original}</p><small>{page.meaning}</small></div><div style={{ padding: page.layout === 'vignette' ? '8%' : '1%' }}><div style={{ width: `${page.imageScale}%` }}><PreviewImage blob={draft.images[page.image]} alt={page.scene}/></div></div></div><div className="ts-fields"><label>Spread title<input value={page.title} onChange={e => editPage({ title: e.target.value })}/></label><label>Composition<select value={page.layout} onChange={e => editPage({ layout: e.target.value as BookPage['layout'] })}><option value="art-right">Artwork right</option><option value="art-left">Artwork left</option><option value="vignette">Quiet vignette</option></select></label><label>Original text<textarea value={page.original} onChange={e => editPage({ original: e.target.value })}/></label><label>Meaning / explanation<textarea value={page.meaning} onChange={e => editPage({ meaning: e.target.value })}/></label><label>Text size: {page.fontSize} pt<input type="range" min="14" max="32" value={page.fontSize} onChange={e => editPage({ fontSize: Number(e.target.value) })}/></label><label>Artwork scale: {page.imageScale}%<input type="range" min="40" max="100" value={page.imageScale} onChange={e => editPage({ imageScale: Number(e.target.value) })}/></label><label>Scene prompt<textarea value={page.scene} onChange={e => editPage({ scene: e.target.value })}/></label><label>Source reference<input value={page.sourceReference} onChange={e => editPage({ sourceReference: e.target.value })}/></label></div><p className="ts-help">Edits save automatically. Check original wording against your source. Read the book to check fit before exporting. This is a working proof, not an approved print release.</p></section>}</div></>}
 {preview && <div className="ts-preview" role="dialog" aria-label="Book reading preview"><div className="ts-actions"><button onClick={() => setPreview('')}>Close book preview</button><button onClick={() => previewFrame.current?.contentWindow?.print()}>Print / Save PDF</button><span>{proofWarnings.length ? proofWarnings.join(' · ') : 'Working proof. Check wording and page layout before printing.'}</span></div><iframe ref={previewFrame} title="Your assembled book" sandbox="allow-same-origin allow-modals" srcDoc={preview} onLoad={() => { void (async () => { const doc = previewFrame.current?.contentDocument; if (!doc)
        return; await doc.fonts.ready; await Promise.all(Array.from(doc.images).map(i => i.decode().catch(() => { }))); const warnings: string[] = []; doc.querySelectorAll<HTMLElement>('.copy').forEach((el, i) => { if (el.scrollHeight > el.clientHeight + 2)
        warnings.push(`Spread ${i + 1}: text overflow; reduce text size or split content`); }); doc.querySelectorAll<HTMLImageElement>('.art img').forEach((im, i) => { if (!im.naturalWidth)
        warnings.push(`Image ${i + 1} did not load`);
    else if (im.naturalWidth / im.clientWidth * 96 < 300)
        warnings.push(`Image ${i + 1}: below 300 dpi at placed size`); }); setProofWarnings(warnings); })(); }}/></div>}
 </main>;
}
