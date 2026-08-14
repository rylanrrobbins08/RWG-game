import { redirect } from "next/navigation";
import WrestlerSelect from "./components/WrestlerSelect";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import { getOptionalUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** Entry: login if signed out, wrestler select if signed in. */
export default async function Home() {
  const user = await getOptionalUser().catch(() => null);
  if (!user) {
    redirect("/auth");
  }

  try {
    const result = await listWrestlersFromCloud();
    return (
      <WrestlerSelect
        initialWrestlers={result.data}
        loadError={result.ok ? null : result.error}
      />
    );
  } catch (error) {
    console.error("Home page:", error);
    return (
      <WrestlerSelect
        initialWrestlers={[]}
        loadError="Could not load wrestlers."
      />
    );
  }
}
