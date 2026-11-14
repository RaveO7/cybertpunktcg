"use client";

// Fichier à part : la bibliothèque qrcode (≈ 30 Ko) n'entre ainsi que dans les écrans qui affichent un
// QR code, et non dans tous ceux qui importent les classes de ./ui (annuaires de l'accueil…).
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR code (SVG) d'une URL : modules noirs sur fond blanc, pour un scan fiable. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-64 bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
