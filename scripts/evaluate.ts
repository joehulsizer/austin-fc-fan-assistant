import { writeFileSync, readFileSync } from 'node:fs';
import { prepare, groundedFallback } from '../lib/assistant';

type Case = { id:string; kind:string; question:string; route:string; mustMatch:string; sourceDomain:string };
const cases:Case[]=JSON.parse(readFileSync('data/evaluation.json','utf8'));
if(cases.length!==120||new Set(cases.map(c=>c.question)).size!==120)throw new Error('Evaluation set must have 120 distinct questions');
const results=[];
for(const test of cases){
  const grounding=await prepare({messages:[{role:'user',content:test.question}],context:{}});
  const answer=grounding.answer||groundedFallback(test.question,grounding);
  const route=grounding.route===test.route;
  const content=new RegExp(test.mustMatch,'i').test(answer);
  const source=grounding.sources.some(s=>{try{return new URL(s.url).hostname.endsWith(test.sourceDomain);}catch{return false;}});
  results.push({id:test.id,pass:route&&content&&source,route,content,source,answer,sourceUrls:grounding.sources.map(s=>s.url)});
}
const passed=results.filter(r=>r.pass).length;
const criticalFailures=results.filter(r=>!r.pass&&['vegan','gluten','diaper','purchase','sensory','water','next_match'].includes(r.id.split('-')[0]));
const report={createdAt:new Date().toISOString(),total:cases.length,passed,accuracy:passed/cases.length,criticalFailures:criticalFailures.length,results};
writeFileSync('evaluation-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.total,passed,accuracy:report.accuracy,criticalFailures:report.criticalFailures,failures:results.filter(r=>!r.pass).map(r=>({id:r.id,route:r.route,content:r.content,source:r.source,answer:r.answer.slice(0,200)}))},null,2));
if(report.accuracy<.9||criticalFailures.length)process.exit(1);
