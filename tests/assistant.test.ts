import test from 'node:test';
import assert from 'node:assert/strict';
import { ground, staticKnowledge } from '../lib/knowledge';
import { groundedFallback } from '../lib/assistant';
import { weatherGrounding } from '../lib/live';

test('current vendor source resolves Verde Vegan at 119, not the old map label', async () => {
  const result = await ground('I am in section 123. Where is vegan food?', {});
  const answer = groundedFallback('I am in section 123. Where is vegan food?', result);
  assert.equal(result.route, 'concessions');
  assert.match(answer, /Verde Vegan.*119/);
  assert.ok(!/Verde Vegan.*(?:127|133)/.test(answer));
  assert.ok(result.sources.some(s => s.url.includes('/our-vendors/')));
  assert.ok(staticKnowledge.vendors.find(v => v.name.startsWith('Verde Vegan'))?.sections.includes(119));
});

test('the drink follow-up retains the fan section', async () => {
  const first = await ground('Vegan food in section 123?', {});
  const second = await ground('What about drinks?', first.context);
  assert.equal(second.route, 'drinks');
  assert.equal(second.context.section, 123);
  assert.ok(second.cards.some(c => c.title.includes('Bar')));
});

test('purchasing is refused and linked to official tickets', async () => {
  const result = await ground('Can you buy the ticket for me?', {});
  assert.equal(result.route, 'transaction');
  assert.match(result.answer || '', /can.t buy/);
  assert.ok(result.cards.some(c => c.href.startsWith('https://www.austinfc.com/')));
});

test('dietary claim stays gluten aware and never promises allergy safety', async () => {
  const result = await ground('Gluten free options near section 123?', {});
  const answer = groundedFallback('Gluten free options near section 123?', result);
  assert.equal(result.context.dietary, 'gluten-aware');
  assert.match(answer, /not an allergy guarantee/);
});

test('a weather provider outage returns a useful unavailable answer', async () => {
  const previous = global.fetch;
  global.fetch = async () => { throw new Error('Simulated outage'); };
  try {
    const result = await weatherGrounding('Weather tomorrow?', { language: 'en' });
    assert.match(result.answer || '', /unavailable/);
    assert.ok(result.sources.some(s => s.url.includes('weather.gov')));
  } finally { global.fetch = previous; }
});

test('unknown exit location is not fabricated', async () => {
  const result = await ground('Where is the nearest exit from section 123?', {});
  const answer = result.answer || groundedFallback('Where is the nearest exit from section 123?', result);
  assert.doesNotMatch(answer, /exit (?:is|at|behind) section/i);
});

test('historical intent mistakes do not send player recruitment or Copa América to concessions', async () => {
  assert.equal((await ground('How can I join Austin FC as a player?', {})).route, 'club');
  assert.equal((await ground('Is Copa America at Q2 Stadium?', {})).route, 'club');
});
