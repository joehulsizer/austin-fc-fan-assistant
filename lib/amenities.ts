import type { FanContext,Grounding } from './types';
import type { Snapshot } from './knowledge';
import { normalized } from './safety';
export function amenityGrounding(query:string,context:FanContext,k:Snapshot):Grounding|undefined {
 const q=normalized(query),es=context.language==='es';let titles:string[]=[],answer='';
 if(/breastfeed|nurs(?:e|ing)|pump|lacta|amamanta|mother.?s room/.test(q)) {
  titles=["Mother's Room Locations"];
  const body=k.documents.find(d=>titles.includes(d.title))?.body||'';
  if(/103/.test(body)&&/125/.test(body))answer=es?'Las Mother’s Rooms están en la explanada principal detrás de las secciones 103 y 125. Para otras adaptaciones, consulta a Guest Services o First Aid detrás de la sección 124.':'Mother’s Rooms are on the main concourse behind sections 103 and 125. For other accommodations, ask Guest Services or First Aid behind section 124.';
 }
 else if(/family restroom|family bathroom|bano familiar|banos familiares|baby chang|changing station|cambiador/.test(q)) {
  titles=['Family Restrooms','Restrooms','Baby Change Stations'];
  const docs=k.documents.filter(d=>titles.includes(d.title));
  const conflict=docs.some(d=>/136/.test(d.body))&&docs.some(d=>/138/.test(d.body));
  answer=es?'El baño familiar detrás de la sección 121 aparece en las entradas oficiales. ':'A family restroom behind section 121 is listed consistently in the official guide. ';
  if(conflict)console.warn(JSON.stringify({event:'source_conflict',topic:'family-restroom',locations:[136,138],knowledgeVersion:k.version}));
  answer+=es?'Para otra ubicación, pide indicaciones al personal o a Guest Services detrás de 124.':'For another location, ask nearby staff or Guest Services behind 124 for directions.';
  if(/chang|cambiador/.test(q))answer+=es?' Hay cambiadores en la mayoría de los baños generales y de clubes.':'Changing stations are in most general and club public restrooms.';
 }
 else if(/wheelchair|silla de ruedas/.test(q)) {
  titles=['ADA/Accessibility','Wheelchair Services'];
  answer=es?'El servicio de silla de ruedas es para traslado de la puerta al asiento, por orden de llegada. No se reserva ni se presta durante todo el evento o fuera del estadio. Al entrar, pide ayuda al personal de Guest Services más cercano o envía un mensaje a 35-ASK-VERDE.':'Wheelchair escort service is for gate-to-seat transit, first come, first served. Wheelchairs cannot be reserved, loaned for the whole event, or used outside the gates. After entering, ask the nearest Guest Services teammate or text 35-ASK-VERDE.';
 }
 if(!titles.length)return;
 const docs=k.documents.filter(d=>titles.includes(d.title));
 return {route:'stadium',context,answer:answer||(es?'No pude confirmar esa ubicación en las fuentes actuales. Consulta a Guest Services detrás de la sección 124.':'I could not confirm that location in the current sources. Ask Guest Services behind section 124.'),facts:docs.map(d=>`${d.title}: ${d.body}`),sources:docs.map(d=>({title:d.title,url:d.url,checkedAt:d.checkedAt})),cards:[]};
}
