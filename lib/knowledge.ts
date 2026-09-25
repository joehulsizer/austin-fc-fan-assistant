import bundled from '@/data/knowledge.json';
import type { Card, FanContext, Grounding, Source } from './types';

type Doc = { id: string; title: string; body: string; url: string; checkedAt: string; links: { label: string; url: string }[] };
type Vendor = { name: string; sections: number[]; location: string; description: string; url: string; checkedAt: string };
export type Snapshot = { version: string; checkedAt: string; documents: Doc[]; vendors: Vendor[]; sources: { url: string; sha256: string }[]; featuredMatch?: { title: string; startsAt: string; url: string; checkedAt: string } | null; roster?: { number: number; name: string; position: string; url: string }[]; news?: { title: string; summary: string; url: string }[] };
export const staticKnowledge = bundled as Snapshot;
export const MAP_URL = 'https://www.q2stadium.com/stadium-maps/';
export const TICKET_URL = 'https://www.austinfc.com/tickets/';
export const MOBILE_TICKET_URL = 'https://www.austinfc.com/tickets/mobile-ticketing';
export const TRANSIT_URL = 'https://www.capmetro.org/special-events/Q2';
const POLICY_URL = 'https://www.q2stadium.com/a-z-policy-guide/';

export async function getKnowledge(): Promise<Snapshot> {
  const pointer = process.env.KNOWLEDGE_BLOB_URL;
  if (!pointer) return staticKnowledge;
  try {
    const response = await fetch(pointer, { next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Knowledge unavailable');
    const value = await response.json();
    if ((value.documents?.length ?? 0) < 40 || (value.vendors?.length ?? 0) < 15 || (value.roster?.length ?? 0) < 15 || (value.news?.length ?? 0) < 3) throw new Error('Knowledge incomplete');
    return value as Snapshot;
  } catch { return staticKnowledge; }
}

export function detectContext(query: string, previous: FanContext): FanContext {
  const context: FanContext = { ...previous };
  const section = query.match(/(?:section|sec\.?|secci[oó]n|secc\.?|sectoin)\s*#?\s*(\d{3})\b/i);
  if (section) context.section = Number(section[1]);
  if (/\b(vegan|vegab|vegano|vegana)\b/i.test(query)) context.dietary = 'vegan';
  else if (/\b(vegetarian|vegetariano|vegetariana|veggie)\b/i.test(query)) context.dietary = 'vegetarian';
  else if (/\b(gluten|celiac|celiaco|celíaco)\b/i.test(query)) context.dietary = 'gluten-aware';
  if (/[¿¡]|\b(d[oó]nde|comida|boleto|entrada|estadio|puedo|para|c[oó]mo|quiero|tren|estacionamiento)\b/i.test(query)) context.language = 'es';
  else if (/\b(english|in english)\b/i.test(query)) context.language = 'en';
  return context;
}

const same = (zoneA: string, zoneB: string) => zoneA === zoneB ? 0 : ({
  south: ['west', 'east'], west: ['south', 'northwest'], northwest: ['west', 'northeast'],
  northeast: ['northwest', 'east'], east: ['northeast', 'south'],
} as Record<string, string[]>)[zoneA]?.includes(zoneB) ? 1 : 2;

export function sectionZone(section: number): string {
  if (section >= 101 && section <= 108) return 'south';
  if (section >= 109 && section <= 118) return 'west';
  if (section >= 119 && section <= 125) return 'northwest';
  if (section >= 126 && section <= 128) return 'northeast';
  if (section >= 129 && section <= 137) return 'east';
  return 'other level';
}

function rankVendor(v: Vendor, section?: number) {
  if (!section) return 0;
  return Math.min(...v.sections.map(s => s === section ? -1 : same(sectionZone(section), sectionZone(s))));
}

function source(title: string, url: string, checkedAt = staticKnowledge.checkedAt): Source { return { title, url, checkedAt }; }
function card(title: string, detail: string, href: string, label = 'Open official page'): Card { return { title, detail, href, label }; }

const DIET: Record<string, { vegan?: string; vegetarian?: string; glutenAware?: string }> = {
  'Bao’d Up': { vegan: 'Creamy Veggie bao; vegan mayo' },
  'Verde Vegan & Wine Bar': { vegan: 'Vegan menu, including chili dog; listed bowls are avoiding gluten' },
  'Double Dave’s': { vegetarian: 'Cheese pizza slice or Chee-z Rolls; popcorn is listed vegan and avoiding gluten', vegan: 'Popcorn is listed vegan and avoiding gluten' },
  OneTaco: { vegetarian: 'Chips and queso or quesobirria are listed vegetarian and avoiding gluten', glutenAware: 'Chips and queso or quesobirria are listed as avoiding gluten' },
  'Shawarma Point': { vegetarian: 'Falafel wrap or salad; hummus and pita', vegan: 'The stadium guide labels this vendor vegan/vegetarian, but confirm the specific item before ordering', glutenAware: 'Tabouli and chips are listed as avoiding gluten' },
  'Little Patagonia': { vegetarian: 'Vegetarian options listed; ask the stand which are available' },
  'Eastside Eats': { vegetarian: 'Cheese nachos, popcorn or soft pretzels listed in the stadium guide', vegan: 'Popcorn is listed vegan', glutenAware: 'Cheese nachos or popcorn are listed as avoiding gluten' },
};

export function searchDocs(query: string, knowledge: Snapshot, count = 4): Doc[] {
  const normalized = normalize(query);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  const aliases: Record<string, string> = {
    diaper: 'bag childcare', mochila: 'bag', bolsa: 'bag', bolso: 'bag',
    train: 'rail metro capmetro', tren: 'rail metro capmetro', estacionamiento: 'parking',
    ticket: 'ticket seatgeek', boleto: 'ticket', entrada: 'ticket',
    bathroom: 'restrooms', restroom: 'restrooms', bano: 'restrooms',
    water: 'water hydration', agua: 'water hydration',
    sensory: 'sensory room', sensorial: 'sensory room',
    wheelchair: 'ada accessibility wheelchair', silla: 'wheelchair accessibility',
    transfer: 'ticket will call transfer', transferir: 'ticket will call transfer',
  };
  const terms = new Set(words.flatMap(w => [w, ...(aliases[w]?.split(' ') || [])]));
  return knowledge.documents.map(d => {
    const title = normalize(d.title), body = normalize(d.body);
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      if (body.includes(term)) score += 1;
    }
    if (/parking|estacionamiento/.test(normalized) && d.id === 'parking') score += 12;
    if (/rail|train|tren|bus|rideshare|uber|metro/.test(normalized) && d.id === 'directions') score += 12;
    return { d, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, count).map(x => x.d);
}

function normalize(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

export async function ground(query: string, oldContext: FanContext): Promise<Grounding> {
  const knowledge = await getKnowledge();
  const context = detectContext(query, oldContext);
  const spanish = context.language === 'es';
  const q = normalize(query);
  const base: Grounding = { route: 'general', context, facts: [], sources: [], cards: [] };
  const addDoc = (d: Doc) => { base.facts.push(`${d.title}: ${d.body.slice(0, 2400)}`); base.sources.push(source(d.title, d.url, d.checkedAt)); };
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
  if (/\b(drinks?|beers?|wine|water|beverages?|soda|cocktail|margarita|bebidas?|cerveza|vino|agua|refresco|bar)\b/.test(q)) {
    base.route = 'drinks';
    const vendors = knowledge.vendors.filter(v => /Bar|Draft|Wine|Heineken|Michelob/.test(v.name)).sort((a, b) => rankVendor(a, context.section) - rankVendor(b, context.section)).slice(0, 5);
    for (const v of vendors) { base.facts.push(`${v.name}: ${v.location}. ${v.description}`); base.cards.push(card(v.name, v.location, MAP_URL, spanish ? 'Ver mapa' : 'View map')); }
    base.sources = [source('Q2 Stadium vendors', 'https://www.q2stadium.com/food-and-drink/our-vendors/', knowledge.checkedAt), source('Q2 Stadium beverage menu', 'https://www.q2stadium.com/food-and-drink/drink-menu/', knowledge.checkedAt)];
    if (!context.section) base.facts.push('Ask for the fan section before suggesting a nearby area.');
    return base;
  }
  if (/\b(food|eat|vegan|vegab|vegetarian|veggie|celiac|celiaco|gluten|concession|nachos|pizza|taco|bao|shawarma|barbecue|bbq|comida|comer|vegano|vegetariano|vegetariana|sin gluten)\b/.test(q) || (context.dietary && /\b(near|nearby|closest|options|about|what else|where|d[oó]nde|que mas)\b/.test(q))) {
    base.route = 'concessions';
    let matches = knowledge.vendors.filter(v => {
      const named = q.includes(normalize(v.name)) || normalize(v.name + ' ' + v.description).includes(q.replace(/^(where|do|can|i|find|is|the|a|an|at|in|section|food|comida|near|me|what|about|are|vegan|vegetarian|gluten|options|donde|hay|para|mi|quiero|quieres|un|una|de|el|la)\s+/g, '').trim());
      const diet = DIET[v.name];
      return context.dietary ? Boolean(diet?.[context.dietary === 'gluten-aware' ? 'glutenAware' : context.dietary]) : named || /food|comida|eat|comer|concession/.test(q);
    });
    if (matches.length === 0 && context.dietary) matches = knowledge.vendors.filter(v => Boolean(DIET[v.name]?.[context.dietary === 'gluten-aware' ? 'glutenAware' : context.dietary!]));
    matches.sort((a, b) => rankVendor(a, context.section) - rankVendor(b, context.section));
    matches = matches.slice(0, 6);
    for (const v of matches) {
      const diet = DIET[v.name];
      const dietaryDetail = context.dietary && diet ? diet[context.dietary === 'gluten-aware' ? 'glutenAware' : context.dietary] : undefined;
      base.facts.push(`${v.name}: ${v.location}. ${dietaryDetail || v.description}`);
      base.cards.push(card(v.name, v.location, MAP_URL, spanish ? 'Ver mapa' : 'View map'));
    }
    base.sources = [source('Q2 Stadium vendors', 'https://www.q2stadium.com/food-and-drink/our-vendors/', knowledge.checkedAt), source('Q2 Stadium policy and dietary guide', POLICY_URL, knowledge.checkedAt), source('Official stadium map', MAP_URL, knowledge.checkedAt)];
    if (!context.section) base.facts.push('Ask the fan for their section to suggest an approximate area. Do not claim nearest or precise walking distance.');
    if (context.dietary === 'gluten-aware') base.facts.push('The stadium calls these options "avoiding gluten" or "gluten-aware"; do not promise allergy or celiac safety. Ask staff about ingredients and cross-contact.');
    if (matches.length === 0) base.answer = spanish ? 'No encontré una opción publicada que pueda confirmar. Dime qué buscas y tu sección para revisar las opciones oficiales.' : 'I could not verify a published option for that request. Tell me what you want and your section, and I’ll narrow down the official listings.';
    return base;
  }
  if (/\b(next.*(match|game|home|q2|austin fc)|schedule|opponent|roster|players?|goalkeepers?|standings|news|fixture|proximo partido|siguiente partido|calendario|plantilla|alineacion|noticias|porteros?|jugadores?|copa america)\b/.test(q) && !/\b(weather|rain|forecast|lluvia|llovera?|clima|pronostico)\b/.test(q) || /\b(join|tryout|academy)\b.*\b(player|team|club|austin fc)\b/.test(q)) { base.route = 'club'; return base; }
  if (/\b(weather|rain|temperature|forecast|kickoff|lluvia|llovera?|clima|tiempo|pronostico|inicio del partido)\b/.test(q)) { base.route = 'weather'; return base; }
  base.route = /\b(train|tren|rail|metro|bus|parking|park|rideshare|uber|transit|estacionamiento|transporte|red line|mckalla)\b/.test(q) ? 'transport' : /\b(ticket|boleto|entrada|seatgeek|transfer|transferir)\b/.test(q) ? 'ticketing' : 'stadium';
  const docs = searchDocs(query, knowledge, 4);
  docs.forEach(addDoc);
  if (base.route === 'ticketing') {
    const transferring = /transfer|send|share|recipient|transferir|enviar/.test(q);
    base.cards.push(card(transferring ? 'Mobile ticketing guide' : 'Austin FC tickets', transferring ? 'Access, send, and manage tickets' : 'Official purchase and ticket management', transferring ? MOBILE_TICKET_URL : TICKET_URL));
    base.sources.push(source(transferring ? 'Austin FC mobile ticketing' : 'Austin FC tickets', transferring ? MOBILE_TICKET_URL : TICKET_URL));
  }
  if (base.route === 'transport') { base.cards.push(card('Plan your trip', 'CapMetro event service', TRANSIT_URL)); base.sources.push(source('CapMetro event service', TRANSIT_URL)); }
  if (docs.length === 0) base.answer = spanish ? 'No encontré una respuesta confirmada en las fuentes oficiales. Prueba con una pregunta más específica o consulta al personal de Guest Services.' : 'I couldn’t verify that from the current official sources. Try a more specific question or ask Guest Services at the stadium.';
  return base;
}
