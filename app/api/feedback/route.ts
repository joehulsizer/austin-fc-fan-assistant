import { get, put } from '@vercel/blob';
import { z } from 'zod';
import { requestAllowed } from '@/lib/limits';
import { scrubPrivateText } from '@/lib/redaction';

const schema = z.object({ rating: z.enum(['up', 'down']), comment: z.string().max(700).optional(), route: z.string().max(50).optional(), question: z.string().max(500).optional() });
function privateJson(value: unknown, options: ResponseInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(value, { ...options, headers });
}
export async function POST(request: Request) {
  let value;
  try { value = schema.parse(await request.json()); }
  catch { return privateJson({ error: 'Invalid feedback' }, { status: 400 }); }
  if (!process.env.FEEDBACK_READ_WRITE_TOKEN || !process.env.FEEDBACK_STORE_ID) return privateJson({ error: 'Feedback storage unavailable' }, { status: 503 });
  if(!await requestAllowed(request,'feedback'))return privateJson({error:'Too many feedback requests'},{status:429});
  value={...value,comment:value.comment?scrubPrivateText(value.comment):undefined,question:value.question?scrubPrivateText(value.question):undefined};
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const date = createdAt.slice(0, 10);
    await put(`feedback/${date}/${id}.json`, JSON.stringify({ ...value, createdAt }),
      { access: 'private', storeId: process.env.FEEDBACK_STORE_ID, token: process.env.FEEDBACK_READ_WRITE_TOKEN, addRandomSuffix: false, contentType: 'application/json' });
    return privateJson({ ok: true, id, date });
  } catch { return privateJson({ error: 'Could not save feedback' }, { status: 503 }); }
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return privateJson({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^20\d\d-\d\d-\d\d$/.test(date)) return privateJson({ error: 'Invalid receipt' }, { status: 400 });
  try {
    const result = await get(`feedback/${date}/${id}.json`, { access: 'private', storeId: process.env.FEEDBACK_STORE_ID, token: process.env.FEEDBACK_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200) return privateJson({ error: 'Not found' }, { status: 404 });
    return privateJson({ ok: true, record: await new Response(result.stream).json() });
  } catch { return privateJson({ error: 'Could not read feedback' }, { status: 503 }); }
}
