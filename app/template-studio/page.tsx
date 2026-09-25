'use client';
import { templateReferenceEntries } from '../../lib/template-reference-package';
import {notebookOriginal} from '../../lib/notebook-content';
import {autoPlaceStoryBook} from '../../lib/story-text-placement';
import {fitTextPositions} from '../../lib/text-placement';
import TextPlacementEditor from './text-placement-editor';
import LayoutReview, { BookSpreadPreview } from './layout-review';
import { templatePrintSize, plannedTextBlocks, blueprintFor, templateBlueprints, layoutIssues, imageGeometryIssue, inspectRenderedBook, blueprintPrompt } from '../../lib/template-layouts';
import { storyCompositions, type StoryComposition } from '../../lib/story-compositions';
import { notebookArtworkRequest } from '../../lib/notebook-prompt';
import { prepareExportFont } from '../../lib/template-export-fonts';
import { sourceBookPrompt, sourceRequestEntries } from '../../lib/visual-direction';
import { draftStep, handoffEntries } from '../../lib/chatgpt-handoff';
import ChatGptHandoff from './chatgpt-handoff';
import { createImageFirstBook, imageDevelopmentPrompt } from '../../lib/image-first-book';
import NotesGallery from './notes-gallery';
import ChildrenGallery from './children-gallery';
import TemplateLayoutSamples from './template-layout-samples';
import {isChildrenTemplate} from '../../lib/children-templates';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import { templateFont, templates, selectableTemplates, templateLayout, templateAppearanceCss, parseTemplateBook, importTemplateManuscript, continuationPrompt, renderTemplateBook, assetName, type TemplateId, type TemplateBook, type BookPage } from '../../lib/template-book';
import { readTemplateArchive } from '../../lib/template-archive';
import './studio.css';
import { validateBookArtwork, validateSourceFile, BOOK_ARTWORK_BYTES, MiB, ARCHIVE_BYTES, IMAGE_BYTES } from '../../lib/template-capacity';
import LiteraryGallery from './literary-gallery';
import { isLiteraryTemplate } from '../../lib/literary-templates';
import { storage, uploadDraft, downloadDraft, cloudRequest, type Draft, type CloudBook } from '../../lib/template-storage';
import AccountPanel from '../components/account-panel';
import { saveWithFallback, browserSaveError } from '../../lib/template-save';
function download(name: string, data: Blob) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function imageBlob(file: Blob) { if (file.size > IMAGE_BYTES)
    throw Error('Each image must be under 25 MB.'); const bitmap = await createImageBitmap(file); const pixels = bitmap.width * bitmap.height; bitmap.close(); if (pixels > 64000000)
    throw Error('Image exceeds 64 megapixels.'); return file; }
async function validateTemplateArtwork(book:TemplateBook,images:Record<string,Blob>) {
    validateBookArtwork(images);
    for(const p of book.pages)if(images[p.image]){
        const bitmap=await createImageBitmap(images[p.image]);
        const issue=imageGeometryIssue(book,p,bitmap.width,bitmap.height);bitmap.close();
        if(issue)throw Error(issue);
    }
}
function PreviewImage({ blob, alt }: {
    blob?: Blob;
    alt: string;
}) { const [url, setUrl] = useState(''); useEffect(() => { if (!blob) {
    queueMicrotask(() => setUrl(''));
    return;
} const u = URL.createObjectURL(blob); queueMicrotask(() => setUrl(u)); return () => URL.revokeObjectURL(u); }, [blob]); return url ? <img src={url} alt={alt}/> : <span className="ts-placeholder">Artwork pending</span>; }
export default function TemplateStudio() {
    const [chosenImages, setChosenImages] = useState<File[]>([]);
    const [draft, setDraft] = useState<Draft>();
    const [email, setEmail] = useState<string | null>(null);
    const [cloudLibrary, setCloudLibrary] = useState<{ email: string | null; books: CloudBook[] }>({ email: null, books: [] });
    const cloudBooks = cloudLibrary.email === email ? cloudLibrary.books : [];
    const [saved, setSaved] = useState<Draft[]>([]);
    const [ready, setReady] = useState(false);
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [pasted, setPasted] = useState('');
    const [selected, setSelected] = useState(0);
    const [preview, setPreview] = useState('');
    const [showLayoutPlan,setShowLayoutPlan] = useState(false);
    const [showContactSheet,setShowContactSheet] = useState(false);
    const [liveWarnings,setLiveWarnings] = useState<string[]>([]);
    const previewFrame = useRef<HTMLIFrameElement>(null);
    const [proofWarnings, setProofWarnings] = useState<string[]>([]);
    const [unmatched, setUnmatched] = useState<File[]>([]);
    const [assignment, setAssignment] = useState('');
    const writeQueue = useRef(Promise.resolve());
    const latestDraft = useRef<Draft>(undefined);
    const [saveError, setSaveError] = useState('');
    useEffect(() => { storage('read').then(books => {
        setSaved(books);
        const bookId = new URLSearchParams(window.location.search).get('book');
        if (bookId) {
            const existing = books.find(book => book.id === bookId);
            if (existing) { setDraft(existing); setStep(draftStep(existing)); }
            else setError('This book is not available in this browser. Return to Book Studio and open it from your account library.');
        }
    }).catch(() => setError('Browser storage could not be opened. Export a ZIP to keep your work.')).finally(() => setReady(true)); }, []);
    useEffect(() => {
        if (!draft) return;
        latestDraft.current = draft;
        writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
            if (latestDraft.current !== draft) return;
            setNotice('Saving…');
            try {
                await storage('write', draft);
                setSaved(old => [...old.filter(v => v.id !== draft.id), draft]);
                setSaveError('');
                setNotice('Saved in this browser');
            } catch (error) { setNotice('Browser save needs attention'); setSaveError(browserSaveError(error)); }
        });
    }, [draft]);
    async function refreshCloud() {
        const response = await cloudRequest('/api/library/books');
        setCloudLibrary({ email, books: (await response.json()).books });
    }
    useEffect(() => { let active = true; if (email) void cloudRequest('/api/library/books').then(r => r.json()).then(data => { if (active) setCloudLibrary({ email, books: data.books }); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [email]);
    async function saveNow() {
        if (!draft) return;
        await writeQueue.current;
        setNotice(email ? 'Saving to your account…' : 'Saving…');
        const result = await saveWithFallback(draft, value => storage('write', value), email ? value => uploadDraft(value, email) : undefined);
        setSaveError(result.localError ? browserSaveError(result.localError) : '');
        if (email) {
            setDraft(current => current?.id === result.value.id ? { ...current, cloud: result.value.cloud } : current);
            setNotice('Saved to your account');
            await refreshCloud();
        } else setNotice('Saved in this browser');
    }

    function patch(p: Partial<Draft>) { setDraft(d => {
        if (!d) return d;
        const invalidatesApproval = d.visualDirection?.handoff === 'approved' && !p.book && ['source', 'title', 'language', 'templateId', 'references', 'images', 'visualDirection'].some(key => key in p);
        return { ...d, ...p, ...(invalidatesApproval ? { visualDirection: { ...d.visualDirection!, ...p.visualDirection, handoff: 'sample' as const } } : {}), ...(d.book && !p.book && (p.title !== undefined || p.language !== undefined) ? {book:{...d.book, title:p.title ?? d.book.title, language:p.language ?? d.book.language}} : {}), updated: Date.now() };
    }); }
    async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setNotice('Action failed'); setError(e instanceof Error ? e.message : 'Could not complete this step.');
    }
    finally {
        setBusy(false);
    } }
    const template = templates.find(t => t.id === (draft?.templateId || 'painted'))!;
    const book = draft?.book;
    const page = book?.pages[selected];
    const names = Object.keys(draft?.images || {});
    const done = book?.pages.filter(p => names.includes(p.image)).length || 0;
    const prompt = draft ? sourceBookPrompt(draft) : '';
    function editDirection(values: Partial<NonNullable<Draft['visualDirection']>>) {
        patch({ visualDirection: { audience: '', characters: '', notes: '', ...draft?.visualDirection, ...values } });
    }
    function chooseTemplate(templateId: TemplateId) {
        if (draft?.book) { setError('Your current book is saved. Choose Start another book below before selecting a new template.'); return; }
        if (draft?.visualDirection?.handoff) {
            if (!draft.visualDirection.notes.trim() || !Object.keys(draft.references || {}).length) { setError('Add references and paste their art direction before choosing a layout.'); return; }
            patch({ templateId, visualDirection: { ...draft.visualDirection, handoff: 'sample' } });
            setStep(1); setError(''); window.scrollTo({top:0}); return;
        }
        if (chosenImages.length) {
            const id = crypto.randomUUID();
            const { book, images } = createImageFirstBook(id, templateId, chosenImages);
            setDraft({ id, templateId, title: book.title, language: book.language, book, images, updated: Date.now() });
            setSelected(0); setUnmatched([]); setChosenImages([]); setStep(2); setError(''); window.scrollTo({ top: 0 });
            return;
        }
        setDraft({ id: crypto.randomUUID(), templateId, title: 'My illustrated book', language: 'Original language with English meanings', images: {}, updated: Date.now() });
        setStep(1); setError(''); window.scrollTo({top:0});
    }
    function editPage(p: Partial<BookPage>) { if (book)
        patch({ book: { ...book, pages: book.pages.map((v, i) => {
            if(i!==selected)return v;
            const changedBlueprint=Boolean(p.blueprint&&p.blueprint!==v.blueprint);
            const next={...v,...p,...(changedBlueprint&&draft?.images[v.image]?{artworkBlueprint:v.artworkBlueprint||v.blueprint}:{})};
            if(changedBlueprint||next.textPositions===undefined){delete next.textPositions;delete next.readingOrder;}
            return next;
        }) } }); }
    function startReferences() {
        setChosenImages([]); setError(''); setStep(0);
        setDraft({ id: crypto.randomUUID(), templateId: 'bedtime-skies', title: 'My illustrated book', language: 'Original language with English meanings', images: {}, references: {}, visualDirection: { audience: '', characters: '', notes: '', handoff: 'references' }, updated: Date.now() });
    }
    async function addHandoffImages(files: File[], destination?: 'character-reference.png' | 'style-sample.png') {
        if (!draft || !files.length) return;
        if (destination) {
            const input = await imageBlob(files[0]);
            const bitmap = await createImageBitmap(input);
            const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Could not read this image.')), 'image/png'));
            const images = { ...draft.images, [destination]: await imageBlob(blob) }; validateBookArtwork(images);
            patch({ images, visualDirection: { ...draft.visualDirection!, handoff: 'sample' } }); return;
        }
        const references = { ...draft.references };
        if (Object.keys(references).length + files.length > 3) throw Error('Choose up to three style references.');
        for (const file of files) {
            const ext = file.name.match(/\.(png|jpe?g|webp)$/i)?.[1].toLowerCase();
            if (!ext) throw Error('Choose PNG, JPEG or WebP references.');
            references[`reference-${crypto.randomUUID()}.${ext}`] = new Blob([await imageBlob(file)], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' });
        }
        patch({ references });
    }
    async function downloadHandoff(stage: 'analysis' | 'sample' | 'chapter') {
        if (!draft) return;
        download(`ChatGPT-${stage}-Request.zip`, new Blob([new Uint8Array(zipSync({ ...await handoffEntries(draft, stage), ...(stage !== 'analysis' ? await templateReferenceEntries(draft.templateId) : {}) }, { level: 0 }))], { type: 'application/zip' }));
        setNotice('Request downloaded. Attach it in ChatGPT; bring the generated result back here.');
    }
    const handoffPanel = (mode: 'references' | 'sample') => draft && <ChatGptHandoff draft={draft} busy={busy} mode={mode} patch={patch} onFiles={(files, destination) => void run(() => addHandoffImages(files, destination))} onDownload={stage => void run(() => downloadHandoff(stage))} onContinue={() => { patch({ visualDirection: { ...draft.visualDirection!, handoff: 'template' } }); setStep(0); }}/>;
    async function importFiles(files: File[], asNewBook = false) {
        if (!draft)
            return;
        if (!book && draft.visualDirection?.handoff && draft.visualDirection.handoff !== 'approved')
            throw Error('Upload and approve the character sheet and sample scene first. Then prepare the chapter request and import ChatGPT’s completed book.');
        if(files.reduce((n,f)=>n+f.size,0)>ARCHIVE_BYTES)throw Error(`Import batches must stay under ${ARCHIVE_BYTES/MiB} MB.`);
        const importId = asNewBook ? crypto.randomUUID() : draft.id;
        let next = asNewBook ? undefined : book;
        const incoming: Record<string, Blob> = {};
        const extra: File[] = [];
        for (const file of files) {
            if (/\.zip$/i.test(file.name)) {
                const archive = readTemplateArchive(new Uint8Array(await file.arrayBuffer()));
                if (archive['book.json']) {
                    const input = JSON.parse(new TextDecoder().decode(archive['book.json']));
                    next = asNewBook ? { ...parseTemplateBook(input), projectId: importId } : importTemplateManuscript(input, draft.id, draft.templateId, next);
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
                next = importTemplateManuscript(JSON.parse(await file.text()), draft.id, draft.templateId, next);
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
        const images = asNewBook ? {} as Record<string, Blob> : { ...draft.images };
        for (const [name, blob] of Object.entries(incoming)) {
            if (!asNewBook && draft.visualDirection?.handoff === 'approved' && (name === 'character-reference.png' || name === 'style-sample.png') && images[name]) continue;
            if (next.pages.some(p => p.image === name) || name === 'character-reference.png')
                images[name] = blob;
            else
                extra.push(new File([blob], name, { type: blob.type }));
        }
        await validateTemplateArtwork(next,images);
        const placement=await autoPlaceStoryBook(next,images);next=placement.book;
        if(next.templateRevision)next={...next,pages:next.pages.map(p=>incoming[p.image]?{...p,artworkBlueprint:p.blueprint}:p)};
        if (asNewBook) {
            await writeQueue.current;
            await storage('write', draft);
            const imported: Draft = { id: importId, book: next, templateId: next.templateId, title: next.title, language: next.language, images, updated: Date.now() };
            await storage('write', imported);
            setDraft(imported);
            setUnmatched(extra);
        } else {
            patch({ book: next, title: next.title, language: next.language, images });
            setUnmatched(u => [...u, ...extra]);
        }
        setSelected(0);
        setStep(2);
        setNotice(`Imported ${next.pages.length} spreads · ${next.pages.filter(p => images[p.image]).length} illustrations placed${placement.unplaced.length?` · Review text on spreads ${placement.unplaced.join(', ')}: no clear area fits the complete passage.`:''}`);
    }
    async function createRedesign(planned:TemplateBook) {
        if(!draft)return;
        const id=crypto.randomUUID();
        const redesigned={...planned,projectId:id,characterGuide:'Recreate these source-specific identities in the selected template medium. Discard old positional and rendering instructions: '+planned.characterGuide};
        const references=await templateReferenceEntries(planned.templateId);
        const entries:Record<string,Uint8Array>={...references,'book.json':strToU8(JSON.stringify(redesigned,null,2)),
            'START-HERE.txt':strToU8('REBUILD ARTWORK. The supplied book.json is the complete frozen manuscript and layout plan. Preserve it exactly. Existing artwork is intentionally excluded. Rebuild the character sheet in the selected template style; ignore previous notes about always placing figures on the right. For EACH spread use only its selected blueprint. Return images only, including character-reference.png.\n'+continuationPrompt(redesigned,[]))};
        for(const p of redesigned.pages)entries[`spread-prompts/${p.id}.txt`]=strToU8(blueprintPrompt(p.blueprint!)+'\nSource: '+p.original+'\nScene: '+p.scene);
        await writeQueue.current;
        await storage('write',draft);
        const copy:Draft={...draft,id,book:redesigned,images:{},cloud:undefined,updated:Date.now()};
        await storage('write',copy);
        download('Template-Redesign-Request.zip',new Blob([new Uint8Array(zipSync(entries,{level:0}))],{type:'application/zip'}));
        setDraft(copy);setSelected(0);setShowLayoutPlan(false);setShowContactSheet(true);
        setNotice('Redesign copy created. Original book preserved. Generate the replacement images from the downloaded request.');
    }
    async function replaceArtwork(blob:Blob,name:string) {
        if(!draft||!book)return;
        await imageBlob(blob);
        const target=book.pages.find(p=>p.image===name);
        if(target){const bitmap=await createImageBitmap(blob);const issue=imageGeometryIssue(book,target,bitmap.width,bitmap.height);bitmap.close();if(issue)throw Error(issue);}
        const images={...draft.images,[name]:blob};validateBookArtwork(images);
        const next={...book,pages:book.pages.map(p=>p.image===name&&book.templateRevision?{...p,artworkBlueprint:p.blueprint}:p)};
        const placed=await autoPlaceStoryBook(next,{[name]:blob},true);
        patch({images,book:placed.book});
        if(placed.unplaced.length)setNotice('Illustration saved. The complete passage needs more clear space; review its text placement.');
    }
    async function openPreview() { if (!book || !draft)
        return; const urls: Record<string, string> = {}; for (const [name, blob] of Object.entries(draft.images))
        urls[name] = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); const font = await fetch('/fonts/'+templateFont(book)); if (!font.ok)
        throw Error('Book font could not load.'); const fontBlob = await font.blob(); const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(fontBlob); }); setPreview(renderTemplateBook(book, urls, data)); }
    async function autoPlaceText() {
        if(!book||!draft)return;
        const result=await autoPlaceStoryBook(book,draft.images,true);
        patch({book:result.book});
        setNotice(result.unplaced.length?`Text placed. Spreads ${result.unplaced.join(', ')} need review: no clear area fits the complete passage at this font size.`:'Text placed and saved. Each passage reads together, followed by its meaning.');
        if(preview){
            const urls:Record<string,string>={};
            const spreads=previewFrame.current?.contentDocument?.querySelectorAll('.planned-spread');
            spreads?.forEach((spread,i)=>{const im=spread.querySelector<HTMLImageElement>('.planned-art');if(im)urls[book.pages[i].image]=im.src;});
            setPreview(renderTemplateBook(result.book,urls,'/fonts/'+templateFont(result.book)));
        }
    }
    async function fitOverflowingText() {
        if(book?.templateId==='beanstalk-adventure'){await autoPlaceText();return;}
        const doc=previewFrame.current?.contentDocument;
        if(!doc||!book||!book.templateRevision)return;
        await doc.fonts.ready;
        const spreads=Array.from(doc.querySelectorAll<HTMLElement>('.planned-spread'));
        const next={...book,pages:book.pages.map((p,i)=>{
            if(!spreads[i])return p;
            const boxes=plannedTextBlocks(p,blueprintFor(book,p)).map(({x,y,w,h})=>({x,y,w,h}));
            return {...p,textPositions:fitTextPositions(spreads[i],boxes)};
        })};
        patch({book:next});
        const urls:Record<string,string>={};
        spreads.forEach((spread,i)=>{const image=spread.querySelector<HTMLImageElement>('.planned-art');if(image&&book.pages[i])urls[book.pages[i].image]=image.src;});
        setPreview(renderTemplateBook(next,urls,'/fonts/'+templateFont(next)));
        setError('');setNotice('Text boxes expanded and saved. Review their placement over the artwork before exporting.');
    }
    async function downloadPdf(asIs = false) {
        const doc = previewFrame.current?.contentDocument;
        if (!doc || !book) throw Error('Open the book preview before downloading a PDF.');
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
        await doc.fonts.ready;
        await Promise.all(Array.from(doc.images).map(image => image.decode()));
        const fitIssues=[...layoutIssues(book).filter(note=>/artwork belongs/.test(note)),...inspectRenderedBook(doc).filter(note=>/did not load/.test(note)||(!asIs&&/overflow/.test(note)))];
        if(fitIssues.length)throw Error(fitIssues.join('\n'));
        const exportFont = await prepareExportFont(document, '/fonts/' + templateFont(book));
        const style = doc.createElement('style');
        style.textContent = '.spread{zoom:1!important}';
        doc.head.appendChild(style);
        try {
            const spreads = Array.from(doc.querySelectorAll<HTMLElement>('.spread'));
            const sizeAt=(i:number)=>templatePrintSize(book.templateId,spreads[i].classList.contains('cover'),book.templateRevision||1);
            const first=sizeAt(0);
            const pdf = new jsPDF({ orientation:first.width>=first.height?'landscape':'portrait', unit: 'mm', format: [first.width,first.height], compress: true });
            for (let i = 0; i < spreads.length; i++) {
                setNotice(`Preparing PDF: ${i + 1} of ${spreads.length} pages`);
                const canvas = await html2canvas(spreads[i], { scale: 1.5, backgroundColor: null, logging: false, windowWidth: 1800, windowHeight: 1200, onclone: cloned => exportFont.prepareClone(doc, cloned) });
                const size=sizeAt(i);
                if (i) pdf.addPage([size.width,size.height],size.width>=size.height?'landscape':'portrait');
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, size.width,size.height);
                canvas.width = 0; canvas.height = 0;
            }
            download(`${book.title.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`, pdf.output('blob'));
            setNotice('PDF downloaded — template dimensions preserved, one spread per interior page');
        } finally { style.remove(); exportFont.release(); }
    }
    async function exportZip() { if (!book || !draft)
        return; const entries: Record<string, Uint8Array> = { 'book.json': strToU8(JSON.stringify(book, null, 2)), 'manuscript.md': strToU8(`# ${book.title}\n\n` + book.pages.map(p => `## ${p.title}\n\n${p.original}\n\n${p.meaning}\n\nSource: ${p.sourceReference}`).join('\n\n')), 'README.txt': strToU8('WORKING EDITABLE BOOK\nOpen preview.html in a browser to read or Print > Save as PDF. Text is editable for printing; save permanent changes in Book Studio. Reimport book.json and images in the matching workspace. Original text and explanations are separate. Layout/font/scale settings are in book.json. Paintings are raster assets, not editable vectors. Review original text, overflow and effective image resolution before publication. Template sample art is not included.\nMissing images: ' + book.pages.filter(p => !draft.images[p.image]).map(p => p.image).join(', ')) }; const urls: Record<string, string> = {}; for (const [name, blob] of Object.entries(draft.images)) {
        entries['images/' + name] = new Uint8Array(await blob.arrayBuffer());
        urls[name] = 'images/' + name;
    } entries['preview.html'] = strToU8(renderTemplateBook(book, urls)); const font = await fetch('/fonts/'+templateFont(book)); if (!font.ok)
        throw Error('Font could not be packaged.'); entries['fonts/'+templateFont(book)] = new Uint8Array(await font.arrayBuffer()); const license = await fetch('/fonts/'+(templateFont(book)==='book-hand.ttf'?'OFL-PatrickHand.txt':templateFont(book)==='book-sans.ttf'?'OFL-NotoSansDevanagari.txt':'OFL-NotoSerifDevanagari.txt')); if (!license.ok)
        throw Error('Font license could not be packaged.'); entries['fonts/OFL.txt'] = new Uint8Array(await license.arrayBuffer()); if (draft.source)
        entries['source/' + draft.source.name] = new Uint8Array(await draft.source.arrayBuffer()); download('Editable-Book.zip', new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], { type: 'application/zip' })); }
    return <main className="ts"><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><style>{templateAppearanceCss()}</style><header className="ts-header"><Link href="/">← Book Studio</Link><strong>Books, made your way.</strong><span role="status">{busy ? 'Working…' : notice}</span></header><details className="ts-account-disclosure"><summary>Account & sign-in{email ? ` · ${email}` : ""}</summary><AccountPanel onSession={setEmail}/></details><div className="ts-actions ts-library-actions">{draft && <button className="ts-save-primary" disabled={busy} onClick={() => void run(saveNow)}>Save book{email ? ' to account' : ' now'}</button>}<button disabled={busy} onClick={() => void run(async () => { await writeQueue.current; if (draft) await storage('write', draft); setSaved(await storage('read')); setDraft(undefined); setStep(0); })}>My saved books</button></div>{email && <details className="ts-panel ts-cloud-library"><summary>Cloud library <span>{cloudBooks.length} books</span></summary><header className="ts-cloud-heading"><div><h2>Your cloud library</h2><p>Saved to <strong>{email}</strong></p><span>Open these books from any browser with this account.</span></div><button disabled={busy} onClick={() => void run(refreshCloud)}>Refresh library</button></header>{cloudBooks.length === 0 && <p>No cloud books yet. Open a browser book and choose Save book to account.</p>}<div className="ts-cloud-grid">{cloudBooks.map(item => <button className="ts-cloud-book" disabled={busy} key={item.id} onClick={() => void run(async () => { await writeQueue.current; if (draft) await storage('write', draft); const restored = await downloadDraft(item, email); const existing = saved.find(d => d.id === restored.id); if (existing && !(existing.cloud?.email === email && existing.cloud.revision === item.revision && existing.cloud.savedUpdated === existing.updated)) { const backupId = crypto.randomUUID(); await storage('write', { ...existing, id: backupId, book: existing.book ? { ...existing.book, projectId: backupId, title: existing.title + ' (local backup)' } : undefined, title: existing.title + ' (local backup)', cloud: undefined }); } await storage('write', restored); setSaved(await storage('read')); setDraft(restored); setStep(draftStep(restored)); setSelected(0); setUnmatched([]); })}><span className="ts-cloud-cover" aria-hidden="true" style={{background: templates.find(t => t.id === item.templateId)?.paper, color: templates.find(t => t.id === item.templateId)?.ink}}>{item.title}</span><span className="ts-cloud-book-info"><strong>{item.title}</strong><span>{templates.find(t => t.id === item.templateId)?.name}{item.book ? ` · ${item.book.pages.length} spreads` : ' · Draft'}</span><small>Open cloud copy <span aria-hidden="true">→</span></small></span></button>)}</div></details>}<nav aria-label="Book creation steps">{[draft?.visualDirection?.handoff ? 'Visuals & layout' : 'Choose a template', book?.contentMode === 'images' ? 'Book details' : 'Source & prompt', 'Assemble & edit'].map((label, i) => <button key={label} disabled={busy || !draft && i > 0 || i === 2 && !book || i === 1 && ['references', 'template'].includes(draft?.visualDirection?.handoff || '')} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</nav>{saveError && <div className="ts-save-warning" role="status"><p>{saveError}</p><button disabled={busy} onClick={() => void run(saveNow)}>{email ? "Save to account" : "Retry save"}</button></div>}{error && <p className="ts-error" role="alert">{error}</p>}
 {step === 0 && draft?.visualDirection?.handoff === 'references' && <>{handoffPanel('references')}<button onClick={() => setDraft(undefined)}>Back to saved books and templates</button></>}
 {step === 0 && draft?.visualDirection?.handoff !== 'references' && <><div className="ts-intro"><p>YOUR SOURCE. YOUR BOOK.</p><h1>Start with a book you can see.</h1><p>Choose a visual direction. Bring your PDF or DOCX. Get one detailed prompt and build the book at your own pace.</p></div>{!draft?.book && !draft?.visualDirection?.handoff && <button disabled={!ready || busy} onClick={startReferences}>Start with visual references</button>}{draft?.visualDirection?.handoff === 'template' && <p className="ts-panel">Your art direction is saved. Choose a book below for its layout and text placement. Your references will control the new illustrations. <button onClick={() => patch({ visualDirection: { ...draft.visualDirection!, handoff: 'references' } })}>Edit visual references</button></p>}{!draft?.book && !draft?.visualDirection?.handoff && <details className="ts-panel ts-image-start" open={chosenImages.length > 0 || undefined}>
 <summary>Have finished illustrations? Use them directly</summary>
 <p>Choose your images, arrange their order, then select a template below. Only its design and text placement are used. Add your text in the editor.</p>
 <label className="ts-upload">Choose images<input type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={e => {
     const files = Array.from(e.target.files || []); e.target.value = '';
     if (!files.length) return;
     void run(async () => {
         const next = [...chosenImages, ...files];
         if (next.length > 80) throw Error('Choose up to 80 images.');
         validateBookArtwork(Object.fromEntries(next.map((file, i) => [String(i), file])));
         for (const file of files) { if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw Error('Choose PNG, JPEG or WebP images.'); await imageBlob(file); }
         setChosenImages(next);
     });
 }}/></label>
 {chosenImages.length > 0 && <><p>{chosenImages.length} images · one per spread. Choose a template below to continue.</p><div className="ts-chosen-images">{chosenImages.map((file, i) => <div key={i}>
 <PreviewImage blob={file} alt={file.name}/><span>{i + 1}. {file.name}</span><div className="ts-actions">
 <button aria-label={`Move image ${i + 1} earlier`} disabled={i === 0} onClick={() => setChosenImages(items => { const next = [...items]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>←</button>
 <button aria-label={`Move image ${i + 1} later`} disabled={i === chosenImages.length - 1} onClick={() => setChosenImages(items => { const next = [...items]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next; })}>→</button>
 <button aria-label={`Remove image ${i + 1}`} onClick={() => setChosenImages(items => items.filter((_, index) => index !== i))}>Remove</button></div></div>)}</div><button onClick={() => setChosenImages([])}>Clear selection</button></>}
 </details>}<ChildrenGallery onChoose={chooseTemplate} disabled={busy}/><LiteraryGallery onChoose={chooseTemplate} disabled={busy}/><NotesGallery onChoose={chooseTemplate} disabled={busy}/><h2>Classic illustrated templates</h2><div className="ts-templates">{selectableTemplates.filter(t => t.id!=='iks-notes' && !isLiteraryTemplate(t.id) && !isChildrenTemplate(t.id)).sort((a,b) => Number(templateLayout(b.id) !== 'art-right') - Number(templateLayout(a.id) !== 'art-right')).map(t => <article className={t.id} key={t.id} style={{ background: t.paper, color: t.ink }}>{templateLayout(t.id) === 'art-right' && <div className={'ts-demo ' + t.id}><div className={"ts-mini-cover cover " + t.id}><small>AN ILLUSTRATED EDITION</small><h2>Wisdom<br />in every page</h2><span style={{ color: t.accent }}>A reading journey</span></div><img src={t.demo} alt={`${t.name} example artwork`}/></div>}<div className={'ts-mini-spread ' + t.id + ' composition-' + templateLayout(t.id) + (templateLayout(t.id) !== 'art-right' ? ' ts-structural-preview' : '')}><div className="copy"><h2>A moment of stillness</h2><p className="original">शान्तिः<br />A quiet place for the original words.</p><p className="meaning">A separate space to reflect on their meaning.</p></div><div className="art"><img src={t.demo} alt="Interior layout example"/></div></div><h2>{t.name}</h2><p>{t.description}</p><details><summary>Preview app layouts</summary><TemplateLayoutSamples id={t.id}/></details><button disabled={busy} onClick={() => chooseTemplate(t.id)}>Choose {t.name}</button></article>)}</div><p className="ts-help">Classic layout templates with public-domain artwork. <a href="/pilot/gita/credits.json">Artwork credits</a>. Your generated illustrations replace these examples.</p><section><h2>Your saved template books</h2><label className="ts-upload">Restore an editable book ZIP<input disabled={busy} type="file" accept=".zip" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f)
        void run(async () => { if (f.size > ARCHIVE_BYTES) throw Error(`ZIP must be under ${ARCHIVE_BYTES/MiB} MB.`); const entries = readTemplateArchive(new Uint8Array(await f.arrayBuffer())); if (!entries['book.json'])
            throw Error('ZIP needs book.json.'); const restored = parseTemplateBook(JSON.parse(new TextDecoder().decode(entries['book.json']))); const id = crypto.randomUUID(); restored.projectId = id; const images: Record<string, Blob> = {}; for (const [path, bytes] of Object.entries(entries)) {
            if (path.startsWith('images/'))
                images[path.slice(7)] = await imageBlob(new Blob([new Uint8Array(bytes)], { type: /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg' }));
        } await validateTemplateArtwork(restored,images); setDraft({ id, templateId: restored.templateId, title: restored.title, language: restored.language, book: restored, images, updated: Date.now() }); setSelected(0); setStep(2); }); }}/></label>{!ready ? <p>Loading…</p> : saved.length === 0 ? <p>Your books will appear here. Saved on this browser; download a ZIP for backup.</p> : [...saved].sort((a, b) => b.updated - a.updated).map(d => <button className="ts-saved" key={d.id} onClick={() => { setDraft(d); setStep(draftStep(d)); setSelected(0); setUnmatched([]); }}>{d.book?.title || d.title} · {d.book?.pages.length || 0} spreads</button>)}{draft && <button onClick={() => { setDraft(undefined); storage('read').then(setSaved).catch(() => { }); }}>Start another book</button>}</section></>}
 {step === 1 && draft && book?.contentMode === 'images' && <section className="ts-panel"><h1>Book details</h1><label>Book title<input value={draft.title} onChange={e => patch({ title: e.target.value })}/></label><label>Language<input value={draft.language} onChange={e => patch({ language: e.target.value })}/></label><button onClick={() => setStep(2)}>Continue editing</button></section>}
 {step === 1 && draft && book?.contentMode !== 'images' && <section className="ts-source"><div><p>{template.name.toUpperCase()}</p><h1>Bring the words.<br />We’ll prepare the direction.</h1><p>{draft.visualDirection?.handoff ? 'Add your source and describe the recurring characters. Try one scene in ChatGPT before approving the chapter’s visual direction.' : 'Add a chapter or a complete manuscript. Download the request ZIP with your source, visual references and prompt, then attach it in ChatGPT.'}</p><label>Book title<input value={draft.title} onChange={e => patch({ title: e.target.value })}/></label><label>Language and meanings<input value={draft.language} onChange={e => patch({ language: e.target.value })}/></label>{draft.templateId === 'iks-notes' && <label>Notebook content<select aria-label="Notebook content" value={draft.visualDirection?.notebookMode || 'full'} onChange={e => editDirection({ notebookMode: e.target.value as 'summary' | 'full' })}><option value="summary">Detailed summary</option><option value="full">Detailed book (full source)</option></select><span className="ts-help">{draft.visualDirection?.notebookMode === 'summary' ? 'Condense every chapter into substantial revision notes, keeping key concepts and complete selected examples.' : 'Adapt the full source, preserving explanations, methods and worked examples.'} Both use the same B5 notebook layout.</span></label>}{draft.templateId === 'iks-notes' && <label>Number of content pages<input aria-label="Number of content pages" type="number" min={1} max={80} step={1} placeholder="Automatic (e.g. 20)" value={draft.visualDirection?.notebookPageCount ?? ''} onChange={e => { const value=e.target.value; const count=e.target.valueAsNumber; if(value==='' || (Number.isInteger(count)&&count>=1&&count<=80)) editDirection({notebookPageCount:value===''?undefined:count}); else e.target.reportValidity(); }}/><span className="ts-help">Enter 1–80 pages, or leave blank for Automatic. The cover is extra. Applies to detailed books and summaries. Generate a new request to apply these choices; existing pages are not rewritten. Pages should contain substantial notes with small, deliberate gaps.</span></label>}<label>Reader age / audience<input maxLength={100} placeholder="e.g. Ages 9–14" value={draft.visualDirection?.audience || ''} onChange={e => editDirection({ audience: e.target.value })}/></label><label className="ts-upload">{draft.source?.name || 'Choose your PDF or DOCX'}<input disabled={busy} type="file" accept=".pdf,.docx" onChange={e => { const f = e.target.files?.[0]; if (f)
        void run(async () => { validateSourceFile(f); patch({ source: f }); }); }}/></label><details className="ts-visual-direction"><summary>Visual direction (optional)</summary><p>Use references to guide new illustrations. They will not become book pages.</p>
 <label>Recurring characters<textarea maxLength={4000} placeholder="e.g. A boy, a girl and Chanakya. Describe their appearance and outfits." value={draft.visualDirection?.characters || ''} onChange={e => editDirection({ characters: e.target.value })}/></label>
 <label>Illustration notes<textarea maxLength={4000} placeholder="e.g. Soft textured painting, warm light and expressive faces. Keep the same characters throughout." value={draft.visualDirection?.notes || ''} onChange={e => editDirection({ notes: e.target.value })}/></label>
 <label className="ts-upload">Add style references<input type="file" accept=".png,.jpg,.jpeg,.webp" multiple onChange={e => {
     const files = Array.from(e.target.files || []); e.target.value = '';
     if (!files.length) return;
     void run(async () => {
         const references = { ...draft.references };
         if (Object.keys(references).length + files.length > 3) throw Error('Choose up to three style references.');
         for (const file of files) {
             const ext = file.name.match(/\.(png|jpe?g|webp)$/i)?.[1].toLowerCase();
             if (!ext) throw Error('Choose PNG, JPEG or WebP references.');
             const blob = await imageBlob(file);
             references[`reference-${crypto.randomUUID()}.${ext}`] = new Blob([blob], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' });
         }
         patch({ references });
     });
 }}/></label><p className="ts-help">Up to 3 images, 25 MB each. The request asks for a shared character sheet before the chapter illustrations.</p>
 <div className="ts-chosen-images">{Object.entries(draft.references || {}).map(([name, blob], i) => <div key={name}><PreviewImage blob={blob} alt={`Style reference ${i + 1}`}/><button onClick={() => { const references = { ...draft.references }; delete references[name]; patch({ references }); }}>Remove reference {i + 1}</button></div>)}</div>
 </details><p className="ts-help">No automatic source rewriting or paid generation. Old-font PDFs must be read visually and checked by the external AI.</p></div><div>{draft.visualDirection?.handoff ? handoffPanel('sample') : <div className="ts-panel"><h2>Your detailed book prompt</h2><textarea aria-label="Detailed book prompt" readOnly value={prompt}/><div className="ts-actions"><button disabled={!draft.source || !draft.title.trim() || busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(prompt); setNotice('Prompt copied. Attach your source and style references in ChatGPT, or use the request ZIP.'); })}>Copy prompt</button><button disabled={!draft.source || !draft.title.trim() || busy} onClick={() => void run(async () => { download('Book-Request.zip', new Blob([new Uint8Array(zipSync({ ...await sourceRequestEntries(draft), ...await templateReferenceEntries(draft.templateId) }, { level: 0 }))], { type: 'application/zip' })); })}>Download request ZIP</button><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></div><p>Download the request ZIP to include your selected template’s reference images and layout guides. The website writes the prompt: it tells ChatGPT to match that template’s illustration style, use the matching reference layout for each passage, generate distinct scenes, and correct artwork that enters the text areas. Ask ChatGPT to follow START-HERE.txt and return the completed book ZIP. Upload that ZIP below to place the whole book at once. If generation limits interrupt it, import the finished work and request the missing images.</p></div>}<label className="ts-upload">Import ChatGPT’s ZIP or book.json<input disabled={busy || Boolean(draft.visualDirection?.handoff && draft.visualDirection.handoff !== 'approved' && !book)} type="file" accept=".zip,.json" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void run(() => importFiles(files)); }}/></label><details><summary>ChatGPT returned text instead of a file?</summary><textarea aria-label="Paste book JSON" value={pasted} onChange={e => setPasted(e.target.value)}/><button disabled={busy || !pasted.trim() || Boolean(draft.visualDirection?.handoff && draft.visualDirection.handoff !== 'approved' && !book)} onClick={() => void run(() => importFiles([new File([pasted.replace(/^```(?:json)?\s*|\s*```$/g, '')], 'book.json')]))}>Import pasted response</button></details></div></section>}
 {step === 2 && draft && book && <><div className="ts-bookbar"><div><h1>{book.title}</h1><p>{done} of {book.pages.length} illustrations added · {book.pages.length} editable spreads</p></div><div className="ts-actions"><button disabled={busy} onClick={() => void run(openPreview)}>Read book</button><button disabled={busy} onClick={() => void run(exportZip)}>Download editable ZIP</button><button disabled={busy} onClick={()=>setShowLayoutPlan(true)}>Review layouts & rebuild artwork</button><button onClick={()=>setShowContactSheet(v=>!v)}>{showContactSheet?'Hide':'Show'} whole-book review</button></div></div><progress value={done} max={book.pages.length}/><p className="ts-help">Artwork: {(Object.values(draft.images).reduce((n, image) => n + image.size, 0) / 1024 / 1024).toFixed(1)} MB of {BOOK_ARTWORK_BYTES / MiB} MB · Up to 25 MB per image. Original image quality is preserved.</p><section className="ts-importbar"><label className="ts-upload">Import ZIP as a separate book<input disabled={busy} type="file" accept=".zip" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) void run(() => importFiles(files, true)); }}/></label><label className="ts-upload">Upload all images ZIP<input disabled={busy} type="file" multiple accept=".zip,.png,.jpg,.jpeg,.webp" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void run(() => importFiles(files)); }}/></label>{book.templateId === 'iks-notes' && <button disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(notebookArtworkRequest(book, [], true)); setNotice('Artwork correction prompt copied. Send it with your editable book ZIP and original source in the same ChatGPT conversation. Upload the returned images ZIP here.'); })}>Copy artwork correction prompt</button>}<button disabled={busy || done === book.pages.length} onClick={() => void run(async () => { await navigator.clipboard.writeText(continuationPrompt(book, names, (Object.keys(draft.references || {}).length || draft.visualDirection?.notes || draft.visualDirection?.characters) ? `Use the same attached style references and character-reference.png from the original request. Preserve the established faces, outfits, proportions and palette. ${draft.visualDirection?.notes || ''} Recurring characters: ${draft.visualDirection?.characters || book.characterGuide}` : undefined)); setNotice('All-images ZIP prompt copied. Use the same ChatGPT conversation and character reference.'); })}>Copy all missing images prompt</button><button disabled={busy || done === book.pages.length} onClick={() => download('Generate-All-Images.txt', new Blob([continuationPrompt(book, names, (Object.keys(draft.references || {}).length || draft.visualDirection?.notes || draft.visualDirection?.characters) ? `Use the same attached style references and character-reference.png from the original request. Preserve the established faces, outfits, proportions and palette. ${draft.visualDirection?.notes || ''} Recurring characters: ${draft.visualDirection?.characters || book.characterGuide}` : undefined)], { type: 'text/plain' }))}>Download images prompt</button><p className="ts-help">Send this prompt in your book’s ChatGPT conversation. It requests all remaining pictures in one downloadable ZIP. Upload it here: exact filenames inside images/ place each picture automatically. Generation limits may require a continuation.</p></section>{unmatched.length > 0 && <section className="ts-panel"><h2>Match downloaded images</h2><p>ChatGPT sometimes changes filenames. Choose where each image belongs.</p><PreviewImage blob={unmatched[0]} alt={unmatched[0].name}/><p>{unmatched[0].name} · {unmatched.length} to match</p><select aria-label="Image destination" value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">Choose a destination</option><option value="character-reference.png">Character reference</option>{book.pages.map((p, i) => <option key={p.id} value={p.image}>{p.title || `Spread ${i + 1}`}{draft.images[p.image] ? ' (replace existing)' : ''}</option>)}</select><button disabled={!assignment || busy} onClick={()=>void run(async()=>{await replaceArtwork(unmatched[0],assignment);setUnmatched(u=>u.slice(1));setAssignment('');})}>Use image here</button><button onClick={() => setUnmatched(u => u.slice(1))}>Skip image</button></section>}
 {book.contentMode === 'images' && <details className="ts-panel"><summary>Optional: develop these images with ChatGPT</summary><p>Your images are already placed. To create new artwork from them, add any changes in each spread’s Scene prompt, then download this request. Attach the ZIP in ChatGPT and ask it to follow START-HERE.txt. Upload the returned images ZIP above to replace your images.</p><button disabled={busy} onClick={() => void run(async () => {
     const entries: Record<string, Uint8Array> = { 'START-HERE.txt': strToU8(imageDevelopmentPrompt(book)), 'book.json': strToU8(JSON.stringify(book, null, 2)) };
     for (const page of book.pages) {
         const image = draft.images[page.image];
         if (!image) throw Error('Add the missing images before downloading a reference request.');
         entries['images/' + page.image] = new Uint8Array(await image.arrayBuffer());
     }
     download('Image-Development-Request.zip', new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], { type: 'application/zip' }));
 })}>Download image development request</button></details>}
 {draft.templateId==='iks-notes'&&draft.visualDirection?.notebookPageCount!==undefined&&book.pages.length!==draft.visualDirection.notebookPageCount&&<p className="ts-layout-notes" role="status">Requested {draft.visualDirection.notebookPageCount} content pages; imported {book.pages.length}. Regenerate using the current request to meet the page budget. The cover is counted separately.</p>}
 {layoutIssues(book).length>0&&<details className="ts-layout-notes"><summary>Template layout notes ({layoutIssues(book).length})</summary>{layoutIssues(book).map((note,i)=><p key={i}>{note}</p>)}</details>}
 {showLayoutPlan&&<LayoutReview key={book.projectId} book={book} busy={busy} onClose={()=>setShowLayoutPlan(false)} onCreate={planned=>run(()=>createRedesign(planned))}/>}
 {showContactSheet&&<section aria-label="Whole-book layout review"><h2>Whole-book review</h2><p>Compare scene count, text placement, illustration style and neighbouring spreads. Structural checks cannot judge whether painted characters match the reference.</p><div className="ts-layout-contact">{book.pages.map((p,i)=><button key={p.id} onClick={()=>setSelected(i)}><BookSpreadPreview book={book} index={i} images={draft.images}/><span>{i+1}. {p.title} · {p.blueprint||p.composition||p.layout}</span></button>)}</div></section>}
 <div className="ts-editor"><aside>{book.pages.map((p, i) => <button key={p.id} aria-current={i === selected ? 'page' : undefined} onClick={() => setSelected(i)}><PreviewImage blob={draft.images[p.image]} alt={p.title}/><span>{i + 1}. {p.title || 'Untitled spread'}</span></button>)}</aside>{page && <section className="ts-panel"><TextPlacementEditor onAutoPlace={book.templateId==='beanstalk-adventure'?()=>void run(autoPlaceText):undefined} busy={busy} key={page.id+page.blueprint} book={book} index={selected} images={draft.images} onChange={textPositions=>editPage({textPositions})} onLoad={doc=>setLiveWarnings(inspectRenderedBook(doc).filter(note=>/overflow|sparse|reading order/.test(note)))}/>{liveWarnings.length>0&&<div className="ts-layout-notes" role="status">{liveWarnings.map((note,i)=><p key={i}>{note}</p>)}</div>}<div className="ts-page-image" tabIndex={0} aria-label="Paste image for selected page" onPaste={e => {
 const file = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'))?.getAsFile();
 if (file) { e.preventDefault(); void run(async () => { await replaceArtwork(file,page.image); }); }
 }}><label className="ts-upload">Replace this page’s illustration<input disabled={busy} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { await replaceArtwork(file,page.image); }); }}/></label><p className="ts-help">Or click this area and paste an image from your clipboard. This replaces only the selected page.</p></div><div className="ts-fields"><label>Spread title<input value={page.title} onChange={e => editPage({ title: e.target.value })}/></label>{book.templateRevision ? <label>Spread arrangement<select value={page.blueprint} onChange={e=>editPage({blueprint:e.target.value,layoutReason:'Manually selected in editor. Replacement artwork must match this arrangement.'})}>{!templateBlueprints(book.templateId,book.templateRevision||1).some(b=>b.id===page.blueprint)&&<option value={page.blueprint}>{blueprintFor(book,page).name} (saved layout)</option>}{templateBlueprints(book.templateId,book.templateRevision||1).filter(b=>!page.noteSections||b.original.length===page.noteSections.length).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><span>Changing the arrangement requires matching replacement artwork.</span></label> : <label>Composition<select value={page.layout} onChange={e => editPage({ layout: e.target.value as BookPage['layout'] })}><option value="story-scene">Integrated story landscape</option><option value="art-right">Artwork right</option><option value="art-left">Artwork left</option><option value="vignette">Quiet vignette</option><option value="panorama">Panorama & reading band</option><option value="immersive">Painting with text inset</option><option value="poetry">Poetry & small artwork</option><option value="study">Art strip & commentary columns</option></select></label>}{!book.templateRevision && page.layout === 'story-scene' && <label>Spread blueprint<select value={page.composition || 'landscape-opening'} onChange={e => editPage({composition: e.target.value as StoryComposition})}>{Object.entries(storyCompositions).map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}</select><span className="story-layout-note">Changing the blueprint requires matching replacement artwork. Text remains editable in the unpainted areas.</span></label>}{page.noteSections?<div>{page.noteSections.map((section,i)=><fieldset key={i}><legend>Text section {i+1}</legend><label>Heading<input value={section.heading} onChange={e=>{const noteSections=page.noteSections!.map((s,j)=>i===j?{...s,heading:e.target.value}:s);editPage({noteSections,original:notebookOriginal(noteSections)});}}/></label><label>Section text<textarea value={section.body} onChange={e=>{const noteSections=page.noteSections!.map((s,j)=>i===j?{...s,body:e.target.value}:s);editPage({noteSections,original:notebookOriginal(noteSections)});}}/></label></fieldset>)}</div>:<label>Original text<textarea value={page.original} onChange={e => editPage({ original: e.target.value })}/></label>}<label>Meaning / explanation<textarea value={page.meaning} onChange={e => editPage({ meaning: e.target.value })}/></label><label>Text size: {page.fontSize} pt<input type="range" min={book.templateId==='iks-notes'?10:14} max="32" value={page.fontSize} onChange={e => editPage({ fontSize: Number(e.target.value) })}/></label>{!book.templateRevision && <label>Artwork scale: {page.imageScale}%<input type="range" min="40" max="100" value={page.imageScale} onChange={e => editPage({ imageScale: Number(e.target.value) })}/></label>}<label>Scene prompt<textarea value={page.scene} onChange={e => editPage({ scene: e.target.value })}/></label><label>Source reference<input value={page.sourceReference} onChange={e => editPage({ sourceReference: e.target.value })}/></label></div><p className="ts-help">Edits save automatically. Check original wording against your source. Read the book to check fit before exporting. This is a working proof, not an approved print release.</p></section>}</div></>}
 {preview && <div className="ts-preview" role="dialog" aria-label="Book reading preview"><div className="ts-actions"><button onClick={() => setPreview('')}>Close book preview</button>{book?.templateRevision&&<button disabled={busy} onClick={()=>void run(fitOverflowingText)}>Fit overflowing text</button>}<button disabled={busy} onClick={() => void run(downloadPdf)}>{busy ? 'Preparing PDF…' : 'Download PDF'}</button><button disabled={busy} onClick={()=>void run(()=>downloadPdf(true))} title="Export the current layout without fixing overflowing text">Download as-is</button><button disabled={busy} onClick={()=>void run(async()=>{const doc=previewFrame.current?.contentDocument;if(!doc)return;await doc.fonts.ready;const blockers=[...layoutIssues(book!).filter(note=>/artwork belongs/.test(note)),...inspectRenderedBook(doc).filter(note=>/overflow|did not load/.test(note))];if(blockers.length)throw Error(blockers.join('\n'));previewFrame.current?.contentWindow?.print();})}>Print options</button><span role="status">{busy ? notice : 'PDF download preserves the template’s cover and spread dimensions. PDF pages are flattened; keep the editable ZIP for editing.'}</span>{error&&<p role="alert" className="ts-error">{error}</p>}{proofWarnings.length > 0 && <details className="ts-proof-notes"><summary>{proofWarnings.length} print-quality notes — review details</summary><p>Check all text regions and artwork before export. Standard PDF download checks text fit. Download as-is keeps the current layout, including overflowing text. Missing artwork still needs to be supplied. Low resolution is a print-quality note.</p>{proofWarnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}</div><iframe ref={previewFrame} title="Your assembled book" sandbox="allow-same-origin allow-modals" srcDoc={preview} onLoad={() => { void (async () => { const doc = previewFrame.current?.contentDocument; if (!doc)
        return; await doc.fonts.ready; await Promise.all(Array.from(doc.images).map(i => i.decode().catch(() => { }))); setProofWarnings(inspectRenderedBook(doc)); })(); }}/></div>}
 </fieldset></main>;
}
