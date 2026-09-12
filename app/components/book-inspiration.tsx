"use client";

import { useEffect, useRef, useState } from "react";
import { inspirationAspects, inspirationBooks, inspirationBook, inspirationBrief, normalizeInspiration, type BookInspiration, type InspirationBook } from "../../lib/book-inspiration";

type ProjectChoice = { id: string; title: string; inspiration?: BookInspiration };

function ReferenceImage({ image, title }: { image: InspirationBook["images"][number]; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`reference-image reference-image-${image.kind.toLowerCase()}`}>
    {failed ? <span className="reference-unavailable">Preview unavailable here.<br/>Open the publisher’s source to view this book.</span>
      : <img src={image.url} alt={`${title} — ${image.label}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
  </div>;
}

export function InspirationShelf({ onOpen }: { onOpen: () => void }) {
  return <section className="inspiration-shelf" aria-labelledby="inspiration-shelf-title">
    <div className="inspiration-shelf-heading"><div><p>REAL BOOKS. DISTINCT PERSPECTIVES.</p><h2 id="inspiration-shelf-title">Find your book’s visual direction</h2><span>Explore published books, study their pages, and collect the details you love.</span></div><button onClick={onOpen}>Explore book inspiration <span aria-hidden="true">↗</span></button></div>
    <div className="inspiration-shelf-images">{[inspirationBooks[0], inspirationBooks[1], inspirationBooks[2], inspirationBooks[3]].map(book => <button onClick={onOpen} key={book.id} aria-label={`Explore inspiration including ${book.title}`}><ReferenceImage image={book.images[0]} title={book.title}/><span>{book.title}</span><small>{book.publisher}</small></button>)}</div>
    <p><a href="/pilot">Review our three-spread Bhagavad Gita pilot →</a></p>
  </section>;
}

export function BookInspirationGallery({ projects, initialProjectId, onBack, onApply }: {
  projects: ProjectChoice[];
  initialProjectId?: string;
  onBack: () => void;
  onApply: (targetId: string, selection: BookInspiration, title: string) => Promise<void>;
}) {
  const [target, setTarget] = useState(initialProjectId || "new");
  const [draft, setDraft] = useState(() => normalizeInspiration(projects.find(p => p.id === initialProjectId)?.inspiration));
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All books");
  const [interiorsOnly, setInteriorsOnly] = useState(false);
  const [detail, setDetail] = useState<InspirationBook | null>(null);
  const [sample, setSample] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const brief = inspirationBrief(draft);
  const categories = ["All books", "Scripture & commentary", "Devotional stories", "Traditional art", "Historical manuscripts"];
  const books = inspirationBooks.filter(book => (category === "All books" || book.category === category)
    && (!interiorsOnly || book.images.some(image => image.kind !== "Cover"))
    && `${book.title} ${book.creators} ${book.publisher} ${book.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const count = Object.keys(draft.references).length;
  const hasSavedReferences = Object.keys(normalizeInspiration(projects.find(p => p.id === target)?.inspiration).references).length > 0;

  useEffect(() => {
    const node = dialog.current;
    if (detail && node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); const trigger = returnFocus.current; requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); }); };
  }, [detail]);

  function inspect(book: InspirationBook) { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setSample(0); setDetail(book); }
  function changeTarget(id: string) {
    setTarget(id); setDraft(normalizeInspiration(projects.find(p => p.id === id)?.inspiration)); setMessage(""); setError("");
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { await onApply(target, draft, title.trim()); setMessage("Design references saved to your book. You can continue refining them here."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save. Your selections are still here; try again."); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(brief); setMessage("Design brief copied."); }
    catch { setError("Clipboard access is unavailable. Select and copy the brief below."); }
  }

  return <main className="inspiration-page">
    <header className="inspiration-top"><button onClick={onBack} disabled={busy}>← Back to studio</button><span>IKS Book Studio / Book inspiration</span></header>
    <div className="inspiration-intro"><p className="inspiration-eyebrow">THE REFERENCE LIBRARY</p><h1>A different book.<br/><em>A world of its own.</em></h1><p>Real editions, original artwork, considered typography. Explore the pages and choose what speaks to your book.</p></div>
    <div className="inspiration-workspace">
      <section className="inspiration-catalogue" aria-label="Book reference catalogue">
        <div className="inspiration-search"><label>Find a book<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, artist, publisher or visual detail" /></label><label className="inspiration-check"><input type="checkbox" checked={interiorsOnly} onChange={event => setInteriorsOnly(event.target.checked)}/> Interior previews only</label></div>
        <nav className="inspiration-filters" aria-label="Book categories">{categories.map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <p className="inspiration-result-count" aria-live="polite">{books.length} {books.length === 1 ? "book" : "books"} · Publisher and library references</p>
        {books.length ? <div className="inspiration-grid">{books.map(book => <article className="inspiration-card" key={book.id}>
          <button className="inspiration-card-image" onClick={() => inspect(book)} aria-label={`Explore ${book.title}`}><ReferenceImage image={book.images[0]} title={book.title}/></button>
          <div className="inspiration-card-meta"><span>{book.category}</span><span>{book.images[0].kind === "Cover" ? "Cover only" : `${book.images.length} previews`}</span></div>
          <h2><button onClick={() => inspect(book)}>{book.title}</button></h2><p>{book.creators}</p><div className="inspiration-tags">{book.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <footer><a href={book.sourceUrl} target="_blank" rel="noopener noreferrer">{book.publisher} ↗</a><button onClick={() => inspect(book)}>Explore book →</button></footer>
        </article>)}</div> : <div className="inspiration-empty"><h2>No books match these filters</h2><p>Try a title, artist, or a broader category.</p><button onClick={() => { setQuery(""); setCategory("All books"); setInteriorsOnly(false); }}>Clear filters</button></div>}
      </section>
      <aside id="book-design-direction" className="inspiration-board" aria-labelledby="inspiration-board-title">
        <p className="inspiration-eyebrow">YOUR DESIGN DIRECTION</p><h2 id="inspiration-board-title">Collect what you love</h2><p>Choose typography from one book, artwork from another. Build a direction that belongs to your manuscript.</p>
        <label>Apply to<select aria-label="Book project" value={target} disabled={busy} onChange={event => changeTarget(event.target.value)}><option value="new">A new book</option>{projects.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}</select></label>
        {target === "new" && <label>Book title<input value={title} maxLength={180} onChange={event => setTitle(event.target.value)} placeholder="Name your book" disabled={busy}/></label>}
        <div className="inspiration-selected">{inspirationAspects.map(aspect => { const book = inspirationBook(draft.references[aspect]); return <div key={aspect}><span>{aspect}</span>{book ? <><button className="inspiration-selected-title" onClick={() => inspect(book)}>{book.title}</button><button className="inspiration-remove" disabled={busy} aria-label={`Remove ${aspect} reference`} onClick={() => setDraft(current => { const references = { ...current.references }; delete references[aspect]; return { ...current, references }; })}>×</button></> : <small>Choose from a book</small>}</div>; })}</div>
        <label>Your notes<textarea value={draft.notes} maxLength={2000} rows={3} disabled={busy} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="More space around verses, less ornament…"/></label>
        <button className="inspiration-save" disabled={busy || (!count && !hasSavedReferences) || (target === "new" && !title.trim())} onClick={() => void save()}>{busy ? "Saving direction…" : target === "new" ? "Create book with this direction" : "Save direction to book"}</button>
        <p className="inspiration-save-note">Applies compatible design settings and saves your art brief. Reference images stay in this library; your book uses its own artwork.</p>
        {message && <p className="inspiration-feedback" role="status">{message}</p>}{error && <p className="inspiration-error" role="alert">{error}</p>}
        {brief && <details className="inspiration-brief"><summary>Read your design brief</summary><textarea aria-label="Design brief" readOnly value={brief} rows={12}/><button onClick={() => void copy()}>Copy design brief</button></details>}
      </aside>
    </div>
    <a className="inspiration-mobile-board" href="#book-design-direction">Your direction · {count} selected ↓</a>
    <footer className="inspiration-source-note">A curated starting collection. Preview availability depends on the source. Each book is labeled by its actual edition and role; art references and retellings are distinct from scripture.</footer>
    {detail && <dialog ref={dialog} className="inspiration-dialog" onCancel={() => setDetail(null)}>
      <header><div><span>{detail.publisher}</span><h2>{detail.title}</h2></div><button aria-label="Close book details" onClick={() => setDetail(null)}>×</button></header>
      <div className="inspiration-detail-grid"><section className="inspiration-preview-pane" aria-label="Original book previews"><ReferenceImage key={detail.images[sample].url} image={detail.images[sample]} title={detail.title}/><div className="inspiration-preview-controls"><button disabled={!sample} onClick={() => setSample(index => index - 1)}>← Previous</button><span>{sample + 1} / {detail.images.length} · {detail.images[sample].kind}</span><button disabled={sample === detail.images.length - 1} onClick={() => setSample(index => index + 1)}>Next →</button></div><p>{detail.images[sample].label}</p><a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer">View original publisher / library page ↗</a></section>
      <section className="inspiration-detail-copy"><p className="inspiration-creators">{detail.creators}</p><p>{detail.edition}</p><p>{detail.description}</p><p className="inspiration-evidence">{detail.evidence}</p><h3>What would you like to carry forward?</h3><p>Our suggested interpretation for your book—not the original production specifications.</p>
        <div className="inspiration-aspect-options">{inspirationAspects.map(aspect => <label key={aspect}><input type="checkbox" checked={draft.references[aspect] === detail.id} onChange={event => { const checked = event.target.checked; setDraft(current => { const references = { ...current.references }; if (checked) references[aspect] = detail.id; else delete references[aspect]; return { ...current, references }; }); setMessage(""); }}/><span><strong>{aspect}</strong><small>{detail.direction[aspect]}</small></span></label>)}</div>
        <button className="inspiration-save" onClick={() => setDetail(null)}>Done choosing</button><p className="inspiration-rights">{detail.rights}</p></section></div>
    </dialog>}
  </main>;
}
