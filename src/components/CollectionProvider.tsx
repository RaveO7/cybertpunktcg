"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clearDataCache, prefetchCached } from "@/components/data-cache";
import type { MutationResult } from "@/lib/api-responses";
import { ApiError, api, loadResponseSchemas, responseSchemasIfLoaded, type SchemaName } from "@/lib/client/api";
import { useApiErrorMessage } from "@/lib/client/use-api-error-message";
import { whenIdle } from "@/lib/client/when-idle";
import { matchRoute } from "@/i18n/match";
import { type BootRequests, collectionBody, requestCatalog, requestCollection, takeBootRequests } from "@/lib/boot-requests";
import { readSavedCollection } from "@/lib/offline";
import { useCatalogGate } from "@/components/use-catalog-gate";
import { createLineActions } from "@/components/collection/line-actions";
import type { CollectionContextValue, SessionStatus } from "@/components/collection/types";
import { useOfflineQueue } from "@/components/collection/use-offline-queue";
import { type NewOp, clearQueue, isTempId, requestFor } from "@/lib/offline-queue";
import { disablePush } from "@/lib/push-client";
import { browserStorage, clearSessionUser, readSessionUser, writeSessionUser } from "@/lib/session-hint";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";

const LOCAL_USER_KEY = "cptcg-user-id";

/** Données des écrans les plus visités, chargées au repos pour qu'ils s'ouvrent sans attente. */
const WARM_REQUESTS: [url: string, schema: SchemaName][] = [
  ["/api/decks", "decksSchema"],
  ["/api/tournaments", "tournamentListSchema"],
  ["/api/share", "shareInfoSchema"],
  ["/api/investment/history?", "portfolioHistoryResponseSchema"],
];

// Schémas demandés dès le chargement de ce module, en parallèle de l'hydratation : souvent déjà là quand
// les réponses du démarrage (boot-requests) sont lues. Échec sans risque : chaque lecture relance le chargement.
if (typeof window !== "undefined") loadResponseSchemas().catch(() => undefined);

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function useCollection() {
  const value = useContext(CollectionContext);
  if (!value) throw new Error("useCollection doit être utilisé dans le provider.");
  return value;
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<SessionStatus>("unknown");
  const [catalog, setCatalog] = useState<CatalogDTO | null>(null);
  // Collection du serveur (ou de la copie gardée) ; celle affichée y ajoute les modifications en attente.
  const [serverItems, setItems] = useState<CollectionItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Vérification de la session (GET /api/collection) : seulement avec une session mémorisée ou sur une
  // page réservée aux comptes. Un visiteur des pages publiques n'envoie aucune requête vouée au 401.
  const [verifySession, setVerifySession] = useState(false);
  const { catalogWanted, requireCatalog } = useCatalogGate();
  const errors = useTranslations("errors.request");
  const requestError = useApiErrorMessage();
  // Lu au moment de l'échec, dans la langue courante, sans relancer le chargement initial.
  const loadFailedMessage = useEffectEvent(() => errors("loadCollection"));
  // Modifications locales de la collection : une réponse partie avant l'une d'elles est périmée.
  const edits = useRef(0);
  const { items, ops, opsRef, pendingIds, syncing, syncErrors, dismissSyncError, readLatest, queueStore, enqueue, replay, replayRef } =
    useOfflineQueue({ user, serverItems, catalog, errors, endSession, applyResult, setItems, edits });

  function editItems(update: (current: CollectionItemDTO[]) => CollectionItemDTO[]) {
    edits.current += 1;
    setItems(update);
  }

  function applyResult(result: MutationResult) {
    editItems((current) => {
      let next = current;
      if (result.deletedId) next = next.filter((item) => item.id !== result.deletedId);
      if (result.item) {
        next = [...next.filter((item) => item.id !== result.item?.id), result.item];
      }
      return next;
    });
  }

  /** Session ouverte (connexion, inscription, vérification réussie) : mémorisée sur l'appareil. */
  function rememberSession(nextUser: AuthUser) {
    window.localStorage.removeItem(LOCAL_USER_KEY);
    writeSessionUser(browserStorage(), nextUser);
    setUser(nextUser);
    setSession("signed-in");
  }

  /** Session refusée par le serveur ou déconnexion : mémoire, utilisateur et données effacés. */
  function endSession() {
    clearSessionUser(browserStorage());
    setUser(null);
    setCatalog(null);
    setItems([]);
    setSession("signed-out");
    setReady(true);
  }

  /** Échec d'une action du compte : session close si le serveur l'a refusée ; message traduit à afficher. */
  function actionError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.kind === "session") endSession();
    return new Error(requestError(error, fallback));
  }

  async function loadBoundData() {
    // Erreur réseau : même message qu'une erreur serveur, l'écran propose de réessayer.
    // Échec traité plus bas comme une réponse illisible (message de chargement), après le test du 401.
    const schemasRequest = loadResponseSchemas().catch(() => null);
    const [freshCatalog, collection] = await Promise.all([requestCatalog(), requestCollection()]).catch(
      () => [null, null] as const,
    );
    if (collection?.status === 401) {
      endSession();
      throw new Error(errors("sessionLost"));
    }
    const schemas = await schemasRequest;
    const body = collection && schemas && collectionBody(schemas, collection);
    if (!freshCatalog || !body) {
      setError(errors("loadCollection"));
      setReady(true);
      return;
    }
    setCatalog(freshCatalog);
    setItems(body.items);
    setError(null);
    setReady(true);
    // Collection chargée en ligne : les modifications en attente partent.
    void replayRef.current();
  }

  async function openSession(path: string, body: Record<string, unknown>) {
    let result: { user: AuthUser };
    try {
      result = await api(path, { body, schema: "authResponseSchema" });
    } catch (error) {
      // 401 à la connexion : identifiants refusés (message du serveur), pas une session expirée.
      if (error instanceof ApiError && error.kind === "session") throw new Error(error.message || errors("loginFailed"));
      throw new Error(requestError(error, errors("loginFailed")));
    }
    rememberSession(result.user);
    await loadBoundData();
  }

  // Changement de compte (connexion, déconnexion, session expirée) : les données en cache et les pages
  // gardées par le routeur appartenaient à la session précédente.
  const router = useRouter();
  // L'utilisateur mémorisé donne déjà la clé : sa vérification réussie (même id) ne la change pas.
  const sessionKey = session === "unknown" ? null : session === "signed-in" ? (user?.id ?? "") : "";
  const previousSession = useRef<string | null>(null);
  useEffect(() => {
    if (sessionKey === null) return;
    if (previousSession.current !== null && previousSession.current !== sessionKey) {
      clearDataCache();
      // Session perdue sur l'accueil : sans cookie, le proxy y servirait la présentation des visiteurs au
      // lieu de l'écran de connexion du tableau de bord (RequireUser).
      const lostOnHome = sessionKey === "" && matchRoute(window.location.pathname)?.route === "/";
      if (!lostOnHome) router.refresh();
    }
    previousSession.current = sessionKey;
  }, [router, sessionKey]);

  // Compte connecté : données des autres écrans préchargées au repos.
  useEffect(() => {
    if (!sessionKey) return;
    return whenIdle(() => WARM_REQUESTS.forEach(([url, schema]) => prefetchCached(url, schema)));
  }, [sessionKey]);

  // Session mémorisée reprise avant le premier affichage : navigation et cadre du compte tout de suite.
  // Lue après le montage seulement, pour que l'hydratation parte du même état que le rendu serveur.
  const rememberedUser = useRef<AuthUser | null>(null);
  // Requêtes lancées depuis le <head> (boot-requests) ; appliquées dès ce premier rendu si déjà arrivées.
  const bootRequests = useRef<BootRequests | null>(null);
  const bootApplied = useRef(false);
  useLayoutEffect(() => {
    const remembered = readSessionUser(browserStorage());
    rememberedUser.current = remembered;
    bootRequests.current ??= takeBootRequests();
    if (remembered) {
      // Session vérifiée et données déjà là (schémas compris) : tableau de bord affiché directement, sans
      // écran intermédiaire.
      const { collection, catalog: bootCatalog } = bootRequests.current?.done ?? {};
      const schemas = responseSchemasIfLoaded();
      const bootCollection = collection && schemas && collectionBody(schemas, collection);
      if (bootCollection && bootCatalog) {
        bootApplied.current = true;
        rememberSession(bootCollection.user);
        setCatalog(bootCatalog);
        setItems(bootCollection.items);
        setReady(true);
        return;
      }
      setUser(remembered);
      setSession("signed-in");
      return;
    }
    setSession("guest");
  }, []);

  useEffect(() => {
    // Sans session mémorisée, attend qu'une page réservée aux comptes le demande (requireSession).
    if (!rememberedUser.current && !verifySession) return;
    let cancelled = false;
    // Données du serveur arrivées (ou session refusée) : la copie gardée sur l'appareil ne s'affiche plus.
    let settled = false;
    let savedShown = false;
    async function load() {
      if (bootApplied.current) return;
      const remembered = rememberedUser.current;
      // Le catalogue (public, servi par le CDN) part en même temps que la collection, même sans session
      // mémorisée (première visite sur l'appareil) : l'attendre après la vérification de session retardait
      // l'affichage de la grille. Session refusée : il est simplement ignoré. Liste des decks : seulement
      // quand un écran le réclame (useCatalogGate).
      // Compte mémorisé : la dernière copie gardée par le service worker s'affiche aussitôt, remplacée dès la
      // réponse du serveur ; les deux requêtes sont en général déjà parties depuis le <head> (boot-requests).
      const boot = bootRequests.current;
      const catalogRequest = catalogWanted.then(() => boot?.catalog ?? requestCatalog());
      // Rejet traité à la lecture plus bas : ce gestionnaire évite seulement un rejet « non géré » entre-temps.
      catalogRequest.catch(() => undefined);
      if (remembered) {
        void readSavedCollection(remembered.id).then((saved) => {
          if (!saved || settled || cancelled) return;
          savedShown = true;
          setCatalog(saved.catalog);
          setItems(saved.items);
          setReady(true);
        });
      }
      try {
        // Une seule requête vérifie la session et apporte la collection (401 : session absente ou expirée).
        let editsAtStart = edits.current;
        const collection = await (boot?.collection ?? requestCollection());
        if (cancelled) return;
        if (collection.status === 401) {
          settled = true;
          endSession();
          return;
        }
        const schemas = await loadResponseSchemas();
        if (cancelled) return;
        let body = collectionBody(schemas, collection);
        if (!body) throw new Error("collection");
        // Session inconnue jusqu'ici (rien de mémorisé sur l'appareil) : le serveur a rendu la page avec ce même
        // cookie, rien d'affiché ni de mis en cache n'appartient à une autre session. Ce n'est pas un changement
        // de compte : pas de router.refresh, qui redemanderait la page et la rendrait une seconde fois.
        if (previousSession.current === "") previousSession.current = body.user.id;
        rememberSession(body.user);
        const freshCatalog = await catalogRequest;
        if (!freshCatalog) throw new Error("catalog");
        // Collection modifiée sur la copie gardée pendant le chargement : relue pour inclure ces modifications.
        if (edits.current !== editsAtStart) {
          editsAtStart = edits.current;
          body = collectionBody(schemas, await requestCollection());
          if (!body) throw new Error("collection");
        }
        if (cancelled) return;
        settled = true;
        setCatalog(freshCatalog);
        if (edits.current === editsAtStart) setItems(body.items);
        setError(null);
        setReady(true);
        void replayRef.current();
      } catch {
        // Erreur réseau ou serveur : le statut de session ne change pas. La copie gardée reste affichée ;
        // sans elle, seul le message d'erreur s'affiche.
        if (!cancelled) {
          settled = true;
          if (!savedShown) setError(loadFailedMessage());
          setReady(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [verifySession, catalogWanted, replayRef]);

  /**
   * Modification d'une ligne. Hors ligne, sans réseau, ou derrière d'autres modifications en attente, elle
   * part dans la file (l'ordre est gardé) au lieu d'échouer. « queued » : rien n'a été envoyé.
   */
  async function request(op: NewOp): Promise<"sent" | "queued"> {
    if (!user) throw new Error(errors("sessionExpired"));
    if (!navigator.onLine || opsRef.current.length > 0 || isTempId(op.lineId)) {
      await enqueue(user.id, op);
      void replay();
      return "queued";
    }
    const { url, method, body } = requestFor(op);
    let result: MutationResult;
    try {
      result = await api(url, { method, body, schema: "mutationResultSchema" });
    } catch (error) {
      // Erreur réseau : la modification attend le retour du réseau.
      if (error instanceof ApiError && error.kind === "offline") {
        await enqueue(user.id, op);
        return "queued";
      }
      throw actionError(error, errors("saveFailed"));
    }
    applyResult(result);
    return "sent";
  }

  // Construit à l'appel (jamais pendant le rendu) : les actions lisent l'état le plus récent.
  const lineActions = () => createLineActions({ user, readLatest, errors, request, editItems, actionError });

  const value = useMemo<CollectionContextValue>(
    () => ({
      session,
      ready,
      error,
      retry: () => {
        setError(null);
        setReady(false);
        // 401 : la session est close et l'écran de connexion s'affiche.
        loadBoundData().catch(() => undefined);
      },
      user,
      catalog,
      items,
      login: (email, password) =>
        openSession("/api/auth/login", {
          email,
          password,
          localUserId: window.localStorage.getItem(LOCAL_USER_KEY),
        }),
      register: (input) =>
        openSession("/api/auth/register", {
          ...input,
          localUserId: window.localStorage.getItem(LOCAL_USER_KEY),
        }),
      logout: async () => {
        // Cet appareil ne doit plus recevoir les alertes de ce compte.
        await disablePush();
        await api("/api/auth/logout", { method: "POST" }).catch((error: unknown) => {
          throw actionError(error, errors("logoutFailed"));
        });
        // Déconnexion voulue (confirmée par l'écran si la file n'est pas vide) : les modifications en attente sont perdues.
        // Purge locale ratée (stockage bloqué) : sans conséquence, la file est de toute façon liée à l'identifiant de ce compte.
        if (user) await clearQueue(queueStore(), user.id).catch(() => undefined);
        endSession();
        setError(null);
      },
      deleteAccount: async () => {
        await api("/api/auth/account", { method: "DELETE", body: { confirm: true } }).catch((error: unknown) => {
          throw actionError(error, errors("deleteAccountFailed"));
        });
        // Même justification qu'à la déconnexion : la purge locale est facultative.
        if (user) await clearQueue(queueStore(), user.id).catch(() => undefined);
        endSession();
        setError(null);
      },
      saveLine: (input) => lineActions().saveLine(input),
      saveBatch: (input) => lineActions().saveBatch(input),
      importLines: (input) => lineActions().importLines(input),
      patchLine: (id, input) => lineActions().patchLine(id, input),
      deleteLine: (id) => lineActions().deleteLine(id),
      pendingCount: ops.length,
      pendingIds,
      syncing,
      syncErrors,
      dismissSyncError,
      requireSession: () => setVerifySession(true),
      requireCatalog,
    }),
    // Les fonctions ferment sur user ; session, ready, catalog et items sont l'état public.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, ready, error, user, catalog, items, ops, pendingIds, syncing, syncErrors, errors],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
