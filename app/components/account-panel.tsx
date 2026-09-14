'use client';
import { useEffect, useState } from 'react';
import { cloudRequest } from '../../lib/template-storage';
export default function AccountPanel({ onSession, reloadOnChange = false }: { onSession?: (email: string | null) => void; reloadOnChange?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [configured, setConfigured] = useState(true);
  useEffect(() => { let active = true; void cloudRequest('/api/account/session').then(r => r.json()).then(data => { if (active) { setEmail(data.email); setConfigured(data.configured); onSession?.(data.email); } }).catch(() => { if (active) setMessage('Cloud connection unavailable. Browser saving is still available.'); }); return () => { active = false; }; }, [onSession]);
  async function action(path: string, data = {}) {
    setBusy(true); setMessage('');
    try {
      let browserOwner = localStorage.getItem('iks-book-studio-owner');
      if (!browserOwner) { browserOwner = crypto.randomUUID(); localStorage.setItem('iks-book-studio-owner', browserOwner); }
      const response = await cloudRequest('/api/account/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, browserOwner }) });
      const result = await response.json();
      if (path === 'request') { setSent(true); setMessage('Check your email for an eight-digit code. It expires in 10 minutes.'); }
      if (path === 'verify' || path === 'logout') { setEmail(result.email || null); onSession?.(result.email || null); setSent(false); setCode(''); if (reloadOnChange) window.location.reload(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in failed. Try again.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Book account" style={{ padding: '16px', margin: '16px 0', border: '1px solid #cbd1c8', borderRadius: '8px' }}>
    {email ? <><strong>Signed in as {email}</strong> <button disabled={busy} onClick={() => void action('logout')}>Sign out</button></> : <details><summary>Sign in to save books across browsers</summary><p>Sign in first in the browser containing your existing books, then use the same email in other browsers. In the template studio, open each existing book and choose Save book to account.</p>{!configured && <p>Email sign-in is awaiting setup by the site owner. You can still save books in this browser.</p>}<form onSubmit={event => { event.preventDefault(); void action(sent ? 'verify' : 'request', { email: address, code }); }} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}><label>Email <input type="email" autoComplete="email" required maxLength={254} disabled={busy || sent} value={address} onChange={event => setAddress(event.target.value)}/></label>{sent && <label>Email code <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={event => setCode(event.target.value)}/></label>}<button disabled={busy || !configured}>{busy ? 'Please wait…' : sent ? 'Sign in' : 'Send sign-in code'}</button>{sent && <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); if (reloadOnChange) window.location.reload(); }}>Use another email or request a new code</button>}</form></details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
