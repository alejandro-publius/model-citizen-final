# Model Citizen

Type any San Francisco intersection. GPT-5.6 surveys street-level and north-up satellite
imagery behind a blind-data firewall; crash, 311, district, and legislative records then
corroborate the result. The real street is rebuilt as an explorable 3D miniature, one
toggle applies priced grant-matched fixes, and an addressed resident letter opens in the
correct Supervisor's email channel.

The landing experience is now a clickable crash-dot map for San Francisco County. Each
brief separates independent news reporting and official meeting-minute corroboration,
streams actual agent task events, and produces email, X/Twitter, and Reddit actions. Live
keyed mode can also create a photorealistic OpenAI image edit of the street; judge mode
ships a clearly labeled synthetic pair with no licensed Google pixels.

Built for **OpenAI Build Week 2026**, track **Apps for Your Life**.

**[Try the public judge demo](https://model-citizen-final.thealexschroeder.workers.dev)** ·
**[Watch the 2:07 public video](https://youtu.be/cmlYN-MHelA)**

Fast judge path: keep **16th St & Mission St** selected, choose **Analyze this corner**,
toggle the 3D scene to **Proposed**, then open **Take action** for the addressed letter and
social posts. The public deployment is cost-safe judge mode; arbitrary-corner live
analysis remains available through the keyed local setup below.

## Why it is different

The product does not show an AI a scary crash history and ask it to find a matching
problem. Stage 1 is firewalled: GPT-5.6 receives only four street-level images plus an
optional north-up satellite view and must
report only visible conditions in fixed street zones. Crash and 311 records are fetched
separately and introduced afterward. The satellite view improves crossing-geometry
coverage without revealing the location name or record history.

```text
intersection search
    ├── Nominatim geocode
    ├── parallel: Street View + satellite · crashes · 311 · OSM · district · Legistar
    ├── LOOK   GPT-5.6 blind vision pass (images only)
    ├── CHECK  whole-word code matcher → CONFIRMED / CANDIDATE / REPORTED
    ├── FIX    deterministic cost + grant rules
    ├── ACT    GPT-5.6 addressed resident letter + social post
    └── Three.js real-street diorama → TODAY / PROPOSED
```

The server streams real stage completions over Server-Sent Events: counts appear only
after the corresponding source or stage completes. The UI also exposes warnings rather
than hiding partial-source failures.

## Civic action and discovery

- A point-in-polygon lookup against DataSF's current Supervisor Districts dataset resolves
  the district and current officeholder. Contact details are linked to the official Board
  roster, the letter names the Supervisor, and **Open addressed email** creates a populated
  `mailto:` draft.
- A district leaderboard groups reversed street pairs under one canonical intersection
  and ranks returned injury-crash records with a published score: `12× fatal + 5× severe +
  2× pedestrian + crash count`. In judge mode, non-demo corners are visibly disabled;
  live mode opens any ranked corner with one click.
- The legislative paper trail uses the official Legistar API and shows file number,
  recorded status, action, and date. The product never interprets an empty match as proof
  that no City action occurred.
- **Export postcard** captures the WebGL scene in TODAY and PROPOSED states and downloads
  a 1600×1000 share card with evidence counts, official, interventions, and planning cost.

The 3D scene is data-derived rather than decorative: OSM polylines become rounded road
segments, real footprints become extruded pastel buildings, and mapped crossing/signal
nodes become street furniture. Findings use stable named zones, so a finding can anchor
to the model even when image dimensions change.

## Judge mode — no keys required

```bash
npm install
DEMO_MODE=1 npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app opens directly on a complete
16th Street & Mission Street run with real DataSF, district, legislative, and OSM records
refreshed on July 21, 2026. The fixture deliberately omits licensed Street View and
satellite pixels; its visual
findings and advocacy copy are clearly disclosed as a representative cached judge-mode
response. The API still exercises the full product shape, and the TODAY / PROPOSED toggle
adds visible crosswalk, bulb-out, and protected-bike-lane geometry.

## Live setup

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env
# Set DEMO_MODE=0, then add OPENAI_API_KEY and GOOGLE_MAPS_KEY
npm install
npm run dev
```

The web app runs at `http://localhost:5173`; Vite proxies `/api` to Express on port 8787.
For a production-style run:

```bash
npm run build
DEMO_MODE=1 npm start
# open http://localhost:8787
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEMO_MODE` | No | `1` serves the complete sample for every analysis request |
| `OPENAI_API_KEY` | Live AI only | Blind vision pass and advocacy writing |
| `OPENAI_MODEL` | No | Defaults to `gpt-5.6` |
| `OPENAI_IMAGE_MODEL` | No | Image-edit model, default `gpt-image-1` |
| `GOOGLE_MAPS_KEY` | Live vision only | Four Street View headings + one Maps Static satellite image |
| `DATASF_APP_TOKEN` | No | Optional Socrata token for higher public-data limits |
| `BROWSERBASE_API_KEY` | No | Non-API local-news retrieval in a Browserbase session |
| `BROWSERBASE_PROJECT_ID` | No | Optional Browserbase project override |
| `BROWSERBASE_TIMEOUT_MS` | No | Failure-isolation budget for live news retrieval, default `25000` ms |
| `PORT` | No | Express port, default `8787` |

Never expose keys to the browser. Both OpenAI and Google calls are server-side, `.env` is
ignored, and only `.env.example` is committed.

## Cloudflare deployment — cost-safe public demo

The checked-in Cloudflare Worker is deliberately locked to judge mode. It serves the
static site and bundled evidence fixture, but it cannot call OpenAI, Google Maps,
or Browserbase. This keeps public traffic from creating third-party API
charges. Static assets are served by Cloudflare Assets; only `/api/*` reaches the Worker.

```bash
npm install
npm run deploy:cloudflare
```

The Workers Free plan enforces its own CPU, request, and subrequest ceilings. This public
Worker makes no external subrequests. Do not add live API secrets until authentication, a
global usage quota, and vendor billing limits are configured. Live mode remains available
locally through the setup above.

## GPT-5.6 integration

The exact current identifier was checked against the official OpenAI model guidance before
implementation. The docs state that `gpt-5.6` is the family alias routing to the flagship
`gpt-5.6-sol`; the app intentionally uses the alias and keeps it configurable through
`OPENAI_MODEL`. Both AI stages use the Responses API with low reasoning effort:

- **Stage 1:** four street-level inputs and optional north-up satellite context plus the
  blind site-survey prompt. No location name,
  crash record, complaint, or OSM tag is included.
- **Stage 4:** only the already-corroborated findings, record summary, fixes, costs, and
  grants are supplied for the letter and social post.

Both model stages retry malformed JSON once with a narrow correction instruction, then
fall back without crashing. Record-only evidence remains visible as `REPORTED` even when
Street View or the blind pass is unavailable.

If either key is missing or an AI request fails, geometry and public records remain
available, visual claims are omitted, and a deterministic grounded letter fallback is
used. The UI never invents a successful AI result in live mode.

Official reference: [Using GPT-5.6](https://developers.openai.com/api/docs/guides/model-guidance?model=gpt-5.6).

## Public data integrations

- **Traffic crashes:** DataSF Socrata dataset `ubvf-ztfx`, 100-meter
  `within_circle(point, …)` query, newest 50 records.
- **District leaderboard:** the same crash dataset, current Supervisor District field,
  intersection-only records since 2021, and canonicalized street-pair grouping.
- **Civic routing:** DataSF `cqbw-m5m3` current district polygons with a local
  point-in-polygon lookup; contact data is paired with the official Board roster.
- **Legislative records:** Legistar's official `sfgov` API. Results are exact two-street
  matches and preserve official statuses without interpreting gaps.
- **311:** DataSF dataset `vw6y-z8j6`, recent records in an approximately 100-meter
  latitude/longitude box, then a whole-word street-safety filter. The current dataset's
  numeric `lat`/`long` fields work reliably; the older `within_circle(point, …)` recipe
  currently returns a Socrata argument error.
- **Street geometry:** OpenStreetMap via Overpass, 95-meter road/building/furniture query,
  with `overpass.kumi.systems` as a fallback.
- **Geocoding:** Nominatim with a named User-Agent and San Francisco scoping.
- **Imagery:** Google Street View Static API metadata check followed by four 640×640 views,
  plus a north-up 640×640 Maps Static satellite image at zoom 20.

Public services can rate-limit or time out. Each source has a graceful empty/error state;
OSM retries a second endpoint. For a reliable review, use judge mode first.

## Corroboration and fix rules

Matching is deterministic and tested. Terms must match at whole-word boundaries, preventing
errors such as `king` matching `parking`. Pedestrian observations can match
`Vehicle/Pedestrian` crash types and curb/crosswalk/sidewalk reports; visibility findings
can match broadside/head-on crashes and sign/signal/visibility reports. At least one
relevant official record makes a visual finding `CONFIRMED`; otherwise it stays
`CANDIDATE`. Unmatched official records are preserved as `REPORTED`.

| Hazard | 3D treatment | Cost | Funding match |
| --- | --- | --- | --- |
| Faded/unmarked crosswalk | Continental crosswalk | $4k | SS4A Demonstration |
| Uncontrolled wide crossing | RRFB | $30k | HSIP |
| Missing/obstructed signal | Signal or interim all-way stop | $350k | SS4A Implementation |
| Speeding approach | Speed cushions | $15k | CA Active Transportation Program |
| Long crossing distance | Corner bulb-outs | $90k | SS4A Implementation |
| Missing bike protection | Protected bike lane segment | $120k/block | CA ATP |

Costs are planning-level values for advocacy, not construction bids. A field engineering
review remains necessary before implementation.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

Tests cover:

- projection displacement and coordinate orientation;
- whole-word corroboration and reported-only records;
- deterministic fix/cost/grant mapping;
- cache rejection of empty payloads;
- concurrent inferior payload protection;
- completeness of the keyless judge fixture.
- district point-in-polygon resolution and current-office contact routing;
- canonical street-pair grouping and severity-weighted leaderboard ranking;
- exact legislative matching and non-inaction disclosure;
- satellite request/prompt isolation and postcard planning-cost totals.

The cache scores payload completeness, serializes writes per intersection, writes
atomically, and will not replace a stronger existing payload with an empty or thinner one.

## Project structure

```text
server/                  Express API and analysis pipeline
  pipeline.js            orchestrates the four stages
  vision.js              blind GPT-5.6 image pass
  datasf.js              crash/311 clients + district leaderboard
  civic.js               district polygon + current office resolver
  legislative.js         official Legistar paper trail
  corroborate.js         independent evidence matching
  fixes.js               intervention, cost, and grant rules
  osm.js                  Overpass client with fallback
  cache.js                non-empty, best-payload-wins JSON cache
  lastmile.js             GPT-5.6 letter plus grounded fallback
web/src/
  App.jsx                 search, evidence brief, findings, advocacy UI
  postcard.js            side-by-side 3D share-card exporter
  three/city.js           OSM-to-Three.js road/building renderer
  three/props.js          signals, zebra, RRFB, cushions, bulb-outs, bike lane
  three/orbit.js          hand-rolled pointer, wheel, and pinch camera
sample/
  16th-and-mission.json   complete no-key judge fixture
test/                     Node test suite
```

## Built with Codex

Concrete acceleration moments from the build session:

- verified the live GPT-5.6 alias in official OpenAI guidance before wiring the Responses
  API, avoiding a speculative model slug;
- found and corrected the current DataSF 311 spatial-query mismatch while preserving the
  intended 100-meter behavior;
- generated the OSM projection, footprint extrusion, real crossing furniture, hand-rolled
  orbit controls, and remodel prop layer as one cohesive Three.js system;
- turned the known empty-response cache race into a scored, atomic best-payload-wins cache
  with regression tests;
- exercised the actual browser scene in both TODAY and PROPOSED states, not only the unit
  layer.

The remodel reveal is deliberately staged: improvements pop into the miniature 350 ms
apart with their intervention, cost, and grant labels, while fatal-crash locations shift
from a restrained red base rim to green in the proposed state.

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Mode, model, and server-side key readiness |
| `GET` | `/api/demo` | Complete 16th & Mission sample |
| `GET` | `/api/analyze/stream?query=…` | Real stage telemetry plus final result over SSE |
| `POST` | `/api/analyze` | `{ "query": "16th St & Mission St" }` full pipeline |

## Credits and license

All code here is original and built during OpenAI Build Week. The OSM-derived 3D remodel
layer is original to Model Citizen.

OpenStreetMap data is © OpenStreetMap contributors, ODbL. DataSF records are provided by
the City and County of San Francisco. Street View content remains subject to Google's
terms and is not embedded in the public fixture.

Released under the [MIT License](LICENSE).
