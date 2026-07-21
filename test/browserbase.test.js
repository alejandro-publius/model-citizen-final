import test from "node:test";
import assert from "node:assert/strict";
import { scrapeSearchPage } from "../server/browserbase.js";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

test("Browserbase creates, scrapes, and explicitly releases a session", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, body: options.body });
    if (String(url).endsWith("/v1/sessions")) {
      return response({ id: "session-123", projectId: "project-123", connectUrl: "wss://example.test" }, 201);
    }
    return response({ id: "session-123", status: "COMPLETED" });
  };
  const page = {
    goto: async () => {},
    locator: () => ({
      evaluateAll: async () => [{ title: "16th and Mission safety", url: "https://missionlocal.org/2026/01/example/" }],
    }),
  };
  const browser = {
    contexts: () => [{ pages: () => [page] }],
    close: async () => {},
  };
  const browserType = { connectOverCDP: async () => browser };

  const result = await scrapeSearchPage("https://missionlocal.org/?s=test", {
    apiKey: "test-key",
    projectId: "project-123",
    fetchImpl,
    browserType,
    timeoutMs: 5_000,
  });

  assert.equal(result.sessionId, "session-123");
  assert.equal(result.links.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body), {
    status: "REQUEST_RELEASE",
    projectId: "project-123",
  });
});

test("Browserbase remains optional without an API key", async () => {
  const result = await scrapeSearchPage("https://missionlocal.org/?s=test", { apiKey: "" });
  assert.equal(result.skipped, true);
  assert.deepEqual(result.links, []);
});
