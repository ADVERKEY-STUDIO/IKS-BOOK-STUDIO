'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onIdTokenChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, type User } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { cloudRequest } from '../../lib/template-storage';
export type FirebaseConfig = { apiKey: string; projectId: string; authDomain: string };
export default function FirebaseAccountPanel({ config, onSession, reloadOnChange = false }: { config: FirebaseConfig; onSession?: (email: string | null) => void; reloadOnChange?: boolean }) {
  const [auth] = useState(() => getAuth(getApps().find(app => app.name === 'book-library') || initializeApp(config, 'book-library')));
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'closed' | 'signin' | 'signup'>('closed');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const callbacks = useRef({ onSession, reloadOnChange });
  useEffect(() => { callbacks.current = { onSession, reloadOnChange }; }, [onSession, reloadOnChange]);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = onIdTokenChanged(auth, async current => {
      const run = ++generation;
      setUser(current); setReady(true);
      try {
        if (!current?.emailVerified) {
          await cloudRequest('/api/account/firebase-session', { method: 'DELETE' });
          if (active && run === generation) callbacks.current.onSession?.(null);
          return;
        }
        const before = await (await cloudRequest('/api/account/session')).json();
        await cloudRequest('/api/account/firebase-session', { method: 'POST', headers: { authorization: `Bearer ${await current.getIdToken()}` } });
        if (!active || run !== generation) return;
        let browserOwner = localStorage.getItem('iks-book-studio-owner');
        if (!browserOwner) { browserOwner = crypto.randomUUID(); localStorage.setItem('iks-book-studio-owner', browserOwner); }
        const response = await cloudRequest('/api/account/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ browserOwner }) });
        const data = await response.json();
        if (!active || run !== generation) return;
        callbacks.current.onSession?.(data.email);
        setMessage('Your library is connected.'); setMode('closed'); setPassword('');
        if (callbacks.current.reloadOnChange && (data.linked || before.email !== data.email)) window.location.reload();
      } catch (error) { if (active && run === generation) { callbacks.current.onSession?.(null); setMessage(error instanceof Error ? error.message : 'Could not connect your library.'); } }
    });
    const timer = window.setInterval(() => { void auth.currentUser?.getIdToken().catch(() => {}); }, 60_000);
    return () => { active = false; ++generation; unsubscribe(); window.clearInterval(timer); };
  }, [auth]);
  async function action(work: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled.' : code === 'auth/invalid-credential' ? 'Email or password is incorrect.' : code === 'auth/too-many-requests' ? 'Too many attempts. Please try again later.' : code === 'auth/email-already-in-use' ? 'This email already has an account. Sign in or reset your password.' : error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
    } finally { setBusy(false); }
  }
  return <section className={`book-account account-card ${user ? "account-signed-in" : "account-signed-out"}`} aria-label="Book account" aria-busy={busy}>
    <div className="account-intro"><span className="account-monogram" aria-hidden="true">{user ? (user.displayName || user.email || 'B').charAt(0).toUpperCase() : 'B'}</span><div><span className="account-eyebrow">YOUR BOOK LIBRARY</span><strong>{!ready ? 'Getting your library ready' : user ? 'You’re signed in' : 'Keep your books close.'}</strong><p>{user ? user.emailVerified ? 'Open your account books from any browser.' : 'Verify your email to enable account saving.' : 'Sign in to save books to your account and pick up where you left off.'}</p>{user && <span className="account-email">{user.email}</span>}</div></div>
    {!ready ? <p>Loading account…</p> : user ? <div className="book-account-actions account-session-actions">
      {!user.emailVerified && <><span>Verify your email to connect your library.</span><button disabled={busy} onClick={() => action(async () => { await sendEmailVerification(user); setMessage('Verification email sent. Check your inbox.'); })}>Send verification email</button><button disabled={busy} onClick={() => action(async () => { await user.reload(); await user.getIdToken(true); })}>I verified my email</button></>}
      <button disabled={busy} onClick={() => action(async () => { await cloudRequest('/api/account/firebase-session', { method: 'DELETE' }); await signOut(auth); callbacks.current.onSession?.(null); if (reloadOnChange) window.location.reload(); })}>Sign out</button>
    </div> : <div className="book-account-actions"><button className="account-google" disabled={busy} onClick={() => action(() => signInWithPopup(auth, new GoogleAuthProvider()))}>Continue with Google</button><button className="account-email-button" disabled={busy} aria-expanded={mode === 'signin'} onClick={() => setMode('signin')}>Sign in with email</button><button className="account-create" disabled={busy} aria-expanded={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button></div>}
    {!user && mode !== 'closed' && <form className="book-account-form" onSubmit={event => { event.preventDefault(); void action(async () => {
      if (mode === 'signup') { const result = await createUserWithEmailAndPassword(auth, email, password); await sendEmailVerification(result.user); setMessage('Check your inbox to verify your email before saving to your account.'); }
      else await signInWithEmailAndPassword(auth, email, password);
    }); }}><div className="account-form-heading"><h3>{mode === 'signup' ? 'Create your library account' : 'Welcome back'}</h3><p>{mode === 'signup' ? 'Your books, all in one place.' : 'Sign in with the email you used to save your books.'}</p></div><label>Email address<input placeholder="you@example.com" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)}/></label><button className="account-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button><button className="account-text-action" type="button" disabled={busy || !email} onClick={() => action(async () => { await sendPasswordResetEmail(auth, email); setMessage('If this email has an account, check your inbox for password reset instructions.'); })}>Forgot password?</button><button className="account-text-action" type="button" disabled={busy} onClick={() => { setMode('closed'); setPassword(''); }}>Cancel</button></form>}
    {message && <p className="account-feedback" role="status">{message}</p>}
  </section>;
}
