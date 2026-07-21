## Inspiration

Every San Franciscan knows a corner that feels dangerous, but proving the problem and
asking for a realistic fix requires navigating crash records, 311 reports, legislative
history, district boundaries, grant programs, and engineering language. Model Citizen
closes the gap between “this intersection feels unsafe” and “here is the evidence, the
fundable intervention, and the right public official to contact.”

## What it does

Model Citizen turns a San Francisco intersection into a complete civic-action brief.
The landing map ranks injury-crash intersections and opens a four-stage pipeline:

1. **LOOK:** GPT-5.6 performs a blind visual survey using four street-level views and a
   north-up satellite image. It receives no location name, crash history, complaint data,
   or map tags.
2. **CHECK:** independent DataSF crash and 311 records, official legislative files,
   council minutes, and local-news reporting corroborate the visual findings.
3. **FIX:** deterministic rules map each hazard to a planning cost and a named grant
   program.
4. **ACT:** GPT-5.6 prepares an addressed resident letter, an X post, and a Reddit post
   for the current district Supervisor.

The same corner becomes an explorable Three.js digital twin built from real
OpenStreetMap geometry. A TODAY / PROPOSED toggle adds the crosswalk, bulb-outs, and
protected bike space, while a photorealistic before/after pair shows the intervention at
street level. The interface also exposes the named official, official meeting minutes,
news corroboration, source provenance, and actual server-reported multi-agent activity.

## How we built it

The React and Three.js frontend is backed by a Node/Express pipeline that streams real
stage and agent events over Server-Sent Events. The product integrates DataSF Socrata,
the official Legistar API, OpenStreetMap/Overpass, Nominatim, Google Street View Static,
Google Maps Static satellite imagery, OpenAI Responses and Images APIs, optional
Browserbase retrieval, Redis caching, and a Fetch.ai/uAgents bridge.

The trust boundary is the core design decision. GPT-5.6 first sees only imagery and must
commit to visible observations in fixed street zones. Only afterward does deterministic
code compare those observations with public records and label them CONFIRMED, CANDIDATE,
or REPORTED. Costs, grant matches, district routing, and evidence matching remain
deterministic; AI is used for perception and grounded communication.

The public Cloudflare build is intentionally keyless and reproducible. It serves a
complete 16th and Mission judge fixture containing real public records and clearly labels
synthetic or omitted licensed imagery. The full keyed pipeline remains available locally.

## How Codex and GPT-5.6 were used

Codex was our engineering partner throughout the build. It helped turn the initial civic
workflow into a working architecture; debug a changed DataSF 311 spatial query; build the
OSM-to-Three.js projection, footprint extrusion, street furniture, and orbit controls;
repair an empty-response cache race with an atomic best-payload-wins design; implement
the evidence map and multi-agent activity feed; and exercise the actual browser scene in
TODAY and PROPOSED states. The final repository has 31 passing tests plus lint and
production-build verification.

GPT-5.6 is part of the product itself. One low-effort Responses API call performs the
blind multimodal street survey. A separate call receives only the already-corroborated
evidence and prepares the resident letter and social copy. Both stages retry malformed
JSON once and fail visibly or fall back safely rather than inventing a successful result.

## Challenges we ran into

The hardest problem was preventing confirmation bias. Showing crash history to the model
before asking what it saw would make a persuasive demo but weak evidence, so we enforced
the imagery-only firewall in code and tests. Public APIs were also brittle: an older
DataSF `within_circle` recipe stopped working for the current 311 dataset, and Overpass
needed a fallback endpoint. Naive substring matching produced errors such as `king`
matching `parking`, so corroboration now uses tested whole-word, hazard-specific rules.

We also found that an incomplete concurrent response could overwrite a stronger cached
brief. The cache now scores completeness, serializes writes by intersection, and writes
atomically. Finally, licensed imagery and public-demo costs required an honest judge mode
rather than quietly shipping pixels or secrets that should not be public.

## Accomplishments that we're proud of

The result is a coherent resident journey rather than a collection of APIs: discover a
dangerous corner, inspect independently corroborated evidence, explore a data-derived 3D
redesign, see a photorealistic proposal, identify the responsible official, and leave
with ready-to-send civic action. The public demo is reproducible without keys, the source
is MIT licensed, and the product distinguishes visual claims, official records, news,
minutes, and synthetic imagery instead of blending them into one opaque AI answer.

## What we learned

Independence beats persuasion. Withholding information from the model until after the
visual pass made the result more credible. We also learned that deterministic software
should own the claims that need to be auditable—matching, costs, grants, and routing—while
the model handles perception and language. Most importantly, disclosure improved the
product: showing what is cached, synthetic, unavailable, or merely corroborative made the
experience feel more trustworthy, not less impressive.

## What's next

Next we would generalize the open-data adapters beyond San Francisco, add authenticated
neighborhood campaigns with hard usage quotas, support multilingual letters, and track a
fix from resident request through legislative action and construction. Field-grade cost
estimates, speed and volume data, school and transit overlays, and a mobile capture flow
would move Model Citizen from an advocacy prototype toward durable civic infrastructure.
