import type { Action, FanContext, Grounding } from './types';
export const ORDER_URL = 'https://austinfc.ordernext.com/';
export const STADIUM_TEXT = 'sms:3527583733';
export const GUEST_EMAIL = 'mailto:GuestServices@AustinFC.com';
export const SEATGEEK_URL = 'https://seatgeek.com/account';
export function isActionHref(value: string): boolean {
  if ([STADIUM_TEXT, GUEST_EMAIL, 'tel:911'].includes(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && [
      'austinfc.ordernext.com', 'seatgeek.com', 'www.austinfc.com', 'www.q2stadium.com',
      'www.capmetro.org', 'maps.apple.com', 'www.google.com', 'forecast.weather.gov',
    ].includes(u.hostname) && (u.hostname !== 'www.google.com' || u.pathname.startsWith('/maps/'));
  } catch { return false; }
}
export function guestActions(es = false): Action[] {
  return [{label: es ? 'Enviar mensaje a 35-ASK-VERDE' : 'Text 35-ASK-VERDE', href: STADIUM_TEXT},
    {label: es ? 'Correo a Guest Services' : 'Email Guest Services', href: GUEST_EMAIL}];
}
export function ticketActions(es = false): Action[] {
  return [{label: es ? 'Abrir cuenta de SeatGeek' : 'Open SeatGeek account / app', href: SEATGEEK_URL}, ...guestActions(es)];
}
export function mapsActions(context: FanContext, mode = 'driving', destination = 'Q2 Stadium, Austin, TX'): Action[] {
  const es = context.language === 'es';
  const google = new URL('https://www.google.com/maps/dir/');
  google.searchParams.set('api', '1'); google.searchParams.set('destination', destination); google.searchParams.set('travelmode', mode);
  if (context.origin) google.searchParams.set('origin', context.origin);
  const apple = new URL('https://maps.apple.com/');
  if(mode === 'bicycling') {
    apple.pathname='/directions';apple.searchParams.set('destination',destination);apple.searchParams.set('mode','cycling');
    if(context.origin)apple.searchParams.set('source',context.origin);
  } else {
    apple.searchParams.set('daddr', destination); apple.searchParams.set('dirflg', mode === 'transit' ? 'r' : 'd');
    if (context.origin) apple.searchParams.set('saddr', context.origin);
  }
  return [{label: es ? 'Ruta en Google Maps' : 'Directions in Google Maps', href: google.href}, {label: es ? 'Ruta en Apple Maps' : 'Directions in Apple Maps', href: apple.href}];
}
export function addHandoffs(result: Grounding): Grounding {
  const es = result.context.language === 'es';
  let actions = result.actions || [];
  if (['concessions', 'drinks', 'ordering'].includes(result.route)) actions.push({ label: es ? 'Pedir comida en OrderNext' : 'Order food in OrderNext', href: ORDER_URL });
  if (['ticketing', 'transaction'].includes(result.route)) actions.push(...ticketActions(es));
  // A working support destination remains available for clarification, service failure, and unsupported requests.
  if (!actions.length) actions = guestActions(es);
  result.actions = actions.filter((a, i) => isActionHref(a.href) && actions.findIndex(b => b.href === a.href) === i);
  return result;
}
