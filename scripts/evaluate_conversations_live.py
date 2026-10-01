"""Run paraphrased multi-turn fan chats against production and prepare a human review sheet."""
import csv
import os
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

BASE = "https://austin-fc-fan-assistant.vercel.app"
SCENARIOS = json.loads(Path("data/conversation-evaluation.json").read_text())["scenarios"]
SCHEDULE = json.loads(Path("data/club-schedule.json").read_text())


def next_home():
    now = datetime.now(timezone.utc)
    future = [event for event in SCHEDULE["events"] if event["home"] and datetime.fromisoformat(event["startsAt"]).astimezone(timezone.utc) > now]
    return min(future, key=lambda event: datetime.fromisoformat(event["startsAt"])) if future else None


def ask(messages, context):
    request = urllib.request.Request(BASE + "/api/chat", data=json.dumps({"messages": messages[-16:], "context": context}).encode(),
                                     headers={"Content-Type": "application/json", **({"Authorization":"Bearer "+os.environ["CRON_SECRET"]} if os.environ.get("CRON_SECRET") else {}), "User-Agent": "AustinFC-multiturn-acceptance/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        events = [json.loads(line) for line in response.read().splitlines()]
    if not events or events[0].get("type") != "meta" or events[-1].get("type") != "done":
        raise ValueError("Incomplete chat response")
    return events[0], "".join(event.get("text", "") for event in events if event.get("type") == "delta")


results = []
for scenario in SCENARIOS:
    if scenario.get("requiresNextHome") and not next_home():
        continue
    messages, context = [], {}
    for turn_number, turn in enumerate(scenario["turns"], 1):
        messages.append({"role": "user", "content": turn["question"]})
        try:
            meta, answer = ask(messages, context)
            context = meta["context"]
            expected = (next_home() or {}).get("opponent", "no other confirmed future match") if turn["mustMatch"] == "@NEXT_HOME" else turn["mustMatch"]
            checks = {
                "route": meta.get("route") == turn["route"],
                "answer": expected.lower() in answer.lower() if turn["mustMatch"] == "@NEXT_HOME" else bool(re.search(expected, answer, re.I)),
                "exclusion": not turn.get("mustNotMatch") or not re.search(turn["mustNotMatch"], answer, re.I),
                "source": not turn.get("sourceDomain") or any(urlparse(source["url"]).hostname.endswith(turn["sourceDomain"]) for source in meta.get("sources", [])),
                "context": all((((next_home() or {}).get("opponent", "no other confirmed future match") if value == "@NEXT_HOME" else str(value)).lower() in context.get("event", {}).get("title", "").lower() if key == "eventOpponent" else context.get(key) == value)
                               for key, value in turn.get("context", {}).items()),
                "cleared": all(context.get(key) is None for key in turn.get("contextAbsent", [])),
            }
            result = {"scenario": scenario["id"], "turn": turn_number, "question": turn["question"], "answer": answer,
                      "route": meta.get("route"), "context": context, "sourceUrls": [source["url"] for source in meta.get("sources", [])],
                      "checks": checks, "pass": all(checks.values())}
            messages.append({"role": "assistant", "content": answer[:1500]})
        except Exception as error:
            result = {"scenario": scenario["id"], "turn": turn_number, "question": turn["question"], "answer": "",
                      "route": "", "context": context, "sourceUrls": [], "checks": {}, "pass": False, "error": str(error)}
            messages.append({"role": "assistant", "content": "Service unavailable."})
        results.append(result)

report = {"createdAt": datetime.now(timezone.utc).isoformat(), "total": len(results), "passed": sum(item["pass"] for item in results), "results": results}
Path("live-conversation-evaluation-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
with Path("conversation-human-review.csv").open("w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["scenario", "turn", "fan question", "assistant answer", "cited URLs", "automated pass", "human answer correct", "human citations support answer", "human notes"])
    for item in results:
        writer.writerow([item["scenario"], item["turn"], item["question"], item["answer"], " | ".join(item["sourceUrls"]), item["pass"], "", "", ""])
print(json.dumps({"total": report["total"], "passed": report["passed"], "failures": [
    {"scenario": item["scenario"], "turn": item["turn"], "checks": item["checks"], "answer": item["answer"][:180]} for item in results if not item["pass"]]}, indent=2))
if report["passed"] != report["total"]:
    raise SystemExit(1)
