// Blocs de référence (français) : TypeScript en dérive le type des messages de toutes les langues.
// Ajouter un bloc : un fichier JSON par langue, et une ligne ici.

import auth from "./auth.json";
import card from "./card.json";
import cards from "./cards.json";
import catalog from "./catalog.json";
import chart from "./chart.json";
import common from "./common.json";
import dashboard from "./dashboard.json";
import decks from "./decks.json";
import errors from "./errors.json";
import filters from "./filters.json";
import footer from "./footer.json";
import geo from "./geo.json";
import header from "./header.json";
import investment from "./investment.json";
import landing from "./landing.json";
import legal from "./legal.json";
import languageSuggestion from "./languageSuggestion.json";
import modal from "./modal.json";
import nav from "./nav.json";
import offline from "./offline.json";
import publicTournaments from "./publicTournaments.json";
import rulesAnatomy from "./rules/anatomy.json";
import rulesDemoMatch from "./rules/demoMatch.json";
import rulesExamples from "./rules/examples.json";
import rulesHowToPlay from "./rules/howToPlay.json";
import rulesTutorial from "./rules/tutorial.json";
import settings from "./settings.json";
import share from "./share.json";
import shops from "./shops.json";
import site from "./site.json";
import tournaments from "./tournaments.json";
import wishlist from "./wishlist.json";

const messages = {
  auth,
  card,
  cards,
  catalog,
  chart,
  common,
  dashboard,
  decks,
  errors,
  filters,
  footer,
  geo,
  header,
  investment,
  landing,
  legal,
  languageSuggestion,
  modal,
  nav,
  offline,
  publicTournaments,
  // Règles, tutoriel et partie guidée : transmis au navigateur seulement sur la page des règles.
  rules: {
    anatomy: rulesAnatomy,
    demoMatch: rulesDemoMatch,
    examples: rulesExamples,
    howToPlay: rulesHowToPlay,
    tutorial: rulesTutorial,
  },
  settings,
  share,
  shops,
  site,
  tournaments,
  wishlist,
};

export default messages;
