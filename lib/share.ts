import { z } from 'zod';

const source = z.object({ title: z.string().max(180), url: z.string().url(), checkedAt: z.string().max(50).optional() });
const card = z.object({ title: z.string().max(180), detail: z.string().max(500), href: z.string().url(), label: z.string().max(100) });
export const shareInputSchema = z.object({ messages: z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().min(1).max(7000),
  // Chat responses can contain six concession results and additional policy sources.
  sources: z.array(source).max(12).optional(), cards: z.array(card).max(12).optional(),
})).min(2).max(24) });
export const sharedChatSchema = shareInputSchema.extend({ id: z.string().uuid(), createdAt: z.string().datetime() });
