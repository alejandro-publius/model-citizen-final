import test from "node:test";
import assert from "node:assert/strict";
import { fetchNewsCorroboration, minutesFromLegislative, termsMatch, unwrapSearchResult } from "../server/corroboration-sources.js";

test("news corroboration requires both street terms", () => {
  assert.equal(termsMatch("Pedestrian safety at 16th and Mission streets", ["16TH ST", "MISSION ST"]), true);
  assert.equal(termsMatch("Pedestrian safety on Mission Street", ["16TH ST", "MISSION ST"]), false);
});

test("official minutes are linked to the exact legislative file", () => {
  const records = minutesFromLegislative([{ file: "180066" }, { file: "other" }]);
  assert.equal(records.length, 1);
  assert.match(records[0].url, /psn021418_minutes\.pdf$/);
});

test("DuckDuckGo redirect results unwrap to the publisher URL", () => {
  const article = "https://missionlocal.org/2026/05/pedestrian-struck-near-16th-and-mission/";
  const wrapped = `https://duckduckgo.com/l/?uddg=${encodeURIComponent(article)}&rut=test`;
  assert.equal(unwrapSearchResult(wrapped), article);
});

test("live Browserbase results keep only exact two-street Mission Local articles", async () => {
  const matching = "https://missionlocal.org/2026/05/pedestrian-struck-near-16th-and-mission/";
  const result = await fetchNewsCorroboration(
    { query: "16th St & Mission St" },
    {
      scrapeImpl: async () => ({
        provider: "browserbase",
        sessionId: "session-live",
        links: [
          { title: "Pedestrian struck near 16th and Mission", url: `https://duckduckgo.com/l/?uddg=${encodeURIComponent(matching)}` },
          { title: "Safety work on Mission Street", url: "https://missionlocal.org/2026/05/mission-only/" },
        ],
      }),
    },
  );
  assert.equal(result.sessionId, "session-live");
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].url, matching);
});
