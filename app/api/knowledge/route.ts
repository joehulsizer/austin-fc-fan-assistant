import { put } from '@vercel/blob';
import { z } from 'zod';

export const maxDuration = 60;
const schema = z.object({
  version: z.string().datetime({ offset: true }), checkedAt: z.string().datetime({ offset: true }),
  sources: z.array(z.object({ url: z.string().url(), sha256: z.string().length(64) })).min(5),
  documents: z.array(z.object({ id: z.string(), title: z.string(), body: z.string().min(20), url: z.string().url(), checkedAt: z.string(), links: z.array(z.object({ label: z.string(), url: z.string().url() })) })).min(40),
  vendors: z.array(z.object({ name: z.string(), sections: z.array(z.number().int()).min(1), location: z.string(), description: z.string(), url: z.string().url(), checkedAt: z.string() })).min(15),
  mapPins: z.array(z.unknown()),
  featuredMatch: z.object({ title: z.string(), startsAt: z.string(), url: z.string().url(), checkedAt: z.string() }).nullable().optional(),
});

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let value;
  try { value = schema.parse(await request.json()); }
  catch { return Response.json({ error: 'Snapshot failed validation; retained the last working version' }, { status: 400 }); }
  if (value.sources.some(s => !s.url.startsWith('https://www.q2stadium.com/'))) return Response.json({ error: 'Unexpected source origin' }, { status: 400 });
  const encoded = JSON.stringify(value);
  try {
    await put(`knowledge/versions/${value.version.replace(/[:+]/g, '-')}.json`, encoded, { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    const latest = await put('knowledge/latest.json', encoded, { access: 'public', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60, contentType: 'application/json' });
    return Response.json({ ok: true, version: value.version, documents: value.documents.length, vendors: value.vendors.length, url: latest.url });
  } catch { return Response.json({ error: 'Storage write failed; retained last working version' }, { status: 503 }); }
}
