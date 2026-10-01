import { get, put } from '@vercel/blob';
import { z } from 'zod';
import { internalFeedSchema, type InternalFeed } from './internal-knowledge';
import { atomicUpdate,privateRead,privateOptions } from './limits';
const publishedEntry=internalFeedSchema.shape.entries.element;
export const submissionSchema=z.object({submittedBy:z.string().min(3).max(120),entry:publishedEntry.omit({approvedBy:true,checkedAt:true,fanFacing:true})});
export type Draft={id:string;submittedBy:string;submittedAt:string;entry:z.infer<typeof submissionSchema>['entry'];status:'pending'|'publishing'|'approved'|'rejected';reviewedBy?:string;reviewedAt?:string;reason?:string};
export async function submitDraft(value:unknown):Promise<Draft> {
  const input=submissionSchema.parse(value);
  if(Date.parse(input.entry.expiresAt)<=Date.now())throw new Error('Expiry must be in the future');
  const draft:Draft={...input,id:crypto.randomUUID(),submittedAt:new Date().toISOString(),status:'pending'};
  await put(`knowledge/drafts/${draft.id}.json`,JSON.stringify(draft),{access:'private',...privateOptions(),addRandomSuffix:false,contentType:'application/json'});
  return draft;
}
async function publish(entry:InternalFeed['entries'][number]) {
  for(let attempt=0;attempt<8;attempt++) {
    const read=await get('knowledge/internal/latest.json',{access:'public',useCache:false,abortSignal:AbortSignal.timeout(5000)});
    const current=read?.stream?internalFeedSchema.parse(await new Response(read.stream).json()):{version:new Date().toISOString(),entries:[]};
    const feed=internalFeedSchema.parse({version:new Date().toISOString(),entries:[...current.entries.filter(e=>e.id!==entry.id),entry]});
    const json=JSON.stringify(feed);
    await put(`knowledge/internal/versions/${crypto.randomUUID()}.json`,json,{access:'public',addRandomSuffix:false,contentType:'application/json'});
    try {
      await put('knowledge/internal/latest.json',json,{access:'public',addRandomSuffix:false,allowOverwrite:!!read,ifMatch:read?.blob.etag,cacheControlMaxAge:60,contentType:'application/json'});
      return feed;
    }catch(e){if(!/Precondition|AlreadyExists/i.test(e instanceof Error?e.name+' '+e.message:''))throw e;}
  }
  throw new Error('Concurrent publication failed; retry');
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
    try {await publish({...claimed.entry,approvedBy:reviewer,checkedAt,fanFacing:true});}
    catch(error){await atomicUpdate<Draft>(path,claimed,v=>v.status==='publishing'&&v.reviewedAt===checkedAt?{...v,status:'pending'}:undefined);throw error;}
    await atomicUpdate<Draft>(path,claimed,v=>v.status==='publishing'&&v.reviewedAt===checkedAt?({...v,status:'approved'}):undefined);
    return {...claimed,status:'approved'};
  }
  return claimed;
}
