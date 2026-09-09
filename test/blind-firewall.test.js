import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeIntersection } from "../server/pipeline.js";

// These tests exercise the FULL analyzeIntersection() pipeline against a
// fully mocked network so we can prove, end to end, that record data never
// reaches the blind Stage-1 vision call -- not by reading vision.js and
// trusting it, but by planting distinctive sentinel values in every source
// (crashes, 311, legislative, district/civic, OSM, and the geocoded label
// itself) and asserting those sentinels are absent from what the model
// actually receives in the first (blind) call.

const SQUARE_AROUND_TEST_POINT = [
  [-122.43, 37.76],
  [-122.41, 37.76],
  [-122.41, 37.78],
  [-122.43, 37.78],
  [-122.43, 37.76],
];

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    async json() { return data; },
    async text() { return JSON.stringify(data); },
  };
}

function imageResponse() {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01, 0x02, 0x03]);
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (String(name).toLowerCase() === "content-type" ? "image/jpeg" : null) },
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
  };
}

function buildFetchImpl(sentinels) {
  const { crashSentinel, reportSentinel, legSentinel, supervisorSentinel, osmSentinel, geocodeSentinel } = sentinels;
  return async (input) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const host = url.hostname;
    const pathname = url.pathname;

    if (host === "nominatim.openstreetmap.org") {
      return jsonResponse([{
        display_name: `Sentinel St & Canary Ave, San Francisco, CA, USA (${geocodeSentinel})`,
        lat: "37.7700",
        lon: "-122.4200",
        osm_type: "way",
        osm_id: 42,
      }]);
    }
    if (host === "maps.googleapis.com" && pathname.includes("streetview")) {
      if (pathname.includes("metadata")) {
        return jsonResponse({ status: "OK", pano_id: "pano-1", date: "2026-01-01", copyright: "Google" });
      }
      return imageResponse();
    }
    if (host === "maps.googleapis.com" && pathname.includes("staticmap")) {
      return imageResponse();
    }
    if (host === "data.sfgov.org" && pathname.includes("ubvf-ztfx")) {
      return jsonResponse([{
        collision_datetime: "2026-01-01T00:00:00.000",
        primary_rd: "SENTINEL ST",
        secondary_rd: "CANARY AVE",
        collision_severity: `Fatal ${crashSentinel}`,
        type_of_collision: `Pedestrian ${crashSentinel}`,
        number_injured: "1",
        number_killed: "1",
        point: { type: "Point", coordinates: [-122.42, 37.77] },
      }]);
    }
    if (host === "data.sfgov.org" && pathname.includes("vw6y-z8j6")) {
      return jsonResponse([{
        requested_datetime: "2026-01-02T00:00:00.000",
        service_name: `Sidewalk Defect ${reportSentinel}`,
        service_subtype: "Sidewalk",
        service_details: `${reportSentinel} sidewalk crack near crosswalk`,
        address: "Sentinel St & Canary Ave",
        lat: "37.7700",
        long: "-122.4200",
      }]);
    }
    if (host === "data.sfgov.org" && pathname.includes("cqbw-m5m3")) {
      return jsonResponse({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {
            sup_name: supervisorSentinel,
            sup_dist_num: "9",
            sup_dist_name: `District ${supervisorSentinel}`,
            data_as_of: "2026-01-01",
          },
          geometry: { type: "Polygon", coordinates: [SQUARE_AROUND_TEST_POINT] },
        }],
      });
    }
    if (host === "webapi.legistar.com") {
      return jsonResponse([{
        MatterId: 999,
        MatterFile: "SENTINEL-001",
        MatterName: `${legSentinel} Street Safety Ordinance`,
        MatterTitle: "Sentinel St and Canary Ave street safety improvements",
        MatterTypeName: "Ordinance",
        MatterStatusName: "Introduced",
        MatterIntroDate: "2026-01-01",
      }]);
    }
    if (host === "overpass-api.de" || host === "overpass.kumi.systems") {
      return jsonResponse({
        elements: [{
          type: "way",
          id: 1,
          tags: { highway: "residential", name: `${osmSentinel} Sentinel Way` },
          geometry: [{ lat: 37.77, lon: -122.42 }],
        }],
        osm3s: { timestamp_osm_base: "2026-01-01T00:00:00Z" },
      });
    }
    throw new Error(`Unhandled fetch in test mock: ${url}`);
  };
}

function buildOpenAiClient(capturedCalls, { gate } = {}) {
  return {
    responses: {
      create: async (request) => {
        capturedCalls.push(request);
        if (Array.isArray(request.input)) {
          if (gate) await gate;
          return {
            output_text: JSON.stringify({ observations: [], overall_impression: "No hazards visible in this synthetic fixture." }),
            model: "gpt-5.6-sol",
          };
        }
        return {
          output_text: JSON.stringify({ letter: "Test letter.", post: "Test post." }),
          model: "gpt-5.6-sol",
        };
      },
    },
  };
}

async function withCacheDirectory(t) {
  const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), "model-citizen-firewall-"));
  t.after(() => rm(cacheDirectory, { recursive: true, force: true }));
  return cacheDirectory;
}

test("blind Stage-1 vision call receives no crash, 311, legislative, civic, OSM, or location-name data", async (t) => {
  const cacheDirectory = await withCacheDirectory(t);
  const sentinels = {
    crashSentinel: "SENTINEL-CRASH-31415",
    reportSentinel: "SENTINEL-311-27182",
    legSentinel: "SENTINEL-LEG-16180",
    supervisorSentinel: "Sentinel Testperson 55501",
    osmSentinel: "SENTINEL-OSM-24680",
    geocodeSentinel: "SENTINEL-GEOCODE-11235",
  };

  const calls = [];
  const client = buildOpenAiClient(calls);
  const result = await analyzeIntersection("Sentinel St & Canary Ave, San Francisco", {
    cacheDirectory,
    fetchImpl: buildFetchImpl(sentinels),
    openaiApiKey: "test-key",
    googleMapsKey: "test-key",
    openaiClient: client,
  });

  // Positive control: prove every sentinel actually flowed through the real
  // pipeline (crashes, 311, legislative, civic, OSM), so an absence from the
  // blind call below is a genuine firewall property, not a mocking mistake.
  assert.ok(JSON.stringify(result.crashes).includes(sentinels.crashSentinel), "crash sentinel must reach the final payload");
  assert.ok(JSON.stringify(result.reports311).includes(sentinels.reportSentinel), "311 sentinel must reach the final payload");
  assert.ok(JSON.stringify(result.legislative.records).includes(sentinels.legSentinel), "legislative sentinel must reach the final payload");
  assert.ok(result.civic?.supervisor?.includes(sentinels.supervisorSentinel), "supervisor sentinel must reach the final payload");
  assert.ok(JSON.stringify(result.geometry).includes(sentinels.osmSentinel), "OSM sentinel must reach the final payload");
  assert.ok(result.location.label.includes(sentinels.geocodeSentinel), "geocode label sentinel must reach the final payload");

  const visionCall = calls.find((call) => Array.isArray(call.input));
  assert.ok(visionCall, "the blind vision stage must have been called");
  const blindPayload = JSON.stringify(visionCall);

  for (const [name, sentinel] of Object.entries(sentinels)) {
    assert.doesNotMatch(
      blindPayload,
      new RegExp(sentinel.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")),
      `${name} (${sentinel}) must not reach the blind vision stage`,
    );
  }
  // The intersection name/address is itself a leak if it reaches the blind stage.
  assert.doesNotMatch(blindPayload, /sentinel st/i);
  assert.doesNotMatch(blindPayload, /canary ave/i);
  assert.doesNotMatch(blindPayload, /district/i);
  assert.doesNotMatch(blindPayload, /supervisor/i);

  // Contrast: Stage 4 (advocacy) is intentionally NOT firewalled -- it runs
  // after corroboration and legitimately needs this data to write a grounded
  // letter. Confirming it DOES see the sentinel rules out a mock that is
  // simply disconnected from the pipeline.
  const lastmileCall = calls.find((call) => typeof call.input === "string");
  assert.ok(lastmileCall, "the advocacy stage must have been called");
  assert.match(lastmileCall.input, new RegExp(sentinels.crashSentinel));
});

test("corroboration (CHECK stage) cannot run before the blind vision stage resolves", async (t) => {
  const cacheDirectory = await withCacheDirectory(t);
  const sentinels = {
    crashSentinel: "SENTINEL-CRASH-ORDER",
    reportSentinel: "SENTINEL-311-ORDER",
    legSentinel: "SENTINEL-LEG-ORDER",
    supervisorSentinel: "Sentinel Order Person",
    osmSentinel: "SENTINEL-OSM-ORDER",
    geocodeSentinel: "SENTINEL-GEOCODE-ORDER",
  };

  let releaseVision;
  const gate = new Promise((resolve) => { releaseVision = resolve; });
  const calls = [];
  const client = buildOpenAiClient(calls, { gate });
  const events = [];

  const analysis = analyzeIntersection("Sentinel St & Canary Ave, San Francisco", {
    cacheDirectory,
    fetchImpl: buildFetchImpl(sentinels),
    openaiApiKey: "test-key",
    googleMapsKey: "test-key",
    openaiClient: client,
    onProgress: (event) => events.push(`${event.stage}:${event.progress}:${event.status}`),
  });

  // Give every source (crashes, 311, OSM, civic, legislative, street view)
  // ample ticks to resolve -- they run in parallel with the blind pass and
  // SHOULD finish first. The blind vision call itself is still gated shut.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(
    !events.some((e) => e.startsWith("CHECK") || e.startsWith("FIX") || e.startsWith("ACT")),
    `corroboration/fix/advocacy stages must not run before the blind pass resolves, but saw: ${events.join(", ")}`,
  );
  assert.ok(events.some((e) => e === "LOOK:0:active"), "LOOK should already be active while vision is gated");
  assert.ok(!events.some((e) => e === "LOOK:1:complete"), "LOOK must not report complete before vision resolves");

  releaseVision();
  const result = await analysis;

  assert.ok(events.includes("LOOK:1:complete"));
  assert.ok(events.includes("CHECK:2:complete"));
  assert.ok(events.indexOf("LOOK:1:complete") < events.indexOf("CHECK:2:complete"), "CHECK must be observed strictly after LOOK completes");
  assert.equal(result.findings.length, 0);
});
