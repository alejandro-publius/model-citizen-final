import test from "node:test";
import assert from "node:assert/strict";
import { AGENTS, activityEvent, dispatchUAgent } from "../server/orchestrator.js";

test("orchestrator exposes four bounded specialist agents", () => {
  assert.deepEqual(AGENTS.map((agent) => agent.id), ["imagery", "records", "civic", "design"]);
  assert.equal(activityEvent("records", "complete", "done").agentName, "Records agent");
});

test("uAgents delegation remains explicit when bridge is not configured", async () => {
  const result = await dispatchUAgent("records", {}, { baseUrl: "" });
  assert.deepEqual(result, { delegated: false, runtime: "local-node", task: "records" });
});
