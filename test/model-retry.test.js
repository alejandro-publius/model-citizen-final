import test from "node:test";
import assert from "node:assert/strict";
import { runBlindVision } from "../server/vision.js";

test("blind vision retries once when the first model reply is malformed", async () => {
  const calls = [];
  const client = {
    responses: {
      create: async (request) => {
        calls.push(request);
        return calls.length === 1
          ? { output_text: "not json", model: "gpt-5.6-sol" }
          : {
              output_text: JSON.stringify({
                observations: [{ zone: "north crosswalk", hazard: "faded markings", detail: "Paint is worn.", severity: "medium", confidence: 0.8 }],
                overall_impression: "Crossing needs attention.",
              }),
              model: "gpt-5.6-sol",
            };
      },
    },
  };

  const result = await runBlindVision(
    [{ heading: 0, available: true, image: "data:image/jpeg;base64,AA==" }],
    { apiKey: "test-key", client },
  );

  assert.equal(calls.length, 2);
  assert.equal(result.observations.length, 1);
  assert.equal(result.model, "gpt-5.6-sol");
  assert.match(calls[1].input[0].content.at(-1).text, /not valid JSON/);
});
