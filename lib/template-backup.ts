import {cloudRequest,downloadDraft,uploadDraft,type CloudBook,type Draft} from './template-storage.ts';

/** Serialize uploads, including manual saves, without reusing one account's revisions in another. */
export function accountSaveQueue(upload=uploadDraft){
 let queue=Promise.resolve();
 const versions=new Map<string,NonNullable<Draft['cloud']>>();
 return (draft:Draft,email:string)=>{
  const task=queue.catch(()=>{}).then(async()=>{
   const key=email+'\n'+draft.id,known=versions.get(key);
   const own=draft.cloud?.email===email?draft.cloud:undefined;
   const cloud=known&&known.revision>(own?.revision||0)?known:own;
   const saved=await upload({...draft,cloud},email);
   if(saved.cloud)versions.set(key,saved.cloud);
   return saved;
  });
  queue=task.then(()=>{},()=>{});
  return task;
 };
}

const readableBlobs=new WeakMap<Blob,Promise<boolean>>();
/** Restore only absent/unreadable images; never replace local words or readable edits. */
export async function recoverDraftImages(draft:Draft,account:CloudBook,email:string):Promise<Draft>{
 if(draft.id!==account.id || (draft.cloud && draft.cloud.email!==email))return draft;
 const missing:string[]=[];
 for(const name of Object.keys(account.images)){
  const blob=draft.images[name];
  if(!(blob instanceof Blob)||!blob.size){missing.push(name);continue;}
  let readable=readableBlobs.get(blob);
  if(!readable){readable=blob.arrayBuffer().then(()=>true,()=>false);readableBlobs.set(blob,readable);}
  if(!await readable)missing.push(name);
 }
 if(!missing.length)return draft;
 // downloadDraft performs content hash verification before anything is persisted.
 const images=Object.fromEntries(missing.map(name=>[name,account.images[name]]));
 const recovered=await downloadDraft({...account,images,source:undefined,references:{}},email);
 return {...draft,images:{...draft.images,...recovered.images}};
}

export async function recoverAccountImages(draft:Draft,email:string){
 const {books}=await(await cloudRequest('/api/library/books')).json() as {books:CloudBook[]};
 const account=books.find(book=>book.id===draft.id);
 return account?recoverDraftImages(draft,account,email):draft;
}
