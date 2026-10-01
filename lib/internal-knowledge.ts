import { z } from 'zod';
import type { FanContext, Grounding } from './types';
import { guestActions, isActionHref } from './handoffs';
import { privateRead } from './limits';
export const APPROVED_FEED_PATH='knowledge/internal/approved.json';
import { normalized } from './safety';
const operatingInstruction = /ignore (?:all|previous|your)|system prompt|developer message|reveal.{0,20}(?:secret|token|key)|ignora.{0,30}instrucciones|<\/?(?:system|script)|javascript:/i;
const text = (max:number) => z.string().min(3).max(max).refine(v=>!operatingInstruction.test(v),'Use fan-facing facts, not operating instructions');
export const internalFeedSchema = z.object({
  version:z.string().datetime({offset:true}),
  entries:z.array(z.object({
    id:z.string().regex(/^[a-z0-9-]{3,80}$/), title:text(160),
    topic:z.enum(['benefits','ordering','concessions','transport','ticketing','general']),
    keywords:z.array(text(100)).min(1).max(12),
    answer:z.object({en:text(2500),es:text(2500)}),
    // This feed contains approved public answers, never confidential operational notes.
    fanFacing:z.literal(true), approvedBy:text(120), checkedAt:z.string().datetime({offset:true}), expiresAt:z.string().datetime({offset:true}),
    sourceUrl:z.string().url().refine(u=>u.startsWith('https://www.austinfc.com/')||u.startsWith('https://www.q2stadium.com/'),'Use an official source or club provenance page'),
    actions:z.array(z.object({label:text(100),href:z.string().refine(isActionHref,'Unsupported action destination')})).max(4).default([]),
  })).max(100),
}).superRefine((feed, ctx)=>{
  const ids=new Set<string>();
  for(const [i,e] of feed.entries.entries()) {
    if(ids.has(e.id))ctx.addIssue({code:'custom',message:'Duplicate entry ID',path:['entries',i,'id']});
    ids.add(e.id);
    if(Date.parse(e.expiresAt)<=Date.parse(e.checkedAt))ctx.addIssue({code:'custom',message:'Expiry must follow review',path:['entries',i,'expiresAt']});
    if(Date.parse(e.checkedAt)>Date.now()+60000)ctx.addIssue({code:'custom',message:'Review time is in the future',path:['entries',i,'checkedAt']});
  }
});
export type InternalFeed=z.infer<typeof internalFeedSchema>;
export function feedUrl(): string | undefined {
  if(!process.env.KNOWLEDGE_BLOB_URL)return;
  const u=new URL(process.env.KNOWLEDGE_BLOB_URL);u.pathname='/knowledge/internal/latest.json';u.search='';return u.href;
}
export async function getInternalFeed():Promise<InternalFeed|undefined> {
  if(process.env.FEEDBACK_READ_WRITE_TOKEN||process.env.FEEDBACK_STORE_ID){try{const current=await privateRead<unknown>(APPROVED_FEED_PATH);if(current)return internalFeedSchema.parse(current.value);}catch{console.warn(JSON.stringify({event:'approved_feed_private_read_failed'}));}}
  const url=feedUrl();if(!url)return;
  try {
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(2500)});
    if(!r.ok)return;
    return internalFeedSchema.parse(await r.json());
  } catch{return;}
}
function feedTerms(value:string):string[] {
  const canonical=normalized(value)
    .replace(/\bseason[ -]ticket(?: holders?)?s?\b|\b(?:stm|members?|membership|abonad[oa]s?|socios?)\b/g,'member')
    .replace(/\b(?:foods?|comida|concessions?|concesiones)\b/g,'food')
    .replace(/\b(?:discounts?|descuentos?)\b/g,'discount')
    .replace(/\b(?:benefits?|beneficios?|perks?|ventajas?)\b/g,'benefit')
    .replace(/\b(?:tickets?|boletos?|entradas?)\b/g,'ticket')
    .replace(/\b(?:transfers?|transferir|traspasar|traspaso)\b/g,'transfer')
    .replace(/\b(?:parking|estacionamiento|aparcar)\b/g,'parking');
  const stop=new Set(['a','an','the','is','are','do','does','can','i','my','of','for','in','at','to','how','what','where','el','la','los','las','un','una','en','de','del','para','por','que','como','hay']);
  return [...new Set(canonical.replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(w=>w&&!stop.has(w)))];
}
export function lookupFeed(query:string,context:FanContext,feed:InternalFeed|undefined,topic?:string):Grounding|undefined {
  if(!feed)return;
  const q=` ${normalized(query).replace(/[^a-z0-9]+/g,' ').trim()} `,terms=new Set(feedTerms(query));
  const candidates=feed.entries.filter(e=>Date.parse(e.expiresAt)>Date.now()&&(!topic||e.topic===topic||e.topic==='general'));
  const entry=candidates.map(e=>({e,score:Math.max(...e.keywords.map(k=>{
    if(q.includes(` ${normalized(k).replace(/[^a-z0-9]+/g,' ').trim()} `))return 100+k.length;
    const keys=feedTerms(k);return keys.length>=2&&keys.every(w=>terms.has(w))?keys.length*10:0;
  }))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0]?.e;
  if(!entry)return;
  return {route:topic||entry.topic,context,facts:[],answer:entry.answer[context.language==='es'?'es':'en'],sources:[{title:`Club knowledge: ${entry.title}`,url:`https://austin-fc-fan-assistant.vercel.app/guide?topic=internal&entry=${entry.id}`,checkedAt:entry.checkedAt}],cards:[],actions:entry.actions};
}
