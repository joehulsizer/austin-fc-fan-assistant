import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceApprovedFeed,publishApprovedEntry} from '../lib/feed-workflow';
import {privateRead} from '../lib/limits';
import {APPROVED_FEED_PATH,type InternalFeed} from '../lib/internal-knowledge';
test('concurrent approvals preserve every entry without reading stale public snapshots',async()=>{
 const now=new Date().toISOString();await replaceApprovedFeed({version:now,entries:[]});
 const entry=(id:string):InternalFeed['entries'][number]=>({id,title:'Approved test '+id,topic:'general',keywords:['test '+id],answer:{en:'Reviewed public facts.',es:'Información pública revisada.'},fanFacing:true,approvedBy:'Different reviewer',checkedAt:now,expiresAt:new Date(Date.now()+3600000).toISOString(),sourceUrl:'https://www.austinfc.com/',actions:[]});
 await Promise.all(['entry-one','entry-two','entry-three','entry-four'].map(id=>publishApprovedEntry(entry(id))));
 const current=await privateRead<InternalFeed>(APPROVED_FEED_PATH);assert.equal(current?.value.entries.length,4);
 await publishApprovedEntry({...entry('entry-one'),answer:{en:'Updated reviewed public facts.',es:'Información pública actualizada.'}});
 const updated=await privateRead<InternalFeed>(APPROVED_FEED_PATH);assert.equal(updated?.value.entries.length,4);assert.match(updated!.value.entries.find(e=>e.id==='entry-one')!.answer.en,/Updated/);
});
