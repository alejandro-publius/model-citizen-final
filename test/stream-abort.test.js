import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createSseConnection } from "../server/index.js";
import { analyzeIntersection } from "../server/pipeline.js";

function createFakeSseResponse() {
  return {
    writableEnded: false,
    destroyed: false,
    writes: [],
    write(chunk) {
      this.writes.push(chunk);
    },
  };
}

test("SSE keepalive pings every 15 seconds and is cleared on normal completion", () => {
  const request = new EventEmitter();
  const response = createFakeSseResponse();
  let callback;
  let delay;
  let cleared;
  const timer = {};
  const connection = createSseConnection(request, response, {
    setIntervalFn: (fn, milliseconds) => {
      callback = fn;
      delay = milliseconds;
      return timer;
    },
    clearIntervalFn: (handle) => { cleared = handle; },
  });

  assert.equal(delay, 15_000);
  callback();
  assert.deepEqual(response.writes, [": keepalive\n\n"]);

  connection.cleanup();
  assert.equal(cleared, timer);
});

test("SSE close aborts analysis and prevents further writes", () => {
  const request = new EventEmitter();
  const response = createFakeSseResponse();
  let callback;
  let clearCount = 0;
  const connection = createSseConnection(request, response, {
    setIntervalFn: (fn) => {
      callback = fn;
      return {};
    },
    clearIntervalFn: () => { clearCount += 1; },
  });

  request.emit("close");
  assert.equal(connection.signal.aborted, true);
  assert.equal(clearCount, 1);
  callback();
  assert.deepEqual(response.writes, []);
  assert.equal(connection.write("event: result\n\n"), false);
});

test("pipeline forwards a disconnect signal to fetch and stops before cache writes", async (t) => {
  const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), "model-citizen-abort-"));
  t.after(() => rm(cacheDirectory, { recursive: true, force: true }));
  const controller = new AbortController();
  const disconnect = new Error("Client disconnected");
  let receivedSignal;
  let startFetch;
  const fetchStarted = new Promise((resolve) => { startFetch = resolve; });
  const fetchImpl = (_url, init) => {
    receivedSignal = init.signal;
    startFetch();
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  };

  const analysis = analyzeIntersection("Abort Test & Market", {
    cacheDirectory,
    fetchImpl,
    signal: controller.signal,
  });
  await fetchStarted;
  controller.abort(disconnect);

  await assert.rejects(analysis, (error) => error.cause === disconnect);
  assert.equal(receivedSignal, controller.signal);
  assert.deepEqual(await readdir(cacheDirectory), []);
});
