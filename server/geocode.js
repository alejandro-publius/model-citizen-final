const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ModelCitizen/1.0 (OpenAI Build Week; civic-safety prototype)";

export async function geocode(query, fetchImpl = fetch) {
  const text = String(query || "").trim();
  if (!text) throw new Error("Enter a San Francisco intersection.");

  const scoped = /san francisco/i.test(text) ? text : `${text}, San Francisco, CA`;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", scoped);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status}).`);
  const results = await response.json();
  if (!results.length) throw new Error("Intersection not found in San Francisco.");

  const result = results[0];
  return {
    query: text,
    label: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
    osmType: result.osm_type,
    osmId: result.osm_id,
  };
}
