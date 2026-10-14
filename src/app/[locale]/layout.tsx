import { SiteShell, siteViewport } from "@/components/site/SiteShell";
import { rootMetadata } from "@/lib/seo/metadata";
import "../globals.css";

export const metadata = rootMetadata("fr");

export const viewport = siteViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell lang="fr">{children}</SiteShell>;
}
