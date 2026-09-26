import MarketingShell from "@/components/marketing/MarketingShell";
import LandingV2 from "@/components/landing-v2/LandingV2";

// Home page. Metadata (title, description, canonical, hreflang) comes from the
// [locale] layout.
export default function Home() {
  return (
    <MarketingShell>
      <LandingV2 />
    </MarketingShell>
  );
}
