import { put } from '@vercel/blob';
import { z } from 'zod';
import { internalFeedSchema,getInternalFeed,APPROVED_FEED_PATH,type InternalFeed } from './internal-knowledge';
import { atomicUpdate,privateRead,privateOptions } from './limits';
const publishedEntry=internalFeedSchema.shape.entries.element;
export const submissionSchema=z.object({submittedBy:z.string().min(3).max(120),entry:publishedEntry.omit({approvedBy:true,checkedAt:true,fanFacing:true})});
export type Draft={id:string;submittedBy:string;submittedAt:string;entry:z.infer<typeof submissionSchema>['entry'];status:'pending'|'publishing'|'approved'|'rejected';reviewedBy?:string;reviewedAt?:string;reason?:string};
export async function submitDraft(value:unknown):Promise<Draft> {
  const input=submissionSchema.parse(value);
  if((input.entry.topic==='stadium')!==!!input.entry.policy)throw new Error('Use a policy field only for a stadium entry');
  if(Date.parse(input.entry.expiresAt)<=Date.now())throw new Error('Expiry must be in the future');
  const draft:Draft={...input,id:crypto.randomUUID(),submittedAt:new Date().toISOString(),status:'pending'};
  await put(`knowledge/drafts/${draft.id}.json`,JSON.stringify(draft),{access:'private',...privateOptions(),addRandomSuffix:false,contentType:'application/json'});
  return draft;
}
async function mirrorApprovedFeed(feed:InternalFeed) {
  // Public CDN reads can lag a write. The private canonical snapshot is authoritative.
  // Re-read it after every projection write so concurrent approvals converge publicly.
  try {
    await put(`knowledge/internal/versions/${crypto.randomUUID()}.json`,JSON.stringify(feed),{access:'public',addRandomSuffix:false,contentType:'application/json'});
    for(let attempt=0;attempt<8;attempt++) {
      const current=await privateRead<InternalFeed>(APPROVED_FEED_PATH);if(!current)return;
      await put('knowledge/internal/latest.json',JSON.stringify(current.value),{access:'public',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60,contentType:'application/json'});
      if((await privateRead(APPROVED_FEED_PATH))?.etag===current.etag)return;
    }
    console.warn(JSON.stringify({event:'approved_feed_projection_busy'}));
  }catch{console.warn(JSON.stringify({event:'approved_feed_projection_failed'}));}
}
export async function replaceApprovedFeed(value:InternalFeed) {
  const feed=internalFeedSchema.parse(value);
  const saved=await atomicUpdate<InternalFeed>(APPROVED_FEED_PATH,feed,()=>feed);
  if(!saved)throw new Error('Feed save failed');
  await mirrorApprovedFeed(saved);return saved;
}
export async function publishApprovedEntry(entry:InternalFeed['entries'][number]) {
  const initial=await getInternalFeed()||{version:new Date().toISOString(),entries:[]};
  const feed=await atomicUpdate<InternalFeed>(APPROVED_FEED_PATH,initial,current=>internalFeedSchema.parse({version:new Date().toISOString(),entries:[...current.entries.filter(e=>e.id!==entry.id),entry]}));
  if(!feed)throw new Error('Publication unavailable');
  await mirrorApprovedFeed(feed);return feed;
}
export async function reviewDraft(id:string,reviewer:string,decision:'approve'|'reject',reason?:string):Promise<Draft> {
  const path=`knowledge/drafts/${id}.json`,prior=await privateRead<Draft>(path);
  if(!prior)throw new Error('Draft not found');
  if(prior.value.submittedBy.trim().toLowerCase()===reviewer.trim().toLowerCase())throw new Error('A different person must review this entry');
  if(prior.value.status==='approved'||prior.value.status==='rejected')return prior.value;
  const checkedAt=new Date().toISOString();
  if(decision==='approve')internalFeedSchema.parse({version:checkedAt,entries:[{...prior.value.entry,approvedBy:reviewer,checkedAt,fanFacing:true}]});
  const claimed=await atomicUpdate<Draft>(path,prior.value,v=>v.status==='pending'||v.status==='publishing'&&Date.now()-Date.parse(v.reviewedAt||v.submittedAt)>5*60000?{...v,status:decision==='approve'?'publishing':'rejected',reviewedBy:reviewer,reviewedAt:checkedAt,reason}:undefined);
  if(!claimed)throw new Error('Draft already reviewed');
  if(decision==='approve') {
    try {await publishApprovedEntry({...claimed.entry,approvedBy:reviewer,checkedAt,fanFacing:true});}
    catch(error){await atomicUpdate<Draft>(path,claimed,v=>v.status==='publishing'&&v.reviewedAt===checkedAt?{...v,status:'pending'}:undefined);throw error;}
    await atomicUpdate<Draft>(path,claimed,v=>v.status==='publishing'&&v.reviewedAt===checkedAt?({...v,status:'approved'}):undefined);
    return {...claimed,status:'approved'};
  }
  return claimed;
}
