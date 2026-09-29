import transitCheck from '@/data/transit-source-check.json';
import parking from '@/data/parking-reviewed.json';
import type { Action, FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { mapsActions, guestActions } from './handoffs';
import { normalized } from './safety';
const TRANSIT = 'https://www.capmetro.org/special-events/Q2';
const PARKING = 'https://seatgeek.com/venues/q2-stadium/parking';
type Mode = Exclude<NonNullable<FanContext['travelMode']>, 'all'>;
function timeString(minutes: number) {
  const day = minutes < 0 ? ' (previous day)' : '';
  const m = ((minutes % 1440) + 1440) % 1440, h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}${day} CT`;
}
export function travelModes(query: string, context: FanContext): Mode[] {
  const q = normalized(query);
  if (/all (?:five|5|the )?(?:options|ways|modes)|show (?:my |travel |the )?options|compare.{0,30}(?:car|rideshare|train|bus|bike)|todas las opciones/.test(q)) return ['car', 'rideshare', 'rail', 'bus', 'bike'];
  const modes: Mode[] = [];
  if (/park.?and.?ride|park & ride/.test(q)) return ['bus', 'rail'];
  if (/\b(parking|park|lot|garage|estacionamiento|aparcar|estacionar)\b/.test(q)) modes.push('parking');
  if (/\b(rideshare|uber|lyft|taxi|pick.?up|drop.?off)\b/.test(q)) modes.push('rideshare');
  if (/\b(train|rail|red line|mckalla|tren|ferrocarril)\b/.test(q)) modes.push('rail');
  if (/\b(bus|803|autobus|camion)\b/.test(q)) modes.push('bus');
  if (/\b(bike|bicycle|cycling|biking|bicicleta)\b/.test(q)) modes.push('bike');
  if (/\b(car|drive|driving|auto|coche|manejar)\b/.test(q) && !modes.includes('parking')) modes.push('car');
  if (modes.length) return modes;
  if (/fastest|quickest|mas rapido|rapida/.test(q)) return context.origin === 'UT Austin' ? ['bus', 'car'] : ['car', 'bus', 'rail'];
  if (context.travelMode && context.travelMode !== 'all') return [context.travelMode];
  return ['car', 'rideshare', 'rail', 'bus', 'bike'];
}
export function travelGrounding(query: string, context: FanContext, knowledge: Snapshot): Grounding {
  const q = normalized(query), es = context.language === 'es', other = context.eventKind === 'other';
  const modes = travelModes(query, context), onlyParking = modes.length === 1 && modes[0] === 'parking';
  const accessible = /accessible|ada|wheelchair|accesib|silla de ruedas|movilidad reducida/.test(q);
  const fastest = /fastest|quickest|mas rapido|rapida/.test(q);
  const timingAsked = !onlyParking && /when|leave|arriv|kickoff|start|time|salir|salimos|llegar|hora|inicio|empieza|comienza/.test(q);
  const docIds = new Set<string>();
  const lines: string[] = [], actions: Action[] = [];
  const atUT = context.origin === 'UT Austin';
  if (fastest) lines.push(es
    ? `No tengo tráfico ni salidas en vivo para confirmar cuál es la ruta más rápida${context.origin ? ` desde ${context.origin}` : ''}. ${atUT ? 'Una opción directa en autobús es Rapid 803 hacia el norte; compárala con un auto o rideshare en Maps.' : 'Compara las rutas de Maps con las salidas de CapMetro; el tiempo depende de tu punto de salida.'}`
    : `I cannot verify the fastest route${context.origin ? ` from ${context.origin}` : ''} without live traffic and departure times. ${atUT ? 'A direct bus option is northbound Rapid 803; compare it with driving or rideshare in Maps.' : 'Compare Maps routes with CapMetro departures; the best option depends on your starting point.'}`);
  for (const mode of modes) {
    if (mode === 'parking') {
      docIds.add('parking');
      const lot = parking.lots.find(l => new RegExp(`\\b${normalized(l.color)}\\b`).test(q) || q.includes(normalized(l.name)));
      if (lot) {
        lines.push(es ? `${lot.color} / ${lot.name}: ${lot.address}. La ubicación aparece en el mapa oficial; confirma que tu pase y evento correspondan a ese lote.` : `${lot.color} / ${lot.name}: ${lot.address}. This is its published map location; confirm your event's pass is for this lot.`);
        actions.push(...mapsActions(context, 'driving', lot.address));
      } else lines.push(es
        ? `Para ${other ? 'tu concierto u otro evento' : 'el partido'}, compra un pase de estacionamiento para ese evento en SeatGeek y usa el lote indicado en el pase. Q2 publica estacionamiento dentro y fuera del estadio; el mapa incluye los lotes Red (Q2), Orange (Verde Square), Teal (JOP), Light Blue, Green y Pink. Tenerlos en el mapa no confirma disponibilidad para tu evento.`
        : `For ${other ? 'your concert or other event' : 'the match'}, buy an event-specific parking pass through SeatGeek and park in the lot named on that pass. Q2 publishes on-site and off-site options; its map includes Red (Q2), Orange (Verde Square), Teal (JOP), Light Blue, Green and Pink lots. The map does not guarantee availability for your event.`);
      if (/open|opening|hours|when|early|abren|abre|horario|hora|temprano/.test(q)) lines.push(es
        ? 'La página de estacionamiento indica que los lotes generalmente abren tres horas antes del inicio anunciado. Para eventos de tarde entre semana, el Teal Lot, cuando esté disponible, no abre hasta las 5:30 PM. Confirma el pase y los horarios de tu evento.'
        : 'The parking page lists general lot opening three hours before the announced start. For weekday evening events, the Teal Lot, when available, does not open until 5:30 PM. Confirm the hours on your event/pass.');
      if (/free|gratis|cheapest|cheap|price|cost|barato|precio|cuesta/.test(q)) lines.push(es ? 'No tengo precios ni estacionamiento gratuito confirmado para ese evento; consulta las opciones y precios actuales en SeatGeek.' : 'I do not have current prices or verified free stadium parking for that event; check the actual options and prices in SeatGeek.');
      lines.push(es ? 'Ten listo el pase móvil al llegar.' : 'Have your mobile parking pass ready when you arrive.');
      if (other && !context.event?.title) lines.push(es ? '¿Qué concierto y fecha? Eso permite buscar el estacionamiento del evento correcto.' : 'Which concert and date? That identifies the correct event-specific parking listing.');
      actions.push({ label: es ? 'Ver estacionamiento del evento' : 'Find event parking', href: PARKING });
    }
    if (mode === 'car') {
      docIds.add('directions');
      lines.push(es ? `Auto${context.origin ? ` desde ${context.origin}` : ''}: Q2 está en Burnet Road y Braker Lane. Compara el tráfico en Maps y compra un pase de estacionamiento para tu evento; el pase determina el lote y su entrada.` : `Driving${context.origin ? ` from ${context.origin}` : ''}: Q2 is at Burnet Road and Braker Lane. Compare traffic in Maps and buy parking for your event; your pass identifies the lot and entrance.`);
      actions.push(...mapsActions(context).map(a => ({ ...a, label: (es ? 'Auto: ' : 'Car: ') + a.label })), { label: es ? 'Comprar estacionamiento' : 'Buy parking', href: PARKING });
    }
    if (mode === 'rideshare') {
      docIds.add('directions');
      if (accessible) docIds.add('policy-ada-accessibility');
      lines.push(accessible
        ? es ? 'Para un drop-off accesible, indica West Road al conductor. Para recogida accesible, el conductor debe informar al policía en Rutland/McKalla para acceder a West Road. Confirma las instrucciones del evento con Guest Services.' : 'For an accessible drop-off, direct your driver to West Road. For accessible pickup, the driver should tell the officer at Rutland/McKalla that they need access to West Road. Confirm event instructions with Guest Services.'
        : es ? 'Para Uber, Lyft o taxi, Q2 publica llegada y recogida en Delta Drive, al este, con acceso por Metric Boulevard. Después del evento sigue las indicaciones del personal y usa los cruces designados junto a McKalla Station.' : 'For Uber, Lyft or taxi, Q2 lists drop-off and pickup on Delta Drive on the east side, accessed from Metric Boulevard. After the event, follow staff directions and use designated crossings near McKalla Station.');
      actions.push(...mapsActions(context, 'driving', accessible ? 'West Road, Q2 Stadium, Austin, TX' : 'Delta Drive and Metric Boulevard, Austin, TX').map(a => ({ ...a, label: (es ? 'Rideshare: ' : 'Rideshare: ') + a.label })));
    }
    if (mode === 'rail') {
      docIds.add('policy-capital-metro');
      lines.push(es ? `Toma la Red Line hasta McKalla Station, en el lado este de Q2.${context.origin ? ` Desde ${context.origin}, Maps te permite revisar cómo conectar con la Red Line; no supongo que tengas una estación directa.` : ''} Revisa el horario para la fecha de tu evento. Al volver, usa el andén de la dirección correcta y los cruces designados.` : `Take the Red Line to McKalla Station on Q2's east side.${context.origin ? ` From ${context.origin}, check Maps for the connection to the Red Line; I cannot assume a direct station at your origin.` : ''} Check service for your event date. Afterward, use the platform for your direction and the designated track crossings.`);
      actions.push(...mapsActions(context, 'transit', 'McKalla Station, Austin, TX').map(a => ({ ...a, label: (es ? 'Tren: ' : 'Rail: ') + a.label })));
    }
    if (mode === 'bus') {
      docIds.add('policy-capital-metro');
      lines.push(es ? `${atUT ? 'Desde UT Austin, toma Rapid 803 hacia el norte, en dirección a The Domain.' : `Rapid 803 sirve Q2${context.origin ? `; desde ${context.origin}, revisa la conexión y tu parada en Maps` : ''}.`} Para frente al estadio. Para volver hacia el sur después de un partido, CapMetro indica Bright Verde Way/West Road. Revisa las salidas para la fecha de tu evento.` : `${atUT ? 'From UT Austin, take northbound Rapid 803 toward The Domain.' : `Rapid 803 serves Q2${context.origin ? `; from ${context.origin}, check the connection and your stop in Maps` : ''}.`} It stops in front of the stadium. For southbound service after a match, CapMetro lists Bright Verde Way/West Road. Check departures for your event date.`);
      actions.push(...mapsActions(context, 'transit').map(a => ({ ...a, label: (es ? 'Autobús / 803: ' : 'Bus / 803: ') + a.label })));
    }
    if (mode === 'bike') {
      docIds.add('directions');
      lines.push(es ? 'Q2 publica Bike Valet gratuito en el lado este para partidos. Para un concierto u otro evento, confirma que opere ese día; no lo doy por disponible. Usa Maps para elegir una ruta en bicicleta.' : 'Q2 publishes free Bike Valet on the east side for matchdays. For a concert or other event, confirm it is operating that day; I cannot assume availability. Use Maps for a cycling route.');
      actions.push(...mapsActions(context, 'bicycling').map(a => ({ ...a, label: (es ? 'Bicicleta: ' : 'Bike: ') + a.label })));
    }
  }
  let clock = context.kickoffTime;
  if (!clock && context.event?.startsAt) clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(context.event.startsAt));
  if (timingAsked && clock) {
    const [h, m] = clock.split(':').map(Number), start = h * 60 + m, buffer = other ? 60 : 90;
    if (!other) docIds.add('policy-gate-opening-times');
    lines.push(es ? `Para un inicio a las ${timeString(start)}, objetivo de llegada ${timeString(start - buffer)}.${other ? ' Es un objetivo de planificación; confirma apertura y estacionamiento para el concierto u otros eventos.' : ' Las puertas generalmente abren 90 minutos antes del inicio, sujeto a cambios.'}` : `For a ${timeString(start)} start, aim to arrive by ${timeString(start - buffer)}.${other ? ' This is a planning target; confirm gate and parking hours for the concert or other event.' : ' Gates generally open 90 minutes before kickoff, subject to event changes.'}`);
    if (context.travelMinutes) lines.push(es ? `Con los ${context.travelMinutes} minutos de viaje que indicaste, sal a más tardar a las ${timeString(start - buffer - context.travelMinutes)}.` : `Using the ${context.travelMinutes} minutes of travel time you supplied, leave by ${timeString(start - buffer - context.travelMinutes)}.`);
    else lines.push(es ? '¿Cuántos minutos indica Maps para tu viaje? Con esa duración calculo cuándo salir; no voy a inventar un tiempo de viaje.' : 'How many minutes does Maps show for your trip? I can calculate when to leave from that duration; I do not have a measured travel time.');
  } else if (timingAsked) lines.push(es ? 'Dime la fecha y hora de inicio, y cuántos minutos tarda tu viaje según Maps, para calcular cuándo salir.' : 'Tell me the event date/start time and the travel duration shown in Maps so I can calculate when to leave.');
  if (!onlyParking && !context.origin && !/where|which (?:rail|train) stop|is there|donde|que estacion/.test(q)) lines.push(es ? '¿Desde dónde sales?' : 'Where are you starting from?');
  if (other && (modes.includes('rail') || modes.includes('bus'))) lines.push(es ? 'No supongo servicio especial de partido para un concierto; confirma el servicio de esa fecha en CapMetro.' : 'I am not assuming matchday transit service for a concert; confirm service for that date with CapMetro.');
  if (modes.includes('rail') || modes.includes('bus')) actions.push({ label: es ? 'Horarios de CapMetro' : 'CapMetro event schedules', href: TRANSIT });
  actions.push(...guestActions(es));
  const docs = knowledge.documents.filter(d => docIds.has(d.id));
  const sources = docs.filter(d => d.id !== 'parking').map(d => ({ title: d.title, url: d.url, checkedAt: d.checkedAt }));
  if (docIds.has('parking')) sources.unshift({ title: 'Q2 Stadium parking and lot map', url: parking.url, checkedAt: parking.checkedAt });
  if (modes.includes('rail') || modes.includes('bus')) sources.push({ title: 'CapMetro event service', url: TRANSIT, checkedAt: transitCheck.checkedAt });
  if (atUT && modes.includes('bus')) sources.push({ title: 'CapMetro Rapid 803 route', url: 'https://www.capmetro.org/rapid/route803', checkedAt: transitCheck.checkedAt });
  const updatedContext = { ...context, travelMode: modes.length === 1 ? modes[0] : 'all' as const };
  return { route: 'transport', context: updatedContext, answer: lines.join('\n\n'), facts: docs.map(d => `${d.title}: ${d.body}`), sources, actions, cards: onlyParking ? [{ title: 'Q2 parking map', detail: 'Published lot names and locations; availability depends on your event.', href: parking.url, label: 'View parking map' }] : [] };
}
