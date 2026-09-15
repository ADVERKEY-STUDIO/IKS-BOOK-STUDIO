import test from 'node:test';
import assert from 'node:assert/strict';
import { templateLibrary } from '../lib/template-library.ts';
const draft = (id, updated) => ({ id, updated, title:id, templateId:'wild', language:'English', images:{} });
test('homepage retains browser work when an account copy has the same id', () => {
  const local = {...draft('book', 10), title:'Unsynced edits'};
  const cloud = {...draft('book', 20), title:'Account copy', revision:2};
  const result = templateLibrary([local], [cloud]);
  assert.equal(result.length,1);
  assert.equal(result[0].draft,local);
  assert.equal(result[0].local,true);
});
test('homepage includes cloud-only books and orders most recently updated first', () => {
  const local = draft('local',10);
  const cloud = {...draft('cloud',20),revision:1};
  assert.deepEqual(templateLibrary([local],[cloud]).map(item=>[item.draft.id,item.local]),[['cloud',false],['local',true]]);
});
test('signed-out and empty libraries still show browser drafts without account data',()=>{
  assert.deepEqual(templateLibrary([],[]),[]);
  assert.equal(templateLibrary([draft('browser',1)],[])[0].draft.id,'browser');
});
