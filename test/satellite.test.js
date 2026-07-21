import test from "node:test";
import assert from "node:assert/strict";
import { satelliteEndpoint } from "../server/streetview.js";
import { visionPrompt } from "../server/vision.js";

test("satellite request is north-up at intersection-scale zoom", () => {
  const url = satelliteEndpoint({ lat: 37.765, lng: -122.419 }, "test-key");
  assert.equal(url.hostname, "maps.googleapis.com");
  assert.equal(url.pathname, "/maps/api/staticmap");
  assert.equal(url.searchParams.get("maptype"), "satellite");
  assert.equal(url.searchParams.get("zoom"), "20");
  assert.equal(url.searchParams.get("key"), "test-key");
});

test("blind prompt describes satellite geometry without leaking record data", () => {
  const prompt = visionPrompt(4, true);
  assert.match(prompt, /north-up satellite/i);
  assert.match(prompt, /no crash history/i);
  assert.doesNotMatch(prompt, /fatal collision/i);
});

