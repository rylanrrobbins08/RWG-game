import type { Metadata } from "next";
import Training from "../components/Training";

export const metadata: Metadata = {
  title: "Training",
  description: "Freely allocate training points across wrestler attributes.",
};

export default function TrainingPage() {
  return <Training />;
}
