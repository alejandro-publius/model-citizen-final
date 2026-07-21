import { sanitizeError } from "./errors.js";

const API_ROOT = "https://webapi.legistar.com/v1/sfgov";

function normalize(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\b(STREET|ST)\b/g, "ST")
    .replace(/\b(AVENUE|AVE)\b/g, "AVE")
    .replace(/\b(BOULEVARD|BLVD)\b/g, "BLVD")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function streetTerms(location) {
  const label = location.shortLabel || location.query || "";
  return label
    .split(/\s*(?:&|\bAND\b|@)\s*/i)
    .map(normalize)
    .filter((term) => term.length >= 3)
    .slice(0, 2);
}

export function scoreMatter(matter, terms) {
  const haystack = normalize(`${matter.MatterName || ""} ${matter.MatterTitle || ""}`);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function termsAreNear(matter, terms, maximumGap = 140) {
  if (terms.length < 2) return true;
  const haystack = normalize(`${matter.MatterName || ""} ${matter.MatterTitle || ""}`);
  const positions = terms.map((term) => {
    const found = [];
    let cursor = haystack.indexOf(term);
    while (cursor >= 0 && found.length < 20) {
      found.push(cursor);
      cursor = haystack.indexOf(term, cursor + 1);
    }
    return found;
  });
  if (positions.some((items) => !items.length)) return false;
  return positions[0].some((left) => positions[1].some((right) => Math.abs(left - right) <= maximumGap));
}

export function matterLink(matter) {
  const params = new URLSearchParams({
    GUID: matter.MatterGuid || "",
    ID: String(matter.MatterId || ""),
    Options: "",
    Search: "",
  });
  return `https://sfgov.legistar.com/LegislationDetail.aspx?${params}`;
}

export function presentMatter(matter) {
  const actionDate = matter.MatterEnactmentDate || matter.MatterPassedDate || matter.MatterIntroDate;
  return {
    id: matter.MatterId,
    file: matter.MatterFile,
    name: matter.MatterName || matter.MatterTypeName || "Legislative matter",
    title: matter.MatterTitle || matter.MatterName || "Untitled matter",
    type: matter.MatterTypeName || "Matter",
    status: matter.MatterStatusName || "Status unavailable",
    body: matter.MatterBodyName || "Board of Supervisors",
    introducedAt: matter.MatterIntroDate || null,
    actionAt: actionDate || null,
    action: matter.MatterEnactmentDate
      ? `Enacted${matter.MatterEnactmentNumber ? ` as ${matter.MatterEnactmentNumber}` : ""}`
      : matter.MatterPassedDate ? "Board action recorded" : "Introduced",
    url: matterLink(matter),
  };
}

async function requestMatters(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Legistar request failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export async function fetchLegislativeTrail(location, fetchImpl = fetch) {
  const terms = streetTerms(location);
  if (!terms.length) return { records: [], searchedTerms: [], sourceUrl: "https://sfgov.legistar.com/Legislation.aspx" };

  const exactDemo = terms.includes("16TH ST") && terms.includes("MISSION ST");
  const queries = [];
  if (exactDemo) {
    const known = new URL(`${API_ROOT}/matters`);
    known.searchParams.set("$filter", "MatterFile eq '180066'");
    queries.push(known);
  }

  for (const term of terms) {
    const token = term.split(" ")[0].replaceAll("'", "''");
    const url = new URL(`${API_ROOT}/matters`);
    url.searchParams.set("$filter", `substringof('${token}',MatterTitle) eq true`);
    url.searchParams.set("$orderby", "MatterIntroDate desc");
    url.searchParams.set("$top", "100");
    queries.push(url);
  }

  const results = await Promise.allSettled(queries.map((url) => requestMatters(url, fetchImpl)));
  const unique = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((matter) => {
      if (/communication/i.test(`${matter.MatterTypeName || ""} ${matter.MatterName || ""}`)) return;
      const score = scoreMatter(matter, terms);
      if (score === terms.length && termsAreNear(matter, terms)) unique.set(matter.MatterId, { matter, score });
    });
  });

  const records = [...unique.values()]
    .sort((a, b) => b.score - a.score || String(b.matter.MatterIntroDate || "").localeCompare(String(a.matter.MatterIntroDate || "")))
    .slice(0, 5)
    .map(({ matter }) => presentMatter(matter));
  const warnings = results
    .filter((result) => result.status === "rejected")
    .map((result) => sanitizeError(result.reason));

  return {
    records,
    searchedTerms: terms,
    sourceUrl: "https://sfgov.legistar.com/Legislation.aspx",
    apiUrl: API_ROOT,
    warnings,
    disclosure: "Statuses and actions are reproduced from the official legislative record; absence of a matching record is not evidence that no action occurred.",
  };
}
