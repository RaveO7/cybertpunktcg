/** Pastille du nombre d'alertes de prix non vues. */
export function NavBadge({ count, label, floating = false }: { count?: number; label: (n: number) => string; floating?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={`grid h-4 min-w-4 place-items-center bg-danger px-1 font-mono text-[10px] leading-none text-white ${
        floating ? "absolute -right-2.5 -top-1.5" : "ml-1.5 inline-grid align-middle"
      }`}
    >
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label(count)}</span>
    </span>
  );
}
