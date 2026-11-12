// Attend le déploiement Vercel d'un commit (preview d'une branche poussée, ou production après fusion) et
// affiche son URL. Code de sortie 1 si le build échoue (les logs sont alors affichés), 2 si rien n'apparaît.
//
//   node scripts/wait-deploy.mjs [sha|HEAD] [--prod]
import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const ref = args.find((arg) => !arg.startsWith("--")) ?? "HEAD";
const sha = execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
const vercel = (list) => spawnSync("vercel", list, { encoding: "utf8", shell: true });

let url = null;
for (let attempt = 0; attempt < 40 && !url; attempt += 1) {
  const filters = ["ls", "--meta", `githubCommitSha=${sha}`, ...(prod ? ["--environment", "production"] : [])];
  url = (vercel(filters).stdout ?? "").match(/https:\/\/\S+\.vercel\.app/)?.[0] ?? null;
  if (!url) await sleep(15_000);
}
if (!url) {
  console.error(`Aucun déploiement ${prod ? "de production " : ""}trouvé pour ${sha} après 10 min.`);
  process.exit(2);
}
console.log(`Déploiement : ${url}`);
const inspect = vercel(["inspect", url, "--wait", "--timeout", "20m"]);
const status = `${inspect.stdout}\n${inspect.stderr}`.match(/status\s+●\s+(\w+)/)?.[1] ?? "inconnu";
console.log(`État : ${status}`);
if (status !== "Ready") {
  console.log(vercel(["inspect", url, "--logs"]).stdout?.split("\n").slice(-60).join("\n"));
  process.exit(1);
}
