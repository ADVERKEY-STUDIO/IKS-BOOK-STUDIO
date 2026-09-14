import { createRemoteJWKSet, jwtVerify } from 'jose';

export type FirebaseEnvironment = { FIREBASE_PROJECT_ID?: string; FIREBASE_API_KEY?: string };
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export function firebaseConfigured(env: FirebaseEnvironment) {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY);
}
export async function verifyFirebaseIdentity(request: Request, env: FirebaseEnvironment) {
  if (!firebaseConfigured(env)) return null;
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || request.headers.get('cookie')?.match(/(?:^|;\s*)iks_session=([^;]+)/)?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keys, { algorithms: ['RS256'], audience: env.FIREBASE_PROJECT_ID, issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` });
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || payload.sub.length > 128 || typeof payload.iat !== 'number' || payload.iat > now || typeof payload.auth_time !== 'number' || payload.auth_time > now || payload.email_verified !== true) return null;
    // Check the current account too: disabled/deleted users and revoked sessions
    // must not retain library access merely because their JWT has not expired.
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY!)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
    if (!response.ok) return null;
    const data = await response.json() as { users?: { localId: string; email?: string; emailVerified?: boolean; disabled?: boolean; validSince?: string }[] };
    const user = data.users?.[0];
    if (!user || user.localId !== payload.sub || !user.emailVerified || user.disabled || !user.email || Number(user.validSince || 0) > payload.auth_time) return null;
    return { userId: `firebase:${env.FIREBASE_PROJECT_ID}:${user.localId}`, email: user.email.trim().toLowerCase() };
  } catch { return null; }
}
