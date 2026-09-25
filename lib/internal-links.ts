/** Keep navigation inside the preview while preserving official URLs in API metadata. */
export function internalGuideHref(url: string, title = ''): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return '/guide?topic=sources'; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const name = title.toLowerCase();
  const topic = host.includes('weather.gov') ? 'weather'
    : /food-and-drink|our-vendors|drink-menu/.test(path) ? 'food'
    : /stadium-maps/.test(path) ? 'sections'
    : /directions|parking|special-events\/q2/.test(path) ? 'travel'
    : /ticket|seatgeek/.test(path) ? 'tickets'
    : /roster|players\/|news|academy|schedule|events|\.pdf$/.test(path) ? 'club'
    : /policy/.test(path) ? 'policies'
    : /vendor|food|drink/.test(name) ? 'food'
    : host.includes('austinfc.com') || host.includes('mlssoccer.com') ? 'club'
    : host.includes('capmetro.org') ? 'travel'
    : host.includes('q2stadium.com') ? 'policies'
    : 'sources';
  if (topic === 'policies' && !/policy and dietary|q2 stadium policy/i.test(name) && title) {
    return `/guide?topic=policies&find=${encodeURIComponent(title)}`;
  }
  return `/guide?topic=${topic}`;
}
