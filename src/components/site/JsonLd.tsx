import { serializeJsonLd, type JsonLdObject } from "@/lib/seo/structured-data";

/** Données structurées schema.org, rendues côté serveur : un script par objet, entrées nulles ignorées. */
export function JsonLd({ data }: { data: (JsonLdObject | null)[] }) {
  return (
    <>
      {data
        .filter((item): item is JsonLdObject => item !== null)
        .map((item, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }} />
        ))}
    </>
  );
}
