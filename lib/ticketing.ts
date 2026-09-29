import type { FanContext, Grounding } from './types';
import type { Snapshot } from './knowledge';
import { MOBILE_TICKET_URL, TICKET_URL } from './knowledge';
import { ticketActions } from './handoffs';
import { normalized } from './safety';
export function ticketGrounding(query:string,context:FanContext,k:Snapshot):Grounding {
 const q=normalized(query),es=context.language==='es';
 const buy=/\b(buy|purchase|sell|book|comprar|compra|comprame|comprarme)\b|transfer for me/.test(q);
 const transfer=/transfer|transferir|recipient|receive|accept|send|share|enviar|recibir/.test(q);
 const contact=/contact|support|helpdesk|ticket hq|llamar|soporte|(?:ticket|boleto|hq).{0,25}(?:phone|number|telefono|correo)|(?:phone|number|telefono).{0,25}(?:ticket|boleto|support|hq)/.test(q);
 const hq=k.documents.find(d=>d.title==='SeatGeek Ticket HQ');
 const sender=es?'Para enviar: en la app Austin FC & Q2 Stadium, abre el boleto del partido, pulsa “Send”, introduce el correo o teléfono del destinatario, selecciona la cantidad y pulsa “Send Tickets”.':'To send: in the Austin FC & Q2 Stadium app, open the match ticket, tap “Send”, enter the recipient’s email or phone number, select the quantity, and tap “Send Tickets”.';
 const receiver=es?'Para recibir: el destinatario debe confirmar con el remitente el correo o teléfono usado y entrar a su propia cuenta de SeatGeek. En la app Austin FC & Q2 Stadium, abre “My Tickets” y “Manage My Tickets”. No puedo verificar que la transferencia se haya completado; si no aparece, usa la ayuda de SeatGeek.':'To receive: the recipient should confirm the email or phone used with the sender and sign in to their own SeatGeek account. In the Austin FC & Q2 Stadium app, open “My Tickets” and “Manage My Tickets”. I cannot verify completion; if the ticket is missing, use SeatGeek Help.';
 let answer='';
 if(buy)answer=es?'No puedo comprar ni transferir boletos por ti. Usa el servicio oficial de Austin FC para compras y la app Austin FC o SeatGeek para transferencias.':'I can’t buy or transfer a ticket for you. Use Austin FC’s official ticket service for purchases and the Austin FC or SeatGeek app for transfers.';
 else if(transfer) {
  const receiving=/recipient|receive|accept|recibir|destinatario/.test(q),sending=/send|share|enviar|transfer my|transfer a|transfer tickets|transfer.*friend|transferir/.test(q);
  answer=receiving&&sending?sender+'\n\n'+receiver:receiving?receiver:sender;
 } else answer=es?'No puedo abrir ni recuperar tu cuenta personal. Usa la app o cuenta de SeatGeek y su opción de ayuda para gestionar o recuperar acceso a tus boletos.':'I cannot open or recover your personal account. Use your SeatGeek app/account and its Help option to manage tickets or recover account access.';
 if(contact&&hq&&/512-953-2858/.test(hq.body))answer=(es?'SeatGeek Ticket HQ: llama al 512-953-2858 o escribe a tickethq@austinfc.com. Atención en línea y por teléfono: lunes a viernes, 9 AM–5 PM. Ticket HQ está al noreste del estadio.':'SeatGeek Ticket HQ: call 512-953-2858 or email tickethq@austinfc.com. Online and phone support: Monday–Friday, 9 AM–5 PM. Ticket HQ is on the stadium’s northeast side.')+(transfer?'\n\n'+answer:'');
 const sources=transfer?[{title:'Austin FC mobile ticketing',url:MOBILE_TICKET_URL,checkedAt:k.checkedAt}]:buy?[{title:'Austin FC tickets',url:TICKET_URL,checkedAt:k.checkedAt}]:[];
 if(hq&&(contact||!transfer&&!buy))sources.push({title:hq.title,url:hq.url,checkedAt:hq.checkedAt});
 return {route:buy?'transaction':'ticketing',context,answer,facts:[],cards:[],sources,actions:[...(buy?[{label:es?'Comprar boletos oficiales':'Buy official tickets',href:TICKET_URL}]:[]),...(contact&&hq?[{label:es?'Llamar a Ticket HQ':'Call Ticket HQ',href:'tel:5129532858'},{label:es?'Correo a Ticket HQ':'Email Ticket HQ',href:'mailto:tickethq@austinfc.com'}]:[]),...ticketActions(es)]};
}
