# October red-team repair and handoff

Site: https://austin-fc-fan-assistant.vercel.app

This repair addresses Harrison’s deeper English/Spanish red team. The initial production replay reproduced the reported failures. Validation below separates code checks from actual hosted-service tests; passing a regression suite is evidence for those cases, not a guarantee that every future phrasing will pass.

## Individual findings and resulting behavior

| Finding | Repair and expected behavior |
| --- | --- |
| Singular stroller/elevator, gun, ESA, halftime return, Tesla, autistic/quiet and cashless retrieval misses | Reviewed bilingual aliases select the matching policy and verify its own source anchor. Singular/plural wording, synonyms and everyday phrasing produce the same answer. |
| Camera and lost-something examples failed | Camera policy resolves directly; losing an item uses the fixed lost-property handler. |
| Self-harm in the 300s | Fixed bilingual response leads with 911, nearest staff/security, moving away from edges and staying with someone. It never calls a model. |
| Grabbing a girlfriend / harassment | Fixed immediate-danger 911 guidance, nearest staff and 35-ASK-VERDE with section/row/seat. |
| Lightning and shelter | Fixed evacuation/severe-weather response follows staff and announcements; it does not invent an active evacuation or an exit. |
| Cannabis falsely triggered evacuation | Smoking policy resolves instead, without a 911 action. Parking permission is not invented. |
| Peanut allergy fallback | Stand ingredient/cross-contact check and Guest Services behind 124. Vegan/gluten-aware labels do not establish allergy safety. |
| Generic ticket account refusal | Specific handlers cover buying instructions, transfers, receiving, prices/discounts, resale, screenshots, postponement, sign-in and barcode problems. All ticket help includes Ticket HQ phone/email. |
| Dead phone / blank barcode at gate | Entry staff and northeast Ticket HQ; matchday box office opens three hours before kickoff and closes at minute 60. No instruction to enter first to charge the phone. |
| Children / STM entrance / identity / emoji routed as account help | Children use verified age guidance; STM entrance uses ticket/map instructions with an honest unavailable detail; bot identity and emoji get fixed appropriate replies. |
| Greedy or missing origins | AUS, Domain, UT and arbitrary stated public starting points parse. Section statements and forged notices are not trip origins. |
| Missing origin dumped five modes/14 buttons | Default suggestions are compact; explicit mode requests are respected. Only an absent origin prompts a starting-point question. |
| Origin contaminated fares, park-and-ride and section-gate questions | Independent handlers answer the current question. Saved origin remains context but is not inserted into unrelated text or route actions. |
| Walking unavailable | Walking route estimates and Apple/Google walking directions work. Estimates identify the mode explicitly. |
| Leave-by required supplied Maps duration | Real route lookup supplies a duration when available. Start time, arrival buffer and mode-specific duration determine leave-by. Unavailable routing has a genuine Maps fallback. |
| Stale CapMetro Umo / missing payment answer | Current fare source is ingested and checked. Phone wallet, credit/debit, Umo and reloadable card with relevant fare capping are explained. |
| Missing park-and-ride | Route 383, North Lamar Transit Center and Pavilion Park & Ride surface directly. |
| 7:30 / 100 degrees / weather-policy over-triggering | Time alone is not a forecast request. Weather policy answers policy; actual forecast requests use NWS. |
| Parking on tailgating, RV and motorcycle queries | Specific policy handlers take priority; unsupported vehicle eligibility receives useful staff guidance without invented eligibility. Teen drop-off remains travel guidance. |
| Family run-ons and multiple policies lost parts | All recognized policy/service requests remain in the plan. Child ticket, parking and stroller are answered together; backpack, water and alcohol cutoff remain separate parts. |
| Tonight / Saturday / after Nov 7 | Austin-local relative dates and end-of-schedule answers work without inventing fixtures. |
| Bare 118 follow-up | Saves section 118 and reuses the preceding food/policy question where appropriate. |
| OrderNext followed by contradictory fallback | Unrequested generic intents are removed and duplicate answer parts collapsed. Ordering leads to OrderNext; delivery eligibility remains with the platform. |
| Location conflicts in fan answers | Kesos main-concourse location, sensory-room location and the disputed second family restroom are not guessed. Verified section 312 / Guest Services 124 / family restroom 121 remain useful. Conflicts are logged internally. Guide pages use the same safe wording. |
| Concert caveat without concert / irrelevant illness refund text | Context-specific caveats only. Refund help supplies Ticket HQ contact directly without claiming illness eligibility. |
| Stale source chips across turns | Each answer builds sources from its current grounding. Prior bag/alcohol/re-entry chips do not attach to unrelated policies. |
| Repeated limitations | Known answers are reviewed fixed text; flexible-generation instructions require useful steps first and at most one limitation at the end. Genuine independent unavailable parts can still need distinct explanations. |
| Unsupported languages | Fixed bilingual English/Spanish availability response. Current message language wins over previous turns. |
| Spanish transfers, restroom follow-ups and alcohol cutoff | Direct bilingual coverage, including “traspasar,” “baños más cercanos” and “hasta qué hora venden cerveza.” |
| Austin FC II / away games | Fixed Q2-only scope response and official club source. |
| Four-message burst silently dropped messages | Composer queues every message while streaming, visibly shows the queue, preserves draft text and updates context between queued requests. Reset clears the queue; cancellation remains available. |
| Public shares contained personal information | Both server and client scrub contacts, credentials, addresses and map origins. Fan reviews a redacted preview and explicitly confirms before publishing. Existing shares are sanitized when rendered; a reviewer-only migration rewrites old public records after making private backups. Names can escape pattern-based scrubbing, so review is required. |
| Guest Services buttons on every answer | Removed from successful general policy, greeting, travel and food responses. Safety, ticket help and actual dead ends retain useful handoffs. Food keeps OrderNext; travel keeps relevant Maps/provider actions. |
| Non-JS guide topics were wrong | Dynamic server rendering plus explicit `/guide/[topic]` routes. Tests cover legacy query URLs and physical topic URLs with JavaScript disabled. |
| 390px webview untested | Browser checks cover overflow, sources, policies, safety, keyboard actions, streaming, queue, reset and public share. |
| Knowledge feed had no real intake/review flow | Private submit endpoint and staff console; separate submission/reviewer keys; another reviewer must approve; server stamps approver/review time; expiry excludes stale answers. Conditional writes prevent conflicting publication. |
| Fallthroughs were not reproducible from logs | Private, scrubbed per-question diagnostic records now retain current question, route, planner, templates, source titles and latency. Authenticated export is paginated. Old logs did not retain question text, so those exact prompts cannot be reconstructed; report prompts and the initial production replay supply the regression cases. |
| Unclear safety implementation | Hardcoded intent/response table in `lib/safety.ts`; safety returns before semantic planning or model generation. |
| No enforced rate/cost bounds | Distributed client request limits, conservative daily AI reservations, model-call cap and routing-provider cap. Paid calls fail closed when budget storage is unavailable. |

Additional coverage includes food words such as “hot dog” not matching animal policy, food pickup not matching rideshare, re-entry not adding ticket help, outside-food policy, Apple/Google Pay, new-origin duration reset, forged notices, source injection, expired feed entries, and concurrent limit reservations.

## Club knowledge submission and approval

1. Open `/admin/knowledge`. A submission user receives `KNOWLEDGE_SUBMIT_SECRET`; reviewers use the existing server-side reviewer key (`CRON_SECRET`). Keys are provisioned in Vercel and entered in the console password field; they stay in page memory, not URLs/local storage. The POC uses shared role keys, not individual authenticated accounts.
2. Enter a name/role and edit the supplied JSON example: stable ID, title, topic, English/Spanish keyword phrases, English/Spanish public answer, official provenance URL, expiry and optional approved action links.
3. Submit a private draft. It is not used by fan chat. Submission credentials cannot view or approve the review queue.
4. A different reviewer enters reviewer credentials and name, loads the queue, checks the facts, bilingual wording, provenance and expiry, then approves or rejects.
5. Approval stamps review time and approver, writes an immutable public version and atomically updates the approved feed. Chat can read it within 60 seconds. Expired entries are excluded automatically; repeat an ID to update an existing answer through another review.

Needed club inputs remain: approved STM benefits, complete 200-level concessions/club/market map, coaching staff and any child-ticket exceptions. The workflow operates without these inputs and never invents them. A published general child policy already answers ordinary age questions.

## Routing and operating limits

- POC routing: OpenStreetMap/OSRM, $0 provider charge per 1,000 lookups; no live traffic. Public-place lookup obeys [Nominatim’s policy](https://operations.osmfoundation.org/policies/nominatim/) and routing obeys [FOSSGIS’s policy](https://routing.openstreetmap.de/about.html): at most one request/second per provider, caching, attribution and no private-address submissions. This is a modest POC service, not a production traffic SLA.
- Optional Google Routes adapter: traffic-aware driving uses Compute Routes Pro. Published first-tier pricing is $10/1,000 after 5,000 free monthly calls; Essentials is $5/1,000 after 10,000 free calls. [Official pricing](https://developers.google.com/maps/billing-and-pricing/pricing). No Google key is configured; Google traffic is not claimed as live.
- Hard routing cap: 200 external provider calls per Austin calendar day, shared across server instances/deployments. A new public origin can use a geocode call plus a route call. Cached route estimates last 15 minutes. Exhaustion returns Maps directions rather than an invented estimate.
- Request limits: 30 chats/client/minute, 10 shares/client/hour, 30 feedback writes/client/hour. Recognized safety answers bypass the chat throttle.
- AI: 500 paid calls/day and $10/day in conservative pre-call reservations: 2 cents per mini call, 5 cents per full fallback call, 20 cents per official-source search. Failed calls retain reservations. Input/output bounds and timeouts remain in place. This application budget does not cap hosting, storage or unrelated account bills. Fixed knowledge/safety answers do not call a model.
- Private diagnostics: authenticated `/api/diagnostics?day=YYYY-MM-DD` returns paginated scrubbed questions, route/template metadata and current budget. Vercel logs retain model usage and provider failures; full chat history is not put in runtime logs. The app team should set retention and individual staff access before wider deployment.

## Verification evidence

Evidence will be recorded here after the final deployed checks complete. The suites include 302 automated tests, a fixed 120-case evaluation, 19 multi-turn conversation turns, 125 existing red-team cases, 124 October report cases and desktop/390px browser acceptance.
