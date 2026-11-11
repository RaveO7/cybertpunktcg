import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Règles qui lisent les types : elles attrapent les bugs que le typecheck laisse passer
// (promesse oubliée, `switch` incomplet, conversion inutile). Lentes (programme TypeScript complet) :
// ESLINT_FAST=1 les saute pour le lint après chaque modification ; le hook de fin de tâche, `npm run lint`
// et la CI les appliquent.
const typedRules = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...(process.env.ESLINT_FAST === "1" ? [] : [typedRules]),
  {
    rules: {
      eqeqeq: ["error", "smart"],
      // Avertit seulement que le React Compiler sauterait le composant (TanStack Virtual) : le compilateur n'est pas activé.
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  // Code de l'application : pas de console.log oublié (les scripts et tests en ont besoin).
  {
    files: ["src/**"],
    rules: { "no-console": ["error", { allow: ["info", "warn", "error"] }] },
  },
  // Requêtes en base uniquement dans src/lib : routes, pages et composants appellent une fonction de lib.
  // Passer le client à une fonction de lib (`loadTournament(prisma, id)`) reste permis.
  {
    files: ["src/app/**", "src/components/**", "src/proxy.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='prisma']",
          message: "Requête Prisma seulement dans src/lib : appeler une fonction de lib.",
        },
      ],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@prisma/client", message: "Prisma seulement dans src/lib.", allowTypeImports: true }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Builds du serveur de test Playwright (NEXT_DIST_DIR) et sorties des tests e2e.
    ".next-e2e/**",
    ".next-e2e-prod/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
