import AccountPanel from '../../components/account-panel';
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (process.env.FIREBASE_PROJECT_ID || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <main style={{ maxWidth: 900, margin: '60px auto', padding: 24 }}><a href="/template-studio">← Book Studio</a><AccountPanel/></main>;
  return (
    <div className="flex min-h-screen items-center justify-center">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <SignIn /> : <p>Sign-in is awaiting configuration. Return to Book Studio to continue with your browser books.</p>}
    </div>
  );
}
