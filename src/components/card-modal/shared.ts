// Classes et utilitaires partagés par les blocs de la fiche carte.

export const fieldClass =
  "h-10 w-full border border-line bg-background px-2.5 text-sm outline-none transition focus:border-cyan focus-visible:ring-1 focus-visible:ring-cyan/70";

export const iconBtnClass =
  "w-9 text-muted transition hover:bg-panel-2 hover:text-cyan focus-visible:bg-panel-2 focus-visible:text-cyan focus-visible:outline-none";

export const fieldLabelClass = "block font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function conditionTone(code: string) {
  switch (code) {
    case "NM":
      return "bg-gain/15 text-gain";
    case "LP":
      return "bg-cyan/15 text-cyan";
    case "MP":
      return "bg-yellow/15 text-yellow";
    default:
      return "bg-danger/15 text-danger";
  }
}

export function conditionDot(code: string) {
  switch (code) {
    case "NM":
      return "bg-gain";
    case "LP":
      return "bg-cyan";
    case "MP":
      return "bg-yellow";
    default:
      return "bg-danger";
  }
}

export function toAmount(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** Aujourd'hui en « AAAA-MM-JJ » (heure locale), borne haute des champs de date d'achat. */
export function todayInputValue() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
