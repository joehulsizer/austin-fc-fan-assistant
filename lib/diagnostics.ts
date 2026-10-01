import { put } from '@vercel/blob';
import { privateOptions,budgetDay } from './limits';
import { scrubPrivateText } from './redaction';
import type { Grounding } from './types';
export async function recordResponse(query:string,result:Grounding,durationMs:number,characters:number) {
  const record={event:'chat',createdAt:new Date().toISOString(),question:scrubPrivateText(query).slice(0,1500),route:result.route,planner:result.planner,templates:result.parts?.map(p=>({route:p.result.route,fixed:!!p.result.answer}))||[{route:result.route,fixed:!!result.answer}],sourceTitles:result.sources.map(s=>s.title),durationMs,characters};
  // A private, bounded record makes actual fallbacks/template hits reproducible.
  // Never log conversation history, raw contact details, or credentials.
  console.info(JSON.stringify({...record,question:undefined}));
  if(process.env.FEEDBACK_READ_WRITE_TOKEN||process.env.FEEDBACK_STORE_ID)await put(`diagnostics/${budgetDay()}/${crypto.randomUUID()}.json`,JSON.stringify(record),{access:'private',...privateOptions(),addRandomSuffix:false,contentType:'application/json'}).catch(()=>console.warn(JSON.stringify({event:'diagnostic_write_failed'})));
}
