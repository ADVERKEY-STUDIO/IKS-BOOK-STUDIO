#!/usr/bin/env node
/** Local workspace bridge. Connection secret is a site capability, never a model API key. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const root=resolve(process.env.MIDNIGHT_WORKSPACE||'/Users/gaurav/Documents/Codex/2026-10-16/midnight-book-making');
const config=JSON.parse(await readFile(join(root,'.midnight-connection.json'),'utf8'));
const statePath=join(root,'work','website-lease.json');await mkdir(join(root,'work'),{recursive:true});
async function api(path='',options={}){const response=await fetch(config.site+'/api/midnight'+path,{...options,headers:{authorization:`Bearer ${config.token}`,...options.headers}});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||`Queue returned ${response.status}`);}return response;}
async function get(){return (await api()).json();}
async function change(action){const s=await get();return (await api('',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:s.revision,action})})).json();}
async function atomic(path,data){await writeFile(path+'.tmp',JSON.stringify(data,null,2));await rename(path+'.tmp',path);}
async function lease(){const l=JSON.parse(await readFile(statePath,'utf8'));return {jobId:l.jobId,leaseId:l.id};}
const [command,...args]=process.argv.slice(2);
try{
 if(command==='status'){const s=await get();await atomic(join(root,'outputs','website-queue.json'),s);console.log(JSON.stringify(s,null,2));}
 else if(command==='claim'){
  const s=await change({type:'claim',leaseId:randomUUID()});await atomic(statePath,s.queue.lease);await atomic(join(root,'outputs','website-queue.json'),s);console.log(JSON.stringify({job:s.queue.jobs.find(j=>j.id===s.queue.lease.jobId),leaseUntil:s.queue.lease.until}));
 }else if(command==='update'||command==='release'||command==='renew'){
  const fields=args[0]?JSON.parse(await readFile(resolve(args[0]),'utf8')):{};
  const s=await change({...fields,...await lease(),type:command==='update'?'progress':command});await atomic(join(root,'outputs','website-queue.json'),s);console.log('Queue saved.');
 }else if(command==='connect'){
  const s=await change({type:'connect',automationId:args[0]});await atomic(join(root,'outputs','website-queue.json'),s);console.log('Schedule registered.');
 }else if(command==='publish'){
  const [file,kind]=args;if(!['checkpoint','pdf','editable','review'].includes(kind))throw Error('Use checkpoint, pdf, editable or review.');
  const path=resolve(file);if(!path.startsWith(root+'/outputs/'))throw Error('Publish only files inside this workspace outputs directory.');
  const bytes=await readFile(path);if(bytes.length>512*1024*1024||bytes.length===0)throw Error('Output must be between 1 byte and 512 MB.');
  const name=path.split('/').pop();if(!/^[\w.-]{1,140}$/.test(name))throw Error('Use a simple output filename.');
  const chunks=[];for(let offset=0;offset<bytes.length;offset+=8*1024*1024){const b=bytes.subarray(offset,offset+8*1024*1024),hash=createHash('sha256').update(b).digest('hex');await api('/asset?hash='+hash,{method:'PUT',body:b});chunks.push(hash);}
  const s=await change({type:'artifact',...await lease(),artifact:{name,kind,chunks,size:bytes.length}});await atomic(join(root,'outputs','website-queue.json'),s);console.log(`Published ${name} (${bytes.length} bytes).`);
 }else throw Error('Usage: midnight-client.mjs status | claim | update <fields.json> | release <fields.json> | renew | publish <file> <kind> | connect <automation-id>');
}catch(e){console.error(e.message);process.exitCode=1;}
