"""Export all retained private fallbacks/template hits for review, with no prompt text in logs."""
import os,json,urllib.request,urllib.parse
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
BASE=os.environ.get('ASSISTANT_URL','https://austin-fc-fan-assistant.vercel.app');cursor=None;records=[];budget=None
while True:
 query={'day':os.environ.get('DIAGNOSTIC_DAY',datetime.now(ZoneInfo('America/Chicago')).date().isoformat())}
 if cursor:query['cursor']=cursor
 req=urllib.request.Request(BASE+'/api/diagnostics?'+urllib.parse.urlencode(query),headers={'Authorization':'Bearer '+os.environ['CRON_SECRET']})
 with urllib.request.urlopen(req,timeout=70) as response:page=json.load(response)
 records.extend(page['records']);budget=page['budget'];cursor=page.get('cursor')
 if not cursor:break
hits=[r for r in records if r.get('route')=='fallback' or any(t.get('fixed') for t in r.get('templates',[]))]
unique={r['question']:{'question':r['question'],'observedRoute':r['route'],'templates':r['templates'],'sourceTitles':r['sourceTitles'],'reviewRequired':True} for r in hits}
Path('diagnostic-review-candidates.json').write_text(json.dumps({'day':query['day'],'records':len(records),'hits':len(hits),'unique':len(unique),'budget':budget,'candidates':list(unique.values())},indent=2,ensure_ascii=False))
print(json.dumps({'records':len(records),'hits':len(hits),'uniqueReviewCandidates':len(unique),'budget':budget}))
