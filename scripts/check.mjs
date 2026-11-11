// Vérification rapide : typecheck, lint et tests unitaires en parallèle.
// Sortie courte : une ligne par étape, et la fin de la sortie des seules étapes en échec.
// Usage : npm run check
import { spawn } from "node:child_process";

const STEPS = [
  ["typecheck", "npx tsc --noEmit"],
  ["lint", "npx eslint --quiet"],
  ["tests unitaires", "npx vitest run --project unit"],
];

function run([name, command]) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, env: { ...process.env, FORCE_COLOR: "0" } });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ name, code, output, seconds: ((Date.now() - started) / 1000).toFixed(1) }));
  });
}

const results = await Promise.all(STEPS.map(run));
for (const { name, code, seconds } of results) console.log(`${code === 0 ? "✓" : "✗"} ${name} (${seconds} s)`);
for (const { name, code, output } of results.filter((result) => result.code !== 0)) {
  console.log(`\n── ${name} ──\n${output.trim().split("\n").slice(-60).join("\n")}`);
}
process.exit(results.some((result) => result.code !== 0) ? 1 : 0);
