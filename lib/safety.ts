import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { guestActions, STADIUM_TEXT } from './handoffs';
export function normalized(text: string) { return text.toLowerCase().replace(/\b(?:emergncy|emergancy|emrgency)\b/gi,'emergency').replace(/\b(?:medcal|medicle)\b/gi,'medical').replace(/\b(?:chlid|kiddo)\b/gi,'child').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’]/g, "'"); }
export type SafetyIntent = 'self-harm' | 'medical' | 'lost-person' | 'lost-item' | 'harassment' | 'evacuation';
// Safety never passes through model generation. These categories also cover planning questions.
export function safetyIntents(query: string): SafetyIntent[] {
  const q = normalized(query).replace(/\b(?:\d+|six|five|four|three|seven|eight|nine|ten)[ -]year[ -]old\b/g,'child').replace(/\b(?:pequeno|pequena|bebe)\b/g,'nino').replace(/(?:no veo|me separe de|se me perdio)/g,'perdi');
  const found: SafetyIntent[] = [];
  // Missing possessions/orders in another clause are not a missing person.
  const personQuery=q.replace(/\b(?:lost|missing|perdi|perdido|perdida)\s+(?:(?:my|the|his|her|our|mi|el|la|su)\s+)?(?:food order|drink order|order|ticket|wallet|phone|keys|bag|pass|parking pass|passport|jacket|car|pedido|comida|boleto|cartera|telefono|llaves)\b/g,'');
  const medicalQuery=q.replace(/emergency exit|salida de emergencia/g,'');
  const fireQuery=q.replace(/\b(?:wood.fired|fire.grilled|smoked (?:meat|bbq|chicken|brisket)|smok(?:e|ing)\s+(?:weed|cannabis|marijuana|tobacco|cigarettes?)|fumar\s+(?:marihuana|cannabis|tabaco))\b/g,'');
  if (/\b(suicid\w*|self.harm|kill myself|hurt myself|end my life|matarme|suicidarme|hacerme dano|quitarme la vida)\b|(?:thinking|going|want|about|done with everything).{0,60}(?:jump(?:ing)?|ending it)|(?:pienso|quiero|voy a|pensando).{0,50}(?:saltar|tirarme|lanzarme)/.test(q)) found.push('self-harm');
  if (/\b(medical|medic[oa]|first aid|primeros auxilios|emergency|emergencia|ambulance|ambulancia|chest pain|chest hurts|blood everywhere|bleed(?:ing)?|dolor (?:de|en el|en) pecho|heart attack|ataque al corazon|unconscious|inconsciente|fainted|desmay\w*|bleeding|sangr\w*|seizure|convulsion\w*|choking|suffocat\w*|asfixi\w*|ahog\w*|atragant\w*|heat ?stroke|heat exhaustion|throwing up|allergic reaction|reaccion alergica|broken bone|broken leg|head injury|hipoglucemia|low blood sugar|golpe de calor|agotamiento por calor|dizzy|dizziness|vomit\w*|maread\w*|vomitando|vomito|fiebre|fainted|collapsed|collapse|overdose|sobredosis|epipen|anaphylaxis|anafilax\w*)\b|(?:can'?t|cannot|not|no puedo|no puede)\s+(?:breathe|breathing|respirar)|trouble breathing|dificultad para respirar|throat.{0,20}(?:closing|swelling)|garganta.{0,20}(?:cerrando|hinch)|(?:can't|cannot) swallow|no puedo tragar|can'?t wake|won'?t wake/.test(medicalQuery)) found.push('medical');
  if (/(?:lost|missing|separated|can't find|cannot find|looking for|not find|disappeared|gone|perdi|perdido|perdida|extravio|desaparec\w*|no encuentro|no puedo encontrar).{0,70}(?:child|kid|son|daughter|boy|girl|person|friend|parent|father|mother|dad|mom|grandpa|grandma|grandchild|brother|sister|abuelo|abuela|nieto|nieta|hermano|hermana|wife|husband|hijo|hija|nino|nina|persona|padre|madre)|(?:child|kid|son|daughter|boy|girl|parent|father|mother|dad|mom|grandpa|grandma|grandchild|brother|sister|abuelo|abuela|nieto|nieta|hermano|hermana|friend|wife|husband|person|hijo|hija|nino|nina|persona).{0,45}(?:lost|missing|disappeared|gone|perdid\w*|desaparec\w*)/.test(personQuery)) found.push('lost-person');
  if (!found.includes('lost-person') && /\bfound\b.{0,40}\b(child|kid|boy|girl)|\b(child|kid|boy|girl|nino|nina)\b.{0,65}\b(alone|unaccompanied|crying|solo|sola|llorando)|\bencontre\b.{0,40}\b(nino|nina)\b/.test(q)) found.push('lost-person');
  if (/\b(lose|lost|missing|pierdo|perder|perdi|perdid[oa]|extravi\w*|left behind|found|no encuentro|cannot find|can't find)\b.{0,65}\b(something|item|wallet|phone|keys|bag|backpack|id|passport|jacket|purse|watch|algo|billetera|cartera|telefono|celular|llaves|mochila|bolsa|objeto|pasaporte)|\b(lost and found|objetos perdidos)\b|\b(wallet|phone|keys|bag|billetera|telefono|llaves)\b.{0,30}\b(lost|missing|disappeared|gone|perdid[oa])\b/.test(q)) found.push('lost-item');
  if (/\b(harass\w*|threaten\w*|assault\w*|fight|fighting|stalk\w*|racist|racism|abuse|abusing|grop\w*|acoso|acos\w*|amenaz\w*|agresi\w*|agred\w*|pele\w*|racista|racismo|me sigue|me esta siguiendo|me esta tocando|me estan tocando|me toco|me toca|manose\w*|touching me|touched me|following me|me persigue|tengo miedo|scared|afraid|unsafe|insegur\w*)\b|(?:grabb\w*|touch\w*|agarr\w*|tocando).{0,40}(?:girlfriend|boyfriend|wife|husband|daughter|son|novia|novio|esposa|esposo|hija|hijo)/.test(q)) found.push('harassment');
  if (/\b(evacuat\w*|evacua\w*|fire|incendio|smoke|humo|bomb|bomba|active shooter|gunshots|gunfire|shots fired|disparos|tirador|shelter|refugio|lightning|thunderstorm|tornado|hail|relampago|relampagos|rayos|granizo|tormenta electrica)\b|nearest (?:emergency )?exit|salida de emergencia/.test(fireQuery) && !/\b(?:smoking policy|smoke.free|politica de fumar)\b/.test(q)) found.push('evacuation');
  return found;
}
export function safetyGrounding(query: string, context: FanContext, knowledge: Snapshot): Grounding | undefined {
  const intents = safetyIntents(query); if (!intents.length) return;
  const es = context.language === 'es';
  const sections: string[] = [], titles: string[] = ['Text Messaging Service'];
  const actions = guestActions(es);
  for (const intent of intents) {
    if(intent==='self-harm') {
      titles.push('First Aid (St. David’s HealthCare)');
      sections.push(es?'Llama al 911 ahora y avisa inmediatamente al personal o seguridad más cercano. Aléjate de los bordes y ve a un lugar seguro si puedes; pide a alguien que se quede contigo mientras llega ayuda. Durante el evento envía tu sección, fila y asiento a 35-ASK-VERDE. No esperes una respuesta de este chat para pedir ayuda.':'Call 911 now and immediately alert the nearest staff member or security officer. Move away from edges to a safer place if you can; ask someone to stay with you until help arrives. During the event, text your section, row and seat to 35-ASK-VERDE. Do not wait for this chat before getting help.');
      actions.unshift({label:es?'Llamar al 911':'Call 911',href:'tel:911'});
    }
    if (intent === 'medical') {
      titles.push('First Aid (St. David’s HealthCare)');
      sections.push(es ? 'Ayuda médica: si hay peligro inmediato o una emergencia médica, llama al 911 y avisa al personal o a seguridad más cercano. Durante el evento, envía tu ubicación (sección, fila y asiento) a 35-ASK-VERDE (35-275-83733). First Aid está en la explanada principal detrás de la sección 124; también hay personal médico móvil. No retrases la ayuda para caminar hasta allí.' : 'Medical help: for immediate danger or a medical emergency, call 911 and alert the nearest staff member or security officer. During the event, text your location (section, row, seat) to 35-ASK-VERDE (35-275-83733). First Aid is on the main concourse behind section 124; roving medical personnel are also available. Do not delay getting help to walk there.');
      actions.unshift({label: es ? 'Llamar al 911' : 'Call 911', href: 'tel:911'});
    }
    if (intent === 'lost-person') {
      titles.push('Lost/Found Persons', 'Guest Services – Guest Services Center');
      sections.push(es ? 'Niño o persona perdida: avisa inmediatamente al personal de Guest Services, seguridad o policía más cercano. Envía la última ubicación y una descripción a 35-ASK-VERDE (35-275-83733), monitoreado durante el evento. Las personas encontradas se llevan a Guest Services detrás de la sección 124, donde un policía ayuda con la reunificación. Si hay peligro inmediato, llama al 911. No publiques datos personales del niño aquí.' : 'Lost child or person: immediately notify the nearest Guest Services teammate, security officer, or police officer. Text the last known location and a description to 35-ASK-VERDE (35-275-83733), monitored during the event. Found people are taken to Guest Services behind section 124, where a police officer assists with reunification. For immediate danger, call 911. Do not post the child’s personal details here.');
      actions.unshift({label: es ? 'Llamar al 911 si hay peligro inmediato' : 'Call 911 for immediate danger', href: 'tel:911'});
    }
    if (intent === 'lost-item') {
      titles.push('Lost and Found');
      sections.push(es ? 'Objeto perdido: ve a Guest Services en la explanada principal detrás de la sección 124. Para objetos de eventos anteriores, escribe a GuestServices@AustinFC.com. Durante el evento también puedes pedir ayuda por mensaje a 35-ASK-VERDE. No tengo acceso al inventario de objetos encontrados.' : 'Lost item: visit Guest Services on the main concourse behind section 124. For items lost at earlier events, email GuestServices@AustinFC.com. During the event you can also text 35-ASK-VERDE for help. I cannot access the lost-property inventory.');
    }
    if (intent === 'harassment') {
      titles.push('Code of Conduct');
      sections.push(es ? 'Si hay peligro inmediato, llama al 911. Avisa al personal o seguridad más cercano y envía tu sección, fila, asiento y una descripción a 35-ASK-VERDE durante el evento. Busca un lugar seguro y sigue las instrucciones del personal; no confrontes a la persona.' : 'For immediate danger, call 911. Alert the nearest staff or security officer and text your section, row, seat and a description to 35-ASK-VERDE during the event. Move to a safe place and follow staff instructions; do not confront the person.');
      actions.unshift({label: es ? 'Llamar al 911 si hay peligro inmediato' : 'Call 911 for immediate danger', href: 'tel:911'});
    }
    if (intent === 'evacuation') {
      titles.push('Code of Conduct','Weather');
      sections.push(es ? 'Evacuación: sigue los anuncios del estadio y las instrucciones de seguridad y del personal. Pide al personal más cercano la salida o refugio seguro indicado para tu ubicación y necesidades de accesibilidad. No puedo confirmar una salida específica ni si hay una evacuación activa. Si hay peligro inmediato, llama al 911; durante el evento también puedes avisar a 35-ASK-VERDE.' : 'Evacuation: follow stadium announcements and security/staff instructions. Ask the nearest staff member for the designated safe exit or shelter for your location and accessibility needs. I cannot confirm a specific exit or whether an evacuation is active. For immediate danger, call 911; during the event you can also alert 35-ASK-VERDE.');
      actions.unshift({label: es ? 'Llamar al 911 si hay peligro inmediato' : 'Call 911 for immediate danger', href: 'tel:911'});
    }
  }
  const documents = knowledge.documents.filter(d => titles.includes(d.title));
  return {route:'safety',context,facts:documents.map(d => `${d.title}: ${d.body}`),sources:documents.map(d => ({title:d.title,url:d.url,checkedAt:d.checkedAt})),cards:[],actions:actions.filter((a,i)=>actions.findIndex(b=>b.href===a.href)===i),answer:sections.join('\n\n')};
}
