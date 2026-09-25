import { get, put } from '@vercel/blob';
import { z } from 'zod';

const schema = z.object({ rating: z.enum(['up', 'down']), comment: z.string().max(700).optional(), route: z.string().max(50).optional(), question: z.string().max(500).optional() });
export async function POST(request: Request) {
  let value;
  try { value = schema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid feedback' }, { status: 400 }); }
  if (!process.env.FEEDBACK_READ_WRITE_TOKEN || !process.env.FEEDBACK_STORE_ID) return Response.json({ error: 'Feedback storage unavailable' }, { status: 503 });
  try {
    const id = crypto.randomUUID();
    await put(`feedback/${new Date().toISOString().slice(0, 10)}/${id}.json`, JSON.stringify({ ...value, createdAt: new Date().toISOString() }),
      { access: 'private', storeId: process.env.FEEDBACK_STORE_ID, token: process.env.FEEDBACK_READ_WRITE_TOKEN, addRandomSuffix: false, contentType: 'application/json' });
    return Response.json({ ok: true, id });
  } catch { return Response.json({ error: 'Could not save feedback' }, { status: 503 }); }
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^20\d\d-\d\d-\d\d$/.test(date)) return Response.json({ error: 'Invalid receipt' }, { status: 400 });
  try {
    const result = await get(`feedback/${date}/${id}.json`, { access: 'private', storeId: process.env.FEEDBACK_STORE_ID, token: process.env.FEEDBACK_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ok: true, record: await new Response(result.stream).json() });
  } catch { return Response.json({ error: 'Could not read feedback' }, { status: 503 }); }
}
