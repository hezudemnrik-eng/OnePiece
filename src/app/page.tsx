import { HomeOverview } from "@/components/HomeOverview";

// Rendering here depends on AuthGate's client-side auth check in the root
// layout, so this route can't produce a static instant-navigation shell.
export const instant = false;

export default function Home() {
  return <HomeOverview />;
}
