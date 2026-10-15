'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './catalogue-handoff.css';
import { catalogueStorage } from '../../lib/iks-catalogue-storage';
import { selectedCategoryGroups } from '../../lib/catalogue-source';
import type { CatalogueBook } from '../../lib/iks-catalogue';

type Props = { onPrepare: (category: string, books: CatalogueBook[], audience: string, progress: (message: string) => void) => Promise<void>; onClose: () => void };
export default function CatalogueHandoff({ onPrepare, onClose }: Props) {
  const [groups, setGroups] = useState<ReturnType<typeof selectedCategoryGroups>>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const [audience, setAudience] = useState('Ages 10–12');
  useEffect(() => { catalogueStorage().then(saved => { if (saved) setGroups(selectedCategoryGroups(saved.books, saved.selected)); }).catch(() => setError('Could not open the catalogue selection. Return to the catalogue and try again.')).finally(() => setLoading(false)); }, []);
  async function prepare(category: string, books: CatalogueBook[]) {
    setBusy(true); setError('');
    try { await onPrepare(category, books, audience, setMessage); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare sources. Please retry.'); }
    finally { setBusy(false); setMessage(''); }
  }
  return <main className="dashboard catalogue-handoff"><header><h1>Selected sources → kids’ content</h1><button disabled={busy} onClick={onClose}>Back to Book Studio</button></header><section className="form-card">
    <p>Create a project for each category. Books in that category become one source PDF, with original page ranges recorded. Review the source outline, use OCR if needed, then create and edit your kids’ content. Prepare up to 200 MB or 2,500 pages per project.</p>
    <label>Reader age<select disabled={busy} value={audience} onChange={e => setAudience(e.target.value)}>{['Ages 7–9','Ages 10–12','Ages 13–15'].map(age => <option key={age}>{age}</option>)}</select></label>
    {!busy && <Link href="/catalogue">Change selected books</Link>}
    <p role="status">{loading ? 'Loading selected books…' : message}</p>{error && <p role="alert">{error}</p>}
    {!loading && !groups.length && <p>No books selected. Select books in the catalogue first.</p>}
    {groups.map(group => <section className="form-card" key={group.category}><h2>{group.category}</h2><ul>{group.books.map(book => <li key={book.id}>{book.title} ({book.year}) · {book.pdf ? 'Saved PDF' : 'Archive PDF'}</li>)}</ul><button className="primary" disabled={busy} onClick={() => void prepare(group.category, group.books)}>Prepare {group.books.length} PDF{group.books.length === 1 ? '' : 's'} for this category</button></section>)}
  </section></main>;
}
