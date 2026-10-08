"use client";

// Remplace le layout racine quand celui-ci plante : ni styles globaux ni providers ici,
// d'où les styles en ligne et le texte bilingue.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#07080d", color: "#e8eef7", fontFamily: "system-ui, sans-serif" }}>
        <title>Erreur · Collection Cyberpunk TCG</title>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.18em", color: "#3ee0ff" }}>ERREUR · ERROR</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 600, color: "#f5e642" }}>Une erreur est survenue</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#93a0b4" }}>
            L’application n’a pas pu s’afficher. Something went wrong.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, height: 48, padding: "0 16px", background: "transparent", border: "1px solid #3ee0ff", color: "#3ee0ff", fontSize: 14, cursor: "pointer" }}
          >
            Réessayer · Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontFamily: "monospace", fontSize: 12, color: "#93a0b4" }}>Réf. {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
