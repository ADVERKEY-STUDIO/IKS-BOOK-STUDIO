'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import seed from '../../lib/iks-catalogue-seed.json';
import { kidsCategories, readerAges, mergeCatalogue, filterBooks, selectionPack, webUrl, type CatalogueBook, type CatalogueState, type ContentCard } from '../../lib/iks-catalogue';
import './catalogue.css';
import { catalogueStorage as storage } from '../../lib/iks-catalogue-storage';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function Catalogue() {
  const [state, setState] = useState<CatalogueState>(mergeCatalogue(undefined, seed as CatalogueBook[]));
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [age, setAge] = useState('');
  const [collection, setCollection] = useState('built-in');
  const [active, setActive] = useState(''), [adding, setAdding] = useState(false);
  useEffect(() => { storage().then(async saved => { const merged = mergeCatalogue(saved, seed as CatalogueBook[]); await storage(merged); setState(merged); setReady(true); }).catch(() => setMessage('Browser storage is unavailable. Enable storage and reload to edit the catalogue.')); }, []);
  async function save(next: CatalogueState) {
    setBusy(true); try { await storage(next); setState(next); setMessage('Saved on this browser.'); return true; } catch { setMessage('Could not save. Your previous catalogue is intact; check browser storage space.'); return false; } finally { setBusy(false); }
  }
  async function attach(book: CatalogueBook, file: File) {
    if (file.size > 100 * 1024 * 1024 || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') { setMessage('Choose a valid PDF up to 100 MB.'); return; }
    await save({...state, books: state.books.map(b => b.id === book.id ? {...b, pdf: file, pdfName: file.name} : b)});
  }
  async function addBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), get = (key: string) => String(data.get(key) || '').trim();
    if (!get('title')) return;
    const book: CatalogueBook = {id: crypto.randomUUID(), title: get('title'), creator: get('creator'), year: get('year'), language: get('language'), sourceUrl: webUrl(get('sourceUrl')), pdfUrl: webUrl(get('pdfUrl')), categories: [get('category')], age: get('age'), idea: get('idea'), checked: '', review: 'Suggested topic — passages not yet reviewed'};
    if (await save({...state, books: [...state.books, book]})) { setAdding(false); setCollection('all'); setQuery(book.title); setCategory(''); setAge(''); setPage(1); }
  }
  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), get = (key: string) => String(data.get(key) || '').trim();
    if (!get('title') || !get('pages') || !state.books.some(b => b.id === active)) return;
    const card: ContentCard = {id: crypto.randomUUID(), bookId: active, title: get('title'), pages: get('pages'), category: get('category'), age: get('age'), notes: get('notes')};
    if (await save({...state, cards: [...state.cards, card]})) setActive('');
  }
  const topics = Array.from(new Set([...kidsCategories, ...state.books.flatMap(b => b.categories), ...state.cards.map(c => c.category)]));
  const ages = Array.from(new Set([...readerAges, ...state.books.map(b => b.age), ...state.cards.map(c => c.age)]));
  const bundledIds = new Set(seed.map(b => b.id));
  const collectionBooks = collection === 'all' ? state.books : state.books.filter(b => bundledIds.has(b.id));
  const visible = filterBooks(collectionBooks, state.cards, query, category, age);
  const [page, setPage] = useState(1);
  const pageSize = 24, pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageBooks = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const cards = state.cards.filter(c => (!category || c.category === category) && (!age || c.age === age) && visible.some(b => b.id === c.bookId));
  return <main className="iks-catalogue">
    <header><Link href="/">← Book Studio</Link><span>THE SOURCE LIBRARY</span><button disabled={!ready || busy} onClick={() => setAdding(!adding)}>＋ Add a book</button></header>
    <section className="catalogue-intro"><p>INDIAN KNOWLEDGE SYSTEMS</p><h1>Many books.<br/><em>A world of discovery.</em></h1><p>Browse 458 historical Indian Knowledge Systems books and volumes, with PDF links and 13 topic categories for young readers.</p><small>{seed.length} collection books · {state.books.filter(b => !bundledIds.has(b.id)).length} other saved books · {state.cards.length} content cards · {state.selected.length} selected</small></section>
    <p className="catalogue-note">The built-in collection spans 1810–1925. Edition dates were checked against scan OCR, with visual spot-checks; PDF links were tested on 15 October 2026. Ages describe adult-led adaptation. Your selections and additions are saved on this browser. Archive PDF links are available below; attach a downloaded PDF to keep a local copy. Suggested topics are starting points for editorial review, not approved lessons.</p>
    <div role="status" aria-live="polite">{message || (!ready ? 'Opening catalogue…' : '')}</div>
    {adding && <form className="catalogue-form" onSubmit={addBook}><h2>Add a historical source</h2><label>Book title<input name="title" required maxLength={500}/></label><label>Author / editor / translator<input name="creator" required/></label><label>Edition year<input name="year" required pattern="[0-9]{4}" placeholder="1892"/></label><label>Language<input name="language" required/></label><label>Archive record URL<input name="sourceUrl" type="url" pattern="https?://.*"/></label><label>PDF URL<input name="pdfUrl" type="url" pattern="https?://.*"/></label><TopicFields/><label>Possible learning idea<textarea name="idea" required/></label><button disabled={busy}>Save source book</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></form>}
    <section className="catalogue-toolbar" aria-label="Catalogue filters"><label>Search books<input placeholder="Title, author, language, year or idea" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><label>Collection<select value={collection} onChange={e => { setCollection(e.target.value); setPage(1); }}><option value="built-in">458 historical books</option><option value="all">All books, including saved sources</option></select></label><label>Topic<select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All topics</option>{topics.map(c => <option key={c}>{c}</option>)}</select></label><label>Adaptation age<select value={age} onChange={e => { setAge(e.target.value); setPage(1); }}><option value="">All ages</option>{ages.map(a => <option key={a}>{a}</option>)}</select></label><button disabled={!ready || busy || !visible.length} onClick={() => void save({...state, selected: Array.from(new Set([...state.selected, ...visible.map(book => book.id)]))})}>Select matching books ({visible.length})</button><button disabled={!ready || busy || !state.selected.length} onClick={() => void save({...state, selected: []})}>Clear selection</button><button disabled={!ready || busy || !state.selected.length} onClick={() => { window.location.href = "/?catalogue=1"; }}>Use selected PDFs in Book Studio ({state.selected.length})</button><button disabled={!state.selected.length} onClick={() => download(new Blob([JSON.stringify(selectionPack(state), null, 2)], {type: 'application/json'}), 'iks-source-selection.json')}>Export selection ({state.selected.length})</button></section>
    <nav className="catalogue-pagination" aria-label="Book pages"><span>{visible.length} matching books · Page {currentPage} of {pageCount}</span><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
    <section className="catalogue-grid" aria-label="Source books">{pageBooks.map(book => <article key={book.id}><div className="catalogue-book-top"><span>{book.year} EDITION</span><label><input type="checkbox" aria-label={`Select ${book.title}`} checked={state.selected.includes(book.id)} disabled={!ready || busy} onChange={e => void save({...state, selected: e.target.checked ? [...state.selected, book.id] : state.selected.filter(id => id !== book.id)})}/> Select</label></div><h2>{book.title}</h2>{book.volume && <small>Volume {book.volume}</small>}<p className="catalogue-byline">{book.creator} · {Array.isArray(book.language) ? book.language.join(', ') : book.language}</p><div className="catalogue-tags">{book.categories.map(c => <span key={c}>{c}</span>)}<span>Ages {book.age}</span></div><p>{book.idea}</p><small>{book.review}{book.checked && ` · Checked ${book.checked}`}</small><div className="catalogue-actions">{webUrl(book.dateEvidenceUrl || '') && <a href={book.dateEvidenceUrl} title={book.verification} target="_blank" rel="noreferrer">Edition evidence ↗</a>}{webUrl(book.sourceUrl) && <a href={book.sourceUrl} target="_blank" rel="noreferrer">Archive record ↗</a>}{webUrl(book.pdfUrl) && <a href={book.pdfUrl} target="_blank" rel="noreferrer">Source PDF ↗</a>}{book.pdf && <button onClick={() => download(book.pdf!, book.pdfName || 'source.pdf')}>Download saved PDF</button>}<label className="catalogue-upload">{book.pdf ? 'Replace PDF' : 'Attach PDF'}<input aria-label={`Attach PDF to ${book.title}`} type="file" accept="application/pdf,.pdf" disabled={!ready || busy} onChange={e => { const file = e.target.files?.[0]; if (file) void attach(book, file); e.target.value = ''; }}/></label><button disabled={!ready || busy} onClick={() => setActive(active === book.id ? '' : book.id)}>＋ Group content</button></div>{book.pdfName && <small>Saved PDF: {book.pdfName}</small>}{active === book.id && <form className="catalogue-form" onSubmit={addCard}><h3>Create a page-linked content card</h3><label>Child-friendly topic title<input name="title" required/></label><label>Source pages / chapter<input name="pages" required placeholder="Printed pp. 12–15; PDF pp. 28–31"/></label><TopicFields/><label>What can children learn? Include review notes.<textarea name="notes" required/></label><button disabled={busy}>Save content card</button><button type="button" onClick={() => setActive('')}>Cancel</button></form>}</article>)}</section>
    {!visible.length && <p>No books match these filters.</p>}
    <section className="catalogue-content"><h2>Content grouped for kids</h2><p>Each card keeps its source book and page reference. Several books can contribute to one topic.</p>{!cards.length && <p>No content cards yet. Choose “Group content” on a source book after reviewing its PDF.</p>}{topics.filter(c => cards.some(card => card.category === c)).map(c => <section key={c}><h3>{c}</h3>{cards.filter(card => card.category === c).map(card => <article key={card.id}><div><h4>{card.title} <small>· Ages {card.age}</small></h4><p>{card.notes}</p><small>{state.books.find(b => b.id === card.bookId)?.title} · {card.pages}</small></div><button disabled={busy} onClick={() => void save({...state, cards: state.cards.filter(item => item.id !== card.id)})}>Remove card</button></article>)}</section>)}</section>
    <footer>Edition years describe the digitized books, not the date of the original knowledge tradition. Check each source’s attribution and reuse terms before publication. Export contains metadata and content cards; saved PDFs are downloaded separately.</footer>
  </main>;
}
function TopicFields() { return <><label>Children’s category<select name="category">{kidsCategories.map(c => <option key={c}>{c}</option>)}</select></label><label>Reader age<select name="age">{readerAges.map(a => <option key={a}>{a}</option>)}</select></label></>; }
