import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { MOBILE_TICKET_URL, TICKET_URL } from './knowledge';
import { ticketActions } from './handoffs';
import { normalized } from './safety';
export function ticketGrounding(query:string,context:FanContext,k:Snapshot):Grounding {
  const q=normalized(query),es=context.language==='es';
  const buy=/\b(buy|purchase|sell|book|comprar|compra|comprame|comprarme)\b|transfer for me/.test(q);
  const transfer=/transfer|transferir|recipient|receive|accept|send|share|enviar|recibir/.test(q);
  let answer='';
  if(buy)answer=es?'No puedo comprar ni transferir boletos por ti. Usa el servicio oficial de boletos de Austin FC o tu cuenta/app de SeatGeek; puedo explicarte los pasos.':'I can’t buy or transfer a ticket for you. Use Austin FC’s official ticket service or your SeatGeek account/app; I can explain the steps.';
  else if(transfer) {
    const recipient=/recipient|receive|accept|recibir|destinatario/.test(q);
    answer=recipient?(es?'Si vas a recibir un boleto, pide al remitente que confirme el correo o teléfono utilizado. En la app Austin FC & Q2 Stadium, abre “My Tickets”, después “Manage My Tickets” e inicia sesión en SeatGeek. No puedo verificar si la transferencia se completó; usa la ayuda de tu cuenta si no aparece.':'If you are receiving a ticket, ask the sender to confirm the email or phone number used. In the Austin FC & Q2 Stadium app, open “My Tickets,” then “Manage My Tickets,” and sign in to SeatGeek. I cannot verify whether the transfer completed; use account Help if it does not appear.')
      :(es?'Puedes transferir boletos digitales desde las apps de Austin FC o SeatGeek. En Austin FC & Q2 Stadium, abre el boleto, pulsa “Send”, escribe el correo o teléfono del destinatario, selecciona la cantidad y pulsa “Send Tickets”.':'You can transfer digital tickets through the Austin FC or SeatGeek apps. In Austin FC & Q2 Stadium, open the match ticket, tap “Send,” enter the recipient’s email or phone number, choose the ticket quantity, and tap “Send Tickets.”');
  } else answer=es?'Para comprar, abrir o gestionar boletos, usa el servicio oficial de Austin FC o tu cuenta/app de SeatGeek. No tengo acceso a tu cuenta ni a sus transacciones.':'For buying, accessing or managing tickets, use Austin FC’s official ticket service or your SeatGeek account/app. I cannot access your account or its transactions.';
  const willCall=k.documents.find(d=>d.title==='Will Call');
  return {route:buy?'transaction':'ticketing',context,answer,facts:[],cards:[],sources:[{title:transfer?'Austin FC mobile ticketing':'Austin FC tickets',url:transfer?MOBILE_TICKET_URL:TICKET_URL,checkedAt:k.checkedAt},...(transfer&&willCall?[{title:willCall.title,url:willCall.url,checkedAt:willCall.checkedAt}]:[])],actions:[...(buy?[{label:es?'Comprar boletos oficiales':'Buy official tickets',href:TICKET_URL}]:[]),...ticketActions(es)]};
}
