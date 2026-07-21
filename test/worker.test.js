import assert from "node:assert/strict";
import test from "node:test";
import worker, { samplePayload } from "../worker/index.js";

const env = {
  ASSETS: {
    fetch: async () => new Response("asset"),
  },
};

test("Cloudflare sample is explicitly cost-safe judge mode", () => {
  const payload = samplePayload();
  assert.equal(payload.meta.demo, true);
  assert.equal(payload.meta.hosting, "cloudflare-workers-free");
  assert.equal(payload.meta.spendingProtection, "external APIs disabled");
});

test("Cloudflare health endpoint discloses disabled external services", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/health"), env);
  const health = await response.json();
  assert.equal(response.status, 200);
  assert.equal(health.demoMode, true);
  assert.equal(health.openaiConfigured, false);
  assert.equal(health.streetViewConfigured, false);
});

test("Cloudflare analysis stream returns the fixture as SSE", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/analyze/stream?query=16th%20and%20Mission"), env);
  const body = await response.text();
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.match(body, /event: result/);
  assert.match(body, /event: done/);
});
