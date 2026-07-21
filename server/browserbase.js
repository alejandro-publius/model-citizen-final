import { chromium } from "playwright-core";

const API_ROOT = "https://api.browserbase.com/v1/sessions";
const DEFAULT_DEADLINE_MS = 25_000;

export function browserbaseReady(options = {}) {
  return Boolean(options.apiKey || process.env.BROWSERBASE_API_KEY);
}

function requestSignal(timeoutMs) {
  return typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
}

async function createSession(apiKey, projectId, fetchImpl, timeoutMs) {
  const response = await fetchImpl(API_ROOT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BB-API-Key": apiKey },
    body: JSON.stringify({
      projectId: projectId || undefined,
      browserSettings: { timeout: 180 },
      userMetadata: { product: "model-citizen", purpose: "public-source-corroboration" },
    }),
    signal: requestSignal(timeoutMs),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Browserbase session failed (${response.status})${detail ? `: ${detail.slice(0, 140)}` : ""}`);
  }
  const session = await response.json();
  if (!session.id || !session.connectUrl) throw new Error("Browserbase returned an incomplete session.");
  return session;
}

async function releaseSession(session, apiKey, projectId, fetchImpl) {
  if (!session?.id) return;
  await fetchImpl(`${API_ROOT}/${session.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BB-API-Key": apiKey },
    body: JSON.stringify({ status: "REQUEST_RELEASE", projectId: projectId || session.projectId || undefined }),
    signal: requestSignal(5_000),
  }).catch(() => {});
}

function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Browserbase exceeded the ${Math.round(timeoutMs / 1000)}-second news budget.`)), timeoutMs);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export async function scrapeSearchPage(url, options = {}) {
  const apiKey = options.apiKey || process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return { links: [], provider: "browserbase", skipped: true, reason: "BROWSERBASE_API_KEY is not configured" };
  const fetchImpl = options.fetchImpl || fetch;
  const projectId = options.projectId || process.env.BROWSERBASE_PROJECT_ID;
  const timeoutMs = Math.max(5_000, Number(options.timeoutMs || process.env.BROWSERBASE_TIMEOUT_MS || DEFAULT_DEADLINE_MS));
  const browserType = options.browserType || chromium;
  const session = await createSession(apiKey, projectId, fetchImpl, Math.min(timeoutMs, 12_000));
  let browser;
  const scrape = async () => {
    browser = await browserType.connectOverCDP(session.connectUrl, { timeout: Math.min(timeoutMs, 12_000) });
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 18_000) });
    const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.slice(0, 400).map((anchor) => ({
      title: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
      url: anchor.href,
    })).filter((item) => item.title && item.url));
    return { links, provider: "browserbase", sessionId: session.id, sourceUrl: url };
  };
  try {
    return await withDeadline(scrape(), timeoutMs);
  } finally {
    await browser?.close().catch(() => {});
    await releaseSession(session, apiKey, projectId, fetchImpl);
  }
}
