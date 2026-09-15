'use client';
import { useEffect, useState } from 'react';
import AccountPanel from './account-panel';
import { cloudRequest, downloadDraft, storage, type CloudBook, type Draft } from '../../lib/template-storage';
import { templates } from '../../lib/template-book';
import { templateLibrary } from '../../lib/template-library';

function SavedCover({ draft }: { draft: Draft | CloudBook }) {
  const template = templates.find(item => item.id === draft.templateId);
  const [image, setImage] = useState('');
  const firstImage = draft.book?.pages.find(page => draft.images[page.image]);
  const asset = firstImage ? draft.images[firstImage.image] : undefined;
  useEffect(() => {
    if (!(asset instanceof Blob)) return;
    const url = URL.createObjectURL(asset);
    let active = true;
    queueMicrotask(() => { if (active) setImage(url); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [asset]);
  return <div className="saved-template-cover" style={{ background: template?.paper, color: template?.ink }}>
    <span>{template?.name || 'Template book'}</span>
    <strong>{draft.title}</strong>
    {image && <img src={image} alt=""/>}
    <small>IKS BOOK STUDIO</small>
  </div>;
}

export default function SavedTemplateLibrary() {
  const [email, setEmail] = useState<string | null>(null);
  const [local, setLocal] = useState<Draft[]>([]);
  const [cloud, setCloud] = useState<{ email: string; books: CloudBook[] }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');
  const [deleting, setDeleting] = useState('');
  const [removeCloud, setRemoveCloud] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => storage('read').then(books => { if (active) setLocal(books); }).catch(() => { if (active) setError('Your browser library could not be loaded. Reload to try again.'); }).finally(() => { if (active) setLoading(false); });
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    let active = true;
    if (email) void cloudRequest('/api/library/books').then(response => response.json()).then(data => { if (active) setCloud({ email, books: data.books }); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [email]);
  const cloudBooks = cloud?.email === email ? cloud.books : [];
  const books = templateLibrary(local, cloudBooks);
  async function openCloud(book: CloudBook) {
    if (!email) return;
    setOpening(book.id); setError('');
    try {
      const restored = await downloadDraft(book, email);
      // A local draft always wins. Never overwrite work saved in another tab.
      const current = await storage('read');
      if (!current.some(draft => draft.id === book.id)) await storage('write', restored);
      window.location.assign(`/template-studio?book=${encodeURIComponent(book.id)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this book.'); setOpening(''); }
  }
  async function deleteBook(draft: Draft | CloudBook, inBrowser: boolean) {
    setOpening(draft.id); setError(''); setNotice('');
    try {
      const accountBook = cloudBooks.find(book => book.id === draft.id);
      if ((!inBrowser || removeCloud) && accountBook) {
        await cloudRequest(`/api/library/books?id=${encodeURIComponent(draft.id)}&revision=${accountBook.revision}`, { method: 'DELETE' });
        setCloud(current => current ? { ...current, books: current.books.filter(book => book.id !== draft.id) } : current);
      }
      if (inBrowser) {
        await storage('delete', draft as Draft);
        setLocal(current => current.filter(book => book.id !== draft.id));
      }
      setDeleting(''); setNotice(`“${draft.title}” deleted.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete this book.'); }
    finally { setOpening(''); }
  }
  return <div className="saved-template-library">
    <AccountPanel onSession={setEmail} reloadOnChange/>
    <div className="saved-library-heading"><h3>Your template books</h3><span>{loading ? 'Loading…' : `${books.length} ${books.length === 1 ? 'book' : 'books'}`}</span></div>
    {error && <p className="saved-library-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="saved-template-grid">
      <a className="saved-template-new" href="/template-studio"><span aria-hidden="true">＋</span><strong>Create from a template</strong><p>A new design. Your next book.</p><span className="saved-new-arrow" aria-hidden="true">→</span></a>
      {books.map(({ draft, local: inBrowser }) => <article className="saved-template-card" key={draft.id}>
        <button className="saved-delete-button" disabled={!!opening} aria-label={`Delete ${draft.title}`} onClick={() => { setDeleting(draft.id); setRemoveCloud(false); }}>Delete</button>
        {deleting === draft.id && <div className="saved-delete-confirm" role="group" aria-label={`Confirm deletion of ${draft.title}`}><strong>Delete “{draft.title}”?</strong><p>{inBrowser ? 'This removes the saved book from this browser.' : 'This removes the saved book from your account.'} This cannot be undone. Other browser copies and downloaded files are kept.</p>{inBrowser && cloudBooks.some(book => book.id === draft.id) && <label><input type="checkbox" checked={removeCloud} onChange={event => setRemoveCloud(event.target.checked)} disabled={!!opening}/> Also delete the account copy</label>}<div><button disabled={!!opening} onClick={() => void deleteBook(draft, inBrowser)}>{opening === draft.id ? 'Deleting…' : 'Delete book'}</button><button disabled={!!opening} onClick={() => setDeleting('')}>Cancel</button></div></div>}
        <SavedCover draft={draft}/>
        <div className="saved-template-details"><span className="saved-location">{inBrowser ? 'Saved in this browser' : 'Saved to your account'}</span><h4>{draft.title}</h4><p>{templates.find(template => template.id === draft.templateId)?.name}{draft.book ? ` · ${draft.book.pages.length} spreads` : ' · Source & prompt'}</p><footer><time dateTime={new Date(draft.updated).toISOString()}>{new Date(draft.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>{inBrowser ? <a href={`/template-studio?book=${encodeURIComponent(draft.id)}`}>Continue book <span aria-hidden="true">→</span></a> : <button disabled={!!opening} onClick={() => void openCloud(draft as CloudBook)}>{opening === draft.id ? 'Opening…' : 'Open book →'}</button>}</footer></div>
      </article>)}
    </div>
    {!loading && !books.length && <p className="saved-library-empty">Your saved template books will appear here automatically. Sign in to see books saved to your account.</p>}
  </div>;
}
