import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const queues = new Map();
let redisPromise;

async function redisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisPromise) {
    redisPromise = import("redis").then(async ({ createClient }) => {
      const client = createClient({
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: false },
      });
      client.on("error", () => {});
      await client.connect();
      return client;
    }).catch(() => null);
  }
  return redisPromise;
}

function redisKey(query) {
  return `model-citizen:v3:${cacheKey(query)}`;
}

export async function cacheStatus() {
  const client = await redisClient();
  return { backend: client?.isReady ? "redis+file" : "file", redisConfigured: Boolean(process.env.REDIS_URL), redisReady: Boolean(client?.isReady) };
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
    (payload.geometry?.elements?.length || 0) * 2 +
    (payload.crashes?.length || 0) +
    (payload.reports311?.length || 0) +
    (payload.location ? 5 : 0)
  );
}

export async function readCache(query, directory = path.resolve(".cache")) {
  const client = await redisClient();
  if (client?.isReady) {
    try {
      const value = await client.get(redisKey(query));
      if (value) return JSON.parse(value);
    } catch {
      // The atomic file cache remains available during a Redis interruption.
    }
  }
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
    const client = await redisClient();
    if (client?.isReady) {
      try {
        const ttl = Math.max(60, Number(process.env.REDIS_CACHE_TTL_SECONDS || 86400));
        await client.set(redisKey(query), JSON.stringify(payload), { EX: ttl });
      } catch {
        // The file write already succeeded; Redis is an acceleration layer.
      }
    }
    return true;
  });
  queues.set(key, current.catch(() => false));
  return current;
}
