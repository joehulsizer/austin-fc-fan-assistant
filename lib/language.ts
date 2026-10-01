export function messageLanguage(query: string, previous: 'en' | 'es' = 'en'): 'en' | 'es' {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(?:in english|reply in english|answer in english|en ingles)\b/.test(q)) return 'en';
  if (/\b(?:en espanol|in spanish|reply in spanish|answer in spanish)\b/.test(q)) return 'es';
  const spanish = q.match(/\b(quien|el|la|un|una|hombre|mujer|garganta|cerrando|tragar|se|desmayo|aficionado|alguien|sigue|hay|incendio|amenaza|donde|como|puedo|puede|quiero|perdi|hijo|hija|nino|nina|cerca|cercanos|banos|seccion|necesito|ayuda|comida|bebidas|cerveza|agua|mochila|boletos?|entradas?|estadio|estacionamiento|lluvia|llovera|clima|tren|autobus|horario|partido|vegetariana|vegano|sin|esta|que|mi|para|no encuentro|me estan|acosando|evacuar|medico|primeros|auxilios|telefono|cartera|cuando|abren|puertas)\b/g)?.length || 0;
  const english = q.match(/\b(where|how|can|could|what|when|which|why|the|my|i|i'm|im|please|need|lost|child|son|daughter|near|section|food|drinks|beer|water|backpack|ticket|tickets|stadium|parking|rain|weather|train|bus|kickoff|at|from|to|is|are|do|does|will|tell|gate|gates|refund|discount|seat|delivered|concert)\b/g)?.length || 0;
  if (spanish > english || (/[¿¡]/.test(query) && spanish)) return 'es';
  if (english) return 'en';
  return previous;
}
export function unsupportedLanguage(query:string):boolean {
  const q=query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return /\b(?:in|en|em)\s+(?:portuguese|portugues|vietnamese|vietnamita|french|frances|german|aleman|italian|italiano|chinese|mandarin|arabic)\b/.test(q)|| /[\u0400-\u052f\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(q)
    || /\b(onde|posso|voce|voces|obrigado|obrigada|estacionamento|ingresso|ingressos|crianca|bonjour|ou est|puis.je|billets|danke|wo ist|kann ich|toi|khong|o dau|cho toi|san van dong)\b/.test(q);
}
