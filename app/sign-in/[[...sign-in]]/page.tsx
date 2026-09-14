import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <SignIn /> : <p>Sign-in is awaiting configuration. Return to Book Studio to continue with your browser books.</p>}
    </div>
  );
}
