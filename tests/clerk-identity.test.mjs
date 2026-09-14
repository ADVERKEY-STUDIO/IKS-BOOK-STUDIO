import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

test('real Clerk token validation rejects forged tokens, wrong origins, and unverified email',async()=>{
 const { privateKey, publicKey }=generateKeyPairSync('rsa',{modulusLength:2048});
 const key={...publicKey.export({format:'jwk'}),kid:'library-test-key',use:'sig',alg:'RS256'};
 const env={CLERK_SECRET_KEY:'sk_test_fixture',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from('fixture.clerk.accounts.dev$').toString('base64')};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const token=(azp='https://studio.test')=>{
  const now=Math.floor(Date.now()/1000);
  const unsigned=encode({alg:'RS256',typ:'JWT',kid:key.kid})+'.'+encode({iss:'https://fixture.clerk.accounts.dev',sub:'user_fixture',sid:'sess_fixture',azp,iat:now,nbf:now-5,exp:now+120,v:2,sts:'active'});
  return unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');
 };
 const original=globalThis.fetch; let verified=true;
 globalThis.fetch=async input=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url.includes('/jwks'))return Response.json({keys:[key]});
  if(url.includes('/users/user_fixture'))return Response.json({object:'user',id:'user_fixture',primary_email_address_id:'email_fixture',email_addresses:[{object:'email_address',id:'email_fixture',email_address:'reader@example.com',linked_to:[],verification:{status:verified?'verified':'unverified'}}]});
  throw new Error('Unexpected network request in auth test');
 };
 const { verifyClerkIdentity }=await import('../worker/clerk-identity.ts');
 const request=value=>new Request('https://studio.test/api/library/books',{headers:{authorization:'Bearer '+value}});
 try {
  assert.deepEqual(await verifyClerkIdentity(request(token()),env),{userId:'user_fixture',email:'reader@example.com'});
  assert.equal(await verifyClerkIdentity(request(token('https://attacker.test')),env),null);
  const valid=token();
  const parts=valid.split('.');parts[1]=encode({sub:'user_attacker',exp:Math.floor(Date.now()/1000)+120});
  assert.equal(await verifyClerkIdentity(request(parts.join('.')),env),null);
  verified=false;
  assert.equal(await verifyClerkIdentity(request(token()),env),null);
 } finally {globalThis.fetch=original;}
});
