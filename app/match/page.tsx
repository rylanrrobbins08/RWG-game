import type { Metadata } from "next";
import ScheduledMatch from "../components/ScheduledMatch";

export const metadata: Metadata = {
  title: "Match",
  description: "Wrestle the dual, tournament, or major scheduled for the current week.",
};

export default function MatchPage() {
  return <ScheduledMatch />;
}
