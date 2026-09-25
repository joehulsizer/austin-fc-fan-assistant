import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock3, MapPin, Search } from 'lucide-react';
import { getKnowledge, sectionZone } from '@/lib/knowledge';
import { weatherGrounding } from '@/lib/live';
import schedule from '@/data/club-schedule.json';
import '../style.css';
import './guide.css';

const sections = [
  { id: 'food', label: 'Food & drink' },
  { id: 'sections', label: 'Section guide' },
  { id: 'travel', label: 'Getting here' },
  { id: 'policies', label: 'Stadium policies' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'weather', label: 'Weather' },
  { id: 'club', label: 'Matches & club' },
  { id: 'sources', label: 'Sources' },
];
const date = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default async function Guide({ searchParams }: { searchParams: Promise<{ topic?: string; find?: string; section?: string }> }) {
  const params = await searchParams;
  const topic = sections.some(s => s.id === params.topic) ? params.topic! : 'food';
  const data = await getKnowledge();
  const checked = date(data.checkedAt);
  const selectedSection = Number(params.section);
  const zone = Number.isInteger(selectedSection) && selectedSection >= 101 && selectedSection <= 400 ? sectionZone(selectedSection) : '';
  const policyDocs = data.documents.filter(d => d.id.startsWith('policy-'));
  const selectedPolicy = params.find ? policyDocs.find(d => d.title.toLowerCase() === params.find!.toLowerCase()) || policyDocs.find(d => d.title.toLowerCase().includes(params.find!.toLowerCase())) : undefined;
  const travelDocs = data.documents.filter(d => d.id === 'directions' || d.id === 'parking');
  const forecast = topic === 'weather' ? await weatherGrounding('weather right now', { language: 'en' }) : null;
  const futureGames = schedule.events.filter(event => new Date(event.startsAt).getTime() > Date.now());

  return <main className="guide-page">
    <div className="guide-wrap">
      <header className="guide-header"><Link href="/"><ArrowLeft size={16}/> Back to chat</Link><Link href="/try">Questions to try <ArrowRight size={15}/></Link></header>
      <div className="guide-kicker">AUSTIN FC FAN ASSISTANT · IN-SITE GUIDE</div>
      <h1>{sections.find(s => s.id === topic)?.label}</h1>
      <p className="guide-intro">Matchday information is available here in the assistant. Published Q2 Stadium and Austin FC data was checked {checked} CT. Policies, schedules, menus, and availability can change.</p>
      <nav className="guide-tabs" aria-label="Guide topics">{sections.map(s => <Link key={s.id} className={topic === s.id ? 'active' : ''} href={`/guide?topic=${s.id}`}>{s.label}</Link>)}</nav>

      {topic === 'food' && <section>
        <div className="guide-callout">Published locations are listed below. Ask the chat about a diet and your section for an approximate area. “Avoiding gluten” is a published menu label, not an allergy guarantee.</div>
        <div className="guide-grid">{data.vendors.map(v => <article className="guide-card" key={v.name}><div className="guide-card-top"><MapPin size={17}/><span>{v.location}</span></div><h2>{v.name}</h2><p>{v.description}</p><small>Q2 Stadium vendor listing · checked {date(v.checkedAt)} CT</small></article>)}</div>
      </section>}

      {topic === 'sections' && <section>
        <div className="guide-callout">The published stadium map is copied below for orientation. Some concession pins on that map may lag the current vendor list, so use the checked location cards underneath for vendor sections. Zone-based suggestions are approximate, not walking times.</div>
        <figure className="guide-map"><div className="guide-map-frame"><img src="/q2-stadium-map.svg" alt="Published Q2 Stadium section and amenity map"/></div><figcaption>Q2 Stadium published map · copied September 25, 2026. Pin labels may differ from the current vendor directory.</figcaption></figure>
        <form className="guide-search" action="/guide"><input type="hidden" name="topic" value="sections"/><label htmlFor="section">Find your section</label><input id="section" name="section" type="number" min="101" max="400" placeholder="e.g. 123" defaultValue={zone ? selectedSection : ''}/><button type="submit"><Search size={15}/> Show area</button></form>
        {zone && <div className="guide-callout"><strong>Section {selectedSection}</strong> is in the {zone.replace('northwest', 'northwest').replace('northeast', 'northeast')} stadium area. Published stands in this broad area are shown first.</div>}
        <div className="guide-grid">{[...data.vendors].sort((a, b) => Number(zone && !a.sections.some(s => sectionZone(s) === zone)) - Number(zone && !b.sections.some(s => sectionZone(s) === zone)) || a.sections[0] - b.sections[0]).map(v => <article className="guide-card" key={v.name}><div className="guide-card-top"><MapPin size={17}/><span>{v.location}</span></div><h2>{v.name}</h2><p>{v.description}</p><small>Location from the current Q2 vendor listing</small></article>)}</div>
      </section>}

      {topic === 'travel' && <section>
        <div className="guide-grid guide-grid-two">
          <article className="guide-card"><h2>Train</h2><p>Take CapMetro’s Red Line to McKalla Station on the east side of Q2 Stadium. Follow signs from the station. Confirm event-day train times before traveling.</p></article>
          <article className="guide-card"><h2>Bus</h2><p>CapMetro routes serve Q2 Stadium, including Rapid 803. Event-day service and pickup locations can change; check the published schedule.</p></article>
          <article className="guide-card"><h2>Parking</h2><p>Q2 Stadium recommends buying parking in advance. On-site and off-site lots are published. Have the mobile parking pass ready at arrival and check your lot’s event-day hours.</p></article>
          <article className="guide-card"><h2>Rideshare</h2><p>Uber/taxi drop-off is listed at Delta Drive on the east side, accessed from Metric Boulevard. Follow event-day instructions for pickup after the match.</p></article>
        </div>
        <h2 className="guide-subhead">Published transportation details</h2>
        {travelDocs.map(d => <details className="guide-detail" key={d.id}><summary>{d.title}</summary><p>{d.body}</p><small>Q2 Stadium · checked {date(d.checkedAt)} CT</small></details>)}
      </section>}

      {topic === 'policies' && <section>
        <div className="guide-callout">This local copy lets you read stadium rules without leaving the assistant. The official venue controls final policy and security decisions.</div>
        {selectedPolicy && <article className="guide-feature" id="selected-policy"><div className="guide-kicker">SELECTED POLICY</div><h2>{selectedPolicy.title}</h2><p>{selectedPolicy.body}</p><small>Q2 Stadium policy guide · checked {date(selectedPolicy.checkedAt)} CT</small></article>}
        <h2 className="guide-subhead">All published policy topics</h2>
        <div className="guide-policy-list">{policyDocs.map(d => <Link key={d.id} href={`/guide?topic=policies&find=${encodeURIComponent(d.title)}`} className={selectedPolicy?.id === d.id ? 'active' : ''}>{d.title}<ArrowRight size={14}/></Link>)}</div>
      </section>}

      {topic === 'tickets' && <section>
        <div className="guide-grid guide-grid-two"><article className="guide-card"><h2>Transfer a ticket</h2><ol><li>Open your match ticket in the Austin FC & Q2 Stadium app.</li><li>Tap “Send.”</li><li>Enter the recipient’s email address or phone number.</li><li>Choose the ticket quantity and tap “Send Tickets.”</li></ol></article><article className="guide-card"><h2>Buy or access tickets</h2><p>Purchases, account lookup, and transfers are handled by Austin FC’s official ticket service and app. This assistant can explain the steps but cannot transact or open your account.</p><p>If you need account help, use the official Austin FC ticketing service or stadium box office.</p></article></div>
        <div className="guide-callout">Instructions were checked against Austin FC’s mobile ticketing guide. No personal ticket or payment information is stored here.</div>
      </section>}

      {topic === 'weather' && <section><article className="guide-feature"><div className="guide-kicker">NATIONAL WEATHER SERVICE · Q2 STADIUM AREA</div><h2>Current hourly forecast</h2><p>{forecast?.answer}</p><small>Live forecast checked when this page loaded. Ask the assistant about a specific match’s kickoff to get its hourly forecast within the available forecast window.</small></article></section>}

      {topic === 'club' && <section>
        <h2 className="guide-subhead">Upcoming published home matches</h2><div className="guide-grid guide-grid-two">{futureGames.length ? futureGames.map(game => <article className="guide-card" key={game.startsAt}><div className="guide-card-top"><Clock3 size={17}/><span>{date(game.startsAt)} CT</span></div><h2>{game.title}</h2><p>Q2 Stadium · confirm kickoff before traveling.</p></article>) : <div className="guide-callout">No future home match is listed in the current published season schedule.</div>}</div>
        <h2 className="guide-subhead">Latest published club stories</h2><div className="guide-grid guide-grid-two">{data.news?.map(story => <article className="guide-card" key={story.url}><h2>{story.title}</h2><p>{story.summary}</p><small>Austin FC news · snapshot checked {checked} CT</small></article>)}</div>
        <h2 className="guide-subhead">Published roster</h2><div className="guide-roster">{data.roster?.map(player => <div key={player.url}><strong>#{player.number} {player.name}</strong><span>{player.position}</span></div>)}</div>
      </section>}

      {topic === 'sources' && <section><div className="guide-callout">The information below is copied into local guides for this preview. Provider names are shown for transparency; the guide links stay inside this site. Historical Satisfi conversations shaped question wording but do not override current facts.</div><div className="guide-grid guide-grid-two">
        {[{ title: 'Q2 Stadium vendors and maps', body: `${data.vendors.length} published vendor locations and a section directory`, to: 'food' }, { title: 'Q2 Stadium policy guide', body: `${policyDocs.length} published policy topics`, to: 'policies' }, { title: 'Q2 Stadium directions and parking', body: 'Rail, bus, parking, rideshare, and accessibility directions', to: 'travel' }, { title: 'Austin FC', body: 'Published home dates, roster, recent club stories, and ticket steps', to: 'club' }, { title: 'National Weather Service', body: 'Live hourly forecast for the Q2 Stadium area', to: 'weather' }].map(item => <Link className="guide-card guide-source-card" key={item.title} href={`/guide?topic=${item.to}`}><h2>{item.title}</h2><p>{item.body}</p><small>View here <ArrowRight size={13}/></small></Link>)}
      </div><p className="guide-provenance">Q2 Stadium snapshot checked {checked} CT. The stadium, club, transit agency, and weather service remain the authorities for changes after that time.</p></section>}
    </div>
  </main>;
}
