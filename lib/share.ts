import { z } from 'zod';
import { isActionHref } from './handoffs';
import { scrubPrivateText,scrubUrl } from './redaction';

const source = z.object({ title: z.string().max(180), url: z.string().max(2000).url(), checkedAt: z.string().max(50).optional() });
const card = z.object({ title: z.string().max(180), detail: z.string().max(500), href: z.string().max(2000).url(), label: z.string().max(100) });
export const shareInputSchema = z.object({ messages: z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().min(1).max(7000),
  // Chat responses can contain six concession results and additional policy sources.
  sources: z.array(source).max(16).optional(), cards: z.array(card).max(12).optional(),
  actions:z.array(z.object({label:z.string().max(100),href:z.string().max(2000).refine(isActionHref)})).max(16).optional(),
})).min(2).max(24) });
export const sharedChatSchema = shareInputSchema.extend({ id: z.string().uuid(), createdAt: z.string().datetime() });
export function sanitizeShare(input:z.infer<typeof shareInputSchema>):z.infer<typeof shareInputSchema> {
  return {messages:input.messages.map(m=>({...m,content:scrubPrivateText(m.content),sources:m.sources?.map(s=>({...s,title:scrubPrivateText(s.title),url:scrubUrl(s.url)})),cards:m.cards?.map(c=>({...c,title:scrubPrivateText(c.title),detail:scrubPrivateText(c.detail),href:scrubUrl(c.href)})),actions:m.actions?.map(a=>({...a,label:scrubPrivateText(a.label),href:scrubUrl(a.href)}))}))};
}
