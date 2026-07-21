import test from "node:test";
import assert from "node:assert/strict";
import { canonicalIntersection, rankIntersections } from "../server/datasf.js";

test("street pairs canonicalize regardless of source order", () => {
  assert.equal(canonicalIntersection("Mission Street", "16th St"), "16TH ST & MISSION ST");
  assert.equal(canonicalIntersection("16TH ST", "MISSION ST"), "16TH ST & MISSION ST");
});

test("leaderboard combines reversed pairs and weights fatal records", () => {
  const records = [
    { primary_rd: "MISSION ST", secondary_rd: "16TH ST", collision_severity: "Injury (Other Visible)", type_of_collision: "Vehicle/Pedestrian", number_injured: "1" },
    { primary_rd: "16TH ST", secondary_rd: "MISSION ST", collision_severity: "Fatal", type_of_collision: "Vehicle/Pedestrian", number_killed: "1" },
    { primary_rd: "18TH ST", secondary_rd: "MISSION ST", collision_severity: "Injury (Other Visible)", type_of_collision: "Broadside" },
  ];
  const result = rankIntersections(records);
  assert.equal(result[0].key, "16TH ST & MISSION ST");
  assert.equal(result[0].crashCount, 2);
  assert.equal(result[0].fatalCount, 1);
  assert.equal(result[0].pedestrianCount, 2);
});

