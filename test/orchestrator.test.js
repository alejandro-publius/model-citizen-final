import test from "node:test";
import assert from "node:assert/strict";
import { AGENTS, activityEvent } from "../server/orchestrator.js";

test("orchestrator exposes four bounded specialist agents", () => {
  assert.deepEqual(AGENTS.map((agent) => agent.id), ["imagery", "records", "civic", "design"]);
  assert.equal(activityEvent("records", "complete", "done").agentName, "Records agent");
});
