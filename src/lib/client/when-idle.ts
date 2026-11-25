/** Lance `task` quand le navigateur est au repos ; renvoie de quoi l'annuler. */
export function whenIdle(task: () => void) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(task, 1500);
  return () => clearTimeout(id);
}
