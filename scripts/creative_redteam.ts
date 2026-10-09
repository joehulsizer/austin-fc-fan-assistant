import fs from 'node:fs';
import {prepare,groundedFallback} from '../lib/assistant';
import cases from '../data/creative-redteam.json';
import type {ChatInput} from '../lib/types';
async function main(){
 const results=[];
 for(const c of cases.cases){
  const input:ChatInput={messages:[],context:{}};let r;
  for(const q of [...(c.prior||[]),c.question]){
   input.messages.push({role:'user',content:q});r=await prepare(input);input.context=r.context;input.messages.push({role:'assistant',content:groundedFallback(q,r)});
  }
  results.push({...c,meta:r,answer:groundedFallback(c.question,r!)});
 }
 fs.writeFileSync(process.argv[2]||'/tmp/creative-redteam.json',JSON.stringify({results},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
