const publicEmails=new Set(['guestservices@austinfc.com','tickethq@austinfc.com','fanconduct@austinfc.com','events@austinfc.com']);
const publicPhones=new Set(['5129532858','3527583733','352758373']);
/** Defense in depth for public snapshots/diagnostics, not a promise to detect every name. */
export function scrubPrivateText(value:string):string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,m=>publicEmails.has(m.toLowerCase())?m:'[email removed]')
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4,5}\b|\+\d{8,15}\b/g,m=>publicPhones.has(m.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,''))?m:'[phone removed]')
    .replace(/\b(?:sk-[a-z0-9_-]{12,}|Bearer\s+[a-z0-9_.-]{12,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g,'[credential removed]')
    .replace(/\b(?:my (?:name|address|account|password|ticket number)|me llamo|mi (?:nombre|direccion|cuenta|contrasena))\s*(?:is|es|:)?\s+[^.!?;\n]{2,100}/gi,'[personal details removed]')
    .replace(/\b\d{1,6}\s+(?:[a-z][a-z.'-]*\s+){1,5}(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|way)\b(?:\s*(?:apt|unit|#)\s*[a-z0-9-]+)?/gi,'[street address removed]')
    .replace(/\b\d{8,}\b/g,'[number removed]');
}
export function scrubUrl(value:string):string {
  try {
    const url=new URL(value);
    url.username='';url.password='';
    for(const key of [...url.searchParams.keys()])if(/origin|source|saddr|email|phone|token|secret|key|auth|password|account|user/i.test(key))url.searchParams.delete(key);
    return url.href;
  }catch{return scrubPrivateText(value);}
}
