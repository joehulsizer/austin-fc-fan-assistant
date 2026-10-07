import test from 'node:test';
import assert from 'node:assert/strict';
import {detectContext,staticKnowledge} from '../lib/knowledge';
import {travelGrounding} from '../lib/travel';
import {parseOrigin} from '../lib/origin';

test('kickoff time before the event word is retained',()=>{
 for(const [phrase,expected] of [['19:30 kickoff','19:30'],['07:30 kickoff','07:30'],['00:30 kickoff','00:30'],['kickoff is 07:30','07:30'],['7:30 PM kickoff','19:30'],['12:15 AM kickoff','00:15'],['kickoff is at 19:30','19:30']]) {
  assert.equal(detectContext(`When should I leave for a ${phrase}?`,{}).kickoffTime,expected,phrase);
 }
});
test('route estimate and supplied kickoff produce a leave-by answer',()=>{
 const query='I am starting at UT Austin. How long is the drive to Q2 Stadium and when should I leave for a 19:30 kickoff?';
 const context=detectContext(query,{});
 const result=travelGrounding(query,context,staticKnowledge,{minutes:17,distanceKm:14.6,mode:'car',provider:'OpenStreetMap / OSRM',traffic:false,checkedAt:'2026-10-07T06:25:33.223Z',originLabel:'UT Austin'});
 assert.match(result.answer||'',/aim to arrive by 6:00 PM CT/);
 assert.match(result.answer||'',/leave by 5:43 PM CT/);
 assert.doesNotMatch(result.answer||'',/Tell me the event date\/start time/);
 assert.match(result.answer||'',/no live traffic/);
});
test('a trip time and invalid kickoff do not become a valid start time',()=>{
 for(const phrase of ['Maps shows 17 minutes.','25:30 kickoff','24:07 kickoff','19:99 kickoff','kickoff 2026-11-02']) assert.equal(detectContext(phrase,{}).kickoffTime,undefined);
});
test('a public address before a how-long question stays separate from instructions',()=>{
 const query='I am starting at 1100 Congress Avenue. How long is the drive to Q2 Stadium and when should I leave? Kickoff is at 19:30.';
 assert.equal(parseOrigin(query),'1100 Congress Avenue');
 const result=travelGrounding(query,detectContext(query,{}),staticKnowledge);
 assert.ok(result.actions?.every(action=>!action.href.includes('How+long')));
 assert.match(result.answer||'',/Route duration is unavailable/);
});

import {weatherGrounding} from '../lib/live';
import {liveRoute} from '../lib/routing';

test('place abbreviations and names containing how long survive question trimming',()=>{
 for(const place of ["St. Edward's University",'Austin City Hall','The How Long Cafe']) {
  assert.equal(parseOrigin(`I am starting at ${place}. How long does it take to drive to Q2 Stadium?`),place);
 }
});
test('explicit dates and Austin timezone wording do not become clock digits',()=>{
 for(const query of ['2026-11-02 19:30 kickoff','Kickoff is 19:30 CT on 2026-11-02']) assert.equal(detectContext(query,{}).kickoffTime,'19:30');
 for(const startsAt of ['2026-07-02T19:30:00-05:00','2026-11-02T19:30:00-06:00']) {
  const result=travelGrounding('When should I leave?',{origin:'UT Austin',event:{title:'Planning time supplied',startsAt},travelMinutes:17},staticKnowledge);
  assert.match(result.answer||'',/7:30 PM CT start/);
  assert.match(result.answer||'',/leave by 5:43 PM CT/);
 }
});
test('weather date remains Austin time after DST ends',async()=>{
 const saved=global.fetch;
 global.fetch=async()=>Response.json({properties:{periods:[{startTime:'2026-11-02T18:00:00-06:00',endTime:'2026-11-02T19:00:00-06:00',temperature:68,temperatureUnit:'F',shortForecast:'Clear',windSpeed:'5 mph'}]}});
 try {assert.match((await weatherGrounding('weather 2026-11-02 18:00',{language:'en'})).answer||'',/68°F/);}
 finally {global.fetch=saved;}
});
test('unavailable providers preserve bounded fallback answers',async()=>{
 const saved=global.fetch,previousRouting=process.env.ROUTING_LIVE_TEST;
 process.env.ROUTING_LIVE_TEST='1';
 global.fetch=async()=>{throw new Error('fixture provider unavailable');};
 try {
  assert.match((await weatherGrounding('weather tomorrow',{language:'en'})).answer||'',/live forecast is unavailable/);
  assert.equal(await liveRoute({origin:'UT Austin'},'car'),undefined);
  const answer=travelGrounding('When should I leave?',{origin:'UT Austin',travelMode:'car',kickoffTime:'19:30'},staticKnowledge).answer||'';
  assert.match(answer,/Route duration is unavailable/);
  assert.doesNotMatch(answer,/route checked|leave by/);
 }finally {global.fetch=saved;if(previousRouting===undefined)delete process.env.ROUTING_LIVE_TEST;else process.env.ROUTING_LIVE_TEST=previousRouting;}
});
