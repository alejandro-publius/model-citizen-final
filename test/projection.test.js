import test from "node:test";
import assert from "node:assert/strict";
import { projectPoint } from "../web/src/three/city.js";

test("projection maps longitude east to +x and latitude north to -z", () => {
  const center = { lat: 37.765, lng: -122.42 };
  const projected = projectPoint({ lat: center.lat + 0.001, lon: center.lng + 0.001 }, center);
  assert.ok(projected.x > 87 && projected.x < 89);
  assert.ok(projected.z < -110 && projected.z > -111);
});

test("projection leaves the center at the origin", () => {
  const center = { lat: 37.765, lng: -122.42 };
  const projected = projectPoint({ lat: center.lat, lon: center.lng }, center);
  assert.equal(projected.x, 0);
  assert.equal(projected.z, 0);
});
