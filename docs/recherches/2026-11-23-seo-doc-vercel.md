# SEO dans la doc Vercel : domaines, robots, rendu, IA (2026-11-23)

Complète `2026-11-22-audit-seo.md` (côté Google). Sources : doc, KB, blog et changelog de Vercel uniquement. Contrôles faits sur la production le même jour.

## Ce que le site respecte déjà (vérifié sur la prod)

| Point Vercel | Ce que dit Vercel | État du site |
|---|---|---|
| Rendu serveur pour les crawlers IA | « none of the major AI crawlers currently render JavaScript » (déc. 2024) ; SSR/SSG/ISR recommandés | fiche carte demandée avec l'agent `GPTBot` : nom, coût, puissance, texte de règles, affiliations, prix, impressions, cartes liées, tout dans le HTML sans JS |
| Vraies 404 | les agents et Google ont besoin d'un 404, pas d'un 200 | carte inexistante → 404, aussi pour `ClaudeBot` |
| Pas de blocage des bons robots | Bot Protection « Off » et AI Bots « Allow » par défaut ; les bots vérifiés (Googlebot, Bingbot) sont exclus de l'évaluation, même en Attack Mode | aucune règle de pare-feu ; `GPTBot` reçoit la page en 200 |
| Deployment Protection | protège les previews (et pose `X-Robots-Tag: noindex`), ne doit pas couvrir la prod | prod en 200, sans `X-Robots-Tag` |
| Slash final | `trailingSlash` non défini = « not recommended » (doublons possibles) | `/fr/cards/` → **308** vers `/fr/cards` (Next le fait déjà) |
| Cache | ISR sert la page en cache et la régénère en arrière-plan | `X-Vercel-Cache: HIT` sur `/fr` |
| Optimisation d'images (quota Hobby : 5 000 transformations/mois, puis 402) | — | sans objet : le site n'utilise pas `next/image`, aucune URL `/_next/image` |

## Ce que Google fait du JavaScript (étude Vercel + MERJ, juil. 2024)

- Google rend 100 % des pages HTML testées (nextjs.org) ; délai de rendu médian 10 s, P90 ~3 h, P99 ~18 h. « Most pages are rendered within minutes, not days or weeks. »
- Un `noindex` ajouté côté client « is not effective » : il doit être dans le HTML serveur (c'est le cas : `generateMetadata`).
- Les liens des pages rendues sont découverts quel que soit le mode de rendu ; un sitemap à jour réduit l'écart.

## À faire le jour où le site a un domaine propre

(Point 3 de l'audit du 22 novembre.)

1. Vercel recommande **`www` comme domaine principal** et l'apex redirigé vers lui (« We recommend using the www subdomain as your primary domain »), car l'apex ne peut pas être un CNAME.
2. La redirection apex ↔ www créée depuis le tableau de bord est un **307 temporaire** : la remplacer par une règle permanente.
3. Rediriger `cybertpunktcg.vercel.app` vers le domaine avec `redirects` dans `vercel.json`, `has: [{ type: "host", value: "cybertpunktcg\\.vercel\\.app" }]`, `permanent: true` (→ **308**). Les previews ne sont pas concernées.
4. 301 ou 308 : « Google treats 301 and 308 as permanent redirect signals; choosing 308 adds no SEO benefit » (KB, 2026-11-18). Garder le 308 par défaut.
5. Garder les redirections au moins un an, sans chaîne (redirection directe vers l'URL finale), 404/410 quand une page n'a pas de remplaçante (KB « Six enterprise redirect antipatterns »).
6. Les redirections de `vercel.json` passent avant `proxy.ts` et n'invoquent aucune fonction (ordre : WAF → bulk redirects → règles du projet → config du déploiement → Proxy) : les mettre là plutôt que dans le proxy. Les « bulk redirects » sont réservés au plan Pro.

## Visibilité dans les IA (pistes, aucune urgente)

| Piste | Ce qu'en dit Vercel | Avis pour ce site |
|---|---|---|
| Observability › **AI Traffic** (oct. 2026) | requêtes par bot IA, pages les plus explorées, erreurs, requêtes Markdown | à regarder en premier : dit si GPTBot/ClaudeBot/PerplexityBot explorent les fiches et s'ils tombent sur des 404 (34 % de 404 chez ChatGPT et Claude dans l'étude de 2024) |
| Pare-feu : laisser passer les **AI Assistants** et robots de recherche IA | les catégories AI Crawlers (entraînement) et AI Assistants se règlent séparément ; `oai-searchbot`, `claude-searchbot`, `perplexitybot` indexent pour la recherche | ne rien bloquer aujourd'hui ; si un jour on bloque l'entraînement, bloquer seulement « AI Crawlers » (déduction des catégories, pas une consigne Vercel) |
| `llms.txt` | index court et décrit, atteint dans 86 % des visites d'agents attribuées (KB, août 2026, 25 sites) | utile mais non prouvé pour la citation ; un index par langue des pages principales (cartes, decks) suffirait |
| Markdown par négociation (`Accept: text/markdown`, `.md` par page) | les agents demandent du Markdown dans 65 % des cas ; poser `Vary: Accept` et `Link: <URL>; rel="canonical"` vers la page HTML | gain incertain, risque de doublons × 5 langues : pas avant d'avoir vu l'AI Traffic |
| Contenu « write for extraction », JSON-LD, titres H1→H2→H3 | blog juin 2025 (ChatGPT ≈ 10 % des inscriptions Vercel) | déjà en place (JSON-LD, hiérarchie) ; aucun chiffre Vercel sur l'effet du JSON-LD |

## Outils Vercel et plan Hobby

- **Speed Insights** : gratuit sur Hobby, mais seulement le score global (RES) ; les Core Web Vitals détaillés demandent Pro. Les données de terrain de Google (CrUX, Search Console) restent la référence pour le classement.
- **Firewall › Traffic** : montre le trafic des bots vérifiés sur tous les plans ; le détail par bot (`bot_name`) est réservé aux projets Pro « Priority ».
- Rien n'est documenté par Vercel sur l'indexation des images servies par `/_next/image` ni sur l'effet SEO du rendu statique contre dynamique (TTFB).

## Sources (Vercel, officielles)

| Page | Date |
|---|---|
| [Adding & Configuring a Custom Domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain) | MAJ 2026-09-16 |
| [Deploying & Redirecting Domains](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) | MAJ 2026-08-11 |
| [Redirects](https://vercel.com/docs/routing/redirects) · [Bulk Redirects](https://vercel.com/docs/routing/redirects/bulk-redirects) | MAJ 2026-09 |
| [vercel.json (`trailingSlash`, `cleanUrls`, `redirects`)](https://vercel.com/docs/project-configuration/vercel-json) | MAJ 2026-08-14 |
| [Six enterprise redirect antipatterns](https://vercel.com/kb/fde/six-enterprise-redirect-antipatterns) | 2026-11-18 |
| [Bot Management](https://vercel.com/docs/bot-management) · [WAF Managed Rulesets](https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets) | MAJ 2026-09-10 |
| [Bloquer crawlers et assistants IA séparément (changelog)](https://vercel.com/changelog/block-ai-crawlers-and-assistants-independently-with-managed-rules) | — |
| [BotID : bots vérifiés](https://vercel.com/docs/botid/verified-bots) | 2026-02-26 |
| [How Google handles JavaScript (MERJ)](https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process) | 2024-07-31 |
| [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) | 2024-12-17 |
| [How we're adapting SEO for LLMs and AI search](https://vercel.com/blog/how-were-adapting-seo-for-llms-and-ai-search) | 2025-06-10 |
| [Agent-friendly pages with content negotiation](https://vercel.com/blog/making-agent-friendly-pages-with-content-negotiation) | 2026-02-03 |
| [Markdown and Agent Discovery](https://vercel.com/docs/agent-resources/markdown-access) | MAJ 2026-09-17 |
| [Make your documentation readable by AI agents (KB)](https://vercel.com/kb/guide/make-your-documentation-readable-by-ai-agents) | 2026-08-28 |
| [AI traffic insights in Observability (changelog)](https://vercel.com/changelog/ai-traffic-insights-now-available-in-vercel-observability) | 2026-10-28 |
| [Speed Insights : limites et prix](https://vercel.com/docs/speed-insights/limits-and-pricing) | MAJ 2026-09-23 |
| [Image Optimization : limites et prix](https://vercel.com/docs/image-optimization/limits-and-pricing) | MAJ 2026-11-12 |
| [bots.fyi](https://bots.fyi) (annuaire des bots vérifiés de Vercel) | — |

Points non confirmés : comportement JS récent des crawlers d'OpenAI (l'étude date de 2024) ; plan du projet (Hobby supposé) ; nombre maximal de redirections dans `vercel.json`.
