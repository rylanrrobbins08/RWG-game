import type { Metadata } from "next";
import SchoolPage from "../components/SchoolPage";

export const metadata: Metadata = {
  title: "School",
  description: "Study and upgrade your wrestler's letter grade in RWG.",
};

export default function SchoolRoute() {
  return <SchoolPage />;
}
