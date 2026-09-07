import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp, createRateLimiter } from "../server/index.js";

// These tests boot a real Node HTTP server around createApp() and exercise it
// with real fetch() requests, so they catch route-wiring bugs (a handler not
// receiving the rate-limit middleware, validation skipped on one route, the
// abort signal not actually reaching the analyze() call) that the unit tests
// for the individual helpers (createRateLimiter, validateIntersectionQuery,
// createSseConnection) cannot see.

async function withServer(app, run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("POST /api/analyze rejects a malformed intersection with 400 before calling analyze", async () => {
  let called = false;
  const app = createApp({
    demo: false,
    analyze: async () => { called = true; },
    rateLimiter: createRateLimiter({ capacity: 100, windowMs: 60_000 }),
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "16th & Mission <script>alert(1)</script>" }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /plausible intersection/);
  });
  assert.equal(called, false);
});

test("POST /api/analyze accepts a well-formed intersection and returns the analyzer's result", async () => {
  const app = createApp({
    demo: false,
    analyze: async (query) => ({ ok: true, echoedQuery: query }),
    rateLimiter: createRateLimiter({ capacity: 100, windowMs: 60_000 }),
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "16th St & Mission St" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.echoedQuery, "16th St & Mission St");
  });
});

test("POST /api/analyze returns 429 with Retry-After once the rate limit is exceeded", async () => {
  const app = createApp({
    demo: false,
    analyze: async () => ({ ok: true }),
    rateLimiter: createRateLimiter({ capacity: 2, windowMs: 60_000, now: () => 0 }),
  });
  await withServer(app, async (base) => {
    const post = () => fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "16th St & Mission St" }),
    });
    const first = await post();
    const second = await post();
    const third = await post();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.ok(third.headers.get("retry-after"));
    const body = await third.json();
    assert.match(body.error, /Too many analysis requests/);
  });
});

test("GET /api/analyze/stream rejects a malformed intersection with 400 and no SSE body", async () => {
  const app = createApp({
    demo: false,
    analyze: async () => { throw new Error("should not run"); },
    rateLimiter: createRateLimiter({ capacity: 100, windowMs: 60_000 }),
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/analyze/stream?query=${encodeURIComponent("a".repeat(200))}`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /120 characters/);
  });
});

test("GET /api/analyze/stream in demo mode streams stage, result, and done events from the fixture", async () => {
  const app = createApp({ demo: true });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/analyze/stream?query=${encodeURIComponent("16th St & Mission St")}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
    const text = await response.text();
    assert.match(text, /event: stage/);
    assert.match(text, /event: result/);
    assert.match(text, /event: done/);
  });
});

test("GET /api/analyze/stream forwards a client abort to the analyzer's signal", async () => {
  let receivedSignal;
  let rejectAnalysis;
  const analysisStarted = new Promise((resolve) => {
    rejectAnalysis = resolve;
  });
  const app = createApp({
    demo: false,
    analyze: (_query, options) => {
      receivedSignal = options.signal;
      rejectAnalysis();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    },
    rateLimiter: createRateLimiter({ capacity: 100, windowMs: 60_000 }),
  });
  await withServer(app, async (base) => {
    const controller = new AbortController();
    const fetchPromise = fetch(`${base}/api/analyze/stream?query=${encodeURIComponent("16th St & Mission St")}`, {
      signal: controller.signal,
    }).catch(() => {}); // the client-side abort also rejects this fetch; that's expected

    await analysisStarted;
    assert.equal(receivedSignal.aborted, false);
    controller.abort();

    await new Promise((resolve) => {
      if (receivedSignal.aborted) return resolve();
      receivedSignal.addEventListener("abort", resolve, { once: true });
    });
    assert.equal(receivedSignal.aborted, true);
    await fetchPromise;
  });
});
