import test from "node:test";
import assert from "node:assert/strict";
import { createPhotorealisticRenders, renderPrompt } from "../server/renders.js";

test("photorealistic render prompt preserves the real scene", () => {
  const prompt = renderPrompt([{ title: "Corner bulb-outs" }]);
  assert.match(prompt, /Corner bulb-outs/);
  assert.match(prompt, /Preserve the exact camera/);
});

test("rendering never invents pixels when no licensed frame is available", async () => {
  const result = await createPhotorealisticRenders([], []);
  assert.equal(result.available, false);
  assert.match(result.reason, /street-level frame/i);
});
