import { scrapeSearchPage } from "./browserbase.js";
import { streetTerms } from "./legislative.js";

const KNOWN_MINUTES = {
  "180066": {
    title: "Public Safety and Neighborhood Services Committee meeting minutes",
    date: "2018-02-14T00:00:00.000Z",
    body: "Public Safety and Neighborhood Services Committee",
    url: "https://sfbos.org/sites/default/files/psn021418_minutes.pdf",
    detail: "Official minutes include the hearing on conditions and services at the 16th and Mission BART plazas.",
  },
};

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function termsMatch(text, terms) {
  const haystack = normalize(text);
  return terms.every((term) => haystack.includes(normalize(term).split(" ")[0]));
}

export function minutesFromLegislative(records = []) {
  return records.flatMap((record) => {
    const known = KNOWN_MINUTES[record.file];
    return known ? [{ ...known, file: record.file, source: "San Francisco Board of Supervisors" }] : [];
  });
}

export async function fetchNewsCorroboration(location, options = {}) {
  const terms = streetTerms(location);
  const query = encodeURIComponent(`"${terms.join(" and ")}" San Francisco traffic safety`);
  const sourceUrl = `https://missionlocal.org/?s=${query}`;
  try {
    const scraped = await scrapeSearchPage(sourceUrl, options);
    const articles = scraped.links
      .filter((item) => /^https:\/\/missionlocal\.org\/\d{4}\//.test(item.url))
      .filter((item) => termsMatch(`${item.title} ${item.url}`, terms))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
      .slice(0, 5)
      .map((item) => ({ ...item, publisher: "Mission Local", corroborates: "location context", retrievedAt: new Date().toISOString() }));
    return { articles, sourceUrl, method: scraped.provider, sessionId: scraped.sessionId, warnings: scraped.skipped ? [scraped.reason] : [] };
  } catch (error) {
    return { articles: [], sourceUrl, method: "browserbase", warnings: [error.message] };
  }
}

export async function fetchPublicCorroboration(location, legislative, options = {}) {
  const [newsResult] = await Promise.allSettled([fetchNewsCorroboration(location, options)]);
  return {
    news: newsResult.status === "fulfilled" ? newsResult.value : { articles: [], warnings: [newsResult.reason.message] },
    meetingMinutes: {
      records: minutesFromLegislative(legislative?.records),
      source: "San Francisco Board of Supervisors",
      disclosure: "Minutes corroborate that the intersection appeared in an official meeting record; they do not prove that a specific treatment was approved.",
    },
  };
}
