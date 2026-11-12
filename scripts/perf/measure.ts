import type { Browser, BrowserContextOptions, Cookie } from "@playwright/test";

// Temps en millisecondes depuis le début de la navigation ; octets transférés (compressés).
export type PageTimings = {
  ttfb: number;
  fcp: number;
  lcp: number;
  domContentLoaded: number;
  load: number;
  // Dernière image visible à l'écran reçue (ou LCP si plus tardif) : la page « a l'air finie ».
  visualComplete: number;
  // Dernière ressource reçue, chargements différés compris (réseau calme 1 s).
  fullyLoaded: number;
  cls: number;
  requests: number;
  totalKB: number;
  jsKB: number;
  imageKB: number;
};

export type PageChecks = {
  status: number;
  finalPath: string;
  consoleErrors: string[];
  failedRequests: string[];
  brokenImages: string[];
};

export type PageMeasure = { timings: PageTimings; checks: PageChecks };

const QUIET_MS = 1000;
const MAX_WAIT_MS = 30_000;

// Observateurs posés avant le premier script de la page : LCP et CLS ne sont lisibles qu'en direct.
function installObservers() {
  const perf = { lcp: 0, cls: 0 };
  Object.assign(window, { __perf: perf });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) perf.lcp = Math.max(perf.lcp, entry.startTime);
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!entry.hadRecentInput) perf.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
}

function collectInPage() {
  const perf = (window as unknown as { __perf: { lcp: number; cls: number } }).__perf;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const byUrl = new Map(resources.map((entry) => [entry.name, entry]));

  const images = [...document.images];
  const visibleImages = images.filter((image) => {
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  });
  const visualComplete = Math.max(
    fcp,
    perf.lcp,
    ...visibleImages.map((image) => byUrl.get(image.currentSrc)?.responseEnd ?? 0),
  );
  const brokenImages = images
    .filter((image) => image.complete && image.currentSrc && image.naturalWidth === 0)
    .map((image) => image.currentSrc);

  const kb = (entries: PerformanceResourceTiming[]) =>
    Math.round(entries.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024);
  return {
    timings: {
      ttfb: nav.responseStart,
      fcp,
      lcp: perf.lcp,
      domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      visualComplete,
      fullyLoaded: Math.max(nav.loadEventEnd, visualComplete, ...resources.map((entry) => entry.responseEnd)),
      cls: Math.round(perf.cls * 1000) / 1000,
      requests: resources.length + 1,
      totalKB: Math.round(nav.transferSize / 1024) + kb(resources),
      jsKB: kb(resources.filter((entry) => entry.initiatorType === "script" || entry.name.endsWith(".js"))),
      imageKB: kb(resources.filter((entry) => entry.initiatorType === "img" || entry.name.includes("/_next/image"))),
    },
    brokenImages,
    finalPath: location.pathname,
  };
}

/** Une visite à froid (contexte neuf, sans cache ni service worker) : temps de chargement et anomalies visibles. */
export async function measurePage(
  browser: Browser,
  url: string,
  device: BrowserContextOptions,
  cookies: Cookie[],
): Promise<PageMeasure> {
  const context = await browser.newContext({ ...device, locale: "fr-FR", serviceWorkers: "block" });
  try {
    await context.addCookies(cookies);
    // tsx (esbuild, keepNames) entoure les fonctions nommées d'un appel à `__name`, absent du navigateur.
    await context.addInitScript("globalThis.__name = (fn) => fn;");
    await context.addInitScript(installObservers);
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    let inFlight = 0;
    let lastActivity = Date.now();
    const settle = () => {
      inFlight -= 1;
      lastActivity = Date.now();
    };
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message.slice(0, 200)));
    page.on("request", () => {
      inFlight += 1;
      lastActivity = Date.now();
    });
    page.on("requestfinished", settle);
    page.on("requestfailed", (request) => {
      settle();
      // Préchargements annulés par le navigateur ou la navigation : sans effet pour le visiteur.
      if (request.failure()?.errorText !== "net::ERR_ABORTED") {
        failedRequests.push(`${request.failure()?.errorText} ${request.url()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });

    const response = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    const started = Date.now();
    while ((inFlight > 0 || Date.now() - lastActivity < QUIET_MS) && Date.now() - started < MAX_WAIT_MS) {
      await page.waitForTimeout(100);
    }
    const result = await page.evaluate(collectInPage);
    return {
      timings: result.timings,
      checks: {
        status: response?.status() ?? 0,
        finalPath: result.finalPath,
        consoleErrors,
        failedRequests,
        brokenImages: result.brokenImages,
      },
    };
  } finally {
    await context.close();
  }
}
