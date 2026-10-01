import { get, put } from '@vercel/blob';
import { createHash, createHmac } from 'node:crypto';

export const LIMITS={requestsPerMinute:30,sharesPerHour:10,feedbackPerHour:30,aiCallsPerDay:500,aiReserveUsdPerDay:10,routingCallsPerDay:200};
export const budgetDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chicago'}).format(new Date());
const memory=new Map<string,{value:unknown;etag:string}>();
export function privateOptions(){return {token:process.env.FEEDBACK_READ_WRITE_TOKEN,storeId:process.env.FEEDBACK_STORE_ID};}
export async function privateRead<T>(path:string):Promise<{value:T;etag:string}|undefined> {
  if(!process.env.FEEDBACK_READ_WRITE_TOKEN&&!process.env.FEEDBACK_STORE_ID) {
    if(process.env.VERCEL)throw new Error('Private storage unavailable');
    return memory.get(path) as {value:T;etag:string}|undefined;
  }
  const r=await get(path,{access:'private',...privateOptions(),useCache:false,abortSignal:AbortSignal.timeout(5000)});
  if(!r||!r.stream)return;
  return {value:await new Response(r.stream).json() as T,etag:r.blob.etag};
}
/** Consistent reads + conditional ETag writes, shared across deployments/instances. */
export async function atomicUpdate<T>(path:string,initial:T,update:(value:T)=>T|undefined):Promise<T|undefined> {
  if(!process.env.FEEDBACK_READ_WRITE_TOKEN&&!process.env.FEEDBACK_STORE_ID&&!process.env.VERCEL) {
    const current=memory.get(path)?.value as T|undefined,next=update(current??structuredClone(initial));
    if(next!==undefined)memory.set(path,{value:next,etag:crypto.randomUUID()});
    return next;
  }
  for(let attempt=0;attempt<8;attempt++) {
    const read=await privateRead<T>(path), next=update(read?.value??structuredClone(initial));
    if(next===undefined)return;
    try {
      await put(path,JSON.stringify(next),{access:'private',...privateOptions(),addRandomSuffix:false,allowOverwrite:!!read,ifMatch:read?.etag,contentType:'application/json',cacheControlMaxAge:60,abortSignal:AbortSignal.timeout(5000)});
      return next;
    } catch(error) {
      if(!/Precondition|AlreadyExists|Conflict/i.test(error instanceof Error?error.name+' '+error.message:''))throw error;
    }
  }
  throw new Error('Concurrent limit reservation unavailable');
}
export async function reserveAI(model:string,purpose:string):Promise<boolean> {
  // Reserve more than the bounded inputs/output can cost, including one search.
  // No refunds on failures: uncertain provider charges remain reserved.
  const cents=purpose==='search'?5:model==='openai/gpt-5.4'?5:2;
  try {
    const r=await atomicUpdate(`operations/budget/${budgetDay()}.json`,{aiCalls:0,reservedCents:0,routingCalls:0},v=>v.aiCalls>=LIMITS.aiCallsPerDay||v.reservedCents+cents>LIMITS.aiReserveUsdPerDay*100?undefined:{...v,aiCalls:v.aiCalls+1,reservedCents:v.reservedCents+cents});
    if(!r)console.warn(JSON.stringify({event:'ai_budget_exhausted',purpose}));
    return !!r;
  }catch{console.warn(JSON.stringify({event:'ai_budget_store_unavailable',purpose}));return false;}
}
export async function reserveRouting(provider:string):Promise<boolean> {
  try {
    const r=await atomicUpdate(`operations/budget/${budgetDay()}.json`,{aiCalls:0,reservedCents:0,routingCalls:0},v=>v.routingCalls>=LIMITS.routingCallsPerDay?undefined:{...v,routingCalls:v.routingCalls+1});
    if(!r)return false;
    if(provider==='google')return true;
    // Public OSM services allow at most one request/second. One global lease,
    // no queues of API calls and no unbounded retries or autocomplete requests.
    return !!await atomicUpdate(`operations/provider/${provider}.json`,{lastAt:0},v=>Date.now()-v.lastAt<1100?undefined:{lastAt:Date.now()});
  }catch{return false;}
}
export async function requestAllowed(request:Request,kind:'chat'|'share'|'feedback'='chat'):Promise<boolean> {
  // Authenticated cloud evaluations bypass per-IP throttling, never paid-call budgets.
  if(process.env.CRON_SECRET&&request.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`)return true;
  const address=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local';
  const key=createHmac('sha256',process.env.CRON_SECRET||'local-test').update(address.split(',')[0].trim()).digest('hex');
  const window=kind==='chat'?60000:3600000,max=kind==='chat'?LIMITS.requestsPerMinute:kind==='share'?LIMITS.sharesPerHour:LIMITS.feedbackPerHour;
  try{return !!await atomicUpdate(`operations/rate/${kind}/${Math.floor(Date.now()/window)}/${key}.json`,{count:0},v=>v.count>=max?undefined:{count:v.count+1});}
  catch{return false;}
}
export function privateKey(value:string){return createHash('sha256').update(value).digest('hex');}
