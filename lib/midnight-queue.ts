/** Durable, sequential queue. No model credentials or inference calls live here. */
export const editions = ['shiva','hanuman','ganesh','krishna','ram','vishnu','durga','lakshmi','saraswati','gayatri'] as const;
export type Edition = typeof editions[number];
export const stages = ['source_audit','manuscript','character_review','artwork','assembly','final_qa','packaging'] as const;
export type Job = {id:string;edition:Edition;title:string;age:string;template:'durga-v14';status:'queued'|'running'|'paused'|'blocked'|'complete';stage:string;detail:string;images:number;total:number|null;retryAt:number;updated:number;artifacts:Artifact[]};
export type Artifact = {name:string;kind:'checkpoint'|'pdf'|'editable'|'review';chunks:string[];size:number};
export type Queue = {version:1;enabled:boolean;runAnytime?:boolean;startHour:number;endHour:number;timezone:'Asia/Kolkata';jobs:Job[];lease:null|{jobId:string;id:string;until:number};runner:{threadId:string;lastSeen:number|null;automationId:string|null};events:{at:number;message:string}[]};
export function seedQueue():Queue{return {version:1,enabled:true,startHour:0,endHour:6,timezone:'Asia/Kolkata',lease:null,runner:{threadId:'01a1446e-d7c1-7351-9b82-9ffac7953824',lastSeen:null,automationId:null},events:[],jobs:editions.map(edition=>({id:edition,edition,title:`Shri ${edition[0].toUpperCase()+edition.slice(1)} Chalisa`,age:'9–14',template:'durga-v14',status:'queued',stage:'source_audit',detail:edition==='shiva'?'Existing draft artwork retained; source and manuscript review next.':'Waiting for earlier books.',images:0,total:null,retryAt:0,updated:Date.now(),artifacts:[]}))};}
export function inNight(q:Pick<Queue,'startHour'|'endHour'>,now=Date.now()){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).format(now));return q.startHour<q.endHour?hour>=q.startHour&&hour<q.endHour:hour>=q.startHour||hour<q.endHour;}
export function canRun(q:Queue,now=Date.now()){return q.enabled&&(q.runAnytime===true||inNight(q,now));}
function text(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid text.');return v.trim();}
export function transition(input:Queue,action:Record<string,any>,now=Date.now()):Queue {
 const q=structuredClone(input);const live=q.lease&&q.lease.until>now;
 const event=(message:string)=>{q.events=[{at:now,message},...q.events].slice(0,60);};
 const job=q.jobs.find(j=>j.id===action.jobId);
 if(action.type==='schedule'){if(!Number.isInteger(action.startHour)||!Number.isInteger(action.endHour)||action.startHour<0||action.startHour>23||action.endHour<0||action.endHour>23||action.startHour===action.endHour)throw Error('Choose different start and end hours.');q.startHour=action.startHour;q.endHour=action.endHour;event('Night window updated.');}
 else if(action.type==='run-mode'){if(typeof action.runAnytime!=='boolean')throw Error('Invalid run mode.');q.runAnytime=action.runAnytime;if(q.runAnytime)q.enabled=true;event(q.runAnytime?'Start now requested; run anytime until paused or returned to schedule.':'Returned to night schedule.');}
 else if(action.type==='enabled'){if(typeof action.enabled!=='boolean')throw Error('Invalid queue state.');q.enabled=action.enabled;event(q.enabled?'Queue resumed.':'Queue paused; current step will checkpoint.');}
 else if(action.type==='add'){if(!editions.includes(action.edition)||q.jobs.length>=40)throw Error('Choose a supported Chalisa.');if(q.jobs.some(j=>j.edition===action.edition&&j.status!=='complete'))throw Error('This Chalisa is already queued.');q.jobs.push({id:crypto.randomUUID(),edition:action.edition,title:text(action.title,120),age:text(action.age,40),template:'durga-v14',status:'queued',stage:'source_audit',detail:'Waiting for earlier books.',images:0,total:null,retryAt:0,updated:now,artifacts:[]});event('Book added to queue.');}
 else if(action.type==='move'){if(!job||job.status==='running'||job.status==='complete'||live)throw Error('Reorder only while no book is running.');const i=q.jobs.indexOf(job),to=i+(action.direction===-1?-1:1);if(to<0||to>=q.jobs.length||q.jobs[to].status==='complete')throw Error('Cannot move this book there.');[q.jobs[i],q.jobs[to]]=[q.jobs[to],q.jobs[i]];event('Queue order updated.');}
 else if(action.type==='job-state'){if(!job||job.status==='complete'||(live&&q.lease?.jobId===job.id))throw Error('Pause the queue and wait for the active step to finish first.');if(!['paused','queued'].includes(action.status))throw Error('Invalid job state.');job.status=action.status;job.retryAt=0;job.detail=action.status==='queued'?'Ready to resume from checkpoint.':'Paused by you.';event(`${job.title}: ${job.status}.`);}
 else if(action.type==='connect'){q.runner.automationId=text(action.automationId,150);event('Codex nightly continuation connected.');}
 else if(action.type==='claim'){
  q.runner.lastSeen=now;
  if(live)throw Error('Another run holds the lease.');
  if(!canRun(q,now))throw Error('Queue is paused or outside its night window.');
  const next=q.jobs.find(j=>j.status!=='complete');if(!next)throw Error('All books are complete.');
  if(next.status==='paused'||next.status==='blocked'||next.retryAt>now)throw Error('The first unfinished book is paused, blocked or waiting to retry.');
  q.lease={jobId:next.id,id:text(action.leaseId,100),until:now+90*60*1000};next.status='running';next.updated=now;event(`Working on ${next.title}.`);
 }
 else if(['progress','release','renew','artifact'].includes(action.type)){
  if(!live||q.lease?.id!==action.leaseId||!job||q.lease.jobId!==job.id)throw Error('Lease expired or owned by another run. Reload before continuing.');
  q.runner.lastSeen=now;job.updated=now;
  if(action.type==='artifact'){
   const a=action.artifact as Artifact;if(!a||!['checkpoint','pdf','editable','review'].includes(a.kind)||!/^[\w.-]{1,140}$/.test(a.name)||!Array.isArray(a.chunks)||!a.chunks.length||a.chunks.length>128||a.chunks.some(h=>!/^\w{64}$/.test(h)||!/^[a-f0-9]+$/.test(h))||!Number.isSafeInteger(a.size)||a.size<=0||a.size>512*1024*1024)throw Error('Invalid output artifact.');
   job.artifacts=[...job.artifacts.filter(x=>x.name!==a.name),a].slice(-40);event(`${job.title}: saved ${a.name}.`);
  }else if(action.type==='renew'){if(!canRun(q,now))throw Error('Checkpoint and release: outside enabled night window.');q.lease!.until=now+90*60*1000;}
  else{
   if(action.stage!==undefined){if(!stages.includes(action.stage))throw Error('Invalid production stage.');job.stage=action.stage;}
   if(action.detail!==undefined)job.detail=text(action.detail,1000);
   if(action.images!==undefined){if(!Number.isInteger(action.images)||action.images<job.images||action.images>100)throw Error('Invalid image count.');job.images=action.images;}
   if(action.total!==undefined){if(!Number.isInteger(action.total)||action.total<job.images||action.total>100||action.total<1)throw Error('Invalid source-entry count.');job.total=action.total;}
   if(action.type==='release'){
    if(!['queued','blocked','complete'].includes(action.status))throw Error('Invalid release state.');
    if(action.status==='complete'&&(!job.total||job.images!==job.total||!['pdf','editable','review'].every(k=>job.artifacts.some(a=>a.kind===k))||action.reviewPassed!==true))throw Error('Completion needs all art, PDF, editable ZIP and successful review report.');
    job.status=action.status;q.lease=null;job.retryAt=typeof action.retryAt==='number'&&Number.isFinite(action.retryAt)?Math.max(now,action.retryAt):0;event(`${job.title}: ${job.status}. ${job.detail}`);
   }
  }
 }else throw Error('Unknown queue action.');
 return q;
}
