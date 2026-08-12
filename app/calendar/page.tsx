import type { Metadata } from "next";
import Calendar from "../components/Calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Full-year wrestling calendar with weekly events and majors like Fargo and Super 32.",
};

export default function CalendarPage() {
  return <Calendar />;
}
