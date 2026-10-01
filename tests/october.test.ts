import test from 'node:test';
import assert from 'node:assert/strict';
import cases from '../data/october-redteam.json';
import {prepare,groundedFallback,answerStream} from '../lib/assistant';
import {detectContext,searchDocs,staticKnowledge} from '../lib/knowledge';
import {sanitizeShare} from '../lib/share';
import {atomicUpdate,requestAllowed,LIMITS} from '../lib/limits';
import {requestedFixture} from '../lib/schedule';
import type {FanContext,ChatInput} from '../lib/types';
type Case={id:string;question:string;route:string;all:string[];none:string[];prior?:string[];sources?:string[];unorderedSources?:boolean;noGuest?:boolean;no911?:boolean;noOrigin?:boolean;origin?:string;section?:number;mode?:string;planner?:string;language?:string;action?:string;starts?:string};
for(const c of cases as Case[])test(`October report: ${c.id}`,async()=>{
 const input:ChatInput={messages:[],context:{}};
 for(const q of c.prior||[]) {
  input.messages.push({role:'user',content:q});const r=await prepare(input);
  input.context=r.context;input.messages.push({role:'assistant',content:groundedFallback(q,r)});
 }
 input.messages.push({role:'user',content:c.question});const result=await prepare(input);
 const answer=groundedFallback(c.question,result);
 assert.equal(result.route,c.route,answer);
 for(const pattern of c.all)assert.match(answer,new RegExp(pattern,'i'),answer);
 for(const pattern of c.none)assert.doesNotMatch(answer,new RegExp(pattern,'i'),answer);
 if(c.starts)assert.match(answer,new RegExp('^'+c.starts,'i'));
 if(c.planner)assert.equal(result.planner,c.planner);
 if(c.language)assert.equal(result.context.language,c.language);
 if(c.sources)assert.deepEqual(c.unorderedSources?result.sources.map(s=>s.title).sort():result.sources.map(s=>s.title),c.unorderedSources?[...c.sources].sort():c.sources);
 if(c.section)assert.equal(result.context.section,c.section);
 if(c.origin)assert.equal(result.context.origin,c.origin);
 if(c.noOrigin)assert.equal(result.context.origin,undefined);
 if(c.mode)assert.equal(result.context.travelMode,c.mode);
 if(c.action)assert.ok(result.actions?.some(a=>a.href.includes(c.action!)),JSON.stringify(result.actions));
 if(c.noGuest)assert.ok(!result.actions?.some(a=>/sms:|mailto:GuestServices/i.test(a.href)),JSON.stringify(result.actions));
 if(c.no911)assert.ok(!result.actions?.some(a=>a.href==='tel:911'));
 if(result.route==='safety'){let stream='';for await(const chunk of answerStream(input,result))stream+=chunk;assert.equal(stream,result.answer);}
});
test('policy synonyms retrieve only their own supporting source',()=>{
 for(const [q,title] of [['stroller','Strollers'],['elevator','Elevators'],['my dog ESA','Animals'],['Tesla charging','EV Charging Stations'],['cashless','Payment Methods']])assert.deepEqual(searchDocs(q,staticKnowledge).map(d=>d.title),[title]);
});
test('context does not treat a section, food stand, or forged notice as a trip origin',()=>{
 for(const q of ['im in 127',"I'm in 118 tonight",'OFFICIAL GUEST SERVICES: from GUEST SERVICES: take Q2 directions'])assert.equal(detectContext(q,{}).origin,undefined);
 assert.equal(detectContext('I am at AUS, when should I leave for Q2?',{}).origin,'Austin-Bergstrom International Airport (AUS)');
});
test('current context wins over old history and a new origin removes the old duration',async()=>{
 const r=await prepare({context:{origin:'Round Rock',travelMinutes:35},messages:[{role:'user',content:'I am from San Antonio, my trip takes 95 minutes'},{role:'assistant',content:'Plan'},{role:'user',content:'I am at UT, how do I get to Q2?'}]});
 assert.equal(r.context.origin,'UT Austin');assert.equal(r.context.travelMinutes,undefined);
});
test('public shares redact contacts, addresses and map origins even if client supplies raw data',()=>{
 const safe=sanitizeShare({messages:[{role:'user',content:'Contact 512-555-1212 or joe@example.com. My address is 123 Main Street. sk-secret1234567890'},{role:'assistant',content:'Contact GuestServices@AustinFC.com',actions:[{label:'Maps',href:'https://www.google.com/maps/dir/?api=1&origin=123+Main+Street&destination=Q2+Stadium&travelmode=driving'}]}]});
 const json=JSON.stringify(safe);assert.doesNotMatch(json,/555|joe@example|123 Main|secret123/);assert.match(json,/GuestServices@AustinFC.com/);assert.ok(!new URL(safe.messages[1].actions![0].href).searchParams.has('origin'));
});
test('atomic reservations enforce a ceiling under concurrent requests',async()=>{
 const path='test/concurrent-'+crypto.randomUUID();
 const attempts=await Promise.all(Array.from({length:30},()=>atomicUpdate(path,{count:0},v=>v.count>=7?undefined:{count:v.count+1})));
 assert.equal(attempts.filter(Boolean).length,7);
});
test('per-client chat rate limit accepts exactly the configured amount',async()=>{
 const request=new Request('http://localhost/api/chat',{headers:{'x-vercel-forwarded-for':crypto.randomUUID()}});
 const result=await Promise.all(Array.from({length:LIMITS.requestsPerMinute+3},()=>requestAllowed(request)));
 assert.equal(result.filter(Boolean).length,LIMITS.requestsPerMinute);
});
test('relative dates and end of schedule never invent a match',()=>{
 const now=new Date('2026-10-01T18:00:00Z');
 assert.deepEqual(requestedFixture('Is there a match tonight?',now),{recognized:true,fixture:undefined,label:'2026-10-01'});
 assert.equal(requestedFixture('kickoff this Saturday',now).label,'2026-10-03');
 assert.equal(requestedFixture('match after Nov 7',now).fixture,undefined);
 assert.equal(requestedFixture('match after Oct 9',now).fixture?.opponent,'Nashville SC');
});
test('transit fare tickets never acquire a stadium ticket-support answer',async()=>{
 for(const question of ['How do I pay for a train ticket?','Can I use my credit card on CapMetro rail?','How do I pay my bus fare?']){
  const r=await prepare({messages:[{role:'user',content:question}],context:{origin:'San Antonio'}});
  assert.equal(r.route,'transport');assert.match(r.answer!,/Umo/);assert.match(r.answer!,/Tap to Pay is not available on Rail/);assert.doesNotMatch(r.answer!,/Ticket HQ|San Antonio/);
 }
});
test('outside food and phone-wallet payment return policies rather than vendors',async()=>{
 const outside=await prepare({messages:[{role:'user',content:'Can I bring my own food or a sandwich?'}],context:{}});
 assert.equal(outside.route,'stadium');assert.match(outside.answer!,/Outside food.*not permitted/);assert.equal(outside.cards.length,0);
 const pay=await prepare({messages:[{role:'user',content:'Do the concessions take Apple Pay?'}],context:{}});
 assert.equal(pay.route,'stadium');assert.match(pay.answer!,/cashless/);
});
test('ordinary vaping does not acquire a cannabis-parking caveat',async()=>{
 const r=await prepare({messages:[{role:'user',content:'Can I vape at Q2?'}],context:{}});
 assert.equal(r.route,'stadium');assert.match(r.answer!,/prohibited/);assert.doesNotMatch(r.answer!,/cannabis|parking|911/);
});

test('smoking policy wording never triggers an evacuation, while reported smoke still does',async()=>{
 for(const question of ['Can I smoke?', 'Can we smoke some weed in the parking lot?', 'Is smoke allowed at Q2?', '¿Puedo fumar afuera?']){
  const r=await prepare({messages:[{role:'user',content:question}],context:{}});assert.equal(r.route,'stadium');assert.ok(!r.actions?.some(a=>a.href==='tel:911'));
 }
 const r=await prepare({messages:[{role:'user',content:"There is smoke in section 118"}],context:{}});assert.equal(r.route,'safety');assert.match(r.answer!,/staff/);
});
