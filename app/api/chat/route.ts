import { z } from 'zod';
import { answerStream, prepare } from '@/lib/assistant';

export const maxDuration = 120;
const inputSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1500) })).min(1).max(16),
  context: z.object({ section: z.number().int().min(101).max(400).optional(), dietary: z.enum(['vegan', 'vegetarian', 'gluten-aware']).optional(), language: z.enum(['en', 'es']).optional(), event: z.object({ title: z.string().max(150), startsAt: z.string().max(40).optional(), source: z.string().url().optional() }).optional() }).default({}),
});

export async function POST(request: Request) {
  let input;
  try { input = inputSchema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid chat request' }, { status: 400 }); }
  if (input.messages.at(-1)?.role !== 'user') return Response.json({ error: 'Last message must be from the user' }, { status: 400 });
  const started = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: object) => controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
      try {
        const result = await prepare(input);
        send({ type: 'meta', context: result.context, sources: result.sources, cards: result.cards, route: result.route });
        let length = 0;
        for await (const delta of answerStream(input, result)) {
          if (request.signal.aborted) break;
          length += delta.length;
          send({ type: 'delta', text: delta });
        }
        send({ type: 'done', durationMs: Date.now() - started, characters: length });
        console.info(JSON.stringify({ event: 'chat', route: result.route, durationMs: Date.now() - started, characters: length }));
      } catch {
        send({ type: 'error', message: 'The assistant is unavailable right now. Please retry.' });
        console.error(JSON.stringify({ event: 'chat_error', durationMs: Date.now() - started }));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
