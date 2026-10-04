import type { ReactNode } from "react";

const TOKEN_RE =
  /\{\{sym:([0-9a-z][0-9a-z-]{1,39})\}\}|\{([^{}]+)\}|\[([A-Za-z][A-Za-z0-9 .,:'/-]*?)\]|€\$/gi;

type SymbolMeta = {
  label: string;
  color?: string;
  scale?: number;
  svg?: ReactNode;
};

const SPEND_ICON = (
  <svg viewBox="0 0 10.382 8.478" className="h-[0.95em] w-[1.15em]" aria-hidden="true" fill="currentColor">
    <path d="M4.464,2.755V1H1v0.695h2.761v1.06H1v4.723h6.225V2.755H4.464z M6.597,6.884h-4.99V3.348h2.154v0.95H2.32 l1.826,1.826l1.798-1.798H4.472V3.348h2.125V6.884z" />
    <path d="M8.336,6.816h1.046V5.77H8.336V6.816z M8.336,3.416v1.046 h1.046V3.416H8.336z" />
  </svg>
);

const SYMBOLS: Record<string, SymbolMeta> = {
  spend: { label: "Spend", svg: SPEND_ICON },
  "spend icon": { label: "Spend", svg: SPEND_ICON },
  "spend icon filled": { label: "Spend", svg: SPEND_ICON },
  play: { label: "Play", color: "#fcee17", scale: 1.5 },
  "go-solo": { label: "Go Solo", color: "#fcee17", scale: 1.5 },
  "go solo": { label: "Go Solo", color: "#fcee17", scale: 1.5 },
  attack: { label: "Attack", color: "#33a94c", scale: 1.5 },
  blocker: { label: "Blocker", color: "#ed3193", scale: 1.5 },
  quick: { label: "Quick", color: "#ed3193", scale: 1.5 },
  adrenaline: { label: "Adrenaline", color: "#fcee17", scale: 1.5 },
  call: { label: "Call", color: "#fcee17", scale: 1.5 },
  defeated: { label: "Defeated", color: "#ed1c2a", scale: 1.5 },
  star: { label: "Star" },
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function lookupSymbol(raw: string): SymbolMeta | null {
  const key = normalizeKey(raw);
  return SYMBOLS[key] ?? SYMBOLS[key.replace(/\s+/g, "-")] ?? null;
}

function EddiesMark() {
  return (
    <span
      className="mx-0.5 inline-flex translate-y-[-0.05em] items-center rounded-[2px] border border-yellow/70 bg-yellow/15 px-1 font-mono text-[0.78em] font-semibold leading-none text-yellow"
      title="Eddies"
    >
      €$
    </span>
  );
}

function SymbolChip({ raw }: { raw: string }) {
  const meta = lookupSymbol(raw);
  if (meta?.svg) {
    return (
      <span
        className="mx-0.5 inline-flex translate-y-[-0.08em] items-center text-foreground"
        title={meta.label}
        aria-label={meta.label}
      >
        {meta.svg}
      </span>
    );
  }

  const label = meta?.label ?? raw.trim();
  const color = meta?.color ?? "var(--cyan)";
  return (
    <span
      className="mx-0.5 inline-flex translate-y-[-0.06em] items-center rounded-[2px] border px-1.5 py-[0.12em] font-mono text-[0.72em] font-semibold uppercase tracking-[0.08em] leading-none"
      style={{ color, borderColor: color }}
      title={label}
    >
      {label}
    </span>
  );
}

function BracketChip({ raw }: { raw: string }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-[-0.05em] items-center rounded-[2px] border border-cyan/45 bg-cyan/10 px-1.5 py-[0.1em] font-mono text-[0.72em] font-semibold uppercase tracking-[0.1em] leading-none text-cyan">
      {raw}
    </span>
  );
}

function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;

  for (let match = TOKEN_RE.exec(text); match; match = TOKEN_RE.exec(text)) {
    if (match.index > last) {
      nodes.push(<span key={`t${key++}`}>{text.slice(last, match.index)}</span>);
    }

    if (match[0] === "€$") {
      nodes.push(<EddiesMark key={`e${key++}`} />);
    } else if (match[1] != null || match[2] != null) {
      nodes.push(<SymbolChip key={`s${key++}`} raw={match[1] ?? match[2]} />);
    } else if (match[3] != null) {
      nodes.push(<BracketChip key={`b${key++}`} raw={match[3]} />);
    } else {
      nodes.push(<span key={`r${key++}`}>{match[0]}</span>);
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(<span key={`t${key++}`}>{text.slice(last)}</span>);
  }

  return nodes;
}

function choiceOptions(line: string) {
  return line
    .split(/\s*\/\/\s*/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function renderRulesBody(text: string): ReactNode[] {
  const lines = text.split(/\n/);
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) {
      blocks.push(<div key={`sp${index}`} className="h-2" />);
      continue;
    }

    if (line.includes("//")) {
      const options = choiceOptions(line);
      if (options.length > 1) {
        blocks.push(
          <ul key={`opt${index}`} className="my-1 ml-4 list-none space-y-1">
            {options.map((option, optionIndex) => (
              <li key={optionIndex} className="flex gap-2">
                <span className="shrink-0 text-cyan" aria-hidden="true">
                  -
                </span>
                <span className="min-w-0">{renderRichText(option)}</span>
              </li>
            ))}
          </ul>,
        );
        continue;
      }
    }

    blocks.push(
      <p key={`ln${index}`} className="whitespace-pre-wrap">
        {renderRichText(line)}
      </p>,
    );
  }

  return blocks;
}

export function RulesText({
  text,
  label = "Texte de règles",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    <section className={`hud-panel ${compact ? "p-3" : "p-4 sm:p-5"}`} aria-label={label}>
      <h3 className="hud-label">{label}</h3>
      <div className={`space-y-1 text-sm leading-relaxed text-[#c4cede] ${compact ? "mt-2" : "mt-3"}`}>
        {renderRulesBody(trimmed)}
      </div>
    </section>
  );
}
