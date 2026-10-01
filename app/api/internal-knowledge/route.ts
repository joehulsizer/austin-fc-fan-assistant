import { replaceApprovedFeed } from '@/lib/feed-workflow';
import { internalFeedSchema } from '@/lib/internal-knowledge';
export const maxDuration=60;
export async function POST(request:Request) {
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({error:'Unauthorized'},{status:401});
  if(Number(request.headers.get('content-length')||0)>400000) return Response.json({error:'Feed too large'},{status:413});
  let feed;
  try {
    const body=await request.text();if(body.length>400000)return Response.json({error:'Feed too large'},{status:413});
    feed=internalFeedSchema.parse(JSON.parse(body));
  } catch{return Response.json({error:'Invalid feed; previous approved answers retained'},{status:400});}
  try {
    await replaceApprovedFeed(feed);
    return Response.json({ok:true,version:feed.version,entries:feed.entries.length},{headers:{'Cache-Control':'no-store'}});
  } catch{return Response.json({error:'Storage unavailable; previous feed retained'},{status:503});}
}

export async function GET(request:Request) {
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});
  const {getInternalFeed}=await import('@/lib/internal-knowledge');
  return Response.json(await getInternalFeed() || {version:new Date().toISOString(),entries:[]},{headers:{'Cache-Control':'no-store'}});
}
