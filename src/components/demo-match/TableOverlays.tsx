import type { CSSProperties } from "react";
import type { DemoTableCopy } from "@/lib/rules/demo-match";
import { CONFETTI, FX_COLOR, type Fx } from "./fx";

export function TableOverlays({
  copy,
  fx,
  fxSeq,
  toast,
  rivalTurnActive,
  compact,
}: {
  copy: DemoTableCopy;
  fx: Fx | null;
  fxSeq: number;
  toast: string | null;
  rivalTurnActive: boolean;
  compact: boolean;
}) {
  const fxStyle = { "--dm-fx-color": fx ? FX_COLOR[fx.tone] : FX_COLOR.you } as CSSProperties;
  return (
    <>
      {fx ? (
        <div key={`fx-${fxSeq}`} className="contents" style={fxStyle} aria-hidden>
          {fx.vignette ? <div className="dm-vignette" /> : null}
          {fx.banner ? (
            <div className={`dm-banner ${fx.hold ? "dm-banner--hold" : ""}`}>
              <div className="dm-banner__bar">
                <span className="dm-banner__text">{fx.banner}</span>
                {fx.sub ? <span className="dm-banner__sub">{fx.sub}</span> : null}
              </div>
            </div>
          ) : null}
          {fx.confetti ? (
            <div className="dm-confetti">
              {CONFETTI.map((style, i) => (
                <i key={i} style={style} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <p
          key={toast + fxSeq}
          className="dm-nope absolute top-1 left-1/2 z-30 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 border border-danger/40 bg-black/90 px-2 py-1 text-center text-xs text-danger"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      {rivalTurnActive ? (
        <span className={`absolute top-1 z-20 border ${compact ? "left-1/2 -translate-x-1/2" : "left-1"} border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-danger`}>
          {copy.rivalPhase}
        </span>
      ) : null}
    </>
  );
}
