import { createClerkClient } from '@clerk/backend';
export type ClerkIdentity = { userId: string; email: string };
export type ClerkEnvironment = { CLERK_SECRET_KEY?: string; NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string };
export function clerkConfigured(env: ClerkEnvironment) { return Boolean((env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY) && (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)); }
export async function verifyClerkIdentity(request: Request, env: ClerkEnvironment): Promise<ClerkIdentity | null> {
  if (!clerkConfigured(env)) return null;
  const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY, publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
  const state = await client.authenticateRequest(request, { authorizedParties: [new URL(request.url).origin], acceptsToken: 'session_token' });
  if (!state.isAuthenticated) return null;
  const auth = state.toAuth();
  if (!auth?.userId) return null;
  const user = await client.users.getUser(auth.userId);
  const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId && address.verification?.status === 'verified');
  if (!primary) return null;
  return { userId: user.id, email: primary.emailAddress.trim().toLowerCase() };
}
