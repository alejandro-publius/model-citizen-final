import test from "node:test";
import assert from "node:assert/strict";
import { fetchSatellite, satelliteEndpoint, streetViewEndpoint } from "../server/streetview.js";
import { visionPrompt } from "../server/vision.js";

test("satellite request is north-up at intersection-scale zoom", () => {
  const url = satelliteEndpoint({ lat: 37.765, lng: -122.419 }, "test-key");
  assert.equal(url.hostname, "maps.googleapis.com");
  assert.equal(url.pathname, "/maps/api/staticmap");
  assert.equal(url.searchParams.get("maptype"), "satellite");
  assert.equal(url.searchParams.get("zoom"), "20");
  assert.equal(url.searchParams.get("key"), "test-key");
});

test("Street View image and metadata requests use Google's canonical paths", () => {
  const image = streetViewEndpoint("", "37.765,-122.419", 90, "test-key");
  const metadata = streetViewEndpoint("metadata", "37.765,-122.419", 90, "test-key");

  assert.equal(image.pathname, "/maps/api/streetview");
  assert.equal(metadata.pathname, "/maps/api/streetview/metadata");
  assert.equal(image.searchParams.get("heading"), "90");
  assert.equal(image.searchParams.get("key"), "test-key");
});

test("satellite imagery retries one transient authorization response", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response("not ready", { status: 403, headers: { "content-type": "text/plain" } });
    return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  };

  const result = await fetchSatellite({ lat: 37.765, lng: -122.419 }, "test-key", fetchImpl);
  assert.equal(calls, 2);
  assert.equal(result.available, true);
  assert.match(result.image, /^data:image\/jpeg;base64,/);
});

test("blind prompt describes satellite geometry without leaking record data", () => {
  const prompt = visionPrompt(4, true);
  assert.match(prompt, /north-up satellite/i);
  assert.match(prompt, /no crash history/i);
  assert.doesNotMatch(prompt, /fatal collision/i);
});
