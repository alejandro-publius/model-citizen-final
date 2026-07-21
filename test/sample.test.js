import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("judge-mode sample contains a complete reproducible story", async () => {
  const sample = JSON.parse(await readFile(new URL("../sample/16th-and-mission.json", import.meta.url), "utf8"));
  assert.ok(sample.geometry.elements.length >= 15);
  assert.ok(sample.crashes.some((record) => record.collision_severity === "Fatal"));
  assert.ok(sample.findings.some((finding) => finding.status === "CONFIRMED"));
  assert.ok(sample.fixes.length >= 3);
  assert.equal(sample.civic.supervisor, "Jackie Fielder");
  assert.ok(sample.leaderboard.intersections.length >= 10);
  assert.ok(sample.legislative.records.some((record) => record.file === "180066"));
  assert.equal(sample.meta.schemaVersion, 3);
  assert.equal(sample.meta.telemetry.length, 4);
  assert.equal(sample.meta.activity.length, 4);
  assert.equal(sample.location.county, "San Francisco County");
  assert.ok(sample.news.articles.some((article) => article.publisher === "Mission Local"));
  assert.ok(sample.meetingMinutes.records.some((record) => record.file === "180066"));
  assert.equal(sample.renders.synthetic, true);
  assert.match(sample.advocacy.redditTitle, /16th/i);
  assert.match(sample.advocacy.letter, /SS4A/);
  assert.match(sample.advocacy.letter, /Supervisor Fielder/);
  assert.equal(sample.meta.model, "gpt-5.6");
});
