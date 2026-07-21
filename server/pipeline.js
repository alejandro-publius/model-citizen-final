import { readCache, writeCache } from "./cache.js";
import { resolveCivicContext } from "./civic.js";
import { corroborate } from "./corroborate.js";
import { fetchDataSF, fetchDistrictLeaderboard } from "./datasf.js";
import { mapFixes } from "./fixes.js";
import { geocode } from "./geocode.js";
import { generateLastMile } from "./lastmile.js";
import { fetchLegislativeTrail } from "./legislative.js";
import { fetchOsm } from "./osm.js";
import { fetchSatellite, fetchStreetView } from "./streetview.js";
import { runBlindVision } from "./vision.js";

const SCHEMA_VERSION = 2;

function shortLabel(query) {
  return String(query)
    .replace(/\s*,?\s*san francisco.*$/i, "")
    .replace(/\s*&\s*/g, " & ")
    .trim();
}

function summarize(crashes, reports311, findings) {
  return {
    crashCount: crashes.length,
    fatalCount: crashes.filter((item) => /fatal/i.test(item.collision_severity || "")).length,
    pedestrianCrashCount: crashes.filter((item) => /pedestrian/i.test(item.type_of_collision || "")).length,
    severeCount: crashes.filter((item) => /severe/i.test(item.collision_severity || "")).length,
    reportCount: reports311.length,
    confirmedCount: findings.filter((item) => item.status === "CONFIRMED").length,
    candidateCount: findings.filter((item) => item.status === "CANDIDATE").length,
  };
}

export async function analyzeIntersection(query, options = {}) {
  const cached = !options.refresh && await readCache(query, options.cacheDirectory);
  const telemetry = [];
  const emit = (event) => {
    const enriched = { ...event, at: new Date().toISOString() };
    telemetry.push(enriched);
    options.onProgress?.(enriched);
  };
  if (cached?.meta?.schemaVersion === SCHEMA_VERSION) {
    emit({ stage: "ACT", progress: 4, status: "complete", message: "Loaded a complete cached intersection brief." });
    return { ...cached, meta: { ...cached.meta, cached: true, telemetry } };
  }

  const startedAt = Date.now();
  emit({ stage: "LOOK", progress: 0, status: "active", message: "Resolving the intersection." });
  const location = await geocode(query, options.fetchImpl);
  location.shortLabel = shortLabel(query);
  emit({ stage: "LOOK", progress: 0, status: "active", message: `Geocoded ${location.shortLabel}.` });

  const googleMapsKey = options.googleMapsKey || process.env.GOOGLE_MAPS_KEY;
  const [streetResult, satelliteResult, dataResult, osmResult, civicResult, legislativeResult] = await Promise.allSettled([
    fetchStreetView(location, options.googleMapsKey || process.env.GOOGLE_MAPS_KEY, options.fetchImpl),
    fetchSatellite(location, googleMapsKey, options.fetchImpl),
    fetchDataSF(location, options.fetchImpl),
    fetchOsm(location, options.fetchImpl),
    resolveCivicContext(location, options.fetchImpl),
    fetchLegislativeTrail(location, options.fetchImpl),
  ]);

  const streetview = streetResult.status === "fulfilled" ? streetResult.value : [];
  const satellite = satelliteResult.status === "fulfilled"
    ? satelliteResult.value
    : { available: false, reason: satelliteResult.reason.message };
  const data = dataResult.status === "fulfilled"
    ? dataResult.value
    : { crashes: [], reports311: [], warnings: [dataResult.reason.message] };
  const geometry = osmResult.status === "fulfilled"
    ? osmResult.value
    : { elements: [], warning: osmResult.reason.message };
  const civic = civicResult.status === "fulfilled" ? civicResult.value : null;
  const legislative = legislativeResult.status === "fulfilled"
    ? legislativeResult.value
    : { records: [], warnings: [legislativeResult.reason.message] };

  const leaderboardPromise = civic
    ? fetchDistrictLeaderboard(civic.district, options.fetchImpl)
    : Promise.resolve(null);

  const availableViews = streetview.filter((item) => item.available).length;
  emit({
    stage: "LOOK",
    progress: 0,
    status: "active",
    message: `Loaded ${availableViews} street view${availableViews === 1 ? "" : "s"}${satellite.available ? " plus satellite context" : ""}.`,
  });

  let vision;
  try {
    vision = await runBlindVision(streetview, {
      apiKey: options.openaiApiKey,
      model: options.model,
      client: options.openaiClient,
      satellite,
    });
  } catch (error) {
    vision = {
      observations: [],
      overall_impression: "The blind visual survey failed, so no visual claims are shown.",
      skipped: true,
      reason: error.message,
    };
  }
  emit({
    stage: "LOOK",
    progress: 1,
    status: "complete",
    message: vision.skipped
      ? `Blind survey unavailable: ${vision.reason}`
      : `Blind survey returned ${vision.observations.length} visual finding${vision.observations.length === 1 ? "" : "s"}.`,
  });

  const { findings, reported } = corroborate(vision.observations, data.crashes, data.reports311);
  const leaderboardResult = await Promise.allSettled([leaderboardPromise]);
  const leaderboard = leaderboardResult[0].status === "fulfilled" ? leaderboardResult[0].value : null;
  emit({
    stage: "CHECK",
    progress: 2,
    status: "complete",
    message: `Checked ${data.crashes.length} crashes, ${data.reports311.length} relevant 311 reports, and ${legislative.records?.length || 0} legislative record${legislative.records?.length === 1 ? "" : "s"}.`,
  });

  const fixes = mapFixes(findings);
  const summary = summarize(data.crashes, data.reports311, findings);
  emit({
    stage: "FIX",
    progress: 3,
    status: "complete",
    message: `Mapped ${fixes.length} intervention${fixes.length === 1 ? "" : "s"} to planning costs and grant programs.`,
  });
  const advocacy = await generateLastMile(
    {
      location,
      civic,
      findings,
      crashes: data.crashes.slice(0, 25),
      reports311: data.reports311.slice(0, 25),
      fixes,
      summary,
      legislative: legislative.records?.slice(0, 3) || [],
    },
    { apiKey: options.openaiApiKey, model: options.model, client: options.openaiClient },
  );
  emit({
    stage: "ACT",
    progress: 4,
    status: "complete",
    message: civic?.supervisor
      ? `Prepared an addressed action letter for Supervisor ${civic.supervisor}.`
      : "Prepared a resident action letter.",
  });

  const warnings = [
    ...(data.warnings || []),
    ...(legislative.warnings || []),
    streetResult.status === "rejected" ? streetResult.reason.message : null,
    satelliteResult.status === "rejected" ? satelliteResult.reason.message : null,
    osmResult.status === "rejected" ? osmResult.reason.message : null,
    civicResult.status === "rejected" ? civicResult.reason.message : null,
    leaderboardResult[0].status === "rejected" ? leaderboardResult[0].reason.message : null,
    vision.skipped ? vision.reason : null,
  ].filter(Boolean);

  const payload = {
    location,
    civic,
    streetview,
    satellite,
    vision,
    crashes: data.crashes,
    reports311: data.reports311,
    geometry,
    findings,
    reported,
    fixes,
    summary,
    legislative,
    leaderboard,
    advocacy,
    warnings,
    meta: {
      demo: false,
      cached: false,
      model: options.model || process.env.OPENAI_MODEL || "gpt-5.6",
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      schemaVersion: SCHEMA_VERSION,
      telemetry,
      firewall: "Vision received street-level and satellite imagery only; crash, 311, legislative, district, and OSM data were introduced afterward.",
    },
  };

  await writeCache(query, payload, options.cacheDirectory);
  return payload;
}
