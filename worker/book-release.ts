import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { BACKUP_LIMIT, backupKeys, digest, restoredEdition, type BackupManifest } from '../lib/book-backup';
import { bookExportIssues } from '../lib/book-export';
import type { Edition } from '../lib/devotional-edition';

import type { Env } from './index';
type Bindings=Pick<Env,'DB'|'BUCKET'>;
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function bookReleaseApi(request:Request,env:Bindings,owner:string):Promise<Response>{
 const url=new URL(request.url);
 try{
  const ownerHash=await digest(strToU8(owner));
  if(url.pathname.endsWith('/restore')){
   if(request.method!=='POST')return json({error:'Use POST to restore a backup.'},405);
   // Stream-bound input before decompression. A receipt authenticates archives issued by this installation.
   const reader=request.body?.getReader();if(!reader)throw new Error('Choose a backup ZIP.');
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>BACKUP_LIMIT+2*1024*1024){await reader.cancel();throw new Error('Backup exceeds 42 MB.');}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
   const checksum=await digest(bytes),receipt=await env.BUCKET.get(`edition-backup-receipts/${ownerHash}/${checksum}`);
   if(!receipt)return json({error:'This backup was not issued to this browser owner by this installation, or its bytes changed. Restore the original unmodified ZIP using the original browser identity.'},422);
   const files=unzipSync(bytes),manifest=JSON.parse(strFromU8(files['manifest.json'])) as BackupManifest;
   if(manifest.format!=='iks-edition-backup'||manifest.version!==1)throw new Error('Unsupported backup format.');
   for(const asset of manifest.assets){const data=files[asset.path];if(!data||data.length!==asset.size||await digest(data)!==asset.sha256)throw new Error('Asset checksum mismatch.');}
   const id=crypto.randomUUID(),mapping=new Map(manifest.assets.map((asset,i)=>[asset.key,manifest.project.edition.sources.some(s=>s.key===asset.key)?`sources/${owner}/${id}/${i}`:`edition-restored/${id}/${i}`]));
   const written:string[]=[];
   try{
    for(const asset of manifest.assets){const key=mapping.get(asset.key)!;await env.BUCKET.put(key,files[asset.path],{httpMetadata:{contentType:asset.mime},customMetadata:{owner,originalName:asset.key.split('/').at(-1)||'source'}});written.push(key);}
    const edition=restoredEdition(manifest.project.edition,mapping),title=manifest.project.title+' — restored';
    const project={id,title,source:manifest.project.source,chapters:[],edition,updatedAt:'Just now',restoredFrom:{revision:manifest.revision,createdAt:manifest.createdAt,checksum}};
    const now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO book_projects (id, owner_key, title, source_name, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id,owner,title,project.source,JSON.stringify(project),now,now).run();
    return json({project},201);
   }catch(error){await Promise.all(written.map(key=>env.BUCKET.delete(key)));throw error;}
  }
  if(request.method!=='GET')return json({error:'Use GET to download an edition snapshot.'},405);
  const row=await env.DB.prepare('SELECT data_json FROM book_projects WHERE id = ? AND owner_key = ?').bind(url.searchParams.get('projectId'),owner).first<{data_json:string}>();
  if(!row)return json({error:'Edition not found.'},404);
  const project=JSON.parse(row.data_json) as {title:string;source:string;edition?:Edition};
  if(!project.edition)throw new Error('Choose a devotional edition.');
  if(String(project.edition.revision)!==url.searchParams.get('revision'))return json({error:'The edition changed. Reload before exporting.'},409);
  if(url.pathname.endsWith('/release-snapshot')){
   const final=url.searchParams.get('final')==='true',issues=bookExportIssues(project.edition,final);
   if(issues.length)return json({error:issues.join('\n'),issues},422);
   return json({edition:project.edition,final});
  }
  const manifest:BackupManifest={format:'iks-edition-backup',version:1,revision:project.edition.revision,createdAt:new Date().toISOString(),project:{title:project.title,source:project.source,edition:project.edition},assets:[]};
  const files:Record<string,Uint8Array>={};let total=0;
  for(const [index,key] of backupKeys(project.edition).entries()){
   const object=await env.BUCKET.get(key);if(!object||(object.customMetadata?.owner!==owner&&!(project.edition.sources.some(s=>s.key===key)&&key.startsWith(`sources/${owner}/`))))throw new Error('A registered asset is missing or unavailable. Backup cancelled.');
   total+=object.size;if(total>BACKUP_LIMIT)throw new Error('Backup assets exceed 40 MB.');
   const data=new Uint8Array(await object.arrayBuffer()),path=`assets/${index}`;files[path]=data;
   manifest.assets.push({key,path,mime:object.httpMetadata?.contentType||'application/octet-stream',sha256:await digest(data),size:data.length});
  }
  files['manifest.json']=strToU8(JSON.stringify(manifest));
  if(files['manifest.json'].length>2*1024*1024)throw new Error('Edition metadata exceeds 2 MB.');
  files['README.txt']=strToU8('IKS edition backup. Restore the unmodified ZIP on the same installation and browser identity. The server receipt authenticates the archive; retain the R2 bucket with infrastructure backups. No inspiration previews are packaged. Review evidence becomes stale after restoration. Covers, composition data and all registered asset versions are retained.');
  const bytes=zipSync(files,{level:0});if(bytes.length>BACKUP_LIMIT+2*1024*1024)throw new Error('Backup exceeds 42 MB.');
  const checksum=await digest(bytes);await env.BUCKET.put(`edition-backup-receipts/${ownerHash}/${checksum}`,strToU8(JSON.stringify({createdAt:manifest.createdAt,revision:manifest.revision})),{customMetadata:{owner}});
  return new Response(bytes as unknown as BodyInit,{headers:{'content-type':'application/zip','cache-control':'no-store','content-disposition':`attachment; filename="edition-r${manifest.revision}-backup.zip"`,'x-backup-sha256':checksum}});
 }catch(error){return json({error:error instanceof Error?error.message:'Export failed.'},422);}
}
