# Google Search Console : quoi regarder, quand, et quoi en faire (2026-11-24)

Complète `2026-11-22-audit-seo.md` (point 1 : Search Console). Propriété créée le 24/11 : **préfixe d'URL** `https://cybertpunktcg.vercel.app/` (balise meta `google-site-verification` présente sur toutes les pages), sitemap `sitemap.xml` envoyé. La propriété de domaine est impossible sur `vercel.app` (pas d'accès au DNS).

Sources : aide Search Console et blog Google Search Central. Les pages d'aide n'affichent aucune date de mise à jour (« ©2026 Google ») ; plusieurs ont été lues seulement par extrait de recherche (signalé « extrait »).

## Calendrier

| Quand | Où | Quoi vérifier |
|---|---|---|
| Jour même | Sitemaps | statut « Opération effectuée », ~800 URL découvertes. « Impossible de récupérer » : Google réessaie quelques jours (causes : robots.txt, 404, erreur serveur) |
| 1re semaine | Inspection d'URL sur 3-4 pages types (`/fr`, `/fr/cards`, une fiche carte en fr et en de) | page indexable, canonical déclarée = canonical choisie par Google, rendu complet |
| 2 à 4 semaines | Indexation des pages | répartition indexées / non indexées et motifs (tableau ci-dessous) |
| Ensuite, chaque mois | Performances, Insights | pages et requêtes en hausse/baisse, pages à fort nombre d'impressions et CTR faible |
| Si chute brutale | Actions manuelles, Problèmes de sécurité | sanction ou piratage signalé |

La doc ne donne **aucun délai global** avant des chiffres stables. Les données d'indexation d'une nouvelle page arrivent en « jusqu'à une semaine ».

## Inspection d'URL

- Montre la dernière version explorée, la canonical déclarée face à celle choisie par Google (sur la version indexée seulement, pas sur le test en ligne), le HTML et la capture du rendu.
- **Demander l'indexation** : pour une page nouvelle ou corrigée, après un test en ligne réussi. Quota quotidien non publié ; délai « un ou deux jours, parfois plus », sans garantie. Pour beaucoup de pages, c'est le sitemap avec `lastmod` qui compte (déjà en place) : ne pas demander l'indexation des 800 URL une par une.

## Rapport « Indexation des pages » : lecture pour ce site

| Statut | Signification (doc Google) | Attendu ici ? | Action |
|---|---|---|---|
| Page avec redirection | URL qui redirige | **oui** : `/` → `/en` (308), `/fr/cards/` → `/fr/cards` | aucune |
| Exclue par la balise « noindex » | noindex lu | **oui** : pages privées (collection, decks, paramètres…) | aucune, sauf si une page publique y figure |
| Autre page avec balise canonique correcte | doublon qui pointe bien vers sa canonical | possible (paramètres d'URL) | aucune |
| Page en double sans URL canonique sélectionnée par l'utilisateur | Google a regroupé des doublons sans canonical | ne devrait pas arriver (canonical sur toutes les pages publiques) | si présent : vérifier l'URL |
| Google a choisi une autre URL canonique | Google ignore la canonical déclarée | **à surveiller** : fiches très semblables d'une langue à l'autre | comparer les canonicals ; différencier le contenu |
| Détectée, actuellement non indexée | exploration reportée | probable au début sur ~750 fiches neuves | attendre ; aucune action précisée par Google |
| Explorée, actuellement non indexée | explorée, jugée pas assez utile pour l'index | **le signal clé** pour les fiches cartes | si massif et durable : enrichir les fiches (point 2 de l'audit du 22/11) |
| Soft 404 | page « vide » servie en 200 | ne devrait pas (vraies 404) ; risque si une fiche paraît vide | vrai 404 ou contenu |

**Valider la correction** : seulement après une vraie correction d'un statut ; validation « généralement deux semaines environ, mais parfois beaucoup plus ».

## Performances et Insights

- **Agrégation** : graphique par propriété ; tableau par page pour Pages et Apparence, par propriété pour Requêtes, Pays, Appareils, Dates (les totaux diffèrent).
- **Requêtes anonymisées** : celles tapées par « quelques dizaines d'utilisateurs » sur 2-3 mois sont exclues du tableau ; un filtre par requête les exclut aussi. Sur un petit site, beaucoup de requêtes seront invisibles.
- Données récentes « préliminaires » (vue 24 h disponible) ; conservation 16 mois (source secondaire, non confirmé sur la page Google).
- Export : 1 000 lignes depuis l'interface ; API/Looker Studio jusqu'à 50 000 lignes par jour.
- **Repérer les pages à améliorer** : filtrer par page, trier par impressions, chercher un CTR faible en position 5-20, regarder leurs requêtes (méthode usuelle, pas une consigne Google).
- Nouveautés : rapport **Insights** (juin 2025 : pages et requêtes en hausse/baisse, jalons par e-mail) ; **annotations** sur le graphique (nov. 2025, 120 caractères, 200 par propriété, non modifiables) — en poser une à chaque livraison SEO notable ; vues **hebdomadaires/mensuelles** (déc. 2025) ; **rapport IA** (AI Overviews, AI Mode, Discover ; impressions seulement ; annoncé le 03/06/2026, déploiement à partir du 31/08/2026). Les clics venant des fonctions IA restent comptés dans « Web » sans filtre séparé.

## Autres rapports

| Rapport | Utilité ici |
|---|---|
| Core Web Vitals | données CrUX (28 jours, 75e centile : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1). Volume minimal non chiffré : « Aucune donnée » probable tant que le trafic est faible. Lighthouse reste le diagnostic (`2026-11-22-audit-lighthouse.md`) |
| Améliorations (résultats enrichis) | **Fil d'Ariane** encore suivi (BreadcrumbList présent sur liste et fiches). Logo et nom de site ne sont pas des rapports. FAQ plus affichées depuis le 07/05/2026 |
| Statistiques sur l'exploration (Paramètres) | 90 jours d'activité Googlebot (requêtes, temps de réponse, codes HTTP). Utile si les fiches restent « Détectée » : montre si Googlebot explore peu ou tombe sur des erreurs |
| Liens | non vérifié dans cette recherche ; donne les sites qui pointent vers le site (point 4 de l'audit : liens entrants) |
| Actions manuelles, Sécurité | à regarder seulement en cas de chute brutale |
| Suppressions | masquage temporaire (6 mois max) d'une URL ; pas un outil de désindexation durable (utiliser `noindex` ou 404) |
| Ciblage international | **supprimé** (2022 selon la presse ; hreflang toujours pris en charge). Vérifier les hreflang par l'Inspection d'URL ou un contrôle maison (fait sur les 800 URL le 22/11) |
| Ergonomie mobile | **supprimé** le 01/12/2023 |
| Export BigQuery, API | sans intérêt à ce volume (BigQuery facturé au-delà du palier gratuit, export non rétroactif) |

Non recherchés : utilisateurs et autorisations, association Google Analytics, préférences d'e-mail, outil de changement d'adresse (à lire le jour d'un changement de domaine, voir `2026-11-23-seo-doc-vercel.md`).

## À ne pas faire

Demander l'indexation en masse ; cliquer « Valider la correction » sans correction ; tirer des conclusions avant 2 à 4 semaines ; chercher un rapport hreflang ou ergonomie mobile (supprimés).

## Sources

- [Rapport Indexation des pages](https://support.google.com/webmasters/answer/7440203?hl=fr)
- [Outil d'inspection d'URL](https://support.google.com/webmasters/answer/9012289?hl=fr)
- [Rapport Sitemaps](https://support.google.com/webmasters/answer/7451001?hl=fr)
- [Consolider les URL en double](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls?hl=fr)
- [Rapport Performances](https://support.google.com/webmasters/answer/7576553?hl=fr) (page tronquée à la lecture)
- [Blog : données de performance en détail (19/10/2022)](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive?hl=fr)
- [Blog : Search Console Insights (30/06/2025)](https://developers.google.com/search/blog/2025/06/search-console-insights?hl=fr)
- [Blog : annotations (11/2025)](https://developers.google.com/search/blog/2025/11/custom-chart-annotations?hl=fr)
- [Blog : vues hebdomadaires et mensuelles (12/2025)](https://developers.google.com/search/blog/2025/12/weekly-monthly-views-search-console?hl=fr)
- [Blog : rapports de performance de la recherche générative (03/06/2026)](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Blog : retrait de types de résultats enrichis (11/2025)](https://developers.google.com/search/blog/2025/11/update-on-our-efforts?hl=fr)
- [Rapport Core Web Vitals](https://support.google.com/webmasters/answer/9205520?hl=fr) (extrait)
- [Rapport des résultats enrichis](https://support.google.com/webmasters/answer/7552505?hl=en)
- [Statistiques sur l'exploration](https://support.google.com/webmasters/answer/9679690?hl=fr) (extrait)
- [Suppressions](https://support.google.com/webmasters/answer/9689846?hl=fr) (extrait)
- [Ciblage international déprécié](https://support.google.com/webmasters/answer/12474899?hl=en)
- [Export groupé BigQuery](https://support.google.com/webmasters/answer/12917675) (extrait) · [Limites de l'API](https://developers.google.com/webmaster-tools/limits?hl=fr) (extrait)
- [Seuils Core Web Vitals (web.dev)](https://web.dev/articles/defining-core-web-vitals-thresholds?hl=fr) (extrait)
- Secondaire : [SERoundtable, retrait de l'ergonomie mobile (12/2023)](https://seroundtable.com/google-search-consoles-mobile-usability-report-mobile-friendly-tests-are-gone-36497.html)
