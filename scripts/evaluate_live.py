"""Exercise all fixed acceptance questions against the public production API."""
import concurrent.futures
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://austin-fc-fan-assistant.vercel.app"
CASES = json.loads(Path("data/evaluation.json").read_text())
assert len(CASES) == 120


def evaluate(case):
    payload = {"messages": [{"role": "user", "content": case["question"]}], "context": {}}
    started = time.monotonic()
    last_error = None
    for attempt in range(2):
        try:
            request = urllib.request.Request(
                BASE + "/api/chat", data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json", "User-Agent": "AustinFC-acceptance/1.0"},
            )
            with urllib.request.urlopen(request, timeout=40) as response:
                events = [json.loads(line) for line in response.read().splitlines()]
            if not events or events[0].get("type") != "meta" or events[-1].get("type") != "done":
                raise ValueError("Incomplete streamed response")
            meta = events[0]
            answer = "".join(event.get("text", "") for event in events if event.get("type") == "delta")
            route = meta.get("route") == case["route"]
            content = bool(re.search(case["mustMatch"], answer, re.I))
            source = any(case["sourceDomain"] in item["url"].split("/")[2] for item in meta.get("sources", []))
            critical = True
            if case["kind"] == "vegan":
                critical = bool(re.search(r"Verde Vegan[^\n]*119", answer)) and not bool(re.search(r"Verde Vegan[^\n]*(?:127|133)", answer))
            elif case["kind"] == "gluten":
                critical = bool(re.search(r"allergy|cross-contact|alergia|contacto cruzado|celiaqu", answer, re.I))
            elif case["kind"] == "purchase":
                critical = bool(re.search(r"can.t|cannot|no puedo", answer, re.I))
            elif case["kind"] == "next_match":
                critical = "San Diego" in answer and "2026" in answer
            return {"id": case["id"], "pass": route and content and source and critical, "route": route, "content": content,
                    "source": source, "critical": critical, "latencyMs": round((time.monotonic() - started) * 1000),
                    "answer": answer, "sourceUrls": [item["url"] for item in meta.get("sources", [])]}
        except Exception as error:
            last_error = str(error)
            if attempt == 0:
                time.sleep(0.3)
    return {"id": case["id"], "pass": False, "error": last_error}


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(evaluate, CASES))
passed = sum(x["pass"] for x in results)
critical_failures = [x for x in results if not x["pass"] and x["id"].split("-")[0] in {"vegan", "gluten", "diaper", "purchase", "sensory", "water", "next_match"}]
report = {"createdAt": datetime.now(timezone.utc).isoformat(), "kind": "public-production-api", "total": len(results),
          "passed": passed, "accuracy": passed / len(results), "criticalFailures": len(critical_failures),
          "results": results}
Path("live-evaluation-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"total": report["total"], "passed": passed, "accuracy": report["accuracy"],
                  "criticalFailures": len(critical_failures),
                  "failures": [{k: v for k, v in x.items() if k not in {"answer", "sourceUrls"}} for x in results if not x["pass"]]}, indent=2))
if passed < 108 or critical_failures:
    raise SystemExit(1)
