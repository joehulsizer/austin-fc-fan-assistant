import beverageData from '@/data/beverages.json';
import type { FanContext, Grounding, Source } from './types';
import type { Snapshot } from './knowledge';
import { sectionZone, MENU_HIGHLIGHTS, MAP_URL } from './knowledge';
import { normalized } from './safety';
export type Beverage = { name:string; category:string; locations:string[]; url:string; checkedAt:string };
const FOOD_URL='https://www.q2stadium.com/food-and-drink/our-vendors/';
const POLICY_URL='https://www.q2stadium.com/a-z-policy-guide/';
const DRINK_URL='https://www.q2stadium.com/food-and-drink/drink-menu/';
function proximity(section:number|undefined,locations:number[]) {
 if(!section)return 0;
 if(locations.includes(section))return -1;
 return locations.some(s=>sectionZone(s)===sectionZone(section))?0:1;
}
const sections=(s:string)=>[...s.matchAll(/\b([134]\d\d)\b/g)].map(m=>Number(m[1]));
export function foodGrounding(kind:'concessions'|'drinks',query:string,context:FanContext,k:Snapshot):Grounding {
 const q=normalized(query),es=context.language==='es';
 const result:Grounding={route:kind,context,facts:[],sources:[],cards:[]};
 const doc=k.documents.find(d=>d.title==='Food and Beverage');
 const src=(title:string,url:string,checkedAt=k.checkedAt):Source=>({title,url,checkedAt});
 if(context.section&&context.section>=200&&context.section<300) {
  result.answer=es?`No tengo puestos publicados en el nivel 200 que pueda confirmar cerca de la sección ${context.section}. Revisa OrderNext para opciones que sirvan tu sección; no puedo garantizar entrega al asiento.`:`I do not have verified 200-level stands near section ${context.section}. Check OrderNext for options serving your section; I cannot guarantee seat delivery.`;
  return result;
 }
 if(kind==='drinks') {
  const items=k.beverages||beverageData.items;
  let nonAlcoholic=/non.?alcoholic|alcohol.?free|sin alcohol|soda|sprite|coke|coca|dr.? pepper|refresco|\bwater\b|\bagua\b|lemonade|limonada|0\.0/.test(q);
  const named=items.filter(b=>{
   const name=normalized(b.name);
   if(q.includes(name))return true;
   const significant=name.split(/[^a-z0-9.]+/).filter(w=>w.length>3&&!['original','cherry','lemon','lime','black','flavors'].includes(w));
   return significant.some(w=>new RegExp(`\\b${w}\\b`).test(q));
  });
  if(named.some(b=>!/non.?alcohol/i.test(b.category)) && !/non.?alcoholic|alcohol.?free|sin alcohol|0\.0/.test(q))nonAlcoholic=false;
  let selected:Beverage[]=named;
  if(/heineken\s*0[.,]0/.test(q))selected=items.filter(b=>/heineken 0\.0/i.test(b.name));
  else if(/sprite|coke|coca|soda|dr.? pepper|refresco/.test(q))selected=items.filter(b=>/^soda\b/i.test(b.name));
  else if(/\b(water|agua)\b/.test(q)&&!named.length)selected=items.filter(b=>/^waterloo sparkling/i.test(b.name));
  else if(!selected.length)selected=items.filter(b=>nonAlcoholic?/non.?alcohol/i.test(b.category):/wine|vino/.test(q)?/wine/i.test(b.category):/margarita/.test(q)?/margarita/i.test(b.name):/beer|cerveza/.test(q)?/beer/i.test(b.category)&&!/non.?alcohol/i.test(b.category):true);
  if(nonAlcoholic)selected=selected.filter(b=>/non.?alcohol/i.test(b.category));
  selected.sort((a,b)=>proximity(context.section,a.locations.flatMap(sections))-proximity(context.section,b.locations.flatMap(sections)));
  // Avoid choosing between conflicting YETI section labels across official pages.
  const lines:string[]=[];
  for(const b of selected.slice(0,3)) {
   const locs=[...b.locations].filter(l=>!/(124|125).*yeti/i.test(l)).sort((a,b)=>proximity(context.section,sections(a))-proximity(context.section,sections(b))).slice(0,3);
   if(!locs.length)continue;
   const name=/^soda\b/i.test(b.name)&&/sprite/i.test(q)?'Sprite (published soda selection)':b.name;
   lines.push(`• ${name}: ${locs.join('; ')}.`);
   result.cards.push({title:name,detail:locs.join('; '),href:DRINK_URL,label:es?'Ver bebidas':'View drink menu'});
  }
  let intro=es?'Opciones del menú de bebidas publicado:':'Published drink options from the beverage menu:';
  if(/bottled|still water|agua embotellada/.test(q))intro=es?'No pude confirmar agua embotellada sin gas en este menú. Sí publica agua con gas Waterloo:':'I could not confirm bottled still water in this menu. It does list Waterloo sparkling water:';
  result.answer=lines.length?intro+'\n'+lines.join('\n')+(es?'\nLa disponibilidad puede cambiar; confirma en el puesto.':'\nAvailability can change; confirm at the stand.'):(es?'No pude confirmar esa bebida en el menú publicado. Revisa OrderNext o consulta a Guest Services.':'I could not confirm that drink in the published menu. Check OrderNext or ask Guest Services.');
  if(!context.section)result.answer+=es?'\n¿En qué sección estás?':'\nWhat section are you in?';
  result.facts=lines;result.sources=[src('Q2 Stadium beverage menu',DRINK_URL,selected[0]?.checkedAt||beverageData.checkedAt)];return result;
 }
 const vegan=context.dietary==='vegan',vegetarian=context.dietary==='vegetarian',gluten=context.dietary==='gluten-aware';
 if(/peanut.?free|nut.?free|dairy.?free|halal|kosher|sin lactosa|sin frutos secos/.test(q)) {
  result.answer=es?'No tengo esa clasificación dietética confirmada ni puedo garantizar seguridad para una alergia. Consulta ingredientes y contacto cruzado con el puesto antes de pedir; Guest Services puede ayudarte.':'I do not have that dietary label verified and cannot guarantee allergy safety. Ask the stand about ingredients and cross-contact before ordering; Guest Services can help.';
  result.sources=doc?[src(doc.title,doc.url,doc.checkedAt)]:[];return result;
 }
 const category=/\b(chicken|wings?|tenders?|pollo|alitas)\b/.test(q)?'chicken':/\b(burgers?|hamburgers?|hamburguesa)\b/.test(q)?'burger':undefined;
 if(category) {
  if((vegan||vegetarian)&&category==='chicken'||vegan&&category==='burger') {
   result.answer=es?`No puedo confirmar ${category==='chicken'?'pollo':'una hamburguesa'} ${vegan?'vegano':'vegetariano'} en las fuentes publicadas. ${category==='burger'?'La Impossible Good Burger figura como vegetariana, lo que no confirma que sea vegana.':'El pollo publicado es pollo convencional; no lo voy a presentar como vegetal.'} Puedes buscar alternativas veganas en Verde Vegan, sección 119, o el bao Creamy Veggie de Bao’d Up, sección 101.`:`I cannot verify a ${vegan?'vegan':'vegetarian'} ${category==='chicken'?'chicken option':'burger'} in the published sources. ${category==='burger'?'The Impossible Good Burger is labeled vegetarian; that does not establish that it is vegan.':'The published chicken options are conventional chicken, so I will not present them as plant-based.'} Verified vegan alternatives include Verde Vegan at section 119 and the Creamy Veggie bao at Bao’d Up, section 101.`;
  } else {
   const matches=MENU_HIGHLIGHTS.filter(m=>m.category===category&&(!gluten||m.name==='Shawarma Point')).sort((a,b)=>proximity(context.section,sections(a.location))-proximity(context.section,sections(b.location)));
   result.facts=matches.map(m=>`${m.name}: ${m.item}, ${m.location}.`);result.cards=matches.map(m=>({title:m.name,detail:`${m.item} · ${m.location}`,href:MAP_URL,label:es?'Ver ubicación':'View location'}));
   result.answer=(es?'Opciones publicadas:':'Published options:')+'\n'+result.facts.map(f=>'• '+f).join('\n')+(category==='burger'?(es?'\nLa hamburguesa publicada es vegetariana; no tengo una hamburguesa de res confirmada.':'\nThe published burger is vegetarian; confirm ingredients at the stand.'):'');
  }
  result.sources=[src('Q2 Stadium food and dietary guide',POLICY_URL,doc?.checkedAt),src('Q2 Stadium vendors',FOOD_URL)];
 } else {
  const labels:Record<string,Partial<Record<NonNullable<FanContext['dietary']>,string>>>={
   'Bao’d Up':{vegan:'Creamy Veggie bao; vegan mayo',vegetarian:'Creamy Veggie bao (vegan)'},
   'Verde Vegan & Wine Bar':{vegan:'Vegan chili dog, Impossible bowl or tofu bowl',vegetarian:'Vegan menu', 'gluten-aware':'Impossible bowl or tofu bowl (avoiding gluten)'},
   'Double Dave’s':{vegan:'Popcorn',vegetarian:'Cheese pizza or Chee-z Rolls; popcorn','gluten-aware':'Popcorn (avoiding gluten)'},
   OneTaco:{vegetarian:'Chips & queso or quesobirria (listed vegetarian)','gluten-aware':'Chips & queso or quesobirria (listed avoiding gluten)'},
   'Shawarma Point':{vegetarian:'Falafel wrap or salad; hummus & pita','gluten-aware':'Tabouli & chips (avoiding gluten)'},
   'Little Patagonia':{vegetarian:'Published vegetarian empanada options; confirm the item'},
   'Eastside Eats':{vegan:'Popcorn',vegetarian:'Cheese nachos, popcorn or soft pretzels','gluten-aware':'Cheese nachos or popcorn (avoiding gluten)'}
  };
  const foodItem=q.match(/\b(tacos?|pizza|nachos|bao|shawarma|barbecue|bbq|popcorn|chili dog|hot dog|empanadas?)\b/)?.[1];
  const named=k.vendors.filter(v=>q.includes(normalized(v.name)));
  let matches=k.vendors.filter(v=> {
   if(!named.length && /Bar|Draft|Heineken|Michelob/.test(v.name))return false;
   const detail=context.dietary?labels[v.name]?.[context.dietary]:v.description;
   if(context.dietary&&!detail)return false;
   if(named.length&&!named.some(n=>n.name===v.name))return false;
   if(foodItem){const text=normalized(v.name+' '+(detail||''));return foodItem.startsWith('taco')?/taco|queso|quesobirria/.test(text):new RegExp(foodItem.replace(/s$/,'')).test(text);}
   return context.dietary||named.length||! /\b(sushi|lobster|steak|ramen|pasta)\b/.test(q);
  });
  matches.sort((a,b)=>proximity(context.section,a.sections)-proximity(context.section,b.sections));
  matches=matches.slice(0,6);
  const inventory=/sold out|stock|inventory|available right now|agotad|inventario/.test(q);
  result.facts=matches.map(v=>`${v.name}: ${v.location}. ${context.dietary?labels[v.name]?.[context.dietary]:v.description.split('. ')[0].slice(0,180)||'Published vendor; confirm menu options at the stand.'}`);
  result.cards=matches.map(v=>({title:v.name,detail:v.location,href:MAP_URL,label:es?'Ver ubicación':'View location'}));
  result.answer=(inventory?(es?'No tengo inventario en vivo ni puedo saber si está agotado. ':'I cannot check live inventory or whether an item is sold out. '):'')+(matches.length?(es?'Opciones publicadas:':'Published options:')+'\n'+result.facts.map(f=>'• '+f).join('\n'):(es?'No pude confirmar esa opción con tus preferencias en los listados publicados.':'I could not verify that item with your preferences in the published listings.'));
  result.sources=[src('Q2 Stadium vendors',FOOD_URL),...(context.dietary?[src('Q2 Stadium food and dietary guide',POLICY_URL,doc?.checkedAt)]:[])];
 }
 if(gluten)result.answer+=(es?'\n“Evita gluten” es la etiqueta publicada, no una garantía de seguridad para alergias o celiaquía. Consulta ingredientes y contacto cruzado con el personal.':'\n“Avoiding gluten” is the published label, not an allergy guarantee or a celiac-safety guarantee. Ask staff about ingredients and cross-contact.');
 if(!context.section)result.answer+=es?'\nDime tu sección para sugerir una zona aproximada.':'\nTell me your section to suggest a broad area.';
 else result.answer+=es?'\nLas ubicaciones están publicadas; la proximidad es aproximada.':'\nLocations are published; proximity is approximate.';
 return result;
}
