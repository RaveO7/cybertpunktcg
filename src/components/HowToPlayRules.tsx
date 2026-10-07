"use client";

import { useEffect, useRef, useState } from "react";
import { CardAnatomy } from "@/components/CardAnatomy";
import { PlaymatDiagram } from "@/components/PlaymatDiagram";
import { RulesExampleCard } from "@/components/RulesExampleCard";
import { useI18n } from "@/components/LocaleProvider";
import { anatomyCopy } from "@/lib/rules/card-anatomy";
import { EXAMPLE_CARDS } from "@/lib/rules/examples";
import { howtoPlayContent } from "@/lib/rules/howto-play";

export function HowToPlayRules() {
  const { locale } = useI18n();
  const contentLocale = locale === "fr" ? "fr" : "en";
  const c = howtoPlayContent(contentLocale);
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string>(c.toc[0]?.id ?? "");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let scroller: HTMLElement | null = root.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const target: HTMLElement | Window = scroller ?? window;

    const update = () => {
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      let current = c.toc[0]?.id ?? "";
      for (const item of c.toc) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top - top <= 120) current = item.id;
      }
      if (atBottom && c.toc.length) current = c.toc[c.toc.length - 1].id;
      setActiveId(current);
    };

    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [c.toc]);

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-8 [&_[id]]:scroll-mt-2 lg:[&_[id]]:scroll-mt-0">
      <nav className="flex flex-wrap gap-1.5 border-b border-line pb-2 lg:hidden" aria-label={c.title}>
        {c.toc.map((item) => {
          const active = item.id === activeId;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active ? "location" : undefined}
              className={`shrink-0 whitespace-nowrap border px-2.5 py-1.5 text-xs ${
                active ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="sticky top-0 space-y-1 border border-line bg-panel p-3" aria-label={c.title}>
          <p className="hud-label mb-2 px-2">{c.eyebrow}</p>
          {c.toc.map((item) => {
            const active = item.id === activeId;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                className={`block border-l-2 px-2 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-yellow bg-yellow/10 text-yellow"
                    : "border-transparent text-muted hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 max-w-full flex-1 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl text-yellow sm:text-4xl">{c.title}</h1>
          {c.intro.map((paragraph, index) => (
            <p key={index} className="max-w-3xl text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan hover:text-foreground">
              {c.sourceLabel} ↗
            </a>
            <a href={c.sourcePdfUrl} target="_blank" rel="noreferrer" className="text-cyan hover:text-foreground">
              {c.sourcePdfLabel} ↗
            </a>
          </p>
        </header>

        <section id="victoire" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.win.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{c.win.body}</p>
          <div className="border border-yellow/40 bg-yellow/5 p-4">
            <p className="font-mono text-xs tracking-[0.12em] text-yellow uppercase">{c.win.highlight}</p>
            <p className="mt-2 text-sm text-foreground">{c.win.highlightBody}</p>
          </div>
          <div className="border border-line bg-panel p-4">
            <p className="font-mono text-xs tracking-[0.12em] text-cyan uppercase">{c.win.overtime}</p>
            <p className="mt-2 text-sm text-muted">{c.win.overtimeBody}</p>
          </div>
          <p className="text-sm text-muted">{c.win.deckOut}</p>
        </section>

        <section id="zones" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.areas.title}</h2>
          <PlaymatDiagram areas={c.areas.items} labels={c.playmat} locale={contentLocale} />
        </section>

        <section id="anatomie" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{anatomyCopy(contentLocale).title}</h2>
          <CardAnatomy locale={contentLocale} />
        </section>

        <section id="cartes" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.cardTypes.title}</h2>
          <p className="text-sm italic text-muted">{c.cardTypes.note}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {c.cardTypes.items.map((type) => {
              const card = EXAMPLE_CARDS[type.exampleKey];
              return (
                <article key={type.name} className="flex gap-4 border border-line bg-panel p-4">
                  <RulesExampleCard card={card} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base text-yellow">{type.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{type.body}</p>
                    <p className="mt-3 font-mono text-[0.65rem] tracking-wide text-cyan uppercase">{c.examplesTitle}</p>
                    <p className="mt-1 text-sm text-foreground">{card.name}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="mots-cles" className="scroll-mt-24 space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl text-foreground">{c.triggers.title}</h2>
            <p className="text-sm text-muted">{c.triggers.intro}</p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {c.triggers.items.map((item) => (
                <div key={item.name} className="flex gap-3 border border-line bg-panel px-4 py-3">
                  {item.exampleKey ? <RulesExampleCard card={EXAMPLE_CARDS[item.exampleKey]} size="sm" /> : null}
                  <div>
                    <dt className="font-mono text-xs tracking-[0.1em] text-yellow uppercase">{item.name}</dt>
                    <dd className="mt-1 text-sm text-muted">{item.body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg text-foreground">{c.keywords.title}</h2>
            <p className="text-sm text-muted">{c.keywords.intro}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {c.keywords.items.map((item) => (
                <div key={item.name} className="flex gap-3 border border-line bg-panel px-4 py-3">
                  {item.exampleKey ? (
                    <RulesExampleCard card={EXAMPLE_CARDS[item.exampleKey]} size="sm" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <dt className="font-mono text-xs tracking-[0.1em] text-cyan uppercase">{item.name}</dt>
                    <dd className="mt-1 text-sm text-muted">{item.body}</dd>
                    {item.exampleKey ? (
                      <p className="mt-2 text-xs text-foreground">{EXAMPLE_CARDS[item.exampleKey].name}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="mise-en-place" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.setup.title}</h2>
          <p className="text-sm text-muted">{c.setup.intro}</p>
          <ol className="space-y-3">
            {c.setup.steps.map((step) => (
              <li key={step.title} className="border border-line bg-panel p-4">
                <p className="font-mono text-xs tracking-[0.12em] text-yellow uppercase">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="tour" className="scroll-mt-24 space-y-6">
          <div>
            <h2 className="text-xl text-foreground">{c.turn.title}</h2>
            <p className="mt-2 text-sm text-muted">{c.turn.intro}</p>
          </div>
          <div className="space-y-3">
            <h3 className="text-base text-cyan">{c.turn.startTitle}</h3>
            <ol className="space-y-2">
              {c.turn.startSteps.map((step, index) => (
                <li key={step.title} className="flex gap-3 border border-line bg-panel p-4">
                  <span className="font-mono text-yellow">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-sm text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-3">
            <h3 className="text-base text-cyan">{c.turn.mainTitle}</h3>
            <p className="text-sm text-muted">{c.turn.mainIntro}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {c.turn.mainActions.map((action) => (
                <article key={action.title} className="border border-line bg-panel p-4">
                  <h4 className="text-sm text-yellow">{action.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{action.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="attaque" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.attack.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{c.attack.intro}</p>
          <ol className="space-y-2">
            {c.attack.steps.map((step) => (
              <li key={step.title} className="border border-line bg-panel p-4">
                <p className="font-mono text-xs tracking-[0.12em] text-yellow uppercase">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="space-y-3">
            <h3 className="text-base text-cyan">{c.attack.reactTitle}</h3>
            <p className="text-sm text-muted">{c.attack.reactIntro}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {c.attack.reactions.map((reaction) => (
                <article key={reaction.title} className="border border-line bg-panel p-4">
                  <h4 className="text-sm text-foreground">{reaction.title}</h4>
                  <p className="mt-2 text-sm text-muted">{reaction.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <article className="border border-line bg-panel p-4">
              <h3 className="text-base text-yellow">{c.attack.fightTitle}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {c.attack.fightBody.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-cyan" aria-hidden="true">
                      ›
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-line pt-4">
                <p className="font-mono text-xs tracking-[0.12em] text-cyan uppercase">{c.fightExample.title}</p>
                <p className="mt-2 text-sm text-muted">{c.fightExample.body}</p>
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <div>
                    <p className="mb-1 text-[0.65rem] text-muted">{c.fightExample.attackerLabel}</p>
                    <RulesExampleCard card={EXAMPLE_CARDS.unitJackie} size="md" />
                  </div>
                  <span className="pb-10 font-mono text-yellow">VS</span>
                  <div>
                    <p className="mb-1 text-[0.65rem] text-muted">{c.fightExample.defenderLabel}</p>
                    <div className="opacity-90">
                      <RulesExampleCard card={EXAMPLE_CARDS.unitBlocker} size="md" label="spent" />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">{c.fightExample.outcome}</p>
              </div>
            </article>
            <article className="border border-line bg-panel p-4">
              <h3 className="text-base text-yellow">{c.attack.stealTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.attack.stealBody}</p>
              <ul className="mt-3 space-y-1 font-mono text-xs text-cyan">
                {c.attack.stealTiers.map((tier) => (
                  <li key={tier}>{tier}</li>
                ))}
              </ul>
              <div className="mt-4 flex gap-4 border-t border-line pt-4">
                <RulesExampleCard card={EXAMPLE_CARDS.unitSmasher} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs tracking-[0.12em] text-cyan uppercase">{c.stealExample.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{c.stealExample.body}</p>
                  <p className="mt-2 text-xs text-foreground">{EXAMPLE_CARDS.unitSmasher.name}</p>
                </div>
              </div>
            </article>
          </div>
          <p className="border border-line bg-panel-2 p-4 text-sm leading-relaxed text-muted">{c.attack.tip}</p>
        </section>

        <section id="deck" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl text-foreground">{c.deckbuilding.title}</h2>
          <p className="text-sm text-muted">{c.deckbuilding.intro}</p>
          <ul className="space-y-2">
            {c.deckbuilding.rules.map((rule) => (
              <li key={rule} className="flex gap-2 border border-line bg-panel px-4 py-3 text-sm text-muted">
                <span className="text-yellow" aria-hidden="true">
                  ▸
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div className="border border-line bg-panel p-4">
            <h3 className="font-mono text-xs tracking-[0.12em] text-cyan uppercase">{c.deckbuilding.ramTitle}</h3>
            {c.deckbuilding.ramBody.map((paragraph, index) => (
              <p key={index} className="mt-2 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            <div className="mt-4 flex flex-wrap gap-3">
              <RulesExampleCard card={EXAMPLE_CARDS.legendJackie} size="sm" note="Jackie" />
              <RulesExampleCard
                card={{
                  ...EXAMPLE_CARDS.legendJohnny,
                  noteFr: "Johnny",
                  noteEn: "Johnny",
                }}
                size="sm"
                note="Johnny"
              />
              <RulesExampleCard card={EXAMPLE_CARDS.legendJudy} size="sm" note="Judy" />
            </div>
          </div>
        </section>

        <section id="glossaire" className="scroll-mt-24 space-y-4 pb-8">
          <h2 className="text-xl text-foreground">{c.glossary.title}</h2>
          <dl className="divide-y divide-line border border-line">
            {c.glossary.items.map((item) => (
              <div key={item.term} className="grid gap-1 bg-panel px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs tracking-[0.08em] text-yellow uppercase">{item.term}</dt>
                <dd className="text-sm leading-relaxed text-muted">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
