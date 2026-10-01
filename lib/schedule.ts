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
function localDay(date:Date){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chicago'}).format(date);}
export function requestedFixture(query:string,now=new Date()):{recognized:boolean;fixture?:Fixture;label?:string} {
  const q=query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),today=localDay(now);
  const home=schedule.events.filter(e=>e.home).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const shift=(days:number)=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
  let target:string|undefined;
  if(/\b(tonight|today|hoy|esta noche)\b/.test(q))target=today;
  else if(/\b(tomorrow|manana)\b/.test(q))target=shift(1);
  else {
    const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],span=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    const wanted=days.findIndex((d,i)=>new RegExp(`\\b(?:${d}|${span[i]})\\b`).test(q));
    if(wanted>=0) {
      const day=new Date(today+'T12:00:00Z').getUTCDay();let delta=(wanted-day+7)%7;
      if(/\bnext\b/.test(q)&&delta===0)delta=7;
      target=shift(delta);
    }
  }
  if(target)return {recognized:true,fixture:home.find(e=>localDay(new Date(e.startsAt))===target),label:target};
  const after=/\b(?:after|despues de(?:l)?)\s+(?:(20\d\d-\d\d-\d\d)|([a-z]+)\s+(\d{1,2})(?:,?\s+(20\d\d))?|(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(20\d\d))?)/.exec(q);
  if(after) {
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'],es=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const name=after[2]||after[6],month=name?months.findIndex((m,i)=>m.startsWith(name)||es[i]===name):-1;
    const cutoff=after[1]|| (month>=0?`${after[4]||after[7]||today.slice(0,4)}-${String(month+1).padStart(2,'0')}-${String(after[3]||after[5]).padStart(2,'0')}`:undefined);
    if(cutoff)return {recognized:true,fixture:home.find(e=>localDay(new Date(e.startsAt))>cutoff&&Date.parse(e.startsAt)>now.getTime()),label:`after ${cutoff}`};
  }
  return {recognized:false};
}
