import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { mapsActions, guestActions } from './handoffs';
const TRANSIT = 'https://www.capmetro.org/special-events/Q2';
function timeString(minutes: number, es: boolean) {
  const dayOffset = minutes < 0 ? (es ? ' (día anterior)' : ' (previous day)') : '';
  const m = ((minutes % 1440) + 1440) % 1440, h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}${dayOffset} CT`;
}
export function travelGrounding(query: string, context: FanContext, knowledge: Snapshot): Grounding {
  const es = context.language === 'es', other = context.eventKind === 'other';
  const q = query.toLowerCase();
  const docs = knowledge.documents.filter(d=>['directions','parking','policy-capital-metro','policy-gate-opening-times','policy-ada-accessibility'].includes(d.id));
  let clock = context.kickoffTime;
  if (!clock && context.event?.startsAt) clock = new Intl.DateTimeFormat('en-GB',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(context.event.startsAt));
  let timing = '';
  if (clock) {
    const [h,m] = clock.split(':').map(Number), start = h * 60 + m;
    const buffer = other ? 60 : 90, allowance = context.travelMinutes || 60;
    timing = es ? `Plan de salida: para un inicio a las ${timeString(start, true)}, objetivo de llegada ${timeString(start-buffer, true)}; sal a más tardar a las ${timeString(start-buffer-allowance, true)}. Uso ${allowance} minutos ${context.travelMinutes ? 'de viaje que indicaste' : 'como margen provisional de viaje, NO como tiempo calculado de ruta'}. Reemplaza ese margen con la duración en Maps o dime cuántos minutos tarda tu viaje.${other ? ' La llegada es un objetivo de planificación; confirma apertura y estacionamiento para ese evento.' : ' Las puertas generalmente abren 90 minutos antes del inicio, sujeto a cambios.'}`
      : `Leave-by plan: for a ${timeString(start, false)} start, aim to arrive by ${timeString(start-buffer, false)}; leave by ${timeString(start-buffer-allowance, false)}. This uses ${allowance} minutes ${context.travelMinutes ? 'of travel time you supplied' : 'as a provisional travel allowance, NOT a measured route duration'}. Replace that allowance with the duration in Maps, or tell me your trip takes X minutes.${other ? ' Arrival is a planning target; confirm gate and parking hours for this event.' : ' Gates generally open around 90 minutes before kickoff, subject to event changes.'}`;
  } else timing = es ? 'Dime la fecha y hora de inicio, y la duración de viaje indicada en Maps, para calcular cuándo salir.' : 'Tell me the event date/start time and the travel duration shown in Maps to calculate when to leave.';
  const origin = context.origin ? (es ? `Desde ${context.origin}:` : `From ${context.origin}:`) : (es ? '¿Desde dónde sales? Estas son las opciones:' : 'What is your starting point? Here are the options:');
  const lines = es ? [
    '• Auto: compra estacionamiento con anticipación en SeatGeek. Confirma el lote y su horario para el evento; no puedo verificar disponibilidad.',
    '• Rideshare: zona general de llegada y recogida en Delta Drive, con acceso por Metric Boulevard. Para acceso adaptado, consulta las instrucciones de West Road.',
    '• Red Line: viaja a McKalla Station en el lado este. Revisa servicio y horarios del evento en CapMetro; puede requerir conexión desde tu origen.',
    `• Rapid 803: para frente al estadio.${context.origin === 'UT Austin' ? ' Desde UT Austin, consulta el servicio hacia el norte y tu parada del campus en el planificador.' : ' Revisa la parada y las conexiones desde tu origen.'}`,
    '• Bicicleta: Q2 publica servicio gratuito de Bike Valet en el lado este para partidos; confirma disponibilidad para otros eventos.',
  ] : [
    '• Car: buy parking in advance through SeatGeek. Confirm the lot and event hours; I cannot check availability.',
    '• Rideshare: general drop-off/pickup on Delta Drive via Metric Boulevard. For accessible drop-off, check the West Road instructions.',
    '• Red Line: ride to McKalla Station on the east side. Check the event service schedule with CapMetro; your origin may require a connection.',
    `• Rapid 803: stops in front of the stadium.${context.origin === 'UT Austin' ? ' From UT Austin, check northbound service and your campus stop in the trip planner.' : ' Check your nearest stop and connections in the trip planner.'}`,
    '• Bike: Q2 lists free east-side Bike Valet for matchdays; confirm availability for other events.',
  ];
  const disclaimer = es ? 'Sin tráfico ni salidas en vivo, no puedo elegir honestamente la ruta más rápida. Usa los enlaces para comparar.' : 'Without live traffic or departure data, I cannot honestly select the fastest route. Use the links to compare.';
  const actions = [
    ...mapsActions(context).map(a=>({...a,label:(es?'Auto: ':'Car: ')+a.label})),
    ...mapsActions(context,'driving','Delta Drive and Metric Boulevard, Austin, TX').slice(0,1).map(a=>({...a,label:es?'Maps: zona de rideshare':'Maps: rideshare area'})),
    ...mapsActions(context,'transit','McKalla Station, Austin, TX').slice(0,1).map(a=>({...a,label:es?'Maps: Red Line a McKalla':'Maps: Red Line to McKalla'})),
    ...mapsActions(context,'transit').map(a=>({...a,label:(es?'Transporte / 803: ':'Transit / 803: ')+a.label})),
    ...mapsActions(context,'bicycling').map(a=>({...a,label:(es?'Bicicleta: ':'Bike: ')+a.label})),
    {label:es?'Comprar estacionamiento':'Buy parking',href:'https://seatgeek.com/venues/q2-stadium/parking'},
    {label:es?'Horarios de CapMetro':'CapMetro event schedules',href:TRANSIT}, ...guestActions(es),
  ];
  const selected = docs.filter(d => d.id !== 'policy-ada-accessibility' || /accessible|ada|wheelchair|accesib|silla/.test(q));
  return {route:'transport',context,answer:[origin,...lines,'',timing,'',disclaimer,other?(es?'Para conciertos y otros eventos, confirma estacionamiento y horarios específicos; no uso el calendario de Austin FC para este evento.':'For concerts and other events, confirm event-specific parking and hours; I am not using the Austin FC match schedule for this event.'):''].filter(Boolean).join('\n'),facts:selected.map(d=>`${d.title}: ${d.body}`),sources:selected.map(d=>({title:d.title,url:d.url,checkedAt:d.checkedAt})).concat([{title:'CapMetro event service',url:TRANSIT,checkedAt:'2026-09-29T17:00:00Z'}]),cards:[],actions};
}
