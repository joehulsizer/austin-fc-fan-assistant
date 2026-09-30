import test from 'node:test';
import assert from 'node:assert/strict';
import { getKnowledge, staticKnowledge } from '../lib/knowledge';

test('approved snapshots refresh immediately and a failed read retains the last complete snapshot',async()=>{
 const original=global.fetch, pointer=process.env.KNOWLEDGE_BLOB_URL;
 process.env.KNOWLEDGE_BLOB_URL='https://example.test/knowledge/latest.json';
 let version='2026-09-30T00:13:24+00:00';
 global.fetch=async(_url,options)=>{
  assert.equal(options?.cache,'no-store');
  return Response.json({...staticKnowledge,version,checkedAt:version});
 };
 try {
  assert.equal((await getKnowledge()).version,version);
  version='2026-09-30T00:30:00+00:00';
  assert.equal((await getKnowledge()).version,version);
  global.fetch=async()=>Response.json({...staticKnowledge,beverages:[]});
  assert.equal((await getKnowledge()).version,version);
  global.fetch=async()=>{throw new Error('Simulated storage outage');};
  assert.equal((await getKnowledge()).version,version);
 }finally{
  global.fetch=original;
  if(pointer===undefined)delete process.env.KNOWLEDGE_BLOB_URL;else process.env.KNOWLEDGE_BLOB_URL=pointer;
 }
});
