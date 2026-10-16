import type {LibraryEnv} from './library.ts';
const digest=async(value:string|ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))).map(v=>v.toString(16).padStart(2,'0')).join('');
import {transition,type Queue} from '../lib/midnight-queue.ts';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
export const midnightSchema='CREATE TABLE IF NOT EXISTS midnight_queues (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)';
async function limited(request:Request,max:number){const reader=request.body?.getReader();if(!reader)throw Error('Missing request body.');const parts:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Request too large.');}parts.push(value);}const bytes=new Uint8Array(size);let p=0;for(const v of parts){bytes.set(v,p);p+=v.length;}return bytes;}
export async function midnightApi(request:Request,env:LibraryEnv){
 const url=new URL(request.url);const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return reply({error:'Use the connected Book Studio website.'},403);
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return reply({error:'Connect your Midnight Book Making workspace.'},401);
 await env.DB.prepare(midnightSchema).run();const owner=await digest(token);
 const row=await env.DB.prepare('SELECT revision,data FROM midnight_queues WHERE owner=?').bind(owner).first<{revision:number;data:string}>();if(!row)return reply({error:'This workspace connection is not registered.'},403);
 const q=JSON.parse(row.data) as Queue,prefix=`midnight/${owner}/`;
 if(url.pathname==='/api/midnight/asset'){
  const hash=url.searchParams.get('hash')||'';if(!/^[a-f0-9]{64}$/.test(hash))return reply({error:'Invalid file hash.'},400);
  if(request.method==='PUT'){const bytes=await limited(request,8*1024*1024);if(await digest(bytes.buffer)!==hash)return reply({error:'File integrity check failed.'},400);await env.BUCKET.put(prefix+hash,bytes.buffer,{httpMetadata:{contentType:'application/octet-stream'}});return reply({hash});}
  if(request.method==='GET'){const object=await env.BUCKET.get(prefix+hash);return object?new Response(object.body,{headers:{'content-type':'application/octet-stream','cache-control':'private, no-store','x-content-type-options':'nosniff'}}):reply({error:'File not found.'},404);}
  return reply({error:'Method not allowed.'},405);
 }
 if(url.pathname!=='/api/midnight')return reply({error:'Not found.'},404);
 if(request.method==='GET')return reply({revision:row.revision,queue:q});
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 try{
 const body=JSON.parse(new TextDecoder().decode(await limited(request,64*1024)));if(body.revision!==row.revision)return reply({error:'Queue changed. Refresh and retry.'},409);
 if(body.action?.type==='artifact'){let size=0;const a=body.action.artifact;if(!Array.isArray(a?.chunks)||a.chunks.length>128)return reply({error:'Invalid output chunks.'},400);for(const h of a.chunks){if(!/^[a-f0-9]{64}$/.test(h))return reply({error:'Invalid file hash.'},400);const head=await env.BUCKET.head(prefix+h);if(!head)return reply({error:'Output upload incomplete.'},400);size+=head.size;}if(size!==a.size)return reply({error:'Output size does not match uploaded files.'},400);}
 const next=transition(q,body.action);const r=await env.DB.prepare('UPDATE midnight_queues SET revision=?,data=? WHERE owner=? AND revision=?').bind(row.revision+1,JSON.stringify(next),owner,row.revision).run();if(!r.meta.changes)return reply({error:'Queue changed. Refresh and retry.'},409);return reply({revision:row.revision+1,queue:next});
 }catch(e){return reply({error:e instanceof Error?e.message:'Invalid request.'},400);}
}
