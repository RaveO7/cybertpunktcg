import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Verrou commun à toutes les copies du projet (worktrees) sur la machine. */
const LOCK_FILE = path.join(tmpdir(), "cybertpunktcg-perf-audit.lock");

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM : le processus existe mais appartient à un autre utilisateur.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Une seule mesure à la fois sur la machine : deux mesures simultanées se partagent processeur et
 * réseau (temps et scores Lighthouse faussés). Attend la fin de la mesure en cours ; un verrou
 * laissé par un processus disparu est repris. Renvoie la fonction qui libère le verrou.
 */
export async function acquireMeasureLock(): Promise<() => void> {
  let announced = false;
  for (;;) {
    try {
      writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
      const release = () => {
        try {
          if (readFileSync(LOCK_FILE, "utf8") === String(process.pid)) unlinkSync(LOCK_FILE);
        } catch {
          // Déjà libéré.
        }
      };
      process.once("exit", release);
      return release;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const owner = Number(readFileSync(LOCK_FILE, "utf8").trim()) || 0;
    if (!owner || !alive(owner)) {
      try {
        unlinkSync(LOCK_FILE);
      } catch {
        // Repris par une autre mesure entre-temps.
      }
      continue;
    }
    if (!announced) {
      console.log(`Une autre mesure est en cours (processus ${owner}) : attente de sa fin pour mesurer dans les mêmes conditions…`);
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
