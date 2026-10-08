"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";

const LOCAL_USER_KEY = "cptcg-user-id";

const fieldClass =
  "h-12 w-full border border-line bg-background px-3 text-base outline-none focus:border-cyan";

const oauthButtonClass =
  "flex h-12 w-full items-center justify-center gap-2 border border-line bg-panel text-sm text-foreground transition-colors hover:border-cyan disabled:opacity-60";

function localCollectionStored() {
  return window.localStorage.getItem(LOCAL_USER_KEY) != null;
}

function noLocalCollection() {
  return false;
}

function subscribeLocalCollection() {
  return () => {};
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 36 26.8 37 24 37c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.3.7 1 1.5 2.1 2.6 2 .9 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.3zM14.8 6.4c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 1.9-.4 2.5-1.2z" />
    </svg>
  );
}

export function AuthScreen() {
  const { login, register } = useCollection();
  const { t } = useI18n();
  const hasLocal = useSyncExternalStore(subscribeLocalCollection, localCollectionStored, noLocalCollection);
  const [chosenMode, setChosenMode] = useState<"login" | "register" | null>(null);
  const mode = chosenMode ?? (hasLocal ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [oauth, setOauth] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError) {
      // Erreur OAuth transmise par l'URL : lisible seulement dans le navigateur, après l'hydratation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(authError);
      params.delete("authError");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", next);
    }

    let cancelled = false;
    void fetch("/api/auth/oauth", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { google?: boolean; apple?: boolean }) => {
        if (!cancelled) {
          setOauth({ google: Boolean(body.google), apple: Boolean(body.apple) });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function switchMode(next: "login" | "register") {
    setChosenMode(next);
    setError(null);
  }

  function startOAuth(provider: "google" | "apple") {
    setError(null);
    setPending(true);
    const url = new URL(`/api/auth/oauth/${provider}`, window.location.origin);
    const localUserId = window.localStorage.getItem(LOCAL_USER_KEY);
    if (localUserId) url.searchParams.set("localUserId", localUserId);
    window.location.assign(url.toString());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ email, password, displayName });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.auth.failed);
    } finally {
      setPending(false);
    }
  }

  const showOAuth = oauth.google || oauth.apple;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{t.auth.eyebrow}</p>
      <h1 className="mt-1 text-3xl text-yellow">{t.auth.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.auth.subtitle}</p>

      <div className="mt-6 flex border border-line" role="tablist" aria-label={t.auth.modeLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`h-12 flex-1 text-sm ${mode === "login" ? "bg-yellow text-black" : "text-muted"}`}
          onClick={() => switchMode("login")}
        >
          {t.auth.login}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={`h-12 flex-1 text-sm ${mode === "register" ? "bg-yellow text-black" : "text-muted"}`}
          onClick={() => switchMode("register")}
        >
          {t.auth.register}
        </button>
      </div>

      {hasLocal ? <p className="mt-4 text-sm text-cyan">{t.auth.localMerge}</p> : null}

      <form className="mt-4 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
        <label className="flex flex-col gap-1 text-sm">
          {t.auth.email}
          <input
            className={fieldClass}
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.auth.password}
          <input
            className={fieldClass}
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === "register" ? (
          <label className="flex flex-col gap-1 text-sm">
            {t.auth.displayName}
            <input
              className={fieldClass}
              type="text"
              name="name"
              autoComplete="nickname"
              maxLength={40}
              placeholder={t.auth.displayPlaceholder}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        ) : null}
        {mode === "register" ? <p className="text-xs text-muted">{t.auth.passwordHint}</p> : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-12 bg-yellow text-sm font-semibold text-black disabled:opacity-60"
        >
          {pending ? t.auth.submitting : mode === "login" ? t.auth.login : t.auth.createAccount}
        </button>
      </form>

      {showOAuth ? (
        <div className="mt-4 flex flex-col gap-2">
          <div className="relative my-2 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted">
            <span className="h-px flex-1 bg-line" />
            {t.auth.or}
            <span className="h-px flex-1 bg-line" />
          </div>
          {oauth.google ? (
            <button
              type="button"
              className={oauthButtonClass}
              disabled={pending}
              onClick={() => startOAuth("google")}
            >
              <GoogleMark />
              {t.auth.continueGoogle}
            </button>
          ) : null}
          {oauth.apple ? (
            <button
              type="button"
              className={oauthButtonClass}
              disabled={pending}
              onClick={() => startOAuth("apple")}
            >
              <AppleMark />
              {t.auth.continueApple}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
