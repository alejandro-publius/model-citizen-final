const DISTRICTS_URL = "https://data.sfgov.org/resource/cqbw-m5m3.geojson";

const CONTACTS = {
  "connie chan": { email: "ChanStaff@sfgov.org", phone: "415-554-7410" },
  "stephen sherrill": { email: "SherrillStaff@sfgov.org", phone: "415-554-7752" },
  "danny sauter": { email: "SauterStaff@sfgov.org", phone: "415-554-7450" },
  "alan wong": { email: "WongStaff@sfgov.org", phone: "415-554-7960" },
  "bilal mahmood": { email: "MahmoodStaff@sfgov.org", phone: "415-554-7630" },
  "matt dorsey": { email: "DorseyStaff@sfgov.org", phone: "415-554-7970" },
  "myrna melgar": { email: "MelgarStaff@sfgov.org", phone: "415-554-6516" },
  "rafael mandelman": { email: "MandelmanStaff@sfgov.org", phone: "415-554-6968" },
  "jackie fielder": { email: "Jackie.Fielder@sfgov.org", phone: "415-554-5144" },
  "shamann walton": { email: "Shamann.Walton@sfgov.org", phone: "415-554-7670" },
  "chyanne chen": { email: "ChenStaff@sfgov.org", phone: "415-554-6975" },
};

let districtCache;

export function pointInRing([x, y], ring = []) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index] || [];
    const [xj, yj] = ring[previous] || [];
    const crosses = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point, geometry) {
  if (!geometry?.coordinates) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return false;
  return polygons.some((rings) => {
    if (!pointInRing(point, rings[0])) return false;
    return !rings.slice(1).some((hole) => pointInRing(point, hole));
  });
}

async function loadDistricts(fetchImpl = fetch) {
  if (fetchImpl === fetch && districtCache) return districtCache;
  const load = (async () => {
    const url = new URL(DISTRICTS_URL);
    url.searchParams.set("$limit", "20");
    const response = await fetchImpl(url, {
      headers: { "X-App-Token": process.env.DATASF_APP_TOKEN || "" },
    });
    if (!response.ok) throw new Error(`Supervisor district lookup failed (${response.status})`);
    return response.json();
  })();
  if (fetchImpl === fetch) districtCache = load;
  return load;
}

export function civicFromFeature(feature) {
  const properties = feature?.properties || {};
  const supervisor = properties.sup_name || "";
  const contact = CONTACTS[supervisor.toLowerCase()] || {};
  const district = Number(properties.sup_dist_num || properties.sup_dist);
  return {
    district,
    districtName: properties.sup_dist_name || `Supervisor District ${district}`,
    supervisor,
    email: contact.email || "",
    phone: contact.phone || "",
    dataAsOf: properties.data_as_of || properties.data_loaded_at || null,
    sourceUrl: "https://data.sfgov.org/d/cqbw-m5m3",
    rosterUrl: "https://sfbos.org/current-supervisors",
  };
}

export async function resolveCivicContext({ lat, lng }, fetchImpl = fetch) {
  const collection = await loadDistricts(fetchImpl);
  const feature = (collection.features || []).find((item) => pointInGeometry([Number(lng), Number(lat)], item.geometry));
  if (!feature) throw new Error("No current San Francisco supervisor district contained this point");
  return civicFromFeature(feature);
}

