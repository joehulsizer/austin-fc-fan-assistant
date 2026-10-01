import { list } from '@vercel/blob';
import { z } from 'zod';
import { submitDraft,reviewDraft,type Draft } from '@/lib/feed-workflow';
import { privateOptions,privateRead } from '@/lib/limits';
export const maxDuration=60;
function reviewer(req:Request){return !!process.env.CRON_SECRET&&req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`;}
function submitter(req:Request){return reviewer(req)||!!process.env.KNOWLEDGE_SUBMIT_SECRET&&req.headers.get('authorization')===`Bearer ${process.env.KNOWLEDGE_SUBMIT_SECRET}`;}
export async function POST(req:Request) {
  if(!submitter(req))return Response.json({error:'Unauthorized'},{status:401});
  try {
    const text=await req.text();if(text.length>12000)return Response.json({error:'Entry too large'},{status:413});
    const draft=await submitDraft(JSON.parse(text));return Response.json({ok:true,id:draft.id,status:draft.status},{status:201});
  }catch(e){return Response.json({error:e instanceof z.ZodError?'Invalid entry':e instanceof Error?e.message:'Submission failed'},{status:400});}
}
export async function GET(req:Request) {
  if(!reviewer(req))return Response.json({error:'Reviewer access required'},{status:401});
  const url=new URL(req.url),cursor=url.searchParams.get('cursor')||undefined;
  try {
    const page=await list({prefix:'knowledge/drafts/',limit:50,cursor,...privateOptions()});
    const drafts=await Promise.all(page.blobs.map(b=>privateRead<Draft>(b.pathname)));
    return Response.json({drafts:drafts.map(d=>d?.value).filter(Boolean),cursor:page.hasMore?page.cursor:null},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Draft storage unavailable'},{status:503});}
}
export async function PATCH(req:Request) {
  if(!reviewer(req))return Response.json({error:'Reviewer access required'},{status:401});
  try {
    const body=z.object({id:z.string().uuid(),reviewedBy:z.string().min(3).max(120),decision:z.enum(['approve','reject']),reason:z.string().max(500).optional()}).parse(await req.json());
    const draft=await reviewDraft(body.id,body.reviewedBy,body.decision,body.reason);return Response.json({ok:true,id:draft.id,status:draft.status});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Review failed'},{status:400});}
}
