import test from "node:test";
import assert from "node:assert/strict";
import { minutesFromLegislative, termsMatch } from "../server/corroboration-sources.js";

test("news corroboration requires both street terms", () => {
  assert.equal(termsMatch("Pedestrian safety at 16th and Mission streets", ["16TH ST", "MISSION ST"]), true);
  assert.equal(termsMatch("Pedestrian safety on Mission Street", ["16TH ST", "MISSION ST"]), false);
});

test("official minutes are linked to the exact legislative file", () => {
  const records = minutesFromLegislative([{ file: "180066" }, { file: "other" }]);
  assert.equal(records.length, 1);
  assert.match(records[0].url, /psn021418_minutes\.pdf$/);
});
