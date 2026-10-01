import { normalized } from './safety';
/** Location data only: never interpret a notice/header, a seat number, or an instruction as an origin. */
export function parseOrigin(query:string,travelFollowup=false):string|undefined {
  const q=normalized(query);
  if(/official notice|guest services:|system:|developer:|ignore|ignora|print.*prompt|base64/.test(q))return;
  const travel=/q2|stadium|estadio|kickoff|travel|fastest|train|bus|walk|drive|ride|arriv|leave|llegar|caminar|salir|parking|coming|vengo/.test(q)||travelFollowup;
  if(!travel)return;
  if(/\b(?:aus|austin(?:-bergstrom)? (?:airport|aeropuerto)|airport|aeropuerto)\b/.test(q))return 'Austin-Bergstrom International Airport (AUS)';
  if(/\b(?:the domain|el domain|domain)\b/.test(q)&&! /to the domain|hacia el domain/.test(q))return 'The Domain, Austin, TX';
  if(/\b(?:ut austin|ut campus|university of texas(?: at austin)?|ut)\b/.test(q))return 'UT Austin';
  const candidate=query.match(/\b(?:from|starting at|leaving from|located at|staying at|i(?:'m| am|m) (?:at|near|in)|desde|salgo de|somos de|estoy en|vengo de)\s+(.+?)(?=\s+(?:to|get to|for the|how do|where can|what time|and when|kickoff|with my|with the|can we|need|want|tonight|para el|hacia|y cuando|con mi)\b|[,!?;:]|$)/i)?.[1]?.trim();
  if(!candidate||/^\d{3}\b|^(?:section|sec\.?|seccion|here|there|the bar|the stand|the app|la app|app|my phone|mi telefono|my account|mi cuenta|guest|official)\b/i.test(normalized(candidate)))return;
  return candidate.slice(0,120);
}
