import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// next-intl importe « next/navigation » sans extension : traité par Vite plutôt que par Node.
const server = { deps: { inline: ["next-intl"] } };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          server,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          server,
          // Refuse toute base qui n'est pas un fichier SQLite local (cf. CLAUDE.md).
          setupFiles: ["tests/setup/local-db-only.ts"],
          // Une seule base SQLite partagée : les fichiers s'exécutent l'un après l'autre.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
