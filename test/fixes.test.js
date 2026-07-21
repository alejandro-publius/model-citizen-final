import test from "node:test";
import assert from "node:assert/strict";
import { mapFixes } from "../server/fixes.js";

test("hazards map deterministically to priced grant programs", () => {
  const fixes = mapFixes([
    { id: "a", zone: "south crosswalk", status: "CONFIRMED", hazard: "faded crosswalk markings" },
    { id: "b", zone: "east approach", status: "CANDIDATE", hazard: "missing protected bike infrastructure" },
    { id: "c", zone: "west crosswalk", status: "CONFIRMED", hazard: "long crossing distance" },
  ]);
  assert.deepEqual(fixes.map((fix) => fix.type), ["crosswalk", "bike-lane", "bulbout"]);
  assert.equal(fixes[0].cost, "$4k");
  assert.equal(fixes[2].grant, "SS4A Implementation");
});
