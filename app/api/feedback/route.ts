import { put } from '@vercel/blob';
import { z } from 'zod';

const schema = z.object({ rating: z.enum(['up', 'down']), comment: z.string().max(700).optional(), route: z.string().max(50).optional(), question: z.string().max(500).optional() });
export async function POST(request: Request) {
  let value;
  try { value = schema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid feedback' }, { status: 400 }); }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: 'Feedback storage unavailable' }, { status: 503 });
  try {
    const id = crypto.randomUUID();
    await put(`feedback/${new Date().toISOString().slice(0, 10)}/${id}.json`, JSON.stringify({ ...value, createdAt: new Date().toISOString() }),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    return Response.json({ ok: true, id });
  } catch { return Response.json({ error: 'Could not save feedback' }, { status: 503 }); }
}
