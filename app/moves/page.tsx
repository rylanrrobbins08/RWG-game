import type { Metadata } from "next";
import MoveEquip from "../components/MoveEquip";

export const metadata: Metadata = {
  title: "Moves",
  description: "Equip 4 moves per position from your unlocked pool.",
};

export default function MovesPage() {
  return <MoveEquip />;
}
