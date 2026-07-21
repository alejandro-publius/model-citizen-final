import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const queues = new Map();

export function cacheStatus() {
  return { backend: "file" };
}

export function cacheKey(query) {
  return String(query || "intersection")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "intersection";
}

export function payloadScore(payload) {
  if (!payload || typeof payload !== "object") return 0;
  return (
    (payload.findings?.length || 0) * 20 +
    (payload.fixes?.length || 0) * 10 +
    (payload.streetview?.filter((item) => item.available).length || 0) * 5 +
    (payload.satellite?.available ? 5 : 0) +
    (payload.renders?.available ? 5 : 0) +
    (payload.geometry?.elements?.length || 0) * 2 +
    (payload.crashes?.length || 0) +
    (payload.reports311?.length || 0) +
    (payload.location ? 5 : 0)
  );
}

export async function readCache(query, directory = path.resolve(".cache")) {
  try {
    return JSON.parse(await readFile(path.join(directory, `${cacheKey(query)}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function writeCache(query, payload, directory = path.resolve(".cache")) {
  const key = cacheKey(query);
  const previous = queues.get(key) || Promise.resolve(false);
  const current = previous.then(async () => {
    if (payloadScore(payload) === 0) return false;
    await mkdir(directory, { recursive: true });
    const existing = await readCache(query, directory);
    if (existing && payloadScore(existing) >= payloadScore(payload)) return false;

    const destination = path.join(directory, `${key}.json`);
    const temporary = path.join(directory, `.${key}-${process.pid}-${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
    return true;
  });
  queues.set(key, current.catch(() => false));
  return current;
}
