# Club knowledge feed and app-team handoff

Production endpoint: `POST https://austin-fc-fan-assistant.vercel.app/api/internal-knowledge`

Authorization: `Bearer CRON_SECRET` using the existing server/Vercel environment secret. Never put the token in the app or browser. Staff can submit and review drafts at `/admin/knowledge`. A maintained file or existing API can also post the approved JSON contract. Authenticated `GET` returns the current approved feed for editors/adapters. Uploads replace the entire feed; `entries: []` clears it. Valid versions are saved in Blob before the latest pointer changes; rejected uploads retain the last version. Retrieval caches for up to 60 seconds.

Only approved fan-facing answers belong in this **public** POC feed. Each entry requires both English and Spanish, approval attribution, review time, expiry, and official source/provenance URL. It is not connected to a club system yet. Ask the business team: “Where should staff maintain approved chatbot answers—a spreadsheet, uploaded file, or existing system? Who approves changes?”

```json
{
  "version": "2026-09-29T18:00:00Z",
  "entries": [{
    "id": "stm-food-discount",
    "title": "Season-ticket food discount guidance",
    "topic": "benefits",
    "keywords": ["STM food discount", "season ticket food discount", "descuento de comida para abonados"],
    "answer": {
      "en": "Replace with the club-approved answer and eligibility conditions.",
      "es": "Reemplazar con la respuesta aprobada por el club y las condiciones."
    },
    "fanFacing": true,
    "approvedBy": "Name of the club content approver",
    "checkedAt": "2026-09-29T18:00:00Z",
    "expiresAt": "2026-10-29T18:00:00Z",
    "sourceUrl": "https://www.austinfc.com/",
    "actions": [{"label": "Email Guest Services", "href": "mailto:GuestServices@AustinFC.com"}]
  }]
}
```

The example is a schema example, not a verified discount; do not publish placeholders. Expired entries are excluded. Safety and live weather cannot be overridden by this feed. Approved stadium entries must declare their specific `policy`; club entries can provide approved club information. Scope each entry narrowly and review changing event facts before publication. Answers are served as approved data, not model instructions. Credentials, arbitrary external action URLs, duplicate IDs, oversized payloads, future review times, invalid expiry and recognizable operating instructions are rejected.

## Chat API contract

`POST /api/chat` returns NDJSON: `meta` with `context`, `sources`, `cards`, `actions`, `route`, then `delta` text and `done`. Multiple intents use route `multi`; emergencies use `safety` and deterministic bilingual content, without model generation. Sources retain original official URLs and `checkedAt`; the website maps these to local guide pages. Actions are separately allowlisted handoffs (SMS, email, SeatGeek, OrderNext, maps). Preserve both categories in the native app and shared chat snapshots.

Maps links use the provided starting point and destination. Capped live routing can provide a checked duration for supported driving, walking or cycling trips; the answer identifies the provider, check time and traffic limitation. Leave-by time uses that duration or the fan’s supplied duration and the stated arrival buffer. There is no assumed 60-minute trip. Maps links do not guarantee the fastest route, delivery availability or a completed transaction. Concerts use event-specific confirmation, never an Austin FC fixture inferred from “next month.”

The site retains browser context and shared chats in public Blob snapshots. Account transactions and actual app privacy/data-retention controls belong to the native-app handoff.

Production uses a bounded model classifier for unfamiliar wording, with deterministic routing as the outage fallback. Safety bypasses classification and answer-generation models entirely. Cloud tests exercise the outage fallback; production red-team tests exercise the hosted model path and fallback when needed.

`meta.planner` reports `fixed` for safety, `model` for semantic interpretation, or `fallback` for a provider outage/offline check. Server logs record model token usage without fan messages. Apple cycling links use the current `/directions?mode=cycling` format; Google uses `travelmode=bicycling`. Apple’s unified links require iOS 18.4/macOS 15.4 or later; the Google alternative is also provided. See [Apple documentation](https://developer.apple.com/documentation/mapkit/unified-map-urls) and [Google documentation](https://developers.google.com/maps/documentation/urls/get-started).


## Submit, review, publish

1. Open `/admin/knowledge`. The submitter enters their own name, a stable entry ID, topic, narrowly scoped keywords, English and Spanish fan answers, an official source URL and expiry. Stadium entries also require a policy. Use the submit key provided through the club’s secure process; never put a key in an entry or URL.
2. `POST /api/internal-knowledge/drafts` creates a private pending draft. This does not change fan answers.
3. A different named reviewer uses reviewer access to inspect pending drafts, verify the source and both languages, then approve or reject. `PATCH /api/internal-knowledge/drafts` records the decision. A submitter cannot approve their own entry.
4. Approval writes the canonical private approved feed atomically, preserving other approved entries, then projects a public version for the knowledge guide. Chat reads the approved answer with approval time as `checkedAt`. Expired entries are excluded. Failed publication returns the draft to pending for retry.

The interface and workflow are implemented. Actual STM benefits, upper-level concessions, clubs/markets, coaching details and child-ticket exceptions require club-approved facts. Do not fill these gaps with invented or sample benefits. The existing published general child policy remains available.

Current limits: 30 fan chats/client/minute (recognized safety bypasses throttling), 10 shares/client/hour, 30 feedback requests/client/hour, 1000 paid AI calls/day, $25/day conservative AI reservations, and 200 routing-provider calls/day. Authenticated evaluations have a separate bounded budget. Reservations are not a bill and do not cap hosting/storage charges.
