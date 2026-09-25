import { getKnowledge } from '@/lib/knowledge';

export async function GET() {
  const knowledge = await getKnowledge();
  return Response.json({ status: 'ok', knowledgeVersion: knowledge.version, knowledgeCheckedAt: knowledge.checkedAt,
    documentCount: knowledge.documents.length, vendorCount: knowledge.vendors.length,
    services: { weather: 'live request', club: 'official source lookup', feedback: process.env.FEEDBACK_READ_WRITE_TOKEN ? 'connected' : 'unavailable' } },
    { headers: { 'Cache-Control': 'no-store' } });
}
