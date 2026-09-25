"""Refresh public Q2 Stadium content; historical Satisfi exports are never published."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "policy": "https://www.q2stadium.com/a-z-policy-guide/",
    "vendors": "https://www.q2stadium.com/food-and-drink/our-vendors/",
    "map": "https://www.q2stadium.com/stadium-maps/",
    "directions": "https://www.q2stadium.com/directions/",
    "parking": "https://www.q2stadium.com/parking/",
    "drinks": "https://www.q2stadium.com/food-and-drink/drink-menu/",
}


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def fetch(url):
    result = subprocess.run(
        ["curl", "-fLsS", "--max-time", "25", "-A", "Mozilla/5.0 AustinFCFanAssistant/1.0", url],
        capture_output=True,
        check=True,
    )
    if len(result.stdout) < 3000:
        raise ValueError(f"Page is unexpectedly small: {url}")
    return result.stdout


def main():
    fetched = {key: fetch(url) for key, url in PAGES.items()}
    parsed = {key: html.fromstring(content) for key, content in fetched.items()}
    checked = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    docs = []
    for node in parsed["policy"].xpath('//div[contains(concat(" ",normalize-space(@class)," ")," faq ")]'):
        title = clean(" ".join(node.xpath('./a[1]//text()')))
        body_nodes = node.xpath('./div[contains(@class,"faq-content")]')
        if not title or not body_nodes:
            continue
        body = clean(body_nodes[0].text_content())
        if len(body) < 20:
            continue
        docs.append({"id": "policy-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"), "title": title,
                     "body": body, "url": PAGES["policy"], "checkedAt": checked,
                     "links": [{"label": clean(a.text_content()) or "Official link", "url": a.get("href")}
                               for a in body_nodes[0].xpath('.//a[@href]') if (a.get("href") or "").startswith("https://")]})
    for key, title in [("directions", "Transportation and directions"), ("parking", "Parking")]:
        main_nodes = parsed[key].xpath("//main")
        if not main_nodes:
            raise ValueError(f"No main content at {PAGES[key]}")
        for garbage in main_nodes[0].xpath('.//script|.//style'):
            garbage.drop_tree()
        body = clean(main_nodes[0].text_content())[:14000]
        docs.append({"id": key, "title": title, "body": body, "url": PAGES[key], "checkedAt": checked,
                     "links": [{"label": clean(a.text_content()) or "Official link", "url": a.get("href")}
                               for a in main_nodes[0].xpath('.//a[@href]') if (a.get("href") or "").startswith("https://")]})
    vendors = []
    for heading in parsed["vendors"].xpath("//main//h3"):
        parent = heading.getparent()
        name = clean(heading.text_content())
        h4s = parent.xpath("./h4|./div/h4")
        location = clean(" ".join(x.text_content() for x in h4s))
        description = clean(" ".join(x.text_content() for x in parent.xpath("./p|./div/p")))
        if not name or not location:
            continue
        sections = sorted(set(int(s) for s in re.findall(r"\b(?:1\d\d|3\d\d)\b", location)))
        if not sections:
            raise ValueError(f"No section for vendor {name}")
        vendors.append({"name": name, "sections": sections, "location": location, "description": description,
                        "url": PAGES["vendors"], "checkedAt": checked})
    if len(vendors) < 15 or len(docs) < 40:
        raise ValueError(f"Incomplete scrape: {len(vendors)} vendors, {len(docs)} guidance topics")
    map_source = fetched["map"].decode("utf-8", errors="replace")
    map_pins = []
    for attrs in re.findall(r"<use\b([^>]+)>?", map_source):
        match_id = re.search(r'\bid="([^"]+)"', attrs)
        match_class = re.search(r'\bclass="([^"]+)"', attrs)
        if not match_id or not match_class:
            continue
        classes = match_class.group(1).split()
        if "icon-concession" not in classes:
            continue
        map_pins.append({"id": match_id.group(1), "labels": [x[5:] for x in classes if x.startswith("icon-") and x != "icon-concession"]})
    snapshot = {"version": checked, "checkedAt": checked, "sources": [{"url": url, "sha256": hashlib.sha256(fetched[key]).hexdigest()}
                                                                   for key, url in PAGES.items()],
                "documents": docs, "vendors": vendors, "mapPins": map_pins}
    out = ROOT / "data" / "knowledge.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"version": checked, "vendors": len(vendors), "documents": len(docs), "mapPins": len(map_pins), "bytes": out.stat().st_size}))


if __name__ == "__main__":
    main()
