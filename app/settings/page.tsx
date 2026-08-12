import type { Metadata } from "next";
import SettingsProfile from "../components/SettingsProfile";

export const metadata: Metadata = {
  title: "Settings",
  description: "Profile, export/save career data, and logout.",
};

export default function SettingsPage() {
  return <SettingsProfile />;
}
