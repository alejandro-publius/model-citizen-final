import test from "node:test";
import assert from "node:assert/strict";
import { fetchLegislativeTrail, scoreMatter, streetTerms, termsAreNear } from "../server/legislative.js";

test("legislative matching requires both canonical street terms", () => {
  const terms = streetTerms({ shortLabel: "16th Street & Mission Street" });
  assert.deepEqual(terms, ["16TH ST", "MISSION ST"]);
  assert.equal(scoreMatter({ MatterTitle: "Hearing at 16th Street and Mission Street" }, terms), 2);
  assert.equal(scoreMatter({ MatterTitle: "Mission Street citywide plan" }, terms), 1);
  assert.equal(termsAreNear({ MatterTitle: "Work at 16th Street and Mission Street" }, terms), true);
  assert.equal(termsAreNear({ MatterTitle: `16th Street ${"unrelated ".repeat(40)} Mission Street` }, terms), false);
});

test("paper trail keeps official status and action without inventing inaction", async () => {
  const matter = {
    MatterId: 32935,
    MatterGuid: "guid",
    MatterFile: "180066",
    MatterName: "Hearing at 16th and Mission",
    MatterTitle: "Hearing at 16th Street and Mission Street",
    MatterTypeName: "Hearing",
    MatterStatusName: "Filed",
    MatterPassedDate: "2018-02-14T00:00:00",
  };
  const fetchImpl = async () => ({ ok: true, json: async () => [matter] });
  const result = await fetchLegislativeTrail({ shortLabel: "16th St & Mission St" }, fetchImpl);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].status, "Filed");
  assert.equal(result.records[0].action, "Board action recorded");
  assert.match(result.disclosure, /not evidence/i);
});
