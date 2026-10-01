import { put } from '@vercel/blob';
import { shareInputSchema,sanitizeShare } from '@/lib/share';
import { requestAllowed } from '@/lib/limits';

export async function POST(request: Request) {
  if(!await requestAllowed(request,'share'))return Response.json({error:'Share limit reached. Please try again later.'},{status:429,headers:{'Retry-After':'3600'}});
  let input;
  try { input = shareInputSchema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid chat snapshot' }, { status: 400 }); }
  if (!input.messages.some(m => m.role === 'user') || !input.messages.some(m => m.role === 'assistant')) {
    return Response.json({ error: 'Ask a question before sharing' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const record = { id, createdAt: new Date().toISOString(), messages: sanitizeShare(input).messages };
  try {
    await put(`shares/${id}.json`, JSON.stringify(record), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    return Response.json({ path: `/share/${id}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not create share link. Please retry.' }, { status: 503 });
  }
}
