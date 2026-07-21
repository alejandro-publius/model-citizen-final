import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeIntersection } from "./pipeline.js";
import { cacheStatus, readCache } from "./cache.js";
import { AGENTS, activityEvent } from "./orchestrator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const samplePath = path.join(root, "sample", "16th-and-mission.json");
const distPath = path.join(root, "dist");
const port = Number(process.env.PORT || 8787);
const demoMode = process.env.DEMO_MODE === "1";

async function samplePayload() {
  const payload = JSON.parse(await readFile(samplePath, "utf8"));
  const telemetry = sampleTelemetry(payload);
  const activity = sampleActivity(payload);
  return {
    ...payload,
    meta: {
      ...payload.meta,
      demo: true,
      cached: true,
      servedAt: new Date().toISOString(),
      telemetry,
      activity,
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

function sampleActivity(payload) {
  return [
    activityEvent("imagery", "complete", `Verified ${payload.vision?.observations?.length || 0} isolated visual findings and satellite-input provenance.`, { runtime: "judge-fixture" }),
    activityEvent("records", "complete", `Loaded ${payload.crashes?.length || 0} crashes, ${payload.news?.articles?.length || 0} news articles, and ${payload.meetingMinutes?.records?.length || 0} minute records.`, { runtime: "judge-fixture" }),
    activityEvent("civic", "complete", `Resolved the named contact: Supervisor ${payload.civic?.supervisor || "unavailable"}.`, { runtime: "judge-fixture" }),
    activityEvent("design", "complete", `Verified ${payload.fixes?.length || 0} treatments and the synthetic photorealistic reference pair.`, { runtime: "judge-fixture" }),
  ];
}

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_request, response) => {
  response.json({
    ok: true,
    demoMode,
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    streetViewConfigured: Boolean(process.env.GOOGLE_MAPS_KEY),
    satelliteConfigured: Boolean(process.env.GOOGLE_MAPS_KEY),
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    browserbaseConfigured: Boolean(process.env.BROWSERBASE_API_KEY),
    uAgentsConfigured: Boolean(process.env.UAGENTS_URL),
    agents: AGENTS,
    cache: await cacheStatus(),
  });
});

app.get("/api/demo", async (_request, response, next) => {
  try {
    if (!demoMode) {
      const cached = await readCache("16th St & Mission St, San Francisco, CA");
      if (cached?.meta?.demo === false) {
        return response.json({
          ...cached,
          meta: { ...cached.meta, cached: true, servedAt: new Date().toISOString() },
        });
      }
    }
    response.json(await samplePayload());
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze", async (request, response, next) => {
  try {
    const query = String(request.body?.query || "").trim();
    if (!query) return response.status(400).json({ error: "Enter an intersection." });
    if (demoMode) return response.json(await samplePayload());
    const result = await analyzeIntersection(query, { refresh: request.body?.refresh === true });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analyze/stream", async (request, response) => {
  const query = String(request.query?.query || "").trim();
  if (!query) return response.status(400).json({ error: "Enter an intersection." });

  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.flushHeaders();

  try {
    if (demoMode) {
      const payload = await samplePayload();
      const telemetry = sampleTelemetry(payload);
      const activity = sampleActivity(payload);
      telemetry.forEach((event) => sendEvent(response, "stage", event));
      activity.forEach((event) => sendEvent(response, "agent", event));
      payload.meta.telemetry = telemetry;
      payload.meta.activity = activity;
      sendEvent(response, "result", payload);
      sendEvent(response, "done", { ok: true });
      return response.end();
    }

    const result = await analyzeIntersection(query, {
      refresh: request.query?.refresh === "true",
      onProgress: (event) => sendEvent(response, "stage", event),
      onActivity: (event) => sendEvent(response, "agent", event),
    });
    result.warnings?.forEach((warning) => sendEvent(response, "warning", { message: warning }));
    sendEvent(response, "result", result);
    sendEvent(response, "done", { ok: true });
    return response.end();
  } catch (error) {
    sendEvent(response, "analysis-error", {
      message: error.message || "Analysis failed.",
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
  console.error(error);
  response.status(500).json({
    error: error.message || "Analysis failed.",
    hint: "Try judge mode with DEMO_MODE=1 if external services or keys are unavailable.",
  });
});

app.listen(port, () => {
  console.log(`Model Citizen API listening on http://localhost:${port}${demoMode ? " (judge mode)" : ""}`);
});
