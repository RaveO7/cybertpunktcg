import { Landing, landingMetadata } from "@/components/public-site/Landing";

export const metadata = landingMetadata("en");

export default function EnglishHomePage() {
  return <Landing locale="en" />;
}
