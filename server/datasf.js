const CRASHES_URL = "https://data.sfgov.org/resource/ubvf-ztfx.json";
const REPORTS_URL = "https://data.sfgov.org/resource/vw6y-z8j6.json";
const STREET_TERMS = [
  "sign", "signal", "curb", "sidewalk", "traffic", "crosswalk", "pavement",
  "streetlight", "parking", "bike", "bicycle", "tree", "visibility",
];

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function includesWholeWord(text, term) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}($|[^a-z0-9])`, "i");
  return pattern.test(String(text || "").toLowerCase());
}

export function matchesAnyWholeWord(text, terms) {
  return terms.some((term) => includesWholeWord(text, term));
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { "X-App-Token": process.env.DATASF_APP_TOKEN || "" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DataSF request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return response.json();
}

export async function fetchCrashes({ lat, lng }, fetchImpl = fetch) {
  const url = new URL(CRASHES_URL);
  url.searchParams.set(
    "$select",
    "collision_datetime,primary_rd,secondary_rd,collision_severity,type_of_collision,number_injured,point",
  );
  url.searchParams.set("$where", `within_circle(point,${lat},${lng},100)`);
  url.searchParams.set("$order", "collision_datetime DESC");
  url.searchParams.set("$limit", "50");
  return getJson(url, fetchImpl);
}

export async function fetch311({ lat, lng }, fetchImpl = fetch) {
  // vw6y-z8j6 currently exposes numeric lat/long; a tight bbox avoids the
  // broken within_circle(point) query shape seen on older examples.
  const latPad = 0.00091;
  const lngPad = 0.00114;
  const url = new URL(REPORTS_URL);
  url.searchParams.set(
    "$select",
    "requested_datetime,service_name,service_subtype,service_details,address,lat,long",
  );
  url.searchParams.set(
    "$where",
    `lat > ${lat - latPad} AND lat < ${lat + latPad} AND long > ${lng - lngPad} AND long < ${lng + lngPad} AND requested_datetime > '2023-01-01T00:00:00.000'`,
  );
  url.searchParams.set("$order", "requested_datetime DESC");
  url.searchParams.set("$limit", "250");
  const records = await getJson(url, fetchImpl);
  return records.filter((record) =>
    matchesAnyWholeWord(
      `${record.service_name || ""} ${record.service_subtype || ""} ${record.service_details || ""}`,
      STREET_TERMS,
    ),
  );
}

export async function fetchDataSF(location, fetchImpl = fetch) {
  const [crashesResult, reportsResult] = await Promise.allSettled([
    fetchCrashes(location, fetchImpl),
    fetch311(location, fetchImpl),
  ]);
  return {
    crashes: crashesResult.status === "fulfilled" ? crashesResult.value : [],
    reports311: reportsResult.status === "fulfilled" ? reportsResult.value : [],
    warnings: [
      crashesResult.status === "rejected" ? crashesResult.reason.message : null,
      reportsResult.status === "rejected" ? reportsResult.reason.message : null,
    ].filter(Boolean),
  };
}

export function normalizeStreetName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalIntersection(primary, secondary) {
  const streets = [normalizeStreetName(primary), normalizeStreetName(secondary)].filter(Boolean).sort();
  return streets.length === 2 ? streets.join(" & ") : "";
}

function displayStreet(value) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function rankIntersections(records, limit = 10) {
  const grouped = new Map();
  records.forEach((record) => {
    const key = canonicalIntersection(record.primary_rd, record.secondary_rd);
    if (!key) return;
    const current = grouped.get(key) || {
      key,
      label: key.split(" & ").map(displayStreet).join(" & "),
      crashCount: 0,
      fatalCount: 0,
      severeCount: 0,
      pedestrianCount: 0,
      injuredCount: 0,
      latestCrash: null,
      lat: Number(record.tb_latitude) || null,
      lng: Number(record.tb_longitude) || null,
    };
    current.crashCount += 1;
    current.fatalCount += /fatal/i.test(record.collision_severity || "") || Number(record.number_killed) > 0 ? 1 : 0;
    current.severeCount += /severe/i.test(record.collision_severity || "") ? 1 : 0;
    current.pedestrianCount += /pedestrian/i.test(record.type_of_collision || "") ? 1 : 0;
    current.injuredCount += Number(record.number_injured) || 0;
    if (!current.latestCrash || String(record.collision_datetime) > current.latestCrash) current.latestCrash = record.collision_datetime;
    grouped.set(key, current);
  });
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      score: item.fatalCount * 12 + item.severeCount * 5 + item.pedestrianCount * 2 + item.crashCount,
    }))
    .sort((a, b) => b.score - a.score || b.crashCount - a.crashCount || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function fetchDistrictLeaderboard(district, fetchImpl = fetch) {
  if (!Number.isFinite(Number(district))) throw new Error("A supervisor district is required for the leaderboard");
  const url = new URL(CRASHES_URL);
  url.searchParams.set(
    "$select",
    "primary_rd,secondary_rd,collision_datetime,collision_severity,type_of_collision,number_killed,number_injured,tb_latitude,tb_longitude",
  );
  url.searchParams.set(
    "$where",
    `supervisor_district='${Number(district)}' AND collision_datetime > '2021-01-01T00:00:00' AND intersection='Intersection <= 20ft'`,
  );
  url.searchParams.set("$order", "collision_datetime DESC");
  url.searchParams.set("$limit", "5000");
  const records = await getJson(url, fetchImpl);
  return {
    district: Number(district),
    recordsAnalyzed: records.length,
    since: "2021-01-01",
    methodology: "Score = 12× fatal + 5× severe + 2× pedestrian + all returned injury-crash records. Street pairs are canonicalized before grouping.",
    intersections: rankIntersections(records),
    sourceUrl: "https://data.sfgov.org/d/ubvf-ztfx",
  };
}
