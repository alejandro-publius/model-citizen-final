import { sanitizeError } from "./errors.js";

const HEADINGS = [0, 90, 180, 270];

function endpoint(path, location, heading, key) {
  const url = new URL(`https://maps.googleapis.com/maps/api/streetview/${path}`);
  url.searchParams.set("size", "640x640");
  url.searchParams.set("location", location);
  url.searchParams.set("heading", String(heading));
  url.searchParams.set("fov", "90");
  url.searchParams.set("pitch", "0");
  url.searchParams.set("key", key);
  return url;
}

export async function fetchStreetView({ lat, lng }, key, fetchImpl = fetch) {
  if (!key) {
    return HEADINGS.map((heading) => ({
      heading,
      available: false,
      reason: "GOOGLE_MAPS_KEY is not configured",
    }));
  }

  const location = `${lat},${lng}`;
  return Promise.all(
    HEADINGS.map(async (heading) => {
      try {
        const metadataResponse = await fetchImpl(endpoint("metadata", location, heading, key));
        const metadata = await metadataResponse.json();
        if (!metadataResponse.ok || metadata.status !== "OK") {
          return { heading, available: false, reason: metadata.status || "No imagery" };
        }

        const imageResponse = await fetchImpl(endpoint("", location, heading, key));
        if (!imageResponse.ok) {
          return { heading, available: false, reason: `Image request ${imageResponse.status}` };
        }
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        return {
          heading,
          available: true,
          image: `data:${imageResponse.headers.get("content-type") || "image/jpeg"};base64,${bytes.toString("base64")}`,
          panoId: metadata.pano_id,
          date: metadata.date,
          copyright: metadata.copyright,
        };
      } catch (error) {
        return { heading, available: false, reason: sanitizeError(error) };
      }
    }),
  );
}

export function satelliteEndpoint({ lat, lng }, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", "20");
  url.searchParams.set("size", "640x640");
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("format", "jpg");
  url.searchParams.set("key", key);
  return url;
}

export async function fetchSatellite(location, key, fetchImpl = fetch) {
  if (!key) return { available: false, reason: "GOOGLE_MAPS_KEY is not configured" };
  try {
    const response = await fetchImpl(satelliteEndpoint(location, key));
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      return {
        available: false,
        reason: `Satellite request ${response.status}${contentType ? ` (${contentType})` : ""}`,
      };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      available: true,
      image: `data:${contentType};base64,${bytes.toString("base64")}`,
      zoom: 20,
      orientation: "north-up",
      source: "Google Maps Static API",
    };
  } catch (error) {
    return { available: false, reason: sanitizeError(error) };
  }
}
