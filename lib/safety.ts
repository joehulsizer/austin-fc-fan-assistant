import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { guestActions, STADIUM_TEXT } from './handoffs';
export function normalized(text: string) { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’]/g, "'"); }
export type SafetyIntent = 'medical' | 'lost-person' | 'lost-item' | 'harassment' | 'evacuation';
// Safety never passes through model generation. These categories also cover planning questions.
export function safetyIntents(query: string): SafetyIntent[] {
  const q = normalized(query).replace(/\b(?:\d+|six|five|four|three|seven|eight|nine|ten)[ -]year[ -]old\b/g,'child').replace(/\b(?:pequeno|pequena|bebe)\b/g,'nino').replace(/(?:no veo|me separe de|se me perdio)/g,'perdi');
  const found: SafetyIntent[] = [];
  const medicalQuery=q.replace(/emergency exit|salida de emergencia/g,'');
  const fireQuery=q.replace(/\b(?:wood.fired|fire.grilled|smoked (?:meat|bbq|chicken|brisket))\b/g,'');
  if (/\b(medical|medic[oa]|first aid|primeros auxilios|emergency|emergencia|ambulance|ambulancia|chest pain|dolor (?:de|en el) pecho|heart attack|ataque al corazon|unconscious|inconsciente|fainted|desmay\w*|bleeding|sangr\w*|seizure|convulsion\w*|choking|suffocat\w*|asfixi\w*|ahog\w*|atragant\w*|heat ?stroke|golpe de calor|overdose|sobredosis|epipen|anaphylaxis|anafilax\w*)\b|(?:can'?t|cannot|not|no puedo|no puede)\s+(?:breathe|breathing|respirar)|trouble breathing|dificultad para respirar|can'?t wake|won'?t wake/.test(medicalQuery)) found.push('medical');
  if (/(?:lost|missing|separated|can't find|cannot find|looking for|not find|disappeared|gone|perdi|perdido|perdida|extravio|desaparec\w*|no encuentro|no puedo encontrar).{0,70}(?:child|kid|son|daughter|boy|girl|person|friend|parent|father|mother|dad|mom|wife|husband|hijo|hija|nino|nina|persona|padre|madre)|(?:child|kid|son|daughter|boy|girl|parent|father|mother|dad|mom|friend|wife|husband|person|hijo|hija|nino|nina|persona).{0,45}(?:lost|missing|disappeared|gone|perdid\w*|desaparec\w*)/.test(q)) found.push('lost-person');
  if (!found.includes('lost-person') && /\bfound\b.{0,40}\b(child|kid|boy|girl)|\b(child|kid|boy|girl|nino|nina)\b.{0,65}\b(alone|unaccompanied|crying|solo|sola|llorando)|\bencontre\b.{0,40}\b(nino|nina)\b/.test(q)) found.push('lost-person');
  if (/\b(lost|missing|perdi|perdid[oa]|extravi\w*|left behind|found)\b.{0,65}\b(item|wallet|phone|keys|bag|backpack|id|passport|jacket|purse|watch|billetera|cartera|telefono|celular|llaves|mochila|bolsa|objeto|pasaporte)|\b(lost and found|objetos perdidos)\b|\b(wallet|phone|keys|bag|billetera|telefono|llaves)\b.{0,30}\b(lost|missing|disappeared|gone|perdid[oa])\b/.test(q)) found.push('lost-item');
  if (/\b(harass\w*|threaten\w*|assault\w*|fight|fighting|stalk\w*|racist|racism|abuse|abusing|grop\w*|acoso|acos\w*|amenaz\w*|agresi\w*|agred\w*|pele\w*|racista|racismo|me sigue|me esta tocando)\b/.test(q)) found.push('harassment');
  if (/\b(evacuat\w*|evacua\w*|fire|incendio|smoke|humo|bomb|bomba|active shooter|disparos|tirador|shelter|refugio)\b|nearest (?:emergency )?exit|salida de emergencia/.test(fireQuery)) found.push('evacuation');
  return found;
}
export function safetyGrounding(query: string, context: FanContext, knowledge: Snapshot): Grounding | undefined {
  const intents = safetyIntents(query); if (!intents.length) return;
  const es = context.language === 'es';
  const sections: string[] = [], titles: string[] = ['Text Messaging Service'];
  const actions = guestActions(es);
  for (const intent of intents) {
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
      sections.push(es ? 'Acoso o amenazas: avisa al personal o a seguridad más cercano y envía la ubicación y una descripción a 35-ASK-VERDE durante el evento. Si hay peligro inmediato, llama al 911. Busca un lugar seguro y sigue las instrucciones del personal; no confrontes a la persona.' : 'Harassment or threats: alert the nearest staff or security officer and text the location and a description to 35-ASK-VERDE during the event. For immediate danger, call 911. Move to a safe place and follow staff instructions; do not confront the person.');
      actions.unshift({label: es ? 'Llamar al 911 si hay peligro inmediato' : 'Call 911 for immediate danger', href: 'tel:911'});
    }
    if (intent === 'evacuation') {
      titles.push('Code of Conduct');
      sections.push(es ? 'Evacuación: sigue los anuncios del estadio y las instrucciones de seguridad y del personal. Pide al personal más cercano la salida o refugio seguro indicado para tu ubicación y necesidades de accesibilidad. No puedo confirmar una salida específica ni si hay una evacuación activa. Si hay peligro inmediato, llama al 911; durante el evento también puedes avisar a 35-ASK-VERDE.' : 'Evacuation: follow stadium announcements and security/staff instructions. Ask the nearest staff member for the designated safe exit or shelter for your location and accessibility needs. I cannot confirm a specific exit or whether an evacuation is active. For immediate danger, call 911; during the event you can also alert 35-ASK-VERDE.');
      actions.unshift({label: es ? 'Llamar al 911 si hay peligro inmediato' : 'Call 911 for immediate danger', href: 'tel:911'});
    }
  }
  const documents = knowledge.documents.filter(d => titles.includes(d.title));
  return {route:'safety',context,facts:documents.map(d => `${d.title}: ${d.body}`),sources:documents.map(d => ({title:d.title,url:d.url,checkedAt:d.checkedAt})),cards:[],actions:actions.filter((a,i)=>actions.findIndex(b=>b.href===a.href)===i),answer:sections.join('\n\n')};
}
