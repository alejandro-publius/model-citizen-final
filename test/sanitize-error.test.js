import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeIntersection } from "../server/pipeline.js";

const INTERNAL_ERROR = "DataSF request failed (502): upstream token=super-secret-detail";

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => "application/json" },
    json: async () => payload,
    text: async () => INTERNAL_ERROR,
  };
}

test("pipeline never includes upstream error detail in the client payload", async (t) => {
  const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), "model-citizen-sanitize-"));
  t.after(() => rm(cacheDirectory, { recursive: true, force: true }));
  const fetchImpl = async (url) => {
    const address = String(url);
    if (address.includes("nominatim.openstreetmap.org")) {
      return jsonResponse([{ display_name: "16th St & Mission St, San Francisco", lat: "37.764", lon: "-122.419", osm_type: "node", osm_id: 1 }]);
    }
    if (address.includes("data.sfgov.org")) return jsonResponse({}, false, 502);
    if (address.includes("overpass")) return jsonResponse({ elements: [] });
    if (address.includes("legistar")) return jsonResponse([]);
    throw new Error(`Unexpected request: ${address}`);
  };

  const payload = await analyzeIntersection("16th & Mission", {
    fetchImpl,
    cacheDirectory,
  });

  const clientPayload = JSON.stringify(payload);
  assert.doesNotMatch(clientPayload, /super-secret-detail/);
  assert.ok(payload.warnings.includes("Official San Francisco data is temporarily unavailable."));
});
