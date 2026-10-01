import { list } from '@vercel/blob';
import { LIMITS,EVALUATION_LIMITS,budgetDay,privateRead,privateOptions } from '@/lib/limits';
export const maxDuration=60;
export async function GET(request:Request) {
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});
  const u=new URL(request.url),day=u.searchParams.get('day')||budgetDay();
  if(!/^20\d\d-\d\d-\d\d$/.test(day))return Response.json({error:'Invalid date'},{status:400});
  try {
    const page=await list({prefix:`diagnostics/${day}/`,limit:100,cursor:u.searchParams.get('cursor')||undefined,...privateOptions()});
    const records=await Promise.all(page.blobs.map(b=>privateRead(b.pathname)));
    return Response.json({day,limits:LIMITS,budget:(await privateRead(`operations/budget/${day}.json`))?.value||null,evaluationLimits:EVALUATION_LIMITS,evaluationBudget:(await privateRead(`operations/evaluation-budget/${day}.json`))?.value||null,records:records.map(r=>r?.value).filter(Boolean),cursor:page.hasMore?page.cursor:null},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Diagnostics unavailable'},{status:503});}
}
