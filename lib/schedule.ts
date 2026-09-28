import schedule from '@/data/club-schedule.json';

export type Fixture = { title: string; opponent: string; startsAt: string; home: boolean; url?: string };

export function nextFixture(now: Date = new Date(), homeOnly = false): Fixture | undefined {
  return schedule.events
    .filter(event => (!homeOnly || event.home) && new Date(event.startsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
}

export function fixtureMentioned(query: string, now: Date = new Date()): Fixture | undefined {
  const q = query.toLowerCase();
  return schedule.events.find(event => new Date(event.startsAt).getTime() > now.getTime() &&
    (q.includes(event.opponent.toLowerCase()) ||
      (event.opponent === 'San Diego FC' && /san diego/i.test(query)) ||
      (event.opponent === 'Vancouver Whitecaps FC' && /vancouver|whitecaps/i.test(query)) ||
      (event.opponent === 'Sporting Kansas City' && /sporting kc|kansas city/i.test(query)) ||
      (event.opponent === 'Real Salt Lake' && /salt lake|\brsl\b/i.test(query)) ||
      (event.opponent === 'Portland Timbers' && /portland|timbers/i.test(query)) ||
      (event.opponent === 'Nashville SC' && /nashville/i.test(query))));
}

export function fixtureSource(event: Fixture) {
  return { title: event.url ? 'Austin FC next-match report' : 'Austin FC published schedule', url: event.url || schedule.source, checkedAt: schedule.checkedAt };
}
