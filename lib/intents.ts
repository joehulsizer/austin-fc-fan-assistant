import { policyTopics, type Policy } from './policies';
import { normalized } from './safety';
export type Intent = { kind: 'ordering' | 'benefits' | 'refund' | 'transport' | 'weather' | 'club' | 'ticketing' | 'concessions' | 'drinks' | 'stadium' | 'security' | 'account'; query: string; policy?: Policy };
export function planIntents(query: string, priorTopic?: string): Intent[] {
  const q = normalized(query), intents: Intent[] = [];
  const push = (kind: Intent['kind'], subquery = query, policy?:Policy) => { if (!intents.some(i=>i.kind===kind&&i.policy===policy)) intents.push({kind,query:subquery,policy}); };
  if (/system prompt|developer (?:message|prompt)|ignore (?:all|previous|your)|print (?:your|the) (?:instructions|prompt)|api key|secret token|reveal (?:your|the)|ignora.{0,25}instrucciones|instrucciones del sistema/.test(q)) {push('security'); return intents;}
  const ordering = /\bordernext\b/.test(q) || /\b(order|ordering|deliver\w*|delivery|ordernext|pedido|pedir|pide|entreg\w*)\b/.test(q) && /\b(food|beer|hot dog|drink|seat|concession|mobile|comida|cerveza|asiento|comer|bebida)\b/.test(q);
  const benefit = /\b(stm|season ticket|season.?ticket|member|membership|abonado|socio)\b/.test(q) && /\b(discount|benefit|food|comida|descuento|beneficio)\b/.test(q);
  const refund = /refund|charged|payment|paid|never received|didn.t receive|missing order|reembolso|cobro|cobraron|devolucion/.test(q);
  if (/\b(balance|loyalty wallet|wallet balance|account balance|loyalty points|saldo|billetera|puntos de lealtad)\b/.test(q)) push('account');
  if (refund) push('refund');
  else if (benefit) push('benefits');
  else if (ordering) push('ordering');
  const policies = policyTopics(query);
  policies.forEach(p=>push('stadium', query, p));
  const travel = /\b(parking|park|rideshare|uber|lyft|taxi|train|rail|red line|mckalla|transit|transport|transportation|bus|bike|bicycle|directions|route|fastest|estacionamiento|aparcar|tren|autobus|bicicleta|transporte|ruta)\b|(?:get|getting|go|travel) to (?:q2|the stadium|there)|getting (?:there|here)|coming from|llegar (?:al|a) (?:q2|estadio)|como llego|when should i leave|what time should i (?:leave|do it)|leave.by|salir|salimos|desde|somos de|salgo de|student center/.test(q) || priorTopic==='transport' && /how long|arrive|leave|departure|cuanto tarda|salir|llegar/.test(q);
  if (travel) push('transport');
  if (/(?:hot|cold|windy|wind).{0,30}(?:kickoff|today|tomorrow|tonight|outside)|\b(weather|rain|raining|raincoat|temperature|forecast|lluvia|llovera|clima|pronostico|llover|frio|calor)\b/.test(q)) push('weather');
  const other = /concert|concierto|festival|non.match|private event/.test(q);
  if (!other && /\b(next|upcoming|proximo|siguiente)\b.{0,45}\b(match|game|home|partido|casa|rival|q2|fixture)\b|\b(schedule|roster|players?|goalkeepers?|standings|news|fixtures?|calendario|plantilla|noticias|porteros?|jugadores?|copa america|tryouts?|academy|coach)\b|join.{0,30}(?:team|club|player)/.test(q)) push('club');
  if (!refund && /\b(tickets?|boletos?|entradas?|seatgeek|transfer|transferir|recipient)\b/.test(q)) push('ticketing');
  if (!refund&&!benefit&&!ordering) {
    if (!policies.includes('alcohol') && /\b(drinks?|beers?|wine|soda|sprite|coke|heineken|jellyfish|non.alcoholic|bottled water|cocktail|margarita|bebidas?|cerveza|vino|refresco|bar)\b/.test(q)) push('drinks');
    if (/\b(food|eat|vegan|vegab|vegetarian|veggie|celiac|gluten|concessions?|nachos|pizza|tacos?|bao|shawarma|barbecue|bbq|burgers?|hamburgers?|chicken|wings?|tenders?|hot dogs?|comida|comer|vegano|vegana|vegetariano|vegetariana|sin gluten)\b/.test(q)) push('concessions', policies.length || intents.some(i=>i.kind==='drinks') ? `${query.replace(/\b(?:beer|drinks?|water bottle|backpack|bag|kickoff|rain|parking|ticket)\b/gi,'')} food` : query);
  }
  if (!intents.length && /\b(?:from|i am at|i'm at|im at|starting at|leaving)\b/.test(q) && !/\bsection\b/.test(q)) push('transport');
  if (!intents.length) push('stadium');
  return intents;
}
