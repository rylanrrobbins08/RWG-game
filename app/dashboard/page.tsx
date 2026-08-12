import type { Metadata } from "next";
import Dashboard from "../components/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your season, train, and wrestle in RWG.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
