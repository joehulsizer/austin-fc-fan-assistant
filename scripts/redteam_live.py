"""Run feedback reproductions and bilingual/adversarial cases on the public API.
Assertions check all requested parts, exclusions, source relevance, language and real actions.
Complete transcripts are saved for independent review; this is not human adjudication.
"""
import concurrent.futures,json,re,os,time,urllib.request
from pathlib import Path
from datetime import datetime,timezone
BASE=os.environ.get('ASSISTANT_URL','https://austin-fc-fan-assistant.vercel.app').rstrip('/')
CASES=json.loads(Path('data/redteam.json').read_text())
def ask(question,messages,context):
 payload={'messages':(messages+[{'role':'user','content':question}])[-16:],'context':context}
 request=urllib.request.Request(BASE+'/api/chat',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(request,timeout=110) as r:events=[json.loads(x) for x in r.read().splitlines()]
 if not events or events[0].get('type')!='meta' or events[-1].get('type')!='done':raise ValueError('Incomplete response')
 return events[0],''.join(e.get('text','') for e in events if e.get('type')=='delta')
def evaluate(c):
 start=time.monotonic();messages=[];context=c.get('context',{});transcript=[]
 try:
  for q in c.get('prior',[])+[c['question']]:
   meta,answer=ask(q,messages,context);context=meta.get('context',{});transcript.append({'question':q,'answer':answer,'meta':meta});messages.extend([{'role':'user','content':q},{'role':'assistant','content':answer}])
  checks={'route':meta.get('route')==c['route'],'all_parts':all(re.search(p,answer,re.I) for p in c['all']),'exclusions':all(not re.search(p,answer,re.I) for p in c.get('none',[])),'language':not c.get('language') or context.get('language')==c['language'],'handoff':bool(meta.get('actions')) and (not c.get('action') or any(c['action'] in a['href'] for a in meta.get('actions',[]))),'sources':not c.get('sources') or [s['title'] for s in meta.get('sources',[])]==c['sources']}
  return {'id':c['id'],'pass':all(checks.values()),'checks':checks,'transcript':transcript,'latencyMs':round((time.monotonic()-start)*1000)}
 except Exception as e:return {'id':c['id'],'pass':False,'error':str(e),'transcript':transcript}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(evaluate,CASES))
passed=sum(r['pass'] for r in results);report={'createdAt':datetime.now(timezone.utc).isoformat(),'url':BASE,'plannerCounts':{mode:sum(t['meta'].get('planner')==mode for r in results for t in r.get('transcript',[])) for mode in ['fixed','model','fallback']},'total':len(results),'passed':passed,'results':results}
Path('redteam-live-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps({'total':len(results),'passed':passed,'failures':[{k:v for k,v in r.items() if k!='transcript'} for r in results if not r['pass']]},indent=2))
if passed!=len(results):raise SystemExit(1)
