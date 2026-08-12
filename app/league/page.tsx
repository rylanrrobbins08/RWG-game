import type { Metadata } from "next";
import LeagueDashboard from "../components/LeagueDashboard";

export const metadata: Metadata = {
  title: "League",
  description: "League name, leaderboard, and chat for RWG.",
};

export default function LeaguePage() {
  return <LeagueDashboard />;
}
