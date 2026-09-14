import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <SignUp /> : <p>Sign-in is awaiting configuration. Return to Book Studio to continue with your browser books.</p>}
    </div>
  );
}
