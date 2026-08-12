import type { Metadata } from "next";
import TrainersPage from "../components/TrainersPage";

export const metadata: Metadata = {
  title: "Trainers",
  description: "Hire specialty trainers to boost attribute training in RWG.",
};

export default function TrainersRoute() {
  return <TrainersPage />;
}
