import type { Metadata } from "next";
import CoachDashboard from "../components/CoachDashboard";

export const metadata: Metadata = {
  title: "Coach",
  description: "Post-Olympic coach career mode stub.",
};

export default function CoachPage() {
  return <CoachDashboard />;
}
