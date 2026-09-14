import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { verifyFirebaseIdentity } from '../worker/firebase-identity.ts';

test('Firebase rejects forged, expired, wrong-project, unverified and revoked identities', async () => {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(pair.publicKey), kid: 'firebase-test', alg: 'RS256' };
  const now = Math.floor(Date.now() / 1000);
  const env = { FIREBASE_PROJECT_ID: 'library-test', FIREBASE_API_KEY: 'fixture-only' };
  let disabled = false, verified = true, validSince = now - 10;
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/service_accounts/')) return Response.json({ keys: [jwk] });
    if (url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?')) return Response.json({ users: [{ localId: 'reader', email: 'reader@example.com', emailVerified: verified, disabled, validSince: String(validSince) }] });
    throw new Error('Unexpected network request');
  };
  const token = async (claims = {}) => new SignJWT({ auth_time: now - 5, email_verified: true, ...claims }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setSubject('reader').setIssuer('https://securetoken.google.com/library-test').setAudience('library-test').setIssuedAt(now).setExpirationTime(now + 120).sign(pair.privateKey);
  const request = value => new Request('https://studio.test/api/library/books', { headers: { authorization: 'Bearer ' + value } });
  try {
    const good = await token();
    assert.deepEqual(await verifyFirebaseIdentity(request(good), env), { userId: 'firebase:library-test:reader', email: 'reader@example.com' });
    assert.equal(await verifyFirebaseIdentity(request(good), { ...env, FIREBASE_PROJECT_ID: 'another-project' }), null);
    assert.equal(await verifyFirebaseIdentity(request(await token({ email_verified: false })), env), null);
    const parts = good.split('.'); parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker', email_verified: true })).toString('base64url');
    assert.equal(await verifyFirebaseIdentity(request(parts.join('.')), env), null);
    disabled = true; assert.equal(await verifyFirebaseIdentity(request(good), env), null); disabled = false;
    verified = false; assert.equal(await verifyFirebaseIdentity(request(good), env), null); verified = true;
    validSince = now; assert.equal(await verifyFirebaseIdentity(request(good), env), null);
    const expired = await new SignJWT({ auth_time: now - 100, email_verified: true }).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject('reader').setIssuer('https://securetoken.google.com/library-test').setAudience('library-test').setIssuedAt(now-100).setExpirationTime(now-1).sign(pair.privateKey);
    assert.equal(await verifyFirebaseIdentity(request(expired), env), null);
  } finally { globalThis.fetch = original; }
});
