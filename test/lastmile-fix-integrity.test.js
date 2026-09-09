import test from "node:test";
import assert from "node:assert/strict";
import { fallbackLastMile } from "../server/lastmile.js";
import { mapFixes } from "../server/fixes.js";

// The fallback letter (used whenever OPENAI_API_KEY is absent -- i.e. judge
// mode and any live run without a key) names one "strongest" finding and
// then requests ITS fix, cost, and grant. If the strongest CONFIRMED finding
// has no fix of its own (its hazard text doesn't match any FIX_RULES entry),
// the code must not silently borrow a different finding's fix -- that would
// send a resident letter/grant ask that doesn't match the evidence it cites.

test("fallback letter never attaches a different finding's fix, cost, or grant to the strongest finding", () => {
  const findings = [
    {
      id: "finding-1",
      zone: "NW corner",
      status: "CANDIDATE",
      hazard: "faded crosswalk markings",
      detail: "Paint is nearly gone on the north leg.",
    },
    {
      id: "finding-2",
      zone: "SE corner",
      status: "CONFIRMED",
      hazard: "missing curb ramps",
      detail: "No curb ramp is visible at the SE corner.",
      evidenceCount: 1,
    },
  ];
  const fixes = mapFixes(findings);

  // Sanity check on the fixture itself: finding-2's hazard text ("missing
  // curb ramps") must NOT match any FIX_RULES pattern, and finding-1's must.
  // If this ever stops being true the scenario below no longer exercises
  // the bug, so fail loudly rather than passing for the wrong reason.
  assert.equal(fixes.length, 1, "fixture must produce exactly one fix (for finding-1 only)");
  assert.equal(fixes[0].findingId, "finding-1");

  const result = fallbackLastMile({
    location: { shortLabel: "Test St & Sentinel Ave" },
    civic: { supervisor: "Jamie Rivera" },
    findings,
    crashes: [],
    reports311: [],
    fixes,
    summary: { reportCount: 0 },
  });

  // The letter must describe finding-2 (the actual CONFIRMED / strongest
  // finding) ...
  assert.match(result.letter, /missing curb ramps/i);
  // ... and must NOT request finding-1's fix/cost/grant as if it were the
  // remedy for finding-2. Today it does, because the fallback's
  // `fixes.find(...) || fixes[0]` silently substitutes ANY fix when the
  // strongest finding has none of its own.
  assert.doesNotMatch(
    result.letter,
    /continental crosswalk/i,
    "letter must not request finding-1's fix (continental crosswalk) as the remedy for finding-2 (missing curb ramps)",
  );
  assert.doesNotMatch(
    result.letter,
    /SS4A Demonstration/,
    "letter must not cite finding-1's grant program as funding for finding-2's hazard",
  );
});
