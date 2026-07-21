import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cacheKey, readCache, writeCache } from "../server/cache.js";

test("empty payload never poisons the cache", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "model-citizen-empty-"));
  assert.equal(await writeCache("Empty & Corner", {}, directory), false);
  assert.equal(await readCache("Empty & Corner", directory), null);
});

test("inferior concurrent payload cannot overwrite a complete result", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "model-citizen-race-"));
  const complete = { location: { lat: 1, lng: 2 }, findings: [{ id: 1 }], geometry: { elements: [{}, {}] } };
  const thin = { location: { lat: 1, lng: 2 }, geometry: { elements: [{}] } };
  await Promise.all([
    writeCache("Race Street", complete, directory),
    writeCache("Race Street", thin, directory),
  ]);
  assert.deepEqual(await readCache("Race Street", directory), complete);
  const raw = await readFile(path.join(directory, `${cacheKey("Race Street")}.json`), "utf8");
  assert.match(raw, /finding/);
});
