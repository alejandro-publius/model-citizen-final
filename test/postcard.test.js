import test from "node:test";
import assert from "node:assert/strict";
import { compactMoney, planningCost, slugify } from "../web/src/postcard.js";

test("postcard totals planning costs and creates a portable filename", () => {
  const total = planningCost([{ cost: "$4k" }, { cost: "$90k" }, { cost: "$120k/block" }]);
  assert.equal(total, 214000);
  assert.equal(compactMoney(total), "$214k");
  assert.equal(slugify("16th St & Mission St"), "16th-st-mission-st");
});

