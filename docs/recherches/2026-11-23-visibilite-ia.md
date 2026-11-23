# Visibilité dans les moteurs de réponse IA (2026-11-23)

Complète `2026-11-22-audit-seo.md` (Google) et `2026-11-23-seo-doc-vercel.md` (Vercel). Sources : doc officielle d'OpenAI, Anthropic, Perplexity, Google et Microsoft ; études publiées (académiques et éditeurs d'outils SEO) ; écosystème du jeu.

## En bref

- Être cité passe d'abord par **être exploré et indexé** : chaque moteur a son robot de recherche, distinct de celui d'entraînement. Le `robots.txt` du site (`User-Agent: * / Allow: /`) les autorise tous.
- Aucune étude sérieuse ne montre que `llms.txt` ou le JSON-LD font gagner des citations : **ne pas en faire une priorité**.
- Les IA citent peu le top Google (~12 % de chevauchement) et beaucoup Wikipedia, YouTube, Reddit : **être mentionné ailleurs** compte autant que la page elle-même.
- Mesure gratuite possible : Search Console (clics IA inclus, non séparés), **Bing Webmaster Tools** (citations Copilot), référents de Vercel Web Analytics (déjà installé).

## Quel robot pour quel moteur (doc officielle)

| Moteur | Robot de recherche (citation) | Robot d'entraînement | Index et exigences | Mesure fournie |
|---|---|---|---|---|
| ChatGPT | `OAI-SearchBot` : un site qui le bloque « will not be shown in ChatGPT search answers » ; `ChatGPT-User` (action d'un utilisateur, « robots.txt rules may not apply ») | `GPTBot`, réglage indépendant | index non documenté ; prise en compte du robots.txt « ~24 hours » | aucune |
| Claude | `Claude-SearchBot` (bloquer « may reduce your site's visibility »), `Claude-User` | `ClaudeBot` | non documenté ; les trois respectent robots.txt | aucune |
| Perplexity | `PerplexityBot` (« surface and link websites »), `Perplexity-User` (« generally ignores robots.txt ») | aucun distinct | non documenté | aucune |
| Google AI Overviews / AI Mode | `Googlebot` (pas de robot dédié) | `Google-Extended` (n'affecte pas la Recherche) | index Google ; « no additional requirements » : page indexée et éligible à un extrait | Search Console : clics comptés dans « Web », non séparés |
| Copilot / Bing | `Bingbot` | non documenté | index Bing ; IndexNow « helps keep information fresh across search and AI experiences » | Bing Webmaster Tools › **AI Performance** (préversion gratuite, févr. 2026) : citations, pages citées, requêtes ; pas de clics |

État du site : aucun de ces robots n'est bloqué (robots.txt, pare-feu Vercel), les fiches sont complètes sans JavaScript (contrôle du jour avec `GPTBot`).

## Ce que disent les études

| Sujet | Résultat | Source, fiabilité |
|---|---|---|
| Techniques de rédaction | jusqu'à +40 % de visibilité en ajoutant sources, statistiques, citations (benchmark de laboratoire) | GEO, Aggarwal et al., KDD 2024 — académique, ancien, non reproduit sur les moteurs actuels |
| Rang Google ↔ citation | ~12 % des citations IA dans le top 10 Google (Perplexity 28,6 %, ChatGPT/Gemini/Copilot ~8 %) ; Seer : part des citations AI Overviews venant du top 10 tombée de 76 % à 38 % | Ahrefs (août 2025, 15 000 requêtes), Seer — éditeurs d'outils |
| JSON-LD | ajout de schema sur 1 885 pages, 30 jours : AI Overviews −4,6 %, AI Mode +2,4 % et ChatGPT +2,2 % (non significatifs) | Ahrefs, mai 2026 — éditeur, méthode publiée |
| `llms.txt` | 97 % des ~38 000 fichiers valides n'ont reçu aucune requête ; aucun lien adoption ↔ citations (300 000 domaines) ; Google (Mueller) : aucun service IA n'a dit l'utiliser | Ahrefs (juin 2026), SE Ranking — éditeurs |
| Sources les plus citées | Wikipedia en tête sur ChatGPT et Perplexity ; AI Overviews : YouTube ~21 %, Reddit ~20 % ; la part de Reddit dans ChatGPT varie fortement d'un mois à l'autre | Ahrefs 2025-2026 — éditeur |
| Trafic venant des IA | ~0,3 % du trafic des sites, dont ~75 % ChatGPT | SE Ranking 2026 — éditeur |
| Effet des AI Overviews sur les clics | −38 % de clics sortants (essai randomisé, 1 065 personnes) ; −58 % de CTR en position 1 (Ahrefs) ; Seer voit au contraire une remontée en 2026 | ISB/CMU 2026 — académique (working paper) ; Ahrefs, Seer — contradictoires |

Les sites et études se contredisent souvent et les moteurs changent vite : tout chiffre de plus de six mois est indicatif.

## Le jeu : qui est cité aujourd'hui

- Aucune étude publiée sur les sources citées pour les jeux de cartes (Magic, Pokémon, Lorcana…) ni pour Cyberpunk TCG.
- Écosystème visible : site officiel cyberpunktcg.com (base de cartes et deck builder de Netdeck.gg), Discord officiel, blog Gamertag Mythras, podcast Cardrunners. Pas de wiki communautaire, de subreddit actif, ni de fiche BoardGameGeek/Wikidata trouvés pour le jeu.
- Conséquence : peu de concurrence tierce. Une page qui donne une **donnée introuvable ailleurs** (prix et historique de prix, impression française, statistiques de decks) est ce qu'une IA a le plus de raisons de citer.

## À faire, par ordre de coût/effet

1. **Search Console** (déjà point 1 de l'audit du 22/11) : seul moyen de voir l'indexation Google, donc l'éligibilité aux AI Overviews.
2. **Bing Webmaster Tools** (gratuit, import possible depuis Search Console) : sitemap envoyé à Bing, qui alimente Copilot, et rapport AI Performance. Aucune trace dans le dépôt d'une vérification Bing (balise ou fichier).
3. **Regarder les référents** dans Vercel Web Analytics (déjà installé) : `chatgpt.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com`. Sur Hobby, pas d'UTM ; le référent de domaine suffit. Côté robots : Observability › Edge Requests montre les bots sur tous les plans (le détail par bot demande Observability Plus).
4. **Se faire mentionner** : listes d'outils du Discord officiel, blogs de fans, Reddit du jeu, sans spam. Effet indirect mais le plus probable.
5. **Donnée propre visible** sur les fiches (historique de prix, raretés, decks qui jouent la carte) : même chantier que le point 2 de l'audit du 22/11, utile pour Google et pour les IA.
6. **IndexNow** (optionnel) : prévient Bing à chaque nouvelle carte ou mise à jour de prix ; faible coût, effet non mesuré.

À ne pas faire maintenant : `llms.txt`, version Markdown des pages, JSON-LD supplémentaire « pour les IA », outils payants de suivi des citations (Otterly ~29 $/mois, Peec ~95 $/mois, Profound sur devis) : effet non démontré ou coût disproportionné pour le trafic actuel.

## Sources

### Officielles
- [OpenAI : Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) (non datée)
- [Anthropic : About Anthropic crawler](https://support.claude.com/en/articles/8896518-about-anthropic-crawler) (non datée)
- [Perplexity : Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) (non datée)
- [Google Search Central : AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) (non datée)
- [Google : rapport Performances et AI Overviews/AI Mode](https://support.google.com/webmasters/answer/7042828)
- [Bing : AI Performance in Bing Webmaster Tools](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview) (10/02/2026)
- [Vercel : Web Analytics, limites et prix](https://vercel.com/docs/analytics/limits-and-pricing) (MAJ 25/08/2026)

### Études
- [GEO : Generative Engine Optimization (arXiv 2311.09735)](https://arxiv.org/abs/2311.09735) (KDD 2024)
- [Ahrefs : chevauchement recherche IA / Google](https://ahrefs.com/blog/ai-search-overlap/) (11/08/2025)
- [Ahrefs : étude llms.txt](https://ahrefs.com/blog/llmstxt-study/) (06/2026)
- [SEJ : le schema n'a pas fait bouger les citations IA (test Ahrefs)](https://www.searchenginejournal.com/schema-markup-didnt-move-ai-citations-in-ahrefs-test/574568/) (11/05/2026)
- [Ahrefs : domaines les plus cités par les assistants IA](https://ahrefs.com/blog/top-10-most-cited-domains-ai-assistants) (06/2025)
- [SEJ : AI Overviews −38 % de clics (essai ISB/CMU)](https://www.searchenginejournal.com/ai-overviews-cut-organic-clicks-38-field-study-finds/573145/) (2026)
- [Ahrefs : AI Overviews et clics](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) (02/2026) · [Seer : CTR des AI Overviews 2026](https://seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- [SE Ranking : trafic venant des IA](https://seranking.com/blog/ai-traffic-study/) (2026)
- [The Decoder : étude Bochum / Max Planck sur les sources des chatbots](https://the-decoder.com/ai-chatbots-use-different-sources-than-google-search-and-often-cite-less-known-websites/) (26/10/2025)

Non confirmé : en-têtes `Referer` réels des moteurs IA (aucune doc officielle) ; disponibilité de l'AI Traffic de Vercel sur Hobby ; présence actuelle du site dans l'index Bing (requête `site:` bloquée par Bing côté script).
