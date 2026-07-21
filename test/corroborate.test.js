import test from "node:test";
import assert from "node:assert/strict";
import { includesWholeWord } from "../server/datasf.js";
import { corroborate } from "../server/corroborate.js";

test("whole-word matching does not match king inside parking", () => {
  assert.equal(includesWholeWord("Parking Enforcement", "king"), false);
  assert.equal(includesWholeWord("Parking Enforcement", "parking"), true);
  assert.equal(includesWholeWord("signal-box", "signal"), true);
});

test("pedestrian evidence confirms a visual crossing observation", () => {
  const result = corroborate(
    [{ zone: "west crosswalk", hazard: "faded crosswalk markings", detail: "Paint is worn." }],
    [{ type_of_collision: "Vehicle/Pedestrian", collision_severity: "Injury" }],
    [{ service_name: "Sidewalk and Curb", service_details: "sidewalk defect" }],
  );
  assert.equal(result.findings[0].status, "CONFIRMED");
  assert.deepEqual(result.findings[0].evidence.crashIndices, [0]);
  assert.deepEqual(result.findings[0].evidence.reportIndices, [0]);
});

test("unmatched visual observations remain candidates and records remain reported", () => {
  const result = corroborate(
    [{ zone: "east approach", hazard: "missing bike infrastructure", detail: "No protected lane." }],
    [{ type_of_collision: "Rear End", collision_severity: "Injury" }],
    [],
  );
  assert.equal(result.findings[0].status, "CANDIDATE");
  assert.equal(result.reported[0].status, "REPORTED");
});

test("generic traffic reports do not confirm bicycle or speed findings", () => {
  const result = corroborate(
    [
      { zone: "north approach", hazard: "missing bike infrastructure", detail: "No protected lane." },
      { zone: "south approach", hazard: "high vehicle speed", detail: "Vehicles move quickly." },
      { zone: "east approach", hazard: "obstructed sightline", detail: "The view is blocked." },
    ],
    [],
    [
      { service_name: "Traffic", service_details: "General traffic concern" },
      { service_name: "Tree Maintenance", service_details: "Tree pruning request" },
      { service_name: "Parking Enforcement", service_details: "Parking violation" },
    ],
  );

  assert.deepEqual(result.findings.map((finding) => finding.status), ["CANDIDATE", "CANDIDATE", "CANDIDATE"]);
  assert.deepEqual(result.findings.map((finding) => finding.evidence.reportIndices), [[], [], []]);
  assert.equal(result.reported.length, 3);
});
