import { getCurrentUser } from "@/lib/auth";
import { portalRoutes } from "@/lib/constants";
import { LandingHero } from "@/components/landing-hero";
import { LandingMetricsSection, LandingPillarsSection } from "@/components/landing-sections";

export default async function Home() {
  const currentUser = await getCurrentUser();

  return (
    <main className="min-h-screen">
      <LandingHero
        isLoggedIn={Boolean(currentUser)}
        portalHref={currentUser ? portalRoutes[currentUser.role] : undefined}
      />
      <LandingMetricsSection />
      <LandingPillarsSection />
    </main>
  );
}
