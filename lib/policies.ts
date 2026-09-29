import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { normalized } from './safety';
import { guestActions } from './handoffs';
export type Policy = 'bag' | 'water' | 'alcohol' | 'gates' | 'sensory' | 'guest';
export function policyTopics(query: string): Policy[] {
  const q = normalized(query), topics: Policy[] = [];
  if (/\b(bags?|backpacks?|purses?|clutches?|totes?|satchel|bolsas?|bolsos?|mochila|diaper|panalera|panales)\b/.test(q) && !/\b(popcorn|palomitas)\b/.test(q)) topics.push('bag');
  if (/\b(bottle|hydroflask|thermos|sippy cup|botella|refill|refillable|hydration|sealed|rellenar|hidratacion)\b|bring.{0,20}water|llevar.{0,20}agua|water (?:policy|fountain|station)/.test(q)) topics.push('water');
  if (/(?:dejan|deja|paran|cortan).{0,25}(?:vender|venta|servir).{0,20}(?:cerveza|alcohol|bebidas)|\b(alcohol|beer|cerveza|drinks?|bebidas?)\b.{0,70}\b(cut.?off|stop|end|last call|serve|serving|vender|dejan|termina)|\b(cut.?off|last call|hasta cuando)\b.{0,50}\b(beer|alcohol|cerveza|drinks?)|\b(alcohol policy|politica de alcohol)\b/.test(q)) topics.push('alcohol');
  if (/\b(gates?|puertas?|entry|entrance|entrar)\b.{0,50}\b(open|opening|time|early|when|abren|apertura|hora)|\b(when|what time|cuando|hora)\b.{0,40}\b(gates?|puertas?|enter|entrar)|\bgate times?\b|how early.{0,30}(?:get in|enter)|when.{0,25}(?:get inside|go in)/.test(q)) topics.push('gates');
  if (/\b(sensory|sensorial)\b/.test(q)) topics.push('sensory');
  if (/\b(?:guest|gues|guesst)\s+servic/.test(q)) topics.push('guest');
  return topics;
}
export function policyGrounding(topic: Policy, query: string, context: FanContext, knowledge: Snapshot): Grounding {
  const es = context.language === 'es', q = normalized(query);
  const titles: Record<Policy,string[]> = {bag:['Bag Policy'],water:['Water'],alcohol:['Alcohol Policy'],gates:['Gate Opening Times'],sensory:["Sensory Room (Presented by St. David's HealthCare)",'First Aid (St. David’s HealthCare)','ADA/Accessibility'],guest:['Guest Services – Guest Services Center','ADA/Accessibility']};
  const docs = knowledge.documents.filter(d=>titles[topic].includes(d.title));
  let answer = '';
  if (topic === 'bag') {
    answer = /diaper|panal|childcare/.test(q) ? (es ? 'Pañalera: Q2 considera una excepción para bolsas de cuidado infantil cuando te acompaña un niño, tras revisión de seguridad.' : 'Diaper bag: Q2 considers an exception for childcare bags when accompanied by a child, after security screening.')
      : es ? 'Bolsas/mochilas: Q2 prohíbe la mayoría de las bolsas y mochilas. Tras revisión de seguridad, considera excepciones para bolsos del tamaño de la mano (aproximadamente 8 × 5 × 1 pulgadas), bolsas médicas, culturales y de cuidado infantil cuando te acompaña un niño.' : 'Bags/backpacks: Q2 prohibits most bags and backpacks. After security screening, it considers exceptions for hand-sized clutches (approximately 8 × 5 × 1 inches), medical bags, cultural bags, and childcare bags when accompanied by a child.';
    if (/clear|transparen/.test(q)) answer += es ? ' Ser transparente no crea una excepción para una mochila.' : ' A clear backpack does not receive an exception just because it is transparent.';
    if (/diaper|panal|childcare/.test(q) && /without|no child|not.*child|sin.*nin/.test(q)) answer += es ? ' Sin un niño contigo, esa excepción de cuidado infantil no aplica.' : ' Without a child accompanying you, that childcare exception does not apply.';
    if (/camera|camara/.test(q)) answer += es ? ' Una bolsa para cámara no tiene una excepción propia publicada.' : ' A camera bag has no separate listed exemption.';
  }
  if (topic === 'water') answer = es ? 'Botella de agua: cada persona puede llevar un recipiente vacío de hasta 30 onzas. No se permiten bebidas selladas; te pedirán vaciarlo al entrar. Rellénalo en las estaciones YETI de las esquinas sureste y noroeste o en las fuentes del estadio.' : 'Water bottle: each guest may bring one empty drink vessel of 30 ounces or less. Sealed beverages are not permitted; you will be asked to empty the vessel at entry. Refill at the YETI stations in the southeast and northwest corners or other stadium water fountains.';
  if (topic === 'alcohol') answer = es ? 'Venta de alcohol: para partidos de Austin FC, el corte es en el minuto 80 en la mayoría del estadio; la gerencia puede suspender antes el servicio. Algunos espacios de club reanudan servicio después del silbatazo final. Para conciertos y otros eventos, la política puede cambiar; confirma con el personal. Debes tener 21 años o más e identificación válida.' : 'Alcohol cutoff: for Austin FC matches, sales end at the 80th minute in the majority of the stadium; management may stop service earlier. Select club spaces resume service after the final whistle. For concerts and other events, the policy can change; confirm with staff. You must be 21 or older with valid ID.';
  if (topic === 'gates') answer = es ? 'Apertura de puertas: la regla publicada es generalmente 90 minutos antes del inicio del evento, sujeta a cambios según el evento. Confirma el horario específico en la página o app del evento; no es una hora de apertura garantizada para un concierto.' : 'Gate opening: the published general rule is 90 minutes before the event starts, subject to change by event. Check the event page or app for its specific time; this is not a guaranteed concert gate time.';
  if (topic === 'sensory') answer = es ? 'Sala sensorial: consulta con Guest Services detrás de la sección 124 para registrarte y recibir indicaciones. El mismo sitio oficial tiene ubicaciones contradictorias: la entrada de sala sensorial dice 125 y la de First Aid dice 124. No puedo confirmar la puerta exacta; Guest Services también ofrece kits sensoriales.' : 'Sensory room: check in with Guest Services behind section 124 for directions. The official guide has conflicting locations: the Sensory Room entry says 125, while First Aid says 124. I cannot confirm the exact door; Guest Services also provides sensory kits.';
  if (topic === 'guest') answer = es ? 'Guest Services está en la explanada principal detrás de la sección 124. Escribe a GuestServices@AustinFC.com o, durante el evento, envía un mensaje a 35-ASK-VERDE.' : 'Guest Services is on the main concourse behind section 124. Email GuestServices@AustinFC.com or, during the event, text 35-ASK-VERDE.';
  // Never state a policy whose current document no longer supports the fixed answer.
  const anchors:Record<Policy,RegExp> = {bag:/8.{0,5}5.{0,5}1/,water:/30/,alcohol:/80th/,gates:/ninety|90/,sensory:/124/,guest:/124/};
  if (!docs.some(d=>anchors[topic].test(d.body))) answer = es ? 'No puedo verificar esa política en la versión actual. Consulta a Guest Services con el botón de abajo.' : 'I cannot verify that policy in the current version. Contact Guest Services using the button below.';
  return {route:'stadium',context,facts:docs.map(d=>`${d.title}: ${d.body}`),sources:docs.map(d=>({title:d.title,url:d.url,checkedAt:d.checkedAt})),cards:[],actions:guestActions(es),answer};
}
