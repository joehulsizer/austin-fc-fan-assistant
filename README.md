# Austin FC Fan Assistant

Public test site: **https://austin-fc-fan-assistant.vercel.app/**

A mobile-first stadium assistant for concessions, transportation, stadium policies, accessibility, ticketing guidance, weather, and Austin FC information. It answers common requests directly from a checked knowledge snapshot and uses a separately hosted language model for flexible questions. Codex is the development tool, **not** the model that runs the deployed chatbot. The assistant cannot purchase tickets or access a fan's private account.

The interface keeps information browsing inside the site: [in-site guides](https://austin-fc-fan-assistant.vercel.app/guide?topic=sources) contain the copied Q2 stadium map, published vendor locations, section directory, policies, transit guidance, schedule, roster, news, ticket steps, and current weather. [Questions to try](https://austin-fc-fan-assistant.vercel.app/try) separates knowledge-base, model-assisted, and live-weather examples. Official provider addresses remain in the API metadata for traceability, but fan-facing guide and source cards route to local pages. Transactions remain outside the preview.

The desktop menu opens as a compact icon rail and can be expanded with its top button; that choice persists in the browser. **Share chat** creates a read-only snapshot in the public Blob store and copies an unguessable `/share/...` link. Anyone with that link can see the snapshot, so fans should avoid including private information. Further conversation does not change an existing snapshot; use **Create updated copy** for a new link.

## Operations

- Hosting and builds: Vercel project `austin-fc-fan-assistant` under Joe's projects, connected to this GitHub repository. Pushing to `main` runs the cloud build and deploy.
- Knowledge: `scripts/ingest.py` retrieves current official pages, validates a minimum number of stadium documents/vendors and club records, and produces `data/knowledge.json`. The daily `Refresh stadium knowledge` GitHub Action publishes a versioned snapshot to Vercel Blob. The server reads its `latest.json` pointer and falls back to the bundled snapshot if retrieval fails. Run that workflow manually after an important official update.
- Sources: [Q2 Stadium](https://www.q2stadium.com/), [Austin FC](https://www.austinfc.com/), [CapMetro](https://www.capmetro.org/special-events/Q2), and the [National Weather Service](https://www.weather.gov/documentation/services-web-api). The [public sources page](https://austin-fc-fan-assistant.vercel.app/sources) shows the currently checked snapshot. The Satisfi exports informed vocabulary and evaluation cases, but historical replies are not treated as current authority.
- Models: server-side Vercel AI Gateway tries `openai/gpt-5.4-mini`, then `openai/gpt-5.4`, then a temporary free fallback. Paid Gateway credit was enabled and an actual `gpt-5.4-mini` response and official-source web search were verified on September 25, 2026. Auto-reload is disabled, so monitor the credit balance. Common stadium questions continue to work from the knowledge snapshot without an AI generation call. Codex's hosted code-execution harness is not part of the fan chat runtime.
- Storage: one public Blob store for versioned knowledge and evaluation results; one private Blob store for feedback. `BLOB_READ_WRITE_TOKEN`, `KNOWLEDGE_BLOB_URL`, `FEEDBACK_READ_WRITE_TOKEN`, `FEEDBACK_STORE_ID`, and `CRON_SECRET` are server-only Vercel environment variables. `CRON_SECRET` is also a GitHub Actions secret for protected publishing. Never commit these values.
- Monitoring: `/api/health` reports snapshot age and counts. Vercel logs record route, latency, answer length, model token usage, and retrieval failures without full fan prompts. Feedback is saved privately and can be reviewed through authenticated `/api/feedback` GET by receipt; no public feedback export exists.

## Verification and updating

The `Cloud checks` GitHub Action builds, runs unit tests, a fixed 120-case offline evaluation, and desktop/mobile browser checks. The `Production acceptance` action tests those same 120 cases against the **public production API** and, if at least 90% pass with no critical failures, saves the report in Blob at `evaluations/latest.json`. Run it after a deployment or material content change. Its report artifact includes each answer and source for review.

To change content, edit the ingest rules or reviewed structured data, then run the refresh workflow and review `/sources`, `/api/health`, and a production acceptance run. `data/club-schedule.json` contains a reviewed published season schedule; update it when the club publishes a new schedule. Weather is retrieved live from NWS, with a short cache. The stadium map is linked for locations; zone-based proximity is approximate, not a walking-time estimate.

## Later native-app integration

The website is the proof of concept. The Austin FC/Yinzcam app can embed it in a web view or call `POST /api/chat` from a native chat interface. The API takes `{ messages: [{ role, content }], context: { section?, dietary?, language?, event? } }` and streams newline-delimited JSON events: `meta` (route, sources, cards, updated context), `delta` (answer text), and `done`. The native app should store the returned context per fan session, offer a reset, and use official app deep links for ticket transactions. Before a broader launch, agree on brand review, event data integration, privacy retention, traffic limits, and any account-specific capabilities with the app team.
