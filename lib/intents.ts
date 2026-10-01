import { policyTopics, type Policy } from './policies';
import { normalized } from './safety';
export type Intent = { kind: 'ordering' | 'benefits' | 'refund' | 'transport' | 'weather' | 'club' | 'ticketing' | 'concessions' | 'drinks' | 'stadium' | 'security' | 'account'; query: string; policy?: Policy };
export function planIntents(query: string, priorTopic?: string): Intent[] {
  const q = normalized(query).replace(/\ba lot of\b/g,'many'), intents: Intent[] = [];
  const push = (kind: Intent['kind'], subquery = query, policy?:Policy) => { if (!intents.some(i=>i.kind===kind&&i.policy===policy)) intents.push({kind,query:subquery,policy}); };
  if (/system prompt|developer (?:message|prompt)|ignore (?:all|previous|your)|print (?:your|the) (?:instructions|prompt)|api key|secret token|reveal (?:your|the)|ignora.{0,25}instrucciones|instrucciones del sistema/.test(q)) {push('security'); return intents;}
  const ordering = /\bordernext\b/.test(q) || /\b(order|ordering|deliver\w*|delivery|ordernext|pedido|pedir|pide|entreg\w*)\b/.test(q) && /\b(food|beer|hot dog|drink|seat|concession|mobile|comida|cerveza|asiento|comer|bebida)\b/.test(q);
  const benefit = /\b(stm|season ticket|season.?ticket|member|membership|abonados?|socios?)\b/.test(q) && /\b(discount|benefit|food|comida|descuento|beneficio)\b/.test(q);
  const refund = /refund|charged|paid.{0,35}(?:never|didn.t|missing)|never received|didn.t receive|missing order|payment (?:failed|error)|reembolso|cobraron|devolucion/.test(q);
  if (/\b(balance|loyalty wallet|wallet balance|account balance|loyalty points|saldo|billetera|puntos de lealtad)\b/.test(q)) push('account');
  if (refund) push('refund');
  else if (benefit) push('benefits');
  else if (ordering) push('ordering');
  const policies = policyTopics(query).filter(p=>p!=='children'||!(/refund|reembolso|missing|lost|barcode|perdi|no encuentro/.test(q))||/\b(?:age|ages|year.old|anos|edad|lap|regazo)\b|(?:need|necesita).{0,20}(?:ticket|boleto)/.test(q));
  policies.forEach(p=>push('stadium', query, p));
  const travel = /\b(parking|park|lots?|garages?|rideshare|uber|lyft|taxi|train|rail|red line|mckalla|capmetro|transit|transport|transportation|bus|bike|bicycle|walk|walking|on foot|caminar|caminando|a pie|directions|route|fastest|estacionamiento|aparcar|tren|autobus|bicicleta|transporte|ruta)\b|(?:get|getting|go|travel) to (?:q2|the stadium|there)|getting (?:there|here)|coming from|llegar (?:al|a) (?:q2|estadio)|como llego|when should i leave|what time should i (?:leave|do it)|leave.by|salir|salimos|desde.{0,80}(?:q2|estadio|llegar)|student center|drop.?off|pick.?up/.test(q) || priorTopic==='transport' && /how long|arrive|leave|departure|cuanto tarda|salir|llegar/.test(q);
  if ((travel||/park.?and.?ride|fare|umo|pago.{0,30}(?:tren|autobus)|pay.{0,30}(?:capmetro|train|bus)|tarifa|pagar.{0,30}(?:tren|autobus)/.test(q)) && !policies.some(p=>['tailgating','vehicle','ev','smoking','entrance','reentry'].includes(p)) && !(ordering&&/pick.?up/.test(q)&&!/uber|lyft|taxi|rideshare|drop.?off/.test(q))) push('transport');
  if (!policies.includes('weatherpolicy') && /(?:hot|cold|windy|wind).{0,30}(?:kickoff|today|tomorrow|tonight|outside)|\b(weather|rain|raining|raincoat|temperature|forecast|lluvia|llovera|clima|pronostico|llover|frio|calor)\b/.test(q)) push('weather');
  const other = /concert|concierto|festival|non.match|private event/.test(q);
  if (!other && /\b(next|upcoming|proximo|siguiente)\b.{0,45}\b(match|game|home|partido|casa|rival|q2|fixture)\b|\b(?:match|game|kickoff|partido)\b.{0,35}\b(?:tonight|today|tomorrow|saturday|sunday|after|hoy|manana|sabado|domingo|despues)\b|\b(schedule|roster|players?|goalkeepers?|standings|news|fixtures?|calendario|plantilla|noticias|porteros?|jugadores?|copa america|tryouts?|academy|coach)\b|join.{0,30}(?:team|club|player)/.test(q)) push('club');
  const transitFare=/capmetro|umo|\b(?:train|bus|rail)\b.{0,30}(?:fare|pay|payment|tickets?|discount)|\bfare\b|tarifa|(?:pago|pagar|paga).{0,35}(?:tren|autobus|boleto del tren)/.test(q)&&!/austin fc.{0,20}ticket|match.{0,20}ticket|ticket.{0,20}match/.test(q);
  if (!refund && !transitFare && (!benefit||/\b(?:buy|purchase|transfer|transferir|traspasar|barcode|sign.?in|log.?in|comprar)\b/.test(q)) && (/\b(?:student|military|estudiante|militar)\b.{0,25}\b(?:discount|descuento)/.test(q)||/\b(tickets?|boletos?|entradas?|seatgeek|transfer|transferir|transfiere|traspasar|recipient|send button|boton enviar|codigo de barras|barcode|bar code|phone died|phone is dead|telefono.{0,15}bateria|facebook marketplace)\b/.test(q)) && (!policies.includes('reentry')) && (!policies.includes('children')||/\b(buy|purchase|transfer|comprar|transferir)\b/.test(q))) push('ticketing');
  if (!refund&&!benefit&&!ordering && !policies.some(p=>['cashless','allergy','weatherpolicy','smoking','tailgating'].includes(p))) {
    if (!policies.includes('alcohol') && /\b(drinks?|beers?|wine|soda|sprite|coke|heineken|jellyfish|non.alcoholic|bottled water|cocktail|margarita|bebidas?|cerveza|vino|refresco|bar)\b/.test(q)) push('drinks');
    if (!(policies.includes('prohibited')&&/outside (?:food|drink)|own food|sandwich|snacks|comida de fuera/.test(q)) && /\b(food|eat|vegan|vegab|vegetarian|veggie|celiac|gluten|concessions?|nachos|pizza|tacos?|bao|shawarma|barbecue|bbq|burgers?|hamburgers?|chicken|wings?|tenders?|hot dogs?|helado|ice cream|chocolate|gelato|donuts?|coffee|cappuccino|churros?|comida|comer|vegano|vegana|vegetariano|vegetariana|sin gluten)\b/.test(q)) push('concessions', policies.length || intents.some(i=>i.kind==='drinks') ? `${query.replace(/\b(?:beer|drinks?|water bottle|backpack|bag|kickoff|rain|parking|ticket)\b/gi,'')} food` : query);
  }
  if (!intents.length && /\b(?:from|i am at|i'm at|im at|starting at|leaving|desde|somos de|salgo de|staying at)\b/.test(q) && !/\bsection\b|\b(?:in|en)\s+\d{3}\b/.test(q)) push('transport');
  if (!intents.length) push('stadium');
  return intents;
}
