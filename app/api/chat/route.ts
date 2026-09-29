import { z } from 'zod';
import { answerStream, prepare } from '@/lib/assistant';

export const maxDuration = 120;
const inputSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(7000) })).min(1).max(16),
  context: z.object({ section: z.number().int().min(101).max(400).optional(), dietary: z.enum(['vegan', 'vegetarian', 'gluten-aware']).optional(), language: z.enum(['en', 'es']).optional(), origin: z.string().min(2).max(120).optional(), food: z.string().max(40).optional(), topic: z.string().max(30).optional(), kickoffTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(), travelMinutes: z.number().int().min(1).max(240).optional(), eventKind:z.enum(['match','other']).optional(), event: z.object({ title: z.string().max(150), startsAt: z.string().max(40).optional(), source: z.string().url().optional() }).optional() }).default({}),
});

export async function POST(request: Request) {
  let input;
  try { input = inputSchema.parse(await request.json()); }
  catch { return Response.json({ error: 'Invalid chat request' }, { status: 400 }); }
  if (input.messages.at(-1)?.role !== 'user') return Response.json({ error: 'Last message must be from the user' }, { status: 400 });
  if(input.messages.some(m=>m.role==='user'&&m.content.length>1500)) return Response.json({error:'Question too long'},{status:400});
  const started = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: object) => { if(!request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')); };
      try {
        const result = await prepare(input);
        send({ type: 'meta', context: result.context, sources: result.sources, cards: result.cards, actions: result.actions, route: result.route, planner:result.planner });
        let length = 0;
        for await (const delta of answerStream(input, result)) {
          if (request.signal.aborted) break;
          length += delta.length;
          send({ type: 'delta', text: delta });
        }
        send({ type: 'done', durationMs: Date.now() - started, characters: length });
        console.info(JSON.stringify({ event: 'chat', route: result.route, planner:result.planner, durationMs: Date.now() - started, characters: length }));
      } catch {
        send({ type: 'error', message: 'The assistant is unavailable right now. Please retry.' });
        console.error(JSON.stringify({ event: 'chat_error', durationMs: Date.now() - started }));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
