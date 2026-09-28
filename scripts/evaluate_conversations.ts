import { readFileSync, writeFileSync } from 'node:fs';
import { prepare, groundedFallback } from '../lib/assistant';
import { nextFixture } from '../lib/schedule';
import type { ChatInput, FanContext } from '../lib/types';

type Turn = { question: string; route: string; mustMatch: string; mustNotMatch?: string; sourceDomain?: string; context?: Record<string, string | number>; contextAbsent?: string[] };
type Scenario = { id: string; requiresNextHome?: boolean; turns: Turn[] };
const scenarios: Scenario[] = JSON.parse(readFileSync('data/conversation-evaluation.json', 'utf8')).scenarios;

function expected(value: string): string {
  if (value !== '@NEXT_HOME') return value;
  return nextFixture(new Date(), true)?.opponent || 'no other confirmed future match';
}

async function main() {
  const results = [];
  for (const scenario of scenarios) {
    if (scenario.requiresNextHome && !nextFixture(new Date(), true)) continue;
    const messages: ChatInput['messages'] = [];
    let context: FanContext = {};
    for (const turn of scenario.turns) {
      messages.push({ role: 'user', content: turn.question });
      const result = await prepare({ messages, context });
      const answer = result.answer || groundedFallback(turn.question, result);
      const fields = turn.context || {};
      const checks = {
        route: result.route === turn.route,
        answer: turn.mustMatch === '@NEXT_HOME' ? answer.toLowerCase().includes(expected(turn.mustMatch).toLowerCase()) : new RegExp(turn.mustMatch, 'i').test(answer),
        exclusion: !turn.mustNotMatch || !new RegExp(turn.mustNotMatch, 'i').test(answer),
        source: !turn.sourceDomain || result.sources.some(s => new URL(s.url).hostname.endsWith(turn.sourceDomain!)),
        context: Object.entries(fields).every(([key, value]) => key === 'eventOpponent' ? result.context.event?.title.toLowerCase().includes(expected(String(value)).toLowerCase()) : result.context[key as keyof FanContext] === value),
        cleared: (turn.contextAbsent || []).every(key => result.context[key as keyof FanContext] === undefined),
      };
      results.push({ scenario: scenario.id, question: turn.question, pass: Object.values(checks).every(Boolean), checks, answer, route: result.route, context: result.context, sources: result.sources.map(s => s.url) });
      context = result.context;
      messages.push({ role: 'assistant', content: answer });
    }
  }
  const passed = results.filter(r => r.pass).length;
  const report = { createdAt: new Date().toISOString(), total: results.length, passed, results };
  writeFileSync('conversation-evaluation-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: results.length, passed, failures: results.filter(r => !r.pass).map(r => ({ scenario: r.scenario, question: r.question, checks: r.checks, answer: r.answer.slice(0, 220) })) }, null, 2));
  if (passed !== results.length) process.exit(1);
}
main().catch(error => { console.error(error); process.exit(1); });
