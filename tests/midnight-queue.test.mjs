import {test} from 'node:test';import assert from 'node:assert/strict';
import {seedQueue,transition,inNight} from '../lib/midnight-queue.ts';
const night=Date.parse('2026-10-16T19:00:00Z'),day=Date.parse('2026-10-16T10:00:00Z');
test('IST window, including midnight crossover',()=>{assert.equal(inNight(seedQueue(),night),true);assert.equal(inNight(seedQueue(),day),false);assert.equal(inNight({startHour:22,endHour:6},Date.parse('2026-10-16T17:00:00Z')),true);assert.equal(inNight(seedQueue(),Date.parse('2026-10-17T00:30:00Z')),false);});
test('claim strictly sequential, fence concurrent runs and stale writes',()=>{let q=transition(seedQueue(),{type:'claim',leaseId:'first'},night);assert.equal(q.lease.jobId,'shiva');assert.throws(()=>transition(q,{type:'claim',leaseId:'second'},night));assert.throws(()=>transition(q,{type:'progress',jobId:'shiva',leaseId:'wrong',images:1},night));q=transition(q,{type:'release',jobId:'shiva',leaseId:'first',status:'queued',images:3,total:44,stage:'artwork'},night);assert.equal(transition(q,{type:'claim',leaseId:'next'},night).jobs[0].images,3);});
test('pause/cutoff prevents work; current run can save and release safely',()=>{assert.throws(()=>transition(seedQueue(),{type:'claim',leaseId:'x'},day));let q=transition(seedQueue(),{type:'claim',leaseId:'x'},night);q=transition(q,{type:'enabled',enabled:false},night);assert.throws(()=>transition(q,{type:'renew',jobId:'shiva',leaseId:'x'},night));q=transition(q,{type:'release',jobId:'shiva',leaseId:'x',status:'queued'},night);assert.equal(q.lease,null);assert.throws(()=>transition(q,{type:'claim',leaseId:'x'},night));});
test('cannot skip paused first book or declare incomplete production complete',()=>{let q=transition(seedQueue(),{type:'job-state',jobId:'shiva',status:'paused'},night);assert.throws(()=>transition(q,{type:'claim',leaseId:'x'},night));q=transition(seedQueue(),{type:'claim',leaseId:'x'},night);assert.throws(()=>transition(q,{type:'release',jobId:'shiva',leaseId:'x',status:'complete',reviewPassed:true},night));});
test('expired lease is fenced; retry delay and source count survive resume',()=>{let q=transition(seedQueue(),{type:'claim',leaseId:'old'},night);assert.throws(()=>transition(q,{type:'progress',jobId:'shiva',leaseId:'old',images:1},night+91*60000));q=transition(q,{type:'claim',leaseId:'new'},night+91*60000);assert.throws(()=>transition(q,{type:'progress',jobId:'shiva',leaseId:'old',images:1},night+92*60000));q=transition(q,{type:'release',jobId:'shiva',leaseId:'new',status:'queued',retryAt:night+120*60000},night+92*60000);assert.throws(()=>transition(q,{type:'claim',leaseId:'early'},night+93*60000));});
test('duplicates and invalid schedule rejected without mutating original',()=>{const q=seedQueue();assert.throws(()=>transition(q,{type:'add',edition:'shiva',title:'Duplicate',age:'9–14'},night));assert.throws(()=>transition(q,{type:'schedule',startHour:0,endHour:0},night));assert.equal(q.jobs.length,10);assert.equal(q.lease,null);});

 test('Start now bypasses hours but retains pause and lease safety',()=>{
 const daytime=Date.parse('2026-10-16T08:00:00Z');
 let q=seedQueue();
 assert.throws(()=>transition(q,{type:'claim',leaseId:'first'},daytime));
 q=transition(q,{type:'run-mode',runAnytime:true},daytime);
 const running=transition(q,{type:'claim',leaseId:'first'},daytime);
 assert.equal(running.jobs[0].status,'running');
 assert.throws(()=>transition(running,{type:'claim',leaseId:'second'},daytime));
 assert.throws(()=>transition(transition(q,{type:'enabled',enabled:false},daytime),{type:'claim',leaseId:'first'},daytime));
 q=transition(q,{type:'run-mode',runAnytime:false},daytime);
 assert.throws(()=>transition(q,{type:'claim',leaseId:'first'},daytime));
 assert.equal(q.startHour,0);assert.equal(q.endHour,6);
 });
