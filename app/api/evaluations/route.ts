import { put } from '@vercel/blob';
import { z } from 'zod';

const schema = z.object({ createdAt: z.string(), kind: z.string(), total: z.number().int(), passed: z.number().int(),
  accuracy: z.number(), criticalFailures: z.number().int(), results: z.array(z.record(z.string(), z.unknown())).length(120) });

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let report;
  try { report = schema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid evaluation report' }, { status: 400 }); }
  if (report.total !== 120 || report.passed < 108 || report.criticalFailures !== 0) return Response.json({ error: 'Evaluation gate failed' }, { status: 400 });
  const body = JSON.stringify(report);
  try {
    await put(`evaluations/${report.createdAt.replace(/[:+.]/g, '-')}.json`, body, { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    const latest = await put('evaluations/latest.json', body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60, contentType: 'application/json' });
    return Response.json({ ok: true, url: latest.url, passed: report.passed });
  } catch { return Response.json({ error: 'Could not save evaluation' }, { status: 503 }); }
}
