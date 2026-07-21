import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeError } from "./errors.js";
import { analyzeIntersection } from "./pipeline.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const samplePath = path.join(root, "sample", "16th-and-mission.json");
const distPath = path.join(root, "dist");
const port = Number(process.env.PORT || 8787);
const demoMode = process.env.DEMO_MODE === "1";
const MAX_INTERSECTION_QUERY_LENGTH = 120;
const INTERSECTION_QUERY_PATTERN = /^[A-Za-z0-9 .,'&@/-]+$/;

async function samplePayload() {
  const payload = JSON.parse(await readFile(samplePath, "utf8"));
  return {
    ...payload,
    meta: {
      ...payload.meta,
      demo: true,
      cached: true,
      servedAt: new Date().toISOString(),
    },
  };
}

function sendEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sampleTelemetry(payload) {
  const at = new Date().toISOString();
  return [
    { stage: "LOOK", progress: 1, status: "complete", message: `Loaded ${payload.vision?.observations?.length || 0} cached blind visual findings.`, at },
    { stage: "CHECK", progress: 2, status: "complete", message: `Checked ${payload.crashes?.length || 0} crashes, ${payload.reports311?.length || 0} relevant 311 reports, and ${payload.legislative?.records?.length || 0} legislative records.`, at },
    { stage: "FIX", progress: 3, status: "complete", message: `Loaded ${payload.fixes?.length || 0} grant-matched interventions.`, at },
    { stage: "ACT", progress: 4, status: "complete", message: `Prepared an addressed letter for Supervisor ${payload.civic?.supervisor || "the district office"}.`, at },
  ];
}

export function validateIntersectionQuery(value) {
  const query = typeof value === "string" ? value.trim() : "";
  if (!query) return { error: "Enter an intersection." };
  if (query.length > MAX_INTERSECTION_QUERY_LENGTH) {
    return { error: `Enter an intersection of ${MAX_INTERSECTION_QUERY_LENGTH} characters or fewer.` };
  }
  if (!INTERSECTION_QUERY_PATTERN.test(query)) {
    return { error: "Use a plausible intersection with letters, numbers, spaces, and standard street punctuation." };
  }
  return { query };
}

export function createRateLimiter({ capacity = 10, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();
  const refillPerMs = capacity / windowMs;
  let lastPrunedAt = 0;

  return (key) => {
    const currentTime = now();
    if (currentTime - lastPrunedAt >= windowMs) {
      for (const [bucketKey, bucket] of buckets) {
        if (currentTime - bucket.updatedAt >= windowMs) buckets.delete(bucketKey);
      }
      lastPrunedAt = currentTime;
    }
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, updatedAt: currentTime };
      buckets.set(key, bucket);
    } else {
      bucket.tokens = Math.min(capacity, bucket.tokens + (currentTime - bucket.updatedAt) * refillPerMs);
      bucket.updatedAt = currentTime;
    }

    if (bucket.tokens < 1) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)),
      };
    }
    bucket.tokens -= 1;
    return { allowed: true };
  };
}

export function createAnalysisRateLimitMiddleware(rateLimiter) {
  return (request, response, next) => {
    const limit = rateLimiter(request.ip || request.socket?.remoteAddress || "unknown");
    if (limit.allowed) return next();
    response.set("Retry-After", String(limit.retryAfterSeconds));
    return response.status(429).json({ error: "Too many analysis requests. Please try again shortly." });
  };
}

export function createApp({ analyze = analyzeIntersection, demo = demoMode, rateLimiter = createRateLimiter() } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  const limitAnalysis = createAnalysisRateLimitMiddleware(rateLimiter);

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      demoMode: demo,
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      streetViewConfigured: Boolean(process.env.GOOGLE_MAPS_KEY),
      satelliteConfigured: Boolean(process.env.GOOGLE_MAPS_KEY),
    });
  });

  app.get("/api/demo", async (_request, response, next) => {
    try {
      response.json(await samplePayload());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/analyze", limitAnalysis, async (request, response, next) => {
    try {
      const validation = validateIntersectionQuery(request.body?.query);
      if (validation.error) return response.status(400).json({ error: validation.error });
      if (demo) return response.json(await samplePayload());
      const result = await analyze(validation.query, { refresh: request.body?.refresh === true });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analyze/stream", limitAnalysis, async (request, response) => {
    const validation = validateIntersectionQuery(request.query?.query);
    if (validation.error) return response.status(400).json({ error: validation.error });
    const { query } = validation;

    response.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    response.flushHeaders();

    try {
      if (demo) {
        const payload = await samplePayload();
        const telemetry = sampleTelemetry(payload);
        telemetry.forEach((event) => sendEvent(response, "stage", event));
        payload.meta.telemetry = telemetry;
        sendEvent(response, "result", payload);
        sendEvent(response, "done", { ok: true });
        return response.end();
      }

      const result = await analyze(query, {
        refresh: request.query?.refresh === "true",
        onProgress: (event) => sendEvent(response, "stage", event),
      });
      result.warnings?.forEach((warning) => sendEvent(response, "warning", { message: warning }));
      sendEvent(response, "result", result);
      sendEvent(response, "done", { ok: true });
      return response.end();
    } catch (error) {
      sendEvent(response, "analysis-error", {
        message: sanitizeError(error),
        hint: "Try judge mode with DEMO_MODE=1 if external services or keys are unavailable.",
      });
      return response.end();
    }
  });

  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("/{*splat}", (_request, response) => response.sendFile(path.join(distPath, "index.html")));
  }

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      error: sanitizeError(error),
      hint: "Try judge mode with DEMO_MODE=1 if external services or keys are unavailable.",
    });
  });

  return app;
}

export const app = createApp();

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`Model Citizen API listening on http://localhost:${port}${demoMode ? " (judge mode)" : ""}`);
  });
}
