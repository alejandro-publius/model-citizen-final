import sample from "../sample/16th-and-mission.json" with { type: "json" };

const AGENTS = [
  { id: "imagery", name: "Imagery agent", task: "Street View + satellite isolation" },
  { id: "records", name: "Records agent", task: "Crash, 311, news, and minutes" },
  { id: "civic", name: "Civic agent", task: "District official + legislative trail" },
  { id: "design", name: "Design agent", task: "Treatments, costs, and visual renders" },
];

function activityEvent(agentId, message) {
  const agent = AGENTS.find((item) => item.id === agentId);
  return {
    type: "agent",
    agent: agent.id,
    agentName: agent.name,
    status: "complete",
    message,
    at: new Date().toISOString(),
    runtime: "judge-fixture",
  };
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
    activityEvent("imagery", `Verified ${payload.vision?.observations?.length || 0} isolated visual findings and satellite-input provenance.`),
    activityEvent("records", `Loaded ${payload.crashes?.length || 0} crashes, ${payload.news?.articles?.length || 0} news articles, and ${payload.meetingMinutes?.records?.length || 0} minute records.`),
    activityEvent("civic", `Resolved the named contact: Supervisor ${payload.civic?.supervisor || "unavailable"}.`),
    activityEvent("design", `Verified ${payload.fixes?.length || 0} treatments and the synthetic photorealistic reference pair.`),
  ];
}

export function samplePayload() {
  const payload = structuredClone(sample);
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
      hosting: "cloudflare-workers-free",
      spendingProtection: "external APIs disabled",
    },
  };
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sse(payload) {
  const lines = [];
  for (const event of payload.meta.telemetry) {
    lines.push(`event: stage\ndata: ${JSON.stringify(event)}\n`);
  }
  for (const event of payload.meta.activity) {
    lines.push(`event: agent\ndata: ${JSON.stringify(event)}\n`);
  }
  lines.push(`event: result\ndata: ${JSON.stringify(payload)}\n`);
  lines.push(`event: done\ndata: ${JSON.stringify({ ok: true })}\n`);
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

async function handleApi(request, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({
      ok: true,
      demoMode: true,
      model: "gpt-5.6",
      openaiConfigured: false,
      streetViewConfigured: false,
      satelliteConfigured: false,
      imageModel: "gpt-image-1",
      browserbaseConfigured: false,
      agents: AGENTS,
      cache: { backend: "bundled-fixture" },
      hosting: "cloudflare-workers-free",
      spendingProtection: "external APIs disabled",
    });
  }

  if (request.method === "GET" && url.pathname === "/api/demo") {
    return json(samplePayload());
  }

  if (request.method === "POST" && url.pathname === "/api/analyze") {
    const body = await request.json().catch(() => ({}));
    if (!String(body.query || "").trim()) return json({ error: "Enter an intersection." }, 400);
    return json(samplePayload());
  }

  if (request.method === "GET" && url.pathname === "/api/analyze/stream") {
    if (!String(url.searchParams.get("query") || "").trim()) return json({ error: "Enter an intersection." }, 400);
    return sse(samplePayload());
  }

  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, url);
    return env.ASSETS.fetch(request);
  },
};
