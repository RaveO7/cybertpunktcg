"use client";

// « Ma boutique » : création, modification, logo, état de vérification, tournois rattachés,
// suppression (cf. specs/shops/profile et verification).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AddressField } from "@/components/geo/AddressField";
import { useI18n } from "@/components/LocaleProvider";
import { formatStart } from "@/components/public/format";
import { VerifiedBadge } from "@/components/public/TournamentCard";
import { buttonClass, dangerClass, inputClass, panelClass, primaryClass, Tag } from "@/components/tournament/ui";
import type { Place } from "@/lib/geo/location";
import type { OwnedShop, ShopSocial } from "@/lib/shops/shops";

const SOCIAL_KINDS = ["instagram", "facebook", "discord", "x", "youtube", "twitch", "tiktok", "autre"] as const;

type Attached = { id: string; name: string; status: string; visibility: string; startsAt: string | null; timeZone: string | null };

type Form = {
  name: string;
  slug: string;
  description: string;
  website: string;
  phone: string;
  contactEmail: string;
  hours: string;
  socials: ShopSocial[];
  place: Place | null;
};

const EMPTY: Form = { name: "", slug: "", description: "", website: "", phone: "", contactEmail: "", hours: "", socials: [], place: null };

function formOf(shop: OwnedShop): Form {
  return {
    name: shop.name,
    slug: shop.slug,
    description: shop.description ?? "",
    website: shop.website ?? "",
    phone: shop.phone ?? "",
    contactEmail: shop.contactEmail ?? "",
    hours: shop.hours ?? "",
    socials: shop.socials,
    place: shop.place,
  };
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "error");
  return body;
}

export function ShopManager() {
  const { t } = useI18n();
  const [shops, setShops] = useState<OwnedShop[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await request<{ shops: OwnedShop[]; isAdmin: boolean }>("/api/shops/mine", { cache: "no-store" });
      setShops(body.shops);
      setIsAdmin(body.isAdmin);
    } catch {
      setError(t.shops.loadFailed);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-1">
        <Link href="/tournois" className="text-xs text-muted hover:text-foreground">
          ← {t.tournaments.title}
        </Link>
        <h1 className="text-2xl text-yellow sm:text-4xl">{t.shops.manageTitle}</h1>
        <p className="max-w-2xl text-sm text-muted">{t.shops.manageSubtitle}</p>
        {isAdmin ? (
          <Link href="/admin/boutiques" className="text-sm text-cyan underline">
            {t.shops.adminLink}
          </Link>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {shops === null && !error ? <p className="text-sm text-muted">{t.common.loading}</p> : null}
      {shops?.length === 0 && !creating ? <p className={`${panelClass} text-sm text-muted`}>{t.shops.empty}</p> : null}

      {shops?.map((shop) => (
        <ShopEditor key={shop.id} shop={shop} onChange={load} />
      ))}

      {creating ? (
        <ShopForm
          title={t.shops.createTitle}
          initial={EMPTY}
          onCancel={() => setCreating(false)}
          onSubmit={async (form) => {
            await request("/api/shops", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...payload(form), slug: undefined }),
            });
            setCreating(false);
            await load();
          }}
        />
      ) : shops && shops.length < 5 ? (
        <button type="button" className={`${primaryClass} self-start`} onClick={() => setCreating(true)}>
          {t.shops.create}
        </button>
      ) : null}
    </div>
  );
}

function payload(form: Form) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.description,
    website: form.website.trim() || null,
    phone: form.phone,
    contactEmail: form.contactEmail.trim() || null,
    hours: form.hours,
    socials: form.socials.filter((social) => social.url.trim()).map((social) => ({ kind: social.kind, url: social.url.trim() })),
    place: form.place,
  };
}

function ShopEditor({ shop, onChange }: { shop: OwnedShop; onChange: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [attached, setAttached] = useState<Attached[] | null>(null);

  const loadAttached = useCallback(async () => {
    try {
      const body = await request<{ tournaments: Attached[] }>(`/api/shops/${shop.slug}`, { cache: "no-store" });
      setAttached(body.tournaments);
    } catch {
      setAttached([]);
    }
  }, [shop.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAttached(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAttached]);

  async function act(action: () => Promise<unknown>, done?: string) {
    setMessage(null);
    try {
      await action();
      if (done) setMessage({ tone: "ok", text: done });
      await onChange();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : t.tournaments.failed });
    }
  }

  async function uploadLogo(file: File) {
    await act(() => request(`/api/shops/${shop.slug}/logo`, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } }), t.shops.saved);
  }

  const statusTone = shop.status === "verified" ? "yellow" : shop.status === "rejected" ? "danger" : "muted";

  return (
    <section className={`${panelClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-3">
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo déjà réduit à 256 px, servi par l'API
          <img src={shop.logoUrl} alt="" width={56} height={56} className="size-14 border border-line object-cover" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg">{shop.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {shop.verified ? <VerifiedBadge /> : <Tag tone={statusTone}>{t.shops.status[shop.status]}</Tag>}
            {shop.status !== "rejected" ? (
              <Link href={`/boutiques/${shop.slug}`} className="text-cyan underline">
                {t.shops.publicPage}
              </Link>
            ) : null}
          </p>
        </div>
      </div>
      {shop.status === "pending" ? <p className="text-sm text-muted">{t.shops.pendingHint}</p> : null}
      {shop.status === "rejected" ? <p className="text-sm text-danger">{t.shops.rejectedHint(shop.reviewNote ?? "—")}</p> : null}
      {shop.status === "verified" ? <p className="text-xs text-muted">{t.shops.reviewAgainHint}</p> : null}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-cyan"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="hud-label">{t.shops.logo}</span>
        <p className="text-xs text-muted">{t.shops.logoHint}</p>
        <div className="flex flex-wrap gap-2">
          <label className={`${buttonClass} cursor-pointer`}>
            {t.shops.uploadLogo}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadLogo(file);
              }}
            />
          </label>
          {shop.logoUrl ? (
            <button type="button" className={buttonClass} onClick={() => void act(() => request(`/api/shops/${shop.slug}/logo`, { method: "DELETE" }))}>
              {t.shops.removeLogo}
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <ShopForm
          title={t.shops.edit}
          initial={formOf(shop)}
          withSlug
          submitLabel={shop.status === "rejected" ? t.shops.resubmit : undefined}
          onCancel={() => setEditing(false)}
          onSubmit={async (form) => {
            await request(`/api/shops/${shop.slug}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...payload(form), resubmit: shop.status === "rejected" }),
            });
            setEditing(false);
            setMessage({ tone: "ok", text: t.shops.saved });
            await onChange();
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => setEditing(true)}>
            {shop.status === "rejected" ? t.shops.resubmit : t.shops.edit}
          </button>
          <button
            type="button"
            className={dangerClass}
            onClick={() => {
              if (window.confirm(t.shops.confirmDelete)) void act(() => request(`/api/shops/${shop.slug}`, { method: "DELETE" }));
            }}
          >
            {t.shops.delete}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="hud-label">{t.shops.attachedTournaments}</h3>
        {attached?.length === 0 ? <p className="text-sm text-muted">{t.shops.noAttached}</p> : null}
        {attached?.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {row.name}
              <span className="text-muted">
                {" "}
                · {row.startsAt ? formatStart(row.startsAt, row.timeZone, locale) : "—"} · {t.tournaments.statuses[row.status as keyof typeof t.tournaments.statuses]}
              </span>{" "}
              {row.visibility === "public" ? <Tag tone="cyan">{t.publicTournaments.isPublic}</Tag> : null}
            </span>
            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                void act(async () => {
                  await request(`/api/shops/${shop.slug}/tournaments/${row.id}`, { method: "DELETE" });
                  await loadAttached();
                })
              }
            >
              {t.shops.detach}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShopForm({
  title,
  initial,
  withSlug = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: Form;
  withSlug?: boolean;
  submitLabel?: string;
  onSubmit: (form: Form) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<Form>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.place) {
      setError(t.shops.addressRequired);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.tournaments.failed);
    } finally {
      setPending(false);
    }
  }

  const text = (key: "name" | "phone" | "contactEmail" | "website", label: string, max: number, type = "text") => (
    <label className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <input type={type} className={inputClass} value={form[key]} maxLength={max} onChange={(event) => set(key, event.target.value)} />
    </label>
  );

  return (
    <form className="flex flex-col gap-3 border border-line p-3" onSubmit={(event) => void submit(event)}>
      <h3 className="text-base">{title}</h3>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {text("name", t.shops.name, 80)}
        {withSlug ? (
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.shops.slug}</span>
            <input className={`${inputClass} font-mono`} value={form.slug} maxLength={60} onChange={(event) => set("slug", event.target.value.toLowerCase())} />
            <span className="text-xs text-muted">{t.shops.slugHint(form.slug || "…")}</span>
          </label>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <span className="hud-label">{t.geo.address}</span>
        <AddressField value={form.place} onChange={(place) => set("place", place)} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="hud-label">{t.shops.description}</span>
        <textarea className={`${inputClass} h-28 py-2`} value={form.description} maxLength={2000} onChange={(event) => set("description", event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("website", t.shops.website, 300, "url")}
        {text("contactEmail", t.shops.email, 254, "email")}
        {text("phone", t.shops.phone, 30, "tel")}
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t.shops.hours}</span>
          <textarea className={`${inputClass} h-20 py-2`} value={form.hours} maxLength={500} placeholder={t.shops.hoursPlaceholder} onChange={(event) => set("hours", event.target.value)} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="hud-label">{t.shops.socials}</span>
        {form.socials.map((social, index) => (
          <div key={index} className="grid grid-cols-[auto_1fr_auto] gap-2">
            <select
              className={`${inputClass} w-auto`}
              value={social.kind}
              aria-label={t.shops.socials}
              onChange={(event) => set("socials", form.socials.map((item, i) => (i === index ? { ...item, kind: event.target.value } : item)))}
            >
              {SOCIAL_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.shops.socialKinds[kind]}
                </option>
              ))}
            </select>
            <input
              type="url"
              className={inputClass}
              value={social.url}
              placeholder="https://"
              aria-label={t.shops.socialUrl}
              onChange={(event) => set("socials", form.socials.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)))}
            />
            <button type="button" className={buttonClass} aria-label={t.tournaments.remove} onClick={() => set("socials", form.socials.filter((_, i) => i !== index))}>
              ×
            </button>
          </div>
        ))}
        {form.socials.length < 8 ? (
          <button type="button" className={`${buttonClass} self-start`} onClick={() => set("socials", [...form.socials, { kind: "instagram", url: "" }])}>
            {t.shops.addSocial}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryClass} disabled={pending || !form.name.trim()}>
          {submitLabel ?? t.shops.save}
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          {t.tournaments.cancel}
        </button>
      </div>
    </form>
  );
}
