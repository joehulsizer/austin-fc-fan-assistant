import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { put } from '@vercel/blob';
export const maxDuration=120;
export async function POST(req:Request){
  if(!process.env.CRON_SECRET || req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({error:'Unauthorized'},{status:401});
  const {kind}=await req.json();
  try {
    if(kind==='storage'){
      const marker=crypto.randomUUID();
      const b=await put(`checks/${marker}.json`,JSON.stringify({marker}),{access:'public',contentType:'application/json'});
      const read=await fetch(b.url,{cache:'no-store'}).then(r=>r.json());
      return Response.json({ok:read.marker===marker,url:b.url});
    }
    if(kind==='weather'){
      const r=await fetch('https://api.weather.gov/gridpoints/EWX/157,96/forecast',{headers:{'User-Agent':'AustinFCFanAssistant (https://austin-fc-fan-assistant.vercel.app)'},signal:AbortSignal.timeout(20000)});
      const d=await r.json(); return Response.json({ok:r.ok,updated:d.properties?.updated,first:d.properties?.periods?.[0]});
    }
    const result=await generateText({model:'openai/gpt-5.4-mini',prompt:kind==='search'?'Search the official Austin FC website for the next home match relative to '+new Date().toISOString()+'. Cite the official page.':'Say: Austin fan assistant is connected.',tools:kind==='search'?{web_search:openai.tools.webSearch({filters:{allowedDomains:['austinfc.com','mlssoccer.com']}})}:undefined,maxOutputTokens:600});
    return Response.json({ok:true,text:result.text,sources:result.sources,usage:result.usage});
  }catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:'Probe failed'},{status:502});}
}
