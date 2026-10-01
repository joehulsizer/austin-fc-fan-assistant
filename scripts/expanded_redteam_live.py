"""Live independent facts + metamorphic variants + stateful workflows. Preserve every failure.
Requests use the real production handler through a reviewer-only separately capped endpoint.
Use REDTEAM_CHAT_PATH=/api/chat to verify selected cases via the public fan endpoint.
"""
import concurrent.futures,json,os,time,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
from redteam_oracle import evaluate
BASE=os.environ.get('ASSISTANT_URL','https://austin-fc-fan-assistant.vercel.app').rstrip('/')
CHAT=os.environ.get('REDTEAM_CHAT_PATH','/api/redteam');OUT=os.environ.get('EXPANDED_OUTPUT','expanded-redteam-results.json')
DATA=json.loads(Path('data/expanded-redteam.json').read_text());TOKEN=os.environ['CRON_SECRET']

def ask(messages,context,offline=False):
 h={'Content-Type':'application/json','Authorization':'Bearer '+TOKEN,'User-Agent':'AustinFC-independent-redteam/2.0'}
 if offline:h['x-redteam-provider-outage']='ai-and-routing'
 req=urllib.request.Request(BASE+CHAT,headers=h,data=json.dumps({'messages':messages[-16:],'context':context},ensure_ascii=False).encode())
 with urllib.request.urlopen(req,timeout=100) as r:events=[json.loads(line) for line in r.read().splitlines()]
 if not events or events[0].get('type')!='meta' or events[-1].get('type')!='done':raise ValueError('Incomplete stream: '+json.dumps(events)[-200:])
 return events[0],''.join(e.get('text','') for e in events if e.get('type')=='delta')

def single(case,offline=False):
 started=time.monotonic()
 try:
  meta,answer=ask(case.get('history',[])+[{'role':'user','content':case['question']}],case.get('context',{}),offline)
  failures=evaluate(case,meta,answer)
  return {**case,'pass':not failures,'failures':failures,'answer':answer,'meta':meta,'outage':offline,'latencyMs':round((time.monotonic()-started)*1000)}
 except Exception as e:return {**case,'pass':False,'failures':[str(e)],'outage':offline}

def scenario(s):
 messages=[];context={};results=[]
 for i,turn in enumerate(s['turns']):
  case={**turn,'id':s['id']+'-'+str(i+1),'family':'conversation'};messages.append({'role':'user','content':turn['question']})
  try:
   meta,answer=ask(messages,context);failures=evaluate(case,meta,answer);results.append({**case,'pass':not failures,'failures':failures,'answer':answer,'meta':meta});context=meta.get('context',{});messages.append({'role':'assistant','content':answer[:3500]})
  except Exception as e:results.append({**case,'pass':False,'failures':[str(e)]})
 return results

cases=DATA['cases'];only=os.environ.get('EXPANDED_ONLY')
if only:cases=[c for c in cases if c['id'] in only.split(',') or c['family'] in only.split(',')]
if os.environ.get('EXPANDED_BASE_ONLY'):cases=[c for c in cases if not c.get('mutation')]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(single,cases))
if not only:
 for s in DATA['scenarios']:results.extend(scenario(s))
 # Service failures must not bypass fixed safety or change established policies.
 outages=[c for c in DATA['cases'] if not c.get('mutation') and c['contract'] in {'selfharm','medical','lostperson','harassment','evacuation','bags','water','transfer','food','smoking','allergy'}]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results.extend(pool.map(lambda c:single({**c,'id':c['id']+'-outage'},True),outages))
families={}
for r in results:
 f=families.setdefault(r['family'],{'total':0,'passed':0,'criticalFailures':0});f['total']+=1;f['passed']+=r['pass'];f['criticalFailures']+=bool(r.get('critical') and not r['pass'])
report={'createdAt':datetime.now(timezone.utc).isoformat(),'url':BASE,'chatPath':CHAT,'total':len(results),'passed':sum(r['pass'] for r in results),'criticalFailures':sum(bool(r.get('critical') and not r['pass']) for r in results),'families':families,'results':results}
Path(OUT).write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
print('FAILURES',json.dumps([{'id':r['id'],'problems':r['failures'],'answer':r.get('answer','')[:160]} for r in results if not r['pass']],ensure_ascii=False,indent=2))
if report['passed']!=report['total']:raise SystemExit(1)
