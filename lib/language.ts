export function messageLanguage(query: string, previous: 'en' | 'es' = 'en'): 'en' | 'es' {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(?:in english|reply in english|answer in english|en ingles)\b/.test(q)) return 'en';
  if (/\b(?:en espanol|in spanish|reply in spanish|answer in spanish)\b/.test(q)) return 'es';
  const spanish = q.match(/\b(quien|el|la|un|una|hombre|mujer|garganta|cerrando|tragar|se|desmayo|aficionado|alguien|sigue|hay|incendio|amenaza|donde|como|puedo|puede|quiero|perdi|hijo|hija|nino|nina|cerca|seccion|necesito|ayuda|comida|bebidas|cerveza|agua|mochila|boletos?|entradas?|estadio|estacionamiento|lluvia|llovera|clima|tren|autobus|horario|partido|vegetariana|vegano|sin|esta|que|mi|para|no encuentro|me estan|acosando|evacuar|medico|primeros|auxilios|telefono|cartera|cuando|abren|puertas)\b/g)?.length || 0;
  const english = q.match(/\b(where|how|can|could|what|when|which|why|the|my|i|i'm|im|please|need|lost|child|son|daughter|near|section|food|drinks|beer|water|backpack|ticket|tickets|stadium|parking|rain|weather|train|bus|kickoff|at|from|to|is|are|do|does|will|tell|gate|gates|refund|discount|seat|delivered|concert)\b/g)?.length || 0;
  if (spanish > english || (/[¿¡]/.test(query) && spanish)) return 'es';
  if (english) return 'en';
  return previous;
}
