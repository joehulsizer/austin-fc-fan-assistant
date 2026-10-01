import { getKnowledge } from '@/lib/knowledge';
import { LIMITS } from '@/lib/limits';
export const dynamic = 'force-dynamic';

export async function GET() {
  const knowledge = await getKnowledge();
  return Response.json({ status: 'ok', deploymentCommit:process.env.VERCEL_GIT_COMMIT_SHA||null, knowledgeVersion: knowledge.version, knowledgeCheckedAt: knowledge.checkedAt,
    documentCount: knowledge.documents.length, vendorCount: knowledge.vendors.length, playerCount: knowledge.roster?.length || 0, storyCount: knowledge.news?.length || 0,
    limits:LIMITS,
    services: { weather: 'live request', club: 'official source lookup', routing:process.env.GOOGLE_MAPS_API_KEY?'Google traffic-aware routes':'OpenStreetMap route estimates (no live traffic)', feedback: process.env.FEEDBACK_READ_WRITE_TOKEN ? 'connected' : 'unavailable' } },
    { headers: { 'Cache-Control': 'no-store' } });
}
