# Club knowledge feed and app-team handoff

Production endpoint: `POST https://austin-fc-fan-assistant.vercel.app/api/internal-knowledge`

Authorization: `Bearer CRON_SECRET` using the existing server/Vercel environment secret. Never put the token in the app or browser. The POC does not need a staff dashboard. A maintained file or existing API can post the same JSON contract. Uploads replace the entire feed; `entries: []` clears it. Valid versions are saved in Blob before the latest pointer changes; rejected uploads retain the last version. Retrieval caches for up to 60 seconds.

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

The example is a schema example, not a verified discount; do not publish placeholders. Expired entries are excluded. Safety, stadium-policy, live-weather, and match-schedule paths cannot be overridden by this feed. Answers are served as approved data, not model instructions. Credentials, arbitrary external action URLs, duplicate IDs, oversized payloads, future review times, invalid expiry and recognizable operating instructions are rejected.

## Chat API contract

`POST /api/chat` returns NDJSON: `meta` with `context`, `sources`, `cards`, `actions`, `route`, then `delta` text and `done`. Multiple intents use route `multi`; emergencies use `safety` and deterministic bilingual content, without model generation. Sources retain original official URLs and `checkedAt`; the website maps these to local guide pages. Actions are separately allowlisted handoffs (SMS, email, SeatGeek, OrderNext, maps). Preserve both categories in the native app and shared chat snapshots.

Maps links use the provided starting point and destination; they do not imply live routing, fastest-route verification, delivery availability, or a completed transaction. Leave-by time is calculated from the supplied start, arrival buffer, and user travel duration (or an explicitly provisional 60-minute allowance). Concerts use event-specific confirmation, never an Austin FC fixture inferred from “next month.”

The site retains browser context and shared chats in public Blob snapshots. Account transactions and actual app privacy/data-retention controls belong to the native-app handoff.
