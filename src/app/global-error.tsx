"use client";

import { GlobalFallback } from "@/components/site/GlobalFallback";

// Remplace le layout racine quand celui-ci plante : ni styles globaux ni providers ici, d'où les
// styles en ligne ; le texte vient du bloc « errors » de la langue de l'URL.
const style: Record<string, React.CSSProperties> = {
  main: { maxWidth: 480, margin: "0 auto", padding: "64px 16px", textAlign: "center" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.18em", color: "#3ee0ff" },
  title: { margin: "4px 0 0", fontSize: 24, fontWeight: 600, color: "#f5e642" },
  body: { marginTop: 8, fontSize: 14, color: "#93a0b4" },
  button: {
    marginTop: 24,
    height: 48,
    padding: "0 16px",
    background: "transparent",
    border: "1px solid #3ee0ff",
    color: "#3ee0ff",
    fontSize: 14,
    cursor: "pointer",
  },
  digest: { marginTop: 16, fontFamily: "monospace", fontSize: 12, color: "#93a0b4" },
};

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#07080d", color: "#e8eef7", fontFamily: "system-ui, sans-serif" }}>
        <GlobalFallback kind="error" digest={error.digest} retry={retry} style={style} />
      </body>
    </html>
  );
}
