import test from "node:test";
import assert from "node:assert/strict";
import {
  createAnalysisRateLimitMiddleware,
  createRateLimiter,
  validateIntersectionQuery,
} from "../server/index.js";

test("analyze input validation rejects overlong and implausible intersection queries", () => {
  const tooLong = validateIntersectionQuery("A".repeat(121));
  assert.equal(tooLong.error, "Enter an intersection of 120 characters or fewer.");

  const invalid = validateIntersectionQuery("16th & Mission <script>");
  assert.match(invalid.error, /plausible intersection/);

  assert.equal(validateIntersectionQuery("16th & Mission").query, "16th & Mission");
});

test("analyze rate-limit middleware returns 429 after ten requests from one IP", () => {
  const rateLimiter = createRateLimiter({ now: () => 0 });
  const middleware = createAnalysisRateLimitMiddleware(rateLimiter);
  const request = { ip: "203.0.113.5" };
  let nextCalls = 0;
  const response = {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  for (let index = 0; index < 10; index += 1) middleware(request, response, () => { nextCalls += 1; });
  middleware(request, response, () => { nextCalls += 1; });

  assert.equal(nextCalls, 10);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "6");
  assert.match(response.payload.error, /Too many analysis requests/);
});
