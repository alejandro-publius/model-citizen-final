const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function overpassQuery({ lat, lng }) {
  return `[out:json][timeout:25];
(
  way(around:95,${lat},${lng})["highway"];
  way(around:95,${lat},${lng})["building"];
  node(around:95,${lat},${lng})["highway"~"^(crossing|traffic_signals|stop)$"];
);
out body geom;`;
}

export async function fetchOsm(location, fetchImpl = fetch) {
  const body = new URLSearchParams({ data: overpassQuery(location) });
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.elements) || !payload.elements.length) {
        throw new Error("Overpass returned no nearby geometry");
      }
      return {
        elements: payload.elements,
        source: endpoint,
        timestamp: payload.osm3s?.timestamp_osm_base,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || "OpenStreetMap geometry unavailable");
}
