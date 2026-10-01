import bundled from '@/data/knowledge.json';
import { foodGrounding, type Beverage } from './food';
import { amenityGrounding } from './amenities';
import { travelGrounding, travelModes } from './travel';
import { ticketGrounding } from './ticketing';
import { messageLanguage } from './language';
import { parseOrigin } from './origin';
import { catalogTopics } from './catalog';
import type { Card, FanContext, Grounding, Source } from './types';

type Doc = { id: string; title: string; body: string; url: string; checkedAt: string; links: { label: string; url: string }[] };
type Vendor = { name: string; sections: number[]; location: string; description: string; url: string; checkedAt: string };
export type Snapshot = { version: string; checkedAt: string; documents: Doc[]; vendors: Vendor[]; sources: { url: string; sha256: string }[]; beverages?: Beverage[]; featuredMatch?: { title: string; startsAt: string; url: string; checkedAt: string } | null; roster?: { number: number; name: string; position: string; url: string }[]; news?: { title: string; summary: string; url: string }[] };
export const staticKnowledge = bundled as Snapshot;
let lastWorkingKnowledge = staticKnowledge;
export const MAP_URL = 'https://www.q2stadium.com/stadium-maps/';
export const TICKET_URL = 'https://www.austinfc.com/tickets/';
export const MOBILE_TICKET_URL = 'https://www.austinfc.com/tickets/mobile-ticketing';
export const TRANSIT_URL = 'https://www.capmetro.org/special-events/Q2';
const POLICY_URL = 'https://www.q2stadium.com/a-z-policy-guide/';

export async function getKnowledge(): Promise<Snapshot> {
  const pointer = process.env.KNOWLEDGE_BLOB_URL;
  if (!pointer) return staticKnowledge;
  try {
    // Blob already has a 60-second CDN cache. A second persistent Next data cache
    // can keep serving a superseded snapshot after an approved upload.
    const response = await fetch(pointer, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Knowledge unavailable');
    const value = await response.json();
    if ((value.documents?.length ?? 0) < 40 || (value.vendors?.length ?? 0) < 15 || (value.roster?.length ?? 0) < 15 || (value.news?.length ?? 0) < 3 || (value.beverages?.length ?? 0) < 40) throw new Error('Knowledge incomplete');
    lastWorkingKnowledge = value as Snapshot;
    return lastWorkingKnowledge;
  } catch { return lastWorkingKnowledge; }
}

export function detectContext(query: string, previous: FanContext): FanContext {
  const context: FanContext = { ...previous };
  if (context.origin === 'ut-austin') context.origin = 'UT Austin';
  if (/(?:not sure|don.t know|don.t remember|haven.t got|no idea).{0,40}(?:section|seat|sitting)|(?:section|seat).{0,25}(?:unknown|not sure|don.t know)/i.test(query)) delete context.section;
  const section = query.match(/(?:section|sec\.?|secci[oó]n|secc\.?|sectoin|cerca de la)\s*#?\s*(\d{3})\b/i)
    || query.match(/\b(?:i(?:'m| am|m) in|estoy en)\s*#?\s*(\d{3})\b/i)
    || /^\s*(\d{3})[.!]?\s*$/.exec(query)
    || (/\b(food|eat|drinks?|beers?|tacos?|pizza|nachos|restrooms?|bathrooms?|comida|comer|bebidas?|cerveza|baños?)\b/i.test(query) ? query.match(/\b(?:near|by|around|cerca de)\s*#?\s*(\d{3})\b/i) : null);
  if (section) { if(Number(section[1])>=101&&Number(section[1])<=400)context.section=Number(section[1]);else delete context.section; }
  const origin = parseOrigin(query,previous.topic==='transport');
  if(origin)context.origin=origin;
  if(context.origin!==previous.origin)delete context.travelMinutes;
  if(previous.travelMode && /\b(car|driving|drive|rideshare|uber|lyft|train|rail|bus|bike|bicycle|parking|tren|autobus|bicicleta)\b/i.test(query)) {
    const modes=travelModes(query,context);if(modes.length===1&&modes[0]!==previous.travelMode)delete context.travelMinutes;
  }
  const noDiet = /\b(?:no dietary restrictions|not (?:vegan|vegetarian)|anything is fine|(?:ya )?no soy (?:vegan[oa]|vegetarian[oa])|sin restricciones alimentarias)\b/i.test(query);
  if (noDiet) delete context.dietary;
  else if (/\b(vegan|vegab|vegano|vegana)\b/i.test(query)) context.dietary = 'vegan';
  else if (/\b(vegetarian|vegetariano|vegetariana|veggie)\b/i.test(query)) context.dietary = 'vegetarian';
  else if (/\b(gluten|celiac|celiaco|celíaco)\b/i.test(query)) context.dietary = 'gluten-aware';
  const food = query.match(/\b(chicken|wings?|tenders?|burgers?|hamburgers?|pizza|tacos?|nachos|bao|barbecue|bbq|shawarma)\b/i);
  if (food) context.food = food[1].toLowerCase();
  context.language = messageLanguage(query, previous.language);
  if (/\b(concert|concierto|festival|non.match|otro evento|private event|comedy show|comedia|other event)\b/i.test(query)) { context.eventKind = 'other'; delete context.event; delete context.kickoffTime; delete context.travelMinutes; }
  else if (/\b(match|game|partido|kickoff)\b/i.test(query)) {
    if(context.eventKind==='other'){delete context.event;delete context.kickoffTime;delete context.travelMinutes;}
    context.eventKind = 'match';
  }
  const clock = query.match(/(?:kickoff|start(?:s)?|inicio|empieza|comienza)(?:\s+(?:is|at|a las|es|del partido))*\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  const meridiem = clock?.[3]?.toLowerCase();
  if (clock && Number(clock[1]) <= (meridiem ? 12 : 23) && (!meridiem || Number(clock[1]) >= 1) && Number(clock[2] || 0) < 60) {
    let hour = Number(clock[1]);
    if (meridiem?.startsWith('a') && hour === 12) hour = 0;
    else if ((meridiem?.startsWith('p') || !meridiem) && hour < 12) hour += 12;
    context.kickoffTime = `${String(hour).padStart(2,'0')}:${clock[2] || '00'}`;
  }
  const duration = query.match(/(?:trip|travel|drive|ride|journey|maps|viaje|trayecto|tarda)(?:\s+(?:takes|is|says|shows|about|de|dura|indica))*\s+(\d{1,3})\s*(?:minutes?|mins?|minutos?)/i) || query.match(/(\d{1,3})\s*(?:minutes?|mins?|minutos?)\s*(?:trip|travel|drive|ride|journey|viaje|trayecto)/i) || (previous.topic==='transport' && /^\s*(\d{1,3})\s*(?:minutes?|mins?|minutos?)[.!?]?\s*$/i.exec(query));
  if (duration && Number(duration[1]) > 0 && Number(duration[1]) <= 240) context.travelMinutes = Number(duration[1]);
  return context;
}

export function sectionZone(section: number): string {
  if (section >= 101 && section <= 108) return 'south';
  if (section >= 109 && section <= 118) return 'west';
  if (section >= 119 && section <= 125) return 'northwest';
  if (section >= 126 && section <= 128) return 'northeast';
  if (section >= 129 && section <= 137) return 'east';
  return 'other level';
}

function source(title: string, url: string, checkedAt = staticKnowledge.checkedAt): Source { return { title, url, checkedAt }; }
function card(title: string, detail: string, href: string, label = 'Open official page'): Card { return { title, detail, href, label }; }

export const MENU_HIGHLIGHTS = [
  { name: 'Grillove', location: 'Section 101', item: 'Impossible Good Burger (vegetarian)', category: 'burger' },
  { name: 'Oak Hill Grill', location: 'Section 129', item: 'Impossible Good Burger (vegetarian)', category: 'burger' },
  { name: 'Pluckers', location: 'Section 135 East Side', item: 'Chicken tenders and wings', category: 'chicken' },
  { name: 'Bao’d Up', location: 'Section 101 SE Corner', item: 'Teriyaki chicken bao', category: 'chicken' },
  { name: 'Shawarma Point', location: 'Section 127', item: 'Chicken Shawarma Salad', category: 'chicken' },
] as const;

export function searchDocs(query: string, knowledge: Snapshot, count = 4): Doc[] {
  const normalized = normalize(query);
  const stop = new Set('the a an i my me is are do does can could would will should it this that there here q2 stadium please tell about what where how when to at in on of for and or with from you your have has be get'.split(' '));
  const words = normalized.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.has(w));
  const stem=(word:string)=>word.replace(/ies$/,'y').replace(/s$/,'');
  const aliases: Record<string, string> = {
    diaper: 'bag childcare', mochila: 'bag', bolsa: 'bag', bolso: 'bag',
    train: 'rail metro capmetro', tren: 'rail metro capmetro', estacionamiento: 'parking',
    ticket: 'ticket seatgeek', boleto: 'ticket', entrada: 'ticket',
    bathroom: 'restrooms', restroom: 'restrooms', bano: 'restrooms',
    water: 'water hydration', agua: 'water hydration',
    sensory: 'sensory room', sensorial: 'sensory room',
    wheelchair: 'ada accessibility wheelchair', silla: 'wheelchair accessibility',
    transfer: 'ticket will call transfer', transferir: 'ticket will call transfer',
    stroller:'strollers', elevator:'elevators', lift:'elevators', ascensor:'elevators',
    dog:'animals', esa:'animals', pet:'animals', perro:'animals',
    gun:'prohibited weapons', firearm:'prohibited weapons', tesla:'ev charging',
    autistic:'sensory', quiet:'sensory', cashless:'payment methods', efectivo:'payment',
    camera:'cameras', camara:'cameras', sunscreen:'sunscreen', sunblock:'sunscreen',
    pram:'strollers', reentry:'re-entry', headphones:'headphones', infant:'children',
  };
  const terms = new Set(words.flatMap(w => [stem(w), ...(aliases[stem(w)]?.split(' ').map(stem) || [])]));
  const matched=catalogTopics(query);
  const titleAliases:Record<string,string>={stroller:'Strollers',elevators:'Elevators',animals:'Animals',reentry:'Re-Entry Policy',ev:'EV Charging Stations',cashless:'Payment Methods',cameras:'Cameras',drones:'Drones',prohibited:'Prohibited Items',smoking:'Smoking and Tobacco Use Policy',tailgating:'Tailgating',sunscreen:'Sunscreen',children:'Children/Infants',restrooms:'Restrooms',phonecharge:'Phone Charging Stations',weatherpolicy:'Weather'};
  if(matched.some(t=>titleAliases[t]))return knowledge.documents.filter(d=>matched.some(t=>titleAliases[t]===d.title)).slice(0,count);
  return knowledge.documents.map(d => {
    const title = normalize(d.title).split(/[^a-z0-9]+/).map(stem), body = normalize(d.body).split(/[^a-z0-9]+/).map(stem);
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      if (body.includes(term)) score += 1;
    }
    if (/parking|estacionamiento/.test(normalized) && d.id === 'parking') score += 12;
    if (/rail|train|tren|bus|rideshare|uber|metro/.test(normalized) && d.id === 'directions') score += 12;
    return { d, score };
  }).filter(x => x.score >= 5).sort((a, b) => b.score - a.score).slice(0, count).map(x => x.d);
}

function normalize(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

export async function ground(query: string, oldContext: FanContext): Promise<Grounding> {
  const knowledge = await getKnowledge();
  const context = detectContext(query, oldContext);
  const spanish = context.language === 'es';
  const q = normalize(query);
  const base: Grounding = { route: 'general', context, facts: [], sources: [], cards: [] };
  const addDoc = (d: Doc) => { base.facts.push(`${d.title}: ${d.body.slice(0, 2400)}`); base.sources.push(source(d.title, d.url, d.checkedAt)); };
  if (/^\s*tryouts?\s*\??\s*$/.test(q)) {
    base.route = 'club';
    base.answer = spanish ? '¿Te refieres a pruebas como jugador para la Academia de Austin FC? Si es así, puedo explicarte la guía oficial de reclutamiento.' : 'Do you mean player tryouts for Austin FC Academy? If so, I can explain its official recruitment guidance.';
    base.sources = [source('Austin FC Academy recruitment', 'https://www.austinfc.com/academy/recruitment')];
    return base;
  }
  if (/\b(charged|refund|payment|paid|missing order|never received|didn.t receive)\b/.test(q) && /\b(food|drink|concession|order|meal|ticket)\b/.test(q)) {
    base.route = 'support';
    const guestServices = knowledge.documents.find(d => d.title.startsWith('Guest Services'));
    if (guestServices) addDoc(guestServices);
    const contact = knowledge.documents.find(d => d.title === 'ADA/Accessibility');
    if (contact) base.sources.push(source('Q2 Stadium Guest Services contact', contact.url, contact.checkedAt));
    base.answer = spanish ? 'No puedo ver pagos ni emitir reembolsos. Para un cargo por comida que no recibiste, habla con Guest Services en la explanada principal detrás de la sección 124 o escribe a GuestServices@AustinFC.com. Ten a mano los detalles del pedido y el cargo.' : 'I cannot see payments or issue refunds. For a food charge without an order, visit Guest Services on the main concourse behind section 124 or email GuestServices@AustinFC.com. Have your order and charge details ready.';
    return base;
  }
  if (/\b(?:guest|gues|guesst)\s+servic/.test(q)) {
    base.route = 'stadium';
    const guestServices = knowledge.documents.find(d => d.title.startsWith('Guest Services'));
    if (guestServices) addDoc(guestServices);
    const contact = knowledge.documents.find(d => d.title === 'ADA/Accessibility');
    if (contact) base.sources.push(source('Q2 Stadium Guest Services contact', contact.url, contact.checkedAt));
    base.answer = spanish ? 'Guest Services está en la explanada principal detrás de la sección 124. También puedes escribir a GuestServices@AustinFC.com para consultar con el estadio.' : 'Guest Services is on the main concourse behind section 124. You can also email GuestServices@AustinFC.com for stadium help.';
    return base;
  }
  if (/\b(buy|purchase|sell|transfer for me|book|comprar|compra|comprame|comprarme)\b/.test(q) && /\b(ticket|tickets|boleto|boletos|entrada|entradas)\b/.test(q)) {
    base.route = 'transaction';
    base.answer = spanish ? 'No puedo comprar ni transferir boletos por ti. Puedes hacerlo en el servicio oficial de boletos de Austin FC. Si necesitas ayuda con una transferencia, te explico los pasos.' : 'I can’t buy or transfer a ticket for you. Use Austin FC’s official ticket service for purchases and your Austin FC or SeatGeek app for transfers. I can walk you through the steps.';
    base.sources = [source('Austin FC tickets', TICKET_URL)];
    base.cards = [card('Official tickets', 'Buy and manage tickets', TICKET_URL, spanish ? 'Abrir boletos' : 'Open tickets')];
    return base;
  }
  if (/diaper|pa[nñ]al|childcare bag/.test(q)) {
    base.route = 'stadium';
    const bag = knowledge.documents.find(d => d.title === 'Bag Policy');
    if (bag) addDoc(bag);
    return base;
  }
  if (/\b(bag|backpack|purse|clutch|bolsa|bolso|mochila)\b/.test(q) && !/\b(food|popcorn|comida|palomitas)\b/.test(q)) {
    base.route = 'stadium';
    const bag = knowledge.documents.find(d => d.title === 'Bag Policy');
    if (bag) addDoc(bag);
    return base;
  }
  if (/sensory|sensorial/.test(q)) {
    base.route = 'stadium';
    const sensory = knowledge.documents.find(d => d.title.startsWith('Sensory Room'));
    if (sensory) addDoc(sensory);
    return base;
  }
  if (/\b(water|agua|hydration|refill|refillable|hydration station|fuente de agua|rellenar|botella|bottle)\b/.test(q) && !/\b(buy|purchase|bottled|comprar)\b/.test(q)) {
    base.route = 'stadium';
    const water = knowledge.documents.find(d => d.title === 'Water');
    if (water) addDoc(water);
    base.cards = [card('Stadium amenities', 'Hydration stations and water fountains', MAP_URL, spanish ? 'Ver mapa' : 'View map')];
    return base;
  }
  if (/\b(drinks?|beers?|wine|water|beverages?|soda|sprite|heineken|jellyfish|cocktail|margarita|bebidas?|cerveza|vino|agua|refresco|bar)\b/.test(q)) return foodGrounding('drinks',query,context,knowledge);
  if (/\b(food|eat|vegan|vegab|vegetarian|veggie|celiac|gluten|concessions?|nachos|pizza|tacos?|bao|shawarma|barbecue|bbq|burgers?|hamburgers?|chicken|wings?|tenders?|hot dogs?|comida|comer|vegano|vegana|vegetariano|vegetariana)\b/.test(q)) return foodGrounding('concessions',query,context,knowledge);
  const amenity=amenityGrounding(query,context,knowledge);if(amenity)return amenity;
  if (/\b(next.*(match|game|home|q2|austin fc)|schedule|opponent|roster|players?|goalkeepers?|standings|news|fixture|proximo partido|siguiente partido|calendario|plantilla|alineacion|noticias|porteros?|jugadores?|copa america)\b/.test(q) && !/\b(weather|rain|forecast|lluvia|llovera?|clima|pronostico)\b/.test(q) || /\b(join|tryout|academy)\b.*\b(player|team|club|austin fc)\b/.test(q)) { base.route = 'club'; return base; }
  if (/\b(weather|rain|temperature|forecast|lluvia|llovera?|clima|tiempo|pronostico)\b/.test(q)) { base.route = 'weather'; return base; }
  base.route = /\b(train|tren|rail|metro|bus|parking|park|rideshare|uber|transit|estacionamiento|transporte|red line|mckalla|directions|getting there|coming from|how do i get there|how do i get to the stadium|how do i get to q2|how do i get there and what time|student center)\b/.test(q) || (context.origin && /\b(?:from|i am at|i'm at|im at|leaving|starting at)\b/.test(q)) ? 'transport' : /\b(ticket|boleto|entrada|seatgeek|transfer|transferir)\b/.test(q) ? 'ticketing' : 'stadium';
  if(base.route==='transport')return travelGrounding(query,context,knowledge);
  if(base.route==='ticketing')return ticketGrounding(query,context,knowledge);
  const docs=searchDocs(query,knowledge,4);
  docs.forEach(addDoc);
  if (docs.length === 0 && base.route === 'stadium') base.answer = spanish ? 'No encontré una respuesta confirmada en las fuentes oficiales. Prueba con una pregunta más específica o consulta al personal de Guest Services.' : 'I couldn’t verify that from the current official sources. Try a more specific question or ask Guest Services at the stadium.';
  return base;
}
