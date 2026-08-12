import type { Metadata } from "next";
import MoveUpgrades from "../components/MoveUpgrades";

export const metadata: Metadata = {
  title: "Upgrades",
  description: "Upgrade moves to Level 1, 2, or 3 using budget.",
};

export default function UpgradesPage() {
  return <MoveUpgrades />;
}
