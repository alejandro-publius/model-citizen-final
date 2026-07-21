import { chromium } from "playwright-core";

const API_ROOT = "https://api.browserbase.com/v1/sessions";

export function browserbaseReady(options = {}) {
  return Boolean(options.apiKey || process.env.BROWSERBASE_API_KEY);
}

async function createSession(apiKey, projectId, fetchImpl) {
  const response = await fetchImpl(API_ROOT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BB-API-Key": apiKey },
    body: JSON.stringify({
      projectId: projectId || undefined,
      browserSettings: { timeout: 180 },
      userMetadata: { product: "model-citizen", purpose: "public-source-corroboration" },
    }),
  });
  if (!response.ok) throw new Error(`Browserbase session failed (${response.status})`);
  return response.json();
}

export async function scrapeSearchPage(url, options = {}) {
  const apiKey = options.apiKey || process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return { links: [], provider: "browserbase", skipped: true, reason: "BROWSERBASE_API_KEY is not configured" };
  const fetchImpl = options.fetchImpl || fetch;
  const session = await createSession(apiKey, options.projectId || process.env.BROWSERBASE_PROJECT_ID, fetchImpl);
  let browser;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.slice(0, 400).map((anchor) => ({
      title: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
      url: anchor.href,
    })).filter((item) => item.title && item.url));
    return { links, provider: "browserbase", sessionId: session.id, sourceUrl: url };
  } finally {
    await browser?.close().catch(() => {});
    await fetchImpl(`${API_ROOT}/${session.id}`, {
      method: "DELETE",
      headers: { "X-BB-API-Key": apiKey },
    }).catch(() => {});
  }
}
