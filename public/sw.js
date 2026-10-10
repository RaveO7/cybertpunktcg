// Service worker : mode hors-ligne de la PWA (boutique, tournoi…).
//
// - Pages principales et assets Next (/_next/static, hachés donc immuables) : disponibles sans réseau.
// - Catalogue public : réseau d'abord, copie en cache si le réseau échoue ou traîne.
// - Données du compte (session, collection, stats…) : idem, cache vidé à la connexion/déconnexion
//   ou dès que le serveur répond 401.
// - Images de cartes : cache d'abord (le téléchargement complet se lance depuis Paramètres).
//
// Les noms de caches sont partagés avec src/lib/offline.ts : les garder synchronisés.

const VERSION = "v1";
const SHELL_CACHE = `cptcg-shell-${VERSION}`;
const STATIC_CACHE = `cptcg-static-${VERSION}`;
const DATA_CACHE = `cptcg-data-${VERSION}`;
const USER_CACHE = `cptcg-user-${VERSION}`;
const IMAGES_CACHE = `cptcg-images-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE, DATA_CACHE, USER_CACHE, IMAGES_CACHE];

const SHELL_PAGES = ["/", "/cards", "/investissement", "/decks", "/souhaits", "/comment-jouer", "/parametres"];
const SHELL_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png?v=2", "/icons/icon-512.png?v=2"];

// Au-delà, on garde la copie en cache et la réponse réseau la mettra à jour en arrière-plan.
const NETWORK_TIMEOUT_MS = 4000;
// Les assets de chaque déploiement s'accumulent : on ne garde que les plus récents.
const STATIC_MAX_ENTRIES = 400;

const USER_API = ["/api/auth/session", "/api/collection", "/api/stats", "/api/investment/history", "/api/share", "/api/wishlist", "/api/decks"];
const PUBLIC_API = ["/api/catalog", "/api/share/"];
const SESSION_CHANGES = ["/api/auth/login", "/api/auth/logout", "/api/auth/register"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Une page en échec ne doit pas bloquer l'installation.
      await Promise.all([...SHELL_PAGES, ...SHELL_ASSETS].map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("cptcg-") && !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      await trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (request.method === "POST" && SESSION_CHANGES.includes(url.pathname)) {
      event.respondWith(clearUserCacheAfter(request));
    }
    return;
  }

  // Flux RSC de navigation : en cas d'échec, Next recharge la page, servie alors depuis le cache HTML.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/_vercel/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    // Une seule copie par page : /cards?set=… réutilise celle de /cards.
    event.respondWith(networkFirst(request, SHELL_CACHE, { key: url.origin + url.pathname, fallback: offlinePage }));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (url.pathname.startsWith("/card-images/")) {
    event.respondWith(cacheFirst(request, IMAGES_CACHE));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((path) => url.pathname === path || (path.endsWith("/") && url.pathname.startsWith(path)))) {
      event.respondWith(networkFirst(request, DATA_CACHE));
    } else if (USER_API.includes(url.pathname)) {
      event.respondWith(networkFirst(request, USER_CACHE));
    }
    return;
  }
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/favicon.ico") {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && !response.redirected) await cache.put(request, response.clone()).catch(() => undefined);
  return response;
}

async function networkFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const key = options.key ?? request;
  const network = fetch(request).then(async (response) => {
    // Une réponse redirigée ne peut pas resservir une navigation : on ne la garde pas.
    if (response.ok && response.type === "basic" && !response.redirected) {
      await cache.put(key, response.clone()).catch(() => undefined);
    } else if (response.status === 401 && cacheName === USER_CACHE) {
      // Session expirée ou révoquée : ne plus servir les données de ce compte.
      await caches.delete(USER_CACHE);
    }
    return response;
  });

  const cached = await cache.match(key);
  if (!cached) {
    try {
      return await network;
    } catch (error) {
      if (options.fallback) return options.fallback();
      throw error;
    }
  }

  // Une copie existe : on la sert si le réseau échoue ou met trop de temps.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
  const winner = await Promise.race([network.catch(() => null), timeout]);
  if (winner) return winner;
  network.catch(() => undefined);
  return cached;
}

async function clearUserCacheAfter(request) {
  const response = await fetch(request);
  if (response.ok) await caches.delete(USER_CACHE);
  return response;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // cache.keys() suit l'ordre d'insertion : les plus anciennes entrées partent en premier.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

function offlinePage() {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07080d;color:#e8eef6;font-family:system-ui,sans-serif;text-align:center;padding:24px}a{color:#3ee0ff}</style></head><body><main><h1>Hors ligne</h1><p>Cette page n'a pas encore été enregistrée sur cet appareil.</p><p><a href="/">Revenir à l'accueil</a></p></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
