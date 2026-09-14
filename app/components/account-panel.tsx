'use client';
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { cloudRequest } from '../../lib/template-storage';
type AccountProps = { onSession?: (email: string | null) => void; reloadOnChange?: boolean };
export default function AccountPanel(props: AccountProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <section className="book-account" aria-label="Book account"><p>Cloud sign-in is awaiting configuration. Your browser books and local saving remain available.</p></section>;
  return <ClerkAccountPanel {...props}/>;
}
function ClerkAccountPanel({ onSession, reloadOnChange = false }: AccountProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [message, setMessage] = useState('');
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const currentId = user?.id || null;
    const changed = previousUser.current !== undefined && previousUser.current !== currentId;
    previousUser.current = currentId;
    if (!isSignedIn) {
      onSession?.(null);
      if (changed && reloadOnChange) window.location.reload();
      return;
    }
    void (async () => {
      let browserOwner = localStorage.getItem('iks-book-studio-owner');
      if (!browserOwner) { browserOwner = crypto.randomUUID(); localStorage.setItem('iks-book-studio-owner', browserOwner); }
      const response = await cloudRequest('/api/account/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ browserOwner }) });
      const data = await response.json();
      if (!active) return;
      onSession?.(data.email);
      setMessage('Your library is connected.');
      if (reloadOnChange && (changed || data.linked)) window.location.reload();
    })().catch(error => { if (active) { onSession?.(null); setMessage(error instanceof Error ? error.message : 'Could not connect your library.'); } });
    return () => { active = false; };
  }, [isLoaded, isSignedIn, user?.id, onSession, reloadOnChange]);
  return <section aria-label="Book account" className="book-account">
    <div><strong>Your book library</strong><p>Sign in with the same account in each browser to open your saved books.</p></div>
    <div className="book-account-actions">
      <Show when="signed-out"><SignInButton mode="modal"><button>Sign in</button></SignInButton><SignUpButton mode="modal"><button>Create account</button></SignUpButton></Show>
      <Show when="signed-in"><span>{user?.primaryEmailAddress?.emailAddress}</span><UserButton/></Show>
      {!isLoaded && <span>Loading account…</span>}
    </div>
    {message && isSignedIn && <p role="status">{message}</p>}
  </section>;
}
