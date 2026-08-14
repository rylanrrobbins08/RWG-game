import type { Metadata } from "next";
import WrestlerSelect from "./components/WrestlerSelect";
import LoginScreen from "./components/LoginScreen";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import { getOptionalUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "RWG",
  description: "Log in or pick a wrestler to start your career.",
};

/** App entry: login when signed out, wrestler select when signed in. */
export default async function Home() {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return <LoginScreen />;
    }

    const result = await listWrestlersFromCloud();
    return (
      <WrestlerSelect
        initialWrestlers={result.data}
        loadError={result.ok ? null : result.error}
      />
    );
  } catch (error) {
    console.error("Home page:", error);
    return <LoginScreen />;
  }
}
