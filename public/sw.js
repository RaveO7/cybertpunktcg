// Service worker : mode hors-ligne de la PWA (boutique, tournoi…).
//
// - Pages principales et assets Next (/_next/static, hachés donc immuables) : disponibles sans réseau.
//   Navigation preload : la page part au réseau pendant le démarrage du service worker. Écran principal
//   d'un compte connecté (SHELL_PAGES) déjà en cache : la copie s'affiche aussitôt et la réponse réseau la
//   remplace pour le lancement suivant. Ces pages ne contiennent aucune donnée (collection, catalogue et
//   prix sont toujours redemandés) : seule une nouvelle version de l'app arrive avec un lancement de
//   retard. Autre écran d'un compte connecté : le serveur n'est attendu qu'un instant.
// - Catalogue public : réseau d'abord, copie en cache si le réseau échoue ou traîne. L'app lit aussi
//   ces copies (et celle de la collection) pour s'afficher aussitôt au démarrage (src/lib/offline.ts).
// - Données du compte (session, collection, stats…) : idem, cache vidé à la connexion/déconnexion
//   ou dès que le serveur répond 401.
// - Images de cartes : cache d'abord (le téléchargement complet se lance depuis Paramètres).
//
// Les noms de caches sont partagés avec src/lib/offline.ts : les garder synchronisés.

const VERSION = "v1";
// Pages enregistrées sous leurs adresses préfixées par la langue (« /fr/decks ») depuis la v2 : les
// anciennes copies sans préfixe sont effacées. Les images téléchargées (IMAGES_CACHE) sont gardées.
const SHELL_CACHE = "cptcg-shell-v2";
const STATIC_CACHE = `cptcg-static-${VERSION}`;
const DATA_CACHE = `cptcg-data-${VERSION}`;
const USER_CACHE = `cptcg-user-${VERSION}`;
const IMAGES_CACHE = `cptcg-images-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE, DATA_CACHE, USER_CACHE, IMAGES_CACHE];

// Langue, écrans à garder et textes de la page « hors ligne » : passés par l'URL du script
// (src/components/OfflineSupport.tsx), dans la langue de la page qui l'enregistre.
const SETTINGS = new URL(self.location.href).searchParams;
const LANG = SETTINGS.get("lang") || "fr";
const HOME = `/${LANG}`;
const SHELL_PAGES = (SETTINGS.get("pages") || HOME).split(",").filter((path) => path.startsWith("/"));
const SHELL_ASSETS = [`/${LANG}/manifest.webmanifest`, "/icons/icon-192.png?v=2", "/icons/icon-512.png?v=2"];
const OFFLINE_TEXT = {
  title: SETTINGS.get("title") || "Offline",
  body: SETTINGS.get("body") || "",
  home: SETTINGS.get("home") || HOME,
};

// Au-delà, on garde la copie en cache et la réponse réseau la mettra à jour en arrière-plan.
const NETWORK_TIMEOUT_MS = 4000;
// Idem pour une page rendue pour un compte connecté : une fonction chaude répond bien plus vite, une
// fonction à froid (premier lancement depuis un moment) met jusqu'à 2 s.
const APP_PAGE_TIMEOUT_MS = 400;
// Posé par src/proxy.ts : « 1 » si la page a été rendue avec un cookie de session.
const SESSION_PAGE_HEADER = "x-cptcg-session";
// Les assets de chaque déploiement s'accumulent : on ne garde que les plus récents.
const STATIC_MAX_ENTRIES = 400;

const USER_API = ["/api/auth/session", "/api/collection", "/api/stats", "/api/investment/history", "/api/share", "/api/wishlist", "/api/decks"];
const PUBLIC_API = ["/api/catalog", "/api/share/"];
const SESSION_CHANGES = ["/api/auth/login", "/api/auth/logout", "/api/auth/register"];
const ACCOUNT_DELETE = "/api/auth/account";

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
      // Navigation preload : la page est demandée au réseau pendant que le service worker démarre (lancement
      // de l'app installée), au lieu d'attendre qu'il soit prêt.
      await self.registration.navigationPreload?.enable().catch(() => undefined);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (
      (request.method === "POST" && SESSION_CHANGES.includes(url.pathname)) ||
      (request.method === "DELETE" && url.pathname === ACCOUNT_DELETE)
    ) {
      event.respondWith(clearUserCacheAfter(request));
    }
    return;
  }

  // Flux RSC de navigation : en cas d'échec, Next recharge la page, servie alors depuis le cache HTML.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/_vercel/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    // Une seule copie par page : /cards?set=… réutilise celle de /cards.
    const preload = event.preloadResponse ?? Promise.resolve(undefined);
    event.waitUntil(preload.catch(() => undefined));
    const immediate = SHELL_PAGES.includes(url.pathname);
    event.respondWith(
      networkFirst(request, SHELL_CACHE, { key: url.origin + url.pathname, fallback: offlinePage, preload, event, immediate }),
    );
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
      event.respondWith(networkFirst(request, DATA_CACHE, { event }));
    } else if (USER_API.includes(url.pathname)) {
      event.respondWith(networkFirst(request, USER_CACHE, { event }));
    }
    return;
  }
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith("/manifest.webmanifest") || url.pathname === "/favicon.ico") {
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
  // Réponse déjà demandée par le navigateur (navigation preload), sinon requête réseau.
  const network = (options.preload ?? Promise.resolve(undefined))
    .catch(() => undefined)
    .then((preloaded) => preloaded ?? fetch(request))
    .then(async (response) => {
      // Une réponse redirigée ne peut pas resservir une navigation : on ne la garde pas.
      if (response.ok && response.type === "basic" && !response.redirected) {
        await cache.put(key, response.clone()).catch(() => undefined);
      } else if (response.status === 401 && cacheName === USER_CACHE) {
        // Session expirée ou révoquée : ne plus servir les données ni les écrans de ce compte.
        await forgetSession();
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

  // Une copie existe : on la sert si le réseau échoue ou met trop de temps. La réponse réseau, même
  // tardive, met la copie à jour : le service worker reste actif jusqu'à son arrivée.
  options.event?.waitUntil(network.catch(() => undefined));
  const appPage = cached.headers.get(SESSION_PAGE_HEADER) === "1";
  if (appPage && options.immediate) return cached;
  const delay = appPage ? APP_PAGE_TIMEOUT_MS : NETWORK_TIMEOUT_MS;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), delay));
  const winner = await Promise.race([network.catch(() => null), timeout]);
  if (winner) return winner;
  network.catch(() => undefined);
  return cached;
}

async function clearUserCacheAfter(request) {
  const response = await fetch(request);
  if (response.ok) await forgetSession();
  return response;
}

/**
 * Changement ou fin de session : données du compte effacées, et copies des écrans rendus pour lui
 * (servies sans attendre le serveur) oubliées. Icônes et manifeste restent.
 */
async function forgetSession() {
  await caches.delete(USER_CACHE);
  const cache = await caches.open(SHELL_CACHE);
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (key) => {
      const cached = await cache.match(key);
      if (cached?.headers.get(SESSION_PAGE_HEADER) === "1") await cache.delete(key);
    }),
  );
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // cache.keys() suit l'ordre d'insertion : les plus anciennes entrées partent en premier.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

function offlinePage() {
  const { title, body, home } = OFFLINE_TEXT;
  const html = `<!doctype html><html lang="${escapeHtml(LANG)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07080d;color:#e8eef6;font-family:system-ui,sans-serif;text-align:center;padding:24px}a{color:#3ee0ff}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(HOME)}">${escapeHtml(home)}</a></p></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
