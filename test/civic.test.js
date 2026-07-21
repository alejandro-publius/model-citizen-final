import test from "node:test";
import assert from "node:assert/strict";
import { pointInGeometry, resolveCivicContext } from "../server/civic.js";

const polygon = {
  type: "Polygon",
  coordinates: [[[-123, 37], [-122, 37], [-122, 38], [-123, 38], [-123, 37]]],
};

test("district point-in-polygon accepts contained points and rejects outside points", () => {
  assert.equal(pointInGeometry([-122.5, 37.5], polygon), true);
  assert.equal(pointInGeometry([-121.5, 37.5], polygon), false);
});

test("civic resolver returns the current officeholder and verified contact", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      features: [{
        geometry: polygon,
        properties: { sup_dist_num: "9", sup_name: "Jackie Fielder", data_as_of: "2025-12-02T00:00:00" },
      }],
    }),
  });
  const result = await resolveCivicContext({ lat: 37.5, lng: -122.5 }, fetchImpl);
  assert.equal(result.district, 9);
  assert.equal(result.supervisor, "Jackie Fielder");
  assert.equal(result.email, "Jackie.Fielder@sfgov.org");
});

